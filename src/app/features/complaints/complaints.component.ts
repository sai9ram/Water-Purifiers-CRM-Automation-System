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
          <h2>Customer Complaints & Issues</h2>
          <p class="subtitle">See problems reported by customers and assign technicians</p>
        </div>
        <button mat-raised-button color="primary" (click)="openAddComplaintDialog()">
          <mat-icon>report_problem</mat-icon> Report New Issue
        </button>
      </div>

      <div class="search-bar">
        <mat-form-field appearance="outline" style="flex:1">
          <mat-label>Search customer, ticket ID, or complaint</mat-label>
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
              <div class="sub-cell-text">{{ row.customerArea }}</div>
            </td>
          </ng-container>

          <ng-container matColumnDef="complaint">
            <th mat-header-cell *matHeaderCellDef>Complaint</th>
            <td mat-cell *matCellDef="let row">{{ row.complaint }}</td>
          </ng-container>

          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let row">
              @if (row.resolved) {
                <span class="status-tag resolved">Resolved</span>
              } @else if (row.admissionStatus === 'ADMITTED') {
                <span class="status-tag admitted">Admitted · {{ row.assignedTechnician || 'Assigned' }}</span>
              } @else {
                <span class="status-tag new-wa">Open</span>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="createdAt">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Date</th>
            <td mat-cell *matCellDef="let row">{{ row.createdAt | date:'dd MMM yyyy' }}</td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let row">
              <div class="complaint-actions">
                @if (!row.resolved && row.admissionStatus !== 'ADMITTED') {
                  <button
                    type="button"
                    class="admit-fix-btn"
                    [disabled]="admittingId === row.id"
                    (click)="admitComplaintNow(row)"
                    matTooltip="Admit complaint & assign technician">
                    <mat-icon>verified</mat-icon>
                    <span>{{ admittingId === row.id ? 'Admitting...' : 'Admit Fix' }}</span>
                  </button>
                }
                <button mat-icon-button color="primary" *ngIf="!row.resolved" (click)="scheduleService(row)" matTooltip="Schedule Service">
                  <mat-icon>build_circle</mat-icon>
                </button>
                <button mat-icon-button color="accent" (click)="openComments(row)" matTooltip="Comments">
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
          <p>Log a customer complaint to track follow-up service actions.</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
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
      height: 26px;
      padding: 0 9px;
      border-radius: 999px;
      border: 1px solid #16a34a;
      background: #16a34a;
      color: #ffffff;
      font-size: 0.68rem;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s ease;
    }
    .admit-fix-btn:hover:not(:disabled) {
      background: #15803d;
    }
    .admit-fix-btn mat-icon {
      font-size: 12px;
      width: 12px;
      height: 12px;
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

  admitComplaintNow(complaint: ComplaintRow): void {
    if (!complaint.id || this.admittingId) return;
    this.admittingId = complaint.id;

    this.crm.admitComplaintAndScheduleFix(complaint.id).subscribe({
      next: res => {
        this.admittingId = null;
        this.loadData();
        this.snack.open(
          `Complaint ${res.complaint.ticketId} admitted and assigned to ${res.complaint.assignedTechnician}`,
          'OK',
          { duration: 3500 }
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
