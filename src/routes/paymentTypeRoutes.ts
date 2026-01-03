import express from 'express';
import {
  getAllPaymentTypes,
  getPaymentType,
  createPaymentType,
  updatePaymentType,
  deletePaymentType,
  togglePaymentTypeStatus,
} from '../controllers/paymentTypeController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Apply admin authentication to all routes
router.use(authenticate);

// Get all payment types
router.get('/', getAllPaymentTypes);

// Get single payment type
router.get('/:id', getPaymentType);

// Create payment type
router.post('/', createPaymentType);

// Update payment type
router.put('/:id', updatePaymentType);

// Toggle active status
router.patch('/:id/toggle-status', togglePaymentTypeStatus);

// Delete payment type
router.delete('/:id', deletePaymentType);

export default router;
