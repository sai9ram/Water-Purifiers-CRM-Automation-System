import { Injectable, computed, signal } from '@angular/core';
import { db } from '../db/database';
import { Customer, RentalPlan, ServiceRecord, PaymentRecord, CustomerComment, CustomerComplaint, Technician } from '../models/models';

type BackupState = 'idle' | 'running' | 'synced' | 'queued' | 'error';

interface BackupQueueItem {
  id: string;
  createdAt: string;
  reason: string;
  fileName: string;
  sql: string;
}

interface BackupSnapshot {
  customers: unknown[];
  rentalPlans: unknown[];
  serviceRecords: unknown[];
  payments: unknown[];
  customerComments: unknown[];
  customerComplaints: unknown[];
  technicians: unknown[];
}

@Injectable({ providedIn: 'root' })
export class BackupSyncService {
  private readonly queueStorageKey = 'phw-backup-sync-queue';
  private readonly syncUrl = '/api/backups';
  private readonly state = signal<BackupState>('idle');
  private readonly message = signal('No backup yet');
  private readonly pendingCount = signal(0);
  private readonly lastBackupAt = signal<Date | null>(null);
  private readonly lastSyncAt = signal<Date | null>(null);
  private syncing = false;

  readonly status = computed(() => ({
    state: this.state(),
    message: this.message(),
    pendingCount: this.pendingCount(),
    lastBackupAt: this.lastBackupAt(),
    lastSyncAt: this.lastSyncAt()
  }));

  constructor() {
    this.pendingCount.set(this.readQueue().length);

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => void this.flushQueue());
      window.setInterval(() => void this.flushQueue(), 30000);
    }
  }

  async triggerBackup(reason: string): Promise<void> {
    this.state.set('running');
    this.message.set(`Backing up after ${reason}`);

    try {
      const snapshot = await this.readSnapshot();
      const timestamp = new Date();
      const sql = this.buildMysqlDump(snapshot, timestamp);
      const fileName = this.buildFileName(timestamp);

      this.lastBackupAt.set(timestamp);

      const queueItem = this.createQueueItem(timestamp, reason, fileName, sql);
      this.enqueue(queueItem);
      await this.flushQueue();
    } catch {
      this.state.set('error');
      this.message.set('Backup failed');
    }
  }

  async saveBackupAndSync(): Promise<void> {
    this.state.set('running');
    this.message.set('Saving backup file');

    try {
      const snapshot = await this.readSnapshot();
      const timestamp = new Date();
      const sql = this.buildMysqlDump(snapshot, timestamp);
      const fileName = this.buildFileName(timestamp);

      await this.saveSqlBackup(fileName, sql);
      this.lastBackupAt.set(timestamp);

      const queueItem = this.createQueueItem(timestamp, 'manual save', fileName, sql);
      this.enqueue(queueItem);
      await this.flushQueue();
    } catch {
      this.state.set('error');
      this.message.set('Backup save failed');
    }
  }

  async retrySync(): Promise<void> {
    await this.flushQueue(true);
  }

  async importBackupFile(file: File): Promise<void> {
    this.state.set('running');
    this.message.set(`Importing ${file.name}`);

    try {
      const sql = await file.text();
      const snapshot = this.parseSqlBackup(sql);
      await this.replaceDatabase(snapshot);
      this.lastBackupAt.set(new Date());
      this.state.set('synced');
      this.message.set(`Imported backup from ${file.name}`);
    } catch (error) {
      console.error('Backup import failed', error);
      this.state.set('error');
      this.message.set('Backup import failed');
    }
  }

  private async replaceDatabase(snapshot: BackupSnapshot): Promise<void> {
    await Promise.all([
      db.rentalPlans.clear(),
      db.customers.clear(),
      db.serviceRecords.clear(),
      db.payments.clear(),
      db.customerComments.clear(),
      db.customerComplaints.clear(),
      db.technicians.clear()
    ]);

    await Promise.all([
      snapshot.rentalPlans.length ? db.rentalPlans.bulkPut(snapshot.rentalPlans as RentalPlan[]) : Promise.resolve(),
      snapshot.customers.length ? db.customers.bulkPut(snapshot.customers as Customer[]) : Promise.resolve(),
      snapshot.serviceRecords.length ? db.serviceRecords.bulkPut(snapshot.serviceRecords as ServiceRecord[]) : Promise.resolve(),
      snapshot.payments.length ? db.payments.bulkPut(snapshot.payments as PaymentRecord[]) : Promise.resolve(),
      snapshot.customerComments.length ? db.customerComments.bulkPut(snapshot.customerComments as CustomerComment[]) : Promise.resolve(),
      snapshot.customerComplaints.length ? db.customerComplaints.bulkPut(snapshot.customerComplaints as CustomerComplaint[]) : Promise.resolve(),
      snapshot.technicians.length ? db.technicians.bulkPut(snapshot.technicians as Technician[]) : Promise.resolve()
    ]);
  }

  private parseSqlBackup(sql: string): BackupSnapshot {
    const sanitized = sql
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*--.*$/gm, '');

    const tableMap: Record<string, keyof BackupSnapshot> = {
      rental_plans: 'rentalPlans',
      customers: 'customers',
      service_records: 'serviceRecords',
      payments: 'payments',
      customer_comments: 'customerComments',
      customer_complaints: 'customerComplaints',
      technicians: 'technicians'
    };

    const snapshot: BackupSnapshot = {
      customers: [],
      rentalPlans: [],
      serviceRecords: [],
      payments: [],
      customerComments: [],
      customerComplaints: [],
      technicians: []
    };
    const snapshotState: Partial<Record<keyof BackupSnapshot, unknown[]>> = snapshot;

    const insertMatches = sanitized.matchAll(/INSERT INTO (\w+) VALUES\s*([\s\S]*?);/gi);

    for (const match of insertMatches) {
      const tableName = match[1]?.toLowerCase();
      const targetKey = tableName ? tableMap[tableName] : undefined;

      if (!targetKey) continue;

      const rows = this.parseInsertRows(match[2] ?? '');
      const parsedRows = rows.map(row => this.mapRow(tableName!, row));
      snapshotState[targetKey] = parsedRows;
    }

    return snapshot;
  }

  private parseInsertRows(valuesBody: string): string[][] {
    const rows: string[][] = [];
    let index = 0;

    while (index < valuesBody.length) {
      while (index < valuesBody.length && /\s/.test(valuesBody[index])) {
        index++;
      }

      if (valuesBody[index] !== '(') {
        index++;
        continue;
      }

      let rowStart = index;
      let depth = 0;
      let inSingleQuote = false;
      let escaped = false;

      for (; index < valuesBody.length; index++) {
        const char = valuesBody[index];

        if (escaped) {
          escaped = false;
          continue;
        }

        if (char === '\\') {
          escaped = true;
          continue;
        }

        if (char === "'") {
          inSingleQuote = !inSingleQuote;
          continue;
        }

        if (!inSingleQuote) {
          if (char === '(') {
            depth++;
          } else if (char === ')') {
            depth--;
            if (depth === 0) {
              const rowContent = valuesBody.slice(rowStart + 1, index);
              rows.push(this.splitSqlRow(rowContent));
              index++;
              break;
            }
          }
        }
      }
    }

    return rows;
  }

  private splitSqlRow(row: string): string[] {
    const values: string[] = [];
    let current = '';
    let inSingleQuote = false;
    let escaped = false;
    let depth = 0;

    for (let index = 0; index < row.length; index++) {
      const char = row[index];

      if (escaped) {
        current += char;
        escaped = false;
        continue;
      }

      if (char === '\\') {
        current += char;
        escaped = true;
        continue;
      }

      if (char === "'") {
        current += char;
        inSingleQuote = !inSingleQuote;
        continue;
      }

      if (!inSingleQuote) {
        if (char === '(') {
          depth++;
          current += char;
          continue;
        }

        if (char === ')') {
          if (depth > 0) {
            depth--;
          }
          current += char;
          continue;
        }

        if (char === ',' && depth === 0) {
          values.push(current.trim());
          current = '';
          continue;
        }
      }

      current += char;
    }

    if (current.trim()) {
      values.push(current.trim());
    }

    return values;
  }

  private parseSqlValue(value: string): unknown {
    const trimmed = value.trim();

    if (!trimmed || trimmed === 'NULL') {
      return null;
    }

    if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
      return trimmed.slice(1, -1).replace(/''/g, "'");
    }

    if (trimmed === 'TRUE') {
      return true;
    }

    if (trimmed === 'FALSE') {
      return false;
    }

    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return Number(trimmed);
    }

    return trimmed;
  }

  private mapRow(tableName: string, values: string[]): unknown {
    const parsed = values.map(value => this.parseSqlValue(value));

    switch (tableName.toLowerCase()) {
      case 'rental_plans':
        return {
          id: this.toNumber(parsed[0]),
          name: this.toStringValue(parsed[1]),
          monthlyRent: this.toNumber(parsed[2]),
          depositAmount: this.toNumber(parsed[3]),
          description: this.toStringValue(parsed[4]),
          features: this.normalizeFeatures(parsed[5]),
          createdAt: this.toDateOrNow(parsed[6])
        } as RentalPlan;
      case 'customers':
        return {
          id: this.toNumber(parsed[0]),
          name: this.toStringValue(parsed[1]),
          phone: this.toStringValue(parsed[2]),
          alternatePhone: this.toStringValue(parsed[3]) || undefined,
          address: this.toStringValue(parsed[4]),
          area: this.toStringValue(parsed[5]),
          purifierModel: this.toStringValue(parsed[6]),
          planId: this.toNumber(parsed[7]),
          planName: this.toStringValue(parsed[8]) || undefined,
          monthlyRent: this.toNumber(parsed[9]) || undefined,
          depositPaid: this.toNumber(parsed[10]),
          joinDate: this.toDateOrNow(parsed[11]),
          nextDueDate: this.toDateOrNow(parsed[12]),
          lastPaymentDate: this.toDateOrNull(parsed[13]) ?? undefined,
          lastServiceDate: this.toDateOrNull(parsed[14]) ?? undefined,
          nextServiceDate: this.toDateOrNull(parsed[15]) ?? undefined,
          status: this.toStringValue(parsed[16]) as Customer['status'],
          initialInvestment: this.toNumber(parsed[17]) || undefined,
          notes: this.toStringValue(parsed[18]) || undefined,
          createdAt: this.toDateOrNow(parsed[19])
        } as Customer;
      case 'service_records':
        return {
          id: this.toNumber(parsed[0]),
          customerId: this.toNumber(parsed[1]),
          customerName: this.toStringValue(parsed[2]) || undefined,
          serviceType: this.toStringValue(parsed[3]) as ServiceRecord['serviceType'],
          serviceDate: this.toDateOrNow(parsed[4]),
          nextServiceDate: this.toDateOrNull(parsed[5]) ?? undefined,
          technicianName: this.toStringValue(parsed[6]),
          partsReplaced: this.toStringValue(parsed[7]) || undefined,
          notes: this.toStringValue(parsed[8]) || undefined,
          cost: this.toNumber(parsed[9]) || undefined,
          createdAt: this.toDateOrNow(parsed[10])
        } as ServiceRecord;
      case 'payments':
        return {
          id: this.toNumber(parsed[0]),
          customerId: this.toNumber(parsed[1]),
          amount: this.toNumber(parsed[2]),
          paidDate: this.toDateOrNow(parsed[3]),
          forMonth: this.toStringValue(parsed[4]),
          notes: this.toStringValue(parsed[5]) || undefined,
          createdAt: this.toDateOrNow(parsed[6])
        } as PaymentRecord;
      case 'customer_comments':
        return {
          id: this.toNumber(parsed[0]),
          customerId: this.toNumber(parsed[1]),
          complaintId: this.toNumber(parsed[2]) || undefined,
          comment: this.toStringValue(parsed[3]),
          createdAt: this.toDateOrNow(parsed[4])
        } as CustomerComment;
      case 'customer_complaints':
        return {
          id: this.toNumber(parsed[0]),
          customerId: this.toNumber(parsed[1]),
          complaint: this.toStringValue(parsed[2]),
          resolved: this.toBoolean(parsed[3]),
          createdAt: this.toDateOrNow(parsed[4])
        } as CustomerComplaint;
      case 'technicians':
        return {
          id: this.toNumber(parsed[0]),
          name: this.toStringValue(parsed[1]),
          isDefault: this.toBoolean(parsed[2]),
          createdAt: this.toDateOrNow(parsed[3])
        } as Technician;
      default:
        return null;
    }
  }

  private toDateOrNull(value: unknown): Date | null {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === 'string') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if (typeof value === 'number') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
  }

  private toDateOrNow(value: unknown): Date {
    return this.toDateOrNull(value) ?? new Date();
  }

  private toNumber(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
  }

  private toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value !== 0;
    }

    if (typeof value === 'string') {
      return value === '1' || value.toLowerCase() === 'true';
    }

    return false;
  }

  private toStringValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value);
  }

  private normalizeFeatures(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string');
    }

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
      } catch {
        return [];
      }
    }

    return [];
  }

  private async readSnapshot(): Promise<BackupSnapshot> {
    const [customers, rentalPlans, serviceRecords, payments, customerComments, customerComplaints, technicians] = await Promise.all([
      db.customers.toArray(),
      db.rentalPlans.toArray(),
      db.serviceRecords.toArray(),
      db.payments.toArray(),
      db.customerComments.toArray(),
      db.customerComplaints.toArray(),
      db.technicians.toArray()
    ]);

    return { customers, rentalPlans, serviceRecords, payments, customerComments, customerComplaints, technicians };
  }

  private buildMysqlDump(snapshot: BackupSnapshot, createdAt: Date): string {
    const lines: string[] = [
      '-- Pure Home Waters backup',
      `-- Generated at ${createdAt.toISOString()}`,
      'SET NAMES utf8mb4;',
      'SET FOREIGN_KEY_CHECKS = 0;',
      '',
      'CREATE TABLE IF NOT EXISTS rental_plans (',
      '  id BIGINT PRIMARY KEY,',
      '  name VARCHAR(255) NOT NULL,',
      '  monthly_rent DECIMAL(10,2) NOT NULL,',
      '  deposit_amount DECIMAL(10,2) NOT NULL,',
      '  description TEXT NULL,',
      '  features JSON NULL,',
      '  created_at DATETIME NOT NULL',
      ');',
      '',
      'CREATE TABLE IF NOT EXISTS customers (',
      '  id BIGINT PRIMARY KEY,',
      '  name VARCHAR(255) NOT NULL,',
      '  phone VARCHAR(20) NOT NULL,',
      '  alternate_phone VARCHAR(20) NULL,',
      '  address TEXT NOT NULL,',
      '  area VARCHAR(255) NOT NULL,',
      '  purifier_model VARCHAR(255) NOT NULL,',
      '  plan_id BIGINT NOT NULL,',
      '  plan_name VARCHAR(255) NULL,',
      '  monthly_rent DECIMAL(10,2) NULL,',
      '  deposit_paid DECIMAL(10,2) NOT NULL,',
      '  join_date DATETIME NOT NULL,',
      '  next_due_date DATETIME NOT NULL,',
      '  last_payment_date DATETIME NULL,',
      '  last_service_date DATETIME NULL,',
      '  next_service_date DATETIME NULL,',
      '  status VARCHAR(32) NOT NULL,',
      '  initial_investment DECIMAL(10,2) NULL,',
      '  notes TEXT NULL,',
      '  created_at DATETIME NOT NULL',
      ');',
      '',
      'CREATE TABLE IF NOT EXISTS service_records (',
      '  id BIGINT PRIMARY KEY,',
      '  customer_id BIGINT NOT NULL,',
      '  customer_name VARCHAR(255) NULL,',
      '  service_type VARCHAR(64) NOT NULL,',
      '  service_date DATETIME NOT NULL,',
      '  next_service_date DATETIME NULL,',
      '  technician_name VARCHAR(255) NOT NULL,',
      '  parts_replaced TEXT NULL,',
      '  notes TEXT NULL,',
      '  cost DECIMAL(10,2) NULL,',
      '  created_at DATETIME NOT NULL',
      ');',
      '',
      'CREATE TABLE IF NOT EXISTS payments (',
      '  id BIGINT PRIMARY KEY,',
      '  customer_id BIGINT NOT NULL,',
      '  amount DECIMAL(10,2) NOT NULL,',
      '  paid_date DATETIME NOT NULL,',
      '  for_month VARCHAR(64) NOT NULL,',
      '  notes TEXT NULL,',
      '  created_at DATETIME NOT NULL',
      ');',
      '',
      'CREATE TABLE IF NOT EXISTS customer_comments (',
      '  id BIGINT PRIMARY KEY,',
      '  customer_id BIGINT NOT NULL,',
      '  complaint_id BIGINT NULL,',
      '  comment TEXT NOT NULL,',
      '  created_at DATETIME NOT NULL',
      ');',
      '',
      'CREATE TABLE IF NOT EXISTS customer_complaints (',
      '  id BIGINT PRIMARY KEY,',
      '  customer_id BIGINT NOT NULL,',
      '  complaint TEXT NOT NULL,',
      '  resolved TINYINT(1) NOT NULL DEFAULT 0,',
      '  created_at DATETIME NOT NULL',
      ');',
      '',
      'CREATE TABLE IF NOT EXISTS technicians (',
      '  id BIGINT PRIMARY KEY,',
      '  name VARCHAR(255) NOT NULL,',
      '  is_default TINYINT(1) NOT NULL,',
      '  created_at DATETIME NOT NULL',
      ');',
      ''
    ];

    lines.push(this.buildInsert('rental_plans', snapshot.rentalPlans, plan => [
      this.sqlValue(plan.id),
      this.sqlValue(plan.name),
      this.sqlValue(plan.monthlyRent),
      this.sqlValue(plan.depositAmount),
      this.sqlValue(plan.description),
      this.sqlValue(JSON.stringify(plan.features ?? [])),
      this.sqlValue(plan.createdAt)
    ]));

    lines.push(this.buildInsert('customers', snapshot.customers, customer => [
      this.sqlValue(customer.id),
      this.sqlValue(customer.name),
      this.sqlValue(customer.phone),
      this.sqlValue(customer.alternatePhone),
      this.sqlValue(customer.address),
      this.sqlValue(customer.area),
      this.sqlValue(customer.purifierModel),
      this.sqlValue(customer.planId),
      this.sqlValue(customer.planName),
      this.sqlValue(customer.monthlyRent),
      this.sqlValue(customer.depositPaid),
      this.sqlValue(customer.joinDate),
      this.sqlValue(customer.nextDueDate),
      this.sqlValue(customer.lastPaymentDate),
      this.sqlValue(customer.lastServiceDate),
      this.sqlValue(customer.nextServiceDate),
      this.sqlValue(customer.status),
      this.sqlValue(customer.initialInvestment),
      this.sqlValue(customer.notes),
      this.sqlValue(customer.createdAt)
    ]));

    lines.push(this.buildInsert('service_records', snapshot.serviceRecords, record => [
      this.sqlValue(record.id),
      this.sqlValue(record.customerId),
      this.sqlValue(record.customerName),
      this.sqlValue(record.serviceType),
      this.sqlValue(record.serviceDate),
      this.sqlValue(record.nextServiceDate),
      this.sqlValue(record.technicianName),
      this.sqlValue(record.partsReplaced),
      this.sqlValue(record.notes),
      this.sqlValue(record.cost),
      this.sqlValue(record.createdAt)
    ]));

    lines.push(this.buildInsert('payments', snapshot.payments, payment => [
      this.sqlValue(payment.id),
      this.sqlValue(payment.customerId),
      this.sqlValue(payment.amount),
      this.sqlValue(payment.paidDate),
      this.sqlValue(payment.forMonth),
      this.sqlValue(payment.notes),
      this.sqlValue(payment.createdAt)
    ]));

    lines.push(this.buildInsert('customer_comments', snapshot.customerComments, comment => [
      this.sqlValue(comment.id),
      this.sqlValue(comment.customerId),
      this.sqlValue(comment.complaintId),
      this.sqlValue(comment.comment),
      this.sqlValue(comment.createdAt)
    ]));

    lines.push(this.buildInsert('technicians', snapshot.technicians, tech => [
      this.sqlValue(tech.id),
      this.sqlValue(tech.name),
      this.sqlValue(tech.isDefault ? 1 : 0),
      this.sqlValue(tech.createdAt)
    ]));

    lines.push(this.buildInsert('customer_complaints', snapshot.customerComplaints, complaint => [
      this.sqlValue(complaint.id),
      this.sqlValue(complaint.customerId),
      this.sqlValue(complaint.complaint),
      this.sqlValue(complaint.resolved ? 1 : 0),
      this.sqlValue(complaint.createdAt)
    ]));

    lines.push('SET FOREIGN_KEY_CHECKS = 1;');
    return lines.filter(Boolean).join('\n');
  }

  private buildInsert(tableName: string, rows: any[], mapRow: (row: any) => string[]): string {
    if (!rows.length) {
      return `-- No rows for ${tableName}\n`;
    }

    const values = rows.map(row => `(${mapRow(row).join(', ')})`).join(',\n');
    return `INSERT INTO ${tableName} VALUES\n${values};\n`;
  }

  private sqlValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return 'NULL';
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
    if (typeof value === 'boolean') return value ? '1' : '0';

    const date = this.toDate(value);
    if (date) return `'${this.formatSqlDate(date)}'`;

    return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
  }

  private toDate(value: unknown): Date | null {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  }

  private formatSqlDate(date: Date): string {
    const pad = (num: number) => String(num).padStart(2, '0');
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate())
    ].join('-') + ' ' + [
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds())
    ].join(':');
  }

  private buildFileName(date: Date): string {
    const pad = (num: number) => String(num).padStart(2, '0');
    const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
    return `pure-home-waters-backup-${stamp}.sql`;
  }

  private async saveSqlBackup(fileName: string, sql: string): Promise<void> {
    if (typeof window === 'undefined') return;

    const data = new Blob([sql], { type: 'application/sql;charset=utf-8' });
    const savePicker = (window as any).showSaveFilePicker;

    if (typeof savePicker === 'function') {
      const fileHandle = await savePicker({
        suggestedName: fileName,
        types: [
          {
            description: 'SQL Backup',
            accept: { 'application/sql': ['.sql'] }
          }
        ],
        excludeAcceptAllOption: false
      });

      const writable = await fileHandle.createWritable();
      await writable.write(data);
      await writable.close();
      return;
    }

    this.downloadSqlBackup(fileName, sql);
  }

  private downloadSqlBackup(fileName: string, sql: string): void {
    if (typeof document === 'undefined') return;

    const blob = new Blob([sql], { type: 'application/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  private createQueueItem(timestamp: Date, reason: string, fileName: string, sql: string): BackupQueueItem {
    return {
      id: `${timestamp.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: timestamp.toISOString(),
      reason,
      fileName,
      sql
    };
  }

  private enqueue(item: BackupQueueItem): void {
    const queue = this.readQueue();
    queue.push(item);
    this.writeQueue(queue);
    this.pendingCount.set(queue.length);
    this.state.set('queued');
    this.message.set(`Backup saved, sync queued (${queue.length})`);
  }

  private async flushQueue(force = false): Promise<void> {
    if (this.syncing) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine && !force) {
      this.state.set('queued');
      this.message.set(`Backup saved, waiting for internet (${this.pendingCount()})`);
      return;
    }

    const queue = this.readQueue();
    if (!queue.length) {
      if (this.lastBackupAt()) {
        this.state.set('synced');
        this.message.set('Backup and sync up to date');
      }
      this.pendingCount.set(0);
      return;
    }

    this.syncing = true;
    try {
      const remaining: BackupQueueItem[] = [];

      for (const item of queue) {
        const response = await fetch(this.syncUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item)
        });

        if (!response.ok) {
          remaining.push(item);
          remaining.push(...queue.slice(queue.indexOf(item) + 1));
          break;
        }
      }

      this.writeQueue(remaining);
      this.pendingCount.set(remaining.length);

      if (remaining.length === 0) {
        const syncedAt = new Date();
        this.lastSyncAt.set(syncedAt);
        this.state.set('synced');
        this.message.set('Backup downloaded and synced');
      } else {
        this.state.set('queued');
        this.message.set(`Backup saved, sync queued (${remaining.length})`);
      }
    } catch {
      this.state.set('queued');
      this.message.set(`Backup saved, sync queued (${queue.length})`);
    } finally {
      this.syncing = false;
    }
  }

  private readQueue(): BackupQueueItem[] {
    if (typeof localStorage === 'undefined') return [];

    try {
      const raw = localStorage.getItem(this.queueStorageKey);
      return raw ? JSON.parse(raw) as BackupQueueItem[] : [];
    } catch {
      return [];
    }
  }

  private writeQueue(queue: BackupQueueItem[]): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(this.queueStorageKey, JSON.stringify(queue));
  }
}
