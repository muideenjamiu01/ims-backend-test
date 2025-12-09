import { Request } from 'express';
import { Role, Applicant, Student } from '@prisma/client';

// Extend Express Request types to include our custom properties
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        role: Role;
      };
      applicant?: Applicant;
      student?: Student;
    }
  }
}

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: Role;
  };
}

export interface ApplicantAuthRequest extends Request {
  applicant?: Applicant;
}

export interface StudentAuthRequest extends Request {
  student?: Student;
}