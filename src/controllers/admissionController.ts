import { Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import logger from '../config/logger';
import { AuthRequest } from '../middleware/auth';
import { sendAdmissionApprovalEmail } from '../utils/email';

const applicantSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string(),
  dateOfBirth: z.string().transform((val) => new Date(val)),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  address: z.string(),
  previousSchool: z.string(),
  gradeAverage: z.number().min(0).max(100),
});

const admissionDecisionSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  decisionReason: z.string().optional(),
});

export const createApplicant = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = applicantSchema.parse(req.body);

    const existingApplicant = await prisma.applicant.findUnique({
      where: { email: data.email },
    });

    if (existingApplicant) {
      res.status(400).json({ error: 'Applicant with this email already exists' });
      return;
    }

    // Generate username in format IMS2025-00456
    const currentYear = new Date().getFullYear();
    
    // Get the last applicant to determine the next number
    const lastApplicant = await prisma.applicant.findFirst({
      orderBy: { id: 'desc' },
      select: { id: true },
    });
    
    const nextNumber = (lastApplicant?.id || 0) + 1;
    const username = `IMS${currentYear}-${String(nextNumber).padStart(5, '0')}`;

    const applicant = await prisma.applicant.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        address: data.address,
        previousSchool: data.previousSchool,
        gradeAverage: data.gradeAverage,
        username,
        admissionDecision: {
          create: {
            status: 'PENDING',
          },
        },
      },
      include: {
        admissionDecision: true,
      },
    });

    logger.info(`New applicant created: ${applicant.email}`);
    res.status(201).json(applicant);
  } catch (error) {
    logger.error('Create applicant error:', error);
    res.status(500).json({ error: 'Failed to create applicant' });
  }
};

export const getApplicants = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const search = req.query.search as string;

    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) {
      where.admissionDecision = { status };
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [applicants, total] = await Promise.all([
      prisma.applicant.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          dateOfBirth: true,
          gender: true,
          address: true,
          previousSchool: true,
          gradeAverage: true,
          programType: true,
          departmentId: true,
          programId: true,
          applicationDate: true,
          username: true,
          acceptanceFeePaid: true,
          applicationFeePaid: true,
          passportPhoto: true,
          academicDocument: true,
          additionalDocument: true,
          admissionDecision: true,
          matricNumber: true,
          department: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          program: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { applicationDate: 'desc' },
      }),
      prisma.applicant.count({ where }),
    ]);

    res.json({
      data: applicants,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Get applicants error:', error);
    res.status(500).json({ error: 'Failed to fetch applicants' });
  }
};

export const getApplicantById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const applicant = await prisma.applicant.findUnique({
      where: { id: parseInt(id) },
      include: {
        admissionDecision: true,
        department: true,
        program: true,
        matricNumber: {
          include: {
            student: true,
          },
        },
      },
    });

    if (!applicant) {
      res.status(404).json({ error: 'Applicant not found' });
      return;
    }

    res.json(applicant);
  } catch (error) {
    logger.error('Get applicant error:', error);
    res.status(500).json({ error: 'Failed to fetch applicant' });
  }
};

export const updateApplicant = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data = applicantSchema.partial().parse(req.body);

    const applicant = await prisma.applicant.update({
      where: { id: parseInt(id) },
      data,
      include: {
        admissionDecision: true,
      },
    });

    logger.info(`Applicant updated: ${applicant.id}`);
    res.json(applicant);
  } catch (error) {
    logger.error('Update applicant error:', error);
    res.status(500).json({ error: 'Failed to update applicant' });
  }
};

export const deleteApplicant = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.applicant.delete({
      where: { id: parseInt(id) },
    });

    logger.info(`Applicant deleted: ${id}`);
    res.json({ message: 'Applicant deleted successfully' });
  } catch (error) {
    logger.error('Delete applicant error:', error);
    res.status(500).json({ error: 'Failed to delete applicant' });
  }
};

export const makeAdmissionDecision = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const data = admissionDecisionSchema.parse(req.body);

    const applicant = await prisma.applicant.findUnique({
      where: { id: parseInt(id) },
      include: { admissionDecision: true },
    });

    if (!applicant) {
      res.status(404).json({ error: 'Applicant not found' });
      return;
    }

    const decision = await prisma.admissionDecision.upsert({
      where: { applicantId: parseInt(id) },
      create: {
        applicantId: parseInt(id),
        status: data.status,
        decisionDate: new Date(),
        decisionReason: data.decisionReason,
        decidedBy: req.user?.email,
      },
      update: {
        status: data.status,
        decisionDate: new Date(),
        decisionReason: data.decisionReason,
        decidedBy: req.user?.email,
      },
    });

      // If approved, send approval email (matric number will be generated after acceptance fee payment)
    if (data.status === 'APPROVED') {
      try {
        await sendAdmissionApprovalEmail(
          applicant.email,
          `${applicant.firstName} ${applicant.lastName}`
        );
      } catch (emailError) {
        logger.error('Failed to send admission approval email:', emailError);
        // Continue even if email fails
      }
    }

    logger.info(`Admission decision made for applicant ${id}: ${data.status}`);
    res.json(decision);
  } catch (error) {
    logger.error('Admission decision error:', error);
    res.status(500).json({ error: 'Failed to make admission decision' });
  }
};

export const convertToStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { departmentId } = req.body;

    if (!departmentId) {
      res.status(400).json({ error: 'Department ID is required' });
      return;
    }

    const applicant = await prisma.applicant.findUnique({
      where: { id: parseInt(id) },
      include: {
        admissionDecision: true,
        matricNumber: true,
      },
    });

    if (!applicant) {
      res.status(404).json({ error: 'Applicant not found' });
      return;
    }

    if (applicant.admissionDecision?.status !== 'APPROVED') {
      res.status(400).json({ error: 'Applicant must be approved first' });
      return;
    }

    if (!applicant.matricNumber) {
      res.status(400).json({ error: 'Matric number not generated' });
      return;
    }

    if (applicant.matricNumber.studentId) {
      res.status(400).json({ error: 'Applicant already converted to student' });
      return;
    }

    // Validate required fields
    if (!applicant.dateOfBirth || !applicant.gender || !applicant.address) {
      res.status(400).json({ 
        error: 'Applicant must complete profile (dateOfBirth, gender, address) before conversion' 
      });
      return;
    }

    const student = await prisma.student.create({
      data: {
        username: applicant.matricNumber.matricNo, // Use matricNo as username for students
        matricNo: applicant.matricNumber.matricNo,
        firstName: applicant.firstName,
        lastName: applicant.lastName,
        email: applicant.email,
        phone: applicant.phone,
        password: applicant.password, // Transfer password from applicant
        dateOfBirth: applicant.dateOfBirth,
        gender: applicant.gender,
        address: applicant.address,
        departmentId: parseInt(departmentId),
        profilePicture: applicant.passportPhoto, // Transfer passport photo as profile picture
      },
      include: {
        department: true,
      },
    });

    await prisma.matricNumber.update({
      where: { id: applicant.matricNumber.id },
      data: { studentId: student.id },
    });

    logger.info(`Applicant ${id} converted to student ${student.id}`);
    res.status(201).json(student);
  } catch (error) {
    logger.error('Convert to student error:', error);
    res.status(500).json({ error: 'Failed to convert applicant to student' });
  }
};

export const bulkApprove = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { applicantIds } = req.body;

    if (!applicantIds || !Array.isArray(applicantIds) || applicantIds.length === 0) {
      res.status(400).json({ error: 'Applicant IDs array is required' });
      return;
    }

    const updates = applicantIds.map((id: number) =>
      prisma.admissionDecision.upsert({
        where: { applicantId: id },
        create: {
          applicantId: id,
          status: 'APPROVED',
          decisionDate: new Date(),
          decidedBy: req.user?.email,
        },
        update: {
          status: 'APPROVED',
          decisionDate: new Date(),
          decidedBy: req.user?.email,
        },
      })
    );

    await Promise.all(updates);

    // Send approval emails
    const applicants = await prisma.applicant.findMany({
      where: { id: { in: applicantIds } },
    });

    for (const applicant of applicants) {
      try {
        await sendAdmissionApprovalEmail(
          applicant.email,
          `${applicant.firstName} ${applicant.lastName}`
        );
      } catch (emailError) {
        logger.error(`Failed to send email to ${applicant.email}:`, emailError);
      }
    }

    logger.info(`Bulk approved ${applicantIds.length} applicants`);
    res.json({ message: `${applicantIds.length} applicants approved successfully` });
  } catch (error) {
    logger.error('Bulk approve error:', error);
    res.status(500).json({ error: 'Failed to bulk approve applicants' });
  }
};

export const bulkReject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { applicantIds, decisionReason } = req.body;

    if (!applicantIds || !Array.isArray(applicantIds) || applicantIds.length === 0) {
      res.status(400).json({ error: 'Applicant IDs array is required' });
      return;
    }

    const updates = applicantIds.map((id: number) =>
      prisma.admissionDecision.upsert({
        where: { applicantId: id },
        create: {
          applicantId: id,
          status: 'REJECTED',
          decisionDate: new Date(),
          decidedBy: req.user?.email,
          decisionReason,
        },
        update: {
          status: 'REJECTED',
          decisionDate: new Date(),
          decidedBy: req.user?.email,
          decisionReason,
        },
      })
    );

    await Promise.all(updates);

    logger.info(`Bulk rejected ${applicantIds.length} applicants`);
    res.json({ message: `${applicantIds.length} applicants rejected successfully` });
  } catch (error) {
    logger.error('Bulk reject error:', error);
    res.status(500).json({ error: 'Failed to bulk reject applicants' });
  }
};

export const bulkDelete = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { applicantIds } = req.body;

    if (!applicantIds || !Array.isArray(applicantIds) || applicantIds.length === 0) {
      res.status(400).json({ error: 'Applicant IDs array is required' });
      return;
    }

    await prisma.applicant.deleteMany({
      where: { id: { in: applicantIds } },
    });

    logger.info(`Bulk deleted ${applicantIds.length} applicants`);
    res.json({ message: `${applicantIds.length} applicants deleted successfully` });
  } catch (error) {
    logger.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Failed to bulk delete applicants' });
  }
};

export const getAdmissionSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [
      totalApplicants,
      approvedCount,
      rejectedCount,
      pendingCount,
      applicationFeePaidCount,
      acceptanceFeePaidCount,
    ] = await Promise.all([
      prisma.applicant.count(),
      prisma.admissionDecision.count({ where: { status: 'APPROVED' } }),
      prisma.admissionDecision.count({ where: { status: 'REJECTED' } }),
      prisma.admissionDecision.count({ where: { status: 'PENDING' } }),
      prisma.applicant.count({ where: { applicationFeePaid: true } }),
      prisma.applicant.count({ where: { acceptanceFeePaid: true } }),
    ]);

    const summary = {
      totalApplicants,
      approved: approvedCount,
      rejected: rejectedCount,
      pending: pendingCount,
      applicationFeePaid: applicationFeePaidCount,
      acceptanceFeePaid: acceptanceFeePaidCount,
    };

    res.json(summary);
  } catch (error) {
    logger.error('Get admission summary error:', error);
    res.status(500).json({ error: 'Failed to fetch admission summary' });
  }
};
