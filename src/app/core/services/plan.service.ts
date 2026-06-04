import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { db } from '../db/database';
import { RentalPlan } from '../models/models';
import { BackupSyncService } from './backup-sync.service';

@Injectable({ providedIn: 'root' })
export class PlanService {
  constructor(private backupSyncSvc: BackupSyncService) {}

  getAll(): Observable<RentalPlan[]> {
    return from(db.rentalPlans.orderBy('monthlyRent').toArray());
  }

  getById(id: number): Observable<RentalPlan | undefined> {
    return from(db.rentalPlans.get(id));
  }

  add(plan: Omit<RentalPlan, 'id' | 'createdAt'>): Observable<number> {
    return from(db.rentalPlans.add({ ...plan, createdAt: new Date() } as RentalPlan))
      .pipe(tap(() => void this.backupSyncSvc.triggerBackup('plan create')));
  }

  update(id: number, changes: Partial<RentalPlan>): Observable<number> {
    return from(db.rentalPlans.update(id, changes))
      .pipe(tap(() => void this.backupSyncSvc.triggerBackup('plan update')));
  }

  delete(id: number): Observable<void> {
    return from(db.rentalPlans.delete(id));
  }
}
