import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { map, shareReplay, tap } from 'rxjs/operators';
import { db, dbCacheVersion } from '../db/database';
import { CustomerComplaint } from '../models/models';
import { BackupSyncService } from './backup-sync.service';

@Injectable({ providedIn: 'root' })
export class CustomerComplaintService {
  private allCache$: Observable<CustomerComplaint[]> | null = null;
  private cachedVersion = -1;

  constructor(private backupSyncSvc: BackupSyncService) {}

  invalidateCache(): void {
    this.allCache$ = null;
  }

  getAll(): Observable<CustomerComplaint[]> {
    if (!this.allCache$ || this.cachedVersion !== dbCacheVersion) {
      this.cachedVersion = dbCacheVersion;
      this.allCache$ = from(db.customerComplaints.orderBy('createdAt').reverse().toArray()).pipe(
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }
    return this.allCache$.pipe(map(list => [...list]));
  }

  getByCustomer(customerId: number): Observable<CustomerComplaint[]> {
    return this.getAll().pipe(
      map(list => list.filter(c => c.customerId === customerId))
    );
  }

  add(complaint: Omit<CustomerComplaint, 'id' | 'createdAt'>): Observable<number> {
    return from(db.customerComplaints.add({ ...complaint, resolved: false, createdAt: new Date() } as CustomerComplaint)).pipe(
      tap(() => {
        this.invalidateCache();
        void this.backupSyncSvc.triggerBackup('customer complaint create');
      })
    );
  }

  update(id: number, updates: Partial<CustomerComplaint>): Observable<number> {
    return from(db.customerComplaints.update(id, updates)).pipe(
      tap(() => {
        this.invalidateCache();
        void this.backupSyncSvc.triggerBackup('customer complaint update');
      })
    );
  }

  delete(id: number): Observable<void> {
    return from(db.customerComplaints.delete(id)).pipe(
      tap(() => {
        this.invalidateCache();
        void this.backupSyncSvc.triggerBackup('customer complaint delete');
      })
    );
  }
}
