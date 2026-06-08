import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { db } from '../db/database';
import { CustomerComplaint } from '../models/models';
import { BackupSyncService } from './backup-sync.service';

@Injectable({ providedIn: 'root' })
export class CustomerComplaintService {
  constructor(private backupSyncSvc: BackupSyncService) {}

  getAll(): Observable<CustomerComplaint[]> {
    return from(db.customerComplaints.orderBy('createdAt').reverse().toArray());
  }

  getByCustomer(customerId: number): Observable<CustomerComplaint[]> {
    return from(
      db.customerComplaints.where('customerId').equals(customerId).reverse().sortBy('createdAt')
    );
  }

  add(complaint: Omit<CustomerComplaint, 'id' | 'createdAt'>): Observable<number> {
    return from(db.customerComplaints.add({ ...complaint, resolved: false, createdAt: new Date() } as CustomerComplaint))
      .pipe(tap(() => void this.backupSyncSvc.triggerBackup('customer complaint create')));
  }

  update(id: number, updates: Partial<CustomerComplaint>): Observable<number> {
    return from(db.customerComplaints.update(id, updates)).pipe(
      tap(() => void this.backupSyncSvc.triggerBackup('customer complaint update'))
    );
  }

  delete(id: number): Observable<void> {
    return from(db.customerComplaints.delete(id))
      .pipe(tap(() => void this.backupSyncSvc.triggerBackup('customer complaint delete')));
  }
}
