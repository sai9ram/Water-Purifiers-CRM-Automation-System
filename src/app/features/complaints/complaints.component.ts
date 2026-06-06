import { AfterViewInit, Component, inject, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
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
import { FormsModule } from '@angular/forms';
import { CustomerComplaintService } from '../../core/services/customer-complaint.service';
import { CustomerService } from '../../core/services/customer.service';
import { CustomerComplaint, Customer } from '../../core/models/models';
import { CustomerComplaintDialogComponent } from '../customers/customer-complaint-dialog.component';

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
    MatDialogModule
  ],
  template: `
    <div class="page-container fade-in">
      <div class="page-header">
        <div>
          <h2>Complaints</h2>
          <p class="subtitle">Track customer complaints and schedule follow-up service visits.</p>
        </div>
        <button mat-raised-button color="primary" (click)="openAddComplaintDialog()">
          <mat-icon>report_problem</mat-icon> Log Complaint
        </button>
      </div>

      <div class="search-bar">
        <mat-form-field appearance="outline" style="flex:1">
          <mat-label>Search customer or comment</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput [(ngModel)]="searchQuery" (ngModelChange)="applyFilter()" />
        </mat-form-field>
      </div>

      <div class="table-card">
        <table mat-table [dataSource]="dataSource" matSort>

          <ng-container matColumnDef="customerName">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Customer</th>
            <td mat-cell *matCellDef="let row">{{ row.customerName }}</td>
          </ng-container>

          <ng-container matColumnDef="area">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Area</th>
            <td mat-cell *matCellDef="let row">{{ row.customerArea }}</td>
          </ng-container>

          <ng-container matColumnDef="complaint">
            <th mat-header-cell *matHeaderCellDef>Complaint</th>
            <td mat-cell *matCellDef="let row">{{ row.complaint }}</td>
          </ng-container>

          <ng-container matColumnDef="createdAt">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Date</th>
            <td mat-cell *matCellDef="let row">{{ row.createdAt | date:'dd MMM yyyy' }}</td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let row">
              <button mat-icon-button color="primary" (click)="scheduleService(row)">
                <mat-icon>build_circle</mat-icon>
              </button>
              <button mat-icon-button color="warn" (click)="deleteComplaint(row)">
                <mat-icon>delete</mat-icon>
              </button>
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
  `
})
export class ComplaintsComponent implements OnInit, AfterViewInit {
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  columns = ['customerName', 'area', 'complaint', 'createdAt', 'actions'];
  dataSource = new MatTableDataSource<(CustomerComplaint & { customerName: string; customerArea: string })>([]);
  allComplaints: (CustomerComplaint & { customerName: string; customerArea: string })[] = [];
  customers: Customer[] = [];
  searchQuery = '';

  private complaintSvc = inject(CustomerComplaintService);
  private customerSvc = inject(CustomerService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);
  private router = inject(Router);

  ngOnInit(): void {
    this.loadData();
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.dataSource.paginator = this.paginator;
  }

  loadData(): void {
    this.customerSvc.getAll().subscribe(customers => {
      this.customers = customers;
      this.complaintSvc.getAll().subscribe(complaints => {
        this.allComplaints = complaints.map(complaint => {
          const customer = customers.find(c => c.id === complaint.customerId);
          return {
            ...complaint,
            customerName: customer?.name ?? 'Unknown',
            customerArea: customer?.area ?? ''
          };
        });
        this.applyFilter();
      });
    });
  }

  applyFilter(): void {
    let filtered = [...this.allComplaints];
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(row =>
        row.customerName.toLowerCase().includes(q) ||
        row.customerArea.toLowerCase().includes(q) ||
        row.complaint.toLowerCase().includes(q)
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

  scheduleService(complaint: CustomerComplaint & { customerName: string; customerArea: string }): void {
    this.router.navigate(['/services'], {
      queryParams: { customerId: complaint.customerId, complaintId: complaint.id, serviceType: 'repair' }
    });
  }

  deleteComplaint(complaint: CustomerComplaint): void {
    if (!complaint.id || !confirm('Delete this complaint?')) return;
    this.complaintSvc.delete(complaint.id).subscribe(() => {
      this.snack.open('Complaint deleted', 'OK', { duration: 3000 });
      this.loadData();
    });
  }
}
