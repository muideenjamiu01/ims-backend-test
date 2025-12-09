import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// Department codes mapping
export const DEPARTMENT_CODES: Record<string, string> = {
  'Accounting': 'ACC',
  'Business Administration': 'BUS',
  'Economics': 'ECO',
  'Mass Communication': 'MCO',
  'Political Science': 'POL',
  'International Relations': 'INR',
  'Biochemistry': 'BCH',
  'Microbiology': 'MCB',
  'Applied Physics': 'APY',
  'Physics with Electronics': 'PWE',
  'Computer Science': 'CSC',
  'Public Health': 'PUH',
  'Law': 'LAW',
};

/**
 * Generate matric number: SUN25/{DeptCode}/{Random4Digits}/{Random3Digits}
 * Example: SUN25/CSC/0103/803
 */
export const generateMatricNumber = (departmentName: string): string => {
  const year = new Date().getFullYear().toString().slice(-2);
  const deptCode = DEPARTMENT_CODES[departmentName] || 'GEN';
  
  // Generate random 4 digits
  const random4 = Math.floor(1000 + Math.random() * 9000);
  
  // Generate random 3 digits
  const random3 = Math.floor(100 + Math.random() * 900);
  
  return `SUN${year}/${deptCode}/${random4}/${random3}`;
};

/**
 * Generate unique invoice number: INV{YEAR}{6RANDOMDIGITS}
 * Example: INV2026781406
 */
export const generateInvoiceNumber = (): string => {
  const year = new Date().getFullYear();
  const random6 = Math.floor(100000 + Math.random() * 900000);
  return `INV${year}${random6}`;
};

/**
 * Generate payment reference
 */
export const generatePaymentReference = (): string => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `PAY-${timestamp}-${random}`;
};

/**
 * Generate unique token for password reset
 */
export const generateResetToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Generate random password
 */
export const generateRandomPassword = (length: number = 12): string => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

/**
 * Calculate grade from score
 */
export const calculateGrade = (score: number): { grade: string; gradePoint: number } => {
  if (score >= 70) return { grade: 'A', gradePoint: 5.0 };
  if (score >= 60) return { grade: 'B', gradePoint: 4.0 };
  if (score >= 50) return { grade: 'C', gradePoint: 3.0 };
  if (score >= 45) return { grade: 'D', gradePoint: 2.0 };
  if (score >= 40) return { grade: 'E', gradePoint: 1.0 };
  return { grade: 'F', gradePoint: 0.0 };
};

/**
 * Calculate GPA from results
 */
export const calculateGPA = (results: Array<{ score: number; credits: number }>): number => {
  let totalPoints = 0;
  let totalCredits = 0;

  results.forEach(result => {
    const { gradePoint } = calculateGrade(result.score);
    totalPoints += gradePoint * result.credits;
    totalCredits += result.credits;
  });

  return totalCredits > 0 ? totalPoints / totalCredits : 0;
};

/**
 * Format currency in Naira
 */
export const formatCurrency = (amount: number): string => {
  return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Convert amount to kobo (for Paystack)
 */
export const toKobo = (amount: number): number => {
  return Math.round(amount * 100);
};

/**
 * Convert kobo to naira
 */
export const fromKobo = (kobo: number): number => {
  return kobo / 100;
};

/**
 * Parse prerequisites string
 */
export const parsePrerequisites = (prerequisite: string | null): string[] => {
  if (!prerequisite) return [];
  return prerequisite.split(',').map(p => p.trim()).filter(p => p.length > 0);
};

/**
 * Format academic session
 */
export const formatSession = (year: number): string => {
  return `${year}/${year + 1}`;
};

/**
 * Get current academic session
 */
export const getCurrentSession = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  // If between January and August, use previous year as start
  const startYear = month < 8 ? year - 1 : year;
  return formatSession(startYear);
};
