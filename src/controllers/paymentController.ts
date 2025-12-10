import { Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import logger from '../config/logger';
import { StudentAuthRequest } from '../types/express';
import * as paystack from '../utils/paystack';
import * as flutterwave from '../utils/flutterwave';
import { toKobo, fromKobo, generatePaymentReference } from '../utils/helpers';
import { generatePaymentReceipt, ensureUploadDir } from '../utils/pdfGenerator';
import { sendPaymentReceiptEmail } from '../utils/email';
import path from 'path';

const initializePaymentSchema = z.object({
  invoiceId: z.number(),
  method: z.enum(['PAYSTACK', 'FLUTTERWAVE', 'WALLET']),
  amount: z.number().positive(),
});

export const getInvoices = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;
    const { status, session } = req.query;

    const where: any = { studentId };
    if (status) where.status = status;
    if (session) where.session = { name: session };

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        session: true,
        semester: true,
        payments: {
          where: { status: 'PAID' },
          orderBy: { paidAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedInvoices = invoices.map(inv => ({
      id: inv.id,
      invoiceNo: inv.invoiceNo,
      type: inv.type,
      description: inv.description,
      amount: inv.amount,
      amountPaid: inv.amountPaid,
      balance: inv.balance,
      level: inv.level,
      status: inv.status,
      session: inv.session.name,
      semester: inv.semester?.type,
      dueDate: inv.dueDate,
      cardPayment: inv.cardPayment,
      walletPayment: inv.walletPayment,
      payments: inv.payments.map(p => ({
        amount: p.amount,
        method: p.method,
        paidAt: p.paidAt,
      })),
    }));

    res.json({
      success: true,
      data: formattedInvoices,
    });
  } catch (error) {
    logger.error('Get invoices error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoices',
    });
  }
};

export const initiatePayment = async (req: StudentAuthRequest, res: Response) => {
  try {
    const data = initializePaymentSchema.parse(req.body);
    const studentId = req.student!.id;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        walletBalance: true,
      },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: data.invoiceId },
      include: { session: true },
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
      });
    }

    if (invoice.studentId !== studentId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    if (invoice.balance <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invoice already fully paid',
      });
    }

    if (data.amount > invoice.balance) {
      return res.status(400).json({
        success: false,
        message: 'Amount exceeds invoice balance',
      });
    }

    const reference = generatePaymentReference();

    // Handle wallet payment
    if (data.method === 'WALLET') {
      if (!invoice.walletPayment) {
        return res.status(400).json({
          success: false,
          message: 'Wallet payment not allowed for this invoice',
        });
      }

      if (student.walletBalance < data.amount) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient wallet balance',
        });
      }

      // Process wallet payment immediately
      const payment = await prisma.$transaction(async (tx) => {
        // Deduct from wallet
        await tx.student.update({
          where: { id: studentId },
          data: { walletBalance: { decrement: data.amount } },
        });

        // Create payment record
        const pmt = await tx.payment.create({
          data: {
            studentId,
            invoiceId: invoice.id,
            amount: data.amount,
            method: 'WALLET',
            reference,
            status: 'PAID',
            paidAt: new Date(),
          },
        });

        // Update invoice
        const newAmountPaid = invoice.amountPaid + data.amount;
        const newBalance = invoice.amount - newAmountPaid;
        const newStatus = newBalance <= 0 ? 'PAID' : newBalance < invoice.amount ? 'PARTIALLY_PAID' : invoice.status;

        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            amountPaid: newAmountPaid,
            balance: newBalance,
            status: newStatus,
          },
        });

        return pmt;
      });

      // Generate receipt
      ensureUploadDir();
      const receiptPath = path.join(__dirname, '../../uploads/receipts', `${reference}.pdf`);
      await generatePaymentReceipt(
        {
          reference,
          studentName: `${student.firstName} ${student.lastName}`,
          matricNo: req.student!.matricNo,
          invoiceNo: invoice.invoiceNo,
          description: invoice.description || invoice.type,
          amount: data.amount,
          method: 'WALLET',
          paidAt: payment.paidAt!,
        },
        receiptPath
      );

      // Send email
      await sendPaymentReceiptEmail(
        student.email,
        `${student.firstName} ${student.lastName}`,
        invoice.invoiceNo,
        data.amount,
        `${process.env.APP_URL}/uploads/receipts/${reference}.pdf`
      );

      return res.json({
        success: true,
        message: 'Payment successful',
        data: {
          reference,
          status: 'PAID',
          receiptUrl: `/uploads/receipts/${reference}.pdf`,
        },
      });
    }

    // Handle Paystack payment
    if (data.method === 'PAYSTACK') {
      if (!invoice.cardPayment) {
        return res.status(400).json({
          success: false,
          message: 'Card payment not allowed for this invoice',
        });
      }

      const result = await paystack.initializePayment({
        email: student.email,
        amount: toKobo(data.amount),
        reference,
        callback_url: `${process.env.STUDENT_PORTAL_URL}/payments/verify`,
        metadata: {
          studentId,
          invoiceId: invoice.id,
          invoiceNo: invoice.invoiceNo,
        },
      });

      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: result.error || 'Payment initialization failed',
        });
      }

      // Create pending payment record
      await prisma.payment.create({
        data: {
          studentId,
          invoiceId: invoice.id,
          amount: data.amount,
          method: 'PAYSTACK',
          reference,
          status: 'PENDING',
        },
      });

      return res.json({
        success: true,
        message: 'Payment initialized',
        data: {
          reference,
          authorizationUrl: result.data.authorization_url,
          accessCode: result.data.access_code,
        },
      });
    }

    // Handle Flutterwave payment
    if (data.method === 'FLUTTERWAVE') {
      if (!invoice.cardPayment) {
        return res.status(400).json({
          success: false,
          message: 'Card payment not allowed for this invoice',
        });
      }

      const result = await flutterwave.initializePayment({
        tx_ref: reference,
        amount: data.amount,
        currency: 'NGN',
        redirect_url: `${process.env.STUDENT_PORTAL_URL}/payments/verify`,
        customer: {
          email: student.email,
          name: `${student.firstName} ${student.lastName}`,
        },
        customizations: {
          title: 'IMS Payment',
          description: `Payment for ${invoice.invoiceNo}`,
          logo: `${process.env.APP_URL}/logo.png`,
        },
        meta: {
          studentId,
          invoiceId: invoice.id,
          invoiceNo: invoice.invoiceNo,
        },
      });

      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: result.error || 'Payment initialization failed',
        });
      }

      // Create pending payment record
      await prisma.payment.create({
        data: {
          studentId,
          invoiceId: invoice.id,
          amount: data.amount,
          method: 'FLUTTERWAVE',
          reference,
          status: 'PENDING',
        },
      });

      return res.json({
        success: true,
        message: 'Payment initialized',
        data: {
          reference,
          paymentLink: result.data.link,
        },
      });
    }

    res.status(400).json({
      success: false,
      message: 'Invalid payment method',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }

    logger.error('Initiate payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Payment initialization failed',
    });
  }
};

export const verifyPayment = async (req: StudentAuthRequest, res: Response) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: 'Payment reference required',
      });
    }

    const payment = await prisma.payment.findUnique({
      where: { reference },
      include: {
        student: true,
        invoice: true,
      },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found',
      });
    }

    if (payment.status === 'PAID') {
      return res.json({
        success: true,
        message: 'Payment already verified',
        data: {
          reference: payment.reference,
          status: 'PAID',
          amount: payment.amount,
        },
      });
    }

    let verified = false;
    let gatewayResponse = '';

    // Verify with appropriate gateway
    if (payment.method === 'PAYSTACK') {
      const result = await paystack.verifyPayment(reference);
      if (result && result.data.status === 'success') {
        verified = true;
        gatewayResponse = JSON.stringify(result.data);
      }
    } else if (payment.method === 'FLUTTERWAVE') {
      const result = await flutterwave.verifyPayment(reference);
      if (result.success && result.data.status === 'successful') {
        verified = true;
        gatewayResponse = JSON.stringify(result.data);
      }
    }

    if (!verified) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed',
      });
    }

    // Update payment and invoice
    await prisma.$transaction(async (tx) => {
      // Update payment
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          gatewayResponse,
        },
      });

      // Update invoice
      const newAmountPaid = payment.invoice.amountPaid + payment.amount;
      const newBalance = payment.invoice.amount - newAmountPaid;
      const newStatus = newBalance <= 0 ? 'PAID' : newBalance < payment.invoice.amount ? 'PARTIALLY_PAID' : payment.invoice.status;

      await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: {
          amountPaid: newAmountPaid,
          balance: newBalance,
          status: newStatus,
        },
      });
    });

    // Generate receipt
    ensureUploadDir();
    const receiptPath = path.join(__dirname, '../../uploads/receipts', `${reference}.pdf`);
    await generatePaymentReceipt(
      {
        reference,
        studentName: `${payment.student.firstName} ${payment.student.lastName}`,
        matricNo: payment.student.matricNo,
        invoiceNo: payment.invoice.invoiceNo,
        description: payment.invoice.description || payment.invoice.type,
        amount: payment.amount,
        method: payment.method,
        paidAt: new Date(),
      },
      receiptPath
    );

    // Send email
    await sendPaymentReceiptEmail(
      payment.student.email,
      `${payment.student.firstName} ${payment.student.lastName}`,
      payment.invoice.invoiceNo,
      payment.amount,
      `${process.env.APP_URL}/uploads/receipts/${reference}.pdf`
    );

    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        reference: payment.reference,
        status: 'PAID',
        amount: payment.amount,
        receiptUrl: `/uploads/receipts/${reference}.pdf`,
      },
    });
  } catch (error) {
    logger.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Payment verification failed',
    });
  }
};

export const getPaymentHistory = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;
    const { page = '1', limit = '20', status } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { studentId };
    if (status) where.status = status;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          invoice: {
            select: {
              invoiceNo: true,
              type: true,
              description: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.payment.count({ where }),
    ]);

    res.json({
      success: true,
      data: payments,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment history',
    });
  }
};

export const downloadReceipt = async (req: StudentAuthRequest, res: Response) => {
  try {
    const { reference } = req.params;
    const studentId = req.student!.id;

    const payment = await prisma.payment.findUnique({
      where: { reference },
      include: {
        student: true,
        invoice: true,
      },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found',
      });
    }

    if (payment.studentId !== studentId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    if (payment.status !== 'PAID') {
      return res.status(400).json({
        success: false,
        message: 'Cannot download receipt for unpaid payment',
      });
    }

    const receiptPath = path.join(__dirname, '../../uploads/receipts', `${reference}.pdf`);

    // Generate if doesn't exist
    if (!require('fs').existsSync(receiptPath)) {
      ensureUploadDir();
      await generatePaymentReceipt(
        {
          reference,
          studentName: `${payment.student.firstName} ${payment.student.lastName}`,
          matricNo: payment.student.matricNo,
          invoiceNo: payment.invoice.invoiceNo,
          description: payment.invoice.description || payment.invoice.type,
          amount: payment.amount,
          method: payment.method,
          paidAt: payment.paidAt!,
        },
        receiptPath
      );
    }

    res.download(receiptPath, `receipt-${reference}.pdf`);
  } catch (error) {
    logger.error('Download receipt error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download receipt',
    });
  }
};

export const getStatementOfAccount = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;

    const invoices = await prisma.invoice.findMany({
      where: { studentId },
      include: {
        session: true,
        payments: {
          where: { status: 'PAID' },
          orderBy: { paidAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.amount, 0);
    const totalPaid = invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
    const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.balance, 0);

    res.json({
      success: true,
      data: {
        summary: {
          totalInvoiced,
          totalPaid,
          totalOutstanding,
        },
        invoices: invoices.map(inv => ({
          invoiceNo: inv.invoiceNo,
          type: inv.type,
          description: inv.description,
          amount: inv.amount,
          amountPaid: inv.amountPaid,
          balance: inv.balance,
          status: inv.status,
          session: inv.session.name,
          payments: inv.payments.map(p => ({
            reference: p.reference,
            amount: p.amount,
            method: p.method,
            paidAt: p.paidAt,
          })),
        })),
      },
    });
  } catch (error) {
    logger.error('Get statement error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statement',
    });
  }
};

export const topUpWallet = async (req: StudentAuthRequest, res: Response) => {
  try {
    const { amount, method } = req.body;
    const studentId = req.student!.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount',
      });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    const reference = `WALLET-${generatePaymentReference()}`;

    // Initialize payment based on method
    if (method === 'PAYSTACK') {
      const result = await paystack.initializePayment({
        email: student.email,
        amount: toKobo(amount),
        reference,
        callback_url: `${process.env.STUDENT_PORTAL_URL}/wallet/verify`,
        metadata: {
          studentId,
          type: 'WALLET_TOPUP',
        },
      });

      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: result.error || 'Payment initialization failed',
        });
      }

      return res.json({
        success: true,
        message: 'Wallet top-up initialized',
        data: {
          reference,
          authorizationUrl: result.data.authorization_url,
        },
      });
    }

    if (method === 'FLUTTERWAVE') {
      const result = await flutterwave.initializePayment({
        tx_ref: reference,
        amount,
        currency: 'NGN',
        redirect_url: `${process.env.STUDENT_PORTAL_URL}/wallet/verify`,
        customer: {
          email: student.email,
          name: `${student.firstName} ${student.lastName}`,
        },
        customizations: {
          title: 'Wallet Top-up',
          description: 'Add funds to your wallet',
          logo: `${process.env.APP_URL}/logo.png`,
        },
        meta: {
          studentId,
          type: 'WALLET_TOPUP',
        },
      });

      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: result.error || 'Payment initialization failed',
        });
      }

      return res.json({
        success: true,
        message: 'Wallet top-up initialized',
        data: {
          reference,
          paymentLink: result.data.link,
        },
      });
    }

    res.status(400).json({
      success: false,
      message: 'Invalid payment method',
    });
  } catch (error) {
    logger.error('Wallet top-up error:', error);
    res.status(500).json({
      success: false,
      message: 'Wallet top-up failed',
    });
  }
};

export const verifyWalletTopup = async (req: StudentAuthRequest, res: Response) => {
  try {
    const { reference } = req.body;
    const studentId = req.student!.id;

    if (!reference || !reference.startsWith('WALLET-')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wallet top-up reference',
      });
    }

    // Check if already processed
    const existingTopup = await prisma.student.findFirst({
      where: {
        id: studentId,
        // You might want to track this in a separate table
      },
    });

    // Verify with payment gateway
    const actualRef = reference.replace('WALLET-', '');
    let verified = false;
    let amount = 0;

    // Try Paystack first
    const paystackResult = await paystack.verifyPayment(actualRef);
    if (paystackResult && paystackResult.data.status === 'success') {
      verified = true;
      amount = fromKobo(paystackResult.data.amount);
    }

    // If not found, try Flutterwave
    if (!verified) {
      const flutterwaveResult = await flutterwave.verifyPayment(actualRef);
      if (flutterwaveResult.success && flutterwaveResult.data.status === 'successful') {
        verified = true;
        amount = flutterwaveResult.data.amount;
      }
    }

    if (!verified) {
      return res.status(400).json({
        success: false,
        message: 'Wallet top-up verification failed',
      });
    }

    // Credit wallet
    await prisma.student.update({
      where: { id: studentId },
      data: {
        walletBalance: { increment: amount },
      },
    });

    logger.info(`Wallet credited for student ${studentId}: ₦${amount}`);

    res.json({
      success: true,
      message: 'Wallet topped up successfully',
      data: {
        amount,
        reference,
      },
    });
  } catch (error) {
    logger.error('Verify wallet top-up error:', error);
    res.status(500).json({
      success: false,
      message: 'Wallet top-up verification failed',
    });
  }
};
