import { Injectable } from '@angular/core';
import { Customer } from '../models/models';

@Injectable({ providedIn: 'root' })
export class WhatsappService {

  generateRentReminderMessage(customer: Customer): string {
    const month    = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    const dueDate  = new Date(customer.nextDueDate).toLocaleDateString('en-IN');
    const rent     = customer.monthlyRent ?? 0;

    return `Hello ${customer.name} 🙏,

This is a friendly reminder from *Pure Home Waters* 💧.

Your monthly water purifier rental payment of *₹${rent}* is due for *${month}*.

📅 Due Date: ${dueDate}
🏠 Purifier: ${customer.purifierModel}
📍 Address: ${customer.area}

Please make the payment at your earliest convenience.

For any queries, feel free to reach us anytime.

Thank you for choosing Pure Home Waters! 🙏
_Pure Home Waters, Tirupati_`;
  }

  generateServiceReminderMessage(customer: Customer): string {
    return `Hello ${customer.name} 🙏,

This is a service reminder from *Pure Home Waters* 💧.

Your water purifier (*${customer.purifierModel}*) is due for its regular maintenance service.

Please confirm a convenient time and our technician will visit you.

📞 Call us to schedule your service appointment.

Thank you!
_Pure Home Waters, Tirupati_`;
  }

  openWhatsApp(phone: string, message: string): void {
    const cleaned = phone.replace(/\D/g, '');
    const number  = cleaned.startsWith('91') ? cleaned : `91${cleaned}`;
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

  generateBulkLinks(customers: Customer[]): Array<{ customer: Customer; url: string }> {
    return customers.map(c => ({
      customer: c,
      url: `https://wa.me/91${c.phone.replace(/\D/g,'')}?text=${encodeURIComponent(this.generateRentReminderMessage(c))}`
    }));
  }
}
