import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import logger from '../config/logger';

const prisma = new PrismaClient();

// Validation schemas
const createPaymentTypeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required').toUpperCase(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

const updatePaymentTypeSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).toUpperCase().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

// Get all payment types
export const getAllPaymentTypes = async (req: Request, res: Response) => {
  try {
    const { active } = req.query;

    const paymentTypes = await prisma.paymentType.findMany({
      where: active === 'true' ? { isActive: true } : undefined,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            invoices: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: paymentTypes,
    });
  } catch (error) {
    logger.error('Error fetching payment types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment types',
    });
  }
};

// Get single payment type
export const getPaymentType = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const paymentType = await prisma.paymentType.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            invoices: true,
          },
        },
      },
    });

    if (!paymentType) {
      return res.status(404).json({
        success: false,
        message: 'Payment type not found',
      });
    }

    res.json({
      success: true,
      data: paymentType,
    });
  } catch (error) {
    logger.error('Error fetching payment type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment type',
    });
  }
};

// Create payment type
export const createPaymentType = async (req: Request, res: Response) => {
  try {
    const validation = createPaymentTypeSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validation.error.errors,
      });
    }

    const { name, code, description, isActive } = validation.data;

    // Check if code already exists
    const existing = await prisma.paymentType.findUnique({
      where: { code },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Payment type with this code already exists',
      });
    }

    const paymentType = await prisma.paymentType.create({
      data: {
        name,
        code,
        description,
        isActive,
      },
    });

    logger.info(`Payment type created: ${paymentType.name} (${paymentType.code})`);

    res.status(201).json({
      success: true,
      message: 'Payment type created successfully',
      data: paymentType,
    });
  } catch (error) {
    logger.error('Error creating payment type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment type',
    });
  }
};

// Update payment type
export const updatePaymentType = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validation = updatePaymentTypeSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validation.error.errors,
      });
    }

    const paymentType = await prisma.paymentType.findUnique({
      where: { id: parseInt(id) },
    });

    if (!paymentType) {
      return res.status(404).json({
        success: false,
        message: 'Payment type not found',
      });
    }

    // Check if code already exists (if updating code)
    if (validation.data.code && validation.data.code !== paymentType.code) {
      const existing = await prisma.paymentType.findUnique({
        where: { code: validation.data.code },
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Payment type with this code already exists',
        });
      }
    }

    const updated = await prisma.paymentType.update({
      where: { id: parseInt(id) },
      data: validation.data,
    });

    logger.info(`Payment type updated: ${updated.name} (${updated.code})`);

    res.json({
      success: true,
      message: 'Payment type updated successfully',
      data: updated,
    });
  } catch (error) {
    logger.error('Error updating payment type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update payment type',
    });
  }
};

// Delete payment type
export const deletePaymentType = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const paymentType = await prisma.paymentType.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            invoices: true,
          },
        },
      },
    });

    if (!paymentType) {
      return res.status(404).json({
        success: false,
        message: 'Payment type not found',
      });
    }

    // Check if payment type is in use
    if (paymentType._count.invoices > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete payment type. It is used in ${paymentType._count.invoices} invoice(s)`,
      });
    }

    await prisma.paymentType.delete({
      where: { id: parseInt(id) },
    });

    logger.info(`Payment type deleted: ${paymentType.name} (${paymentType.code})`);

    res.json({
      success: true,
      message: 'Payment type deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting payment type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete payment type',
    });
  }
};

// Toggle payment type active status
export const togglePaymentTypeStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const paymentType = await prisma.paymentType.findUnique({
      where: { id: parseInt(id) },
    });

    if (!paymentType) {
      return res.status(404).json({
        success: false,
        message: 'Payment type not found',
      });
    }

    const updated = await prisma.paymentType.update({
      where: { id: parseInt(id) },
      data: { isActive: !paymentType.isActive },
    });

    logger.info(`Payment type status toggled: ${updated.name} - ${updated.isActive ? 'Active' : 'Inactive'}`);

    res.json({
      success: true,
      message: `Payment type ${updated.isActive ? 'activated' : 'deactivated'} successfully`,
      data: updated,
    });
  } catch (error) {
    logger.error('Error toggling payment type status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle payment type status',
    });
  }
};
