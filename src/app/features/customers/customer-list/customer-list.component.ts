import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { CustomerService } from '../../../core/services/customer.service';
import { PlanService } from '../../../core/services/plan.service';
import { WhatsappService } from '../../../core/services/whatsapp.service';
import { Customer, RentalPlan, PURIFIER_MODELS, CustomerStatus } from '../../../core/models/models';
import { CustomerFormDialogComponent } from '../customer-form-dialog/customer-form-dialog.component';

@Component({
  selector: 'app-customer-list',
  standalone: true,
  imports: [
    CommonModule, RouterLink, FormsModule, ReactiveFormsModule,
    MatTableModule, MatSortModule, MatPaginatorModule,
    MatIconModule, MatButtonModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatDatepickerModule, MatNativeDateModule, MatSnackBarModule,
    MatTooltipModule, MatChipsModule
  ],
  template: `
    <div class="page-container fade-in">
      <div class="page-header">
        <div>
          <h2>Customers</h2>
          <p class="subtitle">{{ dataSource.filteredData.length }} of {{ allCustomers.length }} customers</p>
        </div>
        <button mat-raised-button color="primary" (click)="openAddDialog()">
          <mat-icon>person_add</mat-icon> Add Customer
        </button>
      </div>

      <!-- Filters -->
      <div class="search-bar">
        <mat-form-field appearance="outline">
          <mat-label>Search by name, phone, area...</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput [(ngModel)]="searchQuery" (ngModelChange)="applyFilter()" />
          <button *ngIf="searchQuery" matSuffix mat-icon-button (click)="searchQuery=''; applyFilter()">
            <mat-icon>close</mat-icon>
          </button>
        </mat-form-field>

        <mat-form-field appearance="outline" style="max-width:160px">
          <mat-label>Status</mat-label>
          <mat-select [(ngModel)]="statusFilter" (ngModelChange)="applyFilter()">
            <mat-option value="">All</mat-option>
            <mat-option value="active">Active</mat-option>
            <mat-option value="overdue">Overdue</mat-option>
            <mat-option value="inactive">Inactive</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" style="max-width:160px">
          <mat-label>Plan</mat-label>
          <mat-select [(ngModel)]="planFilter" (ngModelChange)="applyFilter()">
            <mat-option value="">All Plans</mat-option>
            <mat-option *ngFor="let p of plans" [value]="p.id">{{ p.name }}</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      <!-- Table -->
      <div class="table-card">
        <table mat-table [dataSource]="dataSource" matSort>

          <!-- Name -->
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Customer</th>
            <td mat-cell *matCellDef="let c">
              <div class="customer-cell">
                <div class="avatar">{{ c.name[0] }}</div>
                <div>
                  <div class="cust-name">{{ c.name }}</div>
                  <div class="cust-sub">{{ c.phone }}</div>
                </div>
              </div>
            </td>
          </ng-container>

          <!-- Area -->
          <ng-container matColumnDef="area">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Area</th>
            <td mat-cell *matCellDef="let c">{{ c.area }}</td>
          </ng-container>

          <!-- Model -->
          <ng-container matColumnDef="purifierModel">
            <th mat-header-cell *matHeaderCellDef>Purifier Model</th>
            <td mat-cell *matCellDef="let c">
              <span class="chip chip-info">{{ c.purifierModel }}</span>
            </td>
          </ng-container>

          <!-- Plan -->
          <ng-container matColumnDef="planName">
            <th mat-header-cell *matHeaderCellDef>Plan / Rent</th>
            <td mat-cell *matCellDef="let c">
              <div class="plan-cell">
                <span>{{ c.planName }}</span>
                <span class="rent">₹{{ c.monthlyRent }}/mo</span>
              </div>
            </td>
          </ng-container>

          <!-- Next Due -->
          <ng-container matColumnDef="nextDueDate">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Next Due</th>
            <td mat-cell *matCellDef="let c">
              <span [class]="getDueDateClass(c.nextDueDate)">
                {{ c.nextDueDate | date:'dd MMM yyyy' }}
              </span>
            </td>
          </ng-container>

          <!-- Status -->
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let c">
              <span [class]="getStatusChip(c.status)">{{ c.status | titlecase }}</span>
            </td>
          </ng-container>

          <!-- Actions -->
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>Actions</th>
            <td mat-cell *matCellDef="let c" (click)="$event.stopPropagation()">
              <div class="actions-cell">
                <button mat-icon-button matTooltip="WhatsApp Reminder"
                  (click)="sendReminder(c)" class="wa-icon-btn">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" width="18" alt="WA" />
                </button>
                <button mat-icon-button matTooltip="Edit" (click)="openEditDialog(c)">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button matTooltip="Delete" color="warn" (click)="deleteCustomer(c)">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"
              [routerLink]="['/customers', row.id]"></tr>
        </table>

        <div *ngIf="dataSource.filteredData.length === 0" class="empty-state">
          <mat-icon>person_off</mat-icon>
          <h4>No customers found</h4>
          <p>Try adjusting your filters or add a new customer.</p>
        </div>

        <mat-paginator [pageSizeOptions]="[10, 25, 50]" showFirstLastButtons></mat-paginator>
      </div>
    </div>
  `,
  styles: [`
    .customer-cell {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 4px 0;
    }
    .avatar {
      width: 34px; height: 34px;
      border-radius: 50%;
      background: var(--brand-light);
      color: var(--brand-dark);
      display: flex; align-items: center; justify-content: center;
      font-weight: 700;
      font-size: 0.85rem;
      flex-shrink: 0;
    }
    .cust-name { font-weight: 600; font-size: 0.88rem; }
    .cust-sub  { font-size: 0.76rem; color: var(--text-secondary); }
    .plan-cell { display: flex; flex-direction: column; }
    .rent      { font-size: 0.76rem; color: var(--brand-primary); font-weight: 600; }
    .actions-cell { display: flex; gap: 4px; align-items: center; }
    .wa-icon-btn { display: flex; align-items: center; justify-content: center; }
    .due-overdue { color: var(--danger); font-weight: 600; font-size: 0.83rem; }
    .due-soon    { color: var(--warning); font-weight: 600; font-size: 0.83rem; }
    .due-ok      { color: var(--text-secondary); font-size: 0.83rem; }
  `]
})
export class CustomerListComponent implements OnInit {
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  displayedColumns = ['name', 'area', 'purifierModel', 'planName', 'nextDueDate', 'status', 'actions'];
  dataSource = new MatTableDataSource<Customer>([]);
  allCustomers: Customer[] = [];
  plans: RentalPlan[] = [];
  searchQuery = '';
  statusFilter = '';
  planFilter: number | '' = '';

  constructor(
    private customerSvc: CustomerService,
    private planSvc: PlanService,
    private waSvc: WhatsappService,
    private dialog: MatDialog,
    private snack: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadPlans();
    this.loadCustomers();
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.dataSource.paginator = this.paginator;
  }

  loadCustomers(): void {
    this.customerSvc.getAll().subscribe(customers => {
      this.allCustomers = customers;
      this.dataSource.data = customers;
      this.applyFilter();
    });
  }

  loadPlans(): void {
    this.planSvc.getAll().subscribe(p => this.plans = p);
  }

  applyFilter(): void {
    let filtered = [...this.allCustomers];
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.area.toLowerCase().includes(q) ||
        (c.purifierModel || '').toLowerCase().includes(q)
      );
    }
    if (this.statusFilter) {
      filtered = filtered.filter(c => c.status === this.statusFilter);
    }
    if (this.planFilter !== '') {
      filtered = filtered.filter(c => c.planId === this.planFilter);
    }
    this.dataSource.data = filtered;
  }

  openAddDialog(): void {
    const ref = this.dialog.open(CustomerFormDialogComponent, {
      width: '560px',
      data: { customer: null, plans: this.plans }
    });
    ref.afterClosed().subscribe(result => {
      if (result) { this.loadCustomers(); }
    });
  }

  openEditDialog(customer: Customer): void {
    const ref = this.dialog.open(CustomerFormDialogComponent, {
      width: '560px',
      data: { customer, plans: this.plans }
    });
    ref.afterClosed().subscribe(result => {
      if (result) { this.loadCustomers(); }
    });
  }

  deleteCustomer(c: Customer): void {
    if (!confirm(`Delete ${c.name}? This cannot be undone.`)) return;
    this.customerSvc.delete(c.id!).subscribe(() => {
      this.snack.open('Customer deleted', 'OK', { duration: 3000 });
      this.loadCustomers();
    });
  }

  sendReminder(c: Customer): void {
    this.waSvc.sendRentReminder(c);
  }

  getStatusChip(status: CustomerStatus): string {
    return { active: 'chip chip-success', overdue: 'chip chip-danger', inactive: 'chip chip-muted' }[status] ?? 'chip';
  }

  getDueDateClass(date: Date): string {
    const d = new Date(date);
    const today = new Date();
    const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
    if (diff < 0)  return 'due-overdue';
    if (diff <= 5) return 'due-soon';
    return 'due-ok';
  }
}
