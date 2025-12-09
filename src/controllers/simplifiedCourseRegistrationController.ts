import { Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { StudentAuthRequest } from '../middleware/studentAuth';
import logger from '../config/logger';

// Validation schemas using existing schema fields
const registerCoursesSchema = z.object({
  courseIds: z.array(z.number().int().positive()).min(1, 'At least one course is required'),
  academicYear: z.string().min(1, 'Academic year is required'),
  semester: z.number().int().min(1).max(2),
});

const registrationWindowSchema = z.object({
  sessionId: z.number().int().positive(),
  semesterId: z.number().int().positive(),
  startDate: z.string().transform(str => new Date(str)),
  endDate: z.string().transform(str => new Date(str)),
});

/**
 * Admin: Get registration windows (mock implementation)
 */
export const getRegistrationWindows = async (req: AuthRequest, res: Response) => {
  try {
    // Mock data since we don't have the full RegistrationWindow model yet
    const mockWindows = [
      {
        id: 1,
        sessionId: 1,
        semesterId: 1,
        startDate: '2024-09-01T00:00:00Z',
        endDate: '2024-12-31T23:59:59Z',
        isActive: true,
        session: { name: '2024/2025' },
        semester: { type: 'FIRST' },
        createdAt: new Date().toISOString(),
      },
      {
        id: 2,
        sessionId: 1,
        semesterId: 2,
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-06-30T23:59:59Z',
        isActive: false,
        session: { name: '2024/2025' },
        semester: { type: 'SECOND' },
        createdAt: new Date().toISOString(),
      },
    ];

    res.json({
      success: true,
      data: mockWindows,
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
 * Admin: Create/update registration window (mock implementation)
 */
export const createRegistrationWindow = async (req: AuthRequest, res: Response) => {
  try {
    const data = registrationWindowSchema.parse(req.body);

    // Mock response since we don't have the full RegistrationWindow model yet
    const mockWindow = {
      id: Math.floor(Math.random() * 1000),
      sessionId: data.sessionId,
      semesterId: data.semesterId,
      startDate: data.startDate.toISOString(),
      endDate: data.endDate.toISOString(),
      isActive: true,
      session: { name: '2024/2025' },
      semester: { type: 'FIRST' },
      createdAt: new Date().toISOString(),
    };

    res.json({
      success: true,
      message: 'Registration window created successfully',
      data: mockWindow,
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
 * Student: Get available courses for registration
 */
export const getAvailableCoursesForRegistration = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;
    const { level, academicYear, semester } = req.query;

    logger.info(`Course registration request from student ${studentId}: level=${level}, academicYear=${academicYear}, semester=${semester}`);

    // Validate query parameters
    if (!level || !academicYear || !semester) {
      logger.warn(`Missing query parameters: level=${level}, academicYear=${academicYear}, semester=${semester}`);
      return res.status(400).json({
        success: false,
        message: 'Level, academic year, and semester are required',
      });
    }

    const levelNum = parseInt(level as string);
    const semesterNum = parseInt(semester as string);

    // Get student details
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        department: true,
      },
    });

    if (!student) {
      logger.warn(`Student not found: ${studentId}`);
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    logger.info(`Found student: ${student.matricNo}, dept: ${student.department?.name}, current level: ${student.currentLevel}`);

    // Check if student has paid required fees (simplified check)
    const unpaidInvoice = await prisma.invoice.findFirst({
      where: {
        studentId,
        balance: { gt: 0 },
      },
    });

    if (unpaidInvoice) {
      return res.status(402).json({
        success: false,
        message: 'Please clear your outstanding fees before registering for courses',
        requiredPayment: {
          invoiceNo: unpaidInvoice.invoiceNo,
          balance: unpaidInvoice.balance,
        },
      });
    }

    // Get courses for the specified level, semester and student's department
    const availableCourses = await prisma.course.findMany({
      where: {
        departmentId: student.departmentId,
        level: levelNum,
        semester: semesterNum,
      },
      include: {
        department: {
          select: { name: true, code: true },
        },
      },
      orderBy: [
        { code: 'asc' },
      ],
    });

    logger.info(`Found ${availableCourses.length} courses for student ${studentId}, dept: ${student.departmentId}, level: ${levelNum}, semester: ${semesterNum}`);

    // Get already registered courses for current academic year/semester
    const registeredCourses = await prisma.courseRegistration.findMany({
      where: {
        studentId,
        academicYear: academicYear as string,
        semester: semesterNum,
      },
      select: { courseId: true },
    });

    const registeredCourseIds = new Set(registeredCourses.map(r => r.courseId));

    // Filter courses and mark registration status
    const coursesWithStatus = availableCourses.map(course => ({
      ...course,
      isRegistered: registeredCourseIds.has(course.id),
    }));

    // Mock registration window for now
    const mockRegistrationWindow = {
      id: 1,
      startDate: '2024-09-01T00:00:00Z',
      endDate: '2024-12-31T23:59:59Z',
      isActive: true,
      session: { name: academicYear as string },
      semester: { type: semesterNum === 1 ? 'FIRST' : 'SECOND' },
    };

    res.json({
      success: true,
      data: {
        courses: coursesWithStatus,
        registrationWindow: mockRegistrationWindow,
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
        academicYear: data.academicYear,
        semester: data.semester,
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
            academicYear: data.academicYear,
            semester: data.semester,
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
    const { academicYear, semester } = req.query;

    const where: any = { studentId };
    
    if (academicYear) where.academicYear = academicYear as string;
    if (semester) where.semester = parseInt(semester as string);

    const registrations = await prisma.courseRegistration.findMany({
      where,
      include: {
        course: {
          include: {
            department: true,
          },
        },
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
    });

    if (registrations.length !== registrationIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some registrations do not exist or do not belong to you',
      });
    }

    // Delete the registrations (simple approach for existing schema)
    await prisma.courseRegistration.deleteMany({
      where: {
        id: { in: registrationIds },
        studentId,
      },
    });

    res.json({
      success: true,
      message: `Successfully dropped ${registrations.length} courses`,
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
 * Admin: View student course registrations
 */
export const getStudentRegistrations = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId, academicYear, semester } = req.query;

    const where: any = {};
    if (studentId) where.studentId = parseInt(studentId as string);
    if (academicYear) where.academicYear = academicYear as string;
    if (semester) where.semester = parseInt(semester as string);

    const registrations = await prisma.courseRegistration.findMany({
      where,
      include: {
        student: {
          include: {
            department: true,
          },
        },
        course: true,
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