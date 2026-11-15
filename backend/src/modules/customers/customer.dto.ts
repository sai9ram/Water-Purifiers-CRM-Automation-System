import { CustomerStatus } from '@prisma/client';

export interface CreateCustomerDto {
  legacyId?: number;
  customerCode?: string;
  name: string;
  phone: string;
  alternatePhone?: string | null;
  email?: string | null;
  address: string;
  area: string;
  purifierModel?: string | null;
  planId?: string | null;
  planName?: string | null;
  monthlyRent: number;
  depositPaid: number;
  initialInvestment?: number | null;
  joinDate?: Date;
  nextDueDate: Date;
  lastPaymentDate?: Date | null;
  lastServiceDate?: Date | null;
  nextServiceDate?: Date | null;
  status: CustomerStatus;
  notes?: string | null;
}

export type UpdateCustomerDto = Partial<Omit<CreateCustomerDto, 'legacyId' | 'customerCode'>>;

export interface ListCustomersQueryDto {
  page: number;
  limit: number;
  search?: string;
  status?: CustomerStatus;
  area?: string;
}

export interface CustomerResponseDto {
  id: string;
  legacyId: number | null;
  customerCode: string;
  name: string;
  phone: string;
  alternatePhone: string | null;
  email: string | null;
  address: string;
  area: string;
  purifierModel: string | null;
  planId: string | null;
  planName: string | null;
  monthlyRent: number;
  depositPaid: number;
  initialInvestment: number | null;
  joinDate: string;
  nextDueDate: string;
  lastPaymentDate: string | null;
  lastServiceDate: string | null;
  nextServiceDate: string | null;
  status: CustomerStatus;
  notes: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}
