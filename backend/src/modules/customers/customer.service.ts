import crypto from 'crypto';
import { Customer } from '@prisma/client';
import { CustomerRepository } from './customer.repository';
import {
  CreateCustomerDto,
  CustomerResponseDto,
  ListCustomersQueryDto,
  UpdateCustomerDto
} from './customer.dto';
import { AppError } from '../../utils/app-error';
import { auditService } from '../audit/audit.service';

export class CustomerService {
  private readonly repo = new CustomerRepository();

  private toResponseDto(customer: Customer): CustomerResponseDto {
    return {
      id: customer.id,
      legacyId: customer.legacyId,
      customerCode: customer.customerCode,
      name: customer.name,
      phone: customer.phone,
      alternatePhone: customer.alternatePhone,
      email: customer.email,
      address: customer.address,
      area: customer.area,
      purifierModel: customer.purifierModel,
      planId: customer.planId,
      planName: customer.planName,
      monthlyRent: Number(customer.monthlyRent),
      depositPaid: Number(customer.depositPaid),
      initialInvestment:
        customer.initialInvestment !== null ? Number(customer.initialInvestment) : null,
      joinDate: customer.joinDate.toISOString(),
      nextDueDate: customer.nextDueDate.toISOString(),
      lastPaymentDate: customer.lastPaymentDate ? customer.lastPaymentDate.toISOString() : null,
      lastServiceDate: customer.lastServiceDate ? customer.lastServiceDate.toISOString() : null,
      nextServiceDate: customer.nextServiceDate ? customer.nextServiceDate.toISOString() : null,
      status: customer.status,
      notes: customer.notes,
      isArchived: customer.isArchived,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString()
    };
  }

  private generateCustomerCode(): string {
    const stamp = Date.now().toString(36).toUpperCase();
    const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `PHW-${stamp}-${rand}`;
  }

  async listCustomers(query: ListCustomersQueryDto): Promise<{
    items: CustomerResponseDto[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const { items, total } = await this.repo.findManyPaginated(query);
    return {
      items: items.map(c => this.toResponseDto(c)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit))
      }
    };
  }

  async getCustomerById(id: string): Promise<CustomerResponseDto> {
    const customer = await this.repo.findById(id);
    if (!customer) {
      throw new AppError('Customer not found', 404);
    }
    return this.toResponseDto(customer);
  }

  async createCustomer(
    dto: CreateCustomerDto,
    actor?: { userId?: string; ipAddress?: string | null; userAgent?: string | null }
  ): Promise<CustomerResponseDto> {
    const existingByPhone = await this.repo.findByPhone(dto.phone);
    if (existingByPhone) {
      throw new AppError(
        `Duplicate customer: phone number ${dto.phone} is already registered to ${existingByPhone.name}`,
        409,
        [{ field: 'phone', message: 'A customer with this phone number already exists' }]
      );
    }

    const customerCode = dto.customerCode ?? this.generateCustomerCode();
    const created = await this.repo.create({
      ...dto,
      customerCode
    });

    const responseDto = this.toResponseDto(created);

    await auditService.log({
      actorUserId: actor?.userId ?? null,
      action: 'customer.create',
      entityType: 'Customer',
      entityId: created.id,
      afterState: {
        id: created.id,
        customerCode: created.customerCode,
        name: created.name,
        status: created.status
      },
      ipAddress: actor?.ipAddress ?? null,
      userAgent: actor?.userAgent ?? null
    });

    return responseDto;
  }

  async updateCustomer(
    id: string,
    dto: UpdateCustomerDto,
    actor?: { userId?: string; ipAddress?: string | null; userAgent?: string | null }
  ): Promise<CustomerResponseDto> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new AppError('Customer not found', 404);
    }

    if (dto.phone && dto.phone !== existing.phone) {
      const duplicate = await this.repo.findByPhone(dto.phone, id);
      if (duplicate) {
        throw new AppError(
          `Duplicate customer: phone number ${dto.phone} is already registered`,
          409,
          [{ field: 'phone', message: 'Another customer already uses this phone number' }]
        );
      }
    }

    const updated = await this.repo.update(id, dto);
    const responseDto = this.toResponseDto(updated);

    await auditService.log({
      actorUserId: actor?.userId ?? null,
      action: 'customer.update',
      entityType: 'Customer',
      entityId: id,
      beforeState: {
        name: existing.name,
        status: existing.status,
        monthlyRent: Number(existing.monthlyRent)
      },
      afterState: {
        name: updated.name,
        status: updated.status,
        monthlyRent: Number(updated.monthlyRent)
      },
      ipAddress: actor?.ipAddress ?? null,
      userAgent: actor?.userAgent ?? null
    });

    return responseDto;
  }

  async deleteCustomer(
    id: string,
    actor?: { userId?: string; ipAddress?: string | null; userAgent?: string | null }
  ): Promise<{
    id: string;
    archived: boolean;
    preservedHistory: {
      payments: number;
      invoices: number;
      serviceJobs: number;
      rentalContracts: number;
      complaints: number;
    };
  }> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new AppError('Customer not found', 404);
    }

    const counts = await this.repo.getHistoricalDependencyCounts(id);
    // Customers are never hard-deleted so financial and service records remain intact
    await this.repo.softDeleteOrArchive(id);

    await auditService.log({
      actorUserId: actor?.userId ?? null,
      action: 'customer.archive',
      entityType: 'Customer',
      entityId: id,
      beforeState: { status: existing.status, isArchived: existing.isArchived },
      afterState: { status: 'INACTIVE', isArchived: true, preservedHistory: counts },
      ipAddress: actor?.ipAddress ?? null,
      userAgent: actor?.userAgent ?? null
    });

    return {
      id,
      archived: true,
      preservedHistory: counts
    };
  }
}
