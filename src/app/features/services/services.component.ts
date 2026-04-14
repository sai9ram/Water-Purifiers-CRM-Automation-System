import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
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
import { MatTooltipModule } from '@angular/material/tooltip';
import { ServiceRecordService } from '../../core/services/service-record.service';
import { CustomerService } from '../../core/services/customer.service';
import { ServiceRecord, Customer, SERVICE_TYPE_LABELS, ServiceType } from '../../core/models/models';

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatTableModule, MatSortModule, MatPaginatorModule,
    MatIconModule, MatButtonModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatDatepickerModule,
    MatNativeDateModule, MatSnackBarModule, MatTooltipModule
  ],
  template: `
    <div class="page-container fade-in">
      <div class="page-header">
        <div>
          <h2>Service Records</h2>
          <p class="subtitle">Track all service visits and maintenance</p>
        </div>
        <button mat-raised-button color="primary" (click)="showForm = !showForm">
          <mat-icon>{{ showForm ? 'close' : 'add' }}</mat-icon>
          {{ showForm ? 'Cancel' : 'Log Service' }}
        </button>
      </div>

      <!-- Add Service Form -->
      <div class="form-panel" *ngIf="showForm">
        <h3 style="margin-bottom:18px">Log New Service Visit</h3>
        <form [formGroup]="form">
          <div class="form-grid">
            <mat-form-field appearance="outline">
              <mat-label>Customer *</mat-label>
              <mat-select formControlName="customerId" (selectionChange)="onCustomerSelect($event.value)">
                <mat-option *ngFor="let c of customers" [value]="c.id">{{ c.name }} — {{ c.area }}</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Service Type *</mat-label>
              <mat-select formControlName="serviceType">
                <mat-option value="filter-change">Filter Change</mat-option>
                <mat-option value="repair">Repair</mat-option>
                <mat-option value="installation">Installation</mat-option>
                <mat-option value="general-service">General Service</mat-option>
                <mat-option value="demo">Demo</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Service Date *</mat-label>
              <input matInput [matDatepicker]="sp" formControlName="serviceDate" />
              <mat-datepicker-toggle matSuffix [for]="sp"></mat-datepicker-toggle>
              <mat-datepicker #sp></mat-datepicker>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Technician Name *</mat-label>
              <input matInput formControlName="technicianName" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Parts Replaced</mat-label>
              <input matInput formControlName="partsReplaced" placeholder="e.g. Sediment + Carbon filter" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Cost (₹)</mat-label>
              <input matInput formControlName="cost" type="number" />
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline" style="width:100%">
            <mat-label>Notes</mat-label>
            <textarea matInput formControlName="notes" rows="2"></textarea>
          </mat-form-field>

          <div style="display:flex; justify-content:flex-end; margin-top:8px">
            <button mat-raised-button color="primary" (click)="addService()" [disabled]="form.invalid">
              <mat-icon>save</mat-icon> Save Service Record
            </button>
          </div>
        </form>
      </div>

      <!-- Search -->
      <div class="search-bar">
        <mat-form-field appearance="outline">
          <mat-label>Search by customer, technician...</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput [(ngModel)]="searchQuery" (ngModelChange)="applyFilter()" />
        </mat-form-field>

        <mat-form-field appearance="outline" style="max-width:180px">
          <mat-label>Service Type</mat-label>
          <mat-select [(ngModel)]="typeFilter" (ngModelChange)="applyFilter()">
            <mat-option value="">All Types</mat-option>
            <mat-option value="filter-change">Filter Change</mat-option>
            <mat-option value="repair">Repair</mat-option>
            <mat-option value="installation">Installation</mat-option>
            <mat-option value="general-service">General Service</mat-option>
            <mat-option value="demo">Demo</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      <!-- Table -->
      <div class="table-card">
        <table mat-table [dataSource]="dataSource" matSort>

          <ng-container matColumnDef="customerName">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Customer</th>
            <td mat-cell *matCellDef="let s">
              <div class="cust-cell">
                <div class="cust-av">{{ (s.customerName || 'C')[0] }}</div>
                <span>{{ s.customerName }}</span>
              </div>
            </td>
          </ng-container>

          <ng-container matColumnDef="serviceType">
            <th mat-header-cell *matHeaderCellDef>Type</th>
            <td mat-cell *matCellDef="let s">
              <div class="type-cell">
                <div class="type-dot" [style.background]="getServiceColor(s.serviceType)">
                  <mat-icon>{{ getServiceIcon(s.serviceType) }}</mat-icon>
                </div>
                <span>{{ getServiceLabel(s.serviceType) }}</span>
              </div>
            </td>
          </ng-container>

          <ng-container matColumnDef="serviceDate">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Date</th>
            <td mat-cell *matCellDef="let s">{{ s.serviceDate | date:'dd MMM yyyy' }}</td>
          </ng-container>

          <ng-container matColumnDef="technicianName">
            <th mat-header-cell *matHeaderCellDef>Technician</th>
            <td mat-cell *matCellDef="let s">{{ s.technicianName }}</td>
          </ng-container>

          <ng-container matColumnDef="partsReplaced">
            <th mat-header-cell *matHeaderCellDef>Parts</th>
            <td mat-cell *matCellDef="let s">
              <span *ngIf="s.partsReplaced" class="chip chip-info" style="font-size:0.72rem">{{ s.partsReplaced }}</span>
              <span *ngIf="!s.partsReplaced" style="color:var(--text-muted)">—</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="cost">
            <th mat-header-cell *matHeaderCellDef>Cost</th>
            <td mat-cell *matCellDef="let s">
              <span *ngIf="s.cost" style="font-weight:600; color:var(--brand-dark)">₹{{ s.cost }}</span>
              <span *ngIf="!s.cost" style="color:var(--text-muted)">—</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let s">
              <button mat-icon-button color="warn" matTooltip="Delete" (click)="deleteRecord(s)">
                <mat-icon>delete</mat-icon>
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns;"></tr>
        </table>

        <div *ngIf="dataSource.filteredData.length === 0" class="empty-state">
          <mat-icon>build_circle</mat-icon>
          <h4>No service records found</h4>
          <p>Log a service visit to get started.</p>
        </div>

        <mat-paginator [pageSizeOptions]="[10, 25, 50]" showFirstLastButtons></mat-paginator>
      </div>
    </div>
  `,
  styles: [`
    .form-panel {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: var(--shadow-sm);
    }
    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 12px;
      margin-bottom: 8px;
    }
    .cust-cell { display: flex; align-items: center; gap: 10px; }
    .cust-av {
      width: 30px; height: 30px; border-radius: 50%;
      background: var(--brand-light); color: var(--brand-dark);
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 0.8rem; flex-shrink: 0;
    }
    .type-cell { display: flex; align-items: center; gap: 8px; }
    .type-dot {
      width: 28px; height: 28px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      mat-icon { font-size: 14px; width: 14px; height: 14px; color: white; }
    }
  `]
})
export class ServicesComponent implements OnInit {
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  columns = ['customerName', 'serviceType', 'serviceDate', 'technicianName', 'partsReplaced', 'cost', 'actions'];
  dataSource = new MatTableDataSource<ServiceRecord>([]);
  allRecords: ServiceRecord[] = [];
  customers: Customer[] = [];
  showForm = false;
  searchQuery = '';
  typeFilter = '';
  form!: FormGroup;

  constructor(
    private serviceSvc: ServiceRecordService,
    private customerSvc: CustomerService,
    private fb: FormBuilder,
    private snack: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadData();
    this.initForm();
  }

  ngAfterViewInit(): void {
    this.dataSource.sort      = this.sort;
    this.dataSource.paginator = this.paginator;
  }

  initForm(): void {
    this.form = this.fb.group({
      customerId:     [null, Validators.required],
      serviceType:    ['filter-change', Validators.required],
      serviceDate:    [new Date(), Validators.required],
      technicianName: ['', Validators.required],
      partsReplaced:  [''],
      notes:          [''],
      cost:           [0]
    });
  }

  loadData(): void {
    this.serviceSvc.getAll().subscribe(r => {
      this.allRecords    = r;
      this.dataSource.data = r;
    });
    this.customerSvc.getAll().subscribe(c => this.customers = c);
  }

  onCustomerSelect(id: number): void {
    const c = this.customers.find(x => x.id === id);
    if (c) this.form.patchValue({ customerName: c.name });
  }

  applyFilter(): void {
    let filtered = [...this.allRecords];
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        (r.customerName || '').toLowerCase().includes(q) ||
        r.technicianName.toLowerCase().includes(q)
      );
    }
    if (this.typeFilter) filtered = filtered.filter(r => r.serviceType === this.typeFilter);
    this.dataSource.data = filtered;
  }

  addService(): void {
    if (this.form.invalid) return;
    const val = this.form.value;
    const customer = this.customers.find(c => c.id === val.customerId);
    this.serviceSvc.add({ ...val, customerName: customer?.name ?? '' }).subscribe(() => {
      this.snack.open('Service logged!', 'OK', { duration: 3000 });
      this.showForm = false;
      this.loadData();
      this.initForm();
    });
  }

  deleteRecord(s: ServiceRecord): void {
    if (!confirm('Delete this record?')) return;
    this.serviceSvc.delete(s.id!).subscribe(() => {
      this.snack.open('Deleted', 'OK', { duration: 2000 });
      this.loadData();
    });
  }

  getServiceIcon(type: string): string {
    const m: Record<string, string> = {
      'filter-change': 'filter_alt', 'repair': 'handyman',
      'installation': 'plumbing', 'general-service': 'build', 'demo': 'play_circle'
    };
    return m[type] ?? 'build';
  }

  getServiceColor(type: string): string {
    const m: Record<string, string> = {
      'filter-change': '#0097a7', 'repair': '#e53935',
      'installation': '#43a047', 'general-service': '#7b1fa2', 'demo': '#1565c0'
    };
    return m[type] ?? '#757575';
  }

  getServiceLabel(type: string): string {
    return SERVICE_TYPE_LABELS[type as ServiceType] ?? type;
  }
}
