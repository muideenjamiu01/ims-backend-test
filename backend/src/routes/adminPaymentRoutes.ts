import express from 'express';
import {
  createInvoices,
  getAllInvoices,
  getPaymentStatistics,
  updateInvoice,
  deleteInvoice,
  getStudentsForInvoice,
  bulkInvoiceOperations,
  getSessions,
} from '../controllers/adminPaymentController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Apply admin authentication to all routes
router.use(authenticate);

// Create invoices for students
router.post('/invoices', createInvoices);

// Get all invoices with filters
router.get('/invoices', getAllInvoices);

// Get payment statistics
router.get('/statistics', getPaymentStatistics);

// Get students for invoice creation
router.get('/students', getStudentsForInvoice);

// Get sessions for invoice creation
router.get('/sessions', getSessions);

// Update invoice
router.put('/invoices/:invoiceId', updateInvoice);

// Delete invoice
router.delete('/invoices/:invoiceId', deleteInvoice);

// Bulk operations on invoices
router.post('/invoices/bulk', bulkInvoiceOperations);

export default router;