import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { map, shareReplay, tap } from 'rxjs/operators';
import { db, dbCacheVersion } from '../db/database';
import { RentalPlan } from '../models/models';
import { BackupSyncService } from './backup-sync.service';

@Injectable({ providedIn: 'root' })
export class PlanService {
  private allCache$: Observable<RentalPlan[]> | null = null;
  private cachedVersion = -1;

  constructor(private backupSyncSvc: BackupSyncService) {}

  invalidateCache(): void {
    this.allCache$ = null;
  }

  getAll(): Observable<RentalPlan[]> {
    if (!this.allCache$ || this.cachedVersion !== dbCacheVersion) {
      this.cachedVersion = dbCacheVersion;
      this.allCache$ = from(db.rentalPlans.orderBy('monthlyRent').toArray()).pipe(
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }
    return this.allCache$.pipe(map(list => [...list]));
  }

  getById(id: number): Observable<RentalPlan | undefined> {
    return this.getAll().pipe(
      map(list => list.find(p => p.id === id))
    );
  }

  add(plan: Omit<RentalPlan, 'id' | 'createdAt'>): Observable<number> {
    return from(db.rentalPlans.add({ ...plan, createdAt: new Date() } as RentalPlan)).pipe(
      tap(() => {
        this.invalidateCache();
        void this.backupSyncSvc.triggerBackup('plan create');
      })
    );
  }

  update(id: number, changes: Partial<RentalPlan>): Observable<number> {
    return from(db.rentalPlans.update(id, changes)).pipe(
      tap(() => {
        this.invalidateCache();
        void this.backupSyncSvc.triggerBackup('plan update');
      })
    );
  }

  delete(id: number): Observable<void> {
    return from(db.rentalPlans.delete(id)).pipe(
      tap(() => this.invalidateCache())
    );
  }
}
