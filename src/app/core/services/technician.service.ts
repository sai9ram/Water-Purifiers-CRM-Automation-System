import { Injectable } from '@angular/core';
import { from, Observable, switchMap, tap } from 'rxjs';
import { db } from '../db/database';
import { Technician } from '../models/models';
import { BackupSyncService } from './backup-sync.service';

@Injectable({ providedIn: 'root' })
export class TechnicianService {
  constructor(private backupSyncSvc: BackupSyncService) {}

  getAll(): Observable<Technician[]> {
    return from(db.technicians.orderBy('name').toArray());
  }

  getDefault(): Observable<Technician | undefined> {
    return from(db.technicians.where('isDefault').equals(1).first());
  }

  add(technician: Omit<Technician, 'id' | 'createdAt'>): Observable<number> {
    return from(db.transaction('rw', db.technicians, async () => {
      if (technician.isDefault) {
        await db.technicians.where('isDefault').equals(1).modify({ isDefault: 0 });
      }
      return db.technicians.add({ ...technician, createdAt: new Date() } as Technician);
    })).pipe(tap(() => void this.backupSyncSvc.triggerBackup('technician create')));
  }

  update(id: number, technician: Partial<Omit<Technician, 'id' | 'createdAt'>>): Observable<void> {
    return from(db.transaction('rw', db.technicians, async () => {
      if (technician.isDefault) {
        await db.technicians.where('isDefault').equals(1).modify({ isDefault: 0 });
      }
      await db.technicians.update(id, technician);
    })).pipe(tap(() => void this.backupSyncSvc.triggerBackup('technician update')));
  }

  delete(id: number): Observable<void> {
    return from(db.technicians.delete(id)).pipe(tap(() => void this.backupSyncSvc.triggerBackup('technician delete')));
  }
}
