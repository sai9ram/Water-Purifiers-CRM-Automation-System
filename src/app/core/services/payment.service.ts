import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PaymentRecord } from '../models/models';
import { RealtimeCrmService } from './realtime-crm.service';

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly crm = inject(RealtimeCrmService);

  invalidateCache(): void {
    this.crm.invalidateAndRefresh();
  }

  getAll(): Observable<PaymentRecord[]> {
    return this.crm.getCollection<PaymentRecord>('payments').pipe(
      map(list => [...list].sort((a, b) => new Date(b.paidDate).getTime() - new Date(a.paidDate).getTime()))
    );
  }

  getByCustomer(customerId: number): Observable<PaymentRecord[]> {
    return this.getAll().pipe(
      map(list => list.filter(p => Number(p.customerId) === Number(customerId)))
    );
  }

  add(payment: Omit<PaymentRecord, 'id' | 'createdAt'>): Observable<number> {
    return this.crm.createItem<PaymentRecord>('payments', payment);
  }

  update(id: number, changes: Partial<PaymentRecord>): Observable<number> {
    return this.crm.updateItem<PaymentRecord>('payments', id, changes);
  }

  delete(id: number): Observable<void> {
    return this.crm.deleteItem('payments', id);
  }

  getTotalCollected(): Observable<number> {
    return this.getAll().pipe(
      map(arr => arr.reduce((s, p) => s + Number(p.amount || 0), 0))
    );
  }
}
