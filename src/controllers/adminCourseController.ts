import { Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';
import logger from '../config/logger';
import * as ExcelJS from 'exceljs';

// Validation schemas
const approveRegistrationSchema = z.object({
  comments: z.string().optional(),
});

const rejectRegistrationSchema = z.object({
  comments: z.string().min(1, 'Comments are required when rejecting'),
});

const returnRegistrationSchema = z.object({
  comments: z.string().min(1, 'Comments are required when returning'),
});

/**
 * Get all course registrations (Admin)
 */
export const getAllRegistrations = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const sessionId = req.query.sessionId as string;
    const semesterId = req.query.semesterId as string;
    const level = req.query.level as string;
    const departmentId = req.query.departmentId as string;
    const search = req.query.search as string;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (sessionId) {
      where.sessionId = parseInt(sessionId);
    }

    if (semesterId) {
      where.semesterId = parseInt(semesterId);
    }

    if (level) {
      where.level = parseInt(level);
    }

    if (departmentId || search) {
      where.student = {};
      if (departmentId) {
        where.student.departmentId = parseInt(departmentId);
      }
      if (search) {
        where.student.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { matricNo: { contains: search, mode: 'insensitive' } },
        ];
      }
    }

    const [batches, total] = await Promise.all([
      prisma.courseRegistrationBatch.findMany({
        where,
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
          },
        },
        orderBy: { submittedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.courseRegistrationBatch.count({ where }),
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
    logger.error('Get all registrations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch registrations',
    });
  }
};

/**
 * Approve a course registration
 */
export const approveRegistration = async (req: AuthRequest, res: Response) => {
  try {
    const batchId = parseInt(req.params.id);
    const userId = req.user!.id;
    const data = approveRegistrationSchema.parse(req.body);

    const batch = await prisma.courseRegistrationBatch.findUnique({
      where: { id: batchId },
      include: {
        courses: {
          include: {
            course: true,
          },
        },
        student: true,
        session: true,
        semester: true,
      },
    });

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found',
      });
    }

    if (batch.status === 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: 'Registration is already approved',
      });
    }

    // Use transaction to update batch and create individual registrations
    const updatedBatch = await prisma.$transaction(async (tx) => {
      // Update batch status
      const updated = await tx.courseRegistrationBatch.update({
        where: { id: batchId },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedBy: userId.toString(),
          comments: data.comments,
        },
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
          },
        },
      });

      // Create individual course registrations
      await tx.courseRegistration.createMany({
        data: batch.courses.map(item => ({
          studentId: batch.studentId,
          courseId: item.courseId,
          registrationDate: new Date(),
          academicYear: batch.session.name,
          semester: batch.semester.type === 'FIRST' ? 1 : 2,
          isCarryOver: false,
          semesterId: batch.semesterId,
          sessionId: batch.sessionId,
          level: batch.level,
          status: 'REGISTERED',
        })),
        skipDuplicates: true,
      });

      return updated;
    });

    logger.info(`Registration batch ${batchId} approved by user ${userId}`);

    res.json({
      success: true,
      message: 'Registration approved successfully',
      data: updatedBatch,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: error.errors.map(e => e.message),
      });
    }

    logger.error('Approve registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve registration',
    });
  }
};

/**
 * Reject a course registration
 */
export const rejectRegistration = async (req: AuthRequest, res: Response) => {
  try {
    const batchId = parseInt(req.params.id);
    const userId = req.user!.id;
    const data = rejectRegistrationSchema.parse(req.body);

    const batch = await prisma.courseRegistrationBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found',
      });
    }

    if (batch.status === 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot reject an approved registration',
      });
    }

    const updatedBatch = await prisma.courseRegistrationBatch.update({
      where: { id: batchId },
      data: {
        status: 'REJECTED',
        approvedAt: new Date(),
        approvedBy: userId.toString(),
        comments: data.comments,
      },
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
        },
      },
    });

    logger.info(`Registration batch ${batchId} rejected by user ${userId}`);

    res.json({
      success: true,
      message: 'Registration rejected',
      data: updatedBatch,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: error.errors.map(e => e.message),
      });
    }

    logger.error('Reject registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject registration',
    });
  }
};

/**
 * Return a course registration for revision
 */
export const returnRegistration = async (req: AuthRequest, res: Response) => {
  try {
    const batchId = parseInt(req.params.id);
    const userId = req.user!.id;
    const data = returnRegistrationSchema.parse(req.body);

    const batch = await prisma.courseRegistrationBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found',
      });
    }

    if (batch.status === 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot return an approved registration',
      });
    }

    const updatedBatch = await prisma.courseRegistrationBatch.update({
      where: { id: batchId },
      data: {
        status: 'RETURNED',
        approvedAt: new Date(),
        approvedBy: userId.toString(),
        comments: data.comments,
      },
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
        },
      },
    });

    logger.info(`Registration batch ${batchId} returned by user ${userId}`);

    res.json({
      success: true,
      message: 'Registration returned for revision',
      data: updatedBatch,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: error.errors.map(e => e.message),
      });
    }

    logger.error('Return registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to return registration',
    });
  }
};

/**
 * Get registration statistics
 */
export const getRegistrationStats = async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.query.sessionId as string;
    const semesterId = req.query.semesterId as string;

    const where: any = {};
    if (sessionId) where.sessionId = parseInt(sessionId);
    if (semesterId) where.semesterId = parseInt(semesterId);

    const [total, pending, approved, rejected, returned] = await Promise.all([
      prisma.courseRegistrationBatch.count({ where }),
      prisma.courseRegistrationBatch.count({ where: { ...where, status: 'PENDING' } }),
      prisma.courseRegistrationBatch.count({ where: { ...where, status: 'APPROVED' } }),
      prisma.courseRegistrationBatch.count({ where: { ...where, status: 'REJECTED' } }),
      prisma.courseRegistrationBatch.count({ where: { ...where, status: 'RETURNED' } }),
    ]);

    // Get stats by department
    const departmentStats = await prisma.courseRegistrationBatch.groupBy({
      by: ['status'],
      where,
      _count: true,
    });

    res.json({
      success: true,
      data: {
        total,
        pending,
        approved,
        rejected,
        returned,
        byStatus: departmentStats,
      },
    });
  } catch (error) {
    logger.error('Get registration stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
    });
  }
};

/**
 * Export registrations to Excel
 */
export const exportRegistrations = async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.query.sessionId as string;
    const semesterId = req.query.semesterId as string;
    const status = req.query.status as string;
    const departmentId = req.query.departmentId as string;

    const where: any = {};
    if (status) where.status = status;
    if (sessionId) where.sessionId = parseInt(sessionId);
    if (semesterId) where.semesterId = parseInt(semesterId);
    if (departmentId) {
      where.student = {
        departmentId: parseInt(departmentId),
      };
    }

    const batches = await prisma.courseRegistrationBatch.findMany({
      where,
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
        },
      },
    });

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Course Registrations');

    // Define columns
    worksheet.columns = [
      { header: 'Matric Number', key: 'matricNumber', width: 15 },
      { header: 'Student Name', key: 'studentName', width: 30 },
      { header: 'Department', key: 'department', width: 30 },
      { header: 'Level', key: 'level', width: 10 },
      { header: 'Session', key: 'session', width: 15 },
      { header: 'Semester', key: 'semester', width: 15 },
      { header: 'Total Units', key: 'totalUnits', width: 12 },
      { header: 'Course Codes', key: 'courseCodes', width: 40 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Submitted At', key: 'submittedAt', width: 20 },
      { header: 'Approved At', key: 'approvedAt', width: 20 },
      { header: 'Comments', key: 'comments', width: 40 },
    ];

    // Add data
    batches.forEach(batch => {
      worksheet.addRow({
        matricNumber: batch.student.matricNo,
        studentName: `${batch.student.firstName} ${batch.student.lastName}`,
        department: batch.student.department.name,
        level: batch.level,
        session: batch.session.name,
        semester: batch.semester.type,
        totalUnits: batch.totalUnits,
        courseCodes: batch.courses.map(item => item.course.code).join(', '),
        status: batch.status,
        submittedAt: batch.submittedAt.toISOString(),
        approvedAt: batch.approvedAt?.toISOString() || '',
        comments: batch.comments || '',
      });
    });

    // Style header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' },
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Set response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=course_registrations_${Date.now()}.xlsx`
    );

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    logger.error('Export registrations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export registrations',
    });
  }
};
