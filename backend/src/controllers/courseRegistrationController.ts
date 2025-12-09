import { Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { StudentAuthRequest } from '../middleware/studentAuth';
import logger from '../config/logger';
import { parsePrerequisites, getCurrentSession } from '../utils/helpers';

// Validation schemas
const registerCoursesSchema = z.object({
  courseIds: z.array(z.number().int().positive()).min(1, 'At least one course is required'),
  sessionId: z.number().int().positive(),
  semesterId: z.number().int().positive(),
});

const dropCourseSchema = z.object({
  registrationId: z.number().int().positive(),
});

const getCourseHistorySchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 20),
});

/**
 * Get available courses for registration
 */
export const getAvailableCourses = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;

    // Get student details with current level
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        department: true,
        currentSession: {
          include: {
            semesters: {
              where: { isActive: true },
              orderBy: { type: 'asc' },
            },
          },
        },
      },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    // Get active semester
    const activeSemester = student.currentSession?.semesters[0];
    if (!activeSemester) {
      return res.status(400).json({
        success: false,
        message: 'No active semester found. Please contact administration.',
      });
    }

    // Get courses for student's level and department
    const availableCourses = await prisma.course.findMany({
      where: {
        departmentId: student.departmentId,
        level: student.currentLevel,
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

    // Get already registered courses for current session
    const registeredCourses = await prisma.courseRegistration.findMany({
      where: {
        studentId,
        academicYear: student.currentSession!.name,
      },
      select: { courseId: true },
    });

    const registeredCourseIds = new Set(registeredCourses.map(r => r.courseId));

    // Filter out already registered courses and check prerequisites
    const coursesWithEligibility = await Promise.all(
      availableCourses.map(async (course) => {
        const isRegistered = registeredCourseIds.has(course.id);
        let isEligible = true;
        let prerequisiteMessage = '';

        // Check prerequisites
        if (course.prerequisite) {
          const prerequisiteCodes = parsePrerequisites(course.prerequisite);
          
          // Get prerequisite courses
          const prerequisiteCourses = await prisma.course.findMany({
            where: {
              code: { in: prerequisiteCodes },
            },
            select: { id: true, code: true, title: true },
          });

          // Check if student has passed all prerequisites
          const passedResults = await prisma.result.findMany({
            where: {
              studentId,
              courseId: { in: prerequisiteCourses.map(c => c.id) },
              grade: { in: ['A', 'B', 'C', 'D', 'E'] }, // F is fail
            },
            select: { courseId: true },
          });

          const passedCourseIds = new Set(passedResults.map(r => r.courseId));
          const failedPrerequisites = prerequisiteCourses.filter(
            c => !passedCourseIds.has(c.id)
          );

          if (failedPrerequisites.length > 0) {
            isEligible = false;
            prerequisiteMessage = `Must pass: ${failedPrerequisites
              .map(c => c.code)
              .join(', ')}`;
          }
        }

        return {
          ...course,
          isRegistered,
          isEligible,
          prerequisiteMessage,
        };
      })
    );

    // Calculate total credits
    const totalCredits = coursesWithEligibility
      .filter(c => c.isRegistered)
      .reduce((sum, c) => sum + c.credits, 0);

    return res.status(200).json({
      success: true,
      data: {
        courses: coursesWithEligibility,
        student: {
          matricNo: student.matricNo,
          name: `${student.firstName} ${student.lastName}`,
          level: student.currentLevel,
          department: student.department.name,
        },
        session: student.currentSession,
        semester: activeSemester,
        totalCreditsRegistered: totalCredits,
      },
    });
  } catch (error: any) {
    logger.error('Error in getAvailableCourses:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch available courses',
      error: error.message,
    });
  }
};

/**
 * Register for courses
 */
export const registerCourses = async (req: StudentAuthRequest, res: Response) => {
  try {
    const validation = registerCoursesSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validation.error.errors,
      });
    }

    const { courseIds, sessionId, semesterId } = validation.data;
    const studentId = req.student!.id;

    // Get student details
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        currentSession: true,
      },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    // Check if session is active
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        semesters: {
          where: { id: semesterId },
        },
      },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
      });
    }

    const semester = session.semesters[0];
    if (!semester) {
      return res.status(404).json({
        success: false,
        message: 'Semester not found',
      });
    }

    if (!semester.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Course registration is not currently open for this semester',
      });
    }

    // Check for outstanding payments
    const unpaidInvoices = await prisma.invoice.findMany({
      where: {
        studentId,
        status: { in: ['PENDING', 'PARTIALLY_PAID'] },
        balance: { gt: 0 },
      },
      select: {
        invoiceNo: true,
        type: true,
        balance: true,
      },
    });

    if (unpaidInvoices.length > 0) {
      return res.status(402).json({
        success: false,
        message: 'You have outstanding payments. Please clear your fees before registering for courses.',
        unpaidInvoices,
      });
    }

    // Get courses with prerequisites
    const courses = await prisma.course.findMany({
      where: {
        id: { in: courseIds },
        departmentId: student.departmentId,
        level: student.currentLevel,
      },
      include: {
        department: true,
      },
    });

    if (courses.length !== courseIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some courses are not valid for your department or level',
      });
    }

    // Check prerequisites for each course
    const prerequisiteErrors: string[] = [];
    for (const course of courses) {
      if (course.prerequisite) {
        const prerequisiteCodes = parsePrerequisites(course.prerequisite);
        
        const prerequisiteCourses = await prisma.course.findMany({
          where: { code: { in: prerequisiteCodes } },
          select: { id: true, code: true },
        });

        const passedResults = await prisma.result.findMany({
          where: {
            studentId,
            courseId: { in: prerequisiteCourses.map(c => c.id) },
            grade: { in: ['A', 'B', 'C', 'D', 'E'] },
          },
          select: { courseId: true },
        });

        const passedCourseIds = new Set(passedResults.map(r => r.courseId));
        const failedPrerequisites = prerequisiteCourses.filter(
          c => !passedCourseIds.has(c.id)
        );

        if (failedPrerequisites.length > 0) {
          prerequisiteErrors.push(
            `${course.code}: Must pass ${failedPrerequisites.map(c => c.code).join(', ')}`
          );
        }
      }
    }

    if (prerequisiteErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Prerequisite requirements not met',
        errors: prerequisiteErrors,
      });
    }

    // Check for duplicate registrations
    const existingRegistrations = await prisma.courseRegistration.findMany({
      where: {
        studentId,
        courseId: { in: courseIds },
        academicYear: session.name,
      },
      include: {
        course: {
          select: { code: true, title: true },
        },
      },
    });

    if (existingRegistrations.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You have already registered for some of these courses',
        duplicates: existingRegistrations.map(r => ({
          code: r.course.code,
          title: r.course.title,
        })),
      });
    }

    // Register courses in transaction
    const registrations = await prisma.$transaction(
      courseIds.map(courseId =>
        prisma.courseRegistration.create({
          data: {
            studentId,
            courseId,
            semesterId,
            academicYear: session.name,
            semester: semester.type === 'FIRST' ? 1 : 2,
            isCarryOver: false,
          },
          include: {
            course: {
              select: {
                code: true,
                title: true,
                credits: true,
              },
            },
          },
        })
      )
    );

    // Calculate total credits
    const totalCredits = registrations.reduce((sum, r) => sum + r.course.credits, 0);

    // Create notification
    await prisma.notification.create({
      data: {
        studentId,
        title: 'Course Registration Successful',
        message: `You have successfully registered for ${registrations.length} course(s) totaling ${totalCredits} credits for ${session.name} ${semester.type} Semester.`,
        type: 'SUCCESS',
      },
    });

    logger.info(`Student ${student.matricNo} registered for ${registrations.length} courses`);

    return res.status(201).json({
      success: true,
      message: 'Courses registered successfully',
      data: {
        registrations: registrations.map(r => ({
          id: r.id,
          code: r.course.code,
          title: r.course.title,
          credits: r.course.credits,
          registrationDate: r.registrationDate,
        })),
        totalCredits,
        session: session.name,
        semester: semester.type,
      },
    });
  } catch (error: any) {
    logger.error('Error in registerCourses:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to register courses',
      error: error.message,
    });
  }
};

/**
 * Get registered courses for current session
 */
export const getRegisteredCourses = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { currentSession: true },
    });

    if (!student || !student.currentSession) {
      return res.status(404).json({
        success: false,
        message: 'Student or active session not found',
      });
    }

    const registrations = await prisma.courseRegistration.findMany({
      where: {
        studentId,
        academicYear: student.currentSession.name,
      },
      include: {
        course: {
          select: {
            code: true,
            title: true,
            credits: true,
            level: true,
            semester: true,
          },
        },
        semesterRecord: {
          select: {
            type: true,
          },
        },
      },
      orderBy: [
        { semester: 'asc' },
        { course: { code: 'asc' } },
      ],
    });

    // Group by semester
    const firstSemester = registrations.filter(r => r.semester === 1);
    const secondSemester = registrations.filter(r => r.semester === 2);

    const calculateCredits = (regs: typeof registrations) =>
      regs.reduce((sum, r) => sum + r.course.credits, 0);

    return res.status(200).json({
      success: true,
      data: {
        session: student.currentSession.name,
        firstSemester: {
          courses: firstSemester.map(r => ({
            id: r.id,
            code: r.course.code,
            title: r.course.title,
            credits: r.course.credits,
            isCarryOver: r.isCarryOver,
            registrationDate: r.registrationDate,
          })),
          totalCredits: calculateCredits(firstSemester),
        },
        secondSemester: {
          courses: secondSemester.map(r => ({
            id: r.id,
            code: r.course.code,
            title: r.course.title,
            credits: r.course.credits,
            isCarryOver: r.isCarryOver,
            registrationDate: r.registrationDate,
          })),
          totalCredits: calculateCredits(secondSemester),
        },
        totalCredits: calculateCredits(registrations),
      },
    });
  } catch (error: any) {
    logger.error('Error in getRegisteredCourses:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch registered courses',
      error: error.message,
    });
  }
};

/**
 * Register for carry-over courses
 */
export const registerCarryOverCourses = async (req: StudentAuthRequest, res: Response) => {
  try {
    const validation = registerCoursesSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validation.error.errors,
      });
    }

    const { courseIds, sessionId, semesterId } = validation.data;
    const studentId = req.student!.id;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    // Get failed courses that need to be carried over
    const failedResults = await prisma.result.findMany({
      where: {
        studentId,
        courseId: { in: courseIds },
        grade: 'F',
      },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            title: true,
            credits: true,
          },
        },
      },
    });

    if (failedResults.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No failed courses found for the selected course IDs',
      });
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        semesters: { where: { id: semesterId } },
      },
    });

    if (!session || session.semesters.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Session or semester not found',
      });
    }

    const semester = session.semesters[0];

    // Register carry-over courses
    const registrations = await prisma.$transaction(
      failedResults.map(result =>
        prisma.courseRegistration.create({
          data: {
            studentId,
            courseId: result.courseId,
            semesterId,
            academicYear: session.name,
            semester: semester.type === 'FIRST' ? 1 : 2,
            isCarryOver: true,
          },
          include: {
            course: {
              select: {
                code: true,
                title: true,
                credits: true,
              },
            },
          },
        })
      )
    );

    const totalCredits = registrations.reduce((sum, r) => sum + r.course.credits, 0);

    await prisma.notification.create({
      data: {
        studentId,
        title: 'Carry-Over Registration Successful',
        message: `You have registered for ${registrations.length} carry-over course(s) totaling ${totalCredits} credits.`,
        type: 'INFO',
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Carry-over courses registered successfully',
      data: {
        registrations: registrations.map(r => ({
          id: r.id,
          code: r.course.code,
          title: r.course.title,
          credits: r.course.credits,
          isCarryOver: true,
        })),
        totalCredits,
      },
    });
  } catch (error: any) {
    logger.error('Error in registerCarryOverCourses:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to register carry-over courses',
      error: error.message,
    });
  }
};

/**
 * Drop a registered course
 */
export const dropCourse = async (req: StudentAuthRequest, res: Response) => {
  try {
    const validation = dropCourseSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validation.error.errors,
      });
    }

    const { registrationId } = validation.data;
    const studentId = req.student!.id;

    // Check if registration exists and belongs to student
    const registration = await prisma.courseRegistration.findUnique({
      where: { id: registrationId },
      include: {
        course: {
          select: { code: true, title: true },
        },
        semesterRecord: {
          select: { endDate: true, isActive: true },
        },
      },
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Course registration not found',
      });
    }

    if (registration.studentId !== studentId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to drop this course',
      });
    }

    // Check if semester is still active (can only drop during active semester)
    if (!registration.semesterRecord?.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cannot drop course. The semester is no longer active.',
      });
    }

    // Check if it's not too late to drop (e.g., within first 4 weeks)
    const daysSinceRegistration = Math.floor(
      (Date.now() - registration.registrationDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceRegistration > 28) {
      return res.status(400).json({
        success: false,
        message: 'Drop period has expired. You can only drop courses within 4 weeks of registration.',
      });
    }

    // Delete the registration
    await prisma.courseRegistration.delete({
      where: { id: registrationId },
    });

    await prisma.notification.create({
      data: {
        studentId,
        title: 'Course Dropped',
        message: `You have successfully dropped ${registration.course.code} - ${registration.course.title}`,
        type: 'INFO',
      },
    });

    logger.info(`Student ${studentId} dropped course ${registration.course.code}`);

    return res.status(200).json({
      success: true,
      message: 'Course dropped successfully',
      data: {
        course: {
          code: registration.course.code,
          title: registration.course.title,
        },
      },
    });
  } catch (error: any) {
    logger.error('Error in dropCourse:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to drop course',
      error: error.message,
    });
  }
};

/**
 * Get course registration history
 */
export const getCourseRegistrationHistory = async (req: StudentAuthRequest, res: Response) => {
  try {
    const validation = getCourseHistorySchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validation.error.errors,
      });
    }

    const { page, limit } = validation.data;
    const studentId = req.student!.id;
    const skip = (page - 1) * limit;

    // Get all registrations grouped by session
    const registrations = await prisma.courseRegistration.findMany({
      where: { studentId },
      include: {
        course: {
          select: {
            code: true,
            title: true,
            credits: true,
            level: true,
          },
        },
        semesterRecord: {
          select: {
            type: true,
            session: {
              select: {
                name: true,
                startDate: true,
                endDate: true,
              },
            },
          },
        },
      },
      orderBy: [
        { academicYear: 'desc' },
        { semester: 'asc' },
        { course: { code: 'asc' } },
      ],
      skip,
      take: limit,
    });

    const total = await prisma.courseRegistration.count({
      where: { studentId },
    });

    // Group by academic year and semester
    const groupedHistory: Record<string, any> = {};

    registrations.forEach(reg => {
      const key = `${reg.academicYear}_${reg.semester}`;
      
      if (!groupedHistory[key]) {
        groupedHistory[key] = {
          academicYear: reg.academicYear,
          semester: reg.semester,
          semesterType: reg.semesterRecord?.type || (reg.semester === 1 ? 'FIRST' : 'SECOND'),
          courses: [],
          totalCredits: 0,
        };
      }

      groupedHistory[key].courses.push({
        id: reg.id,
        code: reg.course.code,
        title: reg.course.title,
        credits: reg.course.credits,
        level: reg.course.level,
        isCarryOver: reg.isCarryOver,
        registrationDate: reg.registrationDate,
      });

      groupedHistory[key].totalCredits += reg.course.credits;
    });

    const history = Object.values(groupedHistory);

    return res.status(200).json({
      success: true,
      data: {
        history,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: any) {
    logger.error('Error in getCourseRegistrationHistory:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch course registration history',
      error: error.message,
    });
  }
};
