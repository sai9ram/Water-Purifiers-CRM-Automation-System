import { Prisma, Customer } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { CreateCustomerDto, ListCustomersQueryDto, UpdateCustomerDto } from './customer.dto';

export class CustomerRepository {
  async findById(id: string) {
    return prisma.customer.findFirst({
      where: {
        id,
        deletedAt: null
      },
      include: {
        addresses: true,
        rentalPlan: true
      }
    });
  }

  async findByPhone(phone: string, excludeId?: string) {
    return prisma.customer.findFirst({
      where: {
        phone,
        ...(excludeId ? { id: { not: excludeId } } : {})
      }
    });
  }

  async findManyPaginated(query: ListCustomersQueryDto): Promise<{
    items: Customer[];
    total: number;
  }> {
    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
      isArchived: false
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.area) {
      where.area = {
        contains: query.area,
        mode: 'insensitive'
      };
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
        { alternatePhone: { contains: query.search } },
        { area: { contains: query.search, mode: 'insensitive' } },
        { customerCode: { contains: query.search, mode: 'insensitive' } }
      ];
    }

    const skip = (query.page - 1) * query.limit;

    const [items, total] = await prisma.$transaction([
      prisma.customer.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: query.limit
      }),
      prisma.customer.count({ where })
    ]);

    return { items, total };
  }

  async create(dto: CreateCustomerDto & { customerCode: string }) {
    return prisma.$transaction(async tx => {
      const created = await tx.customer.create({
        data: {
          legacyId: dto.legacyId ?? null,
          customerCode: dto.customerCode,
          name: dto.name,
          phone: dto.phone,
          alternatePhone: dto.alternatePhone ?? null,
          email: dto.email ?? null,
          address: dto.address,
          area: dto.area,
          purifierModel: dto.purifierModel ?? null,
          planId: dto.planId ?? null,
          planName: dto.planName ?? null,
          monthlyRent: new Prisma.Decimal(dto.monthlyRent ?? 0),
          depositPaid: new Prisma.Decimal(dto.depositPaid ?? 0),
          initialInvestment:
            dto.initialInvestment !== undefined && dto.initialInvestment !== null
              ? new Prisma.Decimal(dto.initialInvestment)
              : null,
          joinDate: dto.joinDate ?? new Date(),
          nextDueDate: dto.nextDueDate,
          lastPaymentDate: dto.lastPaymentDate ?? null,
          lastServiceDate: dto.lastServiceDate ?? null,
          nextServiceDate: dto.nextServiceDate ?? null,
          status: dto.status ?? 'ACTIVE',
          notes: dto.notes ?? null
        }
      });

      await tx.customerAddress.create({
        data: {
          customerId: created.id,
          label: 'Primary',
          addressLine1: dto.address,
          area: dto.area,
          isPrimary: true
        }
      });

      return created;
    });
  }

  async update(id: string, dto: UpdateCustomerDto) {
    const data: Prisma.CustomerUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.alternatePhone !== undefined) data.alternatePhone = dto.alternatePhone;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.area !== undefined) data.area = dto.area;
    if (dto.purifierModel !== undefined) data.purifierModel = dto.purifierModel;
    if (dto.planName !== undefined) data.planName = dto.planName;
    if (dto.monthlyRent !== undefined) data.monthlyRent = new Prisma.Decimal(dto.monthlyRent);
    if (dto.depositPaid !== undefined) data.depositPaid = new Prisma.Decimal(dto.depositPaid);
    if (dto.initialInvestment !== undefined) {
      data.initialInvestment =
        dto.initialInvestment !== null ? new Prisma.Decimal(dto.initialInvestment) : null;
    }
    if (dto.joinDate !== undefined) data.joinDate = dto.joinDate;
    if (dto.nextDueDate !== undefined) data.nextDueDate = dto.nextDueDate;
    if (dto.lastPaymentDate !== undefined) data.lastPaymentDate = dto.lastPaymentDate;
    if (dto.lastServiceDate !== undefined) data.lastServiceDate = dto.lastServiceDate;
    if (dto.nextServiceDate !== undefined) data.nextServiceDate = dto.nextServiceDate;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.notes !== undefined) data.notes = dto.notes;

    return prisma.customer.update({
      where: { id },
      data
    });
  }

  async getHistoricalDependencyCounts(customerId: string): Promise<{
    payments: number;
    invoices: number;
    serviceJobs: number;
    rentalContracts: number;
    complaints: number;
  }> {
    const [payments, invoices, serviceJobs, rentalContracts, complaints] = await prisma.$transaction([
      prisma.payment.count({ where: { customerId } }),
      prisma.invoice.count({ where: { customerId } }),
      prisma.serviceJob.count({ where: { customerId } }),
      prisma.rentalContract.count({ where: { customerId } }),
      prisma.customerComplaint.count({ where: { customerId } })
    ]);

    return { payments, invoices, serviceJobs, rentalContracts, complaints };
  }

  async softDeleteOrArchive(id: string) {
    return prisma.customer.update({
      where: { id },
      data: {
        isArchived: true,
        status: 'INACTIVE',
        deletedAt: new Date()
      }
    });
  }
}
