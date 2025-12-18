import { ApiRouteConfig } from 'motia';
import { updateActionSchema, actionItemSchema } from '../types/schemas';
import { coreMiddleware } from '../middlewares/core.middleware';
import { NotFoundError } from '../errors/not-found.error';

export const config: ApiRouteConfig = {
  name: 'UpdateAction',
  type: 'api',
  path: '/actions/:id',
  method: 'PUT',
  description: 'Update an action item',
  bodySchema: updateActionSchema,
  emits: [],
  responseSchema: {
    200: actionItemSchema,
    404: { type: 'object', properties: { error: { type: 'object' } } },
  },
  middleware: [coreMiddleware],
};

export const handler = async (req: any, { logger, state, streams }: any) => {
  const actionId = req.pathParams.id;
  const updates = updateActionSchema.parse(req.body);

  logger.info('Updating action', { actionId, updates });

  try {
    // Get existing action
    const existingAction = await state.get('actions', actionId);

    if (!existingAction) {
      throw new NotFoundError(`Action with id ${actionId} not found`);
    }

    // Prepare updated action
    const updatedAction = {
      ...existingAction,
      ...updates,
    };

    // If marking as done, set completedAt timestamp
    if (updates.status === 'done' && existingAction.status !== 'done') {
      updatedAction.completedAt = new Date().toISOString();
      logger.info('Action marked as completed', { actionId });
    }

    // If changing from done to another status, clear completedAt
    if (updates.status && updates.status !== 'done' && existingAction.status === 'done') {
      updatedAction.completedAt = null;
      logger.info('Action unmarked as completed', { actionId });
    }

    // Save updated action
    await state.set('actions', actionId, updatedAction);

    logger.info('Action updated successfully', { 
      actionId, 
      status: updatedAction.status 
    });

    // Push update to real-time stream (if we add streams later)
    // await streams.actionUpdates.set('all', actionId, updatedAction);

    return {
      status: 200,
      body: updatedAction,
    };
  } catch (error: any) {
    if (error instanceof NotFoundError) {
      throw error;
    }

    logger.error('Failed to update action', {
      actionId,
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
};