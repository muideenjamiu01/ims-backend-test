import { Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { StudentAuthRequest, AuthRequest } from '../types/express';
import logger from '../config/logger';
import { InvoiceType } from '@prisma/client';

// Required payment types for course registration
const REQUIRED_PAYMENT_TYPES: InvoiceType[] = [
  'SCHOOL_FEE',
  'TECHNOLOGY_FEE',
  'EXAMINATION_FEE',
  'DEVELOPMENT_FEE'
];

/**
 * Check if student has made required payments for current session
 */
const checkRequiredPayments = async (studentId: number, sessionId: number) => {
  const invoices = await prisma.invoice.findMany({
    where: {
      studentId,
      sessionId,
      type: {
        in: REQUIRED_PAYMENT_TYPES
      }
    }
  });

  const paymentStatus = REQUIRED_PAYMENT_TYPES.map(type => {
    const invoice = invoices.find(inv => inv.type === type);
    return {
      type,
      required: true,
      paid: invoice?.status === 'PAID' || false,
      partiallyPaid: invoice?.status === 'PARTIALLY_PAID' || false,
      amount: invoice?.amount || 0,
      amountPaid: invoice?.amountPaid || 0,
      balance: invoice?.balance || 0,
      invoiceNo: invoice?.invoiceNo
    };
  });

  const allPaid = paymentStatus.every(p => p.paid);
  const unpaidPayments = paymentStatus.filter(p => !p.paid);

  return {
    eligible: allPaid,
    payments: paymentStatus,
    unpaidPayments
  };
};

/**
 * Get registration window status
 */
export const getRegistrationWindowStatus = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        currentSession: {
          include: {
            semesters: {
              where: { isActive: true },
              take: 1
            }
          }
        }
      }
    });

    if (!student || !student.currentSession) {
      return res.status(404).json({
        success: false,
        message: 'Student or active session not found'
      });
    }

    const activeSemester = student.currentSession.semesters[0];
    if (!activeSemester) {
      return res.status(400).json({
        success: false,
        message: 'No active semester found',
        canRegister: false
      });
    }

    // Check registration window
    const registrationWindow = await prisma.registrationWindow.findFirst({
      where: {
        sessionId: student.currentSession.id,
        semesterId: activeSemester.id,
        isActive: true,
        startDate: { lte: new Date() },
        endDate: { gte: new Date() }
      }
    });

    if (!registrationWindow) {
      return res.json({
        success: true,
        canRegister: false,
        message: 'Course registration is currently closed',
        session: student.currentSession.name,
        semester: activeSemester.type
      });
    }

    // Check payment eligibility
    const paymentCheck = await checkRequiredPayments(studentId, student.currentSession.id);

    if (!paymentCheck.eligible) {
      return res.json({
        success: true,
        canRegister: false,
        message: 'You must complete required payments before registering courses',
        paymentStatus: paymentCheck,
        session: student.currentSession.name,
        semester: activeSemester.type,
        registrationWindow: {
          startDate: registrationWindow.startDate,
          endDate: registrationWindow.endDate
        }
      });
    }

    return res.json({
      success: true,
      canRegister: true,
      message: 'You are eligible to register courses',
      session: student.currentSession.name,
      semester: activeSemester.type,
      registrationWindow: {
        startDate: registrationWindow.startDate,
        endDate: registrationWindow.endDate
      },
      paymentStatus: paymentCheck
    });

  } catch (error) {
    logger.error('Get registration window status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get registration status'
    });
  }
};

/**
 * Get available courses for registration
 */
export const getAvailableCoursesModern = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;
    const { semester } = req.query;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        department: true,
        currentSession: {
          include: {
            semesters: true
          }
        }
      }
    });

    if (!student || !student.currentSession) {
      return res.status(404).json({
        success: false,
        message: 'Student or session not found'
      });
    }

    // Check payment eligibility first
    const paymentCheck = await checkRequiredPayments(studentId, student.currentSession.id);
    if (!paymentCheck.eligible) {
      return res.status(403).json({
        success: false,
        message: 'Complete required payments to view available courses',
        paymentStatus: paymentCheck
      });
    }

    // Get courses for student's level and department
    const semesterFilter = semester ? parseInt(semester as string) : undefined;
    
    const courses = await prisma.course.findMany({
      where: {
        departmentId: student.departmentId,
        level: student.currentLevel,
        ...(semesterFilter && { semester: semesterFilter })
      },
      include: {
        department: {
          select: { name: true, code: true }
        },
        _count: {
          select: {
            courseRegistrations: {
              where: {
                academicYear: student.currentSession.name
              }
            }
          }
        }
      },
      orderBy: [
        { semester: 'asc' },
        { code: 'asc' }
      ]
    });

    // Get already registered courses
    const registeredCourses = await prisma.courseRegistration.findMany({
      where: {
        studentId,
        sessionId: student.currentSession.id
      },
      select: { courseId: true }
    });

    const registeredIds = new Set(registeredCourses.map(r => r.courseId));

    // All courses are core by default (no isElective field in schema)
    const coreCourses = courses.filter(c => !registeredIds.has(c.id));
    const electiveCourses: typeof courses = []; // Empty since no isElective field
    const alreadyRegistered = courses.filter(c => registeredIds.has(c.id));

    const totalCoreUnits = coreCourses.reduce((sum, c) => sum + c.credits, 0);
    const totalElectiveUnits = electiveCourses.reduce((sum, c) => sum + c.credits, 0);
    const registeredUnits = alreadyRegistered.reduce((sum, c) => sum + c.credits, 0);

    return res.json({
      success: true,
      data: {
        coreCourses,
        electiveCourses,
        registeredCourses: alreadyRegistered,
        summary: {
          totalCoreUnits,
          totalElectiveUnits,
          registeredUnits,
          availableCoreCourses: coreCourses.length,
          availableElectiveCourses: electiveCourses.length,
          registeredCourses: alreadyRegistered.length
        },
        studentInfo: {
          level: student.currentLevel,
          department: student.department.name,
          session: student.currentSession.name
        }
      }
    });

  } catch (error) {
    logger.error('Get available courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch courses'
    });
  }
};

/**
 * Register courses with validation
 */
const registerCoursesSchema = z.object({
  courseIds: z.array(z.number().int().positive()).min(1, 'Select at least one course'),
  semesterId: z.number().int().positive()
});

export const registerCoursesModern = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;
    const data = registerCoursesSchema.parse(req.body);

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        currentSession: {
          include: {
            semesters: true
          }
        },
        department: true
      }
    });

    if (!student || !student.currentSession) {
      return res.status(404).json({
        success: false,
        message: 'Student or session not found'
      });
    }

    // Check payment eligibility
    const paymentCheck = await checkRequiredPayments(studentId, student.currentSession.id);
    if (!paymentCheck.eligible) {
      return res.status(403).json({
        success: false,
        message: 'Complete required payments before registering courses',
        paymentStatus: paymentCheck
      });
    }

    // Check registration window
    const semester = student.currentSession.semesters.find(s => s.id === data.semesterId);
    if (!semester) {
      return res.status(400).json({
        success: false,
        message: 'Invalid semester'
      });
    }

    const registrationWindow = await prisma.registrationWindow.findFirst({
      where: {
        sessionId: student.currentSession.id,
        semesterId: data.semesterId,
        isActive: true,
        startDate: { lte: new Date() },
        endDate: { gte: new Date() }
      }
    });

    if (!registrationWindow) {
      return res.status(400).json({
        success: false,
        message: 'Course registration is not open for this semester'
      });
    }

    // Validate courses
    const courses = await prisma.course.findMany({
      where: {
        id: { in: data.courseIds },
        departmentId: student.departmentId,
        level: student.currentLevel
      }
    });

    if (courses.length !== data.courseIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some courses are invalid or not available for your level'
      });
    }

    // Check for existing registrations
    const existingRegistrations = await prisma.courseRegistration.findMany({
      where: {
        studentId,
        courseId: { in: data.courseIds },
        sessionId: student.currentSession.id
      }
    });

    if (existingRegistrations.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You have already registered some of these courses'
      });
    }

    // Calculate total units
    const totalUnits = courses.reduce((sum, c) => sum + c.credits, 0);
    const maxUnits = 24; // Configurable

    if (totalUnits > maxUnits) {
      return res.status(400).json({
        success: false,
        message: `Total units (${totalUnits}) exceeds maximum allowed (${maxUnits})`
      });
    }

    // Register courses
    const registrations = await prisma.$transaction(
      courses.map(course =>
        prisma.courseRegistration.create({
          data: {
            studentId,
            courseId: course.id,
            sessionId: student.currentSession!.id,
            semesterId: data.semesterId,
            academicYear: student.currentSession!.name,
            semester: course.semester,
            level: student.currentLevel,
            status: 'REGISTERED'
          },
          include: {
            course: {
              include: {
                department: true
              }
            }
          }
        })
      )
    );

    logger.info(`Student ${studentId} registered ${registrations.length} courses`);

    return res.json({
      success: true,
      message: `Successfully registered ${registrations.length} course(s)`,
      data: {
        registrations,
        totalUnits,
        registeredCourses: registrations.length
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors
      });
    }
    logger.error('Register courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register courses'
    });
  }
};

/**
 * Get student's registered courses
 */
export const getMyRegisteredCourses = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { currentSession: true }
    });

    if (!student || !student.currentSession) {
      return res.status(404).json({
        success: false,
        message: 'Student or session not found'
      });
    }

    const registrations = await prisma.courseRegistration.findMany({
      where: {
        studentId,
        sessionId: student.currentSession.id
      },
      include: {
        course: {
          include: {
            department: true
          }
        }
      },
      orderBy: [
        { semester: 'asc' },
        { course: { code: 'asc' } }
      ]
    });

    // Group by semester
    const firstSemester = registrations.filter(r => r.semester === 1);
    const secondSemester = registrations.filter(r => r.semester === 2);

    const firstSemesterUnits = firstSemester.reduce((sum, r) => sum + r.course.credits, 0);
    const secondSemesterUnits = secondSemester.reduce((sum, r) => sum + r.course.credits, 0);

    return res.json({
      success: true,
      data: {
        firstSemester: {
          courses: firstSemester,
          totalUnits: firstSemesterUnits,
          count: firstSemester.length
        },
        secondSemester: {
          courses: secondSemester,
          totalUnits: secondSemesterUnits,
          count: secondSemester.length
        },
        summary: {
          totalCourses: registrations.length,
          totalUnits: firstSemesterUnits + secondSemesterUnits,
          session: student.currentSession.name
        }
      }
    });

  } catch (error) {
    logger.error('Get registered courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch registered courses'
    });
  }
};

/**
 * Drop a course
 */
export const dropCourse = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;
    const { registrationId } = req.params;

    const registration = await prisma.courseRegistration.findFirst({
      where: {
        id: parseInt(registrationId),
        studentId
      },
      include: {
        course: true,
        session: true
      }
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    // Check if dropping is allowed (e.g., within first 2 weeks)
    const registrationDate = new Date(registration.registrationDate);
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    if (registrationDate < twoWeeksAgo) {
      return res.status(400).json({
        success: false,
        message: 'Course drop period has expired (14 days from registration)'
      });
    }

    await prisma.courseRegistration.delete({
      where: { id: parseInt(registrationId) }
    });

    logger.info(`Student ${studentId} dropped course ${registration.course.code}`);

    return res.json({
      success: true,
      message: `Successfully dropped ${registration.course.code}`
    });

  } catch (error) {
    logger.error('Drop course error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to drop course'
    });
  }
};

// ====== ADMIN ENDPOINTS ======

/**
 * Create registration window
 */
const createRegistrationWindowSchema = z.object({
  sessionId: z.number().int().positive(),
  semesterId: z.number().int().positive(),
  startDate: z.string().transform(val => new Date(val)),
  endDate: z.string().transform(val => new Date(val)),
  maxUnits: z.number().int().positive().optional(),
  minUnits: z.number().int().positive().optional()
});

export const createRegistrationWindow = async (req: AuthRequest, res: Response) => {
  try {
    const data = createRegistrationWindowSchema.parse(req.body);

    if (data.endDate <= data.startDate) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    // Check for overlapping windows
    const existing = await prisma.registrationWindow.findFirst({
      where: {
        sessionId: data.sessionId,
        semesterId: data.semesterId,
        OR: [
          {
            AND: [
              { startDate: { lte: data.startDate } },
              { endDate: { gte: data.startDate } }
            ]
          },
          {
            AND: [
              { startDate: { lte: data.endDate } },
              { endDate: { gte: data.endDate } }
            ]
          }
        ]
      }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A registration window already exists for this period'
      });
    }

    const window = await prisma.registrationWindow.create({
      data: {
        sessionId: data.sessionId,
        semesterId: data.semesterId,
        startDate: data.startDate,
        endDate: data.endDate,
        isActive: true
      },
      include: {
        session: true,
        semester: true
      }
    });

    logger.info(`Registration window created for session ${data.sessionId}, semester ${data.semesterId}`);

    return res.json({
      success: true,
      message: 'Registration window created successfully',
      data: window
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors
      });
    }
    logger.error('Create registration window error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create registration window'
    });
  }
};

/**
 * Get all registration windows
 */
export const getRegistrationWindows = async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId, semesterId } = req.query;

    const windows = await prisma.registrationWindow.findMany({
      where: {
        ...(sessionId && { sessionId: parseInt(sessionId as string) }),
        ...(semesterId && { semesterId: parseInt(semesterId as string) })
      },
      include: {
        session: true,
        semester: true
      },
      orderBy: { startDate: 'desc' }
    });

    return res.json({
      success: true,
      data: windows
    });

  } catch (error) {
    logger.error('Get registration windows error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch registration windows'
    });
  }
};

/**
 * Get registration statistics
 */
export const getRegistrationStatistics = async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId, semesterId, departmentId } = req.query;

    const whereClause: any = {};
    if (sessionId) whereClause.sessionId = parseInt(sessionId as string);
    if (semesterId) whereClause.semesterId = parseInt(semesterId as string);

    const registrations = await prisma.courseRegistration.findMany({
      where: whereClause,
      include: {
        student: {
          include: {
            department: true
          }
        },
        course: true
      }
    });

    // Calculate statistics
    const totalRegistrations = registrations.length;
    const uniqueStudents = new Set(registrations.map(r => r.studentId)).size;
    const totalUnits = registrations.reduce((sum, r) => sum + r.course.credits, 0);

    // Group by department
    const byDepartment = registrations.reduce((acc, r) => {
      const deptName = r.student.department.name;
      if (!acc[deptName]) {
        acc[deptName] = { count: 0, students: new Set(), units: 0 };
      }
      acc[deptName].count++;
      acc[deptName].students.add(r.studentId);
      acc[deptName].units += r.course.credits;
      return acc;
    }, {} as Record<string, { count: number; students: Set<number>; units: number }>);

    const departmentStats = Object.entries(byDepartment).map(([name, data]) => ({
      department: name,
      registrations: data.count,
      students: data.students.size,
      totalUnits: data.units
    }));

    // Most registered courses
    const courseCount = registrations.reduce((acc, r) => {
      const key = `${r.course.code}-${r.course.title}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const popularCourses = Object.entries(courseCount)
      .map(([course, count]) => ({ course, registrations: count }))
      .sort((a, b) => b.registrations - a.registrations)
      .slice(0, 10);

    return res.json({
      success: true,
      data: {
        summary: {
          totalRegistrations,
          uniqueStudents,
          totalUnits,
          averageUnitsPerStudent: totalUnits / (uniqueStudents || 1)
        },
        byDepartment: departmentStats,
        popularCourses
      }
    });

  } catch (error) {
    logger.error('Get registration statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics'
    });
  }
};
