import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-edit-receiver-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <h2 mat-dialog-title>Update Receiver</h2>
    <div mat-dialog-content>
      <form [formGroup]="form">
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>Received By</mat-label>
          <mat-select formControlName="receiver">
            <mat-option value="Charan">Charan</mat-option>
            <mat-option value="Nagarjuna">Nagarjuna</mat-option>
          </mat-select>
        </mat-form-field>
      </form>
    </div>
    <div mat-dialog-actions align="end">
      <button mat-stroked-button type="button" (click)="close()">Cancel</button>
      <button mat-raised-button color="primary" type="button" [disabled]="form.invalid" (click)="save()">
        <mat-icon>save</mat-icon>
        Save
      </button>
    </div>
  `
})
export class EditReceiverDialogComponent {
  form: FormGroup;
  private dialogRef = inject(MatDialogRef<EditReceiverDialogComponent>);
  private fb = inject(FormBuilder);
  readonly data = inject(MAT_DIALOG_DATA) as { receiver?: string };

  constructor() {
    this.form = this.fb.group({
      receiver: [this.data?.receiver || 'Charan', Validators.required]
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.dialogRef.close(this.form.value.receiver?.toString().trim());
  }

  close(): void {
    this.dialogRef.close(null);
  }
}
