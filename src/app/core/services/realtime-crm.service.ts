import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, from, of } from 'rxjs';
import { catchError, map, shareReplay, switchMap, take, tap } from 'rxjs/operators';
import {
  Customer,
  CustomerComment,
  CustomerComplaint,
  PaymentLinkRecord,
  PaymentRecord,
  RentalPlan,
  ServiceRecord,
  Technician,
  WhatsAppAutomationLog
} from '../models/models';
import { db } from '../db/database';

export interface CrmRealtimeState {
  version: number;
  updatedAt: string;
  automation: {
    enabled: boolean;
    preDueDays: number;
    overdueEscalationDays: number;
    autoSendPaymentReceipt: boolean;
    autoReplyComplaints: boolean;
    lastRunAt: string | null;
    lastSummary?: {
      triggered: number;
      evaluated: number;
      ranAt: string;
    };
  };
  data: {
    customers: Customer[];
    rentalPlans: RentalPlan[];
    payments: PaymentRecord[];
    serviceRecords: ServiceRecord[];
    technicians: Technician[];
    customerComplaints: CustomerComplaint[];
    customerComments: CustomerComment[];
    paymentLinks: PaymentLinkRecord[];
    whatsappLogs: WhatsAppAutomationLog[];
  };
}

export type CrmCollectionKey =
  | 'customers'
  | 'rentalPlans'
  | 'payments'
  | 'serviceRecords'
  | 'technicians'
  | 'customerComplaints'
  | 'customerComments';

@Injectable({ providedIn: 'root' })
export class RealtimeCrmService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = '/api/v1/crm';

  private currentVersion = 0;
  private stateCache: CrmRealtimeState['data'] | null = null;
  private inflightState$: Observable<CrmRealtimeState['data']> | null = null;
  private legacySynced = false;

  readonly changes$ = new Subject<number>();
  readonly whatsappLogs$ = new BehaviorSubject<WhatsAppAutomationLog[]>([]);
  readonly paymentLinks$ = new BehaviorSubject<PaymentLinkRecord[]>([]);
  readonly openComplaintsCount = signal<number>(0);
  readonly newWhatsAppComplaintsCount = signal<number>(0);
  readonly automationSummary = signal<{
    enabled: boolean;
    preDueDays: number;
    lastRunAt: string | null;
    triggeredCount: number;
  }>({
    enabled: true,
    preDueDays: 5,
    lastRunAt: null,
    triggeredCount: 0
  });

  constructor() {
    this.initRealtimeSync();
  }

  private initRealtimeSync(): void {
    if (typeof window === 'undefined') return;

    // One-time non-destructive upload of any pre-existing IndexedDB records into the Cloud API
    void this.migrateLegacyIndexedDbIfPresent();

    // Poll every 4 seconds for real-time webhook events (customer online payments & incoming WhatsApp complaints)
    setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      this.pollServerState();
    }, 4000);
  }

  private async migrateLegacyIndexedDbIfPresent(): Promise<void> {
    if (this.legacySynced) return;
    this.legacySynced = true;
    try {
      const existingCustomers = await db.customers.toArray();
      if (existingCustomers.length > 0) {
        const [rentalPlans, payments, serviceRecords, technicians, customerComplaints, customerComments] =
          await Promise.all([
            db.rentalPlans.toArray(),
            db.payments.toArray(),
            db.serviceRecords.toArray(),
            db.technicians.toArray(),
            db.customerComplaints.toArray(),
            db.customerComments.toArray()
          ]);

        this.http
          .post(`${this.apiBase}/sync/import`, {
            mode: 'merge',
            customers: existingCustomers,
            rentalPlans,
            payments,
            serviceRecords,
            technicians,
            customerComplaints,
            customerComments
          })
          .pipe(catchError(() => of(null)))
          .subscribe(res => {
            if (res) {
              this.invalidateAndRefresh();
            }
          });
      }
    } catch {
      // Ignore if IndexedDB is unavailable
    }
  }

  private pollServerState(): void {
    this.http
      .get<{ success: boolean } & CrmRealtimeState>(`${this.apiBase}/state`)
      .pipe(catchError(() => of(null)))
      .subscribe(res => {
        if (!res || !res.success || !res.data) return;
        const prevVersion = this.currentVersion;
        this.applyServerResponse(res);
        if (prevVersion !== 0 && res.version !== prevVersion) {
          this.changes$.next(res.version);
        }
      });
  }

  private applyServerResponse(res: CrmRealtimeState): void {
    this.currentVersion = res.version || this.currentVersion + 1;
    this.stateCache = res.data;

    this.whatsappLogs$.next(res.data.whatsappLogs || []);
    this.paymentLinks$.next(res.data.paymentLinks || []);

    const complaints = res.data.customerComplaints || [];
    this.openComplaintsCount.set(complaints.filter(c => !c.resolved).length);
    this.newWhatsAppComplaintsCount.set(
      complaints.filter(c => !c.resolved && c.admissionStatus !== 'ADMITTED').length
    );

    if (res.automation) {
      this.automationSummary.set({
        enabled: res.automation.enabled ?? true,
        preDueDays: res.automation.preDueDays ?? 5,
        lastRunAt: res.automation.lastRunAt,
        triggeredCount: (res.data.whatsappLogs || []).filter(l => l.direction === 'OUTBOUND').length
      });
    }
  }

  invalidateAndRefresh(): void {
    this.stateCache = null;
    this.inflightState$ = null;
    this.fetchState(true).subscribe(() => {
      this.changes$.next(this.currentVersion);
    });
  }

  fetchState(force = false): Observable<CrmRealtimeState['data']> {
    if (!force && this.stateCache) {
      return of(this.stateCache);
    }
    if (!force && this.inflightState$) {
      return this.inflightState$;
    }

    this.inflightState$ = this.http.get<{ success: boolean } & CrmRealtimeState>(`${this.apiBase}/state`).pipe(
      tap(res => {
        if (res && res.data) {
          this.applyServerResponse(res);
        }
        this.inflightState$ = null;
      }),
      map(res => res.data),
      shareReplay({ bufferSize: 1, refCount: true }),
      catchError(err => {
        this.inflightState$ = null;
        if (this.stateCache) {
          return of(this.stateCache);
        }
        throw err;
      })
    );

    return this.inflightState$;
  }

  getCollection<T>(key: CrmCollectionKey): Observable<T[]> {
    return this.fetchState().pipe(
      take(1),
      map(state => ([...(state[key] as unknown as T[])]))
    );
  }

  createItem<T>(key: CrmCollectionKey, payload: Partial<T>): Observable<number> {
    return this.http
      .post<{ success: boolean; data: T & { id: number }; id: number }>(`${this.apiBase}/${key}`, payload)
      .pipe(
        switchMap(res =>
          this.fetchState(true).pipe(
            take(1),
            tap(() => this.changes$.next(this.currentVersion)),
            map(() => res.id ?? res.data?.id ?? 1)
          )
        )
      );
  }

  updateItem<T>(key: CrmCollectionKey, id: number, changes: Partial<T>): Observable<number> {
    return this.http
      .patch<{ success: boolean; data: T }>(`${this.apiBase}/${key}/${id}`, changes)
      .pipe(
        switchMap(() =>
          this.fetchState(true).pipe(
            take(1),
            tap(() => this.changes$.next(this.currentVersion)),
            map(() => 1)
          )
        )
      );
  }

  deleteItem(key: CrmCollectionKey, id: number): Observable<void> {
    return this.http.delete<{ success: boolean }>(`${this.apiBase}/${key}/${id}`).pipe(
      switchMap(() =>
        this.fetchState(true).pipe(
          take(1),
          tap(() => this.changes$.next(this.currentVersion)),
          map(() => undefined)
        )
      )
    );
  }

  runAutomationNow(): Observable<{
    success: boolean;
    message: string;
    data: { triggered: number; evaluated: number; ranAt: string };
  }> {
    return this.http
      .post<{
        success: boolean;
        message: string;
        data: { triggered: number; evaluated: number; ranAt: string };
      }>(`${this.apiBase}/automation/run`, {})
      .pipe(
        tap(() => {
          this.invalidateAndRefresh();
        })
      );
  }

  getPaymentLinkDetails(paymentId: string): Observable<{
    paymentLink: PaymentLinkRecord;
    customer: Customer;
  }> {
    return this.http
      .get<{
        success: boolean;
        data: { paymentLink: PaymentLinkRecord; customer: Customer };
      }>(`${this.apiBase}/payment-links/${encodeURIComponent(paymentId)}`)
      .pipe(map(res => res.data));
  }

  completePaymentByLink(
    paymentId: string,
    payload: { paymentMethod?: string; transactionRef?: string }
  ): Observable<{
    alreadyPaid: boolean;
    payment: PaymentRecord;
    paymentLink: PaymentLinkRecord;
    nextPaymentLink: PaymentLinkRecord;
    customer: Customer;
    whatsappReceipt: WhatsAppAutomationLog;
  }> {
    return this.http
      .post<{
        success: boolean;
        data: {
          alreadyPaid: boolean;
          payment: PaymentRecord;
          paymentLink: PaymentLinkRecord;
          nextPaymentLink: PaymentLinkRecord;
          customer: Customer;
          whatsappReceipt: WhatsAppAutomationLog;
        };
      }>(`${this.apiBase}/payment-links/${encodeURIComponent(paymentId)}/pay`, payload)
      .pipe(
        tap(() => {
          this.invalidateAndRefresh();
        }),
        map(res => res.data)
      );
  }

  sendIncomingWhatsAppComplaint(payload: {
    customerId?: number;
    phone?: string;
    customerName?: string;
    message: string;
  }): Observable<{
    complaint: CustomerComplaint;
    customer: Customer;
    ticketId: string;
    autoReply: string;
  }> {
    return this.http
      .post<{
        success: boolean;
        data: {
          complaint: CustomerComplaint;
          customer: Customer;
          ticketId: string;
          autoReply: string;
        };
      }>(`${this.apiBase}/webhooks/whatsapp`, payload)
      .pipe(
        tap(() => {
          this.invalidateAndRefresh();
        }),
        map(res => res.data)
      );
  }

  admitComplaintAndScheduleFix(
    complaintId: number,
    technicianName?: string
  ): Observable<{
    complaint: CustomerComplaint;
    serviceRecord: ServiceRecord;
    whatsappNotification: WhatsAppAutomationLog;
  }> {
    return this.http
      .post<{
        success: boolean;
        data: {
          complaint: CustomerComplaint;
          serviceRecord: ServiceRecord;
          whatsappNotification: WhatsAppAutomationLog;
        };
      }>(`${this.apiBase}/complaints/${complaintId}/admit`, { technicianName })
      .pipe(
        tap(() => {
          this.invalidateAndRefresh();
        }),
        map(res => res.data)
      );
  }

  replaceCloudDatabase(snapshot: Record<string, unknown[]>): Observable<void> {
    return this.http
      .post<{ success: boolean }>(`${this.apiBase}/sync/import`, {
        mode: 'replace',
        ...snapshot
      })
      .pipe(
        switchMap(() =>
          this.fetchState(true).pipe(
            take(1),
            tap(() => this.changes$.next(this.currentVersion)),
            map(() => undefined)
          )
        )
      );
  }
}
