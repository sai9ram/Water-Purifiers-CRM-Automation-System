import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Technician } from '../models/models';
import { RealtimeCrmService } from './realtime-crm.service';

@Injectable({ providedIn: 'root' })
export class TechnicianService {
  private readonly crm = inject(RealtimeCrmService);

  invalidateCache(): void {
    this.crm.invalidateAndRefresh();
  }

  getAll(): Observable<Technician[]> {
    return this.crm.getCollection<Technician>('technicians').pipe(
      map(list => [...list].sort((a, b) => (a.name || '').localeCompare(b.name || '')))
    );
  }

  getDefault(): Observable<Technician | undefined> {
    return this.getAll().pipe(
      map(list => list.find(t => Boolean(t.isDefault)) ?? list[0])
    );
  }

  add(technician: Omit<Technician, 'id' | 'createdAt'>): Observable<number> {
    return this.crm.createItem<Technician>('technicians', technician);
  }

  update(id: number, technician: Partial<Omit<Technician, 'id' | 'createdAt'>>): Observable<void> {
    return this.crm.updateItem<Technician>('technicians', id, technician).pipe(map(() => undefined));
  }

  delete(id: number): Observable<void> {
    return this.crm.deleteItem('technicians', id);
  }
}
