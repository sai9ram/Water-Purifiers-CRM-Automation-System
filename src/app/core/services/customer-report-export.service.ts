import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { db } from '../db/database';
import { Customer, PaymentRecord, ServiceRecord } from '../models/models';

@Injectable({ providedIn: 'root' })
export class CustomerReportExportService {
  async exportCustomerReport(options: {
    startDate?: Date | null;
    endDate?: Date | null;
    fileName?: string;
  } = {}): Promise<void> {
    const [customers, payments, services, plans] = await Promise.all([
      db.customers.toArray(),
      db.payments.toArray(),
      db.serviceRecords.toArray(),
      db.rentalPlans.toArray()
    ]);

    const planMap = new Map(plans.map(plan => [plan.id!, plan.monthlyRent]));

    // Create workbook with multiple sheets
    const wb = XLSX.utils.book_new();

    // Sheet 1: Customer Details
    const customerDetailsData = customers.map(customer => {
      const monthlyRent = customer.monthlyRent ?? planMap.get(customer.planId) ?? 0;
      return {
        'Customer Name': customer.name,
        'Phone': customer.phone,
        'Area': customer.area,
        'Status': customer.status,
        'Installation Date': this.formatDate(customer.joinDate),
        'Deposit Amount': customer.depositPaid,
        'Monthly Rent': monthlyRent,
        'Next Due Date': customer.nextDueDate ? this.formatDate(customer.nextDueDate) : '',
        'Last Payment Date': customer.lastPaymentDate ? this.formatDate(customer.lastPaymentDate) : '',
        'Last Service Date': customer.lastServiceDate ? this.formatDate(customer.lastServiceDate) : '',
        'Next Service Date': customer.nextServiceDate ? this.formatDate(customer.nextServiceDate) : '',
        'Notes': customer.notes ?? ''
      };
    });
    const wsCustomerDetails = XLSX.utils.json_to_sheet(customerDetailsData);
    this.autoFitColumns(wsCustomerDetails, customerDetailsData);
    XLSX.utils.book_append_sheet(wb, wsCustomerDetails, 'Customer Details');

    // Sheet 2: Rent History (Monthly Rent by Customer)
    const rentMonths = Array.from(
      new Set(payments.map(payment => payment.forMonth).filter(Boolean))
    ).sort((a, b) => this.parseForMonth(a).getTime() - this.parseForMonth(b).getTime());

    const paymentMap = new Map<string, number>();
    payments.forEach(payment => {
      const key = `${payment.customerId}__${payment.forMonth}`;
      paymentMap.set(key, (paymentMap.get(key) ?? 0) + payment.amount);
    });

    const rentHistoryData: any[] = [];
    customers.forEach(customer => {
      const monthlyRent = customer.monthlyRent ?? planMap.get(customer.planId) ?? 0;
      const rentRow: Record<string, string | number> = {
        'Customer Name': customer.name,
        'Monthly Rent': monthlyRent,
        'Rent Start Date': this.formatDate(customer.joinDate),
        'Status': customer.status,
        'Plan Name': customer.planName || '',
        'Notes': customer.notes ?? ''
      };

      rentMonths.forEach(month => {
        rentRow[month] = paymentMap.get(`${customer.id}__${month}`) ?? '';
      });

      rentHistoryData.push(rentRow);
    });
    const wsRentHistory = XLSX.utils.json_to_sheet(rentHistoryData);
    this.autoFitColumns(wsRentHistory, rentHistoryData);
    XLSX.utils.book_append_sheet(wb, wsRentHistory, 'Rent History');

    // Sheet 3: Payment History
    const paymentHistoryData = payments.map(payment => {
      const customer = customers.find(c => c.id === payment.customerId);
      return {
        'Customer Name': customer?.name || 'Unknown',
        'Payment Date': this.formatDate(payment.paidDate),
        'Amount': payment.amount,
        'For Month': payment.forMonth,
        'Receiver': payment.receiver ?? '',
        'Notes': payment.notes ?? ''
      };
    }).sort((a, b) => {
      const dateA = new Date(a['Payment Date']).getTime();
      const dateB = new Date(b['Payment Date']).getTime();
      return dateB - dateA; // Most recent first
    });
    const wsPaymentHistory = XLSX.utils.json_to_sheet(paymentHistoryData);
    this.autoFitColumns(wsPaymentHistory, paymentHistoryData);
    XLSX.utils.book_append_sheet(wb, wsPaymentHistory, 'Payment History');

    // Sheet 4: Service History
    const serviceHistoryData = services.map(service => {
      const customer = customers.find(c => c.id === service.customerId);
      return {
        'Customer Name': customer?.name || 'Unknown',
        'Service Date': this.formatDate(service.serviceDate),
        'Service Type': service.serviceType,
        'Technician': service.technicianName,
        'Cost': service.cost ?? '',
        'Next Service Date': service.nextServiceDate ? this.formatDate(service.nextServiceDate) : '',
        'Parts Replaced': service.partsReplaced ?? '',
        'Notes': service.notes ?? ''
      };
    }).sort((a, b) => {
      const dateA = new Date(a['Service Date']).getTime();
      const dateB = new Date(b['Service Date']).getTime();
      return dateB - dateA; // Most recent first
    });
    const wsServiceHistory = XLSX.utils.json_to_sheet(serviceHistoryData);
    this.autoFitColumns(wsServiceHistory, serviceHistoryData);
    XLSX.utils.book_append_sheet(wb, wsServiceHistory, 'Service History');

    // Generate and download
    const fileName = options.fileName ?? this.buildFileName(
      options.startDate ? this.normalizeStart(options.startDate) : null,
      options.endDate ? this.normalizeEnd(options.endDate) : null
    );
    XLSX.writeFile(wb, fileName.replace(/\.csv$/i, '.xlsx'));
  }

  private autoFitColumns(ws: XLSX.WorkSheet, data: any[]): void {
    if (data.length === 0) return;

    const colWidths: { [key: string]: number } = {};
    const firstRow = data[0];

    Object.keys(firstRow).forEach(key => {
      colWidths[key] = Math.max(key.length, 12);
    });

    data.forEach(row => {
      Object.keys(row).forEach(key => {
        const value = String(row[key] ?? '');
        colWidths[key] = Math.max(colWidths[key] || 12, Math.min(value.length, 50));
      });
    });

    const cols = Object.keys(firstRow).map(key => ({
      wch: colWidths[key] || 12
    }));

    ws['!cols'] = cols;
  }

  private normalizeStart(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }

  private normalizeEnd(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(23, 59, 59, 999);
    return normalized;
  }

  private formatDate(value: Date): string {
    return new Date(value).toLocaleDateString('en-IN');
  }

  private parseForMonth(value: string): Date {
    const parsed = new Date(`1 ${value}`);
    return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
  }

  private escapeCsv(value: unknown): string {
    const stringValue = String(value ?? '');
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  }

  private buildFileName(start: Date | null, end: Date | null): string {
    const prefix = 'customer-report';
    if (!start && !end) {
      return `${prefix}.xlsx`;
    }

    const startLabel = start ? this.formatDate(start).replace(/\//g, '-') : 'all';
    const endLabel = end ? this.formatDate(end).replace(/\//g, '-') : 'all';
    return `${prefix}-${startLabel}-to-${endLabel}.xlsx`;
  }
}

