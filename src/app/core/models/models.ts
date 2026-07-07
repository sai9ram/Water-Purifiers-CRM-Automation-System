export interface RentalPlan {
  id?: number;
  name: string;
  monthlyRent: number;
  depositAmount: number;
  description: string;
  features: string[];
  createdAt: Date;
}

export type CustomerStatus = 'active' | 'inactive' | 'overdue';
export type PaymentStatus = 'paid' | 'pending' | 'overdue';

export interface Customer {
  id?: number;
  name: string;
  phone: string;
  alternatePhone?: string;
  address: string;
  area: string;
  purifierModel: string;
  planId: number;
  planName?: string;          // denormalized for display
  monthlyRent?: number;       // denormalized for display
  depositPaid: number;
  initialInvestment?: number;
  joinDate: Date;
  nextDueDate: Date;
  lastPaymentDate?: Date;
  lastServiceDate?: Date;
  nextServiceDate?: Date;
  status: CustomerStatus;
  notes?: string;
  createdAt: Date;
}

export type ServiceType = 'filter-change' | 'repair' | 'installation' | 'general-service' | 'demo';

export interface ServiceRecord {
  id?: number;
  customerId: number;
  customerName?: string;      // denormalized
  serviceType: ServiceType;
  serviceDate: Date;
  nextServiceDate?: Date;
  complaintId?: number;
  technicianName: string;
  partsReplaced?: string;
  notes?: string;
  cost?: number;
  createdAt: Date;
}

export interface Technician {
  id?: number;
  name: string;
  isDefault: boolean;
  createdAt: Date;
}

export interface PaymentRecord {
  id?: number;
  customerId: number;
  amount: number;
  paidDate: Date;
  forMonth: string;           // e.g. "April 2025"
  receiver?: string;          // who received the payment
  notes?: string;
  createdAt: Date;
}

export interface CustomerComment {
  id?: number;
  customerId: number;
  complaintId?: number;
  comment: string;
  createdAt: Date;
}

export interface CustomerComplaint {
  id?: number;
  customerId: number;
  complaint: string;
  resolved?: boolean;
  createdAt: Date;
}

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  'filter-change': 'Filter Change',
  'repair': 'Repair',
  'installation': 'Installation',
  'general-service': 'General Service',
  'demo': 'Demo'
};

export const PURIFIER_MODELS = [
  'Dolphin',
  'Purosis',
  'Purosis Plus',
  'Priya Aqua Steel Guard',
  'Fonix',
  'Other'
];
