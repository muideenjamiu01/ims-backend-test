import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import logger from '../config/logger';
import { StudentAuthRequest } from '../types/express';

export const authenticateStudent = async (
  req: StudentAuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const token = authHeader.substring(7);

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: number;
      email: string;
      matricNo: string;
      type: string;
    };

    if (decoded.type !== 'STUDENT') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Students only.',
      });
    }

    // Verify student exists and is active
    const student = await prisma.student.findUnique({
      where: { id: decoded.id },
    });

    if (!student) {
      return res.status(401).json({
        success: false,
        message: 'Student not found',
      });
    }

    if (student.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: 'Account is not active',
      });
    }

    req.student = student;

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
      });
    }

    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        message: 'Token expired',
      });
    }

    logger.error('Student authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed',
    });
  }
};

export const verifyPaymentStatus = async (
  req: StudentAuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const studentId = req.student!.id;
    const currentDate = new Date();

    // Check for unpaid invoices
    const unpaidInvoices = await prisma.invoice.findMany({
      where: {
        studentId,
        balance: { gt: 0 },
        dueDate: { lt: currentDate },
      },
    });

    if (unpaidInvoices.length > 0) {
      return res.status(402).json({
        success: false,
        message: 'You have outstanding payments. Please clear your fees to continue.',
        unpaidInvoices: unpaidInvoices.map(inv => ({
          invoiceNo: inv.invoiceNo,
          type: inv.type,
          balance: inv.balance,
          dueDate: inv.dueDate,
        })),
      });
    }

    next();
  } catch (error) {
    logger.error('Payment verification error:', error);
    next(error);
  }
};
