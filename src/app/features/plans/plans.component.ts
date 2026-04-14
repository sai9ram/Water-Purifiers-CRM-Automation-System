import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PlanService } from '../../core/services/plan.service';
import { RentalPlan } from '../../core/models/models';

@Component({
  selector: 'app-plans',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatIconModule, MatButtonModule, MatFormFieldModule,
    MatInputModule, MatSnackBarModule
  ],
  template: `
    <div class="page-container fade-in">
      <div class="page-header">
        <div>
          <h2>Rental Plans</h2>
          <p class="subtitle">Manage your water purifier rental plans</p>
        </div>
        <button mat-raised-button color="primary" (click)="openAddForm()">
          <mat-icon>add</mat-icon> New Plan
        </button>
      </div>

      <!-- Plan Cards -->
      <div class="plans-grid">
        <div class="plan-card" *ngFor="let p of plans" [class.editing]="editingId === p.id">
          <div class="plan-header">
            <div class="plan-badge">{{ p.name }}</div>
            <div class="plan-price">
              <span class="price">₹{{ p.monthlyRent }}</span>
              <span class="per">/month</span>
            </div>
          </div>

          <div class="plan-deposit">
            <mat-icon>lock</mat-icon> Deposit: ₹{{ p.depositAmount }}
          </div>

          <p class="plan-desc">{{ p.description }}</p>

          <ul class="plan-features">
            <li *ngFor="let f of p.features">
              <mat-icon>check_circle</mat-icon> {{ f }}
            </li>
          </ul>

          <div class="plan-footer">
            <button mat-stroked-button (click)="editPlan(p)">
              <mat-icon>edit</mat-icon> Edit
            </button>
            <button mat-stroked-button color="warn" (click)="deletePlan(p)">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        </div>

        <!-- Add Plan Card -->
        <div class="plan-card add-card" *ngIf="!showForm" (click)="openAddForm()">
          <mat-icon>add_circle</mat-icon>
          <p>Add New Plan</p>
        </div>
      </div>

      <!-- Add / Edit Form -->
      <div class="form-panel" *ngIf="showForm">
        <div class="form-panel-header">
          <h3>{{ editingId ? 'Edit Plan' : 'New Plan' }}</h3>
          <button mat-icon-button (click)="cancelForm()"><mat-icon>close</mat-icon></button>
        </div>

        <form [formGroup]="form">
          <div class="form-row-2">
            <mat-form-field appearance="outline">
              <mat-label>Plan Name *</mat-label>
              <input matInput formControlName="name" placeholder="e.g. Basic, Standard, Premium" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Monthly Rent (₹) *</mat-label>
              <mat-icon matPrefix>currency_rupee</mat-icon>
              <input matInput formControlName="monthlyRent" type="number" />
            </mat-form-field>
          </div>

          <div class="form-row-2">
            <mat-form-field appearance="outline">
              <mat-label>Deposit Amount (₹) *</mat-label>
              <mat-icon matPrefix>currency_rupee</mat-icon>
              <input matInput formControlName="depositAmount" type="number" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Description</mat-label>
              <input matInput formControlName="description" />
            </mat-form-field>
          </div>

          <div class="features-section">
            <div class="features-header">
              <label>Features</label>
              <button type="button" mat-stroked-button (click)="addFeature()">
                <mat-icon>add</mat-icon> Add Feature
              </button>
            </div>

            <div formArrayName="features">
              <div *ngFor="let ctrl of featuresArray.controls; let i = index" class="feature-row">
                <mat-form-field appearance="outline" style="flex:1">
                  <input matInput [formControlName]="i" placeholder="e.g. RO Purification" />
                </mat-form-field>
                <button type="button" mat-icon-button color="warn" (click)="removeFeature(i)">
                  <mat-icon>remove_circle</mat-icon>
                </button>
              </div>
            </div>
          </div>

          <div class="form-actions">
            <button mat-stroked-button type="button" (click)="cancelForm()">Cancel</button>
            <button mat-raised-button color="primary" (click)="save()" [disabled]="form.invalid">
              <mat-icon>save</mat-icon> {{ editingId ? 'Update Plan' : 'Create Plan' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .plans-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 20px;
      margin-bottom: 28px;
    }

    .plan-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      box-shadow: var(--shadow-sm);
      transition: box-shadow 0.2s, transform 0.2s;

      &:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }
    }

    .plan-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
    }

    .plan-badge {
      background: var(--brand-light);
      color: var(--brand-dark);
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.78rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .plan-price {
      text-align: right;
      .price { font-size: 1.7rem; font-weight: 800; font-family: 'Sora',sans-serif; color: var(--brand-primary); }
      .per   { font-size: 0.75rem; color: var(--text-muted); }
    }

    .plan-deposit {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.82rem;
      color: var(--text-secondary);
      font-weight: 500;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }

    .plan-desc {
      font-size: 0.83rem;
      color: var(--text-secondary);
      margin: 0;
      line-height: 1.4;
    }

    .plan-features {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 1;

      li {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.82rem;
        mat-icon { font-size: 15px; width: 15px; height: 15px; color: var(--success); }
      }
    }

    .plan-footer {
      display: flex;
      gap: 8px;
      border-top: 1px solid var(--border);
      padding-top: 14px;
    }

    .add-card {
      border: 2px dashed var(--border);
      cursor: pointer;
      align-items: center;
      justify-content: center;
      min-height: 200px;
      color: var(--text-muted);
      box-shadow: none;
      transition: border-color 0.15s, color 0.15s;

      mat-icon { font-size: 40px; width: 40px; height: 40px; opacity: 0.4; }
      p { font-size: 0.88rem; }

      &:hover { border-color: var(--brand-primary); color: var(--brand-primary); }
    }

    .form-panel {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 28px;
      box-shadow: var(--shadow-md);
    }

    .form-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
      h3 { font-size: 1.1rem; }
    }

    .form-row-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-bottom: 4px;
      @media (max-width: 600px) { grid-template-columns: 1fr; }
    }

    .features-section { margin-top: 8px; }

    .features-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      label { font-weight: 600; font-size: 0.88rem; color: var(--text-secondary); }
    }

    .feature-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 16px;
    }
  `]
})
export class PlansComponent implements OnInit {
  plans: RentalPlan[] = [];
  showForm  = false;
  editingId: number | null = null;
  form!: FormGroup;

  constructor(
    private planSvc: PlanService,
    private fb: FormBuilder,
    private snack: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadPlans();
    this.initForm();
  }

  loadPlans(): void {
    this.planSvc.getAll().subscribe(p => this.plans = p);
  }

  initForm(plan?: RentalPlan): void {
    this.form = this.fb.group({
      name:          [plan?.name ?? '', Validators.required],
      monthlyRent:   [plan?.monthlyRent ?? 299, [Validators.required, Validators.min(1)]],
      depositAmount: [plan?.depositAmount ?? 999, Validators.required],
      description:   [plan?.description ?? ''],
      features:      this.fb.array((plan?.features ?? ['']).map(f => this.fb.control(f)))
    });
  }

  get featuresArray(): FormArray {
    return this.form.get('features') as FormArray;
  }

  addFeature(): void {
    this.featuresArray.push(this.fb.control(''));
  }

  removeFeature(i: number): void {
    this.featuresArray.removeAt(i);
  }

  openAddForm(): void {
    this.editingId = null;
    this.initForm();
    this.showForm = true;
  }

  editPlan(plan: RentalPlan): void {
    this.editingId = plan.id!;
    this.initForm(plan);
    this.showForm = true;
  }

  cancelForm(): void {
    this.showForm  = false;
    this.editingId = null;
  }

  save(): void {
    if (this.form.invalid) return;
    const val = { ...this.form.value, features: this.form.value.features.filter((f: string) => f.trim()) };

    const obs = this.editingId
      ? this.planSvc.update(this.editingId, val)
      : this.planSvc.add(val);

    obs.subscribe(() => {
      this.snack.open(this.editingId ? 'Plan updated!' : 'Plan created!', 'OK', { duration: 3000 });
      this.loadPlans();
      this.cancelForm();
    });
  }

  deletePlan(plan: RentalPlan): void {
    if (!confirm(`Delete plan "${plan.name}"?`)) return;
    this.planSvc.delete(plan.id!).subscribe(() => {
      this.snack.open('Plan deleted', 'OK', { duration: 3000 });
      this.loadPlans();
    });
  }
}
