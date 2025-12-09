import { Response } from 'express';
import prisma from '../config/database';
import { StudentAuthRequest } from '../middleware/studentAuth';
import logger from '../config/logger';
import { calculateGPA } from '../utils/helpers';

/**
 * Get dashboard statistics and overview
 */
export const getDashboardStats = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;

    // Get student with all necessary relations
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        department: {
          select: { name: true, code: true },
        },
        program: {
          select: { name: true, duration: true },
        },
        currentSession: {
          include: {
            semesters: {
              where: { isActive: true },
              select: { id: true, type: true, startDate: true, endDate: true },
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

    // Get current semester
    const currentSemester = student.currentSession?.semesters[0];

    // Get stats in parallel
    const [
      registeredCourses,
      pendingAssignments,
      recentResults,
      unpaidInvoices,
      unreadNotifications,
      walletBalance,
    ] = await Promise.all([
      // Registered courses for current session
      prisma.courseRegistration.count({
        where: {
          studentId,
          academicYear: student.currentSession?.name,
        },
      }),

      // Pending assignments
      prisma.assignment.count({
        where: {
          courseId: {
            in: (
              await prisma.courseRegistration.findMany({
                where: { studentId, academicYear: student.currentSession?.name },
                select: { courseId: true },
              })
            ).map(r => r.courseId),
          },
          dueDate: { gte: new Date() },
          submissions: {
            none: { studentId },
          },
        },
      }),

      // Recent results (last semester)
      prisma.result.findMany({
        where: { studentId },
        include: {
          course: { select: { code: true, title: true, credits: true } },
        },
        orderBy: [{ sessionId: 'desc' }, { semester: 'desc' }],
        take: 5,
      }),

      // Unpaid invoices
      prisma.invoice.findMany({
        where: {
          studentId,
          status: { in: ['PENDING', 'PARTIALLY_PAID'] },
          balance: { gt: 0 },
        },
        select: {
          invoiceNo: true,
          type: true,
          amount: true,
          balance: true,
          dueDate: true,
        },
        orderBy: { dueDate: 'asc' },
      }),

      // Unread notifications
      prisma.notification.count({
        where: { studentId, isRead: false },
      }),

      // Wallet balance
      student.walletBalance,
    ]);

    // Calculate CGPA
    const allResults = await prisma.result.findMany({
      where: { studentId },
      include: {
        course: { select: { credits: true } },
      },
    });

    const cgpa =
      allResults.length > 0
        ? calculateGPA(allResults.map(r => ({ score: r.score, credits: r.course.credits })))
        : 0;

    const totalCreditsEarned = allResults
      .filter(r => r.grade !== 'F')
      .reduce((sum, r) => sum + r.course.credits, 0);

    return res.status(200).json({
      success: true,
      data: {
        student: {
          matricNo: student.matricNo,
          firstName: student.firstName,
          lastName: student.lastName,
          email: student.email,
          level: student.currentLevel,
          status: student.status,
          profilePicture: student.profilePicture,
          department: student.department.name,
          program: student.program?.name,
        },
        session: student.currentSession
          ? {
              name: student.currentSession.name,
              startDate: student.currentSession.startDate,
              endDate: student.currentSession.endDate,
              isActive: student.currentSession.isActive,
            }
          : null,
        currentSemester: currentSemester
          ? {
              id: currentSemester.id,
              type: currentSemester.type,
              startDate: currentSemester.startDate,
              endDate: currentSemester.endDate,
            }
          : null,
        stats: {
          cgpa: parseFloat(cgpa.toFixed(2)),
          totalCreditsEarned,
          registeredCourses,
          pendingAssignments,
          unpaidInvoices: unpaidInvoices.length,
          unreadNotifications,
          walletBalance: parseFloat(walletBalance.toFixed(2)),
        },
        recentResults: recentResults.map(r => ({
          courseCode: r.course.code,
          courseTitle: r.course.title,
          score: r.score,
          grade: r.grade,
          gradePoint: r.gradePoint,
        })),
        alerts: {
          unpaidInvoices: unpaidInvoices.map(inv => ({
            invoiceNo: inv.invoiceNo,
            type: inv.type,
            balance: inv.balance,
            dueDate: inv.dueDate,
            isOverdue: inv.dueDate ? inv.dueDate < new Date() : false,
          })),
          hasPendingAssignments: pendingAssignments > 0,
          hasUnreadNotifications: unreadNotifications > 0,
        },
      },
    });
  } catch (error: any) {
    logger.error('Error in getDashboardStats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message,
    });
  }
};

/**
 * Get recent activities
 */
export const getRecentActivities = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;
    const { limit = '10' } = req.query;
    const limitNum = parseInt(limit as string);

    // Get recent activities from different sources
    const [recentRegistrations, recentSubmissions, recentPayments] = await Promise.all([
      // Recent course registrations
      prisma.courseRegistration.findMany({
        where: { studentId },
        include: {
          course: { select: { code: true, title: true } },
        },
        orderBy: { registrationDate: 'desc' },
        take: limitNum,
      }),

      // Recent assignment submissions
      prisma.assignmentSubmission.findMany({
        where: { studentId },
        include: {
          assignment: {
            select: {
              title: true,
              course: { select: { code: true, title: true } },
            },
          },
        },
        orderBy: { submittedAt: 'desc' },
        take: limitNum,
      }),

      // Recent payments
      prisma.payment.findMany({
        where: { studentId, status: 'PAID' },
        include: {
          invoice: { select: { invoiceNo: true, type: true } },
        },
        orderBy: { paidAt: 'desc' },
        take: limitNum,
      }),
    ]);

    // Combine and sort activities
    const activities: any[] = [
      ...recentRegistrations.map(r => ({
        type: 'COURSE_REGISTRATION',
        title: `Registered for ${r.course.code}`,
        description: r.course.title,
        date: r.registrationDate,
        icon: 'book',
      })),
      ...recentSubmissions.map(s => ({
        type: 'ASSIGNMENT_SUBMISSION',
        title: `Submitted "${s.assignment.title}"`,
        description: `${s.assignment.course.code} - ${s.status}`,
        date: s.submittedAt,
        icon: 'file',
      })),
      ...recentPayments.map(p => ({
        type: 'PAYMENT',
        title: `Payment of ₦${p.amount.toLocaleString()}`,
        description: `${p.invoice.type} - ${p.invoice.invoiceNo}`,
        date: p.paidAt!,
        icon: 'credit-card',
      })),
    ];

    // Sort by date descending
    activities.sort((a, b) => b.date.getTime() - a.date.getTime());

    return res.status(200).json({
      success: true,
      data: {
        activities: activities.slice(0, limitNum),
      },
    });
  } catch (error: any) {
    logger.error('Error in getRecentActivities:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch recent activities',
      error: error.message,
    });
  }
};

/**
 * Get notifications
 */
export const getNotifications = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;
    const { page = '1', limit = '20', unreadOnly = 'false' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { studentId };
    if (unreadOnly === 'true') {
      where.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { studentId, isRead: false } }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        notifications,
        pagination: {
          total,
          unreadCount,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error: any) {
    logger.error('Error in getNotifications:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message,
    });
  }
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (req: StudentAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const studentId = req.student!.id;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Notification ID is required',
      });
    }

    const notification = await prisma.notification.findUnique({
      where: { id: parseInt(id) },
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    if (notification.studentId !== studentId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this notification',
      });
    }

    const updated = await prisma.notification.update({
      where: { id: parseInt(id) },
      data: { isRead: true },
    });

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: updated,
    });
  } catch (error: any) {
    logger.error('Error in markNotificationAsRead:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message,
    });
  }
};

/**
 * Mark all notifications as read
 */
export const markAllNotificationsAsRead = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;

    const result = await prisma.notification.updateMany({
      where: { studentId, isRead: false },
      data: { isRead: true },
    });

    return res.status(200).json({
      success: true,
      message: `${result.count} notification(s) marked as read`,
      data: { count: result.count },
    });
  } catch (error: any) {
    logger.error('Error in markAllNotificationsAsRead:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
      error: error.message,
    });
  }
};

/**
 * Get upcoming events/deadlines
 */
export const getUpcomingEvents = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Get student's registered courses
    const registrations = await prisma.courseRegistration.findMany({
      where: { studentId },
      select: { courseId: true },
    });

    const courseIds = registrations.map(r => r.courseId);

    const [upcomingAssignments, upcomingInvoices] = await Promise.all([
      // Upcoming assignment deadlines
      prisma.assignment.findMany({
        where: {
          courseId: { in: courseIds },
          dueDate: {
            gte: now,
            lte: thirtyDaysLater,
          },
          submissions: {
            none: { studentId },
          },
        },
        include: {
          course: { select: { code: true, title: true } },
        },
        orderBy: { dueDate: 'asc' },
      }),

      // Upcoming payment due dates
      prisma.invoice.findMany({
        where: {
          studentId,
          status: { in: ['PENDING', 'PARTIALLY_PAID'] },
          balance: { gt: 0 },
          dueDate: {
            gte: now,
            lte: thirtyDaysLater,
          },
        },
        orderBy: { dueDate: 'asc' },
      }),
    ]);

    const events = [
      ...upcomingAssignments.map(a => ({
        type: 'ASSIGNMENT',
        title: a.title,
        description: `${a.course.code} - ${a.course.title}`,
        date: a.dueDate,
        daysUntil: Math.ceil((a.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      })),
      ...upcomingInvoices.map(i => ({
        type: 'PAYMENT',
        title: `${i.type} Payment Due`,
        description: `Balance: ₦${i.balance.toLocaleString()}`,
        date: i.dueDate!,
        daysUntil: Math.ceil((i.dueDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      })),
    ];

    // Sort by date
    events.sort((a, b) => a.date.getTime() - b.date.getTime());

    return res.status(200).json({
      success: true,
      data: {
        events,
        summary: {
          totalEvents: events.length,
          assignments: upcomingAssignments.length,
          payments: upcomingInvoices.length,
        },
      },
    });
  } catch (error: any) {
    logger.error('Error in getUpcomingEvents:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch upcoming events',
      error: error.message,
    });
  }
};
