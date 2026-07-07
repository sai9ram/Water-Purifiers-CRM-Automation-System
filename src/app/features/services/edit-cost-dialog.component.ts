import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-edit-cost-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <h2 mat-dialog-title>Update Service Details</h2>
    <div mat-dialog-content>
      <p>Service: <strong>{{ data.customerName }}</strong> - {{ data.serviceType }}</p>
      <form [formGroup]="form">
        <mat-form-field appearance="outline" style="width:100%; margin-bottom:12px;">
          <mat-label>Parts Replaced</mat-label>
          <input matInput formControlName="partsReplaced" placeholder="e.g. Sediment + Carbon filter" />
        </mat-form-field>
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>Cost (₹)</mat-label>
          <mat-icon matPrefix>currency_rupee</mat-icon>
          <input matInput type="number" formControlName="cost" min="0" />
          <mat-error *ngIf="form.get('cost')?.invalid && form.get('cost')?.touched">
            Enter a valid cost.
          </mat-error>
        </mat-form-field>
      </form>
    </div>
    <div mat-dialog-actions align="end">
      <button mat-stroked-button type="button" (click)="close()">Cancel</button>
      <button mat-raised-button color="primary" type="button" [disabled]="form.invalid" (click)="save()">
        <mat-icon>save</mat-icon>
        Save Changes
      </button>
    </div>
  `
})
export class EditCostDialogComponent {
  form: FormGroup;
  private dialogRef = inject(MatDialogRef<EditCostDialogComponent>);
  private fb = inject(FormBuilder);
  readonly data = inject(MAT_DIALOG_DATA) as { customerName?: string; serviceType?: string; cost?: number; partsReplaced?: string };

  constructor() {
    this.form = this.fb.group({
      partsReplaced: [this.data?.partsReplaced || ''],
      cost: [this.data?.cost || 0, [Validators.required, Validators.min(0)]]
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.dialogRef.close({
      cost: Number(this.form.value.cost),
      partsReplaced: this.form.value.partsReplaced
    });
  }

  close(): void {
    this.dialogRef.close(null);
  }
}
