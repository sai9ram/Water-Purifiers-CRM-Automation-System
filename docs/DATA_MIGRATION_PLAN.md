# Pure Home Waters — Data Migration Plan (IndexedDB → PostgreSQL)

**Status:** Foundation Prepared (Execution Deferred Until Verified Source Backup Approval)  
**Source Database:** Browser IndexedDB (`PureHomeWatersDB`, Dexie v8) / SQL Snapshot (`pure-home-waters-backup-*.sql`)  
**Target Database:** PostgreSQL (`backend/prisma/schema.prisma`)

---

## 1. Guiding Principles & Non-Destructive Rules

1. **Zero Data Loss**: Browser IndexedDB (`PureHomeWatersDB`) is **never** cleared, reset, or overwritten during migration.
2. **Verified Backup Prerequisite**: Migration only executes against a verified backup file exported from the live browser (`Save Backup` `.sql` or JSON snapshot) with SHA-256 checksum recorded in `backup_logs`.
3. **No Historical Side Effects**: Imported historical payments, rental contracts, and service visits are flagged (`is_historical_import = true`) and **never** trigger automated invoice generation or WhatsApp payment reminders.
4. **Deterministic Legacy ID Mapping**: Every migrated PostgreSQL entity stores its original IndexedDB integer primary key in `legacy_id INT UNIQUE`.

---

## 2. Step-by-Step Migration Pipeline

### Step 1: Extract Every IndexedDB Store
Extract all 7 Dexie stores from `PureHomeWatersDB`:
1. `rentalPlans`
2. `technicians`
3. `customers`
4. `customerComplaints`
5. `customerComments`
6. `serviceRecords`
7. `payments`

### Step 2: Export Records as JSON & Record Source Counts
Export a structured JSON manifest containing exact source counts and a SHA-256 digest:
```json
{
  "exportedAt": "2026-11-15T09:00:00.000Z",
  "databaseName": "PureHomeWatersDB",
  "schemaVersion": 8,
  "counts": {
    "rentalPlans": 3,
    "technicians": 1,
    "customers": 0,
    "customerComplaints": 0,
    "customerComments": 0,
    "serviceRecords": 0,
    "payments": 0
  },
  "stores": { ... }
}
```

### Step 3: Legacy-to-PostgreSQL Model Mapping

| IndexedDB Store | PostgreSQL Target Table(s) | Key Transformations |
|---|---|---|
| `rentalPlans` | `rental_plans` | `id` → `legacy_id`; `monthlyRent` → `DECIMAL(12,2)`; `depositAmount` → `DECIMAL(12,2)`. |
| `technicians` | `technicians` | `id` → `legacy_id`; `isDefault` (`1`/`true`) → `BOOLEAN`. |
| `customers` | `customers`, `customer_addresses`, `customer_assets`, `rental_contracts` | `id` → `customers.legacy_id`; normalize 10-digit `phone`; create primary `CustomerAddress` from `address` + `area`; link `purifierModel` to `Product` & `CustomerAsset`; create active `RentalContract` with `monthlyRent`, `depositPaid`, and `nextDueDate`. |
| `customerComplaints` | `customer_complaints` | `id` → `legacy_id`; resolve `customerId` via `customers.legacy_id`; map `resolved: true` → `status = 'RESOLVED'`. |
| `customerComments` | `customer_comments` | `id` → `legacy_id`; resolve `customerId` via `customers.legacy_id` and `complaintId` via `customer_complaints.legacy_id`. |
| `serviceRecords` | `service_jobs`, `service_schedules` | `id` → `legacy_id`; resolve `customerId` via `customers.legacy_id`, `complaintId` via `customer_complaints.legacy_id`, and `technicianName` to `technicians.id`; map `serviceType` (`filter-change` → `FILTER_CHANGE`, etc.); if `serviceDate > NOW()`, set `status = 'SCHEDULED'`, else `'COMPLETED'`. |
| `payments` | `payments` | `id` → `legacy_id`; resolve `customerId` via `customers.legacy_id`; set `receiver = receiver ?? 'Charan'`; set `is_historical_import = true`. |

### Step 4: Handling Duplicate & Invalid Records
1. **Duplicate Phone Numbers**:
   - Normalize all phone numbers (strip `+91`, spaces, hyphens).
   - If two legacy customer records share the same 10-digit phone number, the primary active record keeps the normalized `phone`, while the secondary record is imported with a suffixed phone (`<phone>-DUP-<legacyId>`) and logged in the migration anomaly report for manual merge review.
2. **Invalid or Missing Dates**:
   - Missing `joinDate` defaults to `createdAt`.
   - Missing `nextDueDate` defaults to `joinDate + 1 month` and is flagged in the migration report.
3. **Orphaned Child Records**:
   - Any `payment`, `serviceRecord`, `complaint`, or `comment` referencing a non-existent `customerId` is quarantined into `migration-quarantine.json` rather than dropped silently.

### Step 5: Dependency-Ordered Transactional Import
Import executes in strict foreign-key dependency order inside a PostgreSQL transaction:
1. `products` & `rental_plans`
2. `technicians`
3. `customers` + `customer_addresses` + `customer_assets` + `rental_contracts`
4. `customer_complaints`
5. `customer_comments`
6. `service_schedules` + `service_jobs`
7. `payments` (`is_historical_import = true`)

### Step 6: Post-Import Verification & Migration Report
After import completes, the verifier asserts:
- Source count vs. imported count for every store.
- Sum of `customers.depositPaid` in IndexedDB == sum of `customers.deposit_paid` in PostgreSQL.
- Sum of `payments.amount` in IndexedDB == sum of `payments.amount` in PostgreSQL.
- Sum of `serviceRecords.cost` in IndexedDB == sum of `service_jobs.total_cost` in PostgreSQL.
- Generates `migration-report-YYYYMMDD.json` and logs a `BackupLog` record.

### Step 7: Rollback Capability
- All migrated rows carry `legacy_id IS NOT NULL`.
- If any verification check fails inside the import transaction, PostgreSQL automatically rolls back the entire transaction.
- Post-cutover rollback can also restore from the pre-migration `pg_dump` snapshot while browser IndexedDB remains intact as the untouched fallback.
