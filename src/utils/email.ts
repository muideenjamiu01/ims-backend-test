import nodemailer from 'nodemailer';
import logger from '../config/logger';
import dotenv from 'dotenv';

dotenv.config();
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export const sendEmail = async (options: SendEmailOptions) => {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'IMS <noreply@ims.edu>',
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    logger.info(`Email sent: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    logger.error('Email sending error:', error);
    return { success: false, error: error.message };
  }
};

export const sendPasswordResetEmail = async (email: string, resetToken: string) => {
  const resetUrl = `${process.env.STUDENT_PORTAL_URL}/applicant/reset-password?token=${resetToken}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9fafb; }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background-color: #4F46E5; 
            color: white; 
            text-decoration: none; 
            border-radius: 6px;
            margin: 20px 0;
          }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hi there,</p>
            <p>You requested to reset your password for your IMS Student Portal account.</p>
            <p>Click the button below to reset your password:</p>
            <center>
              <a href="${resetUrl}" class="button">Reset Password</a>
            </center>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all;">${resetUrl}</p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Institutional Management System. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: 'Password Reset Request - IMS Student Portal',
    html,
    text: `Reset your password: ${resetUrl}`,
  });
};

export const sendWelcomeEmail = async (
  email: string,
  firstName: string,
  username: string,
  temporaryPassword: string
) => {
  const loginUrl = `${process.env.APPLICANT_PORTAL_URL}/applicant/login`;
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #10B981; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9fafb; }
          .credentials-box {
            background-color: #FEF3C7;
            border: 2px solid #F59E0B;
            padding: 15px;
            margin: 20px 0;
            border-radius: 8px;
          }
          .credential-item {
            margin: 10px 0;
            font-size: 16px;
          }
          .credential-label {
            font-weight: bold;
            color: #92400E;
          }
          .credential-value {
            font-family: monospace;
            font-size: 18px;
            color: #1E40AF;
            background: white;
            padding: 5px 10px;
            border-radius: 4px;
            display: inline-block;
          }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background-color: #10B981; 
            color: white; 
            text-decoration: none; 
            border-radius: 6px;
            margin: 20px 0;
          }
          .warning {
            background-color: #FEE2E2;
            border-left: 4px solid #DC2626;
            padding: 10px;
            margin: 15px 0;
          }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to IMS!</h1>
          </div>
          <div class="content">
            <p>Dear ${firstName},</p>
            <p>Thank you for registering with the Institutional Management System. Your account has been created successfully!</p>
            
            <div class="credentials-box">
              <h3 style="margin-top: 0; color: #92400E;">📋 Your Login Credentials</h3>
              <div class="credential-item">
                <span class="credential-label">Username:</span><br/>
                <span class="credential-value">${username}</span>
              </div>
              <div class="credential-item">
                <span class="credential-label">Temporary Password:</span><br/>
                <span class="credential-value">${temporaryPassword}</span>
              </div>
            </div>

            <div class="warning">
              <strong>⚠️ Important:</strong> Please save these credentials securely. You can change your password after your first login.
            </div>

            <p><strong>Next Steps:</strong></p>
            <ol>
              <li>Log in using your credentials</li>
              <li>Complete your application form</li>
              <li>Pay the application fee (₦20,000)</li>
              <li>Wait for admission decision</li>
            </ol>

            <center>
              <a href="${loginUrl}" class="button">Log In Now</a>
            </center>

            <p>If you have any questions, please contact our admissions office.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Institutional Management System. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: 'Welcome to IMS - Your Account Credentials',
    html,
    text: `Welcome to IMS! Your username is: ${username} and your temporary password is: ${temporaryPassword}. Login at: ${loginUrl}`,
  });
};

export const sendAdmissionApprovalEmail = async (
  email: string,
  name: string
) => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #10B981; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9fafb; }
          .highlight-box {
            background-color: #FEF3C7;
            border: 2px solid #F59E0B;
            padding: 15px;
            margin: 20px 0;
            text-align: center;
            border-radius: 8px;
          }
          .amount {
            font-size: 28px;
            font-weight: bold;
            color: #92400E;
          }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background-color: #10B981; 
            color: white; 
            text-decoration: none; 
            border-radius: 6px;
            margin: 20px 0;
          }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Congratulations!</h1>
          </div>
          <div class="content">
            <p>Dear ${name},</p>
            <p>We are pleased to inform you that your admission application has been <strong>APPROVED</strong>!</p>
            
            <div class="highlight-box">
              <p style="margin: 0; font-size: 16px; color: #92400E;">🎓 Next Step: Complete Your Admission</p>
              <p class="amount">Pay Acceptance Fee: ₦50,000</p>
            </div>

            <p><strong>Important:</strong> To claim your admission and receive your matriculation number, you must pay the acceptance fee.</p>

            <p><strong>Next Steps:</strong></p>
            <ol>
              <li>Log in to your applicant portal</li>
              <li>Pay your acceptance fee (₦50,000)</li>
              <li>Receive your matriculation number</li>
              <li>Complete your student registration</li>
            </ol>

            <center>
              <a href="${process.env.APPLICANT_PORTAL_URL}/applicant/login" class="button">Pay Acceptance Fee</a>
            </center>

            <p>Welcome to our institution! We look forward to your academic journey with us.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Institutional Management System. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: 'Admission Approved - Pay Acceptance Fee',
    html,
    text: `Congratulations! Your admission has been approved. Please pay the acceptance fee of ₦50,000 to claim your admission and receive your matriculation number.`,
  });
};

export const sendPaymentReceiptEmail = async (
  email: string,
  name: string,
  invoiceNo: string,
  amount: number,
  receiptUrl: string,
  matricNo?: string
) => {
  const isAcceptanceFee = amount === 50000 && matricNo;
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9fafb; }
          .amount { 
            font-size: 32px; 
            font-weight: bold; 
            color: #10B981; 
            text-align: center;
            margin: 20px 0;
          }
          .matric-box {
            background-color: #DBEAFE;
            border: 2px solid #3B82F6;
            padding: 15px;
            margin: 20px 0;
            text-align: center;
            border-radius: 8px;
          }
          .matric-number {
            font-size: 24px;
            font-weight: bold;
            color: #1E40AF;
            font-family: monospace;
          }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background-color: #4F46E5; 
            color: white; 
            text-decoration: none; 
            border-radius: 6px;
            margin: 20px 0;
          }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Payment Successful</h1>
          </div>
          <div class="content">
            <p>Dear ${name},</p>
            <p>Your payment has been successfully processed.</p>
            
            <div class="amount">₦${amount.toLocaleString()}</div>

            <p><strong>Payment Details:</strong></p>
            <ul>
              <li>Invoice Number: ${invoiceNo}</li>
              <li>Amount Paid: ₦${amount.toLocaleString()}</li>
              <li>Date: ${new Date().toLocaleDateString()}</li>
            </ul>

            ${isAcceptanceFee ? `
            <div class="matric-box">
              <p style="margin: 0; font-size: 14px; color: #1E40AF; margin-bottom: 10px;">🎓 Your Matriculation Number</p>
              <p class="matric-number">${matricNo}</p>
            </div>
            
            <p style="background-color: #D1FAE5; padding: 15px; border-radius: 8px; border-left: 4px solid #10B981;">
              <strong>🎉 Congratulations!</strong><br/>
              Your admission is now confirmed. Please save your matriculation number as you will need it for all future transactions.
            </p>
            
            <p><strong>Next Steps:</strong></p>
            <ol>
              <li>Access the Student Portal with your credentials</li>
              <li>Complete your student profile</li>
              <li>Register for courses</li>
              <li>Begin your academic journey!</li>
            </ol>
            ` : ''}

            <center>
              <a href="${receiptUrl}" class="button">Download Receipt</a>
            </center>

            <p>Thank you for your payment!</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Institutional Management System. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: isAcceptanceFee ? `Payment Receipt - Admission Confirmed (${matricNo})` : `Payment Receipt - ${invoiceNo}`,
    html,
    text: isAcceptanceFee 
      ? `Payment successful: ₦${amount.toLocaleString()} for invoice ${invoiceNo}. Your matriculation number is: ${matricNo}` 
      : `Payment successful: ₦${amount.toLocaleString()} for invoice ${invoiceNo}`,
  });
};



export const sendApplicationReceivedEmail = async (
  email: string,
  firstName: string,
  lastName: string
) => {
  const dashboardUrl = `${process.env.APPLICANT_PORTAL_URL}/applicant/dashboard`;
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #3B82F6; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9fafb; }
          .status-box {
            background-color: #DBEAFE;
            border: 2px solid #3B82F6;
            padding: 15px;
            margin: 20px 0;
            text-align: center;
            border-radius: 8px;
          }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background-color: #3B82F6; 
            color: white; 
            text-decoration: none; 
            border-radius: 6px;
            margin: 20px 0;
          }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📝 Application Received</h1>
          </div>
          <div class="content">
            <p>Dear ${firstName} ${lastName},</p>
            <p>Thank you for submitting your application to our institution!</p>
            
            <div class="status-box">
              <h3 style="margin: 0; color: #1E40AF;">✅ Application Status: PENDING REVIEW</h3>
            </div>

            <p><strong>What Happens Next?</strong></p>
            <ol>
              <li>Our admissions committee will review your application</li>
              <li>You will receive an email notification once a decision is made</li>
              <li>If approved, you'll be asked to pay the acceptance fee</li>
              <li>After payment, you'll receive your matriculation number</li>
            </ol>

            <p><strong>Application Review Timeline:</strong><br/>
            Applications are typically reviewed within 5-7 business days. You can check your application status anytime by logging into your dashboard.</p>

            <center>
              <a href="${dashboardUrl}" class="button">View Dashboard</a>
            </center>

            <p>If you have any questions, please don't hesitate to contact our admissions office.</p>
            
            <p>Best regards,<br/>Admissions Team</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Institutional Management System. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: 'Application Received - Under Review',
    html,
    text: `Dear ${firstName} ${lastName}, Your application has been received and is currently under review. You will be notified once a decision is made.`,
  });
};
