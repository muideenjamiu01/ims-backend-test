import PDFDocument from 'pdfkit';
import { Response } from 'express';
import prisma from '../config/database';
import logger from '../config/logger';

interface CourseFormData {
  student: {
    firstName: string;
    lastName: string;
    matricNo: string;
    department: {
      name: string;
      code: string;
    };
  };
  session: {
    name: string;
  };
  semester: {
    type: string;
  };
  level: number;
  totalUnits: number;
  status: string;
  submittedAt: Date;
  approvedAt: Date | null;
  comments: string | null;
  courses: Array<{
    course: {
      code: string;
      title: string;
      credits: number;
    };
  }>;
}

export const generateCourseFormPDF = async (
  batchId: number,
  res: Response
): Promise<void> => {
  try {
    // Fetch registration batch data
    const batch = await prisma.courseRegistrationBatch.findUnique({
      where: { id: batchId },
      include: {
        student: {
          include: {
            department: true,
          },
        },
        session: true,
        semester: true,
        courses: {
          include: {
            course: true,
          },
          orderBy: {
            course: {
              code: 'asc',
            },
          },
        },
      },
    });

    if (!batch) {
      res.status(404).json({ success: false, message: 'Registration not found' });
      return;
    }

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=course_form_${batch.student.matricNo}_${batch.session.name}.pdf`
    );

    // Pipe PDF to response
    doc.pipe(res);

    // Add university header
    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .text('INSTITUTIONAL MANAGEMENT SYSTEM', { align: 'center' })
      .moveDown(0.5);

    doc
      .fontSize(16)
      .text('COURSE REGISTRATION FORM', { align: 'center' })
      .moveDown(1);

    // Add student information section
    doc.fontSize(12).font('Helvetica-Bold').text('STUDENT INFORMATION', { underline: true });
    doc.moveDown(0.5);

    doc.font('Helvetica');
    const studentInfo = [
      ['Name:', `${batch.student.firstName} ${batch.student.lastName}`],
      ['Matric Number:', batch.student.matricNo],
      ['Department:', `${batch.student.department.name} (${batch.student.department.code})`],
      ['Level:', `${batch.level} Level`],
      ['Session:', batch.session.name],
      ['Semester:', batch.semester.type === 'FIRST' ? 'First Semester' : 'Second Semester'],
    ];

    studentInfo.forEach(([label, value]) => {
      doc.text(label, 50, doc.y, { continued: true, width: 150 });
      doc.text(value, 200);
    });

    doc.moveDown(1);

    // Add registration details
    doc.font('Helvetica-Bold').text('REGISTRATION DETAILS', { underline: true });
    doc.moveDown(0.5);

    doc.font('Helvetica');
    doc.text(`Status: ${batch.status}`);
    doc.text(`Total Units: ${batch.totalUnits}`);
    doc.text(`Submitted: ${batch.submittedAt.toLocaleDateString()}`);
    if (batch.approvedAt) {
      doc.text(`Approved: ${batch.approvedAt.toLocaleDateString()}`);
    }
    if (batch.comments) {
      doc.text(`Comments: ${batch.comments}`);
    }

    doc.moveDown(1);

    // Add courses table
    doc.font('Helvetica-Bold').text('REGISTERED COURSES', { underline: true });
    doc.moveDown(0.5);

    // Table headers
    const tableTop = doc.y;
    const colWidths = {
      sn: 30,
      code: 100,
      title: 250,
      units: 50,
      type: 80,
    };

    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('S/N', 50, tableTop);
    doc.text('Course Code', 50 + colWidths.sn, tableTop);
    doc.text('Course Title', 50 + colWidths.sn + colWidths.code, tableTop);
    doc.text('Units', 50 + colWidths.sn + colWidths.code + colWidths.title, tableTop);
    doc.text('Type', 50 + colWidths.sn + colWidths.code + colWidths.title + colWidths.units, tableTop);

    doc.moveDown(0.5);

    // Draw header line
    doc
      .moveTo(50, doc.y)
      .lineTo(550, doc.y)
      .stroke();

    doc.moveDown(0.3);

    // Table rows
    doc.font('Helvetica').fontSize(9);
    batch.courses.forEach((item, index) => {
      const rowY = doc.y;

      // Check if we need a new page
      if (rowY > 700) {
        doc.addPage();
        doc.fontSize(10);
      }

      doc.text((index + 1).toString(), 50, rowY);
      doc.text(item.course.code, 50 + colWidths.sn, rowY);
      doc.text(item.course.title, 50 + colWidths.sn + colWidths.code, rowY, {
        width: colWidths.title - 10,
      });
      doc.text(item.course.credits.toString(), 50 + colWidths.sn + colWidths.code + colWidths.title, rowY);
      doc.text(
        'Core', // TODO: Add isElective field to Course model if needed
        50 + colWidths.sn + colWidths.code + colWidths.title + colWidths.units,
        rowY
      );

      doc.moveDown(0.8);
    });

    // Draw bottom line
    doc
      .moveTo(50, doc.y)
      .lineTo(550, doc.y)
      .stroke();

    doc.moveDown(1);

    // Add summary
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text(`Total Courses: ${batch.courses.length}`, 50);
    doc.text(`Total Units: ${batch.totalUnits}`, 50);

    doc.moveDown(2);

    // Add signature section
    doc.fontSize(10);
    const signatureY = doc.y;

    // Student signature
    doc.text('_____________________', 50, signatureY);
    doc.text('Student Signature', 50, signatureY + 25);
    doc.text('Date: ___________', 50, signatureY + 40);

    // HOD signature (if approved)
    if (batch.status === 'APPROVED') {
      doc.text('_____________________', 350, signatureY);
      doc.text('HOD Signature', 350, signatureY + 25);
      doc.text(`Date: ${batch.approvedAt?.toLocaleDateString() || '___________'}`, 350, signatureY + 40);
    }

    doc.moveDown(3);

    // Add footer
    doc
      .fontSize(8)
      .font('Helvetica')
      .text(
        'This is a computer-generated document. No signature is required unless specified.',
        50,
        doc.page.height - 50,
        { align: 'center' }
      );

    // Finalize PDF
    doc.end();

    logger.info(`Generated course form PDF for batch ${batchId}`);
  } catch (error) {
    logger.error('Generate PDF error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to generate PDF',
      });
    }
  }
};

export const downloadCourseForm = async (batchId: number, studentId: number, res: Response) => {
  try {
    // Verify ownership
    const batch = await prisma.courseRegistrationBatch.findFirst({
      where: {
        id: batchId,
        studentId,
      },
    });

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found or access denied',
      });
    }

    // Generate and send PDF
    await generateCourseFormPDF(batchId, res);
  } catch (error) {
    logger.error('Download course form error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to download course form',
      });
    }
  }
};
