import { Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { StudentAuthRequest } from '../middleware/studentAuth';
import logger from '../config/logger';
import PDFDocument from 'pdfkit';

// Validation schemas
const registrationWindowSchema = z.object({
  sessionId: z.number().int().positive(),
  semesterId: z.number().int().positive(),
  startDate: z.string().transform(str => new Date(str)),
  endDate: z.string().transform(str => new Date(str)),
});

const registerCoursesSchema = z.object({
  courseIds: z.array(z.number().int().positive()).min(1, 'At least one course is required'),
  level: z.number().int().positive(),
  sessionId: z.number().int().positive(),
  semesterId: z.number().int().positive(),
});

/**
 * Admin: Create/update registration window
 */
export const createRegistrationWindow = async (req: AuthRequest, res: Response) => {
  try {
    const data = registrationWindowSchema.parse(req.body);

    // Check if window already exists for this session/semester
    const existingWindow = await prisma.registrationWindow.findUnique({
      where: {
        sessionId_semesterId: {
          sessionId: data.sessionId,
          semesterId: data.semesterId,
        },
      },
    });

    if (existingWindow) {
      // Update existing window
      const updatedWindow = await prisma.registrationWindow.update({
        where: { id: existingWindow.id },
        data: {
          startDate: data.startDate,
          endDate: data.endDate,
          isActive: true,
        },
        include: {
          session: true,
          semester: true,
        },
      });

      return res.json({
        success: true,
        message: 'Registration window updated successfully',
        data: updatedWindow,
      });
    }

    // Create new window
    const newWindow = await prisma.registrationWindow.create({
      data: {
        sessionId: data.sessionId,
        semesterId: data.semesterId,
        startDate: data.startDate,
        endDate: data.endDate,
      },
      include: {
        session: true,
        semester: true,
      },
    });

    res.json({
      success: true,
      message: 'Registration window created successfully',
      data: newWindow,
    });
  } catch (error) {
    logger.error('Create registration window error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create registration window',
    });
  }
};

/**
 * Admin: Get registration windows
 */
export const getRegistrationWindows = async (req: AuthRequest, res: Response) => {
  try {
    const windows = await prisma.registrationWindow.findMany({
      include: {
        session: true,
        semester: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      success: true,
      data: windows,
    });
  } catch (error) {
    logger.error('Get registration windows error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get registration windows',
    });
  }
};

/**
 * Student: Get available courses for registration
 */
export const getAvailableCoursesForRegistration = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;
    const { level, sessionId, semesterId } = req.query;

    // Validate query parameters
    if (!level || !sessionId || !semesterId) {
      return res.status(400).json({
        success: false,
        message: 'Level, sessionId, and semesterId are required',
      });
    }

    const levelNum = parseInt(level as string);
    const sessionIdNum = parseInt(sessionId as string);
    const semesterIdNum = parseInt(semesterId as string);

    // Get student details
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        department: true,
      },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    // Check if registration window is active
    const registrationWindow = await prisma.registrationWindow.findUnique({
      where: {
        sessionId_semesterId: {
          sessionId: sessionIdNum,
          semesterId: semesterIdNum,
        },
      },
    });

    if (!registrationWindow || !registrationWindow.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Course registration is not currently open',
      });
    }

    const currentDate = new Date();
    if (currentDate < registrationWindow.startDate || currentDate > registrationWindow.endDate) {
      return res.status(400).json({
        success: false,
        message: 'Course registration period has ended or not yet started',
        window: {
          startDate: registrationWindow.startDate,
          endDate: registrationWindow.endDate,
        },
      });
    }

    // Check if student has paid required fees
    const requiredFeeTypes = ['SCHOOL_FEE', 'DEPARTMENTAL_FEE', 'TECHNOLOGY_FEE'];
    
    for (const feeType of requiredFeeTypes) {
      const unpaidInvoice = await prisma.invoice.findFirst({
        where: {
          studentId,
          type: feeType as any,
          sessionId: sessionIdNum,
          balance: { gt: 0 },
        },
      });

      if (unpaidInvoice) {
        return res.status(402).json({
          success: false,
          message: `Please pay your ${feeType.replace(/_/g, ' ').toLowerCase()} before registering for courses`,
          requiredPayment: {
            type: feeType,
            invoiceNo: unpaidInvoice.invoiceNo,
            balance: unpaidInvoice.balance,
          },
        });
      }
    }

    // Get courses for the specified level and student's department
    const availableCourses = await prisma.course.findMany({
      where: {
        departmentId: student.departmentId,
        level: levelNum,
      },
      include: {
        department: {
          select: { name: true, code: true },
        },
      },
      orderBy: [
        { semester: 'asc' },
        { code: 'asc' },
      ],
    });

    // Get already registered courses for current session/semester
    const registeredCourses = await prisma.courseRegistration.findMany({
      where: {
        studentId,
        sessionId: sessionIdNum,
        semesterId: semesterIdNum,
        level: levelNum,
      },
      select: { courseId: true },
    });

    const registeredCourseIds = new Set(registeredCourses.map(r => r.courseId));

    // Filter courses and mark registration status
    const coursesWithStatus = availableCourses.map(course => ({
      ...course,
      isRegistered: registeredCourseIds.has(course.id),
    }));

    res.json({
      success: true,
      data: {
        courses: coursesWithStatus,
        registrationWindow,
        student: {
          id: student.id,
          matricNo: student.matricNo,
          firstName: student.firstName,
          lastName: student.lastName,
          department: student.department,
          currentLevel: student.currentLevel,
        },
      },
    });
  } catch (error) {
    logger.error('Get available courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get available courses',
    });
  }
};

/**
 * Student: Register for courses
 */
export const registerForCourses = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;
    const data = registerCoursesSchema.parse(req.body);

    // Check if registration window is active
    const registrationWindow = await prisma.registrationWindow.findUnique({
      where: {
        sessionId_semesterId: {
          sessionId: data.sessionId,
          semesterId: data.semesterId,
        },
      },
    });

    if (!registrationWindow || !registrationWindow.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Course registration is not currently open',
      });
    }

    const currentDate = new Date();
    if (currentDate < registrationWindow.startDate || currentDate > registrationWindow.endDate) {
      return res.status(400).json({
        success: false,
        message: 'Course registration period has ended or not yet started',
      });
    }

    // Verify courses exist and calculate total units
    const courses = await prisma.course.findMany({
      where: {
        id: { in: data.courseIds },
      },
    });

    if (courses.length !== data.courseIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some selected courses do not exist',
      });
    }

    const totalUnits = courses.reduce((sum, course) => sum + course.credits, 0);

    // Check if already registered for any of these courses
    const existingRegistrations = await prisma.courseRegistration.findMany({
      where: {
        studentId,
        courseId: { in: data.courseIds },
        sessionId: data.sessionId,
        semesterId: data.semesterId,
        level: data.level,
      },
    });

    if (existingRegistrations.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You are already registered for some of these courses',
        duplicateCourses: existingRegistrations.map(reg => reg.courseId),
      });
    }

    // Create registrations
    const registrations = await prisma.$transaction(
      data.courseIds.map(courseId =>
        prisma.courseRegistration.create({
          data: {
            studentId,
            courseId,
            sessionId: data.sessionId,
            semesterId: data.semesterId,
            level: data.level,
            academicYear: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
            semester: data.semesterId,
          },
          include: {
            course: true,
          },
        })
      )
    );

    res.json({
      success: true,
      message: `Successfully registered for ${registrations.length} courses`,
      data: {
        registrations,
        totalUnits,
      },
    });
  } catch (error) {
    logger.error('Register courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register for courses',
    });
  }
};

/**
 * Student: Get registered courses
 */
export const getRegisteredCourses = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;
    const { sessionId, semesterId, level } = req.query;

    const where: any = { studentId };
    
    if (sessionId) where.sessionId = parseInt(sessionId as string);
    if (semesterId) where.semesterId = parseInt(semesterId as string);
    if (level) where.level = parseInt(level as string);

    const registrations = await prisma.courseRegistration.findMany({
      where,
      include: {
        course: {
          include: {
            department: true,
          },
        },
        session: true,
        semesterRecord: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const totalUnits = registrations.reduce((sum, reg) => sum + reg.course.credits, 0);

    res.json({
      success: true,
      data: {
        registrations,
        totalUnits,
        count: registrations.length,
      },
    });
  } catch (error) {
    logger.error('Get registered courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get registered courses',
    });
  }
};

/**
 * Student: Drop/withdraw from courses
 */
export const dropCourses = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;
    const { registrationIds } = req.body;

    if (!registrationIds || !Array.isArray(registrationIds)) {
      return res.status(400).json({
        success: false,
        message: 'Registration IDs are required',
      });
    }

    // Verify registrations belong to the student
    const registrations = await prisma.courseRegistration.findMany({
      where: {
        id: { in: registrationIds },
        studentId,
      },
      include: {
        session: true,
        semesterRecord: true,
      },
    });

    if (registrations.length !== registrationIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some registrations do not exist or do not belong to you',
      });
    }

    // Check if registration window is still active for modification
    for (const registration of registrations) {
      if (!registration.sessionId || !registration.semesterId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid registration data: missing session or semester information',
        });
      }

      const registrationWindow = await prisma.registrationWindow.findUnique({
        where: {
          sessionId_semesterId: {
            sessionId: registration.sessionId,
            semesterId: registration.semesterId,
          },
        },
      });

      if (!registrationWindow || !registrationWindow.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Registration modification period is closed',
        });
      }

      const currentDate = new Date();
      if (currentDate > registrationWindow.endDate) {
        return res.status(400).json({
          success: false,
          message: 'Registration modification period has ended',
        });
      }
    }

    // Update registration status to WITHDRAWN
    await prisma.courseRegistration.updateMany({
      where: {
        id: { in: registrationIds },
        studentId,
      },
      data: {
        status: 'WITHDRAWN',
      },
    });

    res.json({
      success: true,
      message: `Successfully withdrew from ${registrations.length} courses`,
    });
  } catch (error) {
    logger.error('Drop courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to drop courses',
    });
  }
};

/**
 * Student: Generate course registration form (PDF)
 */
export const generateCourseForm = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;
    const { sessionId, semesterId, level } = req.query;

    if (!sessionId || !semesterId || !level) {
      return res.status(400).json({
        success: false,
        message: 'Session, semester, and level are required',
      });
    }

    const sessionIdNum = parseInt(sessionId as string);
    const semesterIdNum = parseInt(semesterId as string);
    const levelNum = parseInt(level as string);

    // Get student details and registrations
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        department: true,
      },
    });

    const registrations = await prisma.courseRegistration.findMany({
      where: {
        studentId,
        sessionId: sessionIdNum,
        semesterId: semesterIdNum,
        level: levelNum,
        status: 'REGISTERED',
      },
      include: {
        course: true,
        session: true,
        semesterRecord: true,
      },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    if (registrations.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No course registrations found for the specified criteria',
      });
    }

    // Calculate total units
    const totalUnits = registrations.reduce((sum, reg) => sum + reg.course.credits, 0);

    // Generate PDF
    const doc = new PDFDocument({ margin: 50 });

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition', 
      `attachment; filename=course_form_${student.matricNo}_${sessionId}_${semesterId}_L${level}.pdf`
    );

    // Pipe the PDF directly to the response
    doc.pipe(res);

    // Header
    doc.fontSize(16).text('COURSE REGISTRATION FORM', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).text('Institution Management System', { align: 'center' });
    doc.moveDown(1.5);

    // Student Information
    doc.fontSize(12).text('STUDENT INFORMATION', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10)
      .text(`Name: ${student.firstName} ${student.lastName}`)
      .text(`Matric Number: ${student.matricNo}`)
      .text(`Department: ${student.department.name}`)
      .text(`Level: ${level}`)
      .text(`Session: ${registrations[0].session?.name || 'N/A'}`)
      .text(`Semester: ${registrations[0].semesterRecord?.type || 'N/A'}`);
    doc.moveDown(1);

    // Course Table
    doc.fontSize(12).text('REGISTERED COURSES', { underline: true });
    doc.moveDown(0.5);

    // Table headers
    const tableTop = doc.y;
    const tableHeaders = ['S/N', 'Course Code', 'Course Title', 'Units', 'Lecturer Signature'];
    const columnWidths = [40, 100, 250, 50, 150];
    let currentX = 50;

    doc.fontSize(10);
    tableHeaders.forEach((header, i) => {
      doc.text(header, currentX, tableTop, { width: columnWidths[i] });
      currentX += columnWidths[i];
    });

    // Table rows
    let currentY = tableTop + 20;
    registrations.forEach((registration, index) => {
      currentX = 50;
      const rowData = [
        (index + 1).toString(),
        registration.course.code,
        registration.course.title,
        registration.course.credits.toString(),
        '', // Empty for signature
      ];

      rowData.forEach((data, i) => {
        doc.text(data, currentX, currentY, { 
          width: columnWidths[i],
          height: 20
        });
        currentX += columnWidths[i];
      });
      currentY += 25;
    });

    // Total units
    doc.moveDown(1);
    doc.fontSize(11).text(`Total Credit Units: ${totalUnits}`, { align: 'right' });
    doc.moveDown(2);

    // Signature sections
    doc.fontSize(12).text('APPROVALS', { underline: true });
    doc.moveDown(1);

    doc.fontSize(10);
    doc.text('Student Signature: _______________________ Date: ___________');
    doc.moveDown(1);
    doc.text('Academic Adviser Signature: _______________________ Date: ___________');
    doc.moveDown(1);
    doc.text('HOD Signature: _______________________ Date: ___________');
    doc.moveDown(2);

    doc.text('Department Stamp:', { align: 'center' });
    doc.rect(250, doc.y + 10, 100, 50).stroke();

    // Finalize the PDF
    doc.end();
  } catch (error) {
    logger.error('Generate course form error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate course form',
    });
  }
};

/**
 * Admin: View student course registrations
 */
export const getStudentRegistrations = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId, sessionId, semesterId } = req.query;

    const where: any = {};
    if (studentId) where.studentId = parseInt(studentId as string);
    if (sessionId) where.sessionId = parseInt(sessionId as string);
    if (semesterId) where.semesterId = parseInt(semesterId as string);

    const registrations = await prisma.courseRegistration.findMany({
      where,
      include: {
        student: {
          include: {
            department: true,
          },
        },
        course: true,
        session: true,
        semesterRecord: true,
      },
      orderBy: [
        { student: { matricNo: 'asc' } },
        { course: { code: 'asc' } },
      ],
    });

    // Group by student
    const groupedRegistrations = registrations.reduce((acc, reg) => {
      const studentKey = reg.studentId;
      if (!acc[studentKey]) {
        acc[studentKey] = {
          student: reg.student,
          registrations: [],
          totalUnits: 0,
        };
      }
      acc[studentKey].registrations.push(reg);
      acc[studentKey].totalUnits += reg.course.credits;
      return acc;
    }, {} as any);

    res.json({
      success: true,
      data: Object.values(groupedRegistrations),
      totalStudents: Object.keys(groupedRegistrations).length,
      totalRegistrations: registrations.length,
    });
  } catch (error) {
    logger.error('Get student registrations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get student registrations',
    });
  }
};