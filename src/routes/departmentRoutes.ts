import express from 'express';
import * as departmentController from '../controllers/departmentController';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();

// Public endpoint for applicants to view departments
router.get('/public', departmentController.getDepartments);

router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  departmentController.createDepartment
);

router.get(
  '/',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  departmentController.getDepartments
);

router.get(
  '/:id',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  departmentController.getDepartmentById
);

router.put(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  departmentController.updateDepartment
);

router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  departmentController.deleteDepartment
);

export default router;
