import { Request, Response } from 'express';
import { PrismaClient, PaymentStatus, PaymentMethod, InvoiceType } from '@prisma/client';
import { StudentAuthRequest } from '../types/express';
import { AuthRequest } from '../middleware/auth';
import axios from 'axios';
import crypto from 'crypto';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import logger from '../config/logger';
import { createCustomInvoice, getFeeStructure, generateAutomaticInvoices } from '../services/studentInvoiceService';

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
  amount: z.number().positive().optional(), // Custom amount for partial payment
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

    const { invoiceId, method, amount: customAmount } = validation.data;
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
      include: {
        payments: {
          where: { status: 'PAID' },
        },
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

    // Determine payment amount
    let amountToPay: number;

    if (customAmount) {
      // Validate partial payment is allowed
      if (!invoice.allowPartialPayment) {
        return res.status(400).json({
          success: false,
          message: 'Partial payments are not allowed for this invoice. Full payment required.',
        });
      }

      // Check minimum payment requirement
      if (invoice.minimumPayment && customAmount < invoice.minimumPayment) {
        return res.status(400).json({
          success: false,
          message: `Minimum payment amount is ₦${invoice.minimumPayment.toLocaleString()}`,
        });
      }

      // Check if custom amount exceeds balance
      if (customAmount > invoice.balance) {
        return res.status(400).json({
          success: false,
          message: 'Payment amount cannot exceed remaining balance',
        });
      }

      // Check maximum installments
      if (invoice.maximumInstallments) {
        const paidInstallments = invoice.payments.length;
        if (paidInstallments >= invoice.maximumInstallments && customAmount < invoice.balance) {
          return res.status(400).json({
            success: false,
            message: `Maximum number of installments (${invoice.maximumInstallments}) reached. Full payment required.`,
          });
        }
      }

      amountToPay = customAmount;
    } else {
      // Full payment
      amountToPay = invoice.balance;
    }

    // Check if deadline is enforced and passed
    if (invoice.enforceDeadline && invoice.dueDate) {
      const now = new Date();
      const dueDate = new Date(invoice.dueDate);
      if (now > dueDate) {
        return res.status(400).json({
          success: false,
          message: 'Payment deadline has passed. Please contact administration.',
        });
      }
    }

    // Calculate late fees if applicable
    let lateFeeApplied = 0;

    if (invoice.dueDate) {
      const now = new Date();
      const dueDate = new Date(invoice.dueDate);
      
      if (now > dueDate) {
        // Apply late fees
        if (invoice.lateFeePercentage) {
          lateFeeApplied = (invoice.amount * invoice.lateFeePercentage) / 100;
        } else if (invoice.lateFeeAmount) {
          lateFeeApplied = invoice.lateFeeAmount;
        }
        
        amountToPay += lateFeeApplied;
      }
    }

    // Generate unique payment reference
    const reference = `pay_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        studentId,
        invoiceId,
        amount: amountToPay,
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
      lateFeeApplied,
    };

    let paymentData;

    if (method === 'PAYSTACK') {
      paymentData = await initializePaystack(
        student.email,
        amountToPay,
        reference,
        metadata
      );
    } else if (method === 'FLUTTERWAVE') {
      paymentData = await initializeFlutterwave(
        student.email,
        amountToPay,
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
        amount: amountToPay,
        lateFee: lateFeeApplied,
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
      // Check if this is an API call
      const isApiCall = req.headers['accept']?.includes('application/json') || req.query.api === 'true';
      
      if (isApiCall) {
        return res.json({
          success: true,
          message: 'Payment already verified',
          data: {
            status: 'PAID',
            reference: paymentReference as string,
            amount: payment.amount,
            invoice: {
              invoiceNo: payment.invoice.invoiceNo,
              type: payment.invoice.type,
            },
          },
        });
      }
      
      // Redirect to success page if already verified
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

    // Check if this is an API call or a redirect from gateway
    const isApiCall = req.headers['accept']?.includes('application/json') || req.query.api === 'true';

    if (isApiCall) {
      // Return JSON response for API calls
      return res.json({
        success: true,
        message: paymentStatus === 'PAID' ? 'Payment verified successfully' : 'Payment verification failed',
        data: {
          status: paymentStatus,
          reference: paymentReference,
          amount: payment.amount,
          invoice: {
            invoiceNo: payment.invoice.invoiceNo,
            type: payment.invoice.type,
          },
        },
      });
    }

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

    console.log('Payment found:', {
      id: payment.id,
      hasInvoice: !!payment.invoice,
      hasStudent: !!payment.student,
      hasSession: !!payment.invoice?.session,
      hasSemester: !!payment.invoice?.semester,
    });

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
    const semester = payment.invoice.semester?.type || 'N/A';

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
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // If headers not sent yet, send JSON error
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to generate receipt',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
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

// Admin functions for payment management

/**
 * Create a custom invoice for a student (admin function)
 */
export const createCustomInvoiceAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const createInvoiceSchema = z.object({
      studentId: z.number().int().positive(),
      sessionId: z.number().int().positive(),
      semesterId: z.number().int().positive().optional(),
      type: z.enum(['SCHOOL_FEE', 'EXAMINATION_FEE', 'TECHNOLOGY_FEE', 'DEVELOPMENT_FEE', 'LIBRARY_FEE', 'LABORATORY_FEE', 'OTHER']),
      description: z.string(),
      amount: z.number().positive(),
      dueDate: z.string().transform((val) => new Date(val)).optional(),
    });

    const data = createInvoiceSchema.parse(req.body);

    const invoice = await createCustomInvoice({
      studentId: data.studentId,
      sessionId: data.sessionId,
      semesterId: data.semesterId,
      type: data.type as InvoiceType,
      description: data.description,
      amount: data.amount,
      dueDate: data.dueDate,
    });

    res.status(201).json(invoice);
  } catch (error) {
    logger.error('Create custom invoice error:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
};

/**
 * Get all invoices (admin view)
 */
export const getAllInvoicesAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const status = req.query.status as string;
    const sessionId = req.query.sessionId as string;
    const departmentId = req.query.departmentId as string;
    const level = req.query.level as string;
    const search = req.query.search as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (sessionId) {
      where.sessionId = parseInt(sessionId);
    }

    if (level) {
      where.level = parseInt(level);
    }

    if (departmentId || search) {
      where.student = {};
      
      if (departmentId) {
        where.student.departmentId = parseInt(departmentId);
      }

      if (search) {
        where.student.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { matricNo: { contains: search, mode: 'insensitive' } },
        ];
      }
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          student: {
            include: {
              department: true,
            },
          },
          session: true,
          semester: true,
          payments: {
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.invoice.count({ where }),
    ]);

    res.json({
      invoices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Get all invoices error:', error);
    res.status(500).json({ error: 'Failed to get invoices' });
  }
};

/**
 * Record a payment for an invoice (admin function)
 */
export const recordPaymentAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const paymentSchema = z.object({
      invoiceId: z.number().int().positive(),
      amount: z.number().positive(),
      paymentMethod: z.enum(['CARD', 'BANK_TRANSFER', 'CASH', 'ONLINE']),
      referenceNo: z.string().optional(),
      paidBy: z.string().optional(),
    });

    const data = paymentSchema.parse(req.body);

    const invoice = await prisma.invoice.findUnique({
      where: { id: data.invoiceId },
      include: { student: true },
    });

    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    if (data.amount > invoice.balance) {
      res.status(400).json({ error: 'Payment amount cannot exceed invoice balance' });
      return;
    }

    // Generate receipt reference using the payment reference field
    const currentYear = new Date().getFullYear();
    const receiptPrefix = `RCP${currentYear}`;
    
    const lastPayment = await prisma.payment.findFirst({
      where: {
        reference: {
          startsWith: receiptPrefix,
        },
      },
      orderBy: {
        reference: 'desc',
      },
    });

    let nextReceiptNumber = 1;
    if (lastPayment) {
      const lastNumber = parseInt(lastPayment.reference.replace(receiptPrefix, ''));
      nextReceiptNumber = lastNumber + 1;
    }

    const receiptNo = `${receiptPrefix}${nextReceiptNumber.toString().padStart(6, '0')}`;

    // Record the payment
    const payment = await prisma.payment.create({
      data: {
        reference: receiptNo,
        invoiceId: data.invoiceId,
        amount: data.amount,
        method: data.paymentMethod as PaymentMethod,
        status: 'PAID',
        paidAt: new Date(),
        studentId: invoice.student.id,
      },
    });

    // Update invoice balance and status
    const newBalance = invoice.balance - data.amount;
    const newStatus = newBalance <= 0 ? 'PAID' : 'PARTIALLY_PAID';

    await prisma.invoice.update({
      where: { id: data.invoiceId },
      data: {
        balance: newBalance,
        status: newStatus,
        amountPaid: invoice.amountPaid + data.amount,
      },
    });

    const updatedPayment = await prisma.payment.findUnique({
      where: { id: payment.id },
      include: {
        invoice: {
          include: {
            student: {
              include: {
                department: true,
              },
            },
            session: true,
            semester: true,
          },
        },
      },
    });

    logger.info(`Payment recorded: ${receiptNo} for invoice ${invoice.invoiceNo}`);
    res.status(201).json(updatedPayment);
  } catch (error) {
    logger.error('Record payment error:', error);
    res.status(500).json({ error: 'Failed to record payment' });
  }
};

/**
 * Get fee structure for a level (admin function)
 */
export const getLevelFeeStructureAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { level } = req.params;
    const feeStructure = getFeeStructure(parseInt(level));
    
    res.json({
      level: parseInt(level),
      fees: feeStructure,
      total: Object.values(feeStructure).reduce((sum, fee) => sum + fee, 0),
    });
  } catch (error) {
    logger.error('Get fee structure error:', error);
    res.status(500).json({ error: 'Failed to get fee structure' });
  }
};

/**
 * Get payment summary for a student (admin function)
 */
export const getStudentPaymentSummaryAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { studentId } = req.params;
    const sessionId = req.query.sessionId as string;

    const where: any = {
      studentId: parseInt(studentId),
    };

    if (sessionId) {
      where.sessionId = parseInt(sessionId);
    }

    const [invoices, payments] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          payments: true,
          session: true,
        },
      }),
      prisma.payment.findMany({
        where: {
          invoice: where,
        },
      }),
    ]);

    const summary = {
      totalInvoiced: invoices.reduce((sum, inv) => sum + inv.amount, 0),
      totalPaid: payments.reduce((sum, pay) => sum + pay.amount, 0),
      totalBalance: invoices.reduce((sum, inv) => sum + inv.balance, 0),
      invoicesByStatus: {
        pending: invoices.filter(inv => inv.status === 'PENDING').length,
        partial: invoices.filter(inv => inv.status === 'PARTIALLY_PAID').length,
        paid: invoices.filter(inv => inv.status === 'PAID').length,
        failed: invoices.filter(inv => inv.status === 'FAILED').length,
      },
      invoicesByType: invoices.reduce((acc, inv) => {
        acc[inv.type] = (acc[inv.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    res.json(summary);
  } catch (error) {
    logger.error('Get payment summary error:', error);
    res.status(500).json({ error: 'Failed to get payment summary' });
  }
};

/**
 * Generate invoices for a student manually (Admin)
 */
export const generateInvoicesForStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { studentId } = req.params;
    const { sessionId, semesterId } = req.body;

    const student = await prisma.student.findUnique({
      where: { id: parseInt(studentId) },
      select: {
        id: true,
        matricNo: true,
        currentLevel: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    // Check if invoices already exist for this session
    const existingInvoices = await prisma.invoice.findMany({
      where: {
        studentId: student.id,
        sessionId: parseInt(sessionId),
      },
    });

    if (existingInvoices.length > 0) {
      res.status(400).json({ 
        error: 'Invoices already exist for this student in this session',
        invoices: existingInvoices,
      });
      return;
    }

    // Generate automatic invoices
    const invoices = await generateAutomaticInvoices({
      studentId: student.id,
      sessionId: parseInt(sessionId),
      semesterId: semesterId ? parseInt(semesterId) : undefined,
      level: student.currentLevel || 100,
      programType: 'UNDERGRADUATE',
    });

    logger.info(`Generated ${invoices.length} invoices for student ${student.matricNo}`);
    res.status(201).json({
      message: `Successfully generated ${invoices.length} invoices`,
      invoices,
    });
  } catch (error) {
    logger.error('Generate invoices error:', error);
    res.status(500).json({ error: 'Failed to generate invoices' });
  }
};

// Get payment statistics (Admin)
export const getPaymentStatistics = async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId, startDate, endDate } = req.query;

    const whereCondition: any = {};

    if (sessionId) {
      whereCondition.sessionId = parseInt(sessionId as string);
    }

    if (startDate && endDate) {
      whereCondition.createdAt = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    // Get invoice statistics
    const [totalInvoices, paidInvoices, pendingInvoices, partiallyPaidInvoices] = await Promise.all([
      prisma.invoice.count({ where: whereCondition }),
      prisma.invoice.count({ where: { ...whereCondition, status: 'PAID' } }),
      prisma.invoice.count({ where: { ...whereCondition, status: 'PENDING' } }),
      prisma.invoice.count({ where: { ...whereCondition, status: 'PARTIALLY_PAID' } }),
    ]);

    // Get financial statistics
    const invoices = await prisma.invoice.findMany({
      where: whereCondition,
      select: {
        amount: true,
        amountPaid: true,
        balance: true,
      },
    });

    const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0);
    const totalPaid = invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
    const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.balance, 0);

    // Get payment breakdown by type
    const paymentsByType = await prisma.invoice.groupBy({
      by: ['type'],
      where: whereCondition,
      _sum: {
        amount: true,
        amountPaid: true,
      },
      _count: true,
    });

    res.json({
      success: true,
      data: {
        totalInvoices,
        paidInvoices,
        pendingInvoices,
        partiallyPaidInvoices,
        totalAmount,
        totalPaid,
        totalOutstanding,
        collectionRate: totalInvoices > 0 ? (paidInvoices / totalInvoices) * 100 : 0,
        paymentsByType: paymentsByType.map(item => ({
          type: item.type,
          count: item._count,
          totalAmount: item._sum.amount || 0,
          totalPaid: item._sum.amountPaid || 0,
        })),
      },
    });
  } catch (error) {
    logger.error('Get payment statistics error:', error);
    res.status(500).json({ success: false, message: 'Failed to get payment statistics' });
  }
};

// Export payments to CSV (Admin)
export const exportPaymentsCSV = async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId, status, startDate, endDate } = req.query;

    const whereCondition: any = {};

    if (sessionId) {
      whereCondition.sessionId = parseInt(sessionId as string);
    }

    if (status) {
      whereCondition.status = status;
    }

    if (startDate && endDate) {
      whereCondition.createdAt = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    const invoices = await prisma.invoice.findMany({
      where: whereCondition,
      include: {
        student: {
          include: {
            department: true,
          },
        },
        session: true,
        payments: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Generate CSV
    const csvHeader = 'Invoice No,Student Name,Matric No,Department,Level,Type,Amount,Amount Paid,Balance,Status,Session,Due Date,Created Date\n';
    
    const csvRows = invoices.map(invoice => {
      const studentName = `${invoice.student.firstName} ${invoice.student.lastName}`;
      const department = invoice.student.department?.name || 'N/A';
      const level = invoice.student.currentLevel || 'N/A';
      const dueDate = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'N/A';
      const createdDate = new Date(invoice.createdAt).toLocaleDateString();

      return `${invoice.invoiceNo},"${studentName}",${invoice.student.matricNo},"${department}",${level},${invoice.type},${invoice.amount},${invoice.amountPaid},${invoice.balance},${invoice.status},${invoice.session.name},"${dueDate}","${createdDate}"`;
    }).join('\n');

    const csv = csvHeader + csvRows;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=payments_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    logger.error('Export payments CSV error:', error);
    res.status(500).json({ success: false, message: 'Failed to export payments' });
  }
};