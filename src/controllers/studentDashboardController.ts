import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { StudentAuthRequest } from '../types/express';

const prisma = new PrismaClient();

// Get dashboard overview with stats
export const getOverview = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;

    // Get student details with related data
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        program: true,
        department: true,
      },
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Get current active session
    const currentSession = await prisma.session.findFirst({
      where: { isActive: true },
      include: {
        semesters: {
          where: { isActive: true },
          take: 1,
        },
      },
    });

    // Get registered courses count for current semester from CourseRegistrationBatch
    let registeredCoursesCount = 0;
    if (currentSession?.semesters[0]) {
      const batches = await prisma.courseRegistrationBatch.findMany({
        where: {
          studentId,
          semesterId: currentSession.semesters[0].id,
        },
        include: {
          courses: true,
        },
      });
      
      // Count total courses across all batches
      registeredCoursesCount = batches.reduce((total, batch) => total + batch.courses.length, 0);
    }

    // Get pending assignments count
    const registeredCourseIds = currentSession?.semesters[0]
      ? (
          await prisma.courseRegistrationBatchItem.findMany({
            where: {
              batch: {
                studentId,
                semesterId: currentSession.semesters[0].id,
              },
            },
            select: { courseId: true },
          })
        ).map((item) => item.courseId)
      : [];

    const pendingAssignments = await prisma.assignment.count({
      where: {
        courseId: {
          in: registeredCourseIds,
        },
        dueDate: {
          gte: new Date(),
        },
        submissions: {
          none: {
            studentId,
          },
        },
      },
    });

    // Get current GPA (latest semester with results)
    const latestResult = await prisma.result.findFirst({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });

    const currentGPA = latestResult?.gradePoint || 0;

    // Get wallet balance and unpaid invoices
    const walletBalance = student.walletBalance || 0;
    
    const unpaidInvoices = await prisma.invoice.count({
      where: {
        studentId,
        status: 'PENDING',
      },
    });

    // Get unread notifications count
    const unreadNotifications = await prisma.notification.count({
      where: {
        studentId,
        isRead: false,
      },
    });

    // Calculate CGPA (all semesters)
    const allResults = await prisma.result.findMany({
      where: { studentId },
    });

    let cgpa = 0;
    if (allResults.length > 0) {
      const totalGPA = allResults.reduce((sum, result) => sum + (result.gradePoint || 0), 0);
      cgpa = totalGPA / allResults.length;
    }

    res.json({
      student: {
        matricNo: student.matricNo,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        level: student.currentLevel,
        status: student.status,
        profilePicture: student.profilePicture,
        department: student.department?.name,
        program: student.program?.name,
      },
      session: currentSession
        ? {
            name: currentSession.name,
            startDate: currentSession.startDate,
            endDate: currentSession.endDate,
            isActive: currentSession.isActive,
          }
        : null,
      currentSemester: currentSession?.semesters[0]
        ? {
            id: currentSession.semesters[0].id,
            type: currentSession.semesters[0].type,
            startDate: currentSession.semesters[0].startDate,
            endDate: currentSession.semesters[0].endDate,
          }
        : null,
      stats: {
        cgpa: parseFloat(cgpa.toFixed(2)),
        totalCreditsEarned: 0, // TODO: Calculate from completed courses
        registeredCourses: registeredCoursesCount,
        pendingAssignments,
        unpaidInvoices,
        unreadNotifications,
        walletBalance,
      },
      recentResults: [], // TODO: Fetch recent results
      alerts: {
        unpaidInvoices: [], // TODO: Fetch unpaid invoice details
        hasPendingAssignments: pendingAssignments > 0,
        hasUnreadNotifications: unreadNotifications > 0,
      },
    });
  } catch (error: any) {
    console.error('Error fetching dashboard overview:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard overview' });
  }
};

// Get notifications
export const getNotifications = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;
    const { page = 1, limit = 10, type } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { studentId };
    if (type) {
      where.type = type;
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.notification.count({ where }),
    ]);

    res.json({
      data: notifications,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
};

// Mark notification as read
export const markNotificationRead = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;
    const { id } = req.params;
    const notificationId = parseInt(id);

    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        studentId,
      },
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    const updatedNotification = await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    res.json({
      message: 'Notification marked as read',
      data: updatedNotification,
    });
  } catch (error: any) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Failed to mark notification as read' });
  }
};

// Mark all notifications as read
export const markAllNotificationsRead = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;

    await prisma.notification.updateMany({
      where: {
        studentId,
        isRead: false,
      },
      data: { isRead: true },
    });

    res.json({ message: 'All notifications marked as read' });
  } catch (error: any) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Failed to mark all notifications as read' });
  }
};

// Get alerts (urgent notifications)
export const getAlerts = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;

    // Get pending payments
    const pendingInvoices = await prisma.invoice.findMany({
      where: {
        studentId,
        status: 'PENDING',
        dueDate: {
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Due within 7 days
        },
      },
      include: {
        session: true,
      },
      orderBy: { dueDate: 'asc' },
      take: 5,
    });

    // Get upcoming assignment deadlines
    const registeredCourseIds = (
      await prisma.courseRegistration.findMany({
        where: {
          studentId,
          semesterRecord: {
            isActive: true,
          },
        },
        select: { courseId: true },
      })
    ).map((r) => r.courseId);

    const upcomingAssignments = await prisma.assignment.findMany({
      where: {
        courseId: {
          in: registeredCourseIds,
        },
        dueDate: {
          gte: new Date(),
          lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // Due within 3 days
        },
        submissions: {
          none: {
            studentId,
          },
        },
      },
      include: {
        course: true,
      },
      orderBy: { dueDate: 'asc' },
      take: 5,
    });

    // Get unread important notifications
    const importantNotifications = await prisma.notification.findMany({
      where: {
        studentId,
        isRead: false,
        type: {
          in: ['WARNING', 'ERROR'],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    res.json({
      pendingPayments: pendingInvoices.map((invoice) => ({
        id: invoice.id,
        type: invoice.type,
        amount: invoice.amount,
        dueDate: invoice.dueDate,
        session: invoice.session.name,
      })),
      upcomingAssignments: upcomingAssignments.map((assignment) => ({
        id: assignment.id,
        title: assignment.title,
        course: assignment.course.title,
        dueDate: assignment.dueDate,
      })),
      importantNotifications: importantNotifications.map((notification) => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        createdAt: notification.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ message: 'Failed to fetch alerts' });
  }
};

// Get recent activities
export const getActivities = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;
    const { limit = 10 } = req.query;

    // Get recent course registrations
    const recentRegistrations = await prisma.courseRegistration.findMany({
      where: { studentId },
      include: {
        course: true,
        semesterRecord: {
          include: {
            session: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });

    // Get recent assignment submissions
    const recentSubmissions = await prisma.assignmentSubmission.findMany({
      where: { studentId },
      include: {
        assignment: {
          include: {
            course: true,
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
      take: 3,
    });

    // Get recent payments
    const recentPayments = await prisma.payment.findMany({
      where: { studentId },
      include: {
        invoice: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });

    // Get recent results published
    const recentResults = await prisma.result.findMany({
      where: { studentId },
      include: {
        course: true,
        session: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });

    // Combine and sort all activities
    const activities: any[] = [];

    recentRegistrations.forEach((reg) => {
      activities.push({
        id: `reg-${reg.id}`,
        type: 'REGISTRATION',
        message: `Registered for ${reg.course.title}`,
        createdAt: reg.createdAt,
      });
    });

    recentSubmissions.forEach((sub) => {
      activities.push({
        id: `sub-${sub.id}`,
        type: 'ASSIGNMENT',
        message: `Submitted assignment: ${sub.assignment.title}`,
        createdAt: sub.submittedAt,
      });
    });

    recentPayments.forEach((pay) => {
      activities.push({
        id: `pay-${pay.id}`,
        type: 'PAYMENT',
        message: `Payment of ₦${pay.amount.toLocaleString()} completed`,
        createdAt: pay.createdAt,
      });
    });

    recentResults.forEach((result) => {
      activities.push({
        id: `result-${result.id}`,
        type: 'RESULT',
        message: `Result published for ${result.course.code} - ${result.course.title}: ${result.grade}`,
        createdAt: result.createdAt,
      });
    });

    // Sort by date and limit
    activities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const limitedActivities = activities.slice(0, Number(limit));

    res.json({ data: limitedActivities });
  } catch (error: any) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ message: 'Failed to fetch activities' });
  }
};
