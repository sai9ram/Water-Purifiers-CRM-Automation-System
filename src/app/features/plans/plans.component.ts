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
  templateUrl: './plans.component.html',
  styleUrl: './plans.component.scss'
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
