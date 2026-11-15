import { PrismaClient, RoleCode } from '@prisma/client';
import {
  ALL_PERMISSIONS,
  ROLE_PERMISSION_MATRIX
} from '../src/modules/roles/permissions.constants';
import { hashPassword } from '../src/utils/password';
import { JOB_DEFINITIONS } from '../src/jobs/job.definitions';

export async function seedDatabase(prismaClient: PrismaClient, options?: { adminPassword?: string }) {
  // 1. Seed Permissions
  for (const perm of ALL_PERMISSIONS) {
    await prismaClient.permission.upsert({
      where: { code: perm.code },
      update: {
        module: perm.module,
        description: perm.description
      },
      create: {
        code: perm.code,
        module: perm.module,
        description: perm.description
      }
    });
  }

  // 2. Seed Roles & Role-Permission mappings
  const rolesMeta: Array<{ code: RoleCode; name: string; description: string }> = [
    {
      code: 'OWNER_ADMIN',
      name: 'Owner / Administrator',
      description: 'Full access to all financial, operational, and administrative functions'
    },
    {
      code: 'ACCOUNTANT',
      name: 'Accountant',
      description: 'Access to invoices, payments, refunds, and financial reports'
    },
    {
      code: 'SUPPORT_EXECUTIVE',
      name: 'Support Executive',
      description: 'Manages customers, rental contracts, payments collection, and service scheduling'
    },
    {
      code: 'TECHNICIAN',
      name: 'Technician',
      description: 'Views assigned service jobs and marks field maintenance visits complete'
    }
  ];

  const allPermissions = await prismaClient.permission.findMany();
  const permByCode = new Map(allPermissions.map(p => [p.code, p]));

  for (const roleMeta of rolesMeta) {
    const role = await prismaClient.role.upsert({
      where: { code: roleMeta.code },
      update: {
        name: roleMeta.name,
        description: roleMeta.description
      },
      create: {
        code: roleMeta.code,
        name: roleMeta.name,
        description: roleMeta.description,
        isSystem: true
      }
    });

    const allowedCodes = ROLE_PERMISSION_MATRIX[roleMeta.code];
    for (const code of allowedCodes) {
      const perm = permByCode.get(code);
      if (!perm) continue;

      await prismaClient.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: perm.id
          }
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: perm.id
        }
      });
    }
  }

  // 3. Seed Default Rental Plans (matching existing IndexedDB defaults)
  const defaultPlans = [
    {
      legacyId: 1,
      name: 'Basic',
      monthlyRent: 399,
      depositAmount: 2000,
      description: 'Essential water purification for small families',
      features: ['RO + UV + Alkaline + TDS Control', 'Base look', 'Quaterly Service', '24/7 Support']
    },
    {
      legacyId: 2,
      name: 'Standard',
      monthlyRent: 499,
      depositAmount: 3000,
      description: 'Advanced purification with UV protection',
      features: ['RO + UV + Alkaline + TDS Control', 'Rich look', 'Quaterly Service', '24/7 Support']
    },
    {
      legacyId: 3,
      name: 'Premium',
      monthlyRent: 499,
      depositAmount: 3500,
      description: 'Complete protection with mineral enhancement',
      features: ['Steel Tank', 'RO + UV + Alkaline + TDS Control', 'Quaterly Service', '24/7 Support']
    }
  ];

  for (const plan of defaultPlans) {
    await prismaClient.rentalPlan.upsert({
      where: { name: plan.name },
      update: {
        monthlyRent: plan.monthlyRent,
        depositAmount: plan.depositAmount,
        description: plan.description,
        features: plan.features
      },
      create: {
        legacyId: plan.legacyId,
        name: plan.name,
        monthlyRent: plan.monthlyRent,
        depositAmount: plan.depositAmount,
        description: plan.description,
        features: plan.features
      }
    });
  }

  // 4. Seed Default Purifier Products (matching PURIFIER_MODELS in models.ts)
  const models = ['Dolphin', 'Purosis', 'Purosis Plus', 'Priya Aqua Steel Guard', 'Fonix'];
  for (const modelName of models) {
    const sku = `PHW-RO-${modelName.toUpperCase().replace(/\s+/g, '-')}`;
    await prismaClient.product.upsert({
      where: { sku },
      update: { modelName },
      create: {
        sku,
        name: `${modelName} Water Purifier`,
        modelName,
        maintenanceIntervalDays: 90
      }
    });
  }

  // 5. Seed Background Automation Job Definitions (disabled by default per Step 1 rules)
  for (const jobSpec of Object.values(JOB_DEFINITIONS)) {
    await prismaClient.automationJob.upsert({
      where: { jobKey: jobSpec.jobType },
      update: {
        queueName: jobSpec.queueName,
        cronExpression: jobSpec.defaultCron
      },
      create: {
        jobKey: jobSpec.jobType,
        jobType: jobSpec.jobType,
        queueName: jobSpec.queueName,
        cronExpression: jobSpec.defaultCron,
        isEnabled: false,
        status: 'PAUSED'
      }
    });
  }

  // 6. Seed Initial Staff Users if requested (for local dev / tests)
  const adminPassword = options?.adminPassword ?? process.env.SEED_ADMIN_PASSWORD;
  if (adminPassword) {
    const passwordHash = await hashPassword(adminPassword);
    const ownerRole = await prismaClient.role.findUniqueOrThrow({ where: { code: 'OWNER_ADMIN' } });

    const adminUser = await prismaClient.user.upsert({
      where: { email: 'admin@purehomewaters.com' },
      update: { passwordHash, isActive: true },
      create: {
        email: 'admin@purehomewaters.com',
        fullName: 'Pure Home Waters Admin',
        phone: '9000000001',
        passwordHash,
        isActive: true
      }
    });

    await prismaClient.userRole.upsert({
      where: {
        userId_roleId: {
          userId: adminUser.id,
          roleId: ownerRole.id
        }
      },
      update: {},
      create: {
        userId: adminUser.id,
        roleId: ownerRole.id
      }
    });
  }
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedDatabase(prisma)
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async err => {
      console.error('Seed failed:', err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
