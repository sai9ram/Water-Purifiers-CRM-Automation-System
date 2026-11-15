import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { map, shareReplay, tap } from 'rxjs/operators';
import { db, dbCacheVersion } from '../db/database';
import { Customer, CustomerStatus } from '../models/models';
import { BackupSyncService } from './backup-sync.service';

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private allCache$: Observable<Customer[]> | null = null;
  private cachedVersion = -1;

  constructor(private backupSyncSvc: BackupSyncService) {}

  invalidateCache(): void {
    this.allCache$ = null;
  }

  getAll(): Observable<Customer[]> {
    if (!this.allCache$ || this.cachedVersion !== dbCacheVersion) {
      this.cachedVersion = dbCacheVersion;
      this.allCache$ = from(db.customers.orderBy('name').toArray()).pipe(
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }
    return this.allCache$.pipe(map(list => [...list]));
  }

  getById(id: number): Observable<Customer | undefined> {
    if (this.allCache$) {
      return this.allCache$.pipe(map(list => list.find(c => c.id === id)));
    }
    return from(db.customers.get(id));
  }

  getByStatus(status: CustomerStatus): Observable<Customer[]> {
    return this.getAll().pipe(map(list => list.filter(c => c.status === status)));
  }

  getDueThisMonth(): Observable<Customer[]> {
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    return this.getAll().pipe(
      map(list =>
        list.filter(c => {
          const due = new Date(c.nextDueDate);
          return due >= start && due <= end && (c.status === 'active' || c.status === 'overdue');
        })
      )
    );
  }

  getOverdue(): Observable<Customer[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.getAll().pipe(
      map(list => list.filter(c => new Date(c.nextDueDate) < today && c.status !== 'inactive'))
    );
  }

  add(customer: Omit<Customer, 'id' | 'createdAt'>): Observable<number> {
    return from(db.customers.add({ ...customer, createdAt: new Date() } as Customer)).pipe(
      tap(() => {
        this.invalidateCache();
        void this.backupSyncSvc.triggerBackup('customer create');
      })
    );
  }

  update(id: number, changes: Partial<Customer>): Observable<number> {
    return from(db.customers.update(id, changes)).pipe(
      tap(() => {
        this.invalidateCache();
        void this.backupSyncSvc.triggerBackup('customer update');
      })
    );
  }

  delete(id: number): Observable<void> {
    return from(db.customers.delete(id)).pipe(
      tap(() => this.invalidateCache())
    );
  }

  search(query: string): Observable<Customer[]> {
    const q = query.toLowerCase();
    return this.getAll().pipe(
      map(list =>
        list.filter(c =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.area.toLowerCase().includes(q) ||
          c.purifierModel.toLowerCase().includes(q)
        )
      )
    );
  }

  getStats(): Observable<{
    total: number; active: number; inactive: number; overdue: number;
    totalRevenue: number; monthlyRevenue: number;
  }> {
    return from((async () => {
      const [all, plans, payments] = await Promise.all([
        db.customers.toArray(),
        db.rentalPlans.toArray(),
        db.payments.toArray()
      ]);
      const active    = all.filter(c => c.status === 'active').length;
      const inactive  = all.filter(c => c.status === 'inactive').length;
      const overdue   = all.filter(c => c.status === 'overdue').length;

      const planMap   = new Map(plans.map(p => [p.id!, p.monthlyRent]));

      const monthlyRevenue = all
        .filter(c => c.status === 'active')
        .reduce((sum, c) => sum + (planMap.get(c.planId) ?? c.monthlyRent ?? 0), 0);

      const totalRevenue = payments.reduce((s, p) => s + p.amount, 0);

      return { total: all.length, active, inactive, overdue, totalRevenue, monthlyRevenue };
    })());
  }
}
