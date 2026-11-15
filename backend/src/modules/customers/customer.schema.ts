import { z } from 'zod';

const phoneRegex = /^[0-9+\-\s()]{10,20}$/;

export function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  return digits;
}

const statusTransform = z
  .enum(['ACTIVE', 'INACTIVE', 'OVERDUE', 'active', 'inactive', 'overdue'])
  .transform(val => val.toUpperCase() as 'ACTIVE' | 'INACTIVE' | 'OVERDUE');

export const createCustomerSchema = z.object({
  body: z.object({
    legacyId: z.number().int().positive().optional(),
    customerCode: z.string().trim().min(2).max(40).optional(),
    name: z.string().trim().min(2, 'Customer name must be at least 2 characters').max(200),
    phone: z
      .string()
      .trim()
      .regex(phoneRegex, 'Phone number must be a valid 10-digit Indian mobile number')
      .transform(normalizePhoneNumber)
      .refine(val => val.length === 10, 'Normalized phone number must be 10 digits'),
    alternatePhone: z
      .string()
      .trim()
      .regex(phoneRegex, 'Alternate phone must be a valid phone number')
      .transform(normalizePhoneNumber)
      .optional()
      .nullable(),
    email: z.string().trim().email('Invalid email address').optional().nullable(),
    address: z.string().trim().min(3, 'Address is required'),
    area: z.string().trim().min(2, 'Area is required').max(150),
    purifierModel: z.string().trim().max(150).optional().nullable(),
    planId: z.string().uuid('Invalid planId UUID').optional().nullable(),
    planName: z.string().trim().max(150).optional().nullable(),
    monthlyRent: z.coerce.number().min(0, 'Monthly rent cannot be negative').default(0),
    depositPaid: z.coerce.number().min(0, 'Deposit paid cannot be negative').default(0),
    initialInvestment: z.coerce.number().min(0).optional().nullable(),
    joinDate: z.coerce.date().optional(),
    nextDueDate: z.coerce.date({
      required_error: 'nextDueDate is required',
      invalid_type_error: 'nextDueDate must be a valid date'
    }),
    lastPaymentDate: z.coerce.date().optional().nullable(),
    lastServiceDate: z.coerce.date().optional().nullable(),
    nextServiceDate: z.coerce.date().optional().nullable(),
    status: statusTransform.default('ACTIVE'),
    notes: z.string().trim().optional().nullable()
  })
});

export const updateCustomerSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid customer ID format')
  }),
  body: z
    .object({
      name: z.string().trim().min(2).max(200).optional(),
      phone: z
        .string()
        .trim()
        .regex(phoneRegex, 'Phone number must be a valid 10-digit Indian mobile number')
        .transform(normalizePhoneNumber)
        .refine(val => val.length === 10, 'Normalized phone number must be 10 digits')
        .optional(),
      alternatePhone: z
        .string()
        .trim()
        .regex(phoneRegex)
        .transform(normalizePhoneNumber)
        .optional()
        .nullable(),
      email: z.string().trim().email().optional().nullable(),
      address: z.string().trim().min(3).optional(),
      area: z.string().trim().min(2).max(150).optional(),
      purifierModel: z.string().trim().max(150).optional().nullable(),
      planId: z.string().uuid().optional().nullable(),
      planName: z.string().trim().max(150).optional().nullable(),
      monthlyRent: z.coerce.number().min(0).optional(),
      depositPaid: z.coerce.number().min(0).optional(),
      initialInvestment: z.coerce.number().min(0).optional().nullable(),
      joinDate: z.coerce.date().optional(),
      nextDueDate: z.coerce.date().optional(),
      lastPaymentDate: z.coerce.date().optional().nullable(),
      lastServiceDate: z.coerce.date().optional().nullable(),
      nextServiceDate: z.coerce.date().optional().nullable(),
      status: statusTransform.optional(),
      notes: z.string().trim().optional().nullable()
    })
    .refine(data => Object.keys(data).length > 0, {
      message: 'At least one field must be provided for update'
    })
});

export const customerIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid customer ID format')
  })
});

export const listCustomersQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().optional(),
    status: statusTransform.optional(),
    area: z.string().trim().optional()
  })
});
