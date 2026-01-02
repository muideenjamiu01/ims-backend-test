import express from 'express';
import { applicantAuth } from '../middleware/applicantAuth';
import {
  uploadDocuments,
  deleteDocument,
  getDocuments,
  upload,
} from '../controllers/applicantUploadController';

const router = express.Router();

// All routes require authentication
router.use(applicantAuth);

// Document routes
router.get('/documents', getDocuments);
router.post('/documents', 
  upload.fields([
    { name: 'passportPhoto', maxCount: 1 },
    { name: 'academicDocument', maxCount: 1 },
    { name: 'additionalDocument', maxCount: 1 }
  ]), 
  uploadDocuments
);
router.delete('/documents/:documentType', deleteDocument);

export default router;