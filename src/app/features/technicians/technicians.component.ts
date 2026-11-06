import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TechnicianService } from '../../core/services/technician.service';
import { Technician } from '../../core/models/models';

@Component({
  selector: 'app-technicians',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatSnackBarModule
  ],
  template: `
    <div class="page-container fade-in">
      <div class="page-header">
        <div>
          <h2>Technicians & Staff</h2>
          <p class="subtitle">Staff members who visit customer homes to install purifiers and change filters</p>
        </div>
      </div>

      <div class="form-panel">
        <h3>{{ editingId ? 'Edit Technician' : 'New Technician' }}</h3>
        <form [formGroup]="form" class="tech-form">
          <div class="form-row-2">
            <mat-form-field appearance="outline">
              <mat-label>Name</mat-label>
              <input matInput formControlName="name" />
            </mat-form-field>
            <mat-checkbox formControlName="isDefault">Default Technician</mat-checkbox>
          </div>

          <div class="form-actions">
            <button mat-raised-button color="primary" type="button" (click)="save()" [disabled]="form.invalid">
              <mat-icon>save</mat-icon>
              {{ editingId ? 'Update' : 'Create' }} Technician
            </button>
            <button mat-stroked-button type="button" (click)="resetForm()" *ngIf="editingId">Cancel</button>
          </div>
        </form>
      </div>

      <div class="table-card">
        <table mat-table [dataSource]="dataSource" class="full-width-table">

          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Name</th>
            <td mat-cell *matCellDef="let row">{{ row.name }}</td>
          </ng-container>

          <ng-container matColumnDef="default">
            <th mat-header-cell *matHeaderCellDef>Default</th>
            <td mat-cell *matCellDef="let row">{{ row.isDefault ? 'Yes' : 'No' }}</td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let row">
              <button mat-icon-button color="primary" (click)="edit(row)">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button color="warn" (click)="delete(row)">
                <mat-icon>delete</mat-icon>
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
      </div>
    </div>
  `,
  styles: [
    `.form-panel h3 { margin-bottom: 14px; font-size: 0.9rem; }
    .tech-form { gap: 12px; display: flex; flex-direction: column; }
    .form-row-2 { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
    .form-row-2 ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none !important; }
    .form-actions { display: flex; gap: 10px; justify-content: flex-end; }
    .full-width-table { width: 100%; }
    `
  ]
})
export class TechniciansComponent implements OnInit {
  columns = ['name', 'default', 'actions'];
  dataSource = new MatTableDataSource<Technician>([]);
  form!: FormGroup;
  editingId: number | null = null;

  private techSvc = inject(TechnicianService);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);

  ngOnInit(): void {
    this.initForm();
    this.loadTechnicians();
  }

  private initForm(): void {
    this.form = this.fb.group({
      name: ['', Validators.required],
      isDefault: [false]
    });
  }

  loadTechnicians(): void {
    this.techSvc.getAll().subscribe(items => {
      this.dataSource.data = items;
      if (!this.editingId && items.length === 0) {
        this.form.patchValue({ name: 'Default Technician', isDefault: true });
      }
    });
  }

  save(): void {
    if (this.form.invalid) return;
    const { name, isDefault } = this.form.value;

    if (this.editingId) {
      this.techSvc.update(this.editingId, { name, isDefault }).subscribe(() => {
        this.snack.open('Technician updated', 'OK', { duration: 3000 });
        this.resetForm();
        this.loadTechnicians();
      });
      return;
    }

    this.techSvc.add({ name, isDefault }).subscribe(() => {
      this.snack.open('Technician added', 'OK', { duration: 3000 });
      this.resetForm();
      this.loadTechnicians();
    });
  }

  edit(row: Technician): void {
    this.editingId = row.id ?? null;
    this.form.patchValue({ name: row.name, isDefault: row.isDefault });
  }

  delete(row: Technician): void {
    if (!row.id || !confirm(`Delete technician ${row.name}?`)) return;
    this.techSvc.delete(row.id).subscribe(() => {
      this.snack.open('Technician deleted', 'OK', { duration: 3000 });
      this.resetForm();
      this.loadTechnicians();
    });
  }

  resetForm(): void {
    this.editingId = null;
    this.form.reset({ name: '', isDefault: false });
  }
}
