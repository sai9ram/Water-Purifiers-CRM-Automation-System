import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { db } from '../db/database';
import { PaymentRecord } from '../models/models';

@Injectable({ providedIn: 'root' })
export class PaymentService {

  getByCustomer(customerId: number): Observable<PaymentRecord[]> {
    return from(
      db.payments.where('customerId').equals(customerId).reverse().sortBy('paidDate')
    );
  }

  add(payment: Omit<PaymentRecord, 'id' | 'createdAt'>): Observable<number> {
    return from(db.payments.add({ ...payment, createdAt: new Date() } as PaymentRecord));
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
