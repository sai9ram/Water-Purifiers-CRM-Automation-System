import { Injectable } from '@angular/core';
import { Customer } from '../models/models';

@Injectable({ providedIn: 'root' })
export class PaymentLinkService {
  private readonly paymentBaseUrl = 'https://pay.purehomewaters.com/pay.html';

  getPaymentUrl(customer: Customer, amount = customer.monthlyRent ?? 0): string {
    const params = new URLSearchParams({
      am: String(amount),
      type: 'rent'
    });

    return `${this.paymentBaseUrl}?${params.toString()}`;
  }
}
