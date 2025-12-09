import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import prisma from '../config/database';
import logger from '../config/logger';
import { generatePaymentReceipt } from '../utils/pdfGenerator';
import { sendPaymentReceiptEmail } from '../utils/email';
import { verifyPayment as verifyPaystackPayment } from '../utils/paystack';
import { verifyPayment as verifyFlutterwavePayment } from '../utils/flutterwave';
import { 
  handlePaystackWebhook, 
  handleFlutterwaveWebhook, 
  verifyPaymentManually 
} from '../controllers/paymentWebhookController';

const router = Router();

/**
 * Paystack Webhook
 * Handles payment notifications from Paystack
 */
router.post('/paystack', async (req: Request, res: Response) => {
  try {
    // Verify Paystack signature
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      logger.warn('Invalid Paystack webhook signature');
      return res.status(400).json({
        success: false,
        message: 'Invalid signature',
      });
    }

    const { event, data } = req.body;

    logger.info(`Paystack webhook received: ${event}`);

    // Handle charge.success event
    if (event === 'charge.success') {
      const reference = data.reference;

      // Find payment record
      const payment = await prisma.payment.findUnique({
        where: { reference },
        include: {
          student: {
            select: {
              matricNo: true,
              firstName: true,
              lastName: true,
              email: true,
              department: {
                select: { name: true },
              },
            },
          },
          invoice: {
            select: {
              id: true,
              invoiceNo: true,
              type: true,
              description: true,
              amount: true,
              balance: true,
            },
          },
        },
      });

      if (!payment) {
        logger.warn(`Payment not found for reference: ${reference}`);
        return res.status(404).json({
          success: false,
          message: 'Payment not found',
        });
      }

      // Check if already processed
      if (payment.status === 'PAID') {
        logger.info(`Payment ${reference} already processed`);
        return res.status(200).json({
          success: true,
          message: 'Payment already processed',
        });
      }

      // Verify payment with Paystack API
      const verification = await verifyPaystackPayment(reference);

      if (verification && verification.status && verification.data.status === 'success') {
        // Update payment and invoice in transaction
        await prisma.$transaction(async (tx) => {
          // Update payment
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: 'PAID',
              paidAt: new Date(),
              gatewayResponse: JSON.stringify(data),
            },
          });

          // Update invoice
          const newAmountPaid = payment.invoice.amount;
          const newBalance = 0;

          await tx.invoice.update({
            where: { id: payment.invoice.id },
            data: {
              amountPaid: { increment: payment.amount },
              balance: { decrement: payment.amount },
              status: newBalance === 0 ? 'PAID' : 'PARTIALLY_PAID',
            },
          });
        });

        // Generate receipt PDF
        try {
          const receiptPath = path.join(
            process.env.UPLOAD_DIR || 'uploads',
            'receipts',
            `receipt_${payment.reference}.pdf`
          );

          // Ensure directory exists
          const dir = path.dirname(receiptPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          await generatePaymentReceipt(
            {
              reference: payment.reference,
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

          // Send email (Paystack)
          await sendPaymentReceiptEmail(
            payment.student.email,
            `${payment.student.firstName} ${payment.student.lastName}`,
            payment.invoice.invoiceNo,
            payment.amount,
            receiptPath
          );
        } catch (error) {
          logger.error('Error generating receipt/sending email:', error);
          // Continue even if receipt generation fails
        }

        logger.info(`Payment ${reference} processed successfully via webhook`);

        return res.status(200).json({
          success: true,
          message: 'Webhook processed successfully',
        });
      }
    }

    // Return success for other events
    return res.status(200).json({
      success: true,
      message: 'Webhook received',
    });
  } catch (error: any) {
    logger.error('Error processing Paystack webhook:', error);
    return res.status(500).json({
      success: false,
      message: 'Webhook processing failed',
      error: error.message,
    });
  }
});

/**
 * Flutterwave Webhook
 * Handles payment notifications from Flutterwave
 */
router.post('/flutterwave', async (req: Request, res: Response) => {
  try {
    // Verify Flutterwave signature
    const signature = req.headers['verif-hash'];

    if (!signature || signature !== process.env.FLUTTERWAVE_SECRET_HASH) {
      logger.warn('Invalid Flutterwave webhook signature');
      return res.status(400).json({
        success: false,
        message: 'Invalid signature',
      });
    }

    const { event, data } = req.body;

    logger.info(`Flutterwave webhook received: ${event}`);

    // Handle charge.completed event
    if (event === 'charge.completed' && data.status === 'successful') {
      const reference = data.tx_ref;

      // Find payment record
      const payment = await prisma.payment.findUnique({
        where: { reference },
        include: {
          student: {
            select: {
              matricNo: true,
              firstName: true,
              lastName: true,
              email: true,
              department: {
                select: { name: true },
              },
            },
          },
          invoice: {
            select: {
              id: true,
              invoiceNo: true,
              type: true,
              description: true,
              amount: true,
              balance: true,
            },
          },
        },
      });

      if (!payment) {
        logger.warn(`Payment not found for reference: ${reference}`);
        return res.status(404).json({
          success: false,
          message: 'Payment not found',
        });
      }

      // Check if already processed
      if (payment.status === 'PAID') {
        logger.info(`Payment ${reference} already processed`);
        return res.status(200).json({
          success: true,
          message: 'Payment already processed',
        });
      }

      // Verify payment with Flutterwave API
      const verification = await verifyFlutterwavePayment(data.id.toString());

      if (verification.success && verification.data?.status === 'successful') {
        // Update payment and invoice in transaction
        await prisma.$transaction(async (tx) => {
          // Update payment
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: 'PAID',
              paidAt: new Date(),
              gatewayResponse: JSON.stringify(data),
            },
          });

          // Update invoice
          const newAmountPaid = payment.invoice.amount;
          const newBalance = 0;

          await tx.invoice.update({
            where: { id: payment.invoice.id },
            data: {
              amountPaid: { increment: payment.amount },
              balance: { decrement: payment.amount },
              status: newBalance === 0 ? 'PAID' : 'PARTIALLY_PAID',
            },
          });
        });

        // Generate receipt PDF
        try {
          const receiptPath = path.join(
            process.env.UPLOAD_DIR || 'uploads',
            'receipts',
            `receipt_${payment.reference}.pdf`
          );

          // Ensure directory exists
          const dir = path.dirname(receiptPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          await generatePaymentReceipt(
            {
              reference: payment.reference,
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

          // Send email (Flutterwave)
          await sendPaymentReceiptEmail(
            payment.student.email,
            `${payment.student.firstName} ${payment.student.lastName}`,
            payment.invoice.invoiceNo,
            payment.amount,
            receiptPath
          );
        } catch (error) {
          logger.error('Error generating receipt/sending email:', error);
          // Continue even if receipt generation fails
        }

        logger.info(`Payment ${reference} processed successfully via webhook`);

        return res.status(200).json({
          success: true,
          message: 'Webhook processed successfully',
        });
      }
    }

    // Return success for other events
    return res.status(200).json({
      success: true,
      message: 'Webhook received',
    });
  } catch (error: any) {
    logger.error('Error processing Flutterwave webhook:', error);
    return res.status(500).json({
      success: false,
      message: 'Webhook processing failed',
      error: error.message,
    });
  }
});

/**
 * Student Payment Webhooks
 */

// Paystack webhook for student payments
router.post('/student/paystack', handlePaystackWebhook);

// Flutterwave webhook for student payments
router.post('/student/flutterwave', handleFlutterwaveWebhook);

// Manual payment verification
router.get('/verify/:gateway/:reference', verifyPaymentManually);

export default router;
