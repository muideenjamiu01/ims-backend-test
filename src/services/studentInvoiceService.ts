import prisma from '../config/database';
import logger from '../config/logger';
import { InvoiceType } from '@prisma/client';

// Default fee structure - these could be made configurable per department/level
const DEFAULT_FEES = {
  SCHOOL_FEE: {
    100: 150000, // Level 100 (First year)
    200: 140000, // Level 200
    300: 140000, // Level 300 (HND entry level)
    400: 140000, // Level 400
    500: 180000, // Level 500 (Masters entry level)
    600: 180000, // Level 600
    700: 250000, // Level 700 (PhD entry level)
    800: 250000, // Level 800
  },
  TECHNOLOGY_FEE: {
    100: 25000,
    200: 25000,
    300: 25000,
    400: 25000,
    500: 30000,
    600: 30000,
    700: 35000,
    800: 35000,
  },
  EXAMINATION_FEE: {
    100: 15000,
    200: 15000,
    300: 15000,
    400: 15000,
    500: 20000,
    600: 20000,
    700: 25000,
    800: 25000,
  },
  DEVELOPMENT_FEE: {
    100: 20000,
    200: 20000,
    300: 20000,
    400: 20000,
    500: 25000,
    600: 25000,
    700: 30000,
    800: 30000,
  },
};

interface AutoInvoiceConfig {
  studentId: number;
  sessionId: number;
  semesterId?: number;
  level: number;
  programType?: string;
}

/**
 * Generate automatic invoices for a new student
 */
export const generateAutomaticInvoices = async (config: AutoInvoiceConfig) => {
  const { studentId, sessionId, semesterId, level, programType } = config;

  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { matricNo: true, firstName: true, lastName: true },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    const invoices = [];

    // Generate invoices for each fee type
    for (const [feeType, feeStructure] of Object.entries(DEFAULT_FEES)) {
      const amount = feeStructure[level as keyof typeof feeStructure];
      
      if (amount && amount > 0) {
        const invoiceNo = await generateInvoiceNumber();
        
        const invoice = await prisma.invoice.create({
          data: {
            invoiceNo,
            studentId,
            sessionId,
            semesterId,
            type: feeType as InvoiceType,
            description: getFeeDescription(feeType as InvoiceType, level),
            amount,
            balance: amount,
            level,
            status: 'PENDING',
            dueDate: getFeeDueDate(feeType as InvoiceType),
          },
        });

        invoices.push(invoice);
      }
    }

    logger.info(`Generated ${invoices.length} automatic invoices for student ${student.matricNo}`);
    return invoices;
  } catch (error) {
    logger.error('Error generating automatic invoices:', error);
    throw error;
  }
};

/**
 * Generate a unique invoice number
 */
const generateInvoiceNumber = async (): Promise<string> => {
  const currentYear = new Date().getFullYear();
  const prefix = `INV${currentYear}`;
  
  // Find the last invoice number for this year
  const lastInvoice = await prisma.invoice.findFirst({
    where: {
      invoiceNo: {
        startsWith: prefix,
      },
    },
    orderBy: {
      invoiceNo: 'desc',
    },
  });

  let nextNumber = 1;
  if (lastInvoice) {
    const lastNumber = parseInt(lastInvoice.invoiceNo.replace(prefix, ''));
    nextNumber = lastNumber + 1;
  }

  return `${prefix}${nextNumber.toString().padStart(6, '0')}`;
};

/**
 * Get description for fee type
 */
const getFeeDescription = (feeType: InvoiceType, level: number): string => {
  const levelName = getLevelName(level);
  
  switch (feeType) {
    case 'SCHOOL_FEE':
      return `School Fee for ${levelName}`;
    case 'TECHNOLOGY_FEE':
      return `Technology Fee for ${levelName}`;
    case 'EXAMINATION_FEE':
      return `Examination Fee for ${levelName}`;
    case 'DEVELOPMENT_FEE':
      return `Development Fee for ${levelName}`;
    default:
      return `${feeType.replace('_', ' ')} for ${levelName}`;
  }
};

/**
 * Get level name for display
 */
const getLevelName = (level: number): string => {
  const levelMap: { [key: number]: string } = {
    100: '100 Level (Year 1)',
    200: '200 Level (Year 2)',
    300: '300 Level (Year 3/HND 1)',
    400: '400 Level (Year 4/HND 2)',
    500: '500 Level (Masters 1)',
    600: '600 Level (Masters 2)',
    700: '700 Level (PhD 1)',
    800: '800 Level (PhD 2)',
  };
  
  return levelMap[level] || `${level} Level`;
};

/**
 * Get due date for different fee types
 */
const getFeeDueDate = (feeType: InvoiceType): Date => {
  const now = new Date();
  const dueDate = new Date(now);
  
  switch (feeType) {
    case 'SCHOOL_FEE':
      // School fee due 3 months from enrollment
      dueDate.setMonth(now.getMonth() + 3);
      break;
    case 'EXAMINATION_FEE':
      // Exam fee due 2 months from enrollment
      dueDate.setMonth(now.getMonth() + 2);
      break;
    case 'TECHNOLOGY_FEE':
    case 'DEVELOPMENT_FEE':
      // Other fees due 1 month from enrollment
      dueDate.setMonth(now.getMonth() + 1);
      break;
    default:
      dueDate.setMonth(now.getMonth() + 1);
  }
  
  return dueDate;
};

/**
 * Create custom invoice for student (admin function)
 */
export const createCustomInvoice = async (data: {
  studentId: number;
  sessionId: number;
  semesterId?: number;
  type: InvoiceType;
  description: string;
  amount: number;
  dueDate?: Date;
  level?: number;
}) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: data.studentId },
      select: { currentLevel: true, matricNo: true },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    const invoiceNo = await generateInvoiceNumber();
    
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNo,
        studentId: data.studentId,
        sessionId: data.sessionId,
        semesterId: data.semesterId,
        type: data.type,
        description: data.description,
        amount: data.amount,
        balance: data.amount,
        level: data.level || student.currentLevel,
        status: 'PENDING',
        dueDate: data.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
      },
    });

    logger.info(`Created custom invoice ${invoice.invoiceNo} for student ${student.matricNo}`);
    return invoice;
  } catch (error) {
    logger.error('Error creating custom invoice:', error);
    throw error;
  }
};

/**
 * Get fee structure for a specific level
 */
export const getFeeStructure = (level: number) => {
  return {
    schoolFee: DEFAULT_FEES.SCHOOL_FEE[level as keyof typeof DEFAULT_FEES.SCHOOL_FEE] || 0,
    technologyFee: DEFAULT_FEES.TECHNOLOGY_FEE[level as keyof typeof DEFAULT_FEES.TECHNOLOGY_FEE] || 0,
    examinationFee: DEFAULT_FEES.EXAMINATION_FEE[level as keyof typeof DEFAULT_FEES.EXAMINATION_FEE] || 0,
    developmentFee: DEFAULT_FEES.DEVELOPMENT_FEE[level as keyof typeof DEFAULT_FEES.DEVELOPMENT_FEE] || 0,
  };
};

export default {
  generateAutomaticInvoices,
  createCustomInvoice,
  getFeeStructure,
};