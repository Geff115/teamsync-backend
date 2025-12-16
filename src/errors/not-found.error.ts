import { BaseError } from './base.error.js';

export class NotFoundError extends BaseError {
  constructor(message: string = 'Not Found', metadata: Record<string, any> = {}) {
    super(message, 404, 'NOT_FOUND', metadata);
  }
}