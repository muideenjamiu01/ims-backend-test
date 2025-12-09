import { Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { StudentAuthRequest } from '../middleware/studentAuth';
import logger from '../config/logger';
import path from 'path';
import fs from 'fs';

// Validation schemas
const getAssignmentsSchema = z.object({
  courseId: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  sessionId: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  status: z.enum(['pending', 'submitted', 'graded', 'late']).optional(),
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 10),
});

const submitAssignmentSchema = z.object({
  assignmentId: z.number().int().positive(),
  remarks: z.string().optional(),
});

/**
 * Get assignments for student
 */
export const getAssignments = async (req: StudentAuthRequest, res: Response) => {
  try {
    const validation = getAssignmentsSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validation.error.errors,
      });
    }

    const { courseId, sessionId, status, page, limit } = validation.data;
    const studentId = req.student!.id;
    const skip = (page - 1) * limit;

    // Get student's registered courses
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        currentSession: true,
        courseRegistrations: {
          where: sessionId
            ? { academicYear: (await prisma.session.findUnique({ where: { id: sessionId } }))?.name }
            : undefined,
          select: { courseId: true },
        },
      },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    const registeredCourseIds = student.courseRegistrations.map(r => r.courseId);

    if (registeredCourseIds.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No registered courses found',
        data: {
          assignments: [],
          pagination: {
            total: 0,
            page,
            limit,
            totalPages: 0,
          },
        },
      });
    }

    // Build filter
    const where: any = {
      courseId: { in: registeredCourseIds },
    };

    if (courseId) where.courseId = courseId;
    if (sessionId) where.sessionId = sessionId;

    // Get assignments
    const [assignments, total] = await Promise.all([
      prisma.assignment.findMany({
        where,
        include: {
          course: {
            select: {
              code: true,
              title: true,
            },
          },
          session: {
            select: { name: true },
          },
          semester: {
            select: { type: true },
          },
          submissions: {
            where: { studentId },
            select: {
              id: true,
              status: true,
              score: true,
              submittedAt: true,
              gradedAt: true,
              remarks: true,
            },
          },
        },
        orderBy: {
          dueDate: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.assignment.count({ where }),
    ]);

    // Check if assignments are late and format response
    const now = new Date();
    const formattedAssignments = assignments.map(assignment => {
      const submission = assignment.submissions[0];
      const isLate = !submission && assignment.dueDate < now;
      const daysUntilDue = Math.ceil(
        (assignment.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        course: {
          code: assignment.course.code,
          title: assignment.course.title,
        },
        session: assignment.session.name,
        semester: assignment.semester.type,
        dueDate: assignment.dueDate,
        maxScore: assignment.maxScore,
        fileUrl: assignment.fileUrl,
        createdBy: assignment.createdBy,
        isLate,
        daysUntilDue,
        submission: submission
          ? {
              id: submission.id,
              status: submission.status,
              score: submission.score,
              submittedAt: submission.submittedAt,
              gradedAt: submission.gradedAt,
              remarks: submission.remarks,
            }
          : null,
      };
    });

    // Filter by status if provided
    let filteredAssignments = formattedAssignments;
    if (status) {
      filteredAssignments = formattedAssignments.filter(a => {
        if (status === 'pending') return !a.submission;
        if (status === 'late') return a.isLate;
        return a.submission?.status.toLowerCase() === status;
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        assignments: filteredAssignments,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: any) {
    logger.error('Error in getAssignments:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch assignments',
      error: error.message,
    });
  }
};

/**
 * Get assignment by ID with details
 */
export const getAssignmentById = async (req: StudentAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const studentId = req.student!.id;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Assignment ID is required',
      });
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id: parseInt(id) },
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
        semester: {
          select: { type: true },
        },
        submissions: {
          where: { studentId },
        },
      },
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found',
      });
    }

    // Check if student is registered for the course
    const registration = await prisma.courseRegistration.findFirst({
      where: {
        studentId,
        courseId: assignment.courseId,
      },
    });

    if (!registration) {
      return res.status(403).json({
        success: false,
        message: 'You are not registered for this course',
      });
    }

    const now = new Date();
    const isLate = !assignment.submissions[0] && assignment.dueDate < now;
    const daysUntilDue = Math.ceil(
      (assignment.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    return res.status(200).json({
      success: true,
      data: {
        ...assignment,
        isLate,
        daysUntilDue,
        submission: assignment.submissions[0] || null,
      },
    });
  } catch (error: any) {
    logger.error('Error in getAssignmentById:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch assignment',
      error: error.message,
    });
  }
};

/**
 * Submit assignment
 */
export const submitAssignment = async (req: StudentAuthRequest, res: Response) => {
  try {
    const validation = submitAssignmentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validation.error.errors,
      });
    }

    const { assignmentId, remarks } = validation.data;
    const studentId = req.student!.id;

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Assignment file is required',
      });
    }

    // Get assignment details
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        course: {
          select: {
            code: true,
            title: true,
          },
        },
      },
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found',
      });
    }

    // Check if student is registered for the course
    const registration = await prisma.courseRegistration.findFirst({
      where: {
        studentId,
        courseId: assignment.courseId,
      },
    });

    if (!registration) {
      return res.status(403).json({
        success: false,
        message: 'You are not registered for this course',
      });
    }

    // Check if already submitted
    const existingSubmission = await prisma.assignmentSubmission.findUnique({
      where: {
        assignmentId_studentId: {
          assignmentId,
          studentId,
        },
      },
    });

    if (existingSubmission) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted this assignment',
      });
    }

    // Check if late submission
    const now = new Date();
    const isLate = now > assignment.dueDate;
    const status = isLate ? 'LATE' : 'SUBMITTED';

    // Create submission
    const fileUrl = `/uploads/assignments/${req.file.filename}`;

    const submission = await prisma.assignmentSubmission.create({
      data: {
        assignmentId,
        studentId,
        fileUrl,
        remarks,
        status,
      },
      include: {
        assignment: {
          select: {
            title: true,
            course: {
              select: {
                code: true,
                title: true,
              },
            },
          },
        },
      },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        studentId,
        title: 'Assignment Submitted',
        message: `Your submission for "${submission.assignment.title}" (${submission.assignment.course.code}) has been received.${isLate ? ' Note: This is a late submission.' : ''}`,
        type: isLate ? 'WARNING' : 'SUCCESS',
      },
    });

    logger.info(`Student ${studentId} submitted assignment ${assignmentId}`);

    return res.status(201).json({
      success: true,
      message: `Assignment submitted successfully${isLate ? ' (Late submission)' : ''}`,
      data: {
        id: submission.id,
        assignmentId: submission.assignmentId,
        fileUrl: submission.fileUrl,
        status: submission.status,
        submittedAt: submission.submittedAt,
        isLate,
      },
    });
  } catch (error: any) {
    logger.error('Error in submitAssignment:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit assignment',
      error: error.message,
    });
  }
};

/**
 * Get student's submission for an assignment
 */
export const getSubmission = async (req: StudentAuthRequest, res: Response) => {
  try {
    const { assignmentId } = req.params;
    const studentId = req.student!.id;

    if (!assignmentId) {
      return res.status(400).json({
        success: false,
        message: 'Assignment ID is required',
      });
    }

    const submission = await prisma.assignmentSubmission.findUnique({
      where: {
        assignmentId_studentId: {
          assignmentId: parseInt(assignmentId),
          studentId,
        },
      },
      include: {
        assignment: {
          select: {
            title: true,
            description: true,
            maxScore: true,
            dueDate: true,
            course: {
              select: {
                code: true,
                title: true,
              },
            },
          },
        },
      },
    });

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: submission,
    });
  } catch (error: any) {
    logger.error('Error in getSubmission:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch submission',
      error: error.message,
    });
  }
};

/**
 * Get all submissions by student
 */
export const getMySubmissions = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;
    const { page = '1', limit = '10', status } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const where: any = { studentId };
    if (status) {
      where.status = (status as string).toUpperCase();
    }

    const [submissions, total] = await Promise.all([
      prisma.assignmentSubmission.findMany({
        where,
        include: {
          assignment: {
            select: {
              title: true,
              maxScore: true,
              dueDate: true,
              course: {
                select: {
                  code: true,
                  title: true,
                },
              },
              session: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: {
          submittedAt: 'desc',
        },
        skip,
        take: limitNum,
      }),
      prisma.assignmentSubmission.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        submissions: submissions.map(s => ({
          id: s.id,
          assignmentTitle: s.assignment.title,
          course: s.assignment.course,
          session: s.assignment.session.name,
          dueDate: s.assignment.dueDate,
          submittedAt: s.submittedAt,
          status: s.status,
          score: s.score,
          maxScore: s.assignment.maxScore,
          percentage: s.score ? ((s.score / s.assignment.maxScore) * 100).toFixed(1) : null,
          gradedAt: s.gradedAt,
          gradedBy: s.gradedBy,
          remarks: s.remarks,
          fileUrl: s.fileUrl,
        })),
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
        summary: {
          total,
          graded: submissions.filter(s => s.status === 'GRADED').length,
          pending: submissions.filter(s => s.status === 'SUBMITTED' || s.status === 'PENDING').length,
          late: submissions.filter(s => s.status === 'LATE').length,
        },
      },
    });
  } catch (error: any) {
    logger.error('Error in getMySubmissions:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch submissions',
      error: error.message,
    });
  }
};

/**
 * Download assignment file
 */
export const downloadAssignmentFile = async (req: StudentAuthRequest, res: Response) => {
  try {
    const { assignmentId } = req.params;
    const studentId = req.student!.id;

    if (!assignmentId) {
      return res.status(400).json({
        success: false,
        message: 'Assignment ID is required',
      });
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id: parseInt(assignmentId) },
      select: {
        fileUrl: true,
        title: true,
        courseId: true,
      },
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found',
      });
    }

    if (!assignment.fileUrl) {
      return res.status(404).json({
        success: false,
        message: 'No file attached to this assignment',
      });
    }

    // Check if student is registered for the course
    const registration = await prisma.courseRegistration.findFirst({
      where: {
        studentId,
        courseId: assignment.courseId,
      },
    });

    if (!registration) {
      return res.status(403).json({
        success: false,
        message: 'You are not registered for this course',
      });
    }

    const filePath = path.join(process.cwd(), assignment.fileUrl);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Assignment file not found on server',
      });
    }

    const fileName = path.basename(filePath);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error: any) {
    logger.error('Error in downloadAssignmentFile:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to download assignment file',
      error: error.message,
    });
  }
};

/**
 * Download submission file
 */
export const downloadSubmissionFile = async (req: StudentAuthRequest, res: Response) => {
  try {
    const { submissionId } = req.params;
    const studentId = req.student!.id;

    if (!submissionId) {
      return res.status(400).json({
        success: false,
        message: 'Submission ID is required',
      });
    }

    const submission = await prisma.assignmentSubmission.findUnique({
      where: { id: parseInt(submissionId) },
      select: {
        fileUrl: true,
        studentId: true,
      },
    });

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found',
      });
    }

    // Check if this is the student's own submission
    if (submission.studentId !== studentId) {
      return res.status(403).json({
        success: false,
        message: 'You can only download your own submissions',
      });
    }

    const filePath = path.join(process.cwd(), submission.fileUrl);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Submission file not found on server',
      });
    }

    const fileName = path.basename(filePath);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error: any) {
    logger.error('Error in downloadSubmissionFile:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to download submission file',
      error: error.message,
    });
  }
};
