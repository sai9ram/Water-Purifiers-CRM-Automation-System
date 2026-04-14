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
  templateUrl: './reminders.component.html',
  styleUrl: './reminders.component.scss'
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
