import { ApiRouteConfig } from 'motia';
import { z } from 'zod';
import { actionItemSchema } from '../types/schemas';
import { coreMiddleware } from '../middlewares/core.middleware';

export const config: ApiRouteConfig = {
  name: 'GetActions',
  type: 'api',
  path: '/actions',
  method: 'GET',
  description: 'Get all action items with optional filtering',
  emits: [],
  queryParams: [
    { name: 'status', description: 'Filter by status (pending, in_progress, done, overdue)' },
    { name: 'priority', description: 'Filter by priority (low, medium, high)' },
    { name: 'assignee', description: 'Filter by assignee name' },
  ],
  responseSchema: {
    200: z.object({
      actions: z.array(actionItemSchema),
      total: z.number(),
    }),
  },
  middleware: [coreMiddleware],
};

export const handler = async (req: any, { logger, state }: any) => {
  const { status, priority, assignee } = req.queryParams;

  logger.info('Fetching actions', { status, priority, assignee });

  try {
    // Get action IDs from metadata
    const actionIds = (await state.get('metadata', 'actionIds')) || [];

    // Fetch all actions
    const actions = await Promise.all(
      actionIds.map((id: string) => state.get('actions', id))
    );

    // Filter out null values
    let allActions = actions.filter(Boolean);

    // Apply filters
    let filteredActions = allActions;

    if (status) {
      filteredActions = filteredActions.filter((a: any) => a.status === status);
    }

    if (priority) {
      filteredActions = filteredActions.filter((a: any) => a.priority === priority);
    }

    if (assignee) {
      filteredActions = filteredActions.filter((a: any) => 
        a.assignee.toLowerCase().includes(assignee.toLowerCase())
      );
    }

    // Sort by due date (closest first) and priority
    filteredActions.sort((a: any, b: any) => {
      // Prioritize by status: overdue > pending > in_progress > done
      const statusOrder: Record<string, number> = {
        overdue: 0,
        pending: 1,
        in_progress: 2,
        done: 3,
      };
      
      const statusDiff = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
      if (statusDiff !== 0) return statusDiff;

      // Then by due date
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;

      // Then by priority
      const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99);
    });

    logger.info('Actions fetched', { 
      total: filteredActions.length,
      filtered: status || priority || assignee ? true : false
    });

    return {
      status: 200,
      body: {
        actions: filteredActions,
        total: filteredActions.length,
      },
    };
  } catch (error: any) {
    logger.error('Failed to fetch actions', {
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
};