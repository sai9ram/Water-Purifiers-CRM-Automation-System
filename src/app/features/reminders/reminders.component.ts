import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
import { Customer, PaymentRecord } from '../../core/models/models';
import { PaymentRecordDialogComponent } from './payment-record-dialog.component';

@Component({
  selector: 'app-reminders',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatIconModule, MatButtonModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatDatepickerModule, MatNativeDateModule,
    MatCheckboxModule, MatDialogModule, MatSnackBarModule, MatTooltipModule, MatProgressBarModule
  ],
  templateUrl: './reminders.component.html',
  styleUrl: './reminders.component.scss'
})
export class RemindersComponent implements OnInit {
  dueThisMonth: Customer[] = [];
  overdueCustomers: Customer[] = [];
  allActive: Customer[] = [];
  displayedCustomers: Customer[] = [];
  allCustomers: Customer[] = [];
  allPayments: PaymentRecord[] = [];

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

  private customerSvc = inject(CustomerService);
  private paymentSvc = inject(PaymentService);
  private waSvc = inject(WhatsappService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);

  ngOnInit(): void {
    this.setReminderRange('this-month');
    this.loadData();
  }

  loadData(): void {
    this.customerSvc.getAll().subscribe(customers => {
      this.allCustomers = customers;
      this.paymentSvc.getAll().subscribe(payments => {
        this.allPayments = payments;
        this.computeReminderLists();
      });
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
    const today = this.normalizeStart(new Date());

    const matchesRange = (value?: Date | string | null): boolean => {
      if (!value) return false;
      const date = new Date(value);
      const matchesStart = !start || date >= start;
      const matchesEnd = !end || date <= end;
      return matchesStart && matchesEnd;
    };

    const hasPaymentForRange = (customerId: number | undefined): boolean => {
      if (!customerId) return false;
      return this.allPayments.some(payment => {
        if (payment.customerId !== customerId) return false;
        const paidDate = new Date(payment.paidDate);
        const matchesStart = !start || paidDate >= start;
        const matchesEnd = !end || paidDate <= end;
        return matchesStart && matchesEnd;
      });
    };

    this.dueThisMonth = this.allCustomers.filter(customer => {
      if (!customer.id) return false;
      const unpaidForRange = !hasPaymentForRange(customer.id);
      return unpaidForRange && (customer.status === 'active' || customer.status === 'overdue');
    });

    this.overdueCustomers = this.allCustomers.filter(customer => {
      if (!customer.nextDueDate || !customer.id) return false;
      const nextDue = new Date(customer.nextDueDate);
      const unpaidForRange = !hasPaymentForRange(customer.id);
      return unpaidForRange && nextDue < today && customer.status !== 'inactive';
    });

    this.allActive = this.allCustomers.filter(customer => {
      if (!customer.id || customer.status !== 'active') return false;
      const unpaidForRange = !hasPaymentForRange(customer.id);
      return unpaidForRange;
    });

    this.totalDue = this.dueThisMonth.reduce((sum, customer) => sum + (customer.monthlyRent ?? 0), 0);
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
    else if (tab === 'overdue') this.displayedCustomers = this.overdueCustomers;
    else this.displayedCustomers = this.allActive;
  }

  toggleSelect(id: number, checked: boolean): void {
    if (checked) {
      this.selectedIds.add(id)
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
        await new Promise(r => setTimeout(r, 1200)); // small delay between tabs
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
