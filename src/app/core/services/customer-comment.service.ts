import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { db } from '../db/database';
import { CustomerComment } from '../models/models';
import { BackupSyncService } from './backup-sync.service';

@Injectable({ providedIn: 'root' })
export class CustomerCommentService {
  constructor(private backupSyncSvc: BackupSyncService) {}

  getAll(): Observable<CustomerComment[]> {
    return from(db.customerComments.orderBy('createdAt').reverse().toArray());
  }

  getByCustomer(customerId: number): Observable<CustomerComment[]> {
    return from(
      db.customerComments.where('customerId').equals(customerId).reverse().sortBy('createdAt')
    );
  }

  getByComplaint(complaintId: number): Observable<CustomerComment[]> {
    return from(
      db.customerComments.where('complaintId').equals(complaintId).reverse().sortBy('createdAt')
    );
  }

  add(comment: Omit<CustomerComment, 'id' | 'createdAt'>): Observable<number> {
    return from(db.customerComments.add({ ...comment, createdAt: new Date() } as CustomerComment))
      .pipe(tap(() => void this.backupSyncSvc.triggerBackup('customer comment create')));
  }

  delete(id: number): Observable<void> {
    return from(db.customerComments.delete(id))
      .pipe(tap(() => void this.backupSyncSvc.triggerBackup('customer comment delete')));
  }
}
