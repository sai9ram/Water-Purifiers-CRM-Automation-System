import { Injectable } from '@angular/core';
import { Customer } from '../models/models';

@Injectable({ providedIn: 'root' })
export class PaymentLinkService {
  getUniquePaymentId(customer: Customer): string {
    if (customer.uniquePaymentId) {
      return customer.uniquePaymentId;
    }
    const due = customer.nextDueDate ? new Date(customer.nextDueDate) : new Date();
    const validDue = Number.isNaN(due.getTime()) ? new Date() : due;
    const ym = `${validDue.getFullYear()}${String(validDue.getMonth() + 1).padStart(2, '0')}`;
    const custCode = String(customer.id ?? 1).padStart(3, '0');
    return `PAY-PHW-${custCode}-${ym}`;
  }

  getPaymentUrl(customer: Customer, _amount = customer.monthlyRent ?? 0): string {
    if (customer.paymentLinkUrl) {
      return customer.paymentLinkUrl;
    }
    const paymentId = this.getUniquePaymentId(customer);
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://pure-home-waters-zeta.vercel.app';
    return `${origin}/pay/${paymentId}`;
  }
}
