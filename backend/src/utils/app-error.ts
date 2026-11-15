export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errors: Array<{ field?: string; message: string }>;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode = 400,
    errors: Array<{ field?: string; message: string }> = [],
    isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = isOperational;
  }
}
