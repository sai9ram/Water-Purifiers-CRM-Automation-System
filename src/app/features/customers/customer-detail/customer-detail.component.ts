import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { CustomerService } from '../../../core/services/customer.service';
import { ServiceRecordService } from '../../../core/services/service-record.service';
import { PaymentService } from '../../../core/services/payment.service';
import { PlanService } from '../../../core/services/plan.service';
import { TechnicianService } from '../../../core/services/technician.service';
import { PaymentLinkService } from '../../../core/services/payment-link.service';
import { WhatsappService } from '../../../core/services/whatsapp.service';
import { Customer, ServiceRecord, PaymentRecord, RentalPlan, SERVICE_TYPE_LABELS, ServiceType, CustomerComment, CustomerComplaint, Technician } from '../../../core/models/models';
import { CustomerFormDialogComponent } from '../customer-form-dialog/customer-form-dialog.component';
import { ComplaintCommentsDialogComponent } from '../../complaints/complaint-comments-dialog.component';
import { CustomerCommentService } from '../../../core/services/customer-comment.service';
import { CustomerComplaintService } from '../../../core/services/customer-complaint.service';

@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [
    CommonModule, RouterLink, FormsModule, ReactiveFormsModule,
    MatIconModule, MatButtonModule, MatCardModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatDatepickerModule, MatNativeDateModule, MatSnackBarModule, MatTabsModule
  ],
  templateUrl: './customer-detail.component.html',
  styleUrl: './customer-detail.component.scss'
})
export class CustomerDetailComponent implements OnInit {
  customer: Customer | undefined;
  serviceRecords: ServiceRecord[] = [];
  payments: PaymentRecord[] = [];
  comments: CustomerComment[] = [];
  selectedTabIndex = 0;
  complaints: CustomerComplaint[] = [];
  totalPaid = 0;
  loading = true;
  showAddService = false;
  showAddPayment = false;
  showAddComment = false;
  plans: RentalPlan[] = [];

  serviceForm!: FormGroup;
  paymentForm!: FormGroup;
  commentForm!: FormGroup;
  technicians: Technician[] = [];
  defaultTechnicianName = '';

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private customerSvc = inject(CustomerService);
  private serviceSvc = inject(ServiceRecordService);
  private paymentSvc = inject(PaymentService);
  private planSvc = inject(PlanService);
  private technicianSvc = inject(TechnicianService);
  private paymentLinkSvc = inject(PaymentLinkService);
  private waSvc = inject(WhatsappService);
  private commentSvc = inject(CustomerCommentService);
  private complaintSvc = inject(CustomerComplaintService);
  private dialog = inject(MatDialog);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const tab = params.get('tab');
      this.selectedTabIndex = tab === 'payment' ? 1 : tab === 'complaints' ? 2 : tab === 'comments' ? 3 : 0;
    });

    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.planSvc.getAll().subscribe(p => this.plans = p);
    this.customerSvc.getById(id).subscribe(c => {
      this.customer = c;
      this.loading = false;
      if (c) {
        this.paymentForm?.patchValue({ amount: c.monthlyRent ?? 0 });
        this.loadServiceRecords(id);
        this.loadPayments();
        this.loadComments();
        this.loadComplaints();
      }
    });
    this.initForms();
    this.loadTechnicians();
  }

  initForms(): void {
    const curMonth = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    const nextService = new Date();
    nextService.setMonth(nextService.getMonth() + 3);
    this.serviceForm = this.fb.group({
      serviceType: ['filter-change', Validators.required],
      serviceDate: [new Date(), Validators.required],
      nextServiceDate: [nextService],
      technicianName: ['', Validators.required],
      partsReplaced: [''],
      notes: [''],
      cost: [0]
    });
    this.paymentForm = this.fb.group({
      amount: [this.customer?.monthlyRent ?? 0, Validators.required],
      paidDate: [new Date(), Validators.required],
      forMonth: [curMonth, Validators.required],
      receiver: ['Charan', Validators.required],
      notes: ['']
    });
    this.commentForm = this.fb.group({
      comment: ['', [Validators.required, Validators.maxLength(1000)]]
    });
  }

  loadServiceRecords(id: number): void {
    this.serviceSvc.getByCustomer(id).subscribe(s => {
      this.serviceRecords = s;
    });
  }

  loadPayments(): void {
    this.paymentSvc.getByCustomer(this.customer!.id!).subscribe(p => {
      this.payments = p;
      this.totalPaid = p.reduce((s, x) => s + x.amount, 0);
    });
  }

  loadComments(): void {
    this.commentSvc.getByCustomer(this.customer!.id!).subscribe(comments => {
      this.comments = comments.slice().reverse();
    });
  }

  loadComplaints(): void {
    if (!this.customer?.id) return;
    this.complaintSvc.getByCustomer(this.customer.id).subscribe(complaints => {
      this.complaints = complaints.slice().reverse();
    });
  }

  private loadTechnicians(): void {
    this.technicianSvc.getAll().subscribe(t => this.technicians = t);
    this.technicianSvc.getDefault().subscribe(defaultTech => {
      if (defaultTech) {
        this.defaultTechnicianName = defaultTech.name;
        if (this.serviceForm && !this.serviceForm.value.technicianName) {
          this.serviceForm.patchValue({ technicianName: defaultTech.name });
        }
      }
    });
  }

  addService(): void {
    if (this.serviceForm.invalid) return;
    const val = this.serviceForm.value;
    this.serviceSvc.add({
      ...val,
      customerId: this.customer!.id!,
      customerName: this.customer!.name
    }).subscribe(() => {
      this.customerSvc.update(this.customer!.id!, {
        lastServiceDate: new Date(val.serviceDate),
        nextServiceDate: val.nextServiceDate ? new Date(val.nextServiceDate) : undefined
      }).subscribe(() => {
        this.customerSvc.getById(this.customer!.id!).subscribe(c => this.customer = c);
      });

      this.snack.open('Service logged!', 'OK', { duration: 3000 });
      this.showAddService = false;
      this.loadServiceRecords(this.customer!.id!);
      const nextService = new Date();
      nextService.setMonth(nextService.getMonth() + 3);
      this.serviceForm.reset({
        serviceType: 'filter-change',
        serviceDate: new Date(),
        nextServiceDate: nextService,
        technicianName: this.defaultTechnicianName || '',
        partsReplaced: '',
        notes: '',
        cost: 0
      });
    });
  }

  addPayment(): void {
    if (this.paymentForm.invalid) return;
    const val = this.paymentForm.value;
    this.paymentSvc.add({ ...val, customerId: this.customer!.id! }).subscribe(() => {
      // Update next due date by 1 month
      const nextDue = new Date(this.customer!.nextDueDate);
      nextDue.setMonth(nextDue.getMonth() + 1);
      this.customerSvc.update(this.customer!.id!, { nextDueDate: nextDue, lastPaymentDate: new Date(), status: 'active' }).subscribe();

      this.snack.open('Payment recorded!', 'OK', { duration: 3000 });
      this.showAddPayment = false;
      this.loadPayments();
    });
  }

  deleteService(s: ServiceRecord): void {
    if (!confirm('Delete this service record?')) return;
    this.serviceSvc.delete(s.id!).subscribe(() => {
      this.snack.open('Deleted', 'OK', { duration: 2000 });
      this.loadServiceRecords(this.customer!.id!);
    });
  }

  deletePayment(p: PaymentRecord): void {
    if (!confirm('Delete this payment record?')) return;
    this.paymentSvc.delete(p.id!).subscribe(() => {
      this.snack.open('Deleted', 'OK', { duration: 2000 });
      this.loadPayments();
    });
  }

  addComment(): void {
    if (this.commentForm.invalid || !this.customer?.id) return;

    const comment = (this.commentForm.value.comment ?? '').trim();
    if (!comment) return;

    this.commentSvc.add({
      customerId: this.customer.id,
      comment
    }).subscribe(() => {
      this.snack.open('Comment added', 'OK', { duration: 2000 });
      this.showAddComment = false;
      this.commentForm.reset({ comment: '' });
      this.loadComments();
    });
  }

  deleteComment(comment: CustomerComment): void {
    if (!comment.id || !confirm('Delete this comment?')) return;

    this.commentSvc.delete(comment.id).subscribe(() => {
      this.snack.open('Comment deleted', 'OK', { duration: 2000 });
      this.loadComments();
    });
  }

  deleteComplaint(complaint: CustomerComplaint): void {
    if (!complaint.id || !confirm('Delete this complaint?')) return;

    this.complaintSvc.delete(complaint.id).subscribe(() => {
      this.snack.open('Complaint deleted', 'OK', { duration: 2000 });
      this.loadComplaints();
    });
  }

  openComplaintComments(complaint: CustomerComplaint): void {
    if (!complaint.id || !this.customer) return;

    this.dialog.open(ComplaintCommentsDialogComponent, {
      width: '560px',
      data: {
        complaintId: complaint.id,
        customerId: this.customer.id!,
        customerName: this.customer.name,
        complaint: complaint.complaint,
        resolved: complaint.resolved
      }
    });
  }

  resolveComplaint(complaint: CustomerComplaint): void {
    if (!complaint.id || complaint.resolved) return;
    if (!confirm('Mark this complaint as resolved?')) return;

    this.complaintSvc.update(complaint.id, { resolved: true }).subscribe(() => {
      this.snack.open('Complaint marked as resolved', 'OK', { duration: 2000 });
      this.loadComplaints();
    });
  }

  reopenComplaint(complaint: CustomerComplaint): void {
    if (!complaint.id || !complaint.resolved) return;
    if (!confirm('Reopen this complaint?')) return;

    this.complaintSvc.update(complaint.id, { resolved: false }).subscribe(() => {
      this.snack.open('Complaint reopened', 'OK', { duration: 2000 });
      this.loadComplaints();
    });
  }

  editCustomer(): void {
    const ref = this.dialog.open(CustomerFormDialogComponent, {
      width: '560px',
      data: { customer: this.customer, plans: this.plans }
    });
    ref.afterClosed().subscribe(result => {
      if (result) {
        this.customerSvc.getById(this.customer!.id!).subscribe(c => this.customer = c);
      }
    });
  }

  sendReminder(): void {
    if (this.customer) this.waSvc.sendRentReminder(this.customer);
  }

  getPaymentLink(): string {
    return this.customer ? this.paymentLinkSvc.getPaymentUrl(this.customer) : '';
  }

  openPaymentLink(): void {
    const url = this.getPaymentLink();
    if (!url) return;
    window.open(url, '_blank');
  }

  copyPhone(): void {
    if (!this.customer) return;
    
    const phone = this.customer.phone;
    navigator.clipboard.writeText(phone).then(() => {
      this.snack.open('Phone number copied', 'OK', { duration: 2500 });
    }).catch(() => {
      this.snack.open('Unable to copy phone number', 'OK', { duration: 2500 });
    });
  }

  async copyPaymentLink(): Promise<void> {
    const url = this.getPaymentLink();
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      this.snack.open('Payment link copied', 'OK', { duration: 2500 });
    } catch {
      this.snack.open('Unable to copy payment link', 'OK', { duration: 2500 });
    }
  }

  isOverdue(): boolean {
    return this.customer ? new Date(this.customer.nextDueDate) < new Date() : false;
  }

  getServiceIcon(type: ServiceType): string {
    const m: Record<string, string> = {
      'filter-change': 'filter_alt', 'repair': 'handyman',
      'installation': 'plumbing', 'general-service': 'build', 'demo': 'play_circle'
    };
    return m[type] ?? 'build';
  }

  getServiceColor(type: ServiceType): string {
    const m: Record<string, string> = {
      'filter-change': '#0097a7', 'repair': '#e53935',
      'installation': '#43a047', 'general-service': '#7b1fa2', 'demo': '#1565c0'
    };
    return m[type] ?? '#757575';
  }

  getServiceLabel(type: ServiceType): string {
    return SERVICE_TYPE_LABELS[type] ?? type;
  }

  get totalServiceCost(): number {
    return this.serviceRecords.reduce((sum, r) => sum + (r.cost ?? 0), 0);
  }

  get initialInvestment(): number {
    return this.customer?.initialInvestment ?? 0;
  }

  get grossProfit(): number {
    return this.totalPaid - this.totalServiceCost;
  }

  get returnDelta(): number {
    return this.grossProfit - this.initialInvestment;
  }

  get financeStatus(): string {
    if (this.returnDelta > 0) {
      return `Profit by ₹${this.returnDelta.toFixed(0)}`;
    }
    if (this.returnDelta < 0) {
      return `Loss by ₹${Math.abs(this.returnDelta).toFixed(0)}`;
    }
    return 'Cost to cost';
  }

  get financeStatusClass(): string {
    if (this.returnDelta > 0) return 'chip chip-success';
    if (this.returnDelta < 0) return 'chip chip-danger';
    return 'chip chip-warning';
  }

  onRecordPaymentClick(): void {
    if (this.customer?.monthlyRent) {
      this.paymentForm.get('notes')?.setValue('');
    }
    this.showAddPayment = true;
  }

  onServiceDateChange(date: Date | null): void {
    if (!date) return;
    const next = new Date(date);
    next.setMonth(next.getMonth() + 3);
    this.serviceForm.patchValue({ nextServiceDate: next });
  }

  getServiceDueClass(date?: Date): string {
    if (!date) return 'chip chip-muted';

    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
    if (diff < 0) return 'chip chip-danger';
    if (diff <= 7) return 'chip chip-warning';
    return 'chip chip-success';
  }
}
