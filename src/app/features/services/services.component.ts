import { AfterViewInit, Component, inject, OnInit, ViewChild } from '@angular/core';
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
  templateUrl: './services.component.html',
  styleUrl: './services.component.scss'
})
export class ServicesComponent implements OnInit, AfterViewInit {
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  columns = ['customerName', 'serviceType', 'serviceDate', 'nextServiceDate', 'technicianName', 'partsReplaced', 'cost', 'actions'];
  dataSource = new MatTableDataSource<ServiceRecord>([]);
  allRecords: ServiceRecord[] = [];
  upcomingCustomers: Customer[] = [];
  customers: Customer[] = [];
  showForm = false;
  searchQuery = '';
  typeFilter = '';
  form!: FormGroup;

  private serviceSvc = inject(ServiceRecordService);
  private customerSvc = inject(CustomerService);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);


  ngOnInit(): void {
    this.loadData();
    this.initForm();
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.dataSource.paginator = this.paginator;
  }

  initForm(): void {
    const lastService = new Date();
    const nextMaintenance = new Date(lastService);
    nextMaintenance.setMonth(nextMaintenance.getMonth() + 3);

    this.form = this.fb.group({
      customerId: [null, Validators.required],
      serviceType: ['filter-change', Validators.required],
      serviceDate: [new Date(), Validators.required],
      nextServiceDate: [nextMaintenance],
      technicianName: ['', Validators.required],
      partsReplaced: [''],
      notes: [''],
      cost: [0]
    });
  }

  loadData(): void {
    this.serviceSvc.getAll().subscribe(r => {
      this.allRecords = r;
      this.applyFilter();
    });
    this.customerSvc.getAll().subscribe(c => {
      this.customers = c;
      this.upcomingCustomers = [...c]
        .filter(customer => !!customer.nextServiceDate)
        .sort((a, b) => new Date(a.nextServiceDate!).getTime() - new Date(b.nextServiceDate!).getTime());
    });
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
      if (customer?.id) {
        this.customerSvc.update(customer.id, {
          lastServiceDate: new Date(val.serviceDate),
          nextServiceDate: val.nextServiceDate ? new Date(val.nextServiceDate) : undefined
        }).subscribe(() => this.loadData());
      }
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

  onServiceDateChange(date: Date | null): void {
    if (!date) return;
    const next = new Date(date);
    next.setMonth(next.getMonth() + 3);
    this.form.patchValue({ nextServiceDate: next });
  }

  getCustomerName(customerId: number): string {
    return this.customers.find(customer => customer.id === customerId)?.name ?? 'Customer';
  }

  getCustomerArea(customerId: number): string {
    return this.customers.find(customer => customer.id === customerId)?.area ?? '';
  }

  getScheduleClass(date?: Date): string {
    if (!date) return 'chip chip-muted';

    const target = new Date(date);
    target.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
    if (diffDays < 0) return 'chip chip-danger';
    if (diffDays <= 7) return 'chip chip-warning';
    return 'chip chip-success';
  }
}
