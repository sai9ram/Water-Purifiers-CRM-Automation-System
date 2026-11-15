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
  uniquePaymentId?: string;
  paymentLinkUrl?: string;
  currentCycleStatus?: 'paid' | 'pending' | 'due_soon' | 'overdue';
  daysUntilDue?: number;
  lastReminderStage?: 'PRE_DUE_5D' | 'DUE_TODAY' | 'OVERDUE_3D' | 'RECEIPT_SENT' | null;
  lastReminderSentAt?: Date | string;
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
  paymentId?: string;         // Unique Payment Link ID e.g. PAY-PHW-001-202611
  transactionRef?: string;
  createdAt: Date;
}

export interface PaymentLinkRecord {
  paymentId: string;
  customerId: number;
  customerName: string;
  customerPhone: string;
  customerArea: string;
  purifierModel: string;
  planName: string;
  amount: number;
  forMonth: string;
  onboardingDate: string;
  dueDate: string;
  status: 'PENDING' | 'PAID' | 'EXPIRED';
  shortUrl: string;
  paidAt?: string;
  transactionRef?: string;
  paymentMethod?: string;
  createdAt: string;
}

export interface WhatsAppAutomationLog {
  id: number;
  customerId?: number | null;
  customerName: string;
  phone: string;
  direction: 'OUTBOUND' | 'INBOUND';
  category:
    | 'PRE_DUE_5D'
    | 'DUE_TODAY'
    | 'OVERDUE_3D'
    | 'PAYMENT_RECEIPT'
    | 'COMPLAINT_INBOUND'
    | 'COMPLAINT_AUTO_REPLY'
    | 'COMPLAINT_ADMITTED';
  paymentId?: string | null;
  ticketId?: string | null;
  message: string;
  deliveryStatus: 'SENT_API' | 'DELIVERED' | 'LOGGED_AUTO';
  createdAt: string;
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
  ticketId?: string;
  customerId: number;
  customerName?: string;
  customerPhone?: string;
  customerArea?: string;
  complaint: string;
  source?: 'whatsapp' | 'admin';
  admissionStatus?: 'NEW_WHATSAPP' | 'ADMITTED' | 'RESOLVED';
  admittedAt?: Date | string;
  assignedTechnician?: string;
  serviceRecordId?: number;
  autoReplyMessage?: string;
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
