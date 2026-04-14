import { Component, OnInit, AfterViewInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
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
import { Customer, RentalPlan, CustomerStatus } from '../../../core/models/models';
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
  templateUrl: './customer-list.component.html',
  styleUrl: './customer-list.component.scss'
})
export class CustomerListComponent implements OnInit, AfterViewInit {
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  displayedColumns = ['name', 'area', 'purifierModel', 'planName', 'nextDueDate', 'status', 'actions'];
  dataSource = new MatTableDataSource<Customer>([]);
  allCustomers: Customer[] = [];
  plans: RentalPlan[] = [];
  searchQuery = '';
  statusFilter = '';
  planFilter: number | '' = '';

  private customerSvc = inject(CustomerService);
  private planSvc = inject(PlanService);
  private waSvc = inject(WhatsappService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);

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
