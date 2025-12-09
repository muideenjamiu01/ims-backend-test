import { Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import logger from '../config/logger';
import { AuthRequest } from '../middleware/auth';
import { GradeValue } from '@prisma/client';

const examSchema = z.object({
  courseId: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().optional(),
  examDate: z.string().transform((val) => new Date(val)),
  maxScore: z.number().positive().default(100),
  academicYear: z.string(),
  semester: z.number().int().min(1).max(2),
});

const scoreSchema = z.object({
  examId: z.number().int().positive(),
  studentId: z.number().int().positive(),
  score: z.number().min(0),
  remarks: z.string().optional(),
});

function calculateGrade(score: number, maxScore: number = 100): GradeValue {
  const percentage = (score / maxScore) * 100;

  if (percentage >= 70) return 'A';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  if (percentage >= 45) return 'D';
  if (percentage >= 40) return 'E';
  return 'F';
}

export const createExam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = examSchema.parse(req.body);

    const course = await prisma.course.findUnique({
      where: { id: data.courseId },
    });

    if (!course) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }

    const exam = await prisma.exam.create({
      data: {
        courseId: data.courseId,
        title: data.title,
        description: data.description,
        examDate: data.examDate,
        maxScore: data.maxScore,
        academicYear: data.academicYear,
        semester: data.semester,
      },
      include: {
        course: {
          include: {
            department: true,
          },
        },
      },
    });

    logger.info(`New exam created: ${exam.title} for course ${course.code}`);
    res.status(201).json(exam);
  } catch (error) {
    logger.error('Create exam error:', error);
    res.status(500).json({ error: 'Failed to create exam' });
  }
};

export const getExams = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const courseId = req.query.courseId as string;
    const academicYear = req.query.academicYear as string;
    const semester = req.query.semester as string;

    const skip = (page - 1) * limit;

    const where: any = {};

    if (courseId) {
      where.courseId = parseInt(courseId);
    }

    if (academicYear) {
      where.academicYear = academicYear;
    }

    if (semester) {
      where.semester = parseInt(semester);
    }

    const [exams, total] = await Promise.all([
      prisma.exam.findMany({
        where,
        include: {
          course: {
            include: {
              department: true,
            },
          },
          _count: {
            select: {
              scores: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { examDate: 'desc' },
      }),
      prisma.exam.count({ where }),
    ]);

    res.json({
      data: exams,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Get exams error:', error);
    res.status(500).json({ error: 'Failed to fetch exams' });
  }
};

export const getExamById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const exam = await prisma.exam.findUnique({
      where: { id: parseInt(id) },
      include: {
        course: {
          include: {
            department: true,
          },
        },
        scores: {
          include: {
            student: true,
          },
        },
      },
    });

    if (!exam) {
      res.status(404).json({ error: 'Exam not found' });
      return;
    }

    res.json(exam);
  } catch (error) {
    logger.error('Get exam error:', error);
    res.status(500).json({ error: 'Failed to fetch exam' });
  }
};

export const updateExam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data = examSchema.partial().parse(req.body);

    const exam = await prisma.exam.update({
      where: { id: parseInt(id) },
      data,
      include: {
        course: true,
      },
    });

    logger.info(`Exam updated: ${exam.id}`);
    res.json(exam);
  } catch (error) {
    logger.error('Update exam error:', error);
    res.status(500).json({ error: 'Failed to update exam' });
  }
};

export const deleteExam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.exam.delete({
      where: { id: parseInt(id) },
    });

    logger.info(`Exam deleted: ${id}`);
    res.json({ message: 'Exam deleted successfully' });
  } catch (error) {
    logger.error('Delete exam error:', error);
    res.status(500).json({ error: 'Failed to delete exam' });
  }
};

export const recordScore = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = scoreSchema.parse(req.body);

    const exam = await prisma.exam.findUnique({
      where: { id: data.examId },
    });

    if (!exam) {
      res.status(404).json({ error: 'Exam not found' });
      return;
    }

    const student = await prisma.student.findUnique({
      where: { id: data.studentId },
    });

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    if (data.score > exam.maxScore) {
      res.status(400).json({ error: `Score cannot exceed maximum score of ${exam.maxScore}` });
      return;
    }

    const grade = calculateGrade(data.score, exam.maxScore);

    const score = await prisma.score.upsert({
      where: {
        examId_studentId: {
          examId: data.examId,
          studentId: data.studentId,
        },
      },
      update: {
        score: data.score,
        grade,
        remarks: data.remarks,
      },
      create: {
        examId: data.examId,
        studentId: data.studentId,
        score: data.score,
        grade,
        remarks: data.remarks,
      },
      include: {
        exam: {
          include: {
            course: true,
          },
        },
        student: true,
      },
    });

    logger.info(
      `Score recorded: Student ${data.studentId}, Exam ${data.examId}, Score ${data.score}, Grade ${grade}`
    );
    res.status(201).json(score);
  } catch (error) {
    logger.error('Record score error:', error);
    res.status(500).json({ error: 'Failed to record score' });
  }
};

export const getExamScores = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { examId } = req.params;

    const scores = await prisma.score.findMany({
      where: { examId: parseInt(examId) },
      include: {
        student: {
          include: {
            department: true,
          },
        },
      },
      orderBy: { score: 'desc' },
    });

    res.json(scores);
  } catch (error) {
    logger.error('Get exam scores error:', error);
    res.status(500).json({ error: 'Failed to fetch exam scores' });
  }
};

export const getExamAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { examId } = req.params;

    const scores = await prisma.score.findMany({
      where: { examId: parseInt(examId) },
    });

    if (scores.length === 0) {
      res.json({
        totalStudents: 0,
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
        gradeDistribution: {},
      });
      return;
    }

    const scoreValues = scores.map((s) => s.score);
    const average = scoreValues.reduce((a, b) => a + b, 0) / scores.length;
    const highest = Math.max(...scoreValues);
    const lowest = Math.min(...scoreValues);

    const gradeDistribution = scores.reduce((acc: any, score) => {
      acc[score.grade] = (acc[score.grade] || 0) + 1;
      return acc;
    }, {});

    res.json({
      totalStudents: scores.length,
      averageScore: parseFloat(average.toFixed(2)),
      highestScore: highest,
      lowestScore: lowest,
      gradeDistribution,
    });
  } catch (error) {
    logger.error('Get exam analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch exam analytics' });
  }
};
