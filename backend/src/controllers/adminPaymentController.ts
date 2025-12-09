import { Request, Response } from 'express';
import { PrismaClient, InvoiceType, PaymentStatus } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schemas
const createInvoiceSchema = z.object({
  studentIds: z.array(z.number()).optional(), // If not provided, create for all students
  sessionId: z.number(),
  semesterId: z.number().optional(),
  type: z.enum(['SCHOOL_FEE', 'DEPARTMENTAL_FEE', 'TECHNOLOGY_FEE', 'EXAMINATION_FEE', 'DEVELOPMENT_FEE', 'ACCREDITATION_FEE', 'OTHER']),
  description: z.string().optional(),
  amount: z.number().positive(),
  level: z.number().optional(), // If provided, only create for students at this level
  departmentId: z.number().optional(), // If provided, only create for students in this department
  dueDate: z.string().datetime().optional(),
  cardPayment: z.boolean().default(true),
  walletPayment: z.boolean().default(true),
});

const updateInvoiceSchema = z.object({
  type: z.enum(['SCHOOL_FEE', 'DEPARTMENTAL_FEE', 'TECHNOLOGY_FEE', 'EXAMINATION_FEE', 'DEVELOPMENT_FEE', 'ACCREDITATION_FEE', 'OTHER']).optional(),
  description: z.string().optional(),
  amount: z.number().positive().optional(),
  dueDate: z.string().datetime().optional(),
  cardPayment: z.boolean().optional(),
  walletPayment: z.boolean().optional(),
  status: z.enum(['PENDING', 'PAID', 'PARTIALLY_PAID', 'FAILED']).optional(),
});

const paymentConfigSchema = z.object({
  paymentTypes: z.array(z.object({
    type: z.enum(['SCHOOL_FEE', 'DEPARTMENTAL_FEE', 'TECHNOLOGY_FEE', 'EXAMINATION_FEE', 'DEVELOPMENT_FEE', 'ACCREDITATION_FEE', 'OTHER']),
    defaultAmount: z.number().positive(),
    description: z.string(),
    isActive: z.boolean().default(true),
  })),
});

// Create invoices for students
export const createInvoices = async (req: Request, res: Response) => {
  try {
    const validation = createInvoiceSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: validation.error.errors,
      });
    }

    const {
      studentIds,
      sessionId,
      semesterId,
      type,
      description,
      amount,
      level,
      departmentId,
      dueDate,
      cardPayment,
      walletPayment,
    } = validation.data;

    // Validate session exists
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
      });
    }

    // Build student filter criteria
    let studentFilter: any = {
      status: 'ACTIVE',
    };

    if (studentIds && studentIds.length > 0) {
      studentFilter.id = { in: studentIds };
    }

    if (level) {
      studentFilter.currentLevel = level;
    }

    if (departmentId) {
      studentFilter.departmentId = departmentId;
    }

    // Get students based on criteria
    const students = await prisma.student.findMany({
      where: studentFilter,
      select: {
        id: true,
        matricNo: true,
        firstName: true,
        lastName: true,
        currentLevel: true,
        department: {
          select: {
            name: true,
          },
        },
      },
    });

    if (students.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No students found matching the criteria',
      });
    }

    // Create invoices for each student
    const invoices = await Promise.all(
      students.map(async (student, index) => {
        const invoiceNo = `INV-${sessionId}-${type}-${Date.now()}-${index + 1}`.toUpperCase();

        return prisma.invoice.create({
          data: {
            invoiceNo,
            studentId: student.id,
            sessionId,
            semesterId,
            type,
            description: description || `${type.replace(/_/g, ' ')} for ${session.name}`,
            amount,
            balance: amount,
            level: level || student.currentLevel,
            status: 'PENDING',
            dueDate: dueDate ? new Date(dueDate) : null,
            cardPayment,
            walletPayment,
          },
        });
      })
    );

    // Create notifications for students
    await Promise.all(
      students.map((student) =>
        prisma.notification.create({
          data: {
            studentId: student.id,
            title: 'New Invoice Generated',
            message: `A new invoice for ${type.replace(/_/g, ' ')} of ₦${amount.toLocaleString()} has been generated for your account.`,
            type: 'INFO',
          },
        })
      )
    );

    res.json({
      success: true,
      message: `Successfully created ${invoices.length} invoices`,
      data: {
        created: invoices.length,
        invoices: invoices.slice(0, 5), // Return first 5 as sample
      },
    });
  } catch (error) {
    console.error('Error creating invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create invoices',
    });
  }
};

// Get all invoices with filters
export const getAllInvoices = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      type,
      sessionId,
      departmentId,
      level,
      search,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    let whereCondition: any = {};

    if (status) {
      whereCondition.status = status;
    }

    if (type) {
      whereCondition.type = type;
    }

    if (sessionId) {
      whereCondition.sessionId = Number(sessionId);
    }

    if (level) {
      whereCondition.level = Number(level);
    }

    if (departmentId) {
      whereCondition.student = {
        departmentId: Number(departmentId),
      };
    }

    if (search) {
      whereCondition.OR = [
        { invoiceNo: { contains: search as string, mode: 'insensitive' } },
        {
          student: {
            OR: [
              { matricNo: { contains: search as string, mode: 'insensitive' } },
              { firstName: { contains: search as string, mode: 'insensitive' } },
              { lastName: { contains: search as string, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where: whereCondition,
        include: {
          student: {
            select: {
              id: true,
              matricNo: true,
              firstName: true,
              lastName: true,
              currentLevel: true,
              department: {
                select: {
                  name: true,
                },
              },
            },
          },
          session: {
            select: {
              name: true,
            },
          },
          semester: {
            select: {
              type: true,
            },
          },
          payments: {
            where: {
              status: 'PAID',
            },
            select: {
              id: true,
              amount: true,
              paidAt: true,
              method: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: Number(limit),
      }),
      prisma.invoice.count({ where: whereCondition }),
    ]);

    const totalPages = Math.ceil(total / Number(limit));

    res.json({
      success: true,
      data: invoices,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoices',
    });
  }
};

// Get payment statistics
export const getPaymentStatistics = async (req: Request, res: Response) => {
  try {
    const { sessionId, departmentId } = req.query;

    let whereCondition: any = {};

    if (sessionId) {
      whereCondition.sessionId = Number(sessionId);
    }

    if (departmentId) {
      whereCondition.student = {
        departmentId: Number(departmentId),
      };
    }

    const [
      totalInvoices,
      paidInvoices,
      pendingInvoices,
      partiallyPaidInvoices,
      totalAmount,
      totalPaid,
      totalOutstanding,
      paymentMethodStats,
      invoiceTypeStats,
    ] = await Promise.all([
      // Total invoices
      prisma.invoice.count({ where: whereCondition }),

      // Paid invoices
      prisma.invoice.count({
        where: { ...whereCondition, status: 'PAID' },
      }),

      // Pending invoices
      prisma.invoice.count({
        where: { ...whereCondition, status: 'PENDING' },
      }),

      // Partially paid invoices
      prisma.invoice.count({
        where: { ...whereCondition, status: 'PARTIALLY_PAID' },
      }),

      // Total amount
      prisma.invoice.aggregate({
        where: whereCondition,
        _sum: { amount: true },
      }),

      // Total paid
      prisma.invoice.aggregate({
        where: whereCondition,
        _sum: { amountPaid: true },
      }),

      // Total outstanding
      prisma.invoice.aggregate({
        where: { 
          ...whereCondition, 
          status: { in: ['PENDING', 'PARTIALLY_PAID'] },
          balance: { gt: 0 }
        },
        _sum: { balance: true },
      }),

      // Payment method statistics
      prisma.payment.groupBy({
        by: ['method'],
        where: {
          status: 'PAID',
          invoice: whereCondition,
        },
        _sum: { amount: true },
        _count: true,
      }),

      // Invoice type statistics
      prisma.invoice.groupBy({
        by: ['type'],
        where: whereCondition,
        _sum: { amount: true, amountPaid: true, balance: true },
        _count: true,
      }),
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalInvoices,
          paidInvoices,
          pendingInvoices,
          partiallyPaidInvoices,
          totalAmount: totalAmount._sum.amount || 0,
          totalPaid: totalPaid._sum.amountPaid || 0,
          totalOutstanding: totalOutstanding._sum.balance || 0,
          collectionRate: (totalAmount._sum.amount || 0) > 0 
            ? ((totalPaid._sum.amountPaid || 0) / (totalAmount._sum.amount || 1)) * 100 
            : 0,
        },
        paymentMethods: paymentMethodStats.map(stat => ({
          method: stat.method,
          totalAmount: stat._sum.amount || 0,
          totalTransactions: stat._count,
        })),
        invoiceTypes: invoiceTypeStats.map(stat => ({
          type: stat.type,
          totalInvoices: stat._count,
          totalAmount: stat._sum.amount || 0,
          totalPaid: stat._sum.amountPaid || 0,
          totalOutstanding: stat._sum.balance || 0,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching payment statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment statistics',
    });
  }
};

// Update invoice
export const updateInvoice = async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const validation = updateInvoiceSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: validation.error.errors,
      });
    }

    let updateData = { ...validation.data } as any;

    // If amount is being updated, recalculate balance
    if (updateData.amount) {
      const invoice = await prisma.invoice.findUnique({
        where: { id: Number(invoiceId) },
        select: { amountPaid: true },
      });

      if (!invoice) {
        return res.status(404).json({
          success: false,
          message: 'Invoice not found',
        });
      }

      updateData.balance = updateData.amount - invoice.amountPaid;

      // Update status based on new balance
      if (updateData.balance <= 0) {
        updateData.status = 'PAID';
      } else if (invoice.amountPaid > 0) {
        updateData.status = 'PARTIALLY_PAID';
      }
    }

    const updatedInvoice = await prisma.invoice.update({
      where: { id: Number(invoiceId) },
      data: updateData,
      include: {
        student: {
          select: {
            id: true,
            matricNo: true,
            firstName: true,
            lastName: true,
          },
        },
        session: {
          select: {
            name: true,
          },
        },
      },
    });

    res.json({
      success: true,
      message: 'Invoice updated successfully',
      data: updatedInvoice,
    });
  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update invoice',
    });
  }
};

// Delete invoice (soft delete by changing status)
export const deleteInvoice = async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;

    // Check if invoice has any payments
    const paymentsCount = await prisma.payment.count({
      where: {
        invoiceId: Number(invoiceId),
        status: 'PAID',
      },
    });

    if (paymentsCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete invoice with paid payments',
      });
    }

    // Delete the invoice and its pending payments
    await prisma.$transaction(async (tx) => {
      // Delete pending payments
      await tx.payment.deleteMany({
        where: {
          invoiceId: Number(invoiceId),
          status: { in: ['PENDING', 'FAILED'] },
        },
      });

      // Delete invoice
      await tx.invoice.delete({
        where: { id: Number(invoiceId) },
      });
    });

    res.json({
      success: true,
      message: 'Invoice deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete invoice',
    });
  }
};

// Get students for invoice creation
export const getStudentsForInvoice = async (req: Request, res: Response) => {
  try {
    const { departmentId, level, search } = req.query;

    let whereCondition: any = {
      status: 'ACTIVE',
    };

    if (departmentId) {
      whereCondition.departmentId = Number(departmentId);
    }

    if (level) {
      whereCondition.currentLevel = Number(level);
    }

    if (search) {
      whereCondition.OR = [
        { matricNo: { contains: search as string, mode: 'insensitive' } },
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const students = await prisma.student.findMany({
      where: whereCondition,
      select: {
        id: true,
        matricNo: true,
        firstName: true,
        lastName: true,
        currentLevel: true,
        department: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [
        { currentLevel: 'asc' },
        { matricNo: 'asc' },
      ],
    });

    res.json({
      success: true,
      data: students,
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch students',
    });
  }
};

// Bulk operations for invoices
export const bulkInvoiceOperations = async (req: Request, res: Response) => {
  try {
    const { action, invoiceIds, data } = req.body;

    if (!action || !invoiceIds || !Array.isArray(invoiceIds)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
      });
    }

    let result;

    switch (action) {
      case 'delete':
        // Check if any invoice has payments
        const paymentsCount = await prisma.payment.count({
          where: {
            invoiceId: { in: invoiceIds },
            status: 'PAID',
          },
        });

        if (paymentsCount > 0) {
          return res.status(400).json({
            success: false,
            message: 'Cannot delete invoices with paid payments',
          });
        }

        result = await prisma.$transaction(async (tx) => {
          await tx.payment.deleteMany({
            where: {
              invoiceId: { in: invoiceIds },
              status: { in: ['PENDING', 'FAILED'] },
            },
          });

          return tx.invoice.deleteMany({
            where: { id: { in: invoiceIds } },
          });
        });
        break;

      case 'update_status':
        if (!data.status) {
          return res.status(400).json({
            success: false,
            message: 'Status is required for update operation',
          });
        }

        result = await prisma.invoice.updateMany({
          where: { id: { in: invoiceIds } },
          data: { status: data.status },
        });
        break;

      case 'update_due_date':
        if (!data.dueDate) {
          return res.status(400).json({
            success: false,
            message: 'Due date is required for update operation',
          });
        }

        result = await prisma.invoice.updateMany({
          where: { id: { in: invoiceIds } },
          data: { dueDate: new Date(data.dueDate) },
        });
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid action',
        });
    }

    res.json({
      success: true,
      message: `Bulk ${action} operation completed successfully`,
      data: { affected: result.count },
    });
  } catch (error) {
    console.error('Error performing bulk operation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform bulk operation',
    });
  }
};

// Get sessions for invoice creation
export const getSessions = async (req: Request, res: Response) => {
  try {
    const sessions = await prisma.session.findMany({
      orderBy: {
        startDate: 'desc',
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        isActive: true,
      },
    });

    res.json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sessions',
    });
  }
};