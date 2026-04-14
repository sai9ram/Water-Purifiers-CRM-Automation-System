import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
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
  template: `
    <div class="page-container fade-in">
      <div class="page-header">
        <div>
          <h2>Dashboard</h2>
          <p class="subtitle">Welcome back! Here's what's happening today.</p>
        </div>
        <a routerLink="/customers" mat-raised-button color="primary">
          <mat-icon>person_add</mat-icon> Add Customer
        </a>
      </div>

      <!-- Stats Grid -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon" style="background:#e0f7fa">
            <mat-icon style="color:#0097a7">people</mat-icon>
          </div>
          <div class="stat-label">Total Customers</div>
          <div class="stat-value">{{ stats.total }}</div>
          <div class="stat-sub">{{ stats.active }} active</div>
        </div>

        <div class="stat-card">
          <div class="stat-icon" style="background:#e8f5e9">
            <mat-icon style="color:#2e7d32">currency_rupee</mat-icon>
          </div>
          <div class="stat-label">Monthly Revenue</div>
          <div class="stat-value">₹{{ stats.monthlyRevenue | number }}</div>
          <div class="stat-sub">from active rentals</div>
        </div>

        <div class="stat-card">
          <div class="stat-icon" style="background:#fff8e1">
            <mat-icon style="color:#f57f17">notification_important</mat-icon>
          </div>
          <div class="stat-label">Due This Month</div>
          <div class="stat-value">{{ dueCustomers.length }}</div>
          <div class="stat-sub">
            <a routerLink="/reminders" style="color:var(--brand-primary)">Send reminders →</a>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon" style="background:#ffebee">
            <mat-icon style="color:#c62828">warning</mat-icon>
          </div>
          <div class="stat-label">Overdue</div>
          <div class="stat-value">{{ stats.overdue }}</div>
          <div class="stat-sub">need follow-up</div>
        </div>

        <div class="stat-card">
          <div class="stat-icon" style="background:#f3e5f5">
            <mat-icon style="color:#6a1b9a">build</mat-icon>
          </div>
          <div class="stat-label">Services This Month</div>
          <div class="stat-value">{{ serviceStats.thisMonth }}</div>
          <div class="stat-sub">{{ serviceStats.upcoming }} upcoming</div>
        </div>

        <div class="stat-card">
          <div class="stat-icon" style="background:#e8eaf6">
            <mat-icon style="color:#283593">savings</mat-icon>
          </div>
          <div class="stat-label">Total Collected</div>
          <div class="stat-value">₹{{ stats.totalRevenue | number }}</div>
          <div class="stat-sub">all time</div>
        </div>
      </div>

      <div class="two-col">
        <!-- Due This Month -->
        <div class="table-card">
          <div class="card-header">
            <h3><mat-icon>notifications_active</mat-icon> Due This Month</h3>
            <a routerLink="/reminders" class="see-all">See all →</a>
          </div>

          <div *ngIf="dueCustomers.length === 0" class="empty-state" style="padding:30px">
            <mat-icon>check_circle</mat-icon>
            <h4>All clear!</h4>
            <p>No pending dues this month.</p>
          </div>

          <div class="due-list" *ngIf="dueCustomers.length > 0">
            <div class="due-item" *ngFor="let c of dueCustomers.slice(0, 6)">
              <div class="due-avatar">{{ c.name[0] }}</div>
              <div class="due-info">
                <strong>{{ c.name }}</strong>
                <span>{{ c.area }} · ₹{{ c.monthlyRent }}</span>
              </div>
              <button class="wa-btn" (click)="sendReminder(c)" title="Send WhatsApp Reminder">
                <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" width="18" alt="WhatsApp" />
              </button>
            </div>
          </div>
        </div>

        <!-- Recent Services -->
        <div class="table-card">
          <div class="card-header">
            <h3><mat-icon>build</mat-icon> Recent Services</h3>
            <a routerLink="/services" class="see-all">See all →</a>
          </div>

          <div *ngIf="recentServices.length === 0" class="empty-state" style="padding:30px">
            <mat-icon>build_circle</mat-icon>
            <h4>No services yet</h4>
            <p>Service records will appear here.</p>
          </div>

          <div class="service-list" *ngIf="recentServices.length > 0">
            <div class="service-item" *ngFor="let s of recentServices">
              <div class="service-icon">
                <mat-icon>{{ getServiceIcon(s.serviceType) }}</mat-icon>
              </div>
              <div class="service-info">
                <strong>{{ s.customerName || 'Customer' }}</strong>
                <span>{{ s.serviceType | titlecase }} · {{ s.serviceDate | date:'dd MMM' }}</span>
              </div>
              <span class="chip chip-info">{{ s.technicianName }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;

      @media (max-width: 900px) { grid-template-columns: 1fr; }
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 20px 12px;
      border-bottom: 1px solid var(--border);

      h3 {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.95rem;
        font-weight: 700;
        mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--brand-primary); }
      }

      .see-all {
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--brand-primary);
      }
    }

    .due-list, .service-list {
      padding: 8px 0;
    }

    .due-item, .service-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 20px;
      transition: background 0.15s;
      &:hover { background: var(--bg-base); }
    }

    .due-avatar {
      width: 36px; height: 36px;
      border-radius: 50%;
      background: var(--brand-light);
      color: var(--brand-dark);
      display: flex; align-items: center; justify-content: center;
      font-weight: 700;
      font-size: 0.9rem;
      flex-shrink: 0;
    }

    .due-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 1px;
      strong { font-size: 0.88rem; }
      span   { font-size: 0.77rem; color: var(--text-secondary); }
    }

    .wa-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 6px;
      border-radius: 6px;
      display: flex; align-items: center;
      transition: background 0.15s;
      &:hover { background: #e8f5e9; }
    }

    .service-icon {
      width: 36px; height: 36px;
      border-radius: 8px;
      background: var(--bg-base);
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--brand-primary); }
    }

    .service-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      strong { font-size: 0.88rem; }
      span   { font-size: 0.77rem; color: var(--text-secondary); }
    }
  `]
})
export class DashboardComponent implements OnInit {
  stats = { total: 0, active: 0, inactive: 0, overdue: 0, totalRevenue: 0, monthlyRevenue: 0 };
  serviceStats = { total: 0, thisMonth: 0, upcoming: 0 };
  dueCustomers: Customer[] = [];
  recentServices: ServiceRecord[] = [];

  constructor(
    private customerSvc: CustomerService,
    private serviceSvc:  ServiceRecordService,
    private waSvc:       WhatsappService
  ) {}

  ngOnInit(): void {
    this.customerSvc.getStats().subscribe(s => this.stats = s);
    this.customerSvc.getDueThisMonth().subscribe(c => this.dueCustomers = c);
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
}
