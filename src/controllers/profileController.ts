import { Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { StudentAuthRequest } from '../middleware/studentAuth';
import logger from '../config/logger';

// Validation schemas
const updateProfileSchema = z.object({
  phone: z.string().min(10).optional(),
  address: z.string().min(5).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6),
  confirmPassword: z.string().min(6),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

const updateProfilePictureSchema = z.object({
  profilePicture: z.string().url().optional(),
});

/**
 * Get student profile
 */
export const getProfile = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        department: {
          select: {
            name: true,
            code: true,
          },
        },
        program: {
          select: {
            name: true,
            code: true,
            duration: true,
          },
        },
        currentSession: {
          select: {
            name: true,
            startDate: true,
            endDate: true,
            isActive: true,
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

    // Remove sensitive fields
    const { password, refreshToken, resetToken, resetTokenExpiry, ...profileData } = student;

    return res.status(200).json({
      success: true,
      data: profileData,
    });
  } catch (error: any) {
    logger.error('Error in getProfile:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      error: error.message,
    });
  }
};

/**
 * Update student profile
 */
export const updateProfile = async (req: StudentAuthRequest, res: Response) => {
  try {
    const validation = updateProfileSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validation.error.errors,
      });
    }

    const { phone, address } = validation.data;
    const studentId = req.student!.id;

    // Build update data
    const updateData: any = {};
    if (phone) updateData.phone = phone;
    if (address) updateData.address = address;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update',
      });
    }

    const updatedStudent = await prisma.student.update({
      where: { id: studentId },
      data: updateData,
      include: {
        department: {
          select: { name: true, code: true },
        },
        program: {
          select: { name: true, code: true },
        },
      },
    });

    // Remove sensitive fields
    const { password, refreshToken, resetToken, resetTokenExpiry, ...profileData } = updatedStudent;

    logger.info(`Student ${updatedStudent.matricNo} updated profile`);

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: profileData,
    });
  } catch (error: any) {
    logger.error('Error in updateProfile:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message,
    });
  }
};

/**
 * Change password
 */
export const changePassword = async (req: StudentAuthRequest, res: Response) => {
  try {
    const validation = changePasswordSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validation.error.errors,
      });
    }

    const { currentPassword, newPassword } = validation.data;
    const studentId = req.student!.id;

    // Get student with password
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        matricNo: true,
        password: true,
      },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    if (!student.password) {
      return res.status(400).json({
        success: false,
        message: 'No password set. Please use the registration process.',
      });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, student.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.student.update({
      where: { id: studentId },
      data: { password: hashedPassword },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        studentId,
        title: 'Password Changed',
        message: 'Your password has been changed successfully. If you did not make this change, please contact support immediately.',
        type: 'INFO',
      },
    });

    logger.info(`Student ${student.matricNo} changed password`);

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error: any) {
    logger.error('Error in changePassword:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: error.message,
    });
  }
};

/**
 * Upload/Update profile picture
 */
export const updateProfilePicture = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Profile picture file is required',
      });
    }

    const profilePictureUrl = `/uploads/profiles/${req.file.filename}`;

    // Update student profile picture
    const updatedStudent = await prisma.student.update({
      where: { id: studentId },
      data: { profilePicture: profilePictureUrl },
      select: {
        matricNo: true,
        profilePicture: true,
      },
    });

    logger.info(`Student ${updatedStudent.matricNo} updated profile picture`);

    return res.status(200).json({
      success: true,
      message: 'Profile picture updated successfully',
      data: {
        profilePicture: updatedStudent.profilePicture,
      },
    });
  } catch (error: any) {
    logger.error('Error in updateProfilePicture:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile picture',
      error: error.message,
    });
  }
};

/**
 * Get academic summary
 */
export const getAcademicSummary = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        department: { select: { name: true } },
        program: { select: { name: true, duration: true } },
        currentSession: { select: { name: true } },
      },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    // Get academic stats
    const [
      totalCourses,
      totalCreditsAttempted,
      results,
      registrations,
      assignments,
    ] = await Promise.all([
      // Total courses registered
      prisma.courseRegistration.count({ where: { studentId } }),

      // Total credits attempted
      prisma.result.findMany({
        where: { studentId },
        include: { course: { select: { credits: true } } },
      }),

      // All results for CGPA
      prisma.result.findMany({
        where: { studentId },
        include: { course: { select: { credits: true } } },
      }),

      // Current semester registrations
      prisma.courseRegistration.count({
        where: {
          studentId,
          academicYear: student.currentSession?.name,
        },
      }),

      // Assignment submissions
      prisma.assignmentSubmission.count({ where: { studentId } }),
    ]);

    // Calculate CGPA
    const cgpa = results.length > 0
      ? results.reduce((sum, r) => sum + (r.gradePoint * r.course.credits), 0) /
        results.reduce((sum, r) => sum + r.course.credits, 0)
      : 0;

    const totalCreditsEarned = results
      .filter(r => r.grade !== 'F')
      .reduce((sum, r) => sum + r.course.credits, 0);

    const creditsTried = results.reduce((sum, r) => sum + r.course.credits, 0);

    return res.status(200).json({
      success: true,
      data: {
        student: {
          matricNo: student.matricNo,
          name: `${student.firstName} ${student.lastName}`,
          level: student.currentLevel,
          status: student.status,
          department: student.department.name,
          program: student.program?.name,
          enrollmentDate: student.enrollmentDate,
        },
        academic: {
          cgpa: parseFloat(cgpa.toFixed(2)),
          totalCoursesRegistered: totalCourses,
          totalCreditsEarned,
          totalCreditsAttempted: creditsTried,
          currentSemesterCourses: registrations,
          assignmentsSubmitted: assignments,
          coursesPassed: results.filter(r => r.grade !== 'F').length,
          coursesFailed: results.filter(r => r.grade === 'F').length,
        },
        progress: {
          expectedCredits: (student.currentLevel / 100) * 30, // Approximate
          completionPercentage: student.program?.duration
            ? ((student.currentLevel / 100) / student.program.duration) * 100
            : 0,
        },
      },
    });
  } catch (error: any) {
    logger.error('Error in getAcademicSummary:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch academic summary',
      error: error.message,
    });
  }
};

/**
 * Get financial summary
 */
export const getFinancialSummary = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        matricNo: true,
        walletBalance: true,
      },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    // Get financial stats
    const [invoices, payments] = await Promise.all([
      prisma.invoice.findMany({
        where: { studentId },
        select: {
          amount: true,
          amountPaid: true,
          balance: true,
          status: true,
        },
      }),

      prisma.payment.findMany({
        where: { studentId, status: 'PAID' },
        select: {
          amount: true,
          method: true,
        },
      }),
    ]);

    const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.amount, 0);
    const totalPaid = invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
    const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.balance, 0);

    const paymentMethodBreakdown = payments.reduce((acc, p) => {
      acc[p.method] = (acc[p.method] || 0) + p.amount;
      return acc;
    }, {} as Record<string, number>);

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalInvoiced,
          totalPaid,
          totalOutstanding,
          walletBalance: student.walletBalance,
        },
        invoiceStatus: {
          paid: invoices.filter(i => i.status === 'PAID').length,
          pending: invoices.filter(i => i.status === 'PENDING').length,
          partiallyPaid: invoices.filter(i => i.status === 'PARTIALLY_PAID').length,
        },
        paymentMethods: paymentMethodBreakdown,
        totalPayments: payments.length,
      },
    });
  } catch (error: any) {
    logger.error('Error in getFinancialSummary:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch financial summary',
      error: error.message,
    });
  }
};
