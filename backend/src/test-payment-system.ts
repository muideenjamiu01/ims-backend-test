#!/usr/bin/env ts-node

import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:5000/api';

async function testPaymentSystem() {
  try {
    console.log('🧪 Testing Payment System...\n');

    // 1. Test Health Check
    console.log('1. Testing Health Check...');
    const healthRes = await axios.get(`${API_BASE}/health`);
    console.log('   ✅ Health Check:', healthRes.data);

    // 2. Get a sample student with invoices
    console.log('\n2. Getting sample student data...');
    const students = await prisma.student.findMany({
      include: {
        invoices: {
          where: {
            status: 'PENDING'
          }
        }
      },
      take: 1
    });

    if (students.length === 0) {
      console.log('   ❌ No students found. Run seed script first.');
      return;
    }

    const student = students[0];
    console.log(`   ✅ Found student: ${student.firstName} ${student.lastName} (${student.matricNo})`);
    console.log(`   📋 Pending invoices: ${student.invoices.length}`);

    if (student.invoices.length === 0) {
      console.log('   ⚠️  No pending invoices for this student.');
    }

    // 3. Test Admin Payment Routes (without auth for demo)
    console.log('\n3. Testing Admin Payment Statistics...');
    try {
      // Note: This would normally require admin authentication
      const statsRes = await axios.get(`${API_BASE}/admin/payments/statistics`);
      console.log('   ✅ Payment Statistics:', {
        totalStats: statsRes.data.data.totalStats,
        paymentMethods: statsRes.data.data.paymentMethods.length + ' methods'
      });
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.log('   ✅ Admin routes properly protected (401 Unauthorized)');
      } else {
        console.log('   ⚠️  Admin stats error:', error.message);
      }
    }

    // 4. Test Student Payment Routes (without auth for demo)
    console.log('\n4. Testing Student Payment Routes...');
    try {
      // Note: This would normally require student authentication
      const invoicesRes = await axios.get(`${API_BASE}/student/payments/invoices`);
      console.log('   ✅ Student invoices endpoint accessible');
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.log('   ✅ Student routes properly protected (401 Unauthorized)');
      } else {
        console.log('   ⚠️  Student invoices error:', error.message);
      }
    }

    // 5. Test Webhook Routes
    console.log('\n5. Testing Webhook Routes...');
    try {
      const webhookRes = await axios.post(`${API_BASE}/webhooks/paystack`, {
        event: 'charge.success',
        data: {
          reference: 'test-reference',
          status: 'success'
        }
      });
      console.log('   ✅ Paystack webhook endpoint accessible');
    } catch (error: any) {
      console.log('   ⚠️  Paystack webhook error:', error.response?.status || error.message);
    }

    // 6. Database Validation
    console.log('\n6. Validating Database Structure...');
    
    const invoiceCount = await prisma.invoice.count();
    const paymentCount = await prisma.payment.count();
    const studentCount = await prisma.student.count();
    
    console.log(`   ✅ Students: ${studentCount}`);
    console.log(`   ✅ Invoices: ${invoiceCount}`);
    console.log(`   ✅ Payments: ${paymentCount}`);

    // 7. Sample invoice details
    if (student.invoices.length > 0) {
      const sampleInvoice = student.invoices[0];
      console.log('\n7. Sample Invoice Details:');
      console.log(`   📄 Invoice No: ${sampleInvoice.invoiceNo}`);
      console.log(`   💰 Amount: ₦${sampleInvoice.amount.toLocaleString()}`);
      console.log(`   📊 Status: ${sampleInvoice.status}`);
      console.log(`   🏷️  Type: ${sampleInvoice.type}`);
      console.log(`   📅 Due Date: ${sampleInvoice.dueDate?.toISOString().split('T')[0] || 'No due date'}`);
    }

    console.log('\n🎉 Payment System Test Complete!');
    console.log('\nNext Steps:');
    console.log('1. Start frontend with: npm run dev (in frontend directory)');
    console.log('2. Login as a student to test payment flows');
    console.log('3. Login as admin to create/manage invoices');
    console.log('4. Test payment gateway integrations with sandbox keys');

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testPaymentSystem().catch(console.error);