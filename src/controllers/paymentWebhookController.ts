import { Request, Response } from 'express';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const FLUTTERWAVE_SECRET_HASH = process.env.FLUTTERWAVE_SECRET_HASH || '';

// Paystack webhook handler
export const handlePaystackWebhook = async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-paystack-signature'] as string;
    
    if (!signature) {
      return res.status(400).json({ error: 'No signature found' });
    }

    // Verify signature
    const hash = crypto
      .createHmac('sha512', PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== signature) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = req.body;
    console.log('Paystack webhook event:', event.event);

    // Handle charge success
    if (event.event === 'charge.success') {
      const { reference, status, amount, customer, metadata } = event.data;

      // Find payment record
      const payment = await prisma.payment.findUnique({
        where: { reference },
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
        console.error(`Payment not found for reference: ${reference}`);
        return res.status(404).json({ error: 'Payment not found' });
      }

      if (payment.status === 'PAID') {
        console.log(`Payment already processed: ${reference}`);
        return res.json({ message: 'Payment already processed' });
      }

      // Verify amount (convert from kobo to naira)
      const expectedAmount = payment.amount * 100;
      if (amount !== expectedAmount) {
        console.error(`Amount mismatch. Expected: ${expectedAmount}, Received: ${amount}`);
        return res.status(400).json({ error: 'Amount mismatch' });
      }

      // Update payment and invoice in transaction
      await prisma.$transaction(async (tx) => {
        // Update payment
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'PAID',
            paidAt: new Date(),
            gatewayResponse: JSON.stringify(event.data),
          },
        });

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
        } else if (updatedInvoice.amountPaid > 0) {
          await tx.invoice.update({
            where: { id: payment.invoiceId },
            data: { status: 'PARTIALLY_PAID' },
          });
        }

        // Create notification
        await tx.notification.create({
          data: {
            studentId: payment.studentId,
            title: 'Payment Successful',
            message: `Payment of ₦${payment.amount.toLocaleString()} for ${payment.invoice.type.replace(/_/g, ' ')} has been processed successfully via Paystack.`,
            type: 'SUCCESS',
          },
        });
      });

      console.log(`Payment processed successfully: ${reference}`);
    }

    res.json({ message: 'Webhook processed' });
  } catch (error) {
    console.error('Paystack webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

// Flutterwave webhook handler
export const handleFlutterwaveWebhook = async (req: Request, res: Response) => {
  try {
    const signature = req.headers['verif-hash'] as string;
    
    if (!signature || signature !== FLUTTERWAVE_SECRET_HASH) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = req.body;
    console.log('Flutterwave webhook event:', event.event);

    // Handle successful payment
    if (event.event === 'charge.completed') {
      const { tx_ref, status, amount, customer, meta } = event.data;

      // Find payment record
      const payment = await prisma.payment.findUnique({
        where: { reference: tx_ref },
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
        console.error(`Payment not found for reference: ${tx_ref}`);
        return res.status(404).json({ error: 'Payment not found' });
      }

      if (payment.status === 'PAID') {
        console.log(`Payment already processed: ${tx_ref}`);
        return res.json({ message: 'Payment already processed' });
      }

      // Verify amount
      if (amount !== payment.amount) {
        console.error(`Amount mismatch. Expected: ${payment.amount}, Received: ${amount}`);
        return res.status(400).json({ error: 'Amount mismatch' });
      }

      // Only process successful payments
      if (status === 'successful') {
        await prisma.$transaction(async (tx) => {
          // Update payment
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: 'PAID',
              paidAt: new Date(),
              gatewayResponse: JSON.stringify(event.data),
            },
          });

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
          } else if (updatedInvoice.amountPaid > 0) {
            await tx.invoice.update({
              where: { id: payment.invoiceId },
              data: { status: 'PARTIALLY_PAID' },
            });
          }

          // Create notification
          await tx.notification.create({
            data: {
              studentId: payment.studentId,
              title: 'Payment Successful',
              message: `Payment of ₦${payment.amount.toLocaleString()} for ${payment.invoice.type.replace(/_/g, ' ')} has been processed successfully via Flutterwave.`,
              type: 'SUCCESS',
            },
          });
        });

        console.log(`Payment processed successfully: ${tx_ref}`);
      } else {
        // Handle failed payment
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'FAILED',
            gatewayResponse: JSON.stringify(event.data),
          },
        });

        console.log(`Payment failed: ${tx_ref}`);
      }
    }

    res.json({ message: 'Webhook processed' });
  } catch (error) {
    console.error('Flutterwave webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

// Manual payment verification (for backup)
export const verifyPaymentManually = async (req: Request, res: Response) => {
  try {
    const { reference, gateway } = req.params;

    let verificationResponse;

    if (gateway === 'paystack') {
      verificationResponse = await fetch(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          },
        }
      );
    } else if (gateway === 'flutterwave') {
      // Flutterwave verification endpoint
      verificationResponse = await fetch(
        `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${reference}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
          },
        }
      );
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment gateway',
      });
    }

    const verificationData = await verificationResponse.json();

    if (!verificationResponse.ok) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed',
        data: verificationData,
      });
    }

    // Process the verification data similar to webhook
    const isSuccessful = gateway === 'paystack' 
      ? (verificationData as any)?.data?.status === 'success'
      : (verificationData as any)?.data?.status === 'successful';

    if (isSuccessful) {
      // Update payment record
      const payment = await prisma.payment.findUnique({
        where: { reference },
        include: { invoice: true },
      });

      if (payment && payment.status !== 'PAID') {
        await prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: 'PAID',
              paidAt: new Date(),
              gatewayResponse: JSON.stringify(verificationData),
            },
          });

          const updatedInvoice = await tx.invoice.update({
            where: { id: payment.invoiceId },
            data: {
              amountPaid: { increment: payment.amount },
              balance: { decrement: payment.amount },
            },
          });

          if (updatedInvoice.balance <= 0) {
            await tx.invoice.update({
              where: { id: payment.invoiceId },
              data: { status: 'PAID' },
            });
          }
        });
      }
    }

    res.json({
      success: true,
      data: verificationData,
    });
  } catch (error) {
    console.error('Manual verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Verification failed',
    });
  }
};