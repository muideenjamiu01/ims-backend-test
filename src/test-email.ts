import { sendAdmissionApprovalEmail, sendPasswordResetEmail, sendPaymentReceiptEmail } from './utils/email';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testEmails() {
  console.log('🧪 Testing Email Configuration\n');
  console.log('SMTP Configuration:');
  console.log('- Host:', process.env.SMTP_HOST);
  console.log('- Port:', process.env.SMTP_PORT);
  console.log('- User:', process.env.SMTP_USER);
  console.log('- From:', process.env.EMAIL_FROM);
  console.log('- Password:', process.env.SMTP_PASSWORD ? '✓ Set' : '✗ Not set');
  console.log('\n---\n');

  const testEmail = process.env.SMTP_USER || 'test@example.com';

  // Test 1: Admission Approval Email
  console.log('1️⃣ Testing Admission Approval Email...');
  try {
    const result1 = await sendAdmissionApprovalEmail(
      testEmail,
      'John Doe'
    );
    
    if (result1.success) {
      console.log('   ✅ Success! Message ID:', result1.messageId);
    } else {
      console.log('   ❌ Failed:', result1.error);
    }
  } catch (error: any) {
    console.log('   ❌ Error:', error.message);
  }
  
  console.log('\n---\n');

  // Test 2: Password Reset Email
  console.log('2️⃣ Testing Password Reset Email...');
  try {
    const result2 = await sendPasswordResetEmail(
      testEmail,
      'test-reset-token-123'
    );
    
    if (result2.success) {
      console.log('   ✅ Success! Message ID:', result2.messageId);
    } else {
      console.log('   ❌ Failed:', result2.error);
    }
  } catch (error: any) {
    console.log('   ❌ Error:', error.message);
  }

  console.log('\n---\n');

  // Test 3: Payment Receipt Email
  console.log('3️⃣ Testing Payment Receipt Email...');
  try {
    const result3 = await sendPaymentReceiptEmail(
      testEmail,
      'Jane Smith',
      'INV-2025-001',
      50000,
      'http://localhost:5000/receipts/test.pdf'
    );
    
    if (result3.success) {
      console.log('   ✅ Success! Message ID:', result3.messageId);
    } else {
      console.log('   ❌ Failed:', result3.error);
    }
  } catch (error: any) {
    console.log('   ❌ Error:', error.message);
  }

  console.log('\n---\n');
  console.log('✅ Email tests completed!');
  console.log(`📧 Check inbox: ${testEmail}`);
  process.exit(0);
}

// Run tests
testEmails().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
