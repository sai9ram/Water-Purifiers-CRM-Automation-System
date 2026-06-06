import Dexie, { Table } from 'dexie';
import { Customer, RentalPlan, ServiceRecord, PaymentRecord, CustomerComment, CustomerComplaint, Technician } from '../models/models';

export class AppDatabase extends Dexie {
  customers!:      Table<Customer, number>;
  rentalPlans!:    Table<RentalPlan, number>;
  serviceRecords!: Table<ServiceRecord, number>;
  payments!:       Table<PaymentRecord, number>;
  customerComments!: Table<CustomerComment, number>;
  customerComplaints!: Table<CustomerComplaint, number>;
  technicians!:    Table<Technician, number>;

  constructor() {
    super('PureHomeWatersDB');
    this.version(2).stores({
      customers:      '++id, name, phone, planId, status, nextDueDate, area',
      rentalPlans:    '++id, name, monthlyRent',
      serviceRecords: '++id, customerId, serviceDate, serviceType, nextServiceDate',
      payments:       '++id, customerId, paidDate'
    });
    this.version(3).stores({
      customers:        '++id, name, phone, planId, status, nextDueDate, area',
      rentalPlans:      '++id, name, monthlyRent',
      serviceRecords:   '++id, customerId, serviceDate, serviceType, nextServiceDate',
      payments:         '++id, customerId, paidDate',
      customerComments: '++id, customerId, createdAt'
    });

    this.version(4).stores({
      customers:        '++id, name, phone, planId, status, nextDueDate, area',
      rentalPlans:      '++id, name, monthlyRent',
      serviceRecords:   '++id, customerId, serviceDate, serviceType, nextServiceDate, complaintId',
      payments:         '++id, customerId, paidDate',
      customerComments: '++id, customerId, createdAt'
    });

    this.version(5).stores({
      customers:         '++id, name, phone, planId, status, nextDueDate, area',
      rentalPlans:       '++id, name, monthlyRent',
      serviceRecords:    '++id, customerId, serviceDate, serviceType, nextServiceDate, complaintId',
      payments:          '++id, customerId, paidDate',
      customerComments:  '++id, customerId, createdAt',
      customerComplaints:'++id, customerId, createdAt'
    });

    this.version(6).stores({
      customers:         '++id, name, phone, planId, status, nextDueDate, area',
      rentalPlans:       '++id, name, monthlyRent',
      serviceRecords:    '++id, customerId, serviceDate, serviceType, nextServiceDate, complaintId',
      payments:          '++id, customerId, paidDate',
      customerComments:  '++id, customerId, createdAt',
      customerComplaints:'++id, customerId, createdAt',
      technicians:       '++id, name, isDefault'
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
        monthlyRent: 399,
        depositAmount: 2000,
        description: 'Essential water purification for small families',
        features: ['RO + UV + Alkaline + TDS Control', 'Base look', 'Quaterly Service', '24/7 Support'],
        createdAt: new Date()
      },
      {
        name: 'Standard',
        monthlyRent: 499,
        depositAmount: 3000,
        description: 'Advanced purification with UV protection',
        features: ['RO + UV + Alkaline + TDS Control', 'Rich look', 'Quaterly Service', '24/7 Support'],
        createdAt: new Date()
      },
      {
        name: 'Premium',
        monthlyRent: 499,
        depositAmount: 3500,
        description: 'Complete protection with mineral enhancement',
        features: ['Steel Tank', 'RO + UV + Alkaline + TDS Control', 'Quaterly Service', '24/7 Support'],
        createdAt: new Date()
      }
    ]);
  }
});
// Seed a default technician on first run
 db.technicians.count().then(count => {
  if (count === 0) {
    db.technicians.add({
      name: 'Default Technician',
      isDefault: true,
      createdAt: new Date()
    });
  }
});