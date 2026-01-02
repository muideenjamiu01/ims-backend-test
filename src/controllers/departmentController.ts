import { Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import logger from '../config/logger';
import { AuthRequest } from '../middleware/auth';

const departmentSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
});

export const createDepartment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = departmentSchema.parse(req.body);

    const existingDepartment = await prisma.department.findFirst({
      where: {
        OR: [{ name: data.name }, { code: data.code }],
      },
    });

    if (existingDepartment) {
      res.status(400).json({ error: 'Department with this name or code already exists' });
      return;
    }

    const department = await prisma.department.create({
      data: {
        name: data.name,
        code: data.code,
        description: data.description,
      },
    });

    logger.info(`New department created: ${department.name}`);
    res.status(201).json(department);
  } catch (error) {
    logger.error('Create department error:', error);
    res.status(500).json({ error: 'Failed to create department' });
  }
};

export const getDepartments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string;

    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [departments, total] = await Promise.all([
      prisma.department.findMany({
        where,
        include: {
          _count: {
            select: {
              students: true,
              courses: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.department.count({ where }),
    ]);

    res.json({
      data: departments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Get departments error:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
};

export const getDepartmentById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const department = await prisma.department.findUnique({
      where: { id: parseInt(id) },
      include: {
        students: {
          take: 10,
        },
        courses: {
          take: 10,
        },
        _count: {
          select: {
            students: true,
            courses: true,
          },
        },
      },
    });

    if (!department) {
      res.status(404).json({ error: 'Department not found' });
      return;
    }

    res.json(department);
  } catch (error) {
    logger.error('Get department error:', error);
    res.status(500).json({ error: 'Failed to fetch department' });
  }
};

export const updateDepartment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data = departmentSchema.partial().parse(req.body);

    const department = await prisma.department.update({
      where: { id: parseInt(id) },
      data,
    });

    logger.info(`Department updated: ${department.id}`);
    res.json(department);
  } catch (error) {
    logger.error('Update department error:', error);
    res.status(500).json({ error: 'Failed to update department' });
  }
};

export const deleteDepartment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const studentsCount = await prisma.student.count({
      where: { departmentId: parseInt(id) },
    });

    if (studentsCount > 0) {
      res.status(400).json({ 
        error: 'Cannot delete department with enrolled students. Please reassign students first.' 
      });
      return;
    }

    await prisma.department.delete({
      where: { id: parseInt(id) },
    });

    logger.info(`Department deleted: ${id}`);
    res.json({ message: 'Department deleted successfully' });
  } catch (error) {
    logger.error('Delete department error:', error);
    res.status(500).json({ error: 'Failed to delete department' });
  }
};
