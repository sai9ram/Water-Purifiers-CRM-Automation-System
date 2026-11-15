import { AfterViewInit, Component, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { CustomerComplaintService } from '../../core/services/customer-complaint.service';
import { CustomerService } from '../../core/services/customer.service';
import { ServiceRecordService } from '../../core/services/service-record.service';
import { TechnicianService } from '../../core/services/technician.service';
import { RealtimeCrmService } from '../../core/services/realtime-crm.service';
import { CustomerComplaint, Customer } from '../../core/models/models';
import { CustomerComplaintDialogComponent } from '../customers/customer-complaint-dialog.component';
import { ComplaintCommentsDialogComponent } from './complaint-comments-dialog.component';

type ComplaintRow = CustomerComplaint & { customerName: string; customerArea: string; customerPhone: string };

@Component({
  selector: 'app-complaints',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
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
    MatSnackBarModule,
    MatDialogModule,
    MatTooltipModule
  ],
  template: `
    <div class="page-container fade-in">
      <div class="page-header">
        <div>
          <h2>Customer Complaints & Live WhatsApp Issues</h2>
          <p class="subtitle">Customer WhatsApp complaints appear here in real time with Ticket IDs — click "Admit & Assign Fix" to approve and dispatch a technician immediately.</p>
        </div>
        <button mat-raised-button color="primary" (click)="openAddComplaintDialog()">
          <mat-icon>report_problem</mat-icon> Report New Issue
        </button>
      </div>

      <!-- Real-Time Incoming WhatsApp Complaint Webhook Simulator / Live Feed Banner -->
      <div class="wa-webhook-card">
        <div class="wa-webhook-title">
          <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" width="16" height="16" alt="WA" />
          <strong>Live Customer WhatsApp Complaint Webhook (Real-Time Test & Receiver)</strong>
          <span class="webhook-url-tag">POST /api/v1/crm/webhooks/whatsapp</span>
        </div>
        <div class="wa-webhook-controls">
          <mat-form-field appearance="outline" class="wa-cust-select">
            <mat-label>Customer Sending WhatsApp</mat-label>
            <mat-select [(ngModel)]="simCustomerId">
              @for (c of customers; track c.id) {
                <mat-option [value]="c.id">{{ c.name }} ({{ c.phone }})</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="wa-msg-input">
            <mat-label>Customer's WhatsApp Complaint Message</mat-label>
            <input
              matInput
              [(ngModel)]="simMessage"
              placeholder="e.g. Water is leaking from the RO filter pipe, please send technician urgently" />
          </mat-form-field>

          <button
            mat-raised-button
            color="primary"
            class="wa-send-sim-btn"
            [disabled]="sendingSim || !simMessage.trim()"
            (click)="simulateWhatsAppComplaint()">
            <mat-icon>bolt</mat-icon>
            <span>{{ sendingSim ? 'Receiving...' : 'Receive WhatsApp Complaint Now' }}</span>
          </button>
        </div>
      </div>

      <div class="search-bar">
        <mat-form-field appearance="outline" style="flex:1">
          <mat-label>Search by Ticket ID (e.g. CMP-1001), customer, area, or complaint</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput [(ngModel)]="searchQuery" (ngModelChange)="applyFilter()" />
        </mat-form-field>
      </div>

      <div class="table-card">
        <table mat-table [dataSource]="dataSource" matSort>

          <ng-container matColumnDef="ticketId">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Ticket</th>
            <td mat-cell *matCellDef="let row">
              <span class="ticket-badge">{{ row.ticketId || ('CMP-' + (1000 + (row.id || 1))) }}</span>
              @if (row.source === 'whatsapp') {
                <span class="source-wa-chip">WhatsApp</span>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="customerName">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Customer</th>
            <td mat-cell *matCellDef="let row">
              <strong>{{ row.customerName }}</strong>
              <div class="sub-cell-text">{{ row.customerPhone }} · {{ row.customerArea }}</div>
            </td>
          </ng-container>

          <ng-container matColumnDef="complaint">
            <th mat-header-cell *matHeaderCellDef>Complaint Message</th>
            <td mat-cell *matCellDef="let row">{{ row.complaint }}</td>
          </ng-container>

          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status & Technician</th>
            <td mat-cell *matCellDef="let row">
              @if (row.resolved) {
                <span class="status-tag resolved">Resolved ✓</span>
              } @else if (row.admissionStatus === 'ADMITTED') {
                <span class="status-tag admitted">Admitted · {{ row.assignedTechnician || 'Tech Assigned' }}</span>
              } @else {
                <span class="status-tag new-wa">New · Needs Admin Admission</span>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="createdAt">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Reported</th>
            <td mat-cell *matCellDef="let row">{{ row.createdAt | date:'dd MMM, hh:mm a' }}</td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>Admin Actions</th>
            <td mat-cell *matCellDef="let row">
              <div class="complaint-actions">
                @if (!row.resolved && row.admissionStatus !== 'ADMITTED') {
                  <button
                    type="button"
                    class="admit-fix-btn"
                    [disabled]="admittingId === row.id"
                    (click)="admitComplaintNow(row)"
                    matTooltip="Admit this complaint, auto-assign technician, schedule repair, and notify customer on WhatsApp">
                    <mat-icon>verified</mat-icon>
                    <span>{{ admittingId === row.id ? 'Admitting...' : 'Admit & Assign Fix' }}</span>
                  </button>
                }
                <button mat-icon-button color="primary" *ngIf="!row.resolved" (click)="scheduleService(row)" matTooltip="Open Repair Schedule">
                  <mat-icon>build_circle</mat-icon>
                </button>
                <button mat-icon-button color="accent" (click)="openComments(row)" matTooltip="View Comments">
                  <mat-icon>chat_bubble</mat-icon>
                </button>
                <button mat-icon-button color="primary" *ngIf="!row.resolved" (click)="resolveComplaint(row)" matTooltip="Mark Resolved">
                  <mat-icon>check_circle</mat-icon>
                </button>
                <button mat-icon-button color="accent" *ngIf="row.resolved" (click)="reopenComplaint(row)" matTooltip="Reopen">
                  <mat-icon>undo</mat-icon>
                </button>
                <button mat-icon-button color="warn" (click)="deleteComplaint(row)" matTooltip="Delete">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns;"></tr>
        </table>

        <div *ngIf="dataSource.filteredData.length === 0" class="empty-state">
          <mat-icon>report_problem</mat-icon>
          <h4>No complaints found</h4>
          <p>Incoming WhatsApp customer complaints will appear here automatically in real time.</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .wa-webhook-card {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 10px;
      padding: 10px 14px;
      margin-bottom: 14px;
    }
    .wa-webhook-title {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      font-size: 0.76rem;
      color: #166534;
    }
    .webhook-url-tag {
      margin-left: auto;
      font-family: monospace;
      font-size: 0.68rem;
      background: #dcfce7;
      color: #15803d;
      padding: 2px 8px;
      border-radius: 999px;
      font-weight: 700;
    }
    .wa-webhook-controls {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .wa-cust-select {
      flex: 1 1 200px;
      min-width: 180px;
    }
    .wa-msg-input {
      flex: 2 1 320px;
      min-width: 240px;
    }
    .wa-send-sim-btn {
      height: 34px !important;
      font-size: 0.74rem !important;
      font-weight: 700 !important;
      border-radius: 8px !important;
      background: #16a34a !important;
      color: #fff !important;
    }
    .ticket-badge {
      font-family: monospace;
      font-size: 0.7rem;
      font-weight: 800;
      color: #0284c7;
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      padding: 2px 6px;
      border-radius: 4px;
      margin-right: 4px;
    }
    .source-wa-chip {
      font-size: 0.62rem;
      font-weight: 700;
      background: #dcfce7;
      color: #15803d;
      padding: 1px 6px;
      border-radius: 999px;
    }
    .sub-cell-text {
      font-size: 0.68rem;
      color: #64748b;
    }
    .status-tag {
      display: inline-block;
      font-size: 0.68rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 999px;
    }
    .status-tag.new-wa {
      background: #fef3c7;
      color: #b45309;
    }
    .status-tag.admitted {
      background: #dbeafe;
      color: #1d4ed8;
    }
    .status-tag.resolved {
      background: #dcfce7;
      color: #15803d;
    }
    .complaint-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .admit-fix-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      height: 28px;
      padding: 0 10px;
      border-radius: 999px;
      border: 1px solid #16a34a;
      background: #16a34a;
      color: #ffffff;
      font-size: 0.7rem;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s ease;
    }
    .admit-fix-btn:hover:not(:disabled) {
      background: #15803d;
    }
    .admit-fix-btn mat-icon {
      font-size: 13px;
      width: 13px;
      height: 13px;
    }
  `]
})
export class ComplaintsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  columns = ['ticketId', 'customerName', 'complaint', 'status', 'createdAt', 'actions'];
  dataSource = new MatTableDataSource<ComplaintRow>([]);
  allComplaints: ComplaintRow[] = [];
  customers: Customer[] = [];
  searchQuery = '';

  simCustomerId: number | null = null;
  simMessage = 'Water is leaking near the RO filter tap, please send technician urgently';
  sendingSim = false;
  admittingId: number | null = null;

  private complaintSvc = inject(CustomerComplaintService);
  private customerSvc = inject(CustomerService);
  private serviceSvc = inject(ServiceRecordService);
  private technicianSvc = inject(TechnicianService);
  private crm = inject(RealtimeCrmService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);
  private router = inject(Router);
  private subs = new Subscription();

  ngOnInit(): void {
    this.loadData();
    this.subs.add(
      this.crm.changes$.subscribe(() => {
        this.loadData();
      })
    );
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.dataSource.paginator = this.paginator;
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  loadData(): void {
    forkJoin({
      customers: this.customerSvc.getAll(),
      complaints: this.complaintSvc.getAll()
    }).subscribe(({ customers, complaints }) => {
      this.customers = customers;
      if (!this.simCustomerId && customers.length > 0) {
        this.simCustomerId = customers[0].id ?? null;
      }
      const customerMap = new Map<number, Customer>(customers.map(c => [Number(c.id), c]));
      this.allComplaints = complaints.map(complaint => {
        const customer = customerMap.get(Number(complaint.customerId));
        return {
          ...complaint,
          customerName: customer?.name ?? complaint.customerName ?? 'Unknown',
          customerArea: customer?.area ?? complaint.customerArea ?? '',
          customerPhone: customer?.phone ?? complaint.customerPhone ?? ''
        };
      });
      this.applyFilter();
    });
  }

  simulateWhatsAppComplaint(): void {
    if (!this.simMessage.trim() || this.sendingSim) return;
    this.sendingSim = true;
    const selectedCustomer = this.customers.find(c => Number(c.id) === Number(this.simCustomerId));

    this.crm
      .sendIncomingWhatsAppComplaint({
        customerId: selectedCustomer?.id,
        phone: selectedCustomer?.phone,
        customerName: selectedCustomer?.name,
        message: this.simMessage.trim()
      })
      .subscribe({
        next: res => {
          this.sendingSim = false;
          this.simMessage = '';
          this.loadData();
          this.snack.open(
            `Incoming WhatsApp Complaint received! Ticket ${res.ticketId} created & auto-reply sent to ${res.customer.name}.`,
            'OK',
            { duration: 4500 }
          );
        },
        error: () => {
          this.sendingSim = false;
          this.snack.open('Failed to process WhatsApp complaint webhook.', 'OK', { duration: 3000 });
        }
      });
  }

  admitComplaintNow(complaint: ComplaintRow): void {
    if (!complaint.id || this.admittingId) return;
    this.admittingId = complaint.id;

    this.crm.admitComplaintAndScheduleFix(complaint.id).subscribe({
      next: res => {
        this.admittingId = null;
        this.loadData();
        this.snack.open(
          `Admitted ${res.complaint.ticketId}! Technician ${res.complaint.assignedTechnician} assigned & customer notified on WhatsApp.`,
          'OK',
          { duration: 4500 }
        );
      },
      error: () => {
        this.admittingId = null;
        this.snack.open('Could not admit complaint.', 'OK', { duration: 3000 });
      }
    });
  }

  applyFilter(): void {
    let filtered = [...this.allComplaints];
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(
        row =>
          row.customerName.toLowerCase().includes(q) ||
          row.customerArea.toLowerCase().includes(q) ||
          row.complaint.toLowerCase().includes(q) ||
          (row.ticketId || '').toLowerCase().includes(q)
      );
    }
    this.dataSource.data = filtered;
  }

  openAddComplaintDialog(): void {
    const ref = this.dialog.open(CustomerComplaintDialogComponent, {
      width: '560px',
      data: {}
    });
    ref.afterClosed().subscribe(result => {
      if (result?.schedule && result.complaintId) {
        this.loadData();
        this.router.navigate(['/services'], {
          queryParams: {
            customerId: result.customerId,
            complaintId: result.complaintId,
            serviceType: 'repair'
          }
        });
      } else if (result) {
        this.loadData();
      }
    });
  }

  scheduleService(complaint: ComplaintRow): void {
    if (complaint.resolved) {
      this.snack.open('Resolved complaints cannot be scheduled.', 'OK', { duration: 3000 });
      return;
    }

    const tomorrow = this.getTomorrow();
    this.technicianSvc.getDefault().subscribe(defaultTech => {
      const technicianName = defaultTech?.name ?? 'Technician';
      this.serviceSvc
        .add({
          customerId: complaint.customerId,
          customerName: complaint.customerName,
          serviceType: 'repair',
          serviceDate: tomorrow,
          nextServiceDate: tomorrow,
          technicianName,
          partsReplaced: '',
          notes: `Scheduled from complaint ${complaint.ticketId || '#' + complaint.id}`,
          cost: 0,
          complaintId: complaint.id
        })
        .subscribe(() => {
          this.customerSvc.update(complaint.customerId, { nextServiceDate: tomorrow }).subscribe(() => {
            this.snack.open('Service scheduled with default technician', 'OK', { duration: 3000 });
            this.router.navigate(['/services']);
          });
        });
    });
  }

  openComments(complaint: ComplaintRow): void {
    if (!complaint.id) {
      return;
    }

    this.dialog.open(ComplaintCommentsDialogComponent, {
      width: '560px',
      data: {
        complaintId: complaint.id,
        customerId: complaint.customerId,
        customerName: complaint.customerName,
        complaint: complaint.complaint,
        resolved: complaint.resolved
      }
    });
  }

  resolveComplaint(complaint: ComplaintRow): void {
    if (!complaint.id || complaint.resolved) {
      return;
    }

    if (!confirm('Mark this complaint as resolved?')) {
      return;
    }

    this.complaintSvc.update(complaint.id, { resolved: true, admissionStatus: 'RESOLVED' }).subscribe(() => {
      this.snack.open('Complaint marked as resolved', 'OK', { duration: 3000 });
      this.loadData();
    });
  }

  reopenComplaint(complaint: ComplaintRow): void {
    if (!complaint.id || !complaint.resolved) {
      return;
    }

    if (!confirm('Reopen this complaint?')) {
      return;
    }

    this.complaintSvc.update(complaint.id, { resolved: false, admissionStatus: 'NEW_WHATSAPP' }).subscribe(() => {
      this.snack.open('Complaint reopened', 'OK', { duration: 3000 });
      this.loadData();
    });
  }

  private getTomorrow(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }

  deleteComplaint(complaint: CustomerComplaint): void {
    if (!complaint.id || !confirm('Delete this complaint?')) return;
    this.complaintSvc.delete(complaint.id).subscribe(() => {
      this.snack.open('Complaint deleted', 'OK', { duration: 3000 });
      this.loadData();
    });
  }
}
