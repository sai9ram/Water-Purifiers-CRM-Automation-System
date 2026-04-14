import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { CustomerService } from '../../core/services/customer.service';
import { WhatsappService } from '../../core/services/whatsapp.service';
import { Customer } from '../../core/models/models';

@Component({
  selector: 'app-reminders',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatIconModule, MatButtonModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatCheckboxModule,
    MatSnackBarModule, MatTooltipModule, MatProgressBarModule
  ],
  template: `
    <div class="page-container fade-in">
      <div class="page-header">
        <div>
          <h2>Rent Reminders</h2>
          <p class="subtitle">Send WhatsApp reminders to customers with pending dues</p>
        </div>
      </div>

      <!-- Stats Bar -->
      <div class="reminder-stats">
        <div class="rstat">
          <mat-icon style="color:var(--warning)">notification_important</mat-icon>
          <div>
            <strong>{{ dueThisMonth.length }}</strong>
            <span>Due This Month</span>
          </div>
        </div>
        <div class="rstat">
          <mat-icon style="color:var(--danger)">warning</mat-icon>
          <div>
            <strong>{{ overdueCustomers.length }}</strong>
            <span>Overdue</span>
          </div>
        </div>
        <div class="rstat">
          <mat-icon style="color:var(--success)">check_circle</mat-icon>
          <div>
            <strong>{{ sentCount }}</strong>
            <span>Sent This Session</span>
          </div>
        </div>
        <div class="rstat">
          <mat-icon style="color:var(--brand-primary)">currency_rupee</mat-icon>
          <div>
            <strong>₹{{ totalDue | number }}</strong>
            <span>Total Due</span>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="reminder-filters">
        <div class="filter-tabs">
          <button [class.active]="activeTab === 'month'" (click)="setTab('month')">
            <mat-icon>calendar_month</mat-icon> Due This Month ({{ dueThisMonth.length }})
          </button>
          <button [class.active]="activeTab === 'overdue'" (click)="setTab('overdue')">
            <mat-icon>warning</mat-icon> Overdue ({{ overdueCustomers.length }})
          </button>
          <button [class.active]="activeTab === 'all'" (click)="setTab('all')">
            <mat-icon>people</mat-icon> All Active
          </button>
        </div>

        <div class="filter-actions">
          <button mat-stroked-button (click)="selectAll()">Select All</button>
          <button mat-stroked-button (click)="deselectAll()">Clear</button>
          <button mat-raised-button color="primary"
                  [disabled]="selectedIds.size === 0"
                  (click)="sendBulkReminders()">
            <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" width="16" alt="WA" style="margin-right:6px"/>
            Send to {{ selectedIds.size }} Selected
          </button>
        </div>
      </div>

      <!-- Progress bar during bulk send -->
      <mat-progress-bar *ngIf="bulkSending" mode="determinate" [value]="bulkProgress" style="margin-bottom:16px"></mat-progress-bar>

      <!-- Message Preview -->
      <div class="message-preview" *ngIf="previewCustomer">
        <div class="preview-header">
          <span><mat-icon>preview</mat-icon> Message Preview</span>
          <button mat-icon-button (click)="previewCustomer = null"><mat-icon>close</mat-icon></button>
        </div>
        <div class="whatsapp-bubble">
          <pre>{{ previewMessage }}</pre>
        </div>
      </div>

      <!-- Customer List -->
      <div class="table-card">

        <div *ngIf="displayedCustomers.length === 0" class="empty-state">
          <mat-icon>notifications_off</mat-icon>
          <h4>No customers in this category</h4>
          <p>Switch tabs to view other customers.</p>
        </div>

        <div class="reminder-list" *ngIf="displayedCustomers.length > 0">
          <div class="reminder-item" *ngFor="let c of displayedCustomers"
               [class.selected]="selectedIds.has(c.id!)">
            <mat-checkbox
              [checked]="selectedIds.has(c.id!)"
              (change)="toggleSelect(c.id!, $event.checked)"
              color="primary">
            </mat-checkbox>

            <div class="customer-avatar">{{ c.name[0] }}</div>

            <div class="customer-info">
              <strong>{{ c.name }}</strong>
              <span>{{ c.area }} · {{ c.phone }}</span>
              <span class="model-tag">{{ c.purifierModel }}</span>
            </div>

            <div class="due-info">
              <div class="rent-amount">₹{{ c.monthlyRent }}/mo</div>
              <div [class]="getDueDateClass(c.nextDueDate)">
                Due: {{ c.nextDueDate | date:'dd MMM' }}
              </div>
            </div>

            <span [class]="getStatusChip(c.status)">{{ c.status }}</span>

            <div class="reminder-actions">
              <button mat-icon-button matTooltip="Preview Message"
                      (click)="showPreview(c)">
                <mat-icon>visibility</mat-icon>
              </button>
              <button class="wa-send-btn" (click)="sendSingle(c)"
                      [class.sent]="sentIds.has(c.id!)">
                <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" width="18" alt="WA" />
                <span>{{ sentIds.has(c.id!) ? 'Sent ✓' : 'Send' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Bulk Send Instructions -->
      <div class="info-banner" *ngIf="selectedIds.size > 0">
        <mat-icon>info</mat-icon>
        <p>
          <strong>Bulk Send:</strong> Each customer's WhatsApp will open one at a time with a pre-filled message.
          Just press <strong>Send</strong> in WhatsApp for each one.
          Allow pop-ups in your browser if needed.
        </p>
      </div>
    </div>
  `,
  styles: [`
    /* Stats Bar */
    .reminder-stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;

      @media (max-width: 700px) { grid-template-columns: repeat(2, 1fr); }
    }

    .rstat {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 14px;
      box-shadow: var(--shadow-sm);

      mat-icon { font-size: 28px; width: 28px; height: 28px; }

      strong { display: block; font-size: 1.5rem; font-family: 'Sora',sans-serif; font-weight: 700; }
      span   { font-size: 0.75rem; color: var(--text-secondary); font-weight: 600; }
    }

    /* Filters */
    .reminder-filters {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 20px;
    }

    .filter-tabs {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;

      button {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        border: 1px solid var(--border);
        border-radius: 20px;
        background: var(--bg-card);
        cursor: pointer;
        font-size: 0.83rem;
        font-weight: 500;
        color: var(--text-secondary);
        transition: all 0.15s;
        font-family: 'Plus Jakarta Sans', sans-serif;

        mat-icon { font-size: 16px; width: 16px; height: 16px; }

        &:hover { border-color: var(--brand-primary); color: var(--brand-primary); }
        &.active { background: var(--brand-primary); color: white; border-color: var(--brand-primary); }
      }
    }

    .filter-actions {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }

    /* Message Preview */
    .message-preview {
      background: #e5ddd5;
      border-radius: var(--radius-md);
      overflow: hidden;
      margin-bottom: 20px;
      border: 1px solid var(--border);
    }

    .preview-header {
      background: #075e54;
      color: white;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;

      span { display: flex; align-items: center; gap: 8px; font-size: 0.88rem; font-weight: 600; }
      mat-icon { color: rgba(255,255,255,0.7); }

      button { color: rgba(255,255,255,0.7); }
    }

    .whatsapp-bubble {
      padding: 16px;

      pre {
        background: white;
        border-radius: 8px;
        border-top-left-radius: 0;
        padding: 12px 16px;
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: 0.85rem;
        line-height: 1.55;
        white-space: pre-wrap;
        word-break: break-word;
        max-width: 420px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.13);
        margin: 0;
      }
    }

    /* Reminder List */
    .reminder-list { display: flex; flex-direction: column; }

    .reminder-item {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 20px;
      border-bottom: 1px solid var(--border);
      transition: background 0.15s;

      &:last-child { border-bottom: none; }
      &:hover { background: var(--bg-base); }
      &.selected { background: var(--brand-light); }
    }

    .customer-avatar {
      width: 38px; height: 38px;
      border-radius: 50%;
      background: var(--brand-light);
      color: var(--brand-dark);
      display: flex; align-items: center; justify-content: center;
      font-weight: 700;
      flex-shrink: 0;
    }

    .customer-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
      strong { font-size: 0.9rem; }
      span   { font-size: 0.77rem; color: var(--text-secondary); }
      .model-tag {
        display: inline-block;
        background: var(--brand-light);
        color: var(--brand-dark);
        border-radius: 10px;
        padding: 1px 8px;
        font-size: 0.72rem;
        font-weight: 600;
        width: fit-content;
      }
    }

    .due-info {
      text-align: right;
      min-width: 100px;
      .rent-amount { font-weight: 700; font-size: 0.92rem; color: var(--brand-dark); }
    }

    .due-overdue { color: var(--danger); font-size: 0.77rem; font-weight: 600; }
    .due-soon    { color: var(--warning); font-size: 0.77rem; font-weight: 600; }
    .due-ok      { color: var(--text-muted); font-size: 0.77rem; }

    .reminder-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .wa-send-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      border: 1px solid #25d366;
      border-radius: 20px;
      background: white;
      cursor: pointer;
      font-size: 0.82rem;
      font-weight: 600;
      color: #128c7e;
      transition: all 0.15s;
      font-family: 'Plus Jakarta Sans', sans-serif;

      &:hover { background: #e8f5e9; }
      &.sent  { background: #e8f5e9; color: #2e7d32; border-color: #a5d6a7; }
    }

    .info-banner {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background: var(--brand-light);
      border: 1px solid var(--brand-accent);
      border-radius: var(--radius-md);
      padding: 14px 18px;
      margin-top: 16px;
      color: var(--brand-dark);

      mat-icon { flex-shrink: 0; color: var(--brand-primary); margin-top: 2px; }
      p { margin: 0; font-size: 0.85rem; line-height: 1.5; }
    }
  `]
})
export class RemindersComponent implements OnInit {
  dueThisMonth: Customer[]    = [];
  overdueCustomers: Customer[] = [];
  allActive: Customer[]        = [];
  displayedCustomers: Customer[] = [];

  activeTab = 'month';
  selectedIds = new Set<number>();
  sentIds     = new Set<number>();
  sentCount   = 0;
  totalDue    = 0;

  previewCustomer: Customer | null = null;
  previewMessage  = '';

  bulkSending  = false;
  bulkProgress = 0;

  constructor(
    private customerSvc: CustomerService,
    private waSvc: WhatsappService,
    private snack: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.customerSvc.getDueThisMonth().subscribe(c => {
      this.dueThisMonth = c;
      this.totalDue = c.reduce((s, x) => s + (x.monthlyRent ?? 0), 0);
      this.setTab('month');
    });

    this.customerSvc.getOverdue().subscribe(c => this.overdueCustomers = c);

    this.customerSvc.getByStatus('active').subscribe(c => this.allActive = c);
  }

  setTab(tab: string): void {
    this.activeTab = tab;
    this.selectedIds.clear();
    if (tab === 'month')   this.displayedCustomers = this.dueThisMonth;
    else if (tab === 'overdue') this.displayedCustomers = this.overdueCustomers;
    else                   this.displayedCustomers = this.allActive;
  }

  toggleSelect(id: number, checked: boolean): void {
    checked ? this.selectedIds.add(id) : this.selectedIds.delete(id);
  }

  selectAll(): void {
    this.displayedCustomers.forEach(c => this.selectedIds.add(c.id!));
  }

  deselectAll(): void {
    this.selectedIds.clear();
  }

  sendSingle(c: Customer): void {
    this.waSvc.sendRentReminder(c);
    this.sentIds.add(c.id!);
    this.sentCount++;
  }

  async sendBulkReminders(): Promise<void> {
    const selected = this.displayedCustomers.filter(c => this.selectedIds.has(c.id!));
    if (selected.length === 0) return;

    this.bulkSending  = true;
    this.bulkProgress = 0;

    for (let i = 0; i < selected.length; i++) {
      const c = selected[i];
      this.waSvc.sendRentReminder(c);
      this.sentIds.add(c.id!);
      this.sentCount++;
      this.bulkProgress = Math.round(((i + 1) / selected.length) * 100);

      if (i < selected.length - 1) {
        await new Promise(r => setTimeout(r, 1200)); // small delay between tabs
      }
    }

    this.bulkSending = false;
    this.snack.open(`Reminders sent to ${selected.length} customers!`, 'OK', { duration: 4000 });
  }

  showPreview(c: Customer): void {
    this.previewCustomer = c;
    this.previewMessage  = this.waSvc.generateRentReminderMessage(c);
  }

  getDueDateClass(date: Date): string {
    const d    = new Date(date);
    const diff = Math.ceil((d.getTime() - new Date().getTime()) / 86400000);
    if (diff < 0)  return 'due-overdue';
    if (diff <= 5) return 'due-soon';
    return 'due-ok';
  }

  getStatusChip(status: string): string {
    return { active: 'chip chip-success', overdue: 'chip chip-danger', inactive: 'chip chip-muted' }[status] ?? 'chip';
  }
}
