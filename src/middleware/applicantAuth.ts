import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../config/logger';
import { ApplicantAuthRequest } from '../types/express';
import prisma from '../config/database';

export const applicantAuth = async (
  req: ApplicantAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Applicant auth failed: No token provided', {
        path: req.path,
        method: req.method,
        authHeader: authHeader ? 'exists but invalid format' : 'missing',
      });
      res.status(401).json({
        success: false,
        message: 'No token provided. Please log in.',
      });
      return;
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      logger.warn('Applicant auth failed: Empty token', {
        path: req.path,
        method: req.method,
      });
      res.status(401).json({
        success: false,
        message: 'Invalid token format. Please log in again.',
      });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: number;
      email: string;
      username: string;
    };

    // Fetch the full applicant data from the database
    const applicant = await prisma.applicant.findUnique({
      where: { id: decoded.id },
    });

    if (!applicant) {
      logger.warn('Applicant not found in database', {
        applicantId: decoded.id,
        path: req.path,
        method: req.method,
      });
      res.status(401).json({
        success: false,
        message: 'Applicant not found. Please log in again.',
      });
      return;
    }

    req.applicant = applicant;
    logger.info('Applicant authenticated successfully', {
      applicantId: applicant.id,
      email: applicant.email,
    });
    next();
  } catch (error: any) {
    logger.error('Applicant auth error:', {
      error: error.message,
      name: error.name,
      path: req.path,
      method: req.method,
    });
    
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        message: 'Token has expired. Please log in again.',
        code: 'TOKEN_EXPIRED',
      });
      return;
    }
    
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token. Please log in again.',
    });
  }
};
