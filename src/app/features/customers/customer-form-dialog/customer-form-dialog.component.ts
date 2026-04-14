import { Component, Inject, OnInit } from '@angular/core';
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
  template: `
    <div class="dialog-header">
      <h3>{{ isEdit ? 'Edit Customer' : 'Add New Customer' }}</h3>
      <p>{{ isEdit ? 'Update customer information' : 'Fill in details to add a new rental customer' }}</p>
    </div>

    <div class="dialog-body">
      <form [formGroup]="form">
        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Full Name *</mat-label>
            <input matInput formControlName="name" placeholder="e.g. Ravi Kumar" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>WhatsApp Phone *</mat-label>
            <mat-icon matPrefix>phone</mat-icon>
            <input matInput formControlName="phone" placeholder="9876543210" maxlength="10" />
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Alternate Phone</mat-label>
            <input matInput formControlName="alternatePhone" placeholder="Optional" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Area / Colony *</mat-label>
            <input matInput formControlName="area" placeholder="e.g. Balaji Nagar" />
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Full Address *</mat-label>
          <textarea matInput formControlName="address" rows="2" placeholder="Door No, Street, Colony, Tirupati"></textarea>
        </mat-form-field>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Purifier Model *</mat-label>
            <mat-select formControlName="purifierModel">
              <mat-option *ngFor="let m of models" [value]="m">{{ m }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Rental Plan *</mat-label>
            <mat-select formControlName="planId" (selectionChange)="onPlanChange($event.value)">
              <mat-option *ngFor="let p of plans" [value]="p.id">
                {{ p.name }} — ₹{{ p.monthlyRent }}/mo
              </mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Deposit Paid (₹) *</mat-label>
            <mat-icon matPrefix>currency_rupee</mat-icon>
            <input matInput formControlName="depositPaid" type="number" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Status *</mat-label>
            <mat-select formControlName="status">
              <mat-option value="active">Active</mat-option>
              <mat-option value="inactive">Inactive</mat-option>
              <mat-option value="overdue">Overdue</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Join Date *</mat-label>
            <input matInput [matDatepicker]="joinPicker" formControlName="joinDate" />
            <mat-datepicker-toggle matSuffix [for]="joinPicker"></mat-datepicker-toggle>
            <mat-datepicker #joinPicker></mat-datepicker>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Next Due Date *</mat-label>
            <input matInput [matDatepicker]="duePicker" formControlName="nextDueDate" />
            <mat-datepicker-toggle matSuffix [for]="duePicker"></mat-datepicker-toggle>
            <mat-datepicker #duePicker></mat-datepicker>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Notes</mat-label>
          <textarea matInput formControlName="notes" rows="2" placeholder="Any additional notes..."></textarea>
        </mat-form-field>
      </form>
    </div>

    <div class="dialog-footer">
      <button mat-stroked-button (click)="dialogRef.close()">Cancel</button>
      <button mat-raised-button color="primary" (click)="save()" [disabled]="form.invalid || saving">
        <mat-icon>{{ saving ? 'hourglass_empty' : 'save' }}</mat-icon>
        {{ saving ? 'Saving...' : (isEdit ? 'Update' : 'Add Customer') }}
      </button>
    </div>
  `,
  styles: [`
    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;

      @media (max-width: 480px) { grid-template-columns: 1fr; }
    }

    mat-form-field { margin-bottom: 4px; }
  `]
})
export class CustomerFormDialogComponent implements OnInit {
  form!: FormGroup;
  isEdit = false;
  saving = false;
  models = PURIFIER_MODELS;
  plans: RentalPlan[] = [];

  constructor(
    public dialogRef: MatDialogRef<CustomerFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { customer: Customer | null; plans: RentalPlan[] },
    private fb: FormBuilder,
    private customerSvc: CustomerService,
    private snack: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.isEdit = !!this.data.customer;
    this.plans  = this.data.plans;

    const c = this.data.customer;
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    this.form = this.fb.group({
      name:           [c?.name ?? '', Validators.required],
      phone:          [c?.phone ?? '', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      alternatePhone: [c?.alternatePhone ?? ''],
      address:        [c?.address ?? '', Validators.required],
      area:           [c?.area ?? '', Validators.required],
      purifierModel:  [c?.purifierModel ?? '', Validators.required],
      planId:         [c?.planId ?? null, Validators.required],
      depositPaid:    [c?.depositPaid ?? 0, Validators.required],
      status:         [c?.status ?? 'active', Validators.required],
      joinDate:       [c?.joinDate ? new Date(c.joinDate) : new Date(), Validators.required],
      nextDueDate:    [c?.nextDueDate ? new Date(c.nextDueDate) : nextMonth, Validators.required],
      notes:          [c?.notes ?? '']
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

    const val    = this.form.value;
    const plan   = this.plans.find(p => p.id === val.planId);
    const payload = {
      ...val,
      planName:    plan?.name ?? '',
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
}
