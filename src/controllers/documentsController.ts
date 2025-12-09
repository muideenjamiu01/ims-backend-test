import { Response } from 'express';
import prisma from '../config/database';
import { StudentAuthRequest } from '../middleware/studentAuth';
import logger from '../config/logger';
import {
  generateAdmissionLetter,
  generateIDCard,
  generatePaymentReceipt,
  generateTranscript,
} from '../utils/pdfGenerator';
import { calculateGPA } from '../utils/helpers';
import path from 'path';
import fs from 'fs';

/**
 * Generate and download admission letter
 */
export const downloadAdmissionLetter = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;

    // Get student details
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        department: {
          select: { name: true, code: true },
        },
        program: {
          select: { name: true, code: true, duration: true },
        },
      },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    // Check if acceptance fee has been paid
    if (!student.acceptanceFeePaid) {
      return res.status(402).json({
        success: false,
        message: 'Please pay your acceptance fee before downloading admission letter',
      });
    }

    // Generate admission letter
    const admissionDate = student.enrollmentDate;
    
    const outputPath = path.join(
      process.env.UPLOAD_DIR || 'uploads',
      'documents',
      `admission_letter_${student.matricNo}_${Date.now()}.pdf`
    );

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const letterPath = await generateAdmissionLetter(
      {
        firstName: student.firstName,
        lastName: student.lastName,
        matricNo: student.matricNo,
        email: student.email,
        program: student.program?.name || 'N/A',
        department: student.department.name,
        admissionDate,
      },
      outputPath
    );

    // Check if file exists
    if (!fs.existsSync(letterPath)) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate admission letter',
      });
    }

    // Send file
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="admission_letter_${student.matricNo}.pdf"`
    );

    const fileStream = fs.createReadStream(letterPath);
    fileStream.pipe(res);

    logger.info(`Admission letter generated for student ${student.matricNo}`);
  } catch (error: any) {
    logger.error('Error in downloadAdmissionLetter:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to download admission letter',
      error: error.message,
    });
  }
};

/**
 * Generate and download student ID card
 */
export const downloadIDCard = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;

    // Get student details
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        department: {
          select: { name: true, code: true },
        },
        program: {
          select: { name: true },
        },
      },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    // Check if acceptance fee has been paid
    if (!student.acceptanceFeePaid) {
      return res.status(402).json({
        success: false,
        message: 'Please pay your acceptance fee before downloading ID card',
      });
    }

    // Generate ID card
    const outputPath = path.join(
      process.env.UPLOAD_DIR || 'uploads',
      'documents',
      `id_card_${student.matricNo}_${Date.now()}.pdf`
    );

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const idCardPath = await generateIDCard(
      {
        firstName: student.firstName,
        lastName: student.lastName,
        matricNo: student.matricNo,
        department: student.department.name,
        level: student.currentLevel,
        profilePicture: student.profilePicture || undefined,
      },
      outputPath
    );

    // Check if file exists
    if (!fs.existsSync(idCardPath)) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate ID card',
      });
    }

    // Send file
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="id_card_${student.matricNo}.pdf"`
    );

    const fileStream = fs.createReadStream(idCardPath);
    fileStream.pipe(res);

    logger.info(`ID card generated for student ${student.matricNo}`);
  } catch (error: any) {
    logger.error('Error in downloadIDCard:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to download ID card',
      error: error.message,
    });
  }
};

/**
 * Download payment receipt
 */
export const downloadPaymentReceipt = async (req: StudentAuthRequest, res: Response) => {
  try {
    const { paymentId } = req.params;
    const studentId = req.student!.id;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: 'Payment ID is required',
      });
    }

    // Get payment details
    const payment = await prisma.payment.findUnique({
      where: { id: parseInt(paymentId) },
      include: {
        student: {
          select: {
            matricNo: true,
            firstName: true,
            lastName: true,
            department: {
              select: { name: true },
            },
          },
        },
        invoice: {
          select: {
            invoiceNo: true,
            type: true,
            description: true,
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

    if (payment.studentId !== studentId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to download this receipt',
      });
    }

    if (payment.status !== 'PAID') {
      return res.status(400).json({
        success: false,
        message: 'Receipt is only available for completed payments',
      });
    }

    // Generate receipt path
    const receiptFileName = `receipt_${payment.reference}.pdf`;
    const receiptPath = path.join(process.cwd(), 'uploads', 'receipts', receiptFileName);

    // Generate receipt if it doesn't exist
    if (!fs.existsSync(receiptPath)) {
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
          paidAt: payment.paidAt || payment.createdAt,
        },
        receiptPath
      );
    }

    // Check if file exists
    if (!fs.existsSync(receiptPath)) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate receipt',
      });
    }

    // Send file
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${receiptFileName}"`
    );

    const fileStream = fs.createReadStream(receiptPath);
    fileStream.pipe(res);

    logger.info(`Payment receipt downloaded for ${payment.reference}`);
  } catch (error: any) {
    logger.error('Error in downloadPaymentReceipt:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to download payment receipt',
      error: error.message,
    });
  }
};

/**
 * Download academic transcript
 */
export const downloadAcademicTranscript = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;

    // Get student details
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        department: {
          select: { name: true, code: true },
        },
        program: {
          select: { name: true, code: true },
        },
      },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    // Get all results
    const results = await prisma.result.findMany({
      where: { studentId },
      include: {
        course: {
          select: {
            code: true,
            title: true,
            credits: true,
          },
        },
        session: {
          select: { name: true },
        },
      },
      orderBy: [
        { sessionId: 'asc' },
        { semester: 'asc' },
        { course: { code: 'asc' } },
      ],
    });

    if (results.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No results available to generate transcript',
      });
    }

    // Group results by session and semester
    const groupedResults: Record<string, any> = {};

    results.forEach(result => {
      const key = `${result.sessionId}_${result.semester}`;
      
      if (!groupedResults[key]) {
        groupedResults[key] = {
          session: result.session.name,
          semester: result.semester,
          courses: [],
        };
      }

      groupedResults[key].courses.push({
        code: result.course.code,
        title: result.course.title,
        credits: result.course.credits,
        score: result.score,
        grade: result.grade,
        gradePoint: result.gradePoint,
      });
    });

    // Calculate CGPA
    const cgpa = calculateGPA(
      results.map(r => ({
        score: r.score,
        credits: r.course.credits,
      }))
    );

    const totalCreditsEarned = results
      .filter(r => r.grade !== 'F')
      .reduce((sum, r) => sum + r.course.credits, 0);

    // Generate transcript
    const outputPath = path.join(
      process.env.UPLOAD_DIR || 'uploads',
      'transcripts',
      `transcript_${student.matricNo}_${Date.now()}.pdf`
    );

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const transcriptPath = await generateTranscript(
      {
        firstName: student.firstName,
        lastName: student.lastName,
        matricNo: student.matricNo,
        department: student.department.name,
        program: student.program?.name || 'N/A',
      },
      Object.values(groupedResults),
      cgpa,
      outputPath
    );

    // Check if file exists
    if (!fs.existsSync(transcriptPath)) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate transcript',
      });
    }

    // Send file
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="transcript_${student.matricNo}.pdf"`
    );

    const fileStream = fs.createReadStream(transcriptPath);
    fileStream.pipe(res);

    logger.info(`Academic transcript generated for student ${student.matricNo}`);
  } catch (error: any) {
    logger.error('Error in downloadAcademicTranscript:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to download academic transcript',
      error: error.message,
    });
  }
};

/**
 * Get list of available documents
 */
export const getAvailableDocuments = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        acceptanceFeePaid: true,
        matricNo: true,
      },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    // Check if student has results for transcript
    const hasResults = (await prisma.result.count({ where: { studentId } })) > 0;

    // Get payment receipts
    const payments = await prisma.payment.findMany({
      where: { studentId, status: 'PAID' },
      select: {
        id: true,
        reference: true,
        amount: true,
        paidAt: true,
        invoice: {
          select: {
            invoiceNo: true,
            type: true,
          },
        },
      },
      orderBy: { paidAt: 'desc' },
    });

    const documents = [
      {
        type: 'ADMISSION_LETTER',
        title: 'Admission Letter',
        description: 'Official admission letter from the university',
        available: student.acceptanceFeePaid,
        requiresPayment: !student.acceptanceFeePaid,
        downloadUrl: '/api/student/documents/admission-letter',
      },
      {
        type: 'ID_CARD',
        title: 'Student ID Card',
        description: 'Official student identification card',
        available: student.acceptanceFeePaid,
        requiresPayment: !student.acceptanceFeePaid,
        downloadUrl: '/api/student/documents/id-card',
      },
      {
        type: 'TRANSCRIPT',
        title: 'Academic Transcript',
        description: 'Complete academic record with grades and CGPA',
        available: hasResults,
        requiresPayment: false,
        downloadUrl: '/api/student/documents/transcript',
      },
      {
        type: 'PAYMENT_RECEIPTS',
        title: 'Payment Receipts',
        description: 'Official receipts for all completed payments',
        available: payments.length > 0,
        requiresPayment: false,
        receipts: payments.map(p => ({
          id: p.id,
          reference: p.reference,
          invoiceNo: p.invoice.invoiceNo,
          type: p.invoice.type,
          amount: p.amount,
          date: p.paidAt,
          downloadUrl: `/api/student/documents/receipt/${p.id}`,
        })),
      },
    ];

    return res.status(200).json({
      success: true,
      data: {
        documents,
        summary: {
          totalAvailable: documents.filter(d => d.available).length,
          totalPaymentReceipts: payments.length,
        },
      },
    });
  } catch (error: any) {
    logger.error('Error in getAvailableDocuments:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch available documents',
      error: error.message,
    });
  }
};
