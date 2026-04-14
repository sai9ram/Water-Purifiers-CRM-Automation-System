import Dexie, { Table } from 'dexie';
import { Customer, RentalPlan, ServiceRecord, PaymentRecord } from '../models/models';

export class AppDatabase extends Dexie {
  customers!:      Table<Customer, number>;
  rentalPlans!:    Table<RentalPlan, number>;
  serviceRecords!: Table<ServiceRecord, number>;
  payments!:       Table<PaymentRecord, number>;

  constructor() {
    super('PureHomeWatersDB');
    this.version(1).stores({
      customers:      '++id, name, phone, planId, status, nextDueDate, area',
      rentalPlans:    '++id, name, monthlyRent',
      serviceRecords: '++id, customerId, serviceDate, serviceType',
      payments:       '++id, customerId, paidDate'
    });
  }
}

export const db = new AppDatabase();

// Seed default plans on first run
db.rentalPlans.count().then(count => {
  if (count === 0) {
    db.rentalPlans.bulkAdd([
      {
        name: 'Basic',
        monthlyRent: 299,
        depositAmount: 999,
        description: 'Essential water purification for small families',
        features: ['RO Purification', 'Monthly Service', '24/7 Support'],
        createdAt: new Date()
      },
      {
        name: 'Standard',
        monthlyRent: 449,
        depositAmount: 1499,
        description: 'Advanced purification with UV protection',
        features: ['RO + UV Purification', 'Monthly Service', 'Filter Changes', '24/7 Support'],
        createdAt: new Date()
      },
      {
        name: 'Premium',
        monthlyRent: 649,
        depositAmount: 1999,
        description: 'Complete protection with mineral enhancement',
        features: ['RO + UV + TDS Control', 'Bi-weekly Service', 'All Filter Changes', 'Priority Support', 'Free Repairs'],
        createdAt: new Date()
      }
    ]);
  }
});
