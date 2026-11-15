import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { map, shareReplay, tap } from 'rxjs/operators';
import { db, dbCacheVersion } from '../db/database';
import { PaymentRecord } from '../models/models';
import { BackupSyncService } from './backup-sync.service';

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private allCache$: Observable<PaymentRecord[]> | null = null;
  private cachedVersion = -1;

  constructor(private backupSyncSvc: BackupSyncService) {}

  invalidateCache(): void {
    this.allCache$ = null;
  }

  getAll(): Observable<PaymentRecord[]> {
    if (!this.allCache$ || this.cachedVersion !== dbCacheVersion) {
      this.cachedVersion = dbCacheVersion;
      this.allCache$ = from(db.payments.orderBy('paidDate').reverse().toArray()).pipe(
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }
    return this.allCache$.pipe(map(list => [...list]));
  }

  getByCustomer(customerId: number): Observable<PaymentRecord[]> {
    return this.getAll().pipe(
      map(list => list.filter(p => p.customerId === customerId))
    );
  }

  add(payment: Omit<PaymentRecord, 'id' | 'createdAt'>): Observable<number> {
    return from(db.payments.add({ ...payment, createdAt: new Date() } as PaymentRecord)).pipe(
      tap(() => {
        this.invalidateCache();
        void this.backupSyncSvc.triggerBackup('payment create');
      })
    );
  }

  update(id: number, changes: Partial<PaymentRecord>): Observable<number> {
    return from(db.payments.update(id, changes)).pipe(
      tap(() => {
        this.invalidateCache();
        void this.backupSyncSvc.triggerBackup('payment update');
      })
    );
  }

  delete(id: number): Observable<void> {
    return from(db.payments.delete(id)).pipe(
      tap(() => this.invalidateCache())
    );
  }

  getTotalCollected(): Observable<number> {
    return this.getAll().pipe(
      map(arr => arr.reduce((s, p) => s + p.amount, 0))
    );
  }
}
