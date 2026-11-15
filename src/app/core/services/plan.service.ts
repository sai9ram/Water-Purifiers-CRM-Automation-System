import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RentalPlan } from '../models/models';
import { RealtimeCrmService } from './realtime-crm.service';

@Injectable({ providedIn: 'root' })
export class PlanService {
  private readonly crm = inject(RealtimeCrmService);

  invalidateCache(): void {
    this.crm.invalidateAndRefresh();
  }

  getAll(): Observable<RentalPlan[]> {
    return this.crm.getCollection<RentalPlan>('rentalPlans').pipe(
      map(list => [...list].sort((a, b) => Number(a.monthlyRent) - Number(b.monthlyRent)))
    );
  }

  getById(id: number): Observable<RentalPlan | undefined> {
    return this.getAll().pipe(
      map(list => list.find(p => Number(p.id) === Number(id)))
    );
  }

  add(plan: Omit<RentalPlan, 'id' | 'createdAt'>): Observable<number> {
    return this.crm.createItem<RentalPlan>('rentalPlans', plan);
  }

  update(id: number, changes: Partial<RentalPlan>): Observable<number> {
    return this.crm.updateItem<RentalPlan>('rentalPlans', id, changes);
  }

  delete(id: number): Observable<void> {
    return this.crm.deleteItem('rentalPlans', id);
  }
}
