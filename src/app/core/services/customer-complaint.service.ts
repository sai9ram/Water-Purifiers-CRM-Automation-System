import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CustomerComplaint } from '../models/models';
import { RealtimeCrmService } from './realtime-crm.service';

@Injectable({ providedIn: 'root' })
export class CustomerComplaintService {
  private readonly crm = inject(RealtimeCrmService);

  invalidateCache(): void {
    this.crm.invalidateAndRefresh();
  }

  getAll(): Observable<CustomerComplaint[]> {
    return this.crm.getCollection<CustomerComplaint>('customerComplaints').pipe(
      map(list => [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
    );
  }

  getByCustomer(customerId: number): Observable<CustomerComplaint[]> {
    return this.getAll().pipe(
      map(list => list.filter(c => Number(c.customerId) === Number(customerId)))
    );
  }

  add(complaint: Omit<CustomerComplaint, 'id' | 'createdAt'>): Observable<number> {
    return this.crm.createItem<CustomerComplaint>('customerComplaints', {
      ...complaint,
      resolved: false
    });
  }

  update(id: number, updates: Partial<CustomerComplaint>): Observable<number> {
    return this.crm.updateItem<CustomerComplaint>('customerComplaints', id, updates);
  }

  delete(id: number): Observable<void> {
    return this.crm.deleteItem('customerComplaints', id);
  }
}
