import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'customers',
    loadComponent: () => import('./features/customers/customer-list/customer-list.component').then(m => m.CustomerListComponent)
  },
  {
    path: 'customers/:id',
    loadComponent: () => import('./features/customers/customer-detail/customer-detail.component').then(m => m.CustomerDetailComponent)
  },
  {
    path: 'plans',
    loadComponent: () => import('./features/plans/plans.component').then(m => m.PlansComponent)
  },
  {
    path: 'services',
    loadComponent: () => import('./features/services/services.component').then(m => m.ServicesComponent)
  },
  {
    path: 'reminders',
    loadComponent: () => import('./features/reminders/reminders.component').then(m => m.RemindersComponent)
  },
  { path: '**', redirectTo: 'dashboard' }
];
