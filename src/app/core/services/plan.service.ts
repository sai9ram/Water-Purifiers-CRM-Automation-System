import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { db } from '../db/database';
import { RentalPlan } from '../models/models';

@Injectable({ providedIn: 'root' })
export class PlanService {

  getAll(): Observable<RentalPlan[]> {
    return from(db.rentalPlans.orderBy('monthlyRent').toArray());
  }

  getById(id: number): Observable<RentalPlan | undefined> {
    return from(db.rentalPlans.get(id));
  }

  add(plan: Omit<RentalPlan, 'id' | 'createdAt'>): Observable<number> {
    return from(db.rentalPlans.add({ ...plan, createdAt: new Date() } as RentalPlan));
  }

  update(id: number, changes: Partial<RentalPlan>): Observable<number> {
    return from(db.rentalPlans.update(id, changes));
  }

  delete(id: number): Observable<void> {
    return from(db.rentalPlans.delete(id));
  }
}
