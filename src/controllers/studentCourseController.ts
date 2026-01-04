import { Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { StudentAuthRequest } from '../types/express';
import logger from '../config/logger';
import { downloadCourseForm } from '../utils/courseFormPDF';

// Validation schemas
const validateRegistrationSchema = z.object({
  courseIds: z.array(z.number().int().positive()).min(1),
  sessionId: z.number().int().positive(),
  semesterId: z.number().int().positive(),
  level: z.number().int().positive(),
});

const submitRegistrationSchema = z.object({
  courseIds: z.array(z.number().int().positive()).min(1),
  sessionId: z.number().int().positive(),
  semesterId: z.number().int().positive(),
  level: z.number().int().positive(),
});

/**
 * Get available courses for student registration
 */
export const getAvailableCourses = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;
    const { sessionId, semesterId, level } = req.query;

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

    // Build course filter
    const courseWhere: any = {
      departmentId: student.departmentId,
    };

    if (level) {
      courseWhere.level = parseInt(level as string);
    }

    if (semesterId) {
      const semester = await prisma.semester.findUnique({
        where: { id: parseInt(semesterId as string) },
      });
      if (semester) {
        courseWhere.semester = semester.type === 'FIRST' ? 1 : 2;
      }
    }

    // Get available courses
    const courses = await prisma.course.findMany({
      where: courseWhere,
      include: {
        department: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: [
        { level: 'asc' },
        { semester: 'asc' },
        { code: 'asc' },
      ],
    });

    // Get already registered courses
    let registeredCourseIds: number[] = [];
    if (sessionId && semesterId && level) {
      const existingBatch = await prisma.courseRegistrationBatch.findUnique({
        where: {
          studentId_sessionId_semesterId_level: {
            studentId,
            sessionId: parseInt(sessionId as string),
            semesterId: parseInt(semesterId as string),
            level: parseInt(level as string),
          },
        },
        include: {
          courses: {
            select: { courseId: true },
          },
        },
      });

      if (existingBatch) {
        registeredCourseIds = existingBatch.courses.map(item => item.courseId);
      }
    }

    // Format courses for frontend
    const formattedCourses = courses.map(course => ({
      id: course.id,
      code: course.code,
      title: course.title,
      description: course.description,
      credits: course.credits,
      level: course.level,
      semester: course.semester,
      isElective: false, // Add isElective field to Course model if needed
      prerequisites: course.prerequisite,
      isRegistered: registeredCourseIds.includes(course.id),
      department: course.department,
    }));

    res.json({
      success: true,
      data: formattedCourses,
    });
  } catch (error) {
    logger.error('Get available courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available courses',
    });
  }
};

/**
 * Validate course registration before submission
 */
export const validateRegistration = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;
    const data = validateRegistrationSchema.parse(req.body);

    // Get courses with full details
    const courses = await prisma.course.findMany({
      where: { id: { in: data.courseIds } },
      include: {
        department: true,
      },
    });

    if (courses.length !== data.courseIds.length) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Some courses not found',
        errors: ['One or more selected courses are invalid'],
      });
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const missingPrerequisites: any[] = [];

    // Calculate total units
    const totalUnits = courses.reduce((sum, course) => sum + course.credits, 0);

    // Validate total units (10-24)
    if (totalUnits < 10) {
      errors.push(`Total units (${totalUnits}) is below minimum required (10)`);
    }
    if (totalUnits > 24) {
      errors.push(`Total units (${totalUnits}) exceeds maximum allowed (24)`);
    }

    // Check for duplicate courses
    const uniqueCourseIds = new Set(data.courseIds);
    if (uniqueCourseIds.size !== data.courseIds.length) {
      errors.push('Duplicate courses selected');
    }

    // Validate student's department matches course departments
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        valid: false,
        message: 'Student not found',
      });
    }

    const invalidDeptCourses = courses.filter(c => c.departmentId !== student.departmentId);
    if (invalidDeptCourses.length > 0) {
      errors.push(`Some courses are not from your department: ${invalidDeptCourses.map(c => c.code).join(', ')}`);
    }

    // Check prerequisites
    const registeredCourses = await prisma.courseRegistration.findMany({
      where: {
        studentId,
        status: 'REGISTERED',
      },
      select: {
        courseId: true,
      },
    });

    const passedCourseIds = new Set(registeredCourses.map(r => r.courseId));

    for (const course of courses) {
      if (course.prerequisite) {
        const prereqs = parsePrerequisites(course.prerequisite);
        const missingPrereqs = prereqs.filter(p => !passedCourseIds.has(p));
        
        if (missingPrereqs.length > 0) {
          const prereqCodes = await prisma.course.findMany({
            where: { id: { in: missingPrereqs } },
            select: { code: true, title: true },
          });
          
          missingPrerequisites.push({
            courseCode: course.code,
            courseTitle: course.title,
            prerequisites: prereqCodes,
          });
          
          warnings.push(`${course.code} requires: ${prereqCodes.map(p => p.code).join(', ')}`);
        }
      }
    }

    // Check if already registered for this session/semester/level
    const existingBatch = await prisma.courseRegistrationBatch.findUnique({
      where: {
        studentId_sessionId_semesterId_level: {
          studentId,
          sessionId: data.sessionId,
          semesterId: data.semesterId,
          level: data.level,
        },
      },
    });

    if (existingBatch && existingBatch.status === 'APPROVED') {
      errors.push('You have already registered and been approved for this session/semester/level');
    } else if (existingBatch && existingBatch.status === 'PENDING') {
      warnings.push('You have a pending registration. Submitting again will replace it.');
    }

    const isValid = errors.length === 0;

    res.json({
      success: true,
      valid: isValid,
      totalUnits,
      errors,
      warnings,
      missingPrerequisites,
      message: isValid ? 'Registration is valid' : 'Validation failed',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Invalid request data',
        errors: error.errors.map(e => e.message),
      });
    }

    logger.error('Validate registration error:', error);
    res.status(500).json({
      success: false,
      valid: false,
      message: 'Failed to validate registration',
    });
  }
};

/**
 * Submit course registration
 */
export const submitRegistration = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;
    const data = submitRegistrationSchema.parse(req.body);

    // Validate session exists
    const session = await prisma.session.findUnique({
      where: { id: data.sessionId },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
      });
    }

    // Validate semester exists
    const semester = await prisma.semester.findUnique({
      where: { id: data.semesterId },
    });

    if (!semester) {
      return res.status(404).json({
        success: false,
        message: 'Semester not found',
      });
    }

    // Validate semester belongs to the session
    if (semester.sessionId !== data.sessionId) {
      return res.status(400).json({
        success: false,
        message: `Semester does not belong to the selected session. This semester belongs to session ID ${semester.sessionId}`,
      });
    }

    // Get courses
    const courses = await prisma.course.findMany({
      where: { id: { in: data.courseIds } },
    });

    if (courses.length !== data.courseIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some courses not found',
      });
    }

    // Calculate total units
    const totalUnits = courses.reduce((sum, course) => sum + course.credits, 0);

    // Validate units
    if (totalUnits < 10 || totalUnits > 24) {
      return res.status(400).json({
        success: false,
        message: `Total units must be between 10 and 24. Current: ${totalUnits}`,
      });
    }

    // Check for existing batch
    const existingBatch = await prisma.courseRegistrationBatch.findUnique({
      where: {
        studentId_sessionId_semesterId_level: {
          studentId,
          sessionId: data.sessionId,
          semesterId: data.semesterId,
          level: data.level,
        },
      },
    });

    // Don't allow if already approved
    if (existingBatch && existingBatch.status === 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: 'You have already been approved for this registration period',
      });
    }

    // Use transaction to create or update batch
    const batch = await prisma.$transaction(async (tx) => {
      // Delete existing batch if present
      if (existingBatch) {
        await tx.courseRegistrationBatchItem.deleteMany({
          where: { batchId: existingBatch.id },
        });
        await tx.courseRegistrationBatch.delete({
          where: { id: existingBatch.id },
        });
      }

      // Create new batch
      const newBatch = await tx.courseRegistrationBatch.create({
        data: {
          studentId,
          sessionId: data.sessionId,
          semesterId: data.semesterId,
          level: data.level,
          totalUnits,
          status: 'PENDING',
          submittedAt: new Date(),
          courses: {
            create: data.courseIds.map(courseId => ({ courseId })),
          },
        },
        include: {
          courses: {
            include: {
              course: true,
            },
          },
          session: true,
          semester: true,
          student: {
            include: {
              department: true,
            },
          },
        },
      });

      return newBatch;
    });

    logger.info(`Course registration submitted for student ${studentId}`);

    res.json({
      success: true,
      message: 'Registration submitted successfully',
      data: batch,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: error.errors.map(e => e.message),
      });
    }

    logger.error('Submit registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit registration',
    });
  }
};

/**
 * Get student's registration history
 */
export const getMyRegistrations = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [batches, total] = await Promise.all([
      prisma.courseRegistrationBatch.findMany({
        where: { studentId },
        include: {
          courses: {
            include: {
              course: true,
            },
          },
          session: true,
          semester: true,
        },
        orderBy: { submittedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.courseRegistrationBatch.count({ where: { studentId } }),
    ]);

    res.json({
      success: true,
      data: batches,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Get my registrations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch registration history',
    });
  }
};

/**
 * Get specific registration details
 */
export const getRegistrationDetails = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;
    const batchId = parseInt(req.params.id);

    const batch = await prisma.courseRegistrationBatch.findFirst({
      where: {
        id: batchId,
        studentId,
      },
      include: {
        courses: {
          include: {
            course: {
              include: {
                department: true,
              },
            },
          },
        },
        session: true,
        semester: true,
        student: {
          include: {
            department: true,
          },
        },
      },
    });

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found',
      });
    }

    res.json({
      success: true,
      data: batch,
    });
  } catch (error) {
    logger.error('Get registration details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch registration details',
    });
  }
};

/**
 * Download course form as PDF
 */
export const downloadRegistrationForm = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;
    const batchId = parseInt(req.params.id);

    await downloadCourseForm(batchId, studentId, res);
  } catch (error) {
    logger.error('Download registration form error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to download course form',
      });
    }
  }
};

/**
 * Helper function to parse prerequisites
 */
function parsePrerequisites(prerequisites: string | null): number[] {
  if (!prerequisites) return [];
  
  try {
    // Assuming prerequisites is stored as comma-separated IDs or JSON
    const parsed = JSON.parse(prerequisites);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // If not JSON, try comma-separated
    return prerequisites.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
  }
}
