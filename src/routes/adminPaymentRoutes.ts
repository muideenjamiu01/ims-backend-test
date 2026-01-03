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
import { 
  createCustomInvoiceAdmin,
  getAllInvoicesAdmin,
  recordPaymentAdmin,
  getLevelFeeStructureAdmin,
  getStudentPaymentSummaryAdmin,
  generateInvoicesForStudent,
  getPaymentStatistics as getEnhancedPaymentStatistics,
  exportPaymentsCSV
} from '../controllers/studentPaymentController';
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

// New enhanced payment management routes
router.post('/invoices/custom', createCustomInvoiceAdmin);
router.get('/invoices/all', getAllInvoicesAdmin);
router.post('/payments/record', recordPaymentAdmin);
router.get('/students/:studentId/payment-summary', getStudentPaymentSummaryAdmin);
router.get('/fee-structure/:level', getLevelFeeStructureAdmin);
router.post('/students/:studentId/generate-invoices', generateInvoicesForStudent);

// Enhanced statistics and export routes
router.get('/statistics/enhanced', getEnhancedPaymentStatistics);
router.get('/export', exportPaymentsCSV);

export default router;