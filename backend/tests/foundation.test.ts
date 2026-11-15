import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import EmbeddedPostgres from 'embedded-postgres';
import request from 'supertest';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/password';

const TEST_PG_PORT = 54329;
const TEST_DB_NAME = 'pure_home_waters_test';
const TEST_DB_URL = `postgresql://postgres:postgres@127.0.0.1:${TEST_PG_PORT}/${TEST_DB_NAME}?schema=public`;

process.env.NODE_ENV = 'test';
process.env.PORT = '4001';
process.env.DATABASE_URL = TEST_DB_URL;
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.JWT_ACCESS_SECRET = 'test_jwt_access_secret_minimum_32_characters_long';
process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret_minimum_32_characters_long';
process.env.FRONTEND_URL = 'http://localhost:4200';
process.env.API_BASE_URL = 'http://localhost:4001/api/v1';

let pgServer: EmbeddedPostgres | null = null;
let prisma: PrismaClient;
let app: ReturnType<typeof import('../src/app')['createApp']>;

let ownerAccessToken = '';
let ownerRefreshToken = '';
let supportAccessToken = '';
let technicianAccessToken = '';
let createdCustomerId = '';

describe('Pure Home Waters — Backend Foundation & Customer Module Integration Tests', () => {
  beforeAll(async () => {
    const prismaMod = await import('../src/database/prisma');
    prisma = prismaMod.prisma;

    let pgAlreadyRunning = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      pgAlreadyRunning = true;
    } catch {
      pgAlreadyRunning = false;
    }

    if (!pgAlreadyRunning) {
      const dataDir = path.resolve(process.cwd(), '.pgdata', 'dev-cluster');
      const postmasterPid = path.join(dataDir, 'postmaster.pid');
      if (fs.existsSync(postmasterPid)) {
        try {
          fs.unlinkSync(postmasterPid);
        } catch {
          // ignore if locked by active process
        }
      }

      pgServer = new EmbeddedPostgres({
        databaseDir: dataDir,
        user: 'postgres',
        password: 'postgres',
        port: TEST_PG_PORT,
        persistent: true
      });

      if (!fs.existsSync(path.join(dataDir, 'PG_VERSION'))) {
        await pgServer.initialise();
      }

      await pgServer.start();

      try {
        await pgServer.createDatabase(TEST_DB_NAME);
      } catch {
        // Already exists
      }
    }

    try {
      await prisma.role.count();
    } catch {
      execSync('npx prisma migrate deploy', {
        stdio: 'pipe',
        env: {
          ...process.env,
          DATABASE_URL: TEST_DB_URL
        }
      });
    }

    // Clean mutable test tables before seeding
    await prisma.auditLog.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.serviceJob.deleteMany();
    await prisma.customerAddress.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.user.deleteMany();

    const { seedDatabase } = await import('../prisma/seed');
    await seedDatabase(prisma, { adminPassword: 'OwnerPassword@123' });

    const supportRole = await prisma.role.findUniqueOrThrow({ where: { code: 'SUPPORT_EXECUTIVE' } });
    const techRole = await prisma.role.findUniqueOrThrow({ where: { code: 'TECHNICIAN' } });

    const supportUser = await prisma.user.create({
      data: {
        email: 'support@purehomewaters.com',
        fullName: 'Support Executive User',
        phone: '9000000002',
        passwordHash: await hashPassword('SupportPassword@123'),
        isActive: true
      }
    });
    await prisma.userRole.create({
      data: { userId: supportUser.id, roleId: supportRole.id }
    });

    const techUser = await prisma.user.create({
      data: {
        email: 'tech@purehomewaters.com',
        fullName: 'Field Technician User',
        phone: '9000000003',
        passwordHash: await hashPassword('TechPassword@123'),
        isActive: true
      }
    });
    await prisma.userRole.create({
      data: { userId: techUser.id, roleId: techRole.id }
    });

    const appMod = await import('../src/app');
    app = appMod.createApp();
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
    if (pgServer) {
      await Promise.race([
        pgServer.stop().catch(() => undefined),
        new Promise(resolve => setTimeout(resolve, 1500))
      ]);
    }
  });

  it('1. verifies real PostgreSQL database connection and seeded tables', async () => {
    const rolesCount = await prisma.role.count();
    const permissionsCount = await prisma.permission.count();
    const plansCount = await prisma.rentalPlan.count();
    const jobsCount = await prisma.automationJob.count();

    expect(rolesCount).toBe(4);
    expect(permissionsCount).toBeGreaterThanOrEqual(16);
    expect(plansCount).toBe(3);
    expect(jobsCount).toBe(6);
  });

  it('2. returns 200 OK from GET /api/v1/health with database connected status', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.database).toBe('connected');
    expect(res.body.data.service).toBe('pure-home-waters-backend');
  });

  it('3. serves OpenAPI / Swagger specification at GET /api/v1/docs.json', async () => {
    const res = await request(app).get('/api/v1/docs.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
    expect(res.body.paths['/customers']).toBeDefined();
    expect(res.body.paths['/auth/login']).toBeDefined();
  });

  it('4. authenticates valid user credentials via POST /api/v1/auth/login and returns JWT tokens', async () => {
    const ownerRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@purehomewaters.com', password: 'OwnerPassword@123' });

    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body.success).toBe(true);
    expect(ownerRes.body.data.accessToken).toBeTypeOf('string');
    expect(ownerRes.body.data.refreshToken).toBeTypeOf('string');
    expect(ownerRes.body.data.user.roles).toContain('OWNER_ADMIN');

    ownerAccessToken = ownerRes.body.data.accessToken;
    ownerRefreshToken = ownerRes.body.data.refreshToken;

    const supportRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'support@purehomewaters.com', password: 'SupportPassword@123' });
    expect(supportRes.status).toBe(200);
    supportAccessToken = supportRes.body.data.accessToken;

    const techRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'tech@purehomewaters.com', password: 'TechPassword@123' });
    expect(techRes.status).toBe(200);
    technicianAccessToken = techRes.body.data.accessToken;
  });

  it('5. rejects invalid login credentials with 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@purehomewaters.com', password: 'WrongPassword123!' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Invalid email or password/i);
  });

  it('6. enforces authentication middleware on protected routes (GET /api/v1/auth/me & /api/v1/customers)', async () => {
    const noTokenRes = await request(app).get('/api/v1/auth/me');
    expect(noTokenRes.status).toBe(401);
    expect(noTokenRes.body.success).toBe(false);

    const badTokenRes = await request(app)
      .get('/api/v1/customers')
      .set('Authorization', 'Bearer invalid.jwt.token');
    expect(badTokenRes.status).toBe(401);

    const validProfileRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${ownerAccessToken}`);
    expect(validProfileRes.status).toBe(200);
    expect(validProfileRes.body.data.email).toBe('admin@purehomewaters.com');
  });

  it('7. rotates refresh tokens via POST /api/v1/auth/refresh', async () => {
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: ownerRefreshToken });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.success).toBe(true);
    expect(refreshRes.body.data.accessToken).toBeTypeOf('string');
    expect(refreshRes.body.data.refreshToken).not.toBe(ownerRefreshToken);

    ownerAccessToken = refreshRes.body.data.accessToken;
    ownerRefreshToken = refreshRes.body.data.refreshToken;
  });

  it('8. enforces RBAC permissions (blocks TECHNICIAN from creating customers with 403 Forbidden)', async () => {
    const res = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${technicianAccessToken}`)
      .send({
        name: 'Unauthorized Customer',
        phone: '9888877776',
        address: '101 Temple Street',
        area: 'Tirumala Bypass',
        nextDueDate: '2026-12-05T00:00:00.000Z'
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Forbidden/i);
  });

  it('9. creates a new customer in PostgreSQL via POST /api/v1/customers', async () => {
    const res = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${supportAccessToken}`)
      .send({
        name: 'Srinivasulu Reddy',
        phone: '+91 98480 12345',
        alternatePhone: '9848012346',
        address: 'Flat 304, Sri Vari Towers, Korlagunta',
        area: 'Korlagunta',
        purifierModel: 'Purosis Plus',
        planName: 'Standard',
        monthlyRent: 499,
        depositPaid: 3000,
        initialInvestment: 6500,
        nextDueDate: '2026-12-05T00:00:00.000Z',
        status: 'active',
        notes: 'Prefers morning service visits'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeTypeOf('string');
    expect(res.body.data.phone).toBe('9848012345');
    expect(res.body.data.status).toBe('ACTIVE');
    expect(res.body.data.monthlyRent).toBe(499);

    createdCustomerId = res.body.data.id;

    const dbRecord = await prisma.customer.findUnique({
      where: { id: createdCustomerId },
      include: { addresses: true }
    });
    expect(dbRecord).not.toBeNull();
    expect(dbRecord?.name).toBe('Srinivasulu Reddy');
    expect(dbRecord?.addresses.length).toBe(1);
    expect(dbRecord?.addresses[0].area).toBe('Korlagunta');
  });

  it('10. blocks duplicate customer creation with the same phone number (409 Conflict)', async () => {
    const res = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${supportAccessToken}`)
      .send({
        name: 'Duplicate Srinivas',
        phone: '9848012345',
        address: 'Another Address',
        area: 'Korlagunta',
        nextDueDate: '2026-12-05T00:00:00.000Z'
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Duplicate customer/i);
  });

  it('11. rejects invalid customer payload with 400 Bad Request and field-level Zod errors', async () => {
    const res = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${supportAccessToken}`)
      .send({
        name: 'A',
        phone: '123',
        address: '',
        area: ''
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Validation failed');
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it('12. lists customers with pagination, search (by name & phone), and status filter via GET /api/v1/customers', async () => {
    await request(app)
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({
        name: 'Lakshmi Devi',
        phone: '9440111222',
        address: '12 Gandhi Road',
        area: 'Gandhi Road',
        purifierModel: 'Dolphin',
        monthlyRent: 399,
        depositPaid: 2000,
        nextDueDate: '2026-11-01T00:00:00.000Z',
        status: 'overdue'
      });

    const listRes = await request(app)
      .get('/api/v1/customers?page=1&limit=10')
      .set('Authorization', `Bearer ${technicianAccessToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(2);
    expect(listRes.body.meta.total).toBe(2);

    const nameSearchRes = await request(app)
      .get('/api/v1/customers?search=Srinivasulu')
      .set('Authorization', `Bearer ${technicianAccessToken}`);
    expect(nameSearchRes.status).toBe(200);
    expect(nameSearchRes.body.data.length).toBe(1);
    expect(nameSearchRes.body.data[0].name).toBe('Srinivasulu Reddy');

    const phoneSearchRes = await request(app)
      .get('/api/v1/customers?search=9440111')
      .set('Authorization', `Bearer ${technicianAccessToken}`);
    expect(phoneSearchRes.status).toBe(200);
    expect(phoneSearchRes.body.data.length).toBe(1);
    expect(phoneSearchRes.body.data[0].name).toBe('Lakshmi Devi');

    const statusFilterRes = await request(app)
      .get('/api/v1/customers?status=OVERDUE')
      .set('Authorization', `Bearer ${technicianAccessToken}`);
    expect(statusFilterRes.status).toBe(200);
    expect(statusFilterRes.body.data.length).toBe(1);
    expect(statusFilterRes.body.data[0].status).toBe('OVERDUE');
  });

  it('13. retrieves and updates a customer via GET & PATCH /api/v1/customers/:id', async () => {
    const getRes = await request(app)
      .get(`/api/v1/customers/${createdCustomerId}`)
      .set('Authorization', `Bearer ${supportAccessToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.id).toBe(createdCustomerId);

    const patchRes = await request(app)
      .patch(`/api/v1/customers/${createdCustomerId}`)
      .set('Authorization', `Bearer ${supportAccessToken}`)
      .send({
        monthlyRent: 549,
        area: 'MR Palli',
        notes: 'Upgraded to alkaline filter'
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.monthlyRent).toBe(549);
    expect(patchRes.body.data.area).toBe('MR Palli');
    expect(patchRes.body.data.notes).toBe('Upgraded to alkaline filter');
  });

  it('14. archives/soft-deletes customer via DELETE /api/v1/customers/:id while preserving financial & service history', async () => {
    await prisma.payment.create({
      data: {
        customerId: createdCustomerId,
        amount: 549,
        paidDate: new Date(),
        forMonth: 'November 2026',
        receiver: 'Charan'
      }
    });

    await prisma.serviceJob.create({
      data: {
        customerId: createdCustomerId,
        technicianName: 'Default Technician',
        serviceType: 'FILTER_CHANGE',
        serviceDate: new Date(),
        totalCost: 250
      }
    });

    const forbiddenDel = await request(app)
      .delete(`/api/v1/customers/${createdCustomerId}`)
      .set('Authorization', `Bearer ${supportAccessToken}`);
    expect(forbiddenDel.status).toBe(403);

    const delRes = await request(app)
      .delete(`/api/v1/customers/${createdCustomerId}`)
      .set('Authorization', `Bearer ${ownerAccessToken}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.data.archived).toBe(true);
    expect(delRes.body.data.preservedHistory.payments).toBe(1);
    expect(delRes.body.data.preservedHistory.serviceJobs).toBe(1);

    const rawCustomer = await prisma.customer.findUnique({
      where: { id: createdCustomerId }
    });
    expect(rawCustomer).not.toBeNull();
    expect(rawCustomer?.isArchived).toBe(true);
    expect(rawCustomer?.deletedAt).not.toBeNull();

    const paymentsStillExist = await prisma.payment.count({
      where: { customerId: createdCustomerId }
    });
    expect(paymentsStillExist).toBe(1);
  });
});
