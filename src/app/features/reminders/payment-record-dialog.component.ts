import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CustomerService } from '../../core/services/customer.service';
import { PaymentService } from '../../core/services/payment.service';
import { Customer } from '../../core/models/models';

interface PaymentRecordDialogData {
  customer: Customer;
}

@Component({
  selector: 'app-payment-record-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSnackBarModule
  ],
  template: `
    <h2 mat-dialog-title>Record Payment</h2>
    <div mat-dialog-content>
      <p>
        Record a payment for <strong>{{ data.customer.name }}</strong>.
      </p>
      <form [formGroup]="form">
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>Amount</mat-label>
          <input matInput type="number" formControlName="amount" min="0" />
          <mat-error *ngIf="form.get('amount')?.invalid && form.get('amount')?.touched">
            Enter a valid amount.
          </mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>Paid Date</mat-label>
          <input matInput [matDatepicker]="paidDatePicker" formControlName="paidDate" />
          <mat-datepicker-toggle matSuffix [for]="paidDatePicker"></mat-datepicker-toggle>
          <mat-datepicker #paidDatePicker></mat-datepicker>
          <mat-error *ngIf="form.get('paidDate')?.invalid && form.get('paidDate')?.touched">
            Enter a valid date.
          </mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>For Month</mat-label>
          <input matInput formControlName="forMonth" />
          <mat-error *ngIf="form.get('forMonth')?.invalid && form.get('forMonth')?.touched">
            Month is required.
          </mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>Notes</mat-label>
          <textarea matInput formControlName="notes" rows="3"></textarea>
        </mat-form-field>
      </form>
    </div>
    <div mat-dialog-actions align="end">
      <button mat-stroked-button type="button" (click)="close()">Cancel</button>
      <button mat-raised-button color="primary" type="button" [disabled]="form.invalid" (click)="save()">
        <mat-icon>save</mat-icon>
        Save Payment
      </button>
    </div>
  `
})
export class PaymentRecordDialogComponent implements OnInit {
  form: FormGroup;
  private paymentSvc = inject(PaymentService);
  private customerSvc = inject(CustomerService);
  private snack = inject(MatSnackBar);
  private dialogRef = inject(MatDialogRef<PaymentRecordDialogComponent>);
  readonly data = inject(MAT_DIALOG_DATA) as PaymentRecordDialogData;
  private fb = inject(FormBuilder);

  constructor() {
    this.form = this.fb.group({
      amount: [0, [Validators.required, Validators.min(1)]],
      paidDate: [new Date(), Validators.required],
      forMonth: [''],
      notes: ['']
    });
  }

  ngOnInit(): void {
    const defaultForMonth = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    this.form.patchValue({
      amount: this.data.customer.monthlyRent ?? 0,
      forMonth: defaultForMonth
    });
  }

  save(): void {
    if (this.form.invalid) {
      return;
    }

    const values = this.form.value;
    const paidDate = new Date(values.paidDate);

    this.paymentSvc.add({
      customerId: this.data.customer.id!,
      amount: Number(values.amount),
      paidDate,
      forMonth: values.forMonth?.toString().trim() ?? '',
      notes: values.notes?.toString().trim()
    }).subscribe(() => {
      const nextDueDate = new Date(this.data.customer.nextDueDate || new Date());
      nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      this.customerSvc.update(this.data.customer.id!, {
        lastPaymentDate: paidDate,
        nextDueDate,
        status: 'active'
      }).subscribe(() => {
        this.snack.open('Payment recorded successfully', 'OK', { duration: 3000 });
        this.dialogRef.close(true);
      });
    });
  }

  close(): void {
    this.dialogRef.close(false);
  }
}
