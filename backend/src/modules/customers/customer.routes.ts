import { Router } from 'express';
import { CustomerController } from './customer.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requirePermissions } from '../../middleware/rbac.middleware';
import { validateRequest } from '../../middleware/validate.middleware';
import {
  createCustomerSchema,
  customerIdParamSchema,
  listCustomersQuerySchema,
  updateCustomerSchema
} from './customer.schema';
import { PERMISSIONS } from '../roles/permissions.constants';
import { asyncHandler } from '../../utils/async-handler';

const router = Router();
const controller = new CustomerController();

router.use(authenticate);

router.get(
  '/',
  requirePermissions(PERMISSIONS.CUSTOMERS_VIEW),
  validateRequest(listCustomersQuerySchema),
  asyncHandler(controller.list)
);

router.get(
  '/:id',
  requirePermissions(PERMISSIONS.CUSTOMERS_VIEW),
  validateRequest(customerIdParamSchema),
  asyncHandler(controller.getById)
);

router.post(
  '/',
  requirePermissions(PERMISSIONS.CUSTOMERS_CREATE),
  validateRequest(createCustomerSchema),
  asyncHandler(controller.create)
);

router.patch(
  '/:id',
  requirePermissions(PERMISSIONS.CUSTOMERS_UPDATE),
  validateRequest(updateCustomerSchema),
  asyncHandler(controller.update)
);

router.delete(
  '/:id',
  requirePermissions(PERMISSIONS.CUSTOMERS_DELETE),
  validateRequest(customerIdParamSchema),
  asyncHandler(controller.remove)
);

export const customerRoutes = router;
