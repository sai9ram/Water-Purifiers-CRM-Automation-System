# Pure Home Waters — REST API Specification (v1)

**Base URL:** `/api/v1`  
**Interactive Swagger UI:** `GET /api/v1/docs`  
**Raw OpenAPI 3.0 JSON:** `GET /api/v1/docs.json`  
**Authentication:** Bearer JWT (`Authorization: Bearer <accessToken>`)

---

## 1. Standard Response Envelope

### 1.1 Standard Success Response
```json
{
  "success": true,
  "message": "Customer retrieved successfully",
  "data": {},
  "meta": {}
}
```

### 1.2 Standard Error Response
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "phone",
      "message": "Normalized phone number must be 10 digits"
    }
  ]
}
```

---

## 2. System Endpoints

### `GET /api/v1/health`
Verifies service availability and executes a live `SELECT 1` connectivity check against PostgreSQL.

- **Auth Required:** No
- **Success (`200 OK`):**
```json
{
  "success": true,
  "message": "Pure Home Waters API is healthy",
  "data": {
    "service": "pure-home-waters-backend",
    "version": "1.0.0",
    "database": "connected",
    "timestamp": "2026-11-15T08:55:00.000Z"
  },
  "meta": {}
}
```

---

## 3. Authentication & RBAC Endpoints

### `POST /api/v1/auth/login`
Authenticates an active staff user and returns a short-lived JWT access token (`15m`) and a rotatable refresh token (`7d`).

- **Auth Required:** No (Rate-limited)
- **Request Body:**
```json
{
  "email": "admin@purehomewaters.com",
  "password": "OwnerPassword@123"
}
```
- **Responses:**
  - `200 OK`: Returns `{ user, accessToken, refreshToken }`
  - `400 Bad Request`: Validation error
  - `401 Unauthorized`: Invalid email or password

### `POST /api/v1/auth/refresh`
Verifies and rotates a refresh token inside a database transaction. Reusing an already-rotated token revokes all active sessions for that user.

- **Auth Required:** No (Rate-limited)
- **Request Body:**
```json
{
  "refreshToken": "<refresh_token>"
}
```
- **Responses:**
  - `200 OK`: Returns new `{ user, accessToken, refreshToken }`
  - `401 Unauthorized`: Invalid, expired, or revoked refresh token

### `POST /api/v1/auth/logout`
Revokes the provided refresh token (or all active refresh tokens for the authenticated user) and writes an audit log entry.

- **Auth Required:** Yes (`Bearer <accessToken>`)
- **Responses:** `200 OK`

### `GET /api/v1/auth/me`
Returns the current authenticated user's profile, assigned roles (`OWNER_ADMIN`, `ACCOUNTANT`, `SUPPORT_EXECUTIVE`, `TECHNICIAN`), and effective permission codes.

- **Auth Required:** Yes (`Bearer <accessToken>`)
- **Responses:** `200 OK`, `401 Unauthorized`

---

## 4. Customer Module Endpoints

### `GET /api/v1/customers`
Lists non-archived customers with pagination, search (by name, phone, alternate phone, area, or customer code), and status filtering.

- **Auth Required:** Yes
- **Required Permission:** `customers.view`
- **Query Parameters:**
  - `page` (optional, default `1`)
  - `limit` (optional, default `20`, max `100`)
  - `search` (optional, matches `name`, `phone`, `alternatePhone`, `area`, `customerCode`)
  - `status` (optional: `ACTIVE` | `INACTIVE` | `OVERDUE` or lowercase equivalents)
  - `area` (optional: case-insensitive area filter)
- **Success (`200 OK`):**
```json
{
  "success": true,
  "message": "Customers retrieved successfully",
  "data": [
    {
      "id": "b7c0d42e-4f1a-4b9e-8b0a-9b8d4c3e2f1a",
      "legacyId": null,
      "customerCode": "PHW-M3K8P2-9A1F",
      "name": "Srinivasulu Reddy",
      "phone": "9848012345",
      "alternatePhone": "9848012346",
      "email": null,
      "address": "Flat 304, Sri Vari Towers, Korlagunta",
      "area": "Korlagunta",
      "purifierModel": "Purosis Plus",
      "planId": null,
      "planName": "Standard",
      "monthlyRent": 499,
      "depositPaid": 3000,
      "initialInvestment": 6500,
      "joinDate": "2026-11-15T08:55:00.000Z",
      "nextDueDate": "2026-12-05T00:00:00.000Z",
      "lastPaymentDate": null,
      "lastServiceDate": null,
      "nextServiceDate": null,
      "status": "ACTIVE",
      "notes": "Prefers morning service visits",
      "isArchived": false,
      "createdAt": "2026-11-15T08:55:00.000Z",
      "updatedAt": "2026-11-15T08:55:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

### `GET /api/v1/customers/:id`
Retrieves a single customer by UUID.

- **Auth Required:** Yes
- **Required Permission:** `customers.view`
- **Responses:**
  - `200 OK`: Customer object
  - `400 Bad Request`: Invalid UUID format
  - `404 Not Found`: Customer does not exist or is archived

### `POST /api/v1/customers`
Creates a new customer record and its primary `CustomerAddress` inside a database transaction, normalizing 10-digit Indian mobile numbers and checking for duplicates.

- **Auth Required:** Yes
- **Required Permission:** `customers.create`
- **Responses:**
  - `201 Created`: Created customer object
  - `400 Bad Request`: Zod validation error
  - `403 Forbidden`: Insufficient RBAC permissions
  - `409 Conflict`: Duplicate phone number

### `PATCH /api/v1/customers/:id`
Updates an existing customer record, enforces phone uniqueness across other customers, and records an audit log entry with before/after state.

- **Auth Required:** Yes
- **Required Permission:** `customers.update`
- **Responses:**
  - `200 OK`: Updated customer object
  - `400 Bad Request`: Validation error
  - `403 Forbidden`: Insufficient RBAC permissions
  - `404 Not Found`: Customer not found
  - `409 Conflict`: Phone number already registered to another customer

### `DELETE /api/v1/customers/:id`
Archives/soft-deletes a customer (`isArchived = true`, `status = 'INACTIVE'`, `deletedAt = NOW()`) so that all historical payments, invoices, rental contracts, complaints, and service jobs remain preserved in PostgreSQL.

- **Auth Required:** Yes
- **Required Permission:** `customers.delete`
- **Success (`200 OK`):**
```json
{
  "success": true,
  "message": "Customer archived successfully (historical records preserved)",
  "data": {
    "id": "b7c0d42e-4f1a-4b9e-8b0a-9b8d4c3e2f1a",
    "archived": true,
    "preservedHistory": {
      "payments": 1,
      "invoices": 0,
      "serviceJobs": 1,
      "rentalContracts": 0,
      "complaints": 0
    }
  },
  "meta": {}
}
```
