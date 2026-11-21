import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RealtimeCrmService } from '../../core/services/realtime-crm.service';
import { Customer, PaymentLinkRecord } from '../../core/models/models';

@Component({
  selector: 'app-customer-pay',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatSnackBarModule],
  template: `
    <div class="pay-portal-wrap fade-in">
      <div class="pay-card">
        <div class="pay-brand-header">
          <div class="pay-logo">💧</div>
          <div>
            <h2>Aqua Purifier Rentals</h2>
            <p>Monthly Rental Payment · Tirupati</p>
          </div>
          <span class="secure-badge">
            <mat-icon>verified_user</mat-icon> Secure
          </span>
        </div>

        @if (loading) {
          <div class="pay-state-box">
            <p>Loading invoice details...</p>
          </div>
        }

        @if (!loading && errorMessage) {
          <div class="pay-state-box pay-error">
            <mat-icon>error_outline</mat-icon>
            <h3>Invoice Not Found</h3>
            <p>{{ errorMessage }}</p>
          </div>
        }

        @if (!loading && link) {
          <div class="payment-id-banner">
            <div>
              <span class="id-label">PAYMENT ID</span>
              <strong class="id-code">{{ link.paymentId }}</strong>
            </div>
            <span class="status-pill" [class.paid]="link.status === 'PAID'">
              {{ link.status === 'PAID' ? 'PAID ✓' : 'PAYMENT DUE' }}
            </span>
          </div>

          <div class="invoice-grid">
            <div class="inv-item">
              <span class="inv-label">Customer</span>
              <strong class="inv-val">{{ link.customerName }}</strong>
            </div>
            <div class="inv-item">
              <span class="inv-label">Phone</span>
              <strong class="inv-val">{{ link.customerPhone }}</strong>
            </div>
            <div class="inv-item">
              <span class="inv-label">Purifier</span>
              <strong class="inv-val">{{ link.purifierModel }}</strong>
            </div>
            <div class="inv-item">
              <span class="inv-label">Billing Month</span>
              <strong class="inv-val">{{ link.forMonth }}</strong>
            </div>
            <div class="inv-item">
              <span class="inv-label">Start Date</span>
              <strong class="inv-val">{{ link.onboardingDate | date:'dd MMM yyyy' }}</strong>
            </div>
            <div class="inv-item">
              <span class="inv-label">Due Date</span>
              <strong class="inv-val due-highlight">{{ link.dueDate | date:'dd MMM yyyy' }}</strong>
            </div>
          </div>

          <div class="amount-box">
            <span>Monthly Rent Amount</span>
            <strong>₹{{ link.amount }}</strong>
          </div>

          @if (link.status !== 'PAID') {
            <div class="method-section">
              <label class="method-heading">Select Payment Method</label>
              <div class="method-options">
                <button
                  type="button"
                  class="method-btn"
                  [class.active]="selectedMethod === 'UPI'"
                  (click)="selectedMethod = 'UPI'">
                  <mat-icon>qr_code_2</mat-icon>
                  <span>UPI / GPay / PhonePe</span>
                </button>
                <button
                  type="button"
                  class="method-btn"
                  [class.active]="selectedMethod === 'Razorpay'"
                  (click)="selectedMethod = 'Razorpay'">
                  <mat-icon>account_balance_wallet</mat-icon>
                  <span>Razorpay</span>
                </button>
                <button
                  type="button"
                  class="method-btn"
                  [class.active]="selectedMethod === 'Card'"
                  (click)="selectedMethod = 'Card'">
                  <mat-icon>credit_card</mat-icon>
                  <span>Card / NetBanking</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              class="pay-submit-btn"
              [disabled]="processing"
              (click)="completePayment()">
              <mat-icon>lock</mat-icon>
              <span>{{ processing ? 'Processing...' : 'Pay ₹' + link.amount }}</span>
            </button>
          }

          @if (link.status === 'PAID') {
            <div class="paid-success-box">
              <div class="paid-header">
                <mat-icon>check_circle</mat-icon>
                <div>
                  <h3>Payment Successful</h3>
                  <p>Thank you for your payment.</p>
                </div>
              </div>
              <div class="receipt-meta">
                <div><span>Ref:</span> <strong>{{ link.transactionRef || 'PAID' }}</strong></div>
                <div><span>Paid On:</span> <strong>{{ (link.paidAt || link.createdAt) | date:'dd MMM yyyy' }}</strong></div>
                <div><span>Amount:</span> <strong>₹{{ link.amount }}</strong></div>
                <div><span>Next Due:</span> <strong>{{ customer?.nextDueDate | date:'dd MMM yyyy' }}</strong></div>
              </div>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .pay-portal-wrap {
      max-width: 480px;
      margin: 16px auto;
      padding: 8px;
    }
    .pay-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 18px;
      box-shadow: 0 6px 20px rgba(15, 23, 42, 0.05);
    }
    .pay-brand-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding-bottom: 12px;
      border-bottom: 1px solid #f1f5f9;
      margin-bottom: 12px;
    }
    .pay-logo {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      background: #eff6ff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
    }
    .pay-brand-header h2 {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
    }
    .pay-brand-header p {
      margin: 1px 0 0;
      font-size: 11px;
      color: #64748b;
    }
    .secure-badge {
      margin-left: auto;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #ecfdf5;
      color: #059669;
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 600;
    }
    .secure-badge mat-icon {
      font-size: 12px;
      width: 12px;
      height: 12px;
    }
    .payment-id-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      padding: 8px 12px;
      margin-bottom: 12px;
    }
    .id-label {
      display: block;
      font-size: 9px;
      font-weight: 700;
      color: #64748b;
    }
    .id-code {
      font-size: 12px;
      font-weight: 800;
      color: #0284c7;
      font-family: monospace;
    }
    .status-pill {
      padding: 3px 9px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      background: #fef3c7;
      color: #d97706;
    }
    .status-pill.paid {
      background: #dcfce7;
      color: #15803d;
    }
    .invoice-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin-bottom: 12px;
    }
    .inv-item {
      background: #f8fafc;
      padding: 7px 10px;
      border-radius: 6px;
      border: 1px solid #f1f5f9;
    }
    .inv-label {
      display: block;
      font-size: 9.5px;
      color: #64748b;
    }
    .inv-val {
      font-size: 11.5px;
      color: #0f172a;
      font-weight: 600;
    }
    .due-highlight {
      color: #dc2626;
    }
    .amount-box {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #0284c7;
      color: #ffffff;
      padding: 10px 14px;
      border-radius: 8px;
      margin-bottom: 12px;
    }
    .amount-box span {
      font-size: 11.5px;
      font-weight: 500;
    }
    .amount-box strong {
      font-size: 18px;
      font-weight: 800;
    }
    .method-section {
      margin-bottom: 12px;
    }
    .method-heading {
      display: block;
      font-size: 10.5px;
      font-weight: 600;
      color: #475569;
      margin-bottom: 6px;
    }
    .method-options {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
    }
    .method-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      padding: 7px 4px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #ffffff;
      cursor: pointer;
      font-size: 10px;
      font-weight: 600;
      color: #334155;
    }
    .method-btn.active {
      border-color: #0284c7;
      background: #f0f9ff;
      color: #0284c7;
    }
    .pay-submit-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      background: #16a34a;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 12.5px;
      font-weight: 700;
      cursor: pointer;
    }
    .paid-success-box {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 12px;
    }
    .paid-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      color: #15803d;
    }
    .paid-header h3 {
      margin: 0;
      font-size: 13px;
      font-weight: 700;
    }
    .paid-header p {
      margin: 1px 0 0;
      font-size: 10.5px;
      color: #166534;
    }
    .receipt-meta {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 6px;
      font-size: 10.5px;
      color: #1e293b;
      background: #ffffff;
      padding: 8px;
      border-radius: 6px;
    }
    .pay-state-box {
      text-align: center;
      padding: 20px 12px;
      font-size: 11.5px;
      color: #475569;
    }
  `]
})
export class CustomerPayComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly crm = inject(RealtimeCrmService);
  private readonly snack = inject(MatSnackBar);

  paymentId = '';
  loading = true;
  processing = false;
  errorMessage = '';
  selectedMethod = 'UPI';

  link: PaymentLinkRecord | null = null;
  customer: Customer | null = null;

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.paymentId = params.get('paymentId') || '';
      if (this.paymentId) {
        this.loadLink();
      } else {
        this.loading = false;
        this.errorMessage = 'Invalid payment link.';
      }
    });
  }

  loadLink(): void {
    this.loading = true;
    this.errorMessage = '';
    this.crm.getPaymentLinkDetails(this.paymentId).subscribe({
      next: res => {
        this.link = res.paymentLink;
        this.customer = res.customer;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Invoice not found.';
      }
    });
  }

  completePayment(): void {
    if (!this.link || this.processing) return;
    this.processing = true;

    this.crm
      .completePaymentByLink(this.link.paymentId, {
        paymentMethod: this.selectedMethod
      })
      .subscribe({
        next: res => {
          this.processing = false;
          this.link = res.paymentLink;
          this.customer = res.customer;
          this.snack.open('Payment completed successfully!', 'OK', { duration: 3000 });
        },
        error: () => {
          this.processing = false;
          this.snack.open('Failed to process payment.', 'OK', { duration: 3000 });
        }
      });
  }
}
