import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { CustomerListComponent } from './features/customers/customer-list/customer-list.component';
import { CustomerDetailComponent } from './features/customers/customer-detail/customer-detail.component';
import { PlansComponent } from './features/plans/plans.component';
import { ServicesComponent } from './features/services/services.component';
import { ComplaintsComponent } from './features/complaints/complaints.component';
import { TechniciansComponent } from './features/technicians/technicians.component';
import { PaymentsComponent } from './features/payments/payments.component';
import { RemindersComponent } from './features/reminders/reminders.component';
import { CustomerPayComponent } from './features/pay/customer-pay.component';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'customers', component: CustomerListComponent },
  { path: 'customers/:id', component: CustomerDetailComponent },
  { path: 'plans', component: PlansComponent },
  { path: 'services', component: ServicesComponent },
  { path: 'complaints', component: ComplaintsComponent },
  { path: 'technicians', component: TechniciansComponent },
  { path: 'payments', component: PaymentsComponent },
  { path: 'reminders', component: RemindersComponent },
  { path: 'pay/:paymentId', component: CustomerPayComponent },
  { path: '**', redirectTo: 'dashboard' }
];
