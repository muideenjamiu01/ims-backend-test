import { Request, Response } from 'express';
import { PrismaClient, PaymentStatus, PaymentMethod, InvoiceType } from '@prisma/client';
import { StudentAuthRequest } from '../middleware/studentAuth';
import axios from 'axios';
import crypto from 'crypto';
import { z } from 'zod';
import PDFDocument from 'pdfkit';

const prisma = new PrismaClient();

// Payment gateway configurations
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY || '';
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY || '';
const FLUTTERWAVE_PUBLIC_KEY = process.env.FLUTTERWAVE_PUBLIC_KEY || '';

// Validation schemas
const paymentInitSchema = z.object({
  invoiceId: z.number(),
  method: z.enum(['PAYSTACK', 'FLUTTERWAVE']),
});

const walletPaymentSchema = z.object({
  invoiceId: z.number(),
});

// Get student invoices
export const getInvoices = async (req: Request, res: Response) => {
  try {
    const studentId = (req as StudentAuthRequest).student?.id;
    const { status, type } = req.query;

    if (!studentId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const whereCondition: any = { studentId };

    if (status) {
      whereCondition.status = status;
    }

    if (type) {
      whereCondition.type = type;
    }

    const invoices = await prisma.invoice.findMany({
      where: whereCondition,
      include: {
        session: {
          select: {
            name: true,
          },
        },
        semester: {
          select: {
            type: true,
          },
        },
        payments: {
          where: {
            status: 'PAID',
          },
          select: {
            id: true,
            amount: true,
            paidAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      success: true,
      data: invoices,
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoices',
    });
  }
};

// Get payment history
export const getPaymentHistory = async (req: Request, res: Response) => {
  try {
    const studentId = (req as StudentAuthRequest).student?.id;

    if (!studentId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const payments = await prisma.payment.findMany({
      where: { studentId },
      include: {
        invoice: {
          select: {
            invoiceNo: true,
            type: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      success: true,
      data: payments,
    });
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment history',
    });
  }
};

// Get wallet balance
export const getWalletBalance = async (req: Request, res: Response) => {
  try {
    const studentId = (req as StudentAuthRequest).student?.id;

    if (!studentId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { walletBalance: true },
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    res.json({
      success: true,
      data: {
        balance: student.walletBalance,
      },
    });
  } catch (error) {
    console.error('Error fetching wallet balance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wallet balance',
    });
  }
};

// Initialize payment with Paystack
const initializePaystack = async (email: string, amount: number, reference: string, metadata: any) => {
  const response = await axios.post(
    'https://api.paystack.co/transaction/initialize',
    {
      email,
      amount: amount * 100, // Convert to kobo
      reference,
      metadata,
      callback_url: `${process.env.FRONTEND_URL}/student/payments/verify`,
    },
    {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
};

// Initialize payment with Flutterwave
const initializeFlutterwave = async (email: string, amount: number, reference: string, metadata: any) => {
  const response = await axios.post(
    'https://api.flutterwave.com/v3/payments',
    {
      tx_ref: reference,
      amount,
      currency: 'NGN',
      redirect_url: `${process.env.FRONTEND_URL}/student/payments/verify`,
      customer: {
        email,
      },
      meta: metadata,
    },
    {
      headers: {
        Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
};

// Initialize payment
export const initializePayment = async (req: Request, res: Response) => {
  try {
    const validation = paymentInitSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: validation.error.errors,
      });
    }

    const { invoiceId, method } = validation.data;
    const studentId = (req as StudentAuthRequest).student?.id;

    if (!studentId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Get student and invoice details
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { email: true, firstName: true, lastName: true },
    });

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        studentId,
        status: { not: 'PAID' },
        balance: { gt: 0 },
      },
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    if (!invoice) {
      return res.status(404).json({ 
        success: false, 
        message: 'Invoice not found or already paid' 
      });
    }

    // Generate unique payment reference
    const reference = `pay_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        studentId,
        invoiceId,
        amount: invoice.balance,
        method,
        reference,
        status: 'PENDING',
      },
    });

    const metadata = {
      paymentId: payment.id,
      invoiceId,
      studentId,
      studentName: `${student.firstName} ${student.lastName}`,
    };

    let paymentData;

    if (method === 'PAYSTACK') {
      paymentData = await initializePaystack(
        student.email,
        invoice.balance,
        reference,
        metadata
      );
    } else if (method === 'FLUTTERWAVE') {
      paymentData = await initializeFlutterwave(
        student.email,
        invoice.balance,
        reference,
        metadata
      );
    } else {
      return res.status(400).json({
        success: false,
        message: 'Unsupported payment method',
      });
    }

    res.json({
      success: true,
      data: {
        reference,
        authorization_url: paymentData.data?.authorization_url || paymentData.data?.link,
        paymentId: payment.id,
      },
    });
  } catch (error) {
    console.error('Error initializing payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initialize payment',
    });
  }
};

// Pay with wallet
export const payWithWallet = async (req: Request, res: Response) => {
  try {
    const validation = walletPaymentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: validation.error.errors,
      });
    }

    const { invoiceId } = validation.data;
    const studentId = (req as StudentAuthRequest).student?.id;

    if (!studentId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Start transaction
    return await prisma.$transaction(async (tx) => {
      // Get student wallet balance
      const student = await tx.student.findUnique({
        where: { id: studentId },
        select: { walletBalance: true },
      });

      // Get invoice
      const invoice = await tx.invoice.findFirst({
        where: {
          id: invoiceId,
          studentId,
          status: { not: 'PAID' },
          balance: { gt: 0 },
        },
      });

      if (!student) {
        throw new Error('Student not found');
      }

      if (!invoice) {
        throw new Error('Invoice not found or already paid');
      }

      if (student.walletBalance < invoice.balance) {
        throw new Error('Insufficient wallet balance');
      }

      // Generate payment reference
      const reference = `wallet_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

      // Create payment record
      const payment = await tx.payment.create({
        data: {
          studentId,
          invoiceId,
          amount: invoice.balance,
          method: 'WALLET',
          reference,
          status: 'PAID',
          paidAt: new Date(),
        },
      });

      // Update wallet balance
      await tx.student.update({
        where: { id: studentId },
        data: {
          walletBalance: {
            decrement: invoice.balance,
          },
        },
      });

      // Update invoice
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid: {
            increment: invoice.balance,
          },
          balance: 0,
          status: 'PAID',
        },
      });

      // Create notification
      await tx.notification.create({
        data: {
          studentId,
          title: 'Payment Successful',
          message: `Payment of ₦${invoice.balance.toLocaleString()} for ${invoice.type.replace(/_/g, ' ')} has been processed successfully.`,
          type: 'SUCCESS',
        },
      });

      return res.json({
        success: true,
        data: {
          paymentId: payment.id,
          reference: payment.reference,
          message: 'Payment successful',
        },
      });
    });
  } catch (error: any) {
    console.error('Error processing wallet payment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process payment',
    });
  }
};

// Verify payment (webhook handler)
export const verifyPayment = async (req: Request, res: Response) => {
  try {
    // Get parameters from query string (when returning from gateway)
    const { trxref, reference, status } = req.query;
    const paymentReference = reference || trxref; // Handle both parameter names

    if (!paymentReference) {
      return res.status(400).json({
        success: false,
        message: 'Payment reference is required',
      });
    }

    // Find payment record
    const payment = await prisma.payment.findUnique({
      where: { reference: paymentReference as string },
      include: {
        invoice: true,
        student: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found',
      });
    }

    if (payment.status === 'PAID') {
      // Redirect to success page even if already verified
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const redirectUrl = `${frontendUrl}/student/payments/verify?status=success&reference=${paymentReference}`;
      return res.redirect(redirectUrl);
    }

    // Verify payment with gateway
    let paymentStatus: PaymentStatus = 'FAILED';
    let gatewayResponse: any = {};

    console.log(`[DEBUG] Verifying payment with ${payment.method} for reference: ${paymentReference}`);
    
    try {
      if (payment.method === 'PAYSTACK') {
        console.log('[DEBUG] Calling Paystack API...');
        // Verify with Paystack
        const paystackResponse = await axios.get(
          `https://api.paystack.co/transaction/verify/${paymentReference}`,
          {
            headers: {
              Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            },
          }
        );

        gatewayResponse = paystackResponse.data;
        console.log('[DEBUG] Paystack response:', JSON.stringify(gatewayResponse, null, 2));
        
        if (paystackResponse.data.status && paystackResponse.data.data.status === 'success') {
          paymentStatus = 'PAID';
          console.log('[DEBUG] Payment verified as PAID');
        } else {
          console.log('[DEBUG] Payment verification failed - status not success');
        }
      } else if (payment.method === 'FLUTTERWAVE') {
        console.log('[DEBUG] Calling Flutterwave API...');
        // Verify with Flutterwave
        const flutterwaveResponse = await axios.get(
          `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${paymentReference}`,
          {
            headers: {
              Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
            },
          }
        );

        gatewayResponse = flutterwaveResponse.data;
        console.log('[DEBUG] Flutterwave response:', JSON.stringify(gatewayResponse, null, 2));
        
        if (flutterwaveResponse.data.status === 'success' && flutterwaveResponse.data.data.status === 'successful') {
          paymentStatus = 'PAID';
          console.log('[DEBUG] Payment verified as PAID');
        } else {
          console.log('[DEBUG] Payment verification failed - status not successful');
        }
      }
    } catch (error) {
      console.error('[DEBUG] Gateway verification error:', error instanceof Error ? error.message : error);
      console.error('[DEBUG] Error details:', (error as any)?.response?.data || 'No response data');
      // Continue with failed status
    }

    console.log(`[DEBUG] Final payment status: ${paymentStatus}`);

    await prisma.$transaction(async (tx) => {
      // Update payment
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: paymentStatus,
          paidAt: paymentStatus === 'PAID' ? new Date() : null,
          gatewayResponse: JSON.stringify(gatewayResponse),
        },
      });

      if (paymentStatus === 'PAID') {
        // Update invoice
        const updatedInvoice = await tx.invoice.update({
          where: { id: payment.invoiceId },
          data: {
            amountPaid: {
              increment: payment.amount,
            },
            balance: {
              decrement: payment.amount,
            },
          },
        });

        // Update invoice status if fully paid
        if (updatedInvoice.balance <= 0) {
          await tx.invoice.update({
            where: { id: payment.invoiceId },
            data: { status: 'PAID' },
          });
        }

        // Create notification
        await tx.notification.create({
          data: {
            studentId: payment.studentId,
            title: 'Payment Successful',
            message: `Payment of ₦${payment.amount.toLocaleString()} for ${payment.invoice.type.replace(/_/g, ' ')} has been processed successfully.`,
            type: 'SUCCESS',
          },
        });
      }
    });

    // Redirect to student payments verification page with status
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectUrl = `${frontendUrl}/student/payments/verify?status=${paymentStatus === 'PAID' ? 'success' : 'failed'}&reference=${paymentReference}`;
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
    });
  }
};

// Download payment receipt
export const downloadReceipt = async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;
    const studentId = (req as StudentAuthRequest).student?.id;

    if (!studentId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const payment = await prisma.payment.findFirst({
      where: {
        id: parseInt(paymentId),
        studentId,
        status: 'PAID',
      },
      include: {
        invoice: {
          include: {
            session: true,
            semester: true,
          },
        },
        student: {
          select: {
            firstName: true,
            lastName: true,
            matricNo: true,
            email: true,
            department: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment receipt not found',
      });
    }

    // Generate PDF receipt using PDFKit
    const doc = new PDFDocument({ margin: 50 });

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt_${payment.reference}.pdf`);

    // Pipe the PDF directly to the response
    doc.pipe(res);

    // Receipt data
    const receiptNo = `RCP-${payment.id.toString().padStart(6, '0')}`;
    const studentName = `${payment.student.firstName} ${payment.student.lastName}`;
    const department = payment.student.department?.name || 'N/A';
    const session = payment.invoice.session?.name || 'N/A';
    const semester = payment.invoice.semester ? payment.invoice.semester.type : 'N/A';

    // Header
    doc.fontSize(20).text('PAYMENT RECEIPT', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).text('Institution Management System', { align: 'center' });
    doc.moveDown(1);

    // Receipt details
    doc.fontSize(14).text(`Receipt No: ${receiptNo}`);
    doc.moveDown(0.5);

    // Student information
    doc.fontSize(12).text('Student Information:');
    doc.fontSize(10)
      .text(`Name: ${studentName}`)
      .text(`Matric No: ${payment.student.matricNo}`)
      .text(`Department: ${department}`)
      .text(`Email: ${payment.student.email}`);
    doc.moveDown(1);

    // Payment information
    doc.fontSize(12).text('Payment Information:');
    doc.fontSize(10)
      .text(`Invoice No: ${payment.invoice.invoiceNo}`)
      .text(`Payment Type: ${payment.invoice.type.replace(/_/g, ' ')}`)
      .text(`Session: ${session}`)
      .text(`Semester: ${semester}`)
      .text(`Amount: ₦${payment.amount.toLocaleString()}`)
      .text(`Payment Method: ${payment.method}`)
      .text(`Reference: ${payment.reference}`)
      .text(`Payment Date: ${payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : 'N/A'}`)
      .text(`Receipt Date: ${new Date().toLocaleDateString()}`);
    doc.moveDown(1);

    // Description if available
    if (payment.invoice.description) {
      doc.fontSize(12).text('Description:');
      doc.fontSize(10).text(payment.invoice.description);
      doc.moveDown(1);
    }

    // Footer
    doc.moveDown(2);
    doc.fontSize(8)
      .text('This is a computer-generated receipt and does not require a signature.', { align: 'center' })
      .text('For inquiries, please contact the finance office.', { align: 'center' });

    // Finalize the PDF
    doc.end();
  } catch (error) {
    console.error('Error generating receipt:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate receipt',
    });
  }
};

// Get dashboard stats
export const getPaymentStats = async (req: Request, res: Response) => {
  try {
    const studentId = (req as StudentAuthRequest).student?.id;

    if (!studentId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const [totalInvoices, paidInvoices, pendingPayments, totalAmountPaid] = await Promise.all([
      prisma.invoice.count({ where: { studentId } }),
      prisma.invoice.count({ where: { studentId, status: 'PAID' } }),
      prisma.invoice.count({ 
        where: { 
          studentId, 
          status: { in: ['PENDING', 'PARTIALLY_PAID'] },
          balance: { gt: 0 }
        } 
      }),
      prisma.payment.aggregate({
        where: { studentId, status: 'PAID' },
        _sum: { amount: true },
      }),
    ]);

    const totalOutstanding = await prisma.invoice.aggregate({
      where: { 
        studentId, 
        status: { in: ['PENDING', 'PARTIALLY_PAID'] },
        balance: { gt: 0 }
      },
      _sum: { balance: true },
    });

    res.json({
      success: true,
      data: {
        totalInvoices,
        paidInvoices,
        pendingPayments,
        totalAmountPaid: totalAmountPaid._sum.amount || 0,
        totalOutstanding: totalOutstanding._sum.balance || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching payment stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment statistics',
    });
  }
};