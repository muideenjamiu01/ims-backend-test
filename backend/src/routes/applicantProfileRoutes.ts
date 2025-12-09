import express from 'express';
import { applicantAuth } from '../middleware/applicantAuth';
import {
  getProfile,
  updateProfile,
  submitApplication,
  getApplicationStatus,
  getPrograms,
} from '../controllers/applicantProfileController';

const router = express.Router();

// Public routes (no auth required)
router.get('/programs', getPrograms);

// All routes below require authentication
router.use(applicantAuth);

// Profile routes
router.get('/profile', getProfile);
router.put('/profile', updateProfile);

// Application routes
router.post('/application/submit', submitApplication);
router.get('/application/status', getApplicationStatus);

export default router;
