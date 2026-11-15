import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { map, shareReplay, tap } from 'rxjs/operators';
import { db, dbCacheVersion } from '../db/database';
import { ServiceRecord } from '../models/models';
import { BackupSyncService } from './backup-sync.service';

@Injectable({ providedIn: 'root' })
export class ServiceRecordService {
  private allCache$: Observable<ServiceRecord[]> | null = null;
  private cachedVersion = -1;

  constructor(private backupSyncSvc: BackupSyncService) {}

  invalidateCache(): void {
    this.allCache$ = null;
  }

  getAll(): Observable<ServiceRecord[]> {
    if (!this.allCache$ || this.cachedVersion !== dbCacheVersion) {
      this.cachedVersion = dbCacheVersion;
      this.allCache$ = from(db.serviceRecords.orderBy('serviceDate').reverse().toArray()).pipe(
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }
    return this.allCache$.pipe(map(list => [...list]));
  }

  getByCustomer(customerId: number): Observable<ServiceRecord[]> {
    return this.getAll().pipe(
      map(list => list.filter(s => s.customerId === customerId))
    );
  }

  getRecent(limit = 10): Observable<ServiceRecord[]> {
    return this.getAll().pipe(
      map(list => list.slice(0, limit))
    );
  }

  getUpcoming(): Observable<ServiceRecord[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.getAll().pipe(
      map(list =>
        list
          .filter(s => s.nextServiceDate && new Date(s.nextServiceDate) >= today)
          .sort((a, b) => new Date(a.nextServiceDate!).getTime() - new Date(b.nextServiceDate!).getTime())
      )
    );
  }

  add(record: Omit<ServiceRecord, 'id' | 'createdAt'>): Observable<number> {
    return from(db.serviceRecords.add({ ...record, createdAt: new Date() } as ServiceRecord)).pipe(
      tap(() => {
        this.invalidateCache();
        void this.backupSyncSvc.triggerBackup('service create');
      })
    );
  }

  update(id: number, changes: Partial<ServiceRecord>): Observable<number> {
    return from(db.serviceRecords.update(id, changes)).pipe(
      tap(() => {
        this.invalidateCache();
        void this.backupSyncSvc.triggerBackup('service update');
      })
    );
  }

  delete(id: number): Observable<void> {
    return from(db.serviceRecords.delete(id)).pipe(
      tap(() => this.invalidateCache())
    );
  }

  getStats(): Observable<{ total: number; thisMonth: number; upcoming: number }> {
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    return this.getAll().pipe(
      map(list => {
        let thisMonth = 0;
        let upcoming = 0;
        for (const r of list) {
          const sd = new Date(r.serviceDate);
          if (sd >= start && sd <= end) thisMonth++;
          if (r.nextServiceDate && new Date(r.nextServiceDate) > now) upcoming++;
        }
        return { total: list.length, thisMonth, upcoming };
      })
    );
  }
}
