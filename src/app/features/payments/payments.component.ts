import { AfterViewInit, Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { PaymentService } from '../../core/services/payment.service';
import { CustomerService } from '../../core/services/customer.service';
import { Customer, PaymentRecord } from '../../core/models/models';
import { EditReceiverDialogComponent } from './edit-receiver-dialog.component';

interface PaymentView extends PaymentRecord {
  customerName: string;
  customerPhone: string;
  customerArea: string;
}

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDialogModule
  ],
  templateUrl: './payments.component.html',
  styleUrl: './payments.component.scss'
})
export class PaymentsComponent implements OnInit, AfterViewInit {
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  columns = ['customer', 'forMonth', 'paidDate', 'amount', 'receiver', 'notes', 'actions'];
  // columns = ['customer', 'forMonth', 'paidDate', 'amount', 'notes', 'actions'];
  dataSource = new MatTableDataSource<PaymentView>([]);
  allPayments: PaymentView[] = [];
  customers: Customer[] = [];

  searchQuery = '';
  receiverFilter = '';
  paymentFilter: 'this-month' | 'last-month' | 'next-month' | 'custom' = 'this-month';
  startDate: Date | null = null;
  endDate: Date | null = null;

  filteredTotal = 0;
  filteredCount = 0;
  filteredCustomers = 0;
  averagePayment = 0;

  private paymentSvc = inject(PaymentService);
  private customerSvc = inject(CustomerService);
  private dialog = inject(MatDialog);

  ngOnInit(): void {
    this.setPaymentRange('this-month');
    this.loadData();
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.dataSource.paginator = this.paginator;
  }

  loadData(): void {
    this.customerSvc.getAll().subscribe(customers => {
      this.customers = customers;
      this.paymentSvc.getAll().subscribe(payments => {
        const customerMap = new Map<number, Customer>(customers.map(customer => [customer.id!, customer]));
        this.allPayments = payments.map(payment => {
          const customer = customerMap.get(payment.customerId);
          return {
            ...payment,
            customerName: customer?.name ?? 'Unknown Customer',
            customerPhone: customer?.phone ?? '',
            customerArea: customer?.area ?? ''
          };
        });
        this.applyFilter();
      });
    });
  }

  applyFilter(): void {
    const query = this.searchQuery.trim().toLowerCase();
    const start = this.startDate ? this.normalizeStart(this.startDate) : null;
    const end = this.endDate ? this.normalizeEnd(this.endDate) : null;

    const filtered = this.allPayments.filter(payment => {
      const paidDate = new Date(payment.paidDate);
      const matchesQuery = !query || [
        payment.customerName,
        payment.customerPhone,
        payment.customerArea,
        payment.forMonth,
        payment.notes ?? ''
      ].some(value => value.toLowerCase().includes(query));

      const matchesReceiver = !this.receiverFilter || (payment.receiver || 'Charan').toLowerCase() === this.receiverFilter.toLowerCase();
      const matchesStart = !start || paidDate >= start;
      const matchesEnd = !end || paidDate <= end;

      return matchesQuery && matchesReceiver && matchesStart && matchesEnd;
    });

    this.dataSource.data = filtered;
    this.updateStats(filtered);

    if (this.paginator) {
      this.paginator.firstPage();
    }
  }

  onPaymentFilterChange(filter: 'this-month' | 'last-month' | 'next-month' | 'custom'): void {
    this.setPaymentRange(filter);
    this.applyFilter();
  }

  clearDateFilter(): void {
    this.paymentFilter = 'custom';
    this.startDate = null;
    this.endDate = null;
    this.applyFilter();
  }

  editReceiver(payment: PaymentView): void {
    if (!payment.id) return;

    const ref = this.dialog.open(EditReceiverDialogComponent, {
      width: '420px',
      data: { receiver: payment.receiver || 'Charan' }
    });

    ref.afterClosed().subscribe(result => {
      if (!result) return;
      const trimmed = result.trim();
      if (!trimmed) return;

      this.paymentSvc.update(payment.id!, { receiver: trimmed }).subscribe(() => {
        payment.receiver = trimmed;
        this.applyFilter();
      });
    });
  }

  deletePayment(payment: PaymentView): void {
    if (!payment.id || !confirm('Delete this payment record?')) return;
    this.paymentSvc.delete(payment.id).subscribe(() => {
      this.allPayments = this.allPayments.filter(item => item.id !== payment.id);
      this.applyFilter();
    });
  }

  private updateStats(payments: PaymentView[]): void {
    this.filteredCount = payments.length;
    this.filteredTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);
    this.filteredCustomers = new Set(payments.map(payment => payment.customerId)).size;
    this.averagePayment = payments.length ? Math.round(this.filteredTotal / payments.length) : 0;
  }

  private setPaymentRange(filter: 'this-month' | 'last-month' | 'next-month' | 'custom'): void {
    this.paymentFilter = filter;
    if (filter === 'custom') {
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
}
