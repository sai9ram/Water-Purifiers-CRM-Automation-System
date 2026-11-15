import { Request, Response } from 'express';
import { CustomerService } from './customer.service';
import { sendSuccess } from '../../utils/api-response';
import { ListCustomersQueryDto } from './customer.dto';

export class CustomerController {
  private readonly service = new CustomerService();

  list = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as ListCustomersQueryDto;
    const { items, meta } = await this.service.listCustomers(query);
    sendSuccess(res, 'Customers retrieved successfully', items, meta, 200);
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const customer = await this.service.getCustomerById(req.params.id);
    sendSuccess(res, 'Customer retrieved successfully', customer, {}, 200);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const customer = await this.service.createCustomer(req.body, {
      userId: req.user?.sub,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] ?? null
    });
    sendSuccess(res, 'Customer created successfully', customer, {}, 201);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const customer = await this.service.updateCustomer(req.params.id, req.body, {
      userId: req.user?.sub,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] ?? null
    });
    sendSuccess(res, 'Customer updated successfully', customer, {}, 200);
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.deleteCustomer(req.params.id, {
      userId: req.user?.sub,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] ?? null
    });
    sendSuccess(
      res,
      'Customer archived successfully (historical records preserved)',
      result,
      {},
      200
    );
  };
}
