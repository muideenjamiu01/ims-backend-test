import { Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import logger from '../config/logger';
import { AuthRequest } from '../middleware/auth';

const courseSchema = z.object({
  code: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  credits: z.number().int().positive(),
  departmentId: z.number().int().positive(),
  level: z.number().int().positive(),
  semester: z.number().int().min(1).max(2),
});

const courseRegistrationSchema = z.object({
  studentId: z.number().int().positive(),
  courseId: z.number().int().positive(),
  academicYear: z.string(),
  semester: z.number().int().min(1).max(2),
});

export const createCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = courseSchema.parse(req.body);

    const existingCourse = await prisma.course.findUnique({
      where: { code: data.code },
    });

    if (existingCourse) {
      res.status(400).json({ error: 'Course with this code already exists' });
      return;
    }

    const course = await prisma.course.create({
      data: {
        code: data.code,
        title: data.title,
        description: data.description,
        credits: data.credits,
        departmentId: data.departmentId,
        level: data.level,
        semester: data.semester,
      },
      include: {
        department: true,
      },
    });

    logger.info(`New course created: ${course.code}`);
    res.status(201).json(course);
  } catch (error) {
    logger.error('Create course error:', error);
    res.status(500).json({ error: 'Failed to create course' });
  }
};

export const getCourses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const departmentId = req.query.departmentId as string;
    const level = req.query.level as string;
    const semester = req.query.semester as string;
    const search = req.query.search as string;

    const skip = (page - 1) * limit;

    const where: any = {};

    if (departmentId) {
      where.departmentId = parseInt(departmentId);
    }

    if (level) {
      where.level = parseInt(level);
    }

    if (semester) {
      where.semester = parseInt(semester);
    }

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        include: {
          department: true,
          _count: {
            select: {
              courseRegistrations: true,
              exams: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: [{ level: 'asc' }, { semester: 'asc' }, { code: 'asc' }],
      }),
      prisma.course.count({ where }),
    ]);

    res.json({
      data: courses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Get courses error:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
};

export const getCourseById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const course = await prisma.course.findUnique({
      where: { id: parseInt(id) },
      include: {
        department: true,
        courseRegistrations: {
          include: {
            student: true,
          },
        },
        exams: true,
      },
    });

    if (!course) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }

    res.json(course);
  } catch (error) {
    logger.error('Get course error:', error);
    res.status(500).json({ error: 'Failed to fetch course' });
  }
};

export const updateCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data = courseSchema.partial().parse(req.body);

    const course = await prisma.course.update({
      where: { id: parseInt(id) },
      data,
      include: {
        department: true,
      },
    });

    logger.info(`Course updated: ${course.id}`);
    res.json(course);
  } catch (error) {
    logger.error('Update course error:', error);
    res.status(500).json({ error: 'Failed to update course' });
  }
};

export const deleteCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.course.delete({
      where: { id: parseInt(id) },
    });

    logger.info(`Course deleted: ${id}`);
    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    logger.error('Delete course error:', error);
    res.status(500).json({ error: 'Failed to delete course' });
  }
};

export const registerCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = courseRegistrationSchema.parse(req.body);

    const student = await prisma.student.findUnique({
      where: { id: data.studentId },
    });

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const course = await prisma.course.findUnique({
      where: { id: data.courseId },
    });

    if (!course) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }

    const existingRegistration = await prisma.courseRegistration.findUnique({
      where: {
        studentId_courseId_academicYear_semester: {
          studentId: data.studentId,
          courseId: data.courseId,
          academicYear: data.academicYear,
          semester: data.semester,
        },
      },
    });

    if (existingRegistration) {
      res.status(400).json({ error: 'Student already registered for this course' });
      return;
    }

    const registration = await prisma.courseRegistration.create({
      data: {
        studentId: data.studentId,
        courseId: data.courseId,
        academicYear: data.academicYear,
        semester: data.semester,
      },
      include: {
        student: true,
        course: true,
      },
    });

    logger.info(
      `Course registration: Student ${data.studentId} registered for course ${data.courseId}`
    );
    res.status(201).json(registration);
  } catch (error) {
    logger.error('Register course error:', error);
    res.status(500).json({ error: 'Failed to register course' });
  }
};

export const getStudentCourses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { studentId } = req.params;
    const academicYear = req.query.academicYear as string;
    const semester = req.query.semester as string;

    const where: any = {
      studentId: parseInt(studentId),
    };

    if (academicYear) {
      where.academicYear = academicYear;
    }

    if (semester) {
      where.semester = parseInt(semester);
    }

    const registrations = await prisma.courseRegistration.findMany({
      where,
      include: {
        course: {
          include: {
            department: true,
          },
        },
      },
      orderBy: [{ academicYear: 'desc' }, { semester: 'desc' }],
    });

    res.json(registrations);
  } catch (error) {
    logger.error('Get student courses error:', error);
    res.status(500).json({ error: 'Failed to fetch student courses' });
  }
};
