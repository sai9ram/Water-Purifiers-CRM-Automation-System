import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ServiceRecord } from '../models/models';
import { RealtimeCrmService } from './realtime-crm.service';

@Injectable({ providedIn: 'root' })
export class ServiceRecordService {
  private readonly crm = inject(RealtimeCrmService);

  invalidateCache(): void {
    this.crm.invalidateAndRefresh();
  }

  getAll(): Observable<ServiceRecord[]> {
    return this.crm.getCollection<ServiceRecord>('serviceRecords').pipe(
      map(list => [...list].sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime()))
    );
  }

  getByCustomer(customerId: number): Observable<ServiceRecord[]> {
    return this.getAll().pipe(
      map(list => list.filter(s => Number(s.customerId) === Number(customerId)))
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
    return this.crm.createItem<ServiceRecord>('serviceRecords', record);
  }

  update(id: number, changes: Partial<ServiceRecord>): Observable<number> {
    return this.crm.updateItem<ServiceRecord>('serviceRecords', id, changes);
  }

  delete(id: number): Observable<void> {
    return this.crm.deleteItem('serviceRecords', id);
  }

  getStats(): Observable<{ total: number; thisMonth: number; upcoming: number }> {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

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
