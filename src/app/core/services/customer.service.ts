import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { db } from '../db/database';
import { Customer, CustomerStatus } from '../models/models';

@Injectable({ providedIn: 'root' })
export class CustomerService {

  getAll(): Observable<Customer[]> {
    return from(db.customers.orderBy('name').toArray());
  }

  getById(id: number): Observable<Customer | undefined> {
    return from(db.customers.get(id));
  }

  getByStatus(status: CustomerStatus): Observable<Customer[]> {
    return from(db.customers.where('status').equals(status).toArray());
  }

  getDueThisMonth(): Observable<Customer[]> {
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return from(
      db.customers
        .where('nextDueDate')
        .between(start, end, true, true)
        .and(c => c.status === 'active' || c.status === 'overdue')
        .toArray()
    );
  }

  getOverdue(): Observable<Customer[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return from(
      db.customers
        .where('nextDueDate')
        .below(today)
        .and(c => c.status !== 'inactive')
        .toArray()
    );
  }

  add(customer: Omit<Customer, 'id' | 'createdAt'>): Observable<number> {
    return from(db.customers.add({ ...customer, createdAt: new Date() } as Customer));
  }

  update(id: number, changes: Partial<Customer>): Observable<number> {
    return from(db.customers.update(id, changes));
  }

  delete(id: number): Observable<void> {
    return from(db.customers.delete(id));
  }

  search(query: string): Observable<Customer[]> {
    const q = query.toLowerCase();
    return from(
      db.customers.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.area.toLowerCase().includes(q) ||
        c.purifierModel.toLowerCase().includes(q)
      ).toArray()
    );
  }

  getStats(): Observable<{
    total: number; active: number; inactive: number; overdue: number;
    totalRevenue: number; monthlyRevenue: number;
  }> {
    return from((async () => {
      const all       = await db.customers.toArray();
      const active    = all.filter(c => c.status === 'active').length;
      const inactive  = all.filter(c => c.status === 'inactive').length;
      const overdue   = all.filter(c => c.status === 'overdue').length;

      const plans     = await db.rentalPlans.toArray();
      const planMap   = new Map(plans.map(p => [p.id!, p.monthlyRent]));

      const monthlyRevenue = all
        .filter(c => c.status === 'active')
        .reduce((sum, c) => sum + (planMap.get(c.planId) ?? c.monthlyRent ?? 0), 0);

      const payments  = await db.payments.toArray();
      const totalRevenue = payments.reduce((s, p) => s + p.amount, 0);

      return { total: all.length, active, inactive, overdue, totalRevenue, monthlyRevenue };
    })());
  }
}
