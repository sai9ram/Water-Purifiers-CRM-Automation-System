import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { CustomerComplaintService } from '../../core/services/customer-complaint.service';
import { Customer } from '../../core/models/models';
import { CustomerService as CustomerDataService } from '../../core/services/customer.service';

interface ComplaintDialogData {
  customer?: Customer;
}

@Component({
  selector: 'app-customer-complaint-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule
  ],
  template: `
    <h2 mat-dialog-title>Log Complaint</h2>
    <div mat-dialog-content>
      <p *ngIf="data.customer">Record a complaint for {{ data.customer.name }}.</p>
      <p *ngIf="!data.customer">Record a complaint for a customer.</p>
      <form [formGroup]="form">
        <mat-form-field appearance="outline" style="width:100%" *ngIf="!data.customer">
          <mat-label>Customer</mat-label>
          <mat-select formControlName="customerId">
            <mat-option *ngFor="let c of customers" [value]="c.id">{{ c.name }} — {{ c.area }}</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>Complaint</mat-label>
          <textarea matInput formControlName="comment" rows="5"></textarea>
          <mat-error *ngIf="form.controls.comment.invalid && form.controls.comment.touched">
            Complaint is required.
          </mat-error>
        </mat-form-field>
      </form>
    </div>
    <div mat-dialog-actions align="end">
      <button mat-stroked-button type="button" (click)="close()">Cancel</button>
      <button mat-raised-button color="primary" type="button" [disabled]="form.invalid" (click)="save()">
        <mat-icon>save</mat-icon>
        Save Complaint
      </button>
      <button mat-stroked-button color="accent" type="button" [disabled]="form.invalid" (click)="save(true)">
        <mat-icon>build_circle</mat-icon>
        Save & Schedule Service
      </button>
    </div>
  `
})
export class CustomerComplaintDialogComponent {
  form = new FormGroup({
    customerId: new FormControl<number | null>(null, Validators.required),
    comment: new FormControl<string>('', [Validators.required, Validators.maxLength(1000)])
  });

  customers: Customer[] = [];
  private complaintSvc = inject(CustomerComplaintService);
  private customerSvc = inject(CustomerDataService);
  private snack = inject(MatSnackBar);
  private dialogRef = inject(MatDialogRef<CustomerComplaintDialogComponent>);
  readonly data = inject(MAT_DIALOG_DATA) as ComplaintDialogData;

  constructor() {
    if (this.data.customer) {
      this.form.patchValue({ customerId: this.data.customer.id });
    }

    this.customerSvc.getAll().subscribe(customers => {
      this.customers = customers;
      if (!this.data.customer && customers.length > 0) {
        this.form.patchValue({ customerId: customers[0].id });
      }
    });
  }

  save(schedule = false): void {
    if (this.form.invalid) {
      return;
    }

    const customerId = this.data.customer?.id ?? this.form.get('customerId')?.value;
    if (!customerId) {
      return;
    }

    const commentText = (this.form.get('comment')?.value ?? '').toString().trim();
    if (!commentText) {
      return;
    }

    this.complaintSvc.add({
      customerId,
      complaint: commentText
    }).subscribe(id => {
      this.snack.open('Complaint saved', 'OK', { duration: 3000 });
      this.dialogRef.close({ customerId, complaintId: id, schedule });
    });
  }

  close(): void {
    this.dialogRef.close(false);
  }
}
