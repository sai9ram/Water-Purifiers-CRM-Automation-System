import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
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
import { PlanService } from '../../core/services/plan.service';
import { Customer, ServiceRecord, PaymentRecord, RentalPlan } from '../../core/models/models';
import { WhatsappService } from '../../core/services/whatsapp.service';
import { PaymentService } from '../../core/services/payment.service';
import { CustomerReportExportService } from '../../core/services/customer-report-export.service';

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
  allPlans: RentalPlan[] = [];
  filteredCollected = 0;
  filteredServiceCost = 0;

  private customerSvc = inject(CustomerService);
  private serviceSvc = inject(ServiceRecordService);
  private planSvc = inject(PlanService);
  private waSvc = inject(WhatsappService);
  private paymentSvc = inject(PaymentService);
  private exportSvc = inject(CustomerReportExportService);
  private router = inject(Router);

  ngOnInit(): void {
    this.setDashboardRange('this-month');
    forkJoin({
      customers: this.customerSvc.getAll(),
      services: this.serviceSvc.getAll(),
      payments: this.paymentSvc.getAll(),
      plans: this.planSvc.getAll()
    }).subscribe(({ customers, services, payments, plans }) => {
      this.allCustomers = customers;
      this.allServices = services;
      this.allPayments = payments;
      this.allPlans = plans;

      const planMap = new Map(plans.map(p => [p.id!, p.monthlyRent]));
      let active = 0;
      let inactive = 0;
      let overdue = 0;
      let monthlyRevenue = 0;

      for (const c of customers) {
        if (c.status === 'active') {
          active++;
          monthlyRevenue += planMap.get(c.planId) ?? c.monthlyRent ?? 0;
        } else if (c.status === 'inactive') {
          inactive++;
        } else if (c.status === 'overdue') {
          overdue++;
        }
      }

      const totalRevenue = payments.reduce((s, p) => s + p.amount, 0);
      this.stats = {
        total: customers.length,
        active,
        inactive,
        overdue,
        totalRevenue,
        monthlyRevenue
      };

      this.computeDashboardStats();
    });
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

  exportCustomerReport(): void {
    void this.exportSvc.exportCustomerReport({
      startDate: this.startDate,
      endDate: this.endDate,
      fileName: 'customer-report.xlsx'
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
    const paidCustomerIds = new Set<number>();
    let collected = 0;

    for (const p of this.allPayments) {
      const paid = new Date(p.paidDate);
      if ((!start || paid >= start) && (!end || paid <= end)) {
        collected += p.amount;
        if (p.customerId) {
          paidCustomerIds.add(p.customerId);
        }
      }
    }
    this.filteredCollected = collected;

    this.dueCustomers = this.allCustomers.filter(customer => {
      if (!customer.id) return false;
      return !paidCustomerIds.has(customer.id) && (customer.status === 'active' || customer.status === 'overdue');
    });

    let maintenanceCount = 0;
    let serviceCost = 0;
    const matchingServices: ServiceRecord[] = [];

    for (const record of this.allServices) {
      if (record.nextServiceDate) {
        const nextService = new Date(record.nextServiceDate);
        if ((!start || nextService >= start) && (!end || nextService <= end)) {
          maintenanceCount++;
        }
      }

      const serviceDate = new Date(record.serviceDate);
      if ((!start || serviceDate >= start) && (!end || serviceDate <= end)) {
        serviceCost += record.cost || 0;
        if (matchingServices.length < 6) {
          matchingServices.push(record);
        }
      }
    }

    this.thisMonthMaintenanceCount = maintenanceCount;
    this.filteredServiceCost = serviceCost;
    this.recentServices = matchingServices;
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
