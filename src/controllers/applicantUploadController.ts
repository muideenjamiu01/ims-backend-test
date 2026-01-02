import { Response } from 'express';
import prisma from '../config/database';
import { ApplicantAuthRequest } from '../types/express';
import logger from '../config/logger';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure upload directories exist
const ensureUploadDirectories = () => {
  const directories = [
    path.join(process.cwd(), 'uploads', 'profiles'),
    path.join(process.cwd(), 'uploads', 'documents'),
  ];

  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadDirectories();
    
    let uploadPath = '';
    if (file.fieldname === 'passportPhoto') {
      uploadPath = path.join(process.cwd(), 'uploads', 'profiles');
    } else {
      uploadPath = path.join(process.cwd(), 'uploads', 'documents');
    }
    
    cb(null, uploadPath);
  },
  filename: (req: ApplicantAuthRequest, file, cb) => {
    const applicantId = req.applicant?.id;
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    
    let fileName = '';
    if (file.fieldname === 'passportPhoto') {
      fileName = `passport_${applicantId}_${timestamp}${ext}`;
    } else if (file.fieldname === 'academicDocument') {
      fileName = `academic_${applicantId}_${timestamp}${ext}`;
    } else if (file.fieldname === 'additionalDocument') {
      fileName = `additional_${applicantId}_${timestamp}${ext}`;
    } else {
      fileName = `document_${applicantId}_${timestamp}${ext}`;
    }
    
    cb(null, fileName);
  }
});

// File filter to only allow specific file types
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  const allowedDocumentTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

  if (file.fieldname === 'passportPhoto') {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, JPG, and PNG images are allowed for passport photo'));
    }
  } else {
    if (allowedDocumentTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, JPEG, JPG, and PNG files are allowed for documents'));
    }
  }
};

// Configure multer
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

/**
 * Upload applicant documents
 */
export const uploadDocuments = async (req: ApplicantAuthRequest, res: Response) => {
  try {
    const applicantId = req.applicant!.id;
    const files = req.files as Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };

    if (!files || (Array.isArray(files) && files.length === 0) || 
        (!Array.isArray(files) && Object.keys(files).length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded',
      });
    }

    // Update applicant record with file paths
    const updateData: any = {};
    
    if (!Array.isArray(files)) {
      if (files.passportPhoto && files.passportPhoto[0]) {
        updateData.passportPhoto = `/uploads/profiles/${files.passportPhoto[0].filename}`;
      }
      
      if (files.academicDocument && files.academicDocument[0]) {
        updateData.academicDocument = `/uploads/documents/${files.academicDocument[0].filename}`;
      }
      
      if (files.additionalDocument && files.additionalDocument[0]) {
        updateData.additionalDocument = `/uploads/documents/${files.additionalDocument[0].filename}`;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid files to process',
      });
    }

    const updatedApplicant = await prisma.applicant.update({
      where: { id: applicantId },
      data: updateData,
    });

    logger.info(`Documents uploaded for applicant ${applicantId}: ${Object.keys(updateData).join(', ')}`);

    return res.json({
      success: true,
      message: 'Documents uploaded successfully',
      data: {
        passportPhoto: (updatedApplicant as any).passportPhoto,
        academicDocument: (updatedApplicant as any).academicDocument,
        additionalDocument: (updatedApplicant as any).additionalDocument,
      },
    });
  } catch (error: any) {
    logger.error('Error in uploadDocuments:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload documents',
    });
  }
};

/**
 * Delete a specific document
 */
export const deleteDocument = async (req: ApplicantAuthRequest, res: Response) => {
  try {
    const applicantId = req.applicant!.id;
    const { documentType } = req.params;

    if (!['passportPhoto', 'academicDocument', 'additionalDocument'].includes(documentType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document type',
      });
    }

    // Get current applicant to find the file path
    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
    });

    if (!applicant) {
      return res.status(404).json({
        success: false,
        message: 'Applicant not found',
      });
    }

    const currentFilePath = (applicant as any)[documentType];
    
    if (!currentFilePath) {
      return res.status(404).json({
        success: false,
        message: 'Document not found',
      });
    }

    // Delete file from filesystem
    const fullPath = path.join(process.cwd(), currentFilePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    // Update database to remove file path
    await prisma.applicant.update({
      where: { id: applicantId },
      data: {
        [documentType]: null,
      },
    });

    logger.info(`Document ${documentType} deleted for applicant ${applicantId}`);

    return res.json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error: any) {
    logger.error('Error in deleteDocument:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete document',
    });
  }
};

/**
 * Get applicant documents info
 */
export const getDocuments = async (req: ApplicantAuthRequest, res: Response) => {
  try {
    const applicantId = req.applicant!.id;

    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
    });

    if (!applicant) {
      return res.status(404).json({
        success: false,
        message: 'Applicant not found',
      });
    }

    return res.json({
      success: true,
      data: {
        passportPhoto: (applicant as any).passportPhoto,
        academicDocument: (applicant as any).academicDocument,
        additionalDocument: (applicant as any).additionalDocument,
      },
    });
  } catch (error: any) {
    logger.error('Error in getDocuments:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get documents',
    });
  }
};