import { AfterViewInit, Component, inject, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { RouterLink } from '@angular/router';
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
import { TechnicianService } from '../../core/services/technician.service';
import { ServiceRecord, Customer, Technician, SERVICE_TYPE_LABELS, ServiceType } from '../../core/models/models';

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, RouterLink,
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
  technicians: Technician[] = [];
  showForm = false;
  searchQuery = '';
  typeFilter = '';
  maintenanceFilter: 'this-month' | 'last-month' | 'next-month' | 'custom' = 'this-month';
  maintenanceFrom: Date | null = null;
  maintenanceTo: Date | null = null;
  requestCustomerId: number | null = null;
  requestComplaintId: number | null = null;
  requestServiceType: string | null = null;
  form!: FormGroup;

  private serviceSvc = inject(ServiceRecordService);
  private customerSvc = inject(CustomerService);
  private technicianSvc = inject(TechnicianService);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  private route = inject(ActivatedRoute);


  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const filter = params.get('maintenanceFilter');
      if (filter === 'this-month' || filter === 'last-month' || filter === 'next-month' || filter === 'custom') {
        this.setMaintenanceRange(filter);
        this.upcomingCustomers = this.getFilteredUpcomingCustomers(this.customers);
      }

      this.requestCustomerId = params.get('customerId') ? Number(params.get('customerId')) : null;
      this.requestComplaintId = params.get('complaintId') ? Number(params.get('complaintId')) : null;
      this.requestServiceType = params.get('serviceType');
      if (this.requestServiceType === 'repair') {
        this.showForm = true;
      }
    });
    this.initForm();
    this.loadData();
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
      cost: [0],
      complaintId: [null]
    });
  }

  loadData(): void {
    this.loadTechnicians();
    this.serviceSvc.getAll().subscribe(r => {
      this.allRecords = r;
      this.applyFilter();
    });
    this.customerSvc.getAll().subscribe(c => {
      this.customers = c;
      this.setMaintenanceRange(this.maintenanceFilter);
      this.upcomingCustomers = this.getFilteredUpcomingCustomers(c);
      this.patchRequestedService();
    });
  }

  private loadTechnicians(): void {
    this.technicianSvc.getAll().subscribe(t => this.technicians = t);
    this.technicianSvc.getDefault().subscribe(defaultTech => {
      if (defaultTech && this.form && !this.form.value.technicianName) {
        this.form.patchValue({ technicianName: defaultTech.name });
      }
    });
  }

  onCustomerSelect(id: number): void {
    const c = this.customers.find(x => x.id === id);
    if (c) this.form.patchValue({ customerName: c.name });
  }

  private patchRequestedService(): void {
    if (this.requestCustomerId) {
      this.form.patchValue({ customerId: this.requestCustomerId });
      const customer = this.customers.find(x => x.id === this.requestCustomerId);
      if (customer) {
        this.form.patchValue({ customerName: customer.name });
      }
    }
    if (this.requestComplaintId) {
      this.form.patchValue({ complaintId: this.requestComplaintId });
    }
    if (this.requestServiceType === 'repair') {
      this.form.patchValue({ serviceType: 'repair' });
    }
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

  isComplaintService(record: ServiceRecord): boolean {
    return !!record.complaintId;
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

  onMaintenanceFilterChange(filter: 'this-month' | 'last-month' | 'next-month' | 'custom'): void {
    this.setMaintenanceRange(filter);
    this.upcomingCustomers = this.getFilteredUpcomingCustomers(this.customers);
  }

  onMaintenanceDateChange(): void {
    this.upcomingCustomers = this.getFilteredUpcomingCustomers(this.customers);
  }

  private getFilteredUpcomingCustomers(customers: Customer[]): Customer[] {
    const { from, to } = this.getMaintenanceDateBounds();

    return [...customers]
      .filter(customer => {
        if (!customer.nextServiceDate) return false;

        const nextServiceDate = new Date(customer.nextServiceDate);
        nextServiceDate.setHours(0, 0, 0, 0);

        if (from && nextServiceDate < from) return false;
        if (to && nextServiceDate > to) return false;
        return true;
      })
      .sort((a, b) => new Date(a.nextServiceDate!).getTime() - new Date(b.nextServiceDate!).getTime());
  }

  private setMaintenanceRange(filter: 'this-month' | 'last-month' | 'next-month' | 'custom'): void {
    this.maintenanceFilter = filter;
    if (filter === 'custom') return;

    const today = new Date();
    const monthDate = new Date(today.getFullYear(), today.getMonth(), 1);

    if (filter === 'last-month') {
      monthDate.setMonth(monthDate.getMonth() - 1);
    } else if (filter === 'next-month') {
      monthDate.setMonth(monthDate.getMonth() + 1);
    }

    this.maintenanceFrom = this.startOfDay(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1));
    this.maintenanceTo = this.endOfDay(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0));
  }

  private getMaintenanceDateBounds(): { from: Date | null; to: Date | null } {
    return {
      from: this.maintenanceFrom ? this.startOfDay(this.maintenanceFrom) : null,
      to: this.maintenanceTo ? this.endOfDay(this.maintenanceTo) : null
    };
  }

  private startOfDay(date: Date): Date {
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    return value;
  }

  private endOfDay(date: Date): Date {
    const value = new Date(date);
    value.setHours(23, 59, 59, 999);
    return value;
  }
}
