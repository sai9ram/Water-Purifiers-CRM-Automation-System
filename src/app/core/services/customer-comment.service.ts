import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CustomerComment } from '../models/models';
import { RealtimeCrmService } from './realtime-crm.service';

@Injectable({ providedIn: 'root' })
export class CustomerCommentService {
  private readonly crm = inject(RealtimeCrmService);

  getAll(): Observable<CustomerComment[]> {
    return this.crm.getCollection<CustomerComment>('customerComments').pipe(
      map(list => [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
    );
  }

  getByCustomer(customerId: number): Observable<CustomerComment[]> {
    return this.getAll().pipe(
      map(list => list.filter(c => Number(c.customerId) === Number(customerId)))
    );
  }

  getByComplaint(complaintId: number): Observable<CustomerComment[]> {
    return this.getAll().pipe(
      map(list => list.filter(c => Number(c.complaintId) === Number(complaintId)))
    );
  }

  add(comment: Omit<CustomerComment, 'id' | 'createdAt'>): Observable<number> {
    return this.crm.createItem<CustomerComment>('customerComments', comment);
  }

  delete(id: number): Observable<void> {
    return this.crm.deleteItem('customerComments', id);
  }
}
