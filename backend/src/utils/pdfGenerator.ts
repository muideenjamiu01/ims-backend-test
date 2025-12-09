import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { formatCurrency } from './helpers';
import path from 'path';
import fs from 'fs';

/**
 * Generate Admission Letter PDF
 */
export const generateAdmissionLetter = async (
  student: {
    firstName: string;
    lastName: string;
    matricNo: string;
    email: string;
    program: string;
    department: string;
    admissionDate: Date;
  },
  outputPath: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const writeStream = fs.createWriteStream(outputPath);

    doc.pipe(writeStream);

    // Header
    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .text('INSTITUTIONAL MANAGEMENT SYSTEM', { align: 'center' })
      .fontSize(14)
      .text('Student Affairs Office', { align: 'center' })
      .moveDown(2);

    // Title
    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('LETTER OF ADMISSION', { align: 'center', underline: true })
      .moveDown(2);

    // Date
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Date: ${new Date().toLocaleDateString('en-GB')}`, { align: 'right' })
      .moveDown(1);

    // Body
    doc
      .fontSize(12)
      .font('Helvetica')
      .text(`Dear ${student.firstName} ${student.lastName},`, { align: 'left' })
      .moveDown(1)
      .text(
        'We are pleased to inform you that you have been offered provisional admission to study at our institution.',
        { align: 'justify' }
      )
      .moveDown(1);

    // Admission Details
    doc
      .font('Helvetica-Bold')
      .text('ADMISSION DETAILS', { underline: true })
      .moveDown(0.5);

    const details = [
      ['Matriculation Number:', student.matricNo],
      ['Programme of Study:', student.program],
      ['Department:', student.department],
      ['Admission Date:', student.admissionDate.toLocaleDateString('en-GB')],
      ['Level:', '100'],
    ];

    details.forEach(([label, value]) => {
      doc
        .font('Helvetica-Bold')
        .text(label, { continued: true })
        .font('Helvetica')
        .text(` ${value}`)
        .moveDown(0.3);
    });

    doc.moveDown(1);

    // Requirements
    doc
      .font('Helvetica-Bold')
      .text('ADMISSION REQUIREMENTS', { underline: true })
      .moveDown(0.5);

    const requirements = [
      'Complete the acceptance form online',
      'Pay the acceptance fee of ₦50,000',
      'Submit all required documents',
      'Register for courses before the deadline',
      'Attend the orientation programme',
    ];

    requirements.forEach((req, index) => {
      doc
        .font('Helvetica')
        .text(`${index + 1}. ${req}`, { indent: 20 })
        .moveDown(0.3);
    });

    doc.moveDown(1);

    // Closing
    doc
      .font('Helvetica')
      .text(
        'Please note that this admission is provisional and subject to verification of your credentials.',
        { align: 'justify' }
      )
      .moveDown(1)
      .text('We congratulate you on this achievement and look forward to welcoming you.')
      .moveDown(2);

    // Signature
    doc
      .font('Helvetica-Bold')
      .text('Dr. John Doe', { align: 'right' })
      .font('Helvetica')
      .text('Director, Student Affairs', { align: 'right' });

    // Footer
    doc
      .fontSize(8)
      .text(
        '---',
        50,
        doc.page.height - 50,
        { align: 'center' }
      )
      .text('This is a computer-generated document and does not require a signature.', {
        align: 'center',
      });

    doc.end();

    writeStream.on('finish', () => resolve(outputPath));
    writeStream.on('error', reject);
  });
};

/**
 * Generate Student ID Card PDF
 */
export const generateIDCard = async (
  student: {
    firstName: string;
    lastName: string;
    matricNo: string;
    department: string;
    level: number;
    profilePicture?: string;
  },
  outputPath: string
): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: [300, 200], margin: 10 });
      const writeStream = fs.createWriteStream(outputPath);

      doc.pipe(writeStream);

      // Generate QR code for matric number
      const qrCodeDataUrl = await QRCode.toDataURL(student.matricNo);
      const qrCodeBuffer = Buffer.from(qrCodeDataUrl.split(',')[1], 'base64');

      // Card background
      doc.rect(0, 0, 300, 200).fill('#4F46E5');

      // Header
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#FFFFFF')
        .text('IMS STUDENT ID', 10, 15, { align: 'center' });

      // White content area
      doc
        .rect(10, 40, 280, 150)
        .fill('#FFFFFF');

      // Student info
      doc
        .fontSize(10)
        .fillColor('#000000')
        .font('Helvetica-Bold')
        .text(`${student.firstName} ${student.lastName}`, 15, 50, { width: 180 })
        .fontSize(8)
        .font('Helvetica')
        .text(`Matric: ${student.matricNo}`, 15, 75)
        .text(`Dept: ${student.department}`, 15, 88)
        .text(`Level: ${student.level}`, 15, 101);

      // QR Code
      doc.image(qrCodeBuffer, 210, 50, { width: 70, height: 70 });

      // Footer
      doc
        .fontSize(6)
        .text('Valid for current session only', 10, 175, { align: 'center' });

      doc.end();

      writeStream.on('finish', () => resolve(outputPath));
      writeStream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Generate Payment Receipt PDF
 */
export const generatePaymentReceipt = async (
  payment: {
    reference: string;
    studentName: string;
    matricNo: string;
    invoiceNo: string;
    description: string;
    amount: number;
    method: string;
    paidAt: Date;
  },
  outputPath: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const writeStream = fs.createWriteStream(outputPath);

    doc.pipe(writeStream);

    // Header
    doc
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('PAYMENT RECEIPT', { align: 'center' })
      .moveDown(0.5);

    doc
      .fontSize(10)
      .font('Helvetica')
      .text('Institutional Management System', { align: 'center' })
      .text('Student Finance Department', { align: 'center' })
      .moveDown(2);

    // Receipt details box
    doc
      .rect(50, doc.y, 500, 250)
      .stroke();

    const startY = doc.y + 20;
    let currentY = startY;

    const receiptDetails = [
      ['Receipt No:', payment.reference],
      ['Date:', payment.paidAt.toLocaleDateString('en-GB')],
      ['Student Name:', payment.studentName],
      ['Matric Number:', payment.matricNo],
      ['Invoice Number:', payment.invoiceNo],
      ['Description:', payment.description],
      ['Payment Method:', payment.method],
      ['Amount Paid:', formatCurrency(payment.amount)],
    ];

    receiptDetails.forEach(([label, value]) => {
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(label, 70, currentY, { width: 150, continued: true })
        .font('Helvetica')
        .text(value, { width: 300 });
      currentY += 25;
    });

    // Amount highlight
    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .fillColor('#10B981')
      .text(formatCurrency(payment.amount), 50, currentY + 20, { align: 'center' })
      .fillColor('#000000');

    doc.moveDown(4);

    // Footer notes
    doc
      .fontSize(9)
      .font('Helvetica-Oblique')
      .text('This is a computer-generated receipt and does not require a signature.', {
        align: 'center',
      })
      .moveDown(0.5)
      .text('Please keep this receipt for your records.', { align: 'center' });

    // Page footer
    doc
      .fontSize(8)
      .text(
        `Generated on: ${new Date().toLocaleString('en-GB')}`,
        50,
        doc.page.height - 50,
        { align: 'center' }
      );

    doc.end();

    writeStream.on('finish', () => resolve(outputPath));
    writeStream.on('error', reject);
  });
};

/**
 * Generate Transcript PDF
 */
export const generateTranscript = async (
  student: {
    firstName: string;
    lastName: string;
    matricNo: string;
    department: string;
    program: string;
  },
  results: Array<{
    session: string;
    semester: number;
    courses: Array<{
      code: string;
      title: string;
      credits: number;
      score: number;
      grade: string;
      gradePoint: number;
    }>;
    gpa: number;
  }>,
  cgpa: number,
  outputPath: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const writeStream = fs.createWriteStream(outputPath);

    doc.pipe(writeStream);

    // Header
    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .text('ACADEMIC TRANSCRIPT', { align: 'center' })
      .moveDown(0.5);

    doc
      .fontSize(10)
      .font('Helvetica')
      .text('Institutional Management System', { align: 'center' })
      .moveDown(2);

    // Student Info
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('Student Information', { underline: true })
      .moveDown(0.5);

    const studentInfo = [
      ['Name:', `${student.firstName} ${student.lastName}`],
      ['Matric Number:', student.matricNo],
      ['Programme:', student.program],
      ['Department:', student.department],
    ];

    studentInfo.forEach(([label, value]) => {
      doc
        .font('Helvetica-Bold')
        .text(label, { continued: true, width: 150 })
        .font('Helvetica')
        .text(value);
    });

    doc.moveDown(1);

    // Results by session
    results.forEach((sessionResult, index) => {
      if (index > 0 && doc.y > 650) {
        doc.addPage();
      }

      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(`${sessionResult.session} - Semester ${sessionResult.semester}`)
        .moveDown(0.5);

      // Table header
      const tableTop = doc.y;
      const col1 = 50;
      const col2 = 150;
      const col3 = 350;
      const col4 = 400;
      const col5 = 450;
      const col6 = 500;

      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .text('Course Code', col1, tableTop)
        .text('Course Title', col2, tableTop)
        .text('Credits', col3, tableTop)
        .text('Score', col4, tableTop)
        .text('Grade', col5, tableTop);

      let y = tableTop + 20;

      // Table rows
      sessionResult.courses.forEach(course => {
        doc
          .fontSize(8)
          .font('Helvetica')
          .text(course.code, col1, y)
          .text(course.title, col2, y, { width: 180 })
          .text(course.credits.toString(), col3, y)
          .text(course.score.toFixed(1), col4, y)
          .text(course.grade, col5, y);
        y += 20;
      });

      // Session GPA
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(`GPA: ${sessionResult.gpa.toFixed(2)}`, col4, y + 10);

      doc.moveDown(2);
    });

    // CGPA
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .fillColor('#4F46E5')
      .text(`Cumulative GPA (CGPA): ${cgpa.toFixed(2)}`, { align: 'center' })
      .fillColor('#000000');

    doc.moveDown(2);

    // Footer
    doc
      .fontSize(8)
      .font('Helvetica-Oblique')
      .text('This is an unofficial transcript. For official use, request a certified copy.', {
        align: 'center',
      });

    doc.end();

    writeStream.on('finish', () => resolve(outputPath));
    writeStream.on('error', reject);
  });
};

// Ensure uploads directory exists
export const ensureUploadDir = () => {
  const uploadDir = path.join(__dirname, '../../uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  ['receipts', 'id-cards', 'admission-letters', 'transcripts', 'assignments'].forEach(dir => {
    const subDir = path.join(uploadDir, dir);
    if (!fs.existsSync(subDir)) {
      fs.mkdirSync(subDir, { recursive: true });
    }
  });
};
