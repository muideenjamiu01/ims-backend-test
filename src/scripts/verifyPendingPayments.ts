import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import logger from '../config/logger';

const prisma = new PrismaClient();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY || '';

async function verifyPendingPayments() {
  try {
    console.log('🔍 Fetching pending payments...\n');

    // Get all pending payments
    const pendingPayments = await prisma.payment.findMany({
      where: {
        status: 'PENDING',
      },
      include: {
        invoice: true,
        student: {
          select: {
            firstName: true,
            lastName: true,
            matricNo: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (pendingPayments.length === 0) {
      console.log('✅ No pending payments found.');
      return;
    }

    console.log(`📋 Found ${pendingPayments.length} pending payment(s)\n`);

    let successCount = 0;
    let failedCount = 0;
    let alreadyFailedCount = 0;

    for (const payment of pendingPayments) {
      console.log(`\n💳 Processing payment:`);
      console.log(`   Reference: ${payment.reference}`);
      console.log(`   Student: ${payment.student.firstName} ${payment.student.lastName} (${payment.student.matricNo})`);
      console.log(`   Amount: ₦${payment.amount.toLocaleString()}`);
      console.log(`   Method: ${payment.method}`);
      console.log(`   Created: ${payment.createdAt.toLocaleString()}`);

      try {
        let verificationSuccess = false;
        let gatewayResponse: any = {};

        if (payment.method === 'PAYSTACK') {
          console.log('   🔄 Verifying with Paystack...');
          
          const response = await axios.get(
            `https://api.paystack.co/transaction/verify/${payment.reference}`,
            {
              headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
              },
            }
          );

          gatewayResponse = response.data;
          
          if (response.data.status && response.data.data.status === 'success') {
            verificationSuccess = true;
            console.log('   ✅ Payment verified successfully!');
          } else {
            console.log(`   ❌ Payment not successful. Status: ${response.data.data.status}`);
          }
        } else if (payment.method === 'FLUTTERWAVE') {
          console.log('   🔄 Verifying with Flutterwave...');
          
          const response = await axios.get(
            `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${payment.reference}`,
            {
              headers: {
                Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
              },
            }
          );

          gatewayResponse = response.data;
          
          if (response.data.status === 'success' && response.data.data.status === 'successful') {
            verificationSuccess = true;
            console.log('   ✅ Payment verified successfully!');
          } else {
            console.log(`   ❌ Payment not successful. Status: ${response.data.data.status}`);
          }
        }

        if (verificationSuccess) {
          // Update payment and invoice
          await prisma.$transaction(async (tx) => {
            await tx.payment.update({
              where: { id: payment.id },
              data: {
                status: 'PAID',
                paidAt: new Date(),
                gatewayResponse: JSON.stringify(gatewayResponse),
              },
            });

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
                title: 'Payment Verified',
                message: `Your payment of ₦${payment.amount.toLocaleString()} has been verified and processed successfully.`,
                type: 'SUCCESS',
              },
            });
          });

          successCount++;
          console.log('   💾 Database updated successfully');
        } else {
          // Mark as failed if gateway says it failed
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: 'FAILED',
              gatewayResponse: JSON.stringify(gatewayResponse),
            },
          });
          failedCount++;
        }
      } catch (error: any) {
        if (error.response?.status === 404) {
          console.log('   ⚠️  Transaction not found at gateway');
          alreadyFailedCount++;
        } else {
          console.error('   ❌ Error:', error.response?.data?.message || error.message);
          failedCount++;
        }
      }
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log('📊 Summary:');
    console.log(`   ✅ Successfully verified: ${successCount}`);
    console.log(`   ❌ Failed/Not found: ${failedCount + alreadyFailedCount}`);
    console.log(`   📋 Total processed: ${pendingPayments.length}`);
    console.log(`${'='.repeat(50)}\n`);

  } catch (error) {
    console.error('❌ Error running verification script:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
verifyPendingPayments()
  .then(() => {
    console.log('✅ Verification script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
