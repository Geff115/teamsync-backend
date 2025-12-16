import { ApiMiddleware } from 'motia';
import { ZodError } from 'zod';
import { BaseError } from '../errors/base.error';

export const coreMiddleware: ApiMiddleware = async (req, ctx, next) => {
  const { logger } = ctx;

  try {
    return await next();
  } catch (error: any) {
    // Handle Zod validation errors
    if (error instanceof ZodError) {
      logger.error('Validation error', {
        error: error.message,
        stack: error.stack,
        errors: error.issues,
      });

      return {
        status: 400,
        body: {
          error: 'Invalid request body',
          details: error.issues,
        },
      };
    }

    // Handle custom BaseError
    if (error instanceof BaseError) {
      logger.error('BaseError thrown', {
        status: error.status,
        code: error.code,
        metadata: error.metadata,
        name: error.name,
        message: error.message,
      });

      return {
        status: error.status,
        body: error.toJSON(),
      };
    }

    // Handle unexpected errors
    logger.error('Unexpected error while performing request', {
      error: error.message,
      stack: error.stack,
      body: req.body, // Be careful not to log sensitive data
    });

    return {
      status: 500,
      body: { error: 'Internal Server Error' },
    };
  }
};