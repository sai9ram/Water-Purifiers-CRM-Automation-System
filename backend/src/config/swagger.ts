export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Pure Home Waters CRM — Backend REST API',
    version: '1.0.0',
    description:
      'Production-oriented modular monolith REST API for Pure Home Waters CRM (Node.js, TypeScript, Express, PostgreSQL, Prisma, RBAC).'
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1 Base Path'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    schemas: {
      StandardSuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Operation completed successfully' },
          data: { type: 'object' },
          meta: { type: 'object' }
        }
      },
      StandardErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Validation failed' },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                message: { type: 'string' }
              }
            }
          }
        }
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'admin@purehomewaters.com' },
          password: { type: 'string', format: 'password', example: 'Admin@123456' }
        }
      },
      RefreshTokenRequest: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' }
        }
      },
      CustomerCreateRequest: {
        type: 'object',
        required: ['name', 'phone', 'address', 'area', 'nextDueDate'],
        properties: {
          name: { type: 'string', example: 'Ramesh Kumar' },
          phone: { type: 'string', example: '9876543210' },
          alternatePhone: { type: 'string', nullable: true, example: '9876543211' },
          email: { type: 'string', format: 'email', nullable: true },
          address: { type: 'string', example: 'Flat 202, Balaji Residency, AIR Bypass Road' },
          area: { type: 'string', example: 'AIR Bypass Road' },
          purifierModel: { type: 'string', example: 'Purosis Plus' },
          planId: { type: 'string', format: 'uuid', nullable: true },
          planName: { type: 'string', example: 'Standard' },
          monthlyRent: { type: 'number', example: 499 },
          depositPaid: { type: 'number', example: 3000 },
          initialInvestment: { type: 'number', nullable: true, example: 6500 },
          joinDate: { type: 'string', format: 'date-time' },
          nextDueDate: { type: 'string', format: 'date-time' },
          lastPaymentDate: { type: 'string', format: 'date-time', nullable: true },
          lastServiceDate: { type: 'string', format: 'date-time', nullable: true },
          nextServiceDate: { type: 'string', format: 'date-time', nullable: true },
          status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'OVERDUE'], default: 'ACTIVE' },
          notes: { type: 'string', nullable: true }
        }
      }
    }
  },
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check and PostgreSQL connectivity status',
        responses: {
          '200': { description: 'Service and database healthy' },
          '503': { description: 'Database unreachable' }
        }
      }
    },
    '/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Authenticate staff user and receive access + refresh tokens',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' }
            }
          }
        },
        responses: {
          '200': { description: 'Authenticated successfully' },
          '401': { description: 'Invalid credentials' }
        }
      }
    },
    '/auth/refresh': {
      post: {
        tags: ['Authentication'],
        summary: 'Rotate refresh token and issue new token pair',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RefreshTokenRequest' }
            }
          }
        },
        responses: {
          '200': { description: 'Tokens rotated successfully' },
          '401': { description: 'Invalid or revoked refresh token' }
        }
      }
    },
    '/auth/logout': {
      post: {
        tags: ['Authentication'],
        security: [{ bearerAuth: [] }],
        summary: 'Revoke active refresh token and end session',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RefreshTokenRequest' }
            }
          }
        },
        responses: {
          '200': { description: 'Logged out successfully' }
        }
      }
    },
    '/auth/me': {
      get: {
        tags: ['Authentication'],
        security: [{ bearerAuth: [] }],
        summary: 'Get current authenticated user profile, roles, and permissions',
        responses: {
          '200': { description: 'Current user profile retrieved' },
          '401': { description: 'Unauthorized' }
        }
      }
    },
    '/customers': {
      get: {
        tags: ['Customers'],
        security: [{ bearerAuth: [] }],
        summary: 'List customers with pagination, search (name/phone), and status filtering',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'OVERDUE', 'active', 'inactive', 'overdue'] } },
          { name: 'area', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Paginated customer list' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' }
        }
      },
      post: {
        tags: ['Customers'],
        security: [{ bearerAuth: [] }],
        summary: 'Create a new customer with duplicate phone detection',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CustomerCreateRequest' }
            }
          }
        },
        responses: {
          '201': { description: 'Customer created' },
          '400': { description: 'Validation error' },
          '409': { description: 'Duplicate customer phone or code' }
        }
      }
    },
    '/customers/{id}': {
      get: {
        tags: ['Customers'],
        security: [{ bearerAuth: [] }],
        summary: 'Get customer details by UUID',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
        ],
        responses: {
          '200': { description: 'Customer retrieved' },
          '404': { description: 'Customer not found' }
        }
      },
      patch: {
        tags: ['Customers'],
        security: [{ bearerAuth: [] }],
        summary: 'Update customer details by UUID',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CustomerCreateRequest' }
            }
          }
        },
        responses: {
          '200': { description: 'Customer updated' },
          '404': { description: 'Customer not found' },
          '409': { description: 'Duplicate phone number' }
        }
      },
      delete: {
        tags: ['Customers'],
        security: [{ bearerAuth: [] }],
        summary: 'Soft-delete/archive customer (preserves financial & service history)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
        ],
        responses: {
          '200': { description: 'Customer archived or soft-deleted' },
          '404': { description: 'Customer not found' }
        }
      }
    }
  }
};
