import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../config/database';
import logger from '../config/logger';
import { StudentAuthRequest } from '../middleware/studentAuth';
import { generateResetToken } from '../utils/helpers';
import { sendPasswordResetEmail } from '../utils/email';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(6),
});

const registerSchema = z.object({
  matricNo: z.string(),
  email: z.string().email(),
  password: z.string().min(8),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

// Generate Access Token (15 minutes)
const generateAccessToken = (student: { id: number; email: string; matricNo: string; username: string }) => {
  // @ts-expect-error - JWT options type inference issue
  return jwt.sign(
    {
      id: student.id,
      email: student.email,
      matricNo: student.matricNo,
      username: student.username,
      type: 'STUDENT',
    },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
};

// Generate Refresh Token (7 days)
const generateRefreshToken = (student: { id: number; email: string; matricNo: string; username: string }) => {
  // @ts-expect-error - JWT options type inference issue
  return jwt.sign(
    {
      id: student.id,
      email: student.email,
      matricNo: student.matricNo,
      username: student.username,
      type: 'STUDENT',
    },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
};

export const login = async (req: Request, res: Response) => {
  try {
    const data = loginSchema.parse(req.body);

    logger.info(`Student login attempt with username/matricNo: ${data.username}`);

    // Try to find student by username OR matricNo
    const student = await prisma.student.findFirst({
      where: {
        OR: [
          { username: data.username },
          { matricNo: data.username },
        ],
      },
      include: {
        department: true,
        program: true,
        currentSession: true,
      },
    });

    if (!student) {
      logger.warn(`Student not found with username/matricNo: ${data.username}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid matric number or username. Please check and try again.',
      });
    }

    if (!student.password) {
      logger.warn(`Student ${student.matricNo} has no password set`);
      return res.status(400).json({
        success: false,
        message: 'Your account password is not set. Please contact administration or use "Forgot Password".',
      });
    }

    const isPasswordValid = await bcrypt.compare(data.password, student.password);

    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Incorrect password. Please try again or use "Forgot password" to reset.',
      });
    }

    if (student.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: 'Your account is not active. Please contact administration.',
      });
    }

    const accessToken = generateAccessToken(student);
    const refreshToken = generateRefreshToken(student);

    // Save refresh token
    await prisma.student.update({
      where: { id: student.id },
      data: { refreshToken },
    });

    logger.info(`Student login successful: ${student.matricNo}`);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken,
        refreshToken,
        student: {
          id: student.id,
          matricNo: student.matricNo,
          firstName: student.firstName,
          lastName: student.lastName,
          email: student.email,
          department: student.department.name,
          program: student.program?.name,
          currentLevel: student.currentLevel,
          currentSession: student.currentSession?.name,
          profilePicture: student.profilePicture,
          walletBalance: student.walletBalance,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }

    logger.error('Student login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
    });
  }
};

export const register = async (req: Request, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);

    // Find student by matric number (created during admission approval)
    const existingStudent = await prisma.student.findUnique({
      where: { matricNo: data.matricNo },
    });

    if (!existingStudent) {
      return res.status(404).json({
        success: false,
        message: 'Matric number not found. Please contact administration.',
      });
    }

    if (existingStudent.password) {
      return res.status(400).json({
        success: false,
        message: 'This account has already been registered.',
      });
    }

    // Check if acceptance fee is paid
    if (!existingStudent.acceptanceFeePaid) {
      return res.status(402).json({
        success: false,
        message: 'Please pay your acceptance fee before registering.',
      });
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const student = await prisma.student.update({
      where: { matricNo: data.matricNo },
      data: {
        email: data.email,
        password: hashedPassword,
      },
      include: {
        department: true,
        program: true,
      },
    });

    logger.info(`Student registered: ${student.matricNo}`);

    res.status(201).json({
      success: true,
      message: 'Registration successful. You can now login.',
      data: {
        matricNo: student.matricNo,
        email: student.email,
        firstName: student.firstName,
        lastName: student.lastName,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }

    logger.error('Student registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
    });
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required',
      });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as {
      id: number;
      email: string;
      matricNo: string;
    };

    const student = await prisma.student.findUnique({
      where: { id: decoded.id },
    });

    if (!student || student.refreshToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
      });
    }

    const newAccessToken = generateAccessToken(student);
    const newRefreshToken = generateRefreshToken(student);

    // Update refresh token
    await prisma.student.update({
      where: { id: student.id },
      data: { refreshToken: newRefreshToken },
    });

    res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error) {
    logger.error('Refresh token error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token',
    });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const data = forgotPasswordSchema.parse(req.body);

    const student = await prisma.student.findUnique({
      where: { email: data.email },
    });

    if (!student) {
      // Don't reveal if email exists
      return res.json({
        success: true,
        message: 'If your email is registered, you will receive a password reset link.',
      });
    }

    const resetToken = generateResetToken();
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    await prisma.student.update({
      where: { id: student.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    await sendPasswordResetEmail(student.email, resetToken);

    logger.info(`Password reset requested for: ${student.matricNo}`);

    res.json({
      success: true,
      message: 'If your email is registered, you will receive a password reset link.',
    });
  } catch (error) {
    logger.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process request',
    });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const data = resetPasswordSchema.parse(req.body);

    const student = await prisma.student.findFirst({
      where: {
        resetToken: data.token,
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!student) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token',
      });
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    await prisma.student.update({
      where: { id: student.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    logger.info(`Password reset successful for: ${student.matricNo}`);

    res.json({
      success: true,
      message: 'Password reset successful. You can now login.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }

    logger.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password',
    });
  }
};

export const changePassword = async (req: StudentAuthRequest, res: Response) => {
  try {
    const data = changePasswordSchema.parse(req.body);
    const studentId = req.student!.id;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student || !student.password) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      data.currentPassword,
      student.password
    );

    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect. Please try again.',
      });
    }

    const hashedPassword = await bcrypt.hash(data.newPassword, 10);

    await prisma.student.update({
      where: { id: studentId },
      data: { password: hashedPassword },
    });

    logger.info(`Password changed for: ${student.matricNo}`);

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }

    logger.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
    });
  }
};

export const getProfile = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        department: true,
        program: true,
        currentSession: true,
      },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    res.json({
      success: true,
      data: {
        id: student.id,
        matricNo: student.matricNo,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        phone: student.phone,
        dateOfBirth: student.dateOfBirth,
        gender: student.gender,
        address: student.address,
        department: student.department.name,
        departmentCode: student.department.code,
        program: student.program?.name,
        currentLevel: student.currentLevel,
        currentSession: student.currentSession?.name,
        status: student.status,
        profilePicture: student.profilePicture,
        walletBalance: student.walletBalance,
        acceptanceFeePaid: student.acceptanceFeePaid,
        enrollmentDate: student.enrollmentDate,
      },
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
    });
  }
};

export const logout = async (req: StudentAuthRequest, res: Response) => {
  try {
    const studentId = req.student!.id;

    await prisma.student.update({
      where: { id: studentId },
      data: { refreshToken: null },
    });

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed',
    });
  }
};
