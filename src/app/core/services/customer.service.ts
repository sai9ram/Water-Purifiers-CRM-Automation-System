import { Injectable, inject } from '@angular/core';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { Customer, CustomerStatus, PaymentRecord, RentalPlan } from '../models/models';
import { RealtimeCrmService } from './realtime-crm.service';

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly crm = inject(RealtimeCrmService);

  invalidateCache(): void {
    this.crm.invalidateAndRefresh();
  }

  getAll(): Observable<Customer[]> {
    return this.crm.getCollection<Customer>('customers').pipe(
      map(list => [...list].sort((a, b) => (a.name || '').localeCompare(b.name || '')))
    );
  }

  getById(id: number): Observable<Customer | undefined> {
    return this.getAll().pipe(map(list => list.find(c => Number(c.id) === Number(id))));
  }

  getByStatus(status: CustomerStatus): Observable<Customer[]> {
    return this.getAll().pipe(map(list => list.filter(c => c.status === status)));
  }

  getDueThisMonth(): Observable<Customer[]> {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    return this.getAll().pipe(
      map(list =>
        list.filter(c => {
          const due = new Date(c.nextDueDate);
          return due >= start && due <= end && (c.status === 'active' || c.status === 'overdue');
        })
      )
    );
  }

  getOverdue(): Observable<Customer[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.getAll().pipe(
      map(list => list.filter(c => new Date(c.nextDueDate) < today && c.status !== 'inactive'))
    );
  }

  add(customer: Omit<Customer, 'id' | 'createdAt'>): Observable<number> {
    return this.crm.createItem<Customer>('customers', customer);
  }

  update(id: number, changes: Partial<Customer>): Observable<number> {
    return this.crm.updateItem<Customer>('customers', id, changes);
  }

  delete(id: number): Observable<void> {
    return this.crm.deleteItem('customers', id);
  }

  search(query: string): Observable<Customer[]> {
    const q = query.toLowerCase();
    return this.getAll().pipe(
      map(list =>
        list.filter(
          c =>
            c.name.toLowerCase().includes(q) ||
            c.phone.includes(q) ||
            c.area.toLowerCase().includes(q) ||
            c.purifierModel.toLowerCase().includes(q) ||
            (c.uniquePaymentId || '').toLowerCase().includes(q)
        )
      )
    );
  }

  getStats(): Observable<{
    total: number;
    active: number;
    inactive: number;
    overdue: number;
    totalRevenue: number;
    monthlyRevenue: number;
  }> {
    return combineLatest([
      this.getAll(),
      this.crm.getCollection<RentalPlan>('rentalPlans'),
      this.crm.getCollection<PaymentRecord>('payments')
    ]).pipe(
      map(([all, plans, payments]) => {
        const active = all.filter(c => c.status === 'active').length;
        const inactive = all.filter(c => c.status === 'inactive').length;
        const overdue = all.filter(c => c.status === 'overdue').length;

        const planMap = new Map(plans.map(p => [Number(p.id), p.monthlyRent]));
        const monthlyRevenue = all
          .filter(c => c.status === 'active' || c.status === 'overdue')
          .reduce((sum, c) => sum + (planMap.get(Number(c.planId)) ?? c.monthlyRent ?? 0), 0);

        const totalRevenue = payments.reduce((s, p) => s + Number(p.amount || 0), 0);

        return { total: all.length, active, inactive, overdue, totalRevenue, monthlyRevenue };
      })
    );
  }
}
