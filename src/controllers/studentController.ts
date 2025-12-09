import { Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import logger from '../config/logger';
import { AuthRequest } from '../middleware/auth';

const studentSchema = z.object({
  matricNo: z.string(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string(),
  dateOfBirth: z.string().transform((val) => new Date(val)),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  address: z.string(),
  departmentId: z.number().int().positive(),
  currentLevel: z.number().int().positive().optional(),
  status: z.string().optional(),
});

export const createStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = studentSchema.parse(req.body);

    const existingStudent = await prisma.student.findFirst({
      where: {
        OR: [{ matricNo: data.matricNo }, { email: data.email }],
      },
    });

    if (existingStudent) {
      res.status(400).json({ error: 'Student with this matric number or email already exists' });
      return;
    }

    // Extract departmentId and handle it as a relation
    const { departmentId, status, ...restData } = data;
    
    const student = await prisma.student.create({
      data: {
        matricNo: data.matricNo,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        address: data.address,
        currentLevel: data.currentLevel,
        username: data.matricNo, // Use matricNo as username for manually created students
        status: (status as any) || 'ACTIVE',
        department: {
          connect: { id: departmentId }
        }
      },
      include: {
        department: true,
      },
    });

    logger.info(`New student created: ${student.matricNo}`);
    res.status(201).json(student);
  } catch (error) {
    logger.error('Create student error:', error);
    res.status(500).json({ error: 'Failed to create student' });
  }
};

export const getStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const departmentId = req.query.departmentId as string;
    const search = req.query.search as string;
    const level = req.query.level as string;
    const status = req.query.status as string;

    const skip = (page - 1) * limit;

    const where: any = {};

    if (departmentId) {
      where.departmentId = parseInt(departmentId);
    }

    if (level) {
      where.currentLevel = parseInt(level);
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { matricNo: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: {
          department: true,
          _count: {
            select: {
              courseRegistrations: true,
              scores: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { enrollmentDate: 'desc' },
      }),
      prisma.student.count({ where }),
    ]);

    res.json({
      data: students,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Get students error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
};

export const getStudentById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const student = await prisma.student.findUnique({
      where: { id: parseInt(id) },
      include: {
        department: true,
        courseRegistrations: {
          include: {
            course: true,
          },
        },
        scores: {
          include: {
            exam: {
              include: {
                course: true,
              },
            },
          },
        },
      },
    });

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    res.json(student);
  } catch (error) {
    logger.error('Get student error:', error);
    res.status(500).json({ error: 'Failed to fetch student' });
  }
};

export const updateStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data = studentSchema.partial().parse(req.body);

    // Extract departmentId and status to handle separately
    const { departmentId, status, ...restData } = data;
    
    const updateData: any = { ...restData };
    
    if (status) {
      updateData.status = status as any;
    }
    
    if (departmentId) {
      updateData.department = {
        connect: { id: departmentId }
      };
    }

    const student = await prisma.student.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        department: true,
      },
    });

    logger.info(`Student updated: ${student.id}`);
    res.json(student);
  } catch (error) {
    logger.error('Update student error:', error);
    res.status(500).json({ error: 'Failed to update student' });
  }
};

export const deleteStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.student.delete({
      where: { id: parseInt(id) },
    });

    logger.info(`Student deleted: ${id}`);
    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    logger.error('Delete student error:', error);
    res.status(500).json({ error: 'Failed to delete student' });
  }
};

export const getStudentTranscript = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const student = await prisma.student.findUnique({
      where: { id: parseInt(id) },
      include: {
        department: true,
        scores: {
          include: {
            exam: {
              include: {
                course: true,
              },
            },
          },
          orderBy: {
            exam: {
              examDate: 'desc',
            },
          },
        },
      },
    });

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const transcript = {
      student: {
        id: student.id,
        matricNo: student.matricNo,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        department: student.department.name,
        currentLevel: student.currentLevel,
      },
      scores: student.scores.map((score) => ({
        courseCode: score.exam.course.code,
        courseTitle: score.exam.course.title,
        credits: score.exam.course.credits,
        examTitle: score.exam.title,
        examDate: score.exam.examDate,
        score: score.score,
        grade: score.grade,
        academicYear: score.exam.academicYear,
        semester: score.exam.semester,
      })),
      summary: {
        totalCourses: student.scores.length,
        averageScore:
          student.scores.reduce((acc, s) => acc + s.score, 0) / student.scores.length || 0,
      },
    };

    res.json(transcript);
  } catch (error) {
    logger.error('Get transcript error:', error);
    res.status(500).json({ error: 'Failed to fetch transcript' });
  }
};
