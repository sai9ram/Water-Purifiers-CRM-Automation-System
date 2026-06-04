import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CustomerService } from '../../../core/services/customer.service';
import { Customer, RentalPlan, PURIFIER_MODELS } from '../../../core/models/models';

@Component({
  selector: 'app-customer-form-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatDatepickerModule, MatNativeDateModule,
    MatButtonModule, MatIconModule, MatSnackBarModule
  ],
  templateUrl: './customer-form-dialog.component.html',
  styleUrl: './customer-form-dialog.component.scss'
})
export class CustomerFormDialogComponent implements OnInit {
  form!: FormGroup;
  isEdit = false;
  saving = false;
  models = PURIFIER_MODELS;
  plans: RentalPlan[] = [];

  public dialogRef = inject(MatDialogRef<CustomerFormDialogComponent>);
  private data = inject(MAT_DIALOG_DATA) as { customer: Customer | null; plans: RentalPlan[] };
  private fb = inject(FormBuilder);
  private customerSvc = inject(CustomerService);
  private snack = inject(MatSnackBar);

  ngOnInit(): void {
    this.isEdit = !!this.data.customer;
    this.plans = this.data.plans;

    const c = this.data.customer;
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const lastServiceDate = c?.lastServiceDate ? new Date(c.lastServiceDate) : null;
    const nextServiceDate = c?.nextServiceDate
      ? new Date(c.nextServiceDate)
      : this.addMonths(lastServiceDate ?? new Date(), 3);

    this.form = this.fb.group({
      name: [c?.name ?? '', Validators.required],
      phone: [c?.phone ?? '', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      alternatePhone: [c?.alternatePhone ?? ''],
      address: [c?.address ?? '', Validators.required],
      area: [c?.area ?? '', Validators.required],
      purifierModel: [c?.purifierModel ?? '', Validators.required],
      planId: [c?.planId ?? null, Validators.required],
      depositPaid: [c?.depositPaid ?? 0, Validators.required],
      initialInvestment: [c?.initialInvestment ?? 0, Validators.required],
      status: [c?.status ?? 'active', Validators.required],
      joinDate: [c?.joinDate ? new Date(c.joinDate) : new Date(), Validators.required],
      nextDueDate: [c?.nextDueDate ? new Date(c.nextDueDate) : nextMonth, Validators.required],
      lastServiceDate: [lastServiceDate],
      nextServiceDate: [nextServiceDate],
      notes: [c?.notes ?? '']
    });
  }

  onPlanChange(planId: number): void {
    const plan = this.plans.find(p => p.id === planId);
    if (plan && !this.isEdit) {
      this.form.patchValue({ depositPaid: plan.depositAmount });
    }
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving = true;

    const val = this.form.value;
    const lastServiceDate = val.lastServiceDate ? new Date(val.lastServiceDate) : undefined;
    const nextServiceDate = lastServiceDate
      ? (val.nextServiceDate ? new Date(val.nextServiceDate) : this.addMonths(lastServiceDate, 3))
      : (val.nextServiceDate ? new Date(val.nextServiceDate) : undefined);
    const plan = this.plans.find(p => p.id === val.planId);
    const payload = {
      ...val,
      lastServiceDate,
      nextServiceDate,
      planName: plan?.name ?? '',
      monthlyRent: plan?.monthlyRent ?? 0
    };

    const obs = this.isEdit
      ? this.customerSvc.update(this.data.customer!.id!, payload)
      : this.customerSvc.add(payload);

    obs.subscribe({
      next: () => {
        this.snack.open(this.isEdit ? 'Customer updated!' : 'Customer added!', 'OK', { duration: 3000 });
        this.dialogRef.close(true);
      },
      error: () => { this.saving = false; }
    });
  }

  onLastServiceDateChange(date: Date | null): void {
    if (!date) return;
    this.form.patchValue({ nextServiceDate: this.addMonths(date, 3) });
  }

  private addMonths(date: Date, months: number): Date {
    const next = new Date(date);
    next.setMonth(next.getMonth() + months);
    return next;
  }
}
