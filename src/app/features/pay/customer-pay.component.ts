import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RealtimeCrmService } from '../../core/services/realtime-crm.service';
import { Customer, PaymentLinkRecord, WhatsAppAutomationLog } from '../../core/models/models';

@Component({
  selector: 'app-customer-pay',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, MatButtonModule, MatSnackBarModule],
  template: `
    <div class="pay-portal-wrap fade-in">
      <div class="pay-card">
        <!-- Brand Header -->
        <div class="pay-brand-header">
          <div class="pay-logo">💧</div>
          <div>
            <h2>Pure Home Waters</h2>
            <p>Official Automated Rent Payment Portal · Tirupati</p>
          </div>
          <span class="secure-badge">
            <mat-icon>verified_user</mat-icon> 100% Secure
          </span>
        </div>

        @if (loading) {
          <div class="pay-state-box">
            <p>Loading your unique payment invoice...</p>
          </div>
        }

        @if (!loading && errorMessage) {
          <div class="pay-state-box pay-error">
            <mat-icon>error_outline</mat-icon>
            <h3>Payment Link Not Found</h3>
            <p>{{ errorMessage }}</p>
            <a routerLink="/reminders" class="back-crm-btn">Back to CRM</a>
          </div>
        }

        @if (!loading && link) {
          <!-- Unique Payment ID Banner -->
          <div class="payment-id-banner">
            <div>
              <span class="id-label">UNIQUE PAYMENT ID</span>
              <strong class="id-code">{{ link.paymentId }}</strong>
            </div>
            <span class="status-pill" [class.paid]="link.status === 'PAID'">
              {{ link.status === 'PAID' ? 'PAID ✓' : 'PAYMENT DUE' }}
            </span>
          </div>

          <!-- Customer & Invoice Details -->
          <div class="invoice-grid">
            <div class="inv-item">
              <span class="inv-label">Customer Name</span>
              <strong class="inv-val">{{ link.customerName }}</strong>
            </div>
            <div class="inv-item">
              <span class="inv-label">Phone Number</span>
              <strong class="inv-val">{{ link.customerPhone }}</strong>
            </div>
            <div class="inv-item">
              <span class="inv-label">Purifier & Plan</span>
              <strong class="inv-val">{{ link.purifierModel }} ({{ link.planName }})</strong>
            </div>
            <div class="inv-item">
              <span class="inv-label">Billing Cycle</span>
              <strong class="inv-val">{{ link.forMonth }}</strong>
            </div>
            <div class="inv-item">
              <span class="inv-label">Onboarded Date</span>
              <strong class="inv-val">{{ link.onboardingDate | date:'dd MMM yyyy' }}</strong>
            </div>
            <div class="inv-item">
              <span class="inv-label">Due Date</span>
              <strong class="inv-val due-highlight">{{ link.dueDate | date:'dd MMM yyyy' }}</strong>
            </div>
          </div>

          <!-- Amount Box -->
          <div class="amount-box">
            <span>Total Monthly Rent Payable</span>
            <strong>₹{{ link.amount }}</strong>
          </div>

          @if (link.status !== 'PAID') {
            <!-- Payment Method Selector -->
            <div class="method-section">
              <label class="method-heading">Choose Payment Mode</label>
              <div class="method-options">
                <button
                  type="button"
                  class="method-btn"
                  [class.active]="selectedMethod === 'UPI (GPay / PhonePe / Paytm)'"
                  (click)="selectedMethod = 'UPI (GPay / PhonePe / Paytm)'">
                  <mat-icon>qr_code_2</mat-icon>
                  <span>UPI (GPay / PhonePe)</span>
                </button>
                <button
                  type="button"
                  class="method-btn"
                  [class.active]="selectedMethod === 'Razorpay Checkout'"
                  (click)="selectedMethod = 'Razorpay Checkout'">
                  <mat-icon>account_balance_wallet</mat-icon>
                  <span>Razorpay Gateway</span>
                </button>
                <button
                  type="button"
                  class="method-btn"
                  [class.active]="selectedMethod === 'Debit / Credit Card'"
                  (click)="selectedMethod = 'Debit / Credit Card'">
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
              <mat-icon>bolt</mat-icon>
              <span>{{ processing ? 'Processing Real-Time Payment...' : 'Pay ₹' + link.amount + ' Now (Instant CRM Sync)' }}</span>
            </button>

            <p class="auto-note">
              As soon as you complete this payment, your account is automatically moved from the Unpaid list to the Paid list in Pure Home Waters CRM, your next due date is updated, and a WhatsApp receipt is sent to {{ link.customerPhone }}.
            </p>
          }

          @if (link.status === 'PAID') {
            <div class="paid-success-box">
              <div class="paid-header">
                <mat-icon>check_circle</mat-icon>
                <div>
                  <h3>Payment Completed & Synced to CRM!</h3>
                  <p>Customer has been automatically moved from Unpaid to Paid list.</p>
                </div>
              </div>
              <div class="receipt-meta">
                <div><span>Transaction Ref:</span> <strong>{{ link.transactionRef || 'TXN-VERIFIED' }}</strong></div>
                <div><span>Paid On:</span> <strong>{{ (link.paidAt || link.createdAt) | date:'dd MMM yyyy, hh:mm a' }}</strong></div>
                <div><span>Next Cycle Due Date:</span> <strong>{{ customer?.nextDueDate | date:'dd MMM yyyy' }}</strong></div>
                <div><span>WhatsApp Receipt:</span> <strong class="wa-sent">Auto-Sent to {{ link.customerPhone }} ✓</strong></div>
              </div>

              @if (receiptLog) {
                <div class="wa-receipt-preview">
                  <span class="wa-preview-label">Automated WhatsApp Receipt Sent:</span>
                  <pre>{{ receiptLog.message }}</pre>
                </div>
              }

              <div class="paid-actions">
                <a routerLink="/reminders" class="back-crm-btn">View Unpaid Reminders List</a>
                <a routerLink="/payments" class="back-crm-btn secondary">View Paid Customers List</a>
              </div>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .pay-portal-wrap {
      max-width: 540px;
      margin: 12px auto;
      padding: 8px;
    }
    .pay-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 20px;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
    }
    .pay-brand-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding-bottom: 14px;
      border-bottom: 1px solid #f1f5f9;
      margin-bottom: 14px;
    }
    .pay-logo {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: #eff6ff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
    }
    .pay-brand-header h2 {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
    }
    .pay-brand-header p {
      margin: 2px 0 0;
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
      padding: 4px 8px;
      border-radius: 999px;
      font-size: 10.5px;
      font-weight: 600;
    }
    .secure-badge mat-icon {
      font-size: 13px;
      width: 13px;
      height: 13px;
    }
    .payment-id-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 10px;
      padding: 10px 14px;
      margin-bottom: 14px;
    }
    .id-label {
      display: block;
      font-size: 9.5px;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 0.05em;
    }
    .id-code {
      font-size: 13px;
      font-weight: 800;
      color: #0284c7;
      font-family: monospace;
    }
    .status-pill {
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 10.5px;
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
      gap: 10px;
      margin-bottom: 14px;
    }
    .inv-item {
      background: #f8fafc;
      padding: 8px 11px;
      border-radius: 8px;
      border: 1px solid #f1f5f9;
    }
    .inv-label {
      display: block;
      font-size: 10px;
      color: #64748b;
      margin-bottom: 2px;
    }
    .inv-val {
      font-size: 12px;
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
      background: linear-gradient(135deg, #0284c7, #0369a1);
      color: #ffffff;
      padding: 12px 16px;
      border-radius: 10px;
      margin-bottom: 14px;
    }
    .amount-box span {
      font-size: 12px;
      font-weight: 500;
    }
    .amount-box strong {
      font-size: 20px;
      font-weight: 800;
    }
    .method-section {
      margin-bottom: 14px;
    }
    .method-heading {
      display: block;
      font-size: 11px;
      font-weight: 600;
      color: #475569;
      margin-bottom: 6px;
    }
    .method-options {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .method-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 8px 6px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #ffffff;
      cursor: pointer;
      font-size: 10.5px;
      font-weight: 600;
      color: #334155;
      transition: all 0.15s ease;
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
      gap: 8px;
      background: #16a34a;
      color: #ffffff;
      border: none;
      border-radius: 10px;
      padding: 12px 16px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .pay-submit-btn:hover:not(:disabled) {
      background: #15803d;
    }
    .pay-submit-btn:disabled {
      opacity: 0.65;
      cursor: wait;
    }
    .auto-note {
      margin: 10px 0 0;
      font-size: 10.5px;
      color: #64748b;
      text-align: center;
      line-height: 1.45;
    }
    .paid-success-box {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 10px;
      padding: 14px;
    }
    .paid-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
      color: #15803d;
    }
    .paid-header h3 {
      margin: 0;
      font-size: 13.5px;
      font-weight: 700;
    }
    .paid-header p {
      margin: 2px 0 0;
      font-size: 11px;
      color: #166534;
    }
    .receipt-meta {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 6px;
      font-size: 11px;
      color: #1e293b;
      background: #ffffff;
      padding: 10px;
      border-radius: 8px;
      margin-bottom: 10px;
    }
    .wa-sent {
      color: #15803d;
    }
    .wa-receipt-preview {
      background: #ffffff;
      border: 1px solid #dcfce7;
      border-radius: 8px;
      padding: 8px 10px;
      margin-bottom: 12px;
    }
    .wa-preview-label {
      display: block;
      font-size: 10px;
      font-weight: 700;
      color: #15803d;
      margin-bottom: 4px;
    }
    .wa-receipt-preview pre {
      margin: 0;
      white-space: pre-wrap;
      font-size: 10.5px;
      color: #334155;
      font-family: inherit;
    }
    .paid-actions {
      display: flex;
      gap: 8px;
    }
    .back-crm-btn {
      flex: 1;
      text-align: center;
      text-decoration: none;
      padding: 8px 12px;
      border-radius: 8px;
      background: #0284c7;
      color: #ffffff;
      font-size: 11.5px;
      font-weight: 600;
    }
    .back-crm-btn.secondary {
      background: #0f172a;
    }
    .pay-state-box {
      text-align: center;
      padding: 24px 12px;
      font-size: 12px;
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
  selectedMethod = 'UPI (GPay / PhonePe / Paytm)';

  link: PaymentLinkRecord | null = null;
  customer: Customer | null = null;
  receiptLog: WhatsAppAutomationLog | null = null;

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.paymentId = params.get('paymentId') || '';
      if (this.paymentId) {
        this.loadLink();
      } else {
        this.loading = false;
        this.errorMessage = 'Missing payment link ID.';
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
        this.errorMessage = `Could not find an active invoice for Payment ID "${this.paymentId}".`;
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
          this.receiptLog = res.whatsappReceipt || null;
          this.snack.open(
            `Payment of ₹${this.link.amount} recorded! ${this.link.customerName} moved to Paid list.`,
            'OK',
            { duration: 4000 }
          );
        },
        error: () => {
          this.processing = false;
          this.snack.open('Failed to complete payment. Please try again.', 'OK', { duration: 3000 });
        }
      });
  }
}
