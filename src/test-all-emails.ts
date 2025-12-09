import {
  sendWelcomeEmail,
  sendApplicationReceivedEmail,
  sendPasswordResetEmail,
  sendAdmissionApprovalEmail,
  sendPaymentReceiptEmail
} from './utils/email';
import dotenv from 'dotenv';

dotenv.config();

async function testAllEmails() {
  console.log('🧪 Testing All Email Templates\n');
  console.log('=' .repeat(60));
  
  const testEmail = process.env.SMTP_USER || 'test@example.com';
  const results: any[] = [];

  // Test 1: Welcome Email (Registration)
  console.log('\n1️⃣  Testing WELCOME EMAIL (Registration)');
  console.log('-'.repeat(60));
  try {
    const result = await sendWelcomeEmail(
      testEmail,
      'John',
      'johndoe123',
      'TempPass2024'
    );
    
    if (result.success) {
      console.log('✅ SUCCESS - Welcome email sent');
      console.log(`   Message ID: ${result.messageId}`);
      results.push({ name: 'Welcome Email', status: 'SUCCESS' });
    } else {
      console.log('❌ FAILED:', result.error);
      results.push({ name: 'Welcome Email', status: 'FAILED', error: result.error });
    }
  } catch (error: any) {
    console.log('❌ ERROR:', error.message);
    results.push({ name: 'Welcome Email', status: 'ERROR', error: error.message });
  }

  // Test 2: Application Received Email
  console.log('\n2️⃣  Testing APPLICATION RECEIVED EMAIL');
  console.log('-'.repeat(60));
  try {
    const result = await sendApplicationReceivedEmail(
      testEmail,
      'John',
      'Doe'
    );
    
    if (result.success) {
      console.log('✅ SUCCESS - Application received email sent');
      console.log(`   Message ID: ${result.messageId}`);
      results.push({ name: 'Application Received', status: 'SUCCESS' });
    } else {
      console.log('❌ FAILED:', result.error);
      results.push({ name: 'Application Received', status: 'FAILED', error: result.error });
    }
  } catch (error: any) {
    console.log('❌ ERROR:', error.message);
    results.push({ name: 'Application Received', status: 'ERROR', error: error.message });
  }

  // Test 3: Password Reset Email
  console.log('\n3️⃣  Testing PASSWORD RESET EMAIL');
  console.log('-'.repeat(60));
  try {
    const result = await sendPasswordResetEmail(
      testEmail,
      'test-reset-token-abc123xyz'
    );
    
    if (result.success) {
      console.log('✅ SUCCESS - Password reset email sent');
      console.log(`   Message ID: ${result.messageId}`);
      results.push({ name: 'Password Reset', status: 'SUCCESS' });
    } else {
      console.log('❌ FAILED:', result.error);
      results.push({ name: 'Password Reset', status: 'FAILED', error: result.error });
    }
  } catch (error: any) {
    console.log('❌ ERROR:', error.message);
    results.push({ name: 'Password Reset', status: 'ERROR', error: error.message });
  }

  // Test 4: Admission Approval Email
  console.log('\n4️⃣  Testing ADMISSION APPROVAL EMAIL');
  console.log('-'.repeat(60));
  try {
    const result = await sendAdmissionApprovalEmail(
      testEmail,
      'John Doe'
    );
    
    if (result.success) {
      console.log('✅ SUCCESS - Admission approval email sent');
      console.log(`   Message ID: ${result.messageId}`);
      results.push({ name: 'Admission Approval', status: 'SUCCESS' });
    } else {
      console.log('❌ FAILED:', result.error);
      results.push({ name: 'Admission Approval', status: 'FAILED', error: result.error });
    }
  } catch (error: any) {
    console.log('❌ ERROR:', error.message);
    results.push({ name: 'Admission Approval', status: 'ERROR', error: error.message });
  }

  // Test 5: Application Fee Payment Receipt
  console.log('\n5️⃣  Testing APPLICATION FEE PAYMENT RECEIPT');
  console.log('-'.repeat(60));
  try {
    const result = await sendPaymentReceiptEmail(
      testEmail,
      'John Doe',
      'INV-APP-2025-001',
      20000,
      'http://localhost:5000/receipts/app-fee-001.pdf'
    );
    
    if (result.success) {
      console.log('✅ SUCCESS - Application fee receipt sent');
      console.log(`   Message ID: ${result.messageId}`);
      results.push({ name: 'Application Fee Receipt', status: 'SUCCESS' });
    } else {
      console.log('❌ FAILED:', result.error);
      results.push({ name: 'Application Fee Receipt', status: 'FAILED', error: result.error });
    }
  } catch (error: any) {
    console.log('❌ ERROR:', error.message);
    results.push({ name: 'Application Fee Receipt', status: 'ERROR', error: error.message });
  }

  // Test 6: Acceptance Fee Payment Receipt
  console.log('\n6️⃣  Testing ACCEPTANCE FEE PAYMENT RECEIPT');
  console.log('-'.repeat(60));
  try {
    const result = await sendPaymentReceiptEmail(
      testEmail,
      'John Doe',
      'INV-ACC-2025-002',
      50000,
      'http://localhost:5000/receipts/acc-fee-002.pdf'
    );
    
    if (result.success) {
      console.log('✅ SUCCESS - Acceptance fee receipt sent');
      console.log(`   Message ID: ${result.messageId}`);
      results.push({ name: 'Acceptance Fee Receipt', status: 'SUCCESS' });
    } else {
      console.log('❌ FAILED:', result.error);
      results.push({ name: 'Acceptance Fee Receipt', status: 'FAILED', error: result.error });
    }
  } catch (error: any) {
    console.log('❌ ERROR:', error.message);
    results.push({ name: 'Acceptance Fee Receipt', status: 'ERROR', error: error.message });
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.status === 'SUCCESS').length;
  const failed = results.filter(r => r.status !== 'SUCCESS').length;
  
  results.forEach((result, index) => {
    const icon = result.status === 'SUCCESS' ? '✅' : '❌';
    console.log(`${icon} ${index + 1}. ${result.name}: ${result.status}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  console.log('\n' + '='.repeat(60));
  console.log(`Total: ${results.length} | Success: ${successful} | Failed: ${failed}`);
  console.log('='.repeat(60));
  console.log(`\n📧 Check your inbox: ${testEmail}\n`);
  
  process.exit(failed > 0 ? 1 : 0);
}

testAllEmails().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
