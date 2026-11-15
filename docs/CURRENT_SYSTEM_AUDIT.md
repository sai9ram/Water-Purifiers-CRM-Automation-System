# Pure Home Waters — Current System Audit

**Audit Date:** 2026-11-15  
**Repository Root:** `pure-home-waters/`  
**Application Type:** Production-oriented Water Purifier Rental CRM (Tirupati, India)

---

## 1. Executive Summary

Pure Home Waters CRM is currently an **Angular 17.3 standalone Single-Page Application (SPA)** styled with **Angular Material 17** and custom SCSS. All operational CRM state is stored client-side in the browser's **IndexedDB** via **Dexie.js (`PureHomeWatersDB`, schema version 8)**.

A lightweight **PHP/MySQL scaffold (`api/`)** exists in the repository (`api/index.php`, `api/db.php`, `api/config.php`, `api/schema.sql`), but the Angular frontend services (`CustomerService`, `PlanService`, `PaymentService`, `ServiceRecordService`, `TechnicianService`, `CustomerComplaintService`, `CustomerCommentService`) do **not** call the PHP CRUD endpoints. Only `BackupSyncService` previously referenced `/api/backups` to upload raw SQL dump snapshots.

---

## 2. Angular Application Structure

```text
pure-home-waters/
├── api/                                # Legacy PHP/MySQL scaffold (to be retained during migration)
│   ├── .htaccess
│   ├── config.php
│   ├── db.php
│   ├── index.php
│   ├── README.md
│   ├── schema.sql
│   └── backups/.gitkeep
├── src/
│   ├── index.html
│   ├── main.ts
│   ├── styles.scss
│   └── app/
│       ├── app.component.{ts,html,scss}
│       ├── app.config.ts
│       ├── app.routes.ts
│       ├── core/
│       │   ├── db/
│       │   │   └── database.ts         # Dexie.js IndexedDB definition (PureHomeWatersDB v8)
│       │   ├── models/
│       │   │   └── models.ts           # TypeScript interfaces & domain constants
│       │   └── services/
│       │       ├── backup-sync.service.ts
│       │       ├── customer-comment.service.ts
│       │       ├── customer-complaint.service.ts
│       │       ├── customer-report-export.service.ts
│       │       ├── customer.service.ts
│       │       ├── payment-link.service.ts
│       │       ├── payment.service.ts
│       │       ├── plan.service.ts
│       │       ├── service-record.service.ts
│       │       ├── technician.service.ts
│       │       └── whatsapp.service.ts
│       └── features/
│           ├── complaints/
│           │   ├── complaints.component.ts
│           │   └── complaint-comments-dialog.component.ts
│           ├── customers/
│           │   ├── customer-complaint-dialog.component.ts
│           │   ├── customer-detail/
│           │   │   └── customer-detail.component.{ts,html,scss}
│           │   ├── customer-form-dialog/
│           │   │   └── customer-form-dialog.component.{ts,html,scss}
│           │   └── customer-list/
│           │       └── customer-list.component.{ts,html,scss}
│           ├── dashboard/
│           │   └── dashboard.component.{ts,html,scss}
│           ├── payments/
│           │   ├── edit-receiver-dialog.component.ts
│           │   └── payments.component.{ts,html,scss}
│           ├── plans/
│           │   └── plans.component.{ts,html,scss}
│           ├── reminders/
│           │   ├── payment-record-dialog.component.ts
│           │   └── reminders.component.{ts,html,scss}
│           ├── services/
│           │   ├── edit-cost-dialog.component.ts
│           │   └── services.component.{ts,html,scss}
│           └── technicians/
│               └── technicians.component.ts
├── angular.json
├── package.json
├── tsconfig.json
└── vercel.json
```

---

## 3. Existing TypeScript Data Models (`src/app/core/models/models.ts`)

| Interface / Type | Fields | Notes & Limitations |
|---|---|---|
| `RentalPlan` | `id?: number`, `name: string`, `monthlyRent: number`, `depositAmount: number`, `description: string`, `features: string[]`, `createdAt: Date` | Auto-increment numeric ID in IndexedDB. Seeded with 3 default plans (`Basic` ₹399, `Standard` ₹499, `Premium` ₹499). |
| `Customer` | `id?: number`, `name: string`, `phone: string`, `alternatePhone?: string`, `address: string`, `area: string`, `purifierModel: string`, `planId: number`, `planName?: string`, `monthlyRent?: number`, `depositPaid: number`, `initialInvestment?: number`, `joinDate: Date`, `nextDueDate: Date`, `lastPaymentDate?: Date`, `lastServiceDate?: Date`, `nextServiceDate?: Date`, `status: 'active' \| 'inactive' \| 'overdue'`, `notes?: string`, `createdAt: Date` | Combines customer identity, address, installed purifier asset, rental contract, and billing schedule into a single denormalized record. |
| `ServiceRecord` | `id?: number`, `customerId: number`, `customerName?: string`, `serviceType: 'filter-change' \| 'repair' \| 'installation' \| 'general-service' \| 'demo'`, `serviceDate: Date`, `nextServiceDate?: Date`, `complaintId?: number`, `technicianName: string`, `partsReplaced?: string`, `notes?: string`, `cost?: number`, `createdAt: Date` | Uses `technicianName` string rather than a foreign key to `Technician.id`. Future `serviceDate > today` is treated as a scheduled appointment. |
| `Technician` | `id?: number`, `name: string`, `isDefault: boolean`, `createdAt: Date` | Lacks phone, email, status, or user account link. |
| `PaymentRecord` | `id?: number`, `customerId: number`, `amount: number`, `paidDate: Date`, `forMonth: string`, `receiver?: string`, `notes?: string`, `createdAt: Date` | Lacks invoice reference, payment method (UPI/Cash/Bank/Razorpay), transaction reference ID, and payment status. `receiver` defaults to `'Charan'` or `'Nagarjuna'`. |
| `CustomerComment` | `id?: number`, `customerId: number`, `complaintId?: number`, `comment: string`, `createdAt: Date` | General customer comment or complaint thread comment. No author `userId`. |
| `CustomerComplaint` | `id?: number`, `customerId: number`, `complaint: string`, `resolved?: boolean`, `createdAt: Date` | Boolean `resolved` flag only; lacks priority, category, assigned technician, or resolution timestamp. |

**Domain Constants in `models.ts`:**
- `SERVICE_TYPE_LABELS`: Maps `filter-change`, `repair`, `installation`, `general-service`, `demo` to human-readable labels.
- `PURIFIER_MODELS`: `['Dolphin', 'Purosis', 'Purosis Plus', 'Priya Aqua Steel Guard', 'Fonix', 'Other']`.

---

## 4. IndexedDB Database Stores (`src/app/core/db/database.ts`)

- **Database Name:** `PureHomeWatersDB`
- **Engine:** Dexie.js `^3.2.4`
- **Current Version:** Version `8`

| Store Name | Primary Key & Indexed Columns | Seed Data on First Run |
|---|---|---|
| `customers` | `++id, name, phone, planId, status, nextDueDate, area` | None |
| `rentalPlans` | `++id, name, monthlyRent` | 3 plans (`Basic`, `Standard`, `Premium`) |
| `serviceRecords` | `++id, customerId, serviceDate, serviceType, nextServiceDate, complaintId` | None |
| `payments` | `++id, customerId, paidDate` | None |
| `customerComments` | `++id, customerId, complaintId, createdAt` | None |
| `customerComplaints` | `++id, customerId, resolved, createdAt` | None |
| `technicians` | `++id, name, isDefault` | 1 technician (`Default Technician`, `isDefault: true`) |

---

## 5. Angular Services Accessing IndexedDB (`src/app/core/services/`)

1. **`CustomerService` (`customer.service.ts`)**
   - Accesses `db.customers`, `db.rentalPlans`, `db.payments`.
   - Methods: `getAll()`, `getById(id)`, `getByStatus(status)`, `getDueThisMonth()`, `getOverdue()`, `add(customer)`, `update(id, changes)`, `delete(id)`, `search(query)`, `getStats()`.
   - Calls `BackupSyncService.triggerBackup(...)` on `add` and `update`.
2. **`PlanService` (`plan.service.ts`)**
   - Accesses `db.rentalPlans`.
   - Methods: `getAll()`, `getById(id)`, `add(plan)`, `update(id, changes)`, `delete(id)`.
3. **`PaymentService` (`payment.service.ts`)**
   - Accesses `db.payments`.
   - Methods: `getAll()`, `getByCustomer(customerId)`, `add(payment)`, `update(id, changes)`, `delete(id)`, `getTotalCollected()`.
4. **`ServiceRecordService` (`service-record.service.ts`)**
   - Accesses `db.serviceRecords`.
   - Methods: `getAll()`, `getByCustomer(customerId)`, `getRecent(limit)`, `getUpcoming()`, `add(record)`, `update(id, changes)`, `delete(id)`, `getStats()`.
5. **`TechnicianService` (`technician.service.ts`)**
   - Accesses `db.technicians` (uses read-write transactions to ensure only one technician has `isDefault = true`).
   - Methods: `getAll()`, `getDefault()`, `add(technician)`, `update(id, technician)`, `delete(id)`.
6. **`CustomerComplaintService` (`customer-complaint.service.ts`)**
   - Accesses `db.customerComplaints`.
   - Methods: `getAll()`, `getByCustomer(customerId)`, `add(complaint)`, `update(id, updates)`, `delete(id)`.
7. **`CustomerCommentService` (`customer-comment.service.ts`)**
   - Accesses `db.customerComments`.
   - Methods: `getAll()`, `getByCustomer(customerId)`, `getByComplaint(complaintId)`, `add(comment)`, `delete(id)`.
8. **`CustomerReportExportService` (`customer-report-export.service.ts`)**
   - Reads `db.customers`, `db.payments`, `db.serviceRecords`, `db.rentalPlans` directly and generates a 4-sheet `.xlsx` workbook (`Customer Details`, `Rent History`, `Payment History`, `Service History`) using SheetJS (`xlsx`).
9. **`BackupSyncService` (`backup-sync.service.ts`)**
   - Reads and writes all 7 Dexie tables (`customers`, `rentalPlans`, `serviceRecords`, `payments`, `customerComments`, `customerComplaints`, `technicians`).
   - Serializes all 7 stores into a custom SQL dump (`pure-home-waters-backup-YYYYMMDD_HHMMSS.sql`) and parses `.sql` backup files back into IndexedDB via `parseSqlBackup()` + `replaceDatabase()`.

**Non-IndexedDB Utility Services:**
- **`PaymentLinkService` (`payment-link.service.ts`)**: Generates external static payment URLs (`https://pay.purehomewaters.com/pay.html?am=<amount>&type=rent`).
- **`WhatsappService` (`whatsapp.service.ts`)**: Formats rent reminder and service reminder messages and opens `https://wa.me/91<phone>?text=<encoded>` in a new browser tab.

---

## 6. Existing PHP API & MySQL Schema (`api/`)

- **`api/schema.sql`**: Defines only **5** tables (`rental_plans`, `customers`, `service_records`, `payments`, `customer_comments`).
  - Missing from `api/schema.sql`: `customer_complaints`, `technicians`, `payments.receiver`, `service_records.complaint_id`, `customer_comments.complaint_id`, foreign keys, and indexes.
- **`api/index.php` & `api/db.php`**:
  - Generic CRUD router without authentication, authorization, pagination, or validation.
  - Falls back to `MockDatabase` (which returns empty arrays and fake insert IDs `1001+`) whenever MySQL is unreachable.
  - Wildcard CORS (`Access-Control-Allow-Origin: *`).

---

## 7. Existing Business Workflows

1. **Customer Onboarding & Management (`/customers`, `/customers/:id`)**:
   - Staff add/edit customers with purifier model, rental plan, monthly rent, security deposit, initial investment, join date, next rent due date, and next service date.
   - Customer detail view calculates unit-level ROI: `grossProfit = totalPaid - totalServiceCost`, `returnDelta = grossProfit - initialInvestment` (`Profit`, `Loss`, or `Cost to cost`).
2. **Rent Reminders & Collection (`/reminders`, `/payments`)**:
   - Lists customers who have no payment recorded within the selected date range.
   - Marks a customer as overdue if unpaid after the 5th of the month (`graceDate = 5th`).
   - Generates WhatsApp `wa.me` deep links individually or in bulk (with a 1.2s delay between tabs).
   - Recording a payment (`PaymentRecordDialogComponent` or `CustomerDetailComponent`) adds a `PaymentRecord` and advances `customer.nextDueDate` by 1 month (`status: 'active'`).
3. **Maintenance & Service Visits (`/services`)**:
   - Tracks completed service visits (`formMode = 'log'`) and future scheduled appointments (`formMode = 'schedule'`).
   - Default maintenance interval is **3 months** (`nextServiceDate = serviceDate + 3 months`).
4. **Complaints & Follow-up (`/complaints`)**:
   - Logs customer issues, supports threaded comments per complaint, and allows 1-click scheduling of a repair service visit (`serviceType: 'repair'`) with the default technician for tomorrow.
5. **Backup & Reporting (`AppComponent`)**:
   - Topbar actions allow downloading a `.sql` snapshot (`Save Backup`), importing a `.sql` snapshot (`Open Backup`), and exporting a 4-sheet `.xlsx` report (`Download Excel`).

---

## 8. Missing Backend Functionality

1. **No Real Server-Side Persistence**: All data lives in single-browser IndexedDB and is not shared across devices or staff members.
2. **No Authentication or RBAC**: Anyone opening the URL has full read/write/delete access to all records.
3. **No Relational Data Integrity**:
   - Deleting a customer in IndexedDB orphans their `payments`, `serviceRecords`, `customerComplaints`, and `customerComments`.
   - Customer address, asset (`purifierModel`), rental contract (`planId`, `monthlyRent`, `depositPaid`), and billing schedule (`nextDueDate`) are flattened into one table.
4. **No Invoice Lifecycle**: Payments are recorded ad-hoc with a free-text `forMonth` string (`"April 2025"`) rather than against formal invoices (`Invoice` / `InvoiceItem`).
5. **No Automated Background Jobs**: Monthly billing generation, due reminders, overdue escalations, and 90-day filter maintenance schedules are completely manual.
6. **No Audit Trail**: Financial edits (e.g., changing payment receiver, deleting payments, editing service cost) have no audit log.
7. **No Webhook / Payment Gateway Verification**: Payment links point to a static HTML page (`https://pay.purehomewaters.com/pay.html`) with no Razorpay order/payment-link tracking or webhook signature verification.

---

## 9. Migration Risks & Safeguards

1. **Data Loss Risk if IndexedDB is Cleared**:
   - **Safeguard**: IndexedDB (`PureHomeWatersDB`) must remain untouched during backend development. Migration must extract data via non-destructive JSON/SQL export and verify row counts before cutover.
2. **Legacy Numeric IDs vs. PostgreSQL UUIDs**:
   - IndexedDB uses auto-increment integer IDs (`1, 2, 3...`).
   - **Safeguard**: Every migrated PostgreSQL table includes a unique `legacyId Int? @unique` column so foreign keys (`customerId`, `planId`, `complaintId`) map deterministically during import.
3. **Duplicate Phone Numbers or Inconsistent Dates**:
   - Legacy customer phones may include formatting characters (`+91`, spaces, dashes).
   - **Safeguard**: Normalize phone numbers during validation/import while preserving raw notes and flagging duplicates in the migration report.
4. **Unwanted Historical Notifications**:
   - **Safeguard**: Historical imported records must never trigger automated invoice generation or WhatsApp payment reminders.

---

## 10. Reusable Frontend Components & Logic

- **Reusable UI Components**: All Angular 17 standalone feature components (`DashboardComponent`, `CustomerListComponent`, `CustomerDetailComponent`, `RemindersComponent`, `PaymentsComponent`, `ServicesComponent`, `ComplaintsComponent`, `TechniciansComponent`, `PlansComponent`) and Material dialogs are clean and modular.
- **Service Abstraction Layer**: All UI components interact with data exclusively through the 7 core Angular services (`CustomerService`, `PlanService`, `PaymentService`, `ServiceRecordService`, `TechnicianService`, `CustomerComplaintService`, `CustomerCommentService`) returning RxJS `Observable<T>`, making progressive cutover from Dexie `from(...)` to Angular `HttpClient` straightforward in Step 2+.
- **Reusable Business Rules**:
  - 3-month maintenance cycle calculation (`nextServiceDate = serviceDate + 3 months`).
  - 5th-of-the-month rent grace period calculation.
  - Unit economics ROI calculation (`totalPaid - totalServiceCost - initialInvestment`).
  - Multi-sheet Excel report formatting logic (`CustomerReportExportService`).
  - WhatsApp message templates (`WhatsappService`).
