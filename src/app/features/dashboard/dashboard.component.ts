import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { CustomerService } from '../../core/services/customer.service';
import { ServiceRecordService } from '../../core/services/service-record.service';
import { Customer, ServiceRecord, PaymentRecord } from '../../core/models/models';
import { WhatsappService } from '../../core/services/whatsapp.service';
import { PaymentService } from '../../core/services/payment.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatButtonModule, MatCardModule,
    FormsModule, MatFormFieldModule, MatInputModule, MatDatepickerModule, MatNativeDateModule, MatSelectModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  stats = { total: 0, active: 0, inactive: 0, overdue: 0, totalRevenue: 0, monthlyRevenue: 0 };
  serviceStats = { total: 0, thisMonth: 0, upcoming: 0 };
  thisMonthMaintenanceCount = 0;
  dueCustomers: Customer[] = [];
  recentServices: ServiceRecord[] = [];
  dashboardFilter: 'all' | 'this-month' | 'last-month' | 'next-month' | 'custom' = 'this-month';
  startDate: Date | null = null;
  endDate: Date | null = null;
  allCustomers: Customer[] = [];
  allServices: ServiceRecord[] = [];
  allPayments: PaymentRecord[] = [];
  filteredCollected = 0;
  filteredServiceCost = 0;

  private customerSvc = inject(CustomerService);
  private serviceSvc = inject(ServiceRecordService);
  private waSvc = inject(WhatsappService);
  private paymentSvc = inject(PaymentService);
  private router = inject(Router);

  ngOnInit(): void {
    this.customerSvc.getStats().subscribe(s => this.stats = s);
    this.customerSvc.getAll().subscribe(customers => {
      this.allCustomers = customers;
      this.computeDashboardStats();
    });
    this.serviceSvc.getStats().subscribe(s => this.serviceStats = s);
    this.serviceSvc.getAll().subscribe(services => {
      this.allServices = services;
      this.computeDashboardStats();
    });
    this.serviceSvc.getRecent(6).subscribe(s => this.recentServices = s);
    this.paymentSvc.getAll().subscribe(payments => {
      this.allPayments = payments;
      this.computeDashboardStats();
    });
    this.setDashboardRange('this-month');
  }

  sendReminder(c: Customer): void {
    this.waSvc.sendRentReminder(c);
  }

  getServiceIcon(type: string): string {
    const icons: Record<string, string> = {
      'filter-change':   'filter_alt',
      'repair':          'handyman',
      'installation':    'plumbing',
      'general-service': 'build',
      'demo':            'play_circle'
    };
    return icons[type] ?? 'build';
  }

  openThisMonthMaintenance(): void {
    void this.router.navigate(['/services'], {
      queryParams: { maintenanceFilter: 'this-month' }
    });
  }

  private countThisMonthMaintenance(customers: Customer[]): number {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    return customers.filter(customer => {
      if (!customer.nextServiceDate) return false;
      const nextServiceDate = new Date(customer.nextServiceDate);
      return nextServiceDate >= start && nextServiceDate <= end;
    }).length;
  }

  onDashboardFilterChange(filter: 'all' | 'this-month' | 'last-month' | 'next-month' | 'custom'): void {
    this.setDashboardRange(filter);
    this.computeDashboardStats();
  }

  clearDateFilter(): void {
    this.dashboardFilter = 'all';
    this.startDate = null;
    this.endDate = null;
    this.computeDashboardStats();
  }

  computeDashboardStats(): void {
    const start = this.startDate ? this.normalizeStart(this.startDate) : null;
    const end = this.endDate ? this.normalizeEnd(this.endDate) : null;

    this.filteredCollected = this.allPayments
      .filter(p => {
        const paid = new Date(p.paidDate);
        const matchesStart = !start || paid >= start;
        const matchesEnd = !end || paid <= end;
        return matchesStart && matchesEnd;
      })
      .reduce((s, p) => s + p.amount, 0);

    const hasPaymentForRange = (customerId: number | undefined): boolean => {
      if (!customerId) return false;
      return this.allPayments.some(payment => {
        if (payment.customerId !== customerId) return false;
        const paid = new Date(payment.paidDate);
        const matchesStart = !start || paid >= start;
        const matchesEnd = !end || paid <= end;
        return matchesStart && matchesEnd;
      });
    };

    this.dueCustomers = this.allCustomers.filter(customer => {
      if (!customer.id) return false;
      const unpaidForRange = !hasPaymentForRange(customer.id);
      return unpaidForRange && (customer.status === 'active' || customer.status === 'overdue');
    });

    this.thisMonthMaintenanceCount = this.allServices.filter(record => {
      if (!record.nextServiceDate) return false;
      const nextService = new Date(record.nextServiceDate);
      const matchesStart = !start || nextService >= start;
      const matchesEnd = !end || nextService <= end;
      return matchesStart && matchesEnd;
    }).length;

    this.filteredServiceCost = this.allServices
      .filter(record => {
        const serviceDate = new Date(record.serviceDate);
        const matchesStart = !start || serviceDate >= start;
        const matchesEnd = !end || serviceDate <= end;
        return matchesStart && matchesEnd;
      })
      .reduce((sum, record) => sum + (record.cost || 0), 0);

    this.recentServices = this.allServices
      .filter(record => {
        const service = new Date(record.serviceDate);
        const matchesStart = !start || service >= start;
        const matchesEnd = !end || service <= end;
        return matchesStart && matchesEnd;
      })
      .sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime())
      .slice(0, 6);
  }

  private setDashboardRange(filter: 'all' | 'this-month' | 'last-month' | 'next-month' | 'custom'): void {
    this.dashboardFilter = filter;
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
}
