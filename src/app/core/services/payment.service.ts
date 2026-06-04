import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { db } from '../db/database';
import { PaymentRecord } from '../models/models';
import { BackupSyncService } from './backup-sync.service';

@Injectable({ providedIn: 'root' })
export class PaymentService {
  constructor(private backupSyncSvc: BackupSyncService) {}

  getAll(): Observable<PaymentRecord[]> {
    return from(db.payments.orderBy('paidDate').reverse().toArray());
  }

  getByCustomer(customerId: number): Observable<PaymentRecord[]> {
    return from(
      db.payments.where('customerId').equals(customerId).reverse().sortBy('paidDate')
    );
  }

  add(payment: Omit<PaymentRecord, 'id' | 'createdAt'>): Observable<number> {
    return from(db.payments.add({ ...payment, createdAt: new Date() } as PaymentRecord))
      .pipe(tap(() => void this.backupSyncSvc.triggerBackup('payment create')));
  }

  delete(id: number): Observable<void> {
    return from(db.payments.delete(id));
  }

  getTotalCollected(): Observable<number> {
    return from(
      db.payments.toArray().then(arr => arr.reduce((s, p) => s + p.amount, 0))
    );
  }
}
