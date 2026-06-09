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
  formMode: 'log' | 'schedule' = 'log';
  scheduleMinDate = this.getTomorrow();
  searchQuery = '';
  typeFilter = '';
  maintenanceFilter: 'this-month' | 'last-month' | 'next-month' | 'custom' = 'this-month';
  maintenanceFrom: Date | null = null;
  maintenanceTo: Date | null = null;
  requestCustomerId: number | null = null;
  requestComplaintId: number | null = null;
  requestServiceType: string | null = null;
  form!: FormGroup;
  serviceTotalCost = 0;
  scheduledCompletionRecord: ServiceRecord | null = null;
  completionParts = '';
  completionCost = 0;
  completionNotes = '';

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
        this.openForm('schedule');
      } else {
        this.initForm();
      }
    });
    this.loadData();
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.dataSource.paginator = this.paginator;
  }

  initForm(mode: 'log' | 'schedule' = 'log'): void {
    this.formMode = mode;
    const today = new Date();
    const nextMaintenance = new Date(today);
    nextMaintenance.setMonth(nextMaintenance.getMonth() + 3);

    const serviceDate = mode === 'schedule' ? this.getTomorrow() : today;
    const nextServiceDate = mode === 'schedule' ? serviceDate : nextMaintenance;

    this.form = this.fb.group({
      customerId: [null, Validators.required],
      serviceType: ['filter-change', Validators.required],
      serviceDate: [serviceDate, Validators.required],
      nextServiceDate: [nextServiceDate],
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
      this.applyFilter();
    });
  }

  openForm(mode: 'log' | 'schedule'): void {
    this.showForm = true;
    this.initForm(mode);
  }

  private getTomorrow(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
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

    const { from, to } = this.getMaintenanceDateBounds();
    if (from || to) {
      filtered = filtered.filter(r => {
        const serviceDate = this.startOfDay(new Date(r.serviceDate));
        if (from && serviceDate < from) return false;
        if (to && serviceDate > to) return false;
        return true;
      });
    }

    this.serviceTotalCost = filtered.reduce((sum, record) => sum + (record.cost || 0), 0);
    this.dataSource.data = filtered;
  }

  addService(): void {
    if (this.form.invalid) return;
    const val = this.form.getRawValue();
    const serviceDate = new Date(val.serviceDate);
    const today = this.startOfDay(new Date());

    if (this.formMode === 'schedule' && serviceDate <= today) {
      this.snack.open('Scheduled service must use a future date.', 'OK', { duration: 3000 });
      return;
    }

    const customer = this.customers.find(c => c.id === val.customerId);
    const record = {
      ...val,
      customerName: customer?.name ?? '',
      nextServiceDate: this.formMode === 'schedule' ? serviceDate : val.nextServiceDate ? new Date(val.nextServiceDate) : undefined
    };

    this.serviceSvc.add(record).subscribe(() => {
      if (customer?.id) {
        const customerChanges = this.formMode === 'schedule'
          ? { nextServiceDate: serviceDate }
          : {
              lastServiceDate: serviceDate,
              nextServiceDate: val.nextServiceDate ? new Date(val.nextServiceDate) : undefined
            };

        this.customerSvc.update(customer.id, customerChanges).subscribe(() => this.loadData());
      }
      this.snack.open(this.formMode === 'schedule' ? 'Service scheduled!' : 'Service logged!', 'OK', { duration: 3000 });
      this.showForm = false;
      this.loadData();
      this.initForm(this.formMode);
    });
  }

  deleteRecord(s: ServiceRecord): void {
    const message = this.isScheduledService(s)
      ? 'Cancel this scheduled appointment?'
      : 'Delete this record?';

    if (!confirm(message)) return;
    this.serviceSvc.delete(s.id!).subscribe(() => {
      this.snack.open(this.isScheduledService(s) ? 'Schedule cancelled' : 'Deleted', 'OK', { duration: 2000 });
      this.loadData();
    });
  }

  beginCompleteScheduledService(record: ServiceRecord): void {
    this.scheduledCompletionRecord = record;
    this.completionParts = record.partsReplaced ?? '';
    this.completionCost = record.cost ?? 0;
    this.completionNotes = record.notes ?? '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelCompleteScheduledService(): void {
    this.scheduledCompletionRecord = null;
    this.completionParts = '';
    this.completionCost = 0;
    this.completionNotes = '';
  }

  completeScheduledService(): void {
    const record = this.scheduledCompletionRecord;
    if (!record?.id) return;

    const serviceDate = this.startOfDay(new Date(record.serviceDate));
    const nextServiceDate = new Date(serviceDate);
    nextServiceDate.setMonth(nextServiceDate.getMonth() + 3);

    const changes: Partial<ServiceRecord> = {
      nextServiceDate,
      partsReplaced: this.completionParts || undefined,
      cost: this.completionCost,
      notes: this.completionNotes || undefined
    };

    this.serviceSvc.update(record.id, changes).subscribe(() => {
      const customer = this.customers.find(c => c.id === record.customerId);
      const customerChange: Partial<Customer> = {
        lastServiceDate: serviceDate,
        nextServiceDate
      };

      const finalize = () => {
        this.snack.open('Scheduled service marked completed.', 'OK', { duration: 3000 });
        this.cancelCompleteScheduledService();
        this.loadData();
      };

      if (customer?.id) {
        this.customerSvc.update(customer.id, customerChange).subscribe(finalize);
      } else {
        finalize();
      }
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

  isScheduledService(record: ServiceRecord): boolean {
    if (!record.serviceDate) return false;
    const serviceDate = this.startOfDay(new Date(record.serviceDate));
    const today = this.startOfDay(new Date());
    return serviceDate.getTime() > today.getTime();
  }

  isComplaintService(record: ServiceRecord): boolean {
    return !!record.complaintId;
  }

  onServiceDateChange(date: Date | null): void {
    if (!date) return;
    const serviceDate = new Date(date);

    if (this.formMode === 'schedule') {
      this.form.patchValue({ nextServiceDate: serviceDate });
      return;
    }

    const next = new Date(serviceDate);
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
    this.applyFilter();
  }

  onMaintenanceDateChange(): void {
    this.upcomingCustomers = this.getFilteredUpcomingCustomers(this.customers);
    this.applyFilter();
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
