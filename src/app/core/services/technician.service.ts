import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { map, shareReplay, tap } from 'rxjs/operators';
import { db, dbCacheVersion } from '../db/database';
import { Technician } from '../models/models';
import { BackupSyncService } from './backup-sync.service';

@Injectable({ providedIn: 'root' })
export class TechnicianService {
  private allCache$: Observable<Technician[]> | null = null;
  private cachedVersion = -1;

  constructor(private backupSyncSvc: BackupSyncService) {}

  invalidateCache(): void {
    this.allCache$ = null;
  }

  getAll(): Observable<Technician[]> {
    if (!this.allCache$ || this.cachedVersion !== dbCacheVersion) {
      this.cachedVersion = dbCacheVersion;
      this.allCache$ = from(db.technicians.orderBy('name').toArray()).pipe(
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }
    return this.allCache$.pipe(map(list => [...list]));
  }

  getDefault(): Observable<Technician | undefined> {
    return this.getAll().pipe(
      map(list => list.find(t => Boolean(t.isDefault)))
    );
  }

  add(technician: Omit<Technician, 'id' | 'createdAt'>): Observable<number> {
    return from(db.transaction('rw', db.technicians, async () => {
      if (technician.isDefault) {
        await db.technicians.toCollection().modify({ isDefault: false });
      }
      return db.technicians.add({ ...technician, createdAt: new Date() } as Technician);
    })).pipe(
      tap(() => {
        this.invalidateCache();
        void this.backupSyncSvc.triggerBackup('technician create');
      })
    );
  }

  update(id: number, technician: Partial<Omit<Technician, 'id' | 'createdAt'>>): Observable<void> {
    return from(db.transaction('rw', db.technicians, async () => {
      if (technician.isDefault) {
        await db.technicians.toCollection().modify({ isDefault: false });
      }
      await db.technicians.update(id, technician);
    })).pipe(
      tap(() => {
        this.invalidateCache();
        void this.backupSyncSvc.triggerBackup('technician update');
      })
    );
  }

  delete(id: number): Observable<void> {
    return from(db.technicians.delete(id)).pipe(
      tap(() => {
        this.invalidateCache();
        void this.backupSyncSvc.triggerBackup('technician delete');
      })
    );
  }
}
