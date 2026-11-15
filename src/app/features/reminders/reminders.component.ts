import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { CustomerService } from '../../core/services/customer.service';
import { PaymentService } from '../../core/services/payment.service';
import { WhatsappService } from '../../core/services/whatsapp.service';
import { PaymentLinkService } from '../../core/services/payment-link.service';
import { RealtimeCrmService } from '../../core/services/realtime-crm.service';
import { Customer, PaymentRecord, WhatsAppAutomationLog } from '../../core/models/models';
import { PaymentRecordDialogComponent } from './payment-record-dialog.component';

@Component({
  selector: 'app-reminders',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatCheckboxModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatProgressBarModule
  ],
  templateUrl: './reminders.component.html',
  styleUrl: './reminders.component.scss'
})
export class RemindersComponent implements OnInit, OnDestroy {
  dueThisMonth: Customer[] = [];
  dueIn5DaysCustomers: Customer[] = [];
  overdueCustomers: Customer[] = [];
  paidThisCycleCustomers: Customer[] = [];
  allActive: Customer[] = [];
  displayedCustomers: Customer[] = [];
  allCustomers: Customer[] = [];
  allPayments: PaymentRecord[] = [];
  automationLogs: WhatsAppAutomationLog[] = [];

  activeTab = 'month';
  reminderFilter: 'all' | 'this-month' | 'last-month' | 'next-month' | 'custom' = 'this-month';
  startDate: Date | null = null;
  endDate: Date | null = null;
  selectedIds = new Set<number>();
  sentIds = new Set<number>();
  sentCount = 0;
  totalDue = 0;

  previewCustomer: Customer | null = null;
  previewMessage = '';

  bulkSending = false;
  bulkProgress = 0;
  runningAutoCheck = false;

  private customerSvc = inject(CustomerService);
  private paymentSvc = inject(PaymentService);
  private waSvc = inject(WhatsappService);
  private paymentLinkSvc = inject(PaymentLinkService);
  public crm = inject(RealtimeCrmService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);

  private subs = new Subscription();

  ngOnInit(): void {
    this.setReminderRange('this-month');
    this.loadData();

    // Real-time refresh whenever a customer pays online via their payment link or automation triggers
    this.subs.add(
      this.crm.changes$.subscribe(() => {
        this.loadData();
      })
    );

    this.subs.add(
      this.crm.whatsappLogs$.subscribe(logs => {
        this.automationLogs = logs.slice(0, 25);
        this.sentCount = logs.filter(l => l.direction === 'OUTBOUND').length;
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  loadData(): void {
    forkJoin({
      customers: this.customerSvc.getAll(),
      payments: this.paymentSvc.getAll()
    }).subscribe(({ customers, payments }) => {
      this.allCustomers = customers;
      this.allPayments = payments;
      this.computeReminderLists();
    });
  }

  triggerAutomationCheck(): void {
    this.runningAutoCheck = true;
    this.crm.runAutomationNow().subscribe({
      next: res => {
        this.runningAutoCheck = false;
        this.loadData();
        this.snack.open(res.message, 'OK', { duration: 3500 });
      },
      error: () => {
        this.runningAutoCheck = false;
      }
    });
  }

  onReminderFilterChange(filter: 'all' | 'this-month' | 'last-month' | 'next-month' | 'custom'): void {
    this.setReminderRange(filter);
    this.computeReminderLists();
  }

  clearDateFilter(): void {
    this.reminderFilter = 'all';
    this.startDate = null;
    this.endDate = null;
    this.computeReminderLists();
  }

  computeReminderLists(): void {
    const start = this.startDate ? this.normalizeStart(this.startDate) : null;
    const end = this.endDate ? this.normalizeEnd(this.endDate) : null;

    const paidCustomerIds = new Set<number>();
    for (const payment of this.allPayments) {
      if (!payment.customerId) continue;
      const paidDate = new Date(payment.paidDate);
      if ((!start || paidDate >= start) && (!end || paidDate <= end)) {
        paidCustomerIds.add(Number(payment.customerId));
      }
    }

    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const dueThisMonth: Customer[] = [];
    const dueIn5DaysCustomers: Customer[] = [];
    const overdueCustomers: Customer[] = [];
    const paidThisCycleCustomers: Customer[] = [];
    const allActive: Customer[] = [];
    let totalDue = 0;

    for (const customer of this.allCustomers) {
      if (!customer.id) continue;

      if (paidCustomerIds.has(Number(customer.id))) {
        paidThisCycleCustomers.push(customer);
        continue;
      }

      const dueDate = new Date(customer.nextDueDate);
      const dueMidnight = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      const daysUntilDue = Math.round((dueMidnight.getTime() - todayMidnight.getTime()) / 86400000);
      customer.daysUntilDue = daysUntilDue;

      if (customer.status === 'active' || customer.status === 'overdue') {
        dueThisMonth.push(customer);
        totalDue += customer.monthlyRent ?? 0;
      }

      if (daysUntilDue >= 0 && daysUntilDue <= 5 && customer.status !== 'inactive') {
        dueIn5DaysCustomers.push(customer);
      }

      if ((daysUntilDue < 0 || customer.status === 'overdue') && customer.status !== 'inactive') {
        overdueCustomers.push(customer);
      }

      if (customer.status === 'active') {
        allActive.push(customer);
      }
    }

    this.dueThisMonth = dueThisMonth;
    this.dueIn5DaysCustomers = dueIn5DaysCustomers;
    this.overdueCustomers = overdueCustomers;
    this.paidThisCycleCustomers = paidThisCycleCustomers;
    this.allActive = allActive;
    this.totalDue = totalDue;
    this.setTab(this.activeTab);
  }

  private setReminderRange(filter: 'all' | 'this-month' | 'last-month' | 'next-month' | 'custom'): void {
    this.reminderFilter = filter;
    if (filter === 'custom') return;

    if (filter === 'all') {
      this.clearDateFilter();
      return;
    }

    const today = new Date();
    const monthDate = new Date(today.getFullYear(), today.getMonth(), 1);

    if (filter === 'last-month') {
      monthDate.setMonth(monthDate.getMonth() - 1);
    } else if (filter === 'next-month') {
      monthDate.setMonth(monthDate.getMonth() + 1);
    }

    this.startDate = this.normalizeStart(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1));
    this.endDate = this.normalizeEnd(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0));
  }

  private normalizeStart(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }

  private normalizeEnd(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(23, 59, 59, 999);
    return normalized;
  }

  setTab(tab: string): void {
    this.activeTab = tab;
    this.selectedIds.clear();
    if (tab === 'month') this.displayedCustomers = this.dueThisMonth;
    else if (tab === 'pre5') this.displayedCustomers = this.dueIn5DaysCustomers;
    else if (tab === 'overdue') this.displayedCustomers = this.overdueCustomers;
    else if (tab === 'paid') this.displayedCustomers = this.paidThisCycleCustomers;
    else this.displayedCustomers = this.allActive;
  }

  toggleSelect(id: number, checked: boolean): void {
    if (checked) {
      this.selectedIds.add(id);
    } else {
      this.selectedIds.delete(id);
    }
  }

  selectAll(): void {
    this.displayedCustomers.forEach(c => this.selectedIds.add(c.id!));
  }

  deselectAll(): void {
    this.selectedIds.clear();
  }

  getUniquePaymentId(c: Customer): string {
    return this.paymentLinkSvc.getUniquePaymentId(c);
  }

  getPaymentLinkUrl(c: Customer): string {
    return this.paymentLinkSvc.getPaymentUrl(c, c.monthlyRent ?? 0);
  }

  copyPaymentLink(c: Customer): void {
    const url = this.getPaymentLinkUrl(c);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(url);
      this.snack.open(`Copied unique payment link (${this.getUniquePaymentId(c)})`, 'OK', { duration: 2500 });
    }
  }

  sendSingle(c: Customer): void {
    this.waSvc.sendRentReminder(c);
    this.sentIds.add(c.id!);
    this.sentCount++;
  }

  async sendBulkReminders(): Promise<void> {
    const selected = this.displayedCustomers.filter(c => this.selectedIds.has(c.id!));
    if (selected.length === 0) return;

    this.bulkSending = true;
    this.bulkProgress = 0;

    for (let i = 0; i < selected.length; i++) {
      const c = selected[i];
      this.waSvc.sendRentReminder(c);
      this.sentIds.add(c.id!);
      this.sentCount++;
      this.bulkProgress = Math.round(((i + 1) / selected.length) * 100);

      if (i < selected.length - 1) {
        await new Promise(r => setTimeout(r, 1200));
      }
    }

    this.bulkSending = false;
    this.snack.open(`Reminders sent to ${selected.length} customers!`, 'OK', { duration: 4000 });
  }

  showPreview(c: Customer): void {
    this.previewCustomer = c;
    this.previewMessage = this.waSvc.generateRentReminderMessage(c);
  }

  recordPayment(c: Customer): void {
    const ref = this.dialog.open(PaymentRecordDialogComponent, {
      width: '520px',
      data: { customer: c }
    });

    ref.afterClosed().subscribe(saved => {
      if (saved) {
        this.loadData();
      }
    });
  }

  getDueCountdownBadge(c: Customer): { label: string; css: string } {
    const days = c.daysUntilDue ?? Math.ceil((new Date(c.nextDueDate).getTime() - Date.now()) / 86400000);
    if (this.activeTab === 'paid') {
      return { label: 'PAID ✓ (Moved to Paid List)', css: 'auto-badge paid' };
    }
    if (days < 0) {
      return {
        label: `Overdue by ${Math.abs(days)}d · Auto Reminder Sent ✓`,
        css: 'auto-badge overdue'
      };
    }
    if (days === 0) {
      return {
        label: 'Due Today · Auto Reminder Sent ✓',
        css: 'auto-badge due-today'
      };
    }
    if (days <= 5) {
      return {
        label: `Due in ${days}d (5-Day Pre-Due Auto-Sent ✓)`,
        css: 'auto-badge pre-due'
      };
    }
    return {
      label: `Due in ${days}d (Auto-Scheduled 5d Before)`,
      css: 'auto-badge scheduled'
    };
  }

  getDueDateClass(date: Date): string {
    const d = new Date(date);
    const diff = Math.ceil((d.getTime() - new Date().getTime()) / 86400000);
    if (diff < 0) return 'due-overdue';
    if (diff <= 5) return 'due-soon';
    return 'due-ok';
  }

  getStatusChip(status: string): string {
    return { active: 'chip chip-success', overdue: 'chip chip-danger', inactive: 'chip chip-muted' }[status] ?? 'chip';
  }
}
