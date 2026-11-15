export const PERMISSIONS = {
  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_CREATE: 'customers.create',
  CUSTOMERS_UPDATE: 'customers.update',
  CUSTOMERS_DELETE: 'customers.delete',

  RENTALS_VIEW: 'rentals.view',
  RENTALS_CREATE: 'rentals.create',
  RENTALS_UPDATE: 'rentals.update',

  INVOICES_VIEW: 'invoices.view',
  INVOICES_CREATE: 'invoices.create',

  PAYMENTS_VIEW: 'payments.view',
  PAYMENTS_RECORD: 'payments.record',
  PAYMENTS_REFUND: 'payments.refund',

  SERVICES_VIEW: 'services.view',
  SERVICES_ASSIGN: 'services.assign',
  SERVICES_COMPLETE: 'services.complete',

  REPORTS_VIEW: 'reports.view',
  USERS_MANAGE: 'users.manage',
  SETTINGS_MANAGE: 'settings.manage'
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Array<{ code: PermissionCode; module: string; description: string }> = [
  { code: PERMISSIONS.CUSTOMERS_VIEW, module: 'customers', description: 'View customer records' },
  { code: PERMISSIONS.CUSTOMERS_CREATE, module: 'customers', description: 'Create customer records' },
  { code: PERMISSIONS.CUSTOMERS_UPDATE, module: 'customers', description: 'Update customer records' },
  { code: PERMISSIONS.CUSTOMERS_DELETE, module: 'customers', description: 'Archive/delete customer records' },

  { code: PERMISSIONS.RENTALS_VIEW, module: 'rentals', description: 'View rental plans and contracts' },
  { code: PERMISSIONS.RENTALS_CREATE, module: 'rentals', description: 'Create rental plans and contracts' },
  { code: PERMISSIONS.RENTALS_UPDATE, module: 'rentals', description: 'Update rental plans and contracts' },

  { code: PERMISSIONS.INVOICES_VIEW, module: 'invoices', description: 'View customer invoices' },
  { code: PERMISSIONS.INVOICES_CREATE, module: 'invoices', description: 'Create customer invoices' },

  { code: PERMISSIONS.PAYMENTS_VIEW, module: 'payments', description: 'View payment records' },
  { code: PERMISSIONS.PAYMENTS_RECORD, module: 'payments', description: 'Record customer payments' },
  { code: PERMISSIONS.PAYMENTS_REFUND, module: 'payments', description: 'Refund customer payments' },

  { code: PERMISSIONS.SERVICES_VIEW, module: 'services', description: 'View service jobs and schedules' },
  { code: PERMISSIONS.SERVICES_ASSIGN, module: 'services', description: 'Assign technicians to services' },
  { code: PERMISSIONS.SERVICES_COMPLETE, module: 'services', description: 'Complete service jobs' },

  { code: PERMISSIONS.REPORTS_VIEW, module: 'reports', description: 'View and export financial/operational reports' },
  { code: PERMISSIONS.USERS_MANAGE, module: 'users', description: 'Manage staff users and roles' },
  { code: PERMISSIONS.SETTINGS_MANAGE, module: 'settings', description: 'Manage application settings' }
];

export const ROLE_PERMISSION_MATRIX: Record<
  'OWNER_ADMIN' | 'ACCOUNTANT' | 'SUPPORT_EXECUTIVE' | 'TECHNICIAN',
  PermissionCode[]
> = {
  OWNER_ADMIN: ALL_PERMISSIONS.map(p => p.code),
  ACCOUNTANT: [
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.RENTALS_VIEW,
    PERMISSIONS.INVOICES_VIEW,
    PERMISSIONS.INVOICES_CREATE,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.PAYMENTS_RECORD,
    PERMISSIONS.PAYMENTS_REFUND,
    PERMISSIONS.REPORTS_VIEW
  ],
  SUPPORT_EXECUTIVE: [
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_CREATE,
    PERMISSIONS.CUSTOMERS_UPDATE,
    PERMISSIONS.RENTALS_VIEW,
    PERMISSIONS.RENTALS_CREATE,
    PERMISSIONS.RENTALS_UPDATE,
    PERMISSIONS.INVOICES_VIEW,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.PAYMENTS_RECORD,
    PERMISSIONS.SERVICES_VIEW,
    PERMISSIONS.SERVICES_ASSIGN,
    PERMISSIONS.REPORTS_VIEW
  ],
  TECHNICIAN: [
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.SERVICES_VIEW,
    PERMISSIONS.SERVICES_COMPLETE
  ]
};
