import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { db } from '../db/database';
import { ServiceRecord } from '../models/models';
import { BackupSyncService } from './backup-sync.service';

@Injectable({ providedIn: 'root' })
export class ServiceRecordService {
  constructor(private backupSyncSvc: BackupSyncService) {}

  getAll(): Observable<ServiceRecord[]> {
    return from(db.serviceRecords.orderBy('serviceDate').reverse().toArray());
  }

  getByCustomer(customerId: number): Observable<ServiceRecord[]> {
    return from(
      db.serviceRecords.where('customerId').equals(customerId)
        .reverse().sortBy('serviceDate')
    );
  }

  getRecent(limit = 10): Observable<ServiceRecord[]> {
    return from(
      db.serviceRecords.orderBy('serviceDate').reverse().limit(limit).toArray()
    );
  }

  getUpcoming(): Observable<ServiceRecord[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return from(
      db.serviceRecords
        .where('nextServiceDate')
        .aboveOrEqual(today)
        .sortBy('nextServiceDate')
    );
  }

  add(record: Omit<ServiceRecord, 'id' | 'createdAt'>): Observable<number> {
    return from(db.serviceRecords.add({ ...record, createdAt: new Date() } as ServiceRecord))
      .pipe(tap(() => void this.backupSyncSvc.triggerBackup('service create')));
  }

  update(id: number, changes: Partial<ServiceRecord>): Observable<number> {
    return from(db.serviceRecords.update(id, changes))
      .pipe(tap(() => void this.backupSyncSvc.triggerBackup('service update')));
  }

  delete(id: number): Observable<void> {
    return from(db.serviceRecords.delete(id));
  }

  getStats(): Observable<{ total: number; thisMonth: number; upcoming: number }> {
    return from((async () => {
      const now   = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const all       = await db.serviceRecords.count();
      const thisMonth = await db.serviceRecords
        .where('serviceDate').between(start, end, true, true).count();

      const upcoming  = await db.serviceRecords
        .where('nextServiceDate').above(now).count();

      return { total: all, thisMonth, upcoming };
    })());
  }
}
