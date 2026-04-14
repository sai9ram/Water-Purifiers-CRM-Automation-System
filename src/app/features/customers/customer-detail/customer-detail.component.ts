import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { CustomerService } from '../../../core/services/customer.service';
import { ServiceRecordService } from '../../../core/services/service-record.service';
import { PaymentService } from '../../../core/services/payment.service';
import { PlanService } from '../../../core/services/plan.service';
import { WhatsappService } from '../../../core/services/whatsapp.service';
import { Customer, ServiceRecord, PaymentRecord, RentalPlan, SERVICE_TYPE_LABELS, ServiceType } from '../../../core/models/models';
import { CustomerFormDialogComponent } from '../customer-form-dialog/customer-form-dialog.component';

@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [
    CommonModule, RouterLink, FormsModule, ReactiveFormsModule,
    MatIconModule, MatButtonModule, MatCardModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatDatepickerModule, MatNativeDateModule, MatSnackBarModule, MatTabsModule
  ],
  template: `
    <div class="page-container fade-in" *ngIf="customer">
      <!-- Back + Actions -->
      <div class="page-header">
        <div class="header-left">
          <a routerLink="/customers" mat-icon-button>
            <mat-icon>arrow_back</mat-icon>
          </a>
          <div>
            <h2>{{ customer.name }}</h2>
            <p class="subtitle">{{ customer.area }} · {{ customer.phone }}</p>
          </div>
        </div>
        <div class="header-actions">
          <button mat-stroked-button (click)="sendReminder()">
            <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" width="16" alt="WA" style="margin-right:6px"/>
            Send Reminder
          </button>
          <button mat-raised-button color="primary" (click)="editCustomer()">
            <mat-icon>edit</mat-icon> Edit
          </button>
        </div>
      </div>

      <!-- Info Cards -->
      <div class="info-grid">
        <div class="info-card">
          <div class="info-icon" style="background:#e0f7fa">
            <mat-icon style="color:#0097a7">water_drop</mat-icon>
          </div>
          <div>
            <div class="info-label">Purifier Model</div>
            <div class="info-value">{{ customer.purifierModel }}</div>
          </div>
        </div>
        <div class="info-card">
          <div class="info-icon" style="background:#e8f5e9">
            <mat-icon style="color:#2e7d32">card_membership</mat-icon>
          </div>
          <div>
            <div class="info-label">Rental Plan</div>
            <div class="info-value">{{ customer.planName }} · ₹{{ customer.monthlyRent }}/mo</div>
          </div>
        </div>
        <div class="info-card">
          <div class="info-icon" style="background:#fff8e1">
            <mat-icon style="color:#f57f17">calendar_today</mat-icon>
          </div>
          <div>
            <div class="info-label">Next Due Date</div>
            <div class="info-value" [class.overdue-text]="isOverdue()">
              {{ customer.nextDueDate | date:'dd MMM yyyy' }}
              <span *ngIf="isOverdue()" class="chip chip-danger" style="margin-left:8px">Overdue</span>
            </div>
          </div>
        </div>
        <div class="info-card">
          <div class="info-icon" style="background:#fce4ec">
            <mat-icon style="color:#c62828">currency_rupee</mat-icon>
          </div>
          <div>
            <div class="info-label">Deposit Paid</div>
            <div class="info-value">₹{{ customer.depositPaid }}</div>
          </div>
        </div>
        <div class="info-card">
          <div class="info-icon" style="background:#f3e5f5">
            <mat-icon style="color:#6a1b9a">home</mat-icon>
          </div>
          <div>
            <div class="info-label">Address</div>
            <div class="info-value small">{{ customer.address }}</div>
          </div>
        </div>
        <div class="info-card">
          <div class="info-icon" style="background:#e8eaf6">
            <mat-icon style="color:#283593">event_available</mat-icon>
          </div>
          <div>
            <div class="info-label">Member Since</div>
            <div class="info-value">{{ customer.joinDate | date:'dd MMM yyyy' }}</div>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <mat-tab-group class="detail-tabs">

        <!-- Services Tab -->
        <mat-tab label="Service History">
          <div class="tab-content">
            <div class="tab-toolbar">
              <h4>{{ serviceRecords.length }} Service Records</h4>
              <button mat-raised-button color="primary" (click)="showAddService=true" *ngIf="!showAddService">
                <mat-icon>add</mat-icon> Log Service
              </button>
            </div>

            <!-- Add Service Form -->
            <div class="inline-form" *ngIf="showAddService">
              <h4 style="margin-bottom:16px">Log New Service</h4>
              <form [formGroup]="serviceForm">
                <div class="form-row-2">
                  <mat-form-field appearance="outline">
                    <mat-label>Service Type</mat-label>
                    <mat-select formControlName="serviceType">
                      <mat-option value="filter-change">Filter Change</mat-option>
                      <mat-option value="repair">Repair</mat-option>
                      <mat-option value="installation">Installation</mat-option>
                      <mat-option value="general-service">General Service</mat-option>
                      <mat-option value="demo">Demo</mat-option>
                    </mat-select>
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Service Date</mat-label>
                    <input matInput [matDatepicker]="sp" formControlName="serviceDate" />
                    <mat-datepicker-toggle matSuffix [for]="sp"></mat-datepicker-toggle>
                    <mat-datepicker #sp></mat-datepicker>
                  </mat-form-field>
                </div>
                <div class="form-row-2">
                  <mat-form-field appearance="outline">
                    <mat-label>Technician Name</mat-label>
                    <input matInput formControlName="technicianName" />
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Cost (₹)</mat-label>
                    <input matInput formControlName="cost" type="number" />
                  </mat-form-field>
                </div>
                <mat-form-field appearance="outline">
                  <mat-label>Parts Replaced</mat-label>
                  <input matInput formControlName="partsReplaced" placeholder="e.g. Sediment filter, Carbon filter" />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Notes</mat-label>
                  <textarea matInput formControlName="notes" rows="2"></textarea>
                </mat-form-field>
                <div class="form-actions">
                  <button mat-stroked-button type="button" (click)="showAddService=false">Cancel</button>
                  <button mat-raised-button color="primary" (click)="addService()" [disabled]="serviceForm.invalid">
                    <mat-icon>save</mat-icon> Save Service
                  </button>
                </div>
              </form>
            </div>

            <!-- Service List -->
            <div class="service-timeline" *ngIf="serviceRecords.length > 0">
              <div class="timeline-item" *ngFor="let s of serviceRecords">
                <div class="timeline-dot" [style.background]="getServiceColor(s.serviceType)">
                  <mat-icon>{{ getServiceIcon(s.serviceType) }}</mat-icon>
                </div>
                <div class="timeline-body">
                  <div class="timeline-header">
                    <strong>{{ getServiceLabel(s.serviceType) }}</strong>
                    <span class="timeline-date">{{ s.serviceDate | date:'dd MMM yyyy' }}</span>
                  </div>
                  <div class="timeline-meta">
                    <span><mat-icon>person</mat-icon>{{ s.technicianName }}</span>
                    <span *ngIf="s.cost"><mat-icon>currency_rupee</mat-icon>{{ s.cost }}</span>
                    <span *ngIf="s.partsReplaced"><mat-icon>settings</mat-icon>{{ s.partsReplaced }}</span>
                  </div>
                  <p *ngIf="s.notes" class="timeline-notes">{{ s.notes }}</p>
                </div>
                <button mat-icon-button color="warn" (click)="deleteService(s)" style="flex-shrink:0">
                  <mat-icon style="font-size:16px">delete</mat-icon>
                </button>
              </div>
            </div>

            <div class="empty-state" *ngIf="serviceRecords.length === 0 && !showAddService">
              <mat-icon>build_circle</mat-icon>
              <h4>No service records yet</h4>
              <p>Log the first service for this customer.</p>
            </div>
          </div>
        </mat-tab>

        <!-- Payments Tab -->
        <mat-tab label="Payment History">
          <div class="tab-content">
            <div class="tab-toolbar">
              <h4>{{ payments.length }} Payments · Total ₹{{ totalPaid }}</h4>
              <button mat-raised-button color="primary" (click)="showAddPayment=true" *ngIf="!showAddPayment">
                <mat-icon>add</mat-icon> Record Payment
              </button>
            </div>

            <!-- Add Payment Form -->
            <div class="inline-form" *ngIf="showAddPayment">
              <h4 style="margin-bottom:16px">Record Payment</h4>
              <form [formGroup]="paymentForm">
                <div class="form-row-2">
                  <mat-form-field appearance="outline">
                    <mat-label>Amount (₹)</mat-label>
                    <mat-icon matPrefix>currency_rupee</mat-icon>
                    <input matInput formControlName="amount" type="number" />
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Payment Date</mat-label>
                    <input matInput [matDatepicker]="pp" formControlName="paidDate" />
                    <mat-datepicker-toggle matSuffix [for]="pp"></mat-datepicker-toggle>
                    <mat-datepicker #pp></mat-datepicker>
                  </mat-form-field>
                </div>
                <mat-form-field appearance="outline">
                  <mat-label>For Month</mat-label>
                  <input matInput formControlName="forMonth" placeholder="e.g. April 2025" />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Notes</mat-label>
                  <input matInput formControlName="notes" placeholder="Optional" />
                </mat-form-field>
                <div class="form-actions">
                  <button mat-stroked-button type="button" (click)="showAddPayment=false">Cancel</button>
                  <button mat-raised-button color="primary" (click)="addPayment()" [disabled]="paymentForm.invalid">
                    <mat-icon>save</mat-icon> Save Payment
                  </button>
                </div>
              </form>
            </div>

            <!-- Payment List -->
            <div class="payment-list" *ngIf="payments.length > 0">
              <div class="payment-item" *ngFor="let p of payments">
                <div class="payment-icon">
                  <mat-icon>payments</mat-icon>
                </div>
                <div class="payment-info">
                  <strong>₹{{ p.amount }}</strong>
                  <span>{{ p.forMonth }} · {{ p.paidDate | date:'dd MMM yyyy' }}</span>
                  <span *ngIf="p.notes" class="payment-note">{{ p.notes }}</span>
                </div>
                <button mat-icon-button color="warn" (click)="deletePayment(p)">
                  <mat-icon style="font-size:16px">delete</mat-icon>
                </button>
              </div>
            </div>

            <div class="empty-state" *ngIf="payments.length === 0 && !showAddPayment">
              <mat-icon>payments</mat-icon>
              <h4>No payments recorded</h4>
              <p>Record the first payment for this customer.</p>
            </div>
          </div>
        </mat-tab>

      </mat-tab-group>
    </div>

    <div class="page-container" *ngIf="!customer && !loading">
      <div class="empty-state">
        <mat-icon>person_off</mat-icon>
        <h4>Customer not found</h4>
        <a routerLink="/customers" mat-raised-button color="primary" style="margin-top:16px">Back to Customers</a>
      </div>
    </div>
  `,
  styles: [`
    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .header-actions {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .info-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 16px;
      display: flex;
      align-items: flex-start;
      gap: 14px;
      box-shadow: var(--shadow-sm);
    }
    .info-icon {
      width: 40px; height: 40px;
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      mat-icon { font-size: 20px; width: 20px; height: 20px; }
    }
    .info-label { font-size: 0.73rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
    .info-value { font-weight: 600; font-size: 0.92rem; margin-top: 3px; }
    .info-value.small { font-size: 0.82rem; font-weight: 400; }
    .overdue-text { color: var(--danger); }

    .detail-tabs {
      background: var(--bg-card);
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
      overflow: hidden;
    }
    .tab-content { padding: 20px; }
    .tab-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      h4 { font-size: 0.9rem; font-weight: 600; }
    }

    .inline-form {
      background: var(--bg-base);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 20px;
      margin-bottom: 20px;
    }
    .form-row-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      @media (max-width: 600px) { grid-template-columns: 1fr; }
    }
    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 8px;
    }

    /* Timeline */
    .service-timeline { display: flex; flex-direction: column; gap: 0; }
    .timeline-item {
      display: flex;
      gap: 14px;
      align-items: flex-start;
      padding: 14px 0;
      border-bottom: 1px solid var(--border);
      &:last-child { border-bottom: none; }
    }
    .timeline-dot {
      width: 36px; height: 36px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: white; }
    }
    .timeline-body { flex: 1; }
    .timeline-header {
      display: flex;
      justify-content: space-between;
      strong { font-size: 0.9rem; }
    }
    .timeline-date { font-size: 0.78rem; color: var(--text-muted); }
    .timeline-meta {
      display: flex;
      gap: 14px;
      margin-top: 4px;
      flex-wrap: wrap;
      span {
        display: flex; align-items: center; gap: 4px;
        font-size: 0.78rem; color: var(--text-secondary);
        mat-icon { font-size: 14px; width: 14px; height: 14px; }
      }
    }
    .timeline-notes { font-size: 0.82rem; color: var(--text-secondary); margin: 6px 0 0; }

    /* Payments */
    .payment-list { display: flex; flex-direction: column; }
    .payment-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid var(--border);
      &:last-child { border-bottom: none; }
    }
    .payment-icon {
      width: 36px; height: 36px;
      border-radius: 50%;
      background: #e8f5e9;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      mat-icon { color: #2e7d32; font-size: 18px; width: 18px; height: 18px; }
    }
    .payment-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      strong { font-size: 0.95rem; font-weight: 700; color: #2e7d32; }
      span   { font-size: 0.78rem; color: var(--text-secondary); }
      .payment-note { font-style: italic; }
    }
  `]
})
export class CustomerDetailComponent implements OnInit {
  customer: Customer | undefined;
  serviceRecords: ServiceRecord[] = [];
  payments: PaymentRecord[] = [];
  totalPaid = 0;
  loading = true;
  showAddService = false;
  showAddPayment = false;
  plans: RentalPlan[] = [];

  serviceForm!: FormGroup;
  paymentForm!: FormGroup;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private customerSvc: CustomerService,
    private serviceSvc: ServiceRecordService,
    private paymentSvc: PaymentService,
    private planSvc: PlanService,
    private waSvc: WhatsappService,
    private dialog: MatDialog,
    private fb: FormBuilder,
    private snack: MatSnackBar
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.planSvc.getAll().subscribe(p => this.plans = p);
    this.customerSvc.getById(id).subscribe(c => {
      this.customer = c;
      this.loading  = false;
      if (c) {
        this.loadServiceRecords(id);
        this.loadPayments(id);
      }
    });
    this.initForms();
  }

  initForms(): void {
    const curMonth = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    this.serviceForm = this.fb.group({
      serviceType:     ['filter-change', Validators.required],
      serviceDate:     [new Date(), Validators.required],
      technicianName:  ['', Validators.required],
      partsReplaced:   [''],
      notes:           [''],
      cost:            [0]
    });
    this.paymentForm = this.fb.group({
      amount:   [this.customer?.monthlyRent ?? 0, Validators.required],
      paidDate: [new Date(), Validators.required],
      forMonth: [curMonth, Validators.required],
      notes:    ['']
    });
  }

  loadServiceRecords(id: number): void {
    this.serviceSvc.getByCustomer(id).subscribe(s => this.serviceRecords = s);
  }

  loadPayments(id: number): void {
    this.paymentSvc.getByCustomer(this.customer!.id!).subscribe(p => {
      this.payments  = p;
      this.totalPaid = p.reduce((s, x) => s + x.amount, 0);
    });
  }

  addService(): void {
    if (this.serviceForm.invalid) return;
    const val = this.serviceForm.value;
    this.serviceSvc.add({
      ...val,
      customerId:   this.customer!.id!,
      customerName: this.customer!.name
    }).subscribe(() => {
      this.snack.open('Service logged!', 'OK', { duration: 3000 });
      this.showAddService = false;
      this.loadServiceRecords(this.customer!.id!);
      this.serviceForm.reset({ serviceType: 'filter-change', serviceDate: new Date(), cost: 0 });
    });
  }

  addPayment(): void {
    if (this.paymentForm.invalid) return;
    const val = this.paymentForm.value;
    this.paymentSvc.add({ ...val, customerId: this.customer!.id! }).subscribe(() => {
      // Update next due date by 1 month
      const nextDue = new Date(this.customer!.nextDueDate);
      nextDue.setMonth(nextDue.getMonth() + 1);
      this.customerSvc.update(this.customer!.id!, { nextDueDate: nextDue, lastPaymentDate: new Date(), status: 'active' }).subscribe();

      this.snack.open('Payment recorded!', 'OK', { duration: 3000 });
      this.showAddPayment = false;
      this.loadPayments(this.customer!.id!);
    });
  }

  deleteService(s: ServiceRecord): void {
    if (!confirm('Delete this service record?')) return;
    this.serviceSvc.delete(s.id!).subscribe(() => {
      this.snack.open('Deleted', 'OK', { duration: 2000 });
      this.loadServiceRecords(this.customer!.id!);
    });
  }

  deletePayment(p: PaymentRecord): void {
    if (!confirm('Delete this payment record?')) return;
    this.paymentSvc.delete(p.id!).subscribe(() => {
      this.snack.open('Deleted', 'OK', { duration: 2000 });
      this.loadPayments(this.customer!.id!);
    });
  }

  editCustomer(): void {
    const ref = this.dialog.open(CustomerFormDialogComponent, {
      width: '560px',
      data: { customer: this.customer, plans: this.plans }
    });
    ref.afterClosed().subscribe(result => {
      if (result) {
        this.customerSvc.getById(this.customer!.id!).subscribe(c => this.customer = c);
      }
    });
  }

  sendReminder(): void {
    if (this.customer) this.waSvc.sendRentReminder(this.customer);
  }

  isOverdue(): boolean {
    return this.customer ? new Date(this.customer.nextDueDate) < new Date() : false;
  }

  getServiceIcon(type: ServiceType): string {
    const m: Record<string, string> = {
      'filter-change': 'filter_alt', 'repair': 'handyman',
      'installation': 'plumbing', 'general-service': 'build', 'demo': 'play_circle'
    };
    return m[type] ?? 'build';
  }

  getServiceColor(type: ServiceType): string {
    const m: Record<string, string> = {
      'filter-change': '#0097a7', 'repair': '#e53935',
      'installation': '#43a047', 'general-service': '#7b1fa2', 'demo': '#1565c0'
    };
    return m[type] ?? '#757575';
  }

  getServiceLabel(type: ServiceType): string {
    return SERVICE_TYPE_LABELS[type] ?? type;
  }
}
