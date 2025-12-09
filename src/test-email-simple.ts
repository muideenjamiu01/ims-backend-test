import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

async function testSimple() {
  console.log('Testing with direct configuration...\n');
  
  const transporter = nodemailer.createTransport({
    service: 'gmail', // Use service name instead of host
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  try {
    console.log('Verifying connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified!\n');

    console.log('Sending test email...');
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: process.env.SMTP_USER,
      subject: 'Test Email from IMS',
      html: '<h1>Test Successful!</h1><p>Email configuration is working.</p>',
    });

    console.log('✅ Email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('\n📧 Check your inbox:', process.env.SMTP_USER);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  }
  
  process.exit(0);
}

testSimple();
