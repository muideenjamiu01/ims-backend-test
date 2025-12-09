import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { z } from "zod";
import prisma from "../config/database";
import logger from "../config/logger";
import { generateResetToken } from "../utils/helpers";
import { sendPasswordResetEmail, sendWelcomeEmail } from "../utils/email";

const registerSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(6),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8),
});

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
});

// Generate a random temporary password
const generateTempPassword = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// Generate username in format IMS2025-00456
const generateUsername = async (
  firstName: string,
  lastName: string
): Promise<string> => {
  const currentYear = new Date().getFullYear();
  
  // Get the last applicant to determine the next number
  const lastApplicant = await prisma.applicant.findFirst({
    orderBy: { id: 'desc' },
    select: { id: true },
  });
  
  const nextNumber = (lastApplicant?.id || 0) + 1;
  const username = `IMS${currentYear}-${String(nextNumber).padStart(5, '0')}`;
  
  return username;
};

const generateAccessToken = (applicant: {
  id: number;
  email: string;
  username: string;
}) => {
  return jwt.sign(
    {
      id: applicant.id,
      email: applicant.email,
      username: applicant.username,
    },
    process.env.JWT_SECRET!,
    { expiresIn: "15m" } as SignOptions
  );
};

const generateRefreshToken = (applicant: {
  id: number;
  email: string;
  username: string;
}) => {
  return jwt.sign(
    {
      id: applicant.id,
      email: applicant.email,
      username: applicant.username,
    },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: "7d" } as SignOptions
  );
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = registerSchema.parse(req.body);

    // Check if applicant already exists with email
    const existingApplicant = await prisma.applicant.findUnique({
      where: { email: data.email },
    });

    if (existingApplicant) {
      res.status(400).json({
        success: false,
        message: "An account with this email already exists",
      });
      return;
    }

    // Check if phone number already exists
    const existingPhone = await prisma.applicant.findFirst({
      where: { phone: data.phone },
    });

    if (existingPhone) {
      res.status(400).json({
        success: false,
        message: "An account with this phone number already exists",
      });
      return;
    }

    // Generate username and temporary password
    const username = await generateUsername(data.firstName, data.lastName);
    const tempPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Create applicant
    const applicant = await prisma.applicant.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        username,
        password: hashedPassword,
      },
      include: {
        admissionDecision: true,
      },
    });

    logger.info(
      `New applicant registered: ${applicant.username} (${applicant.email})`
    );

    // Send welcome email with credentials
    await sendWelcomeEmail(
      applicant.email,
      applicant.firstName,
      username,
      tempPassword
    );

    res.status(201).json({
      success: true,
      message: "Registration successful! Please save your login credentials.",
      data: {
        username,
        temporaryPassword: tempPassword,
        message:
          "Please use these credentials to log in and complete your application. You can change your password after logging in.",
      },
    });
  } catch (error: any) {
    logger.error("Applicant registration error:", error);
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.errors,
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: "Registration failed. Please try again.",
    });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = loginSchema.parse(req.body);

    const applicant = await prisma.applicant.findUnique({
      where: { username: data.username },
      include: {
        admissionDecision: true,
        matricNumber: true,
      },
    });

    if (!applicant || !applicant.password) {
      res.status(400).json({
        success: false,
        message: "Invalid username. Please check and try again.",
      });
      return;
    }

    const isPasswordValid = await bcrypt.compare(
      data.password,
      applicant.password
    );

    if (!isPasswordValid) {
      res.status(400).json({
        success: false,
        message: "Incorrect password. Please try again or use 'Forgot password' to reset.",
      });
      return;
    }

    const accessToken = generateAccessToken(applicant);
    const refreshToken = generateRefreshToken(applicant);

    // Save refresh token
    await prisma.applicant.update({
      where: { id: applicant.id },
      data: { refreshToken },
    });

    logger.info(`Applicant login successful: ${applicant.username}`);

    res.json({
      success: true,
      message: "Login successful",
      data: {
        accessToken,
        refreshToken,
        applicant: {
          id: applicant.id,
          username: applicant.username,
          firstName: applicant.firstName,
          lastName: applicant.lastName,
          email: applicant.email,
          phone: applicant.phone,
          applicationStatus: applicant.admissionDecision?.status || "PENDING",
          hasMatricNumber: !!applicant.matricNumber,
          matricNo: applicant.matricNumber?.matricNo || null,
          applicationFeePaid: applicant.applicationFeePaid,
          acceptanceFeePaid: applicant.acceptanceFeePaid,
        },
      },
    });
  } catch (error: any) {
    logger.error("Applicant login error:", error);
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.errors,
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: "Login failed. Please try again.",
    });
  }
};

export const refreshToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(401).json({
        success: false,
        message: "Refresh token required",
      });
      return;
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET!
    ) as {
      id: number;
      email: string;
      username: string;
    };

    const applicant = await prisma.applicant.findUnique({
      where: { id: decoded.id },
    });

    if (!applicant || applicant.refreshToken !== refreshToken) {
      res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
      return;
    }

    const newAccessToken = generateAccessToken(applicant);
    const newRefreshToken = generateRefreshToken(applicant);

    await prisma.applicant.update({
      where: { id: applicant.id },
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
    logger.error("Refresh token error:", error);
    res.status(401).json({
      success: false,
      message: "Invalid or expired refresh token",
    });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({
        success: false,
        message: "No token provided",
      });
      return;
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: number;
    };

    await prisma.applicant.update({
      where: { id: decoded.id },
      data: { refreshToken: null },
    });

    res.json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    logger.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
};

export const forgotPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);

    const applicant = await prisma.applicant.findUnique({
      where: { email },
    });

    // Always return success to prevent email enumeration
    if (!applicant) {
      res.json({
        success: true,
        message:
          "If an account exists with this email, a password reset link will be sent.",
      });
      return;
    }

    const resetToken = generateResetToken();
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    await prisma.applicant.update({
      where: { email },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    // Send password reset email
    await sendPasswordResetEmail(email, resetToken);

    logger.info(`Password reset requested for: ${applicant.username}`);

    res.json({
      success: true,
      message:
        "If an account exists with this email, a password reset link will be sent.",
    });
  } catch (error) {
    logger.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process request",
    });
  }
};

export const resetPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);

    const applicant = await prisma.applicant.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!applicant) {
      res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.applicant.update({
      where: { id: applicant.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    // Also update student password if student account exists
    const student = await prisma.student.findFirst({
      where: { email: applicant.email },
    });

    if (student) {
      await prisma.student.update({
        where: { id: student.id },
        data: { password: hashedPassword },
      });
      logger.info(`Password also reset for student: ${student.matricNo}`);
    }

    logger.info(`Password reset successful for: ${applicant.username}`);

    res.json({
      success: true,
      message: "Password reset successful",
    });
  } catch (error) {
    logger.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reset password",
    });
  }
};

export const changePassword = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const data = changePasswordSchema.parse(req.body);
    const applicantId = req.applicant?.id;

    if (!applicantId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
    });

    if (!applicant || !applicant.password) {
      res.status(404).json({
        success: false,
        message: "Applicant not found",
      });
      return;
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      data.currentPassword,
      applicant.password
    );

    if (!isCurrentPasswordValid) {
      res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(data.newPassword, 10);

    await prisma.applicant.update({
      where: { id: applicantId },
      data: { password: hashedPassword },
    });

    // Also update student password if student account exists
    const student = await prisma.student.findFirst({
      where: { email: applicant.email },
    });

    if (student) {
      await prisma.student.update({
        where: { id: student.id },
        data: { password: hashedPassword },
      });
      logger.info(`Password also updated for student: ${student.matricNo}`);
    }

    logger.info(`Password changed for: ${applicant.username}`);

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    logger.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to change password",
    });
  }
};
