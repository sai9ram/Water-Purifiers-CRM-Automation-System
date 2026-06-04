import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { CustomerService } from '../../core/services/customer.service';
import { ServiceRecordService } from '../../core/services/service-record.service';
import { Customer, ServiceRecord } from '../../core/models/models';
import { WhatsappService } from '../../core/services/whatsapp.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatButtonModule, MatCardModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  stats = { total: 0, active: 0, inactive: 0, overdue: 0, totalRevenue: 0, monthlyRevenue: 0 };
  serviceStats = { total: 0, thisMonth: 0, upcoming: 0 };
  thisMonthMaintenanceCount = 0;
  dueCustomers: Customer[] = [];
  recentServices: ServiceRecord[] = [];

  private customerSvc = inject(CustomerService);
  private serviceSvc = inject(ServiceRecordService);
  private waSvc = inject(WhatsappService);
  private router = inject(Router);

  ngOnInit(): void {
    this.customerSvc.getStats().subscribe(s => this.stats = s);
    this.customerSvc.getDueThisMonth().subscribe(c => this.dueCustomers = c);
    this.customerSvc.getAll().subscribe(customers => {
      this.thisMonthMaintenanceCount = this.countThisMonthMaintenance(customers);
    });
    this.serviceSvc.getStats().subscribe(s => this.serviceStats = s);
    this.serviceSvc.getRecent(6).subscribe(s => this.recentServices = s);
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
}
