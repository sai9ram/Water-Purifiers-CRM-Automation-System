import { Injectable } from '@angular/core';
import { Customer } from '../models/models';
import { PaymentLinkService } from './payment-link.service';

@Injectable({ providedIn: 'root' })
export class WhatsappService {
  constructor(private paymentLinkSvc: PaymentLinkService) {}

  generateRentReminderMessage(customer: Customer): string {
    const dueObj = new Date(customer.nextDueDate);
    const validDue = Number.isNaN(dueObj.getTime()) ? new Date() : dueObj;
    const month = validDue.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    const dueDate = validDue.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const onboardDate = customer.joinDate
      ? new Date(customer.joinDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : dueDate;
    const rent = customer.monthlyRent ?? 0;
    const paymentId = this.paymentLinkSvc.getUniquePaymentId(customer);
    const paymentLink = this.paymentLinkSvc.getPaymentUrl(customer, rent);
    const rupee = 'Rs.';

    return [
      `Hello *${customer.name}*,`,
      '',
      'Automated Reminder from *Aqua Purifier Rentals* 💧',
      '',
      `Your monthly water purifier (*${customer.purifierModel}*) rental payment of *${rupee}${rent}* is due for *${month}*.`,
      '',
      `• *Unique Payment ID:* ${paymentId}`,
      `• *Monthly Rent:* ${rupee}${rent}/-`,
      `• *Onboarded Date:* ${onboardDate}`,
      `• *Next Due Date:* ${dueDate}`,
      '',
      'Pay securely using your unique payment link below:',
      paymentLink,
      '',
      '_Once paid using this link, your payment immediately reflects in our CRM and marks your account as PAID._',
      '',
      'Thank you for choosing Aqua Purifier Rentals!',
      '- Aqua Purifier Rentals, Tirupati'
    ].join('\n');
  }

  generateServiceReminderMessage(customer: Customer): string {
    return [
      `Hello ${customer.name},`,
      '',
      'This is a service reminder from *Aqua Purifier Rentals*.',
      '',
      `Your water purifier (*${customer.purifierModel}*) is due for its regular maintenance service.`,
      '',
      'Please confirm a convenient time and our technician will visit you.',
      '',
      'Call us to schedule your service appointment.',
      '',
      'Thank you!',
      '- Aqua Purifier Rentals, Tirupati'
    ].join('\n');
  }

  openWhatsApp(phone: string, message: string): void {
    const cleaned = phone.replace(/\D/g, '');
    const number = cleaned.startsWith('91') ? cleaned : `91${cleaned}`;
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${number}?text=${encoded}`, '_blank');
  }

  sendRentReminder(customer: Customer): void {
    const message = this.generateRentReminderMessage(customer);
    this.openWhatsApp(customer.phone, message);
  }

  sendServiceReminder(customer: Customer): void {
    const message = this.generateServiceReminderMessage(customer);
    this.openWhatsApp(customer.phone, message);
  }

  generateBulkLinks(customers: Customer[]): { customer: Customer; url: string }[] {
    return customers.map(c => ({
      customer: c,
      url: `https://wa.me/91${c.phone.replace(/\D/g, '')}?text=${encodeURIComponent(this.generateRentReminderMessage(c))}`
    }));
  }
}
