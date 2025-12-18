import { ApiRouteConfig } from 'motia';
import { coreMiddleware } from '../middlewares/core.middleware';

export const config: ApiRouteConfig = {
  name: 'TestReminder',
  type: 'api',
  path: '/__test-reminder',
  method: 'POST',
  description: 'Manually trigger reminder check (for testing)',
  emits: ['reminder.due'],
  responseSchema: {
    200: { type: 'object', properties: { message: { type: 'string' } } },
  },
  middleware: [coreMiddleware],
};

export const handler = async (req: any, { emit, logger, state }: any) => {
  logger.info('Manual reminder check triggered');

  try {
    // Get all actions from state
    const allActions = await state.getGroup('actions');

    if (!allActions || allActions.length === 0) {
      return {
        status: 200,
        body: { message: 'No actions found' },
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const actionsDue: any[] = [];
    const actionsOverdue: any[] = [];

    for (const action of allActions) {
      if (action.status === 'done') continue;
      if (!action.dueDate) continue;

      const dueDate = new Date(action.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      if (dueDate.getTime() === today.getTime()) {
        actionsDue.push(action);
      }

      if (dueDate < today) {
        actionsOverdue.push(action);
        if (action.status !== 'overdue') {
          await state.set('actions', action.id, {
            ...action,
            status: 'overdue',
          });
        }
      }
    }

    // Group by assignee
    const actionsByAssignee = new Map<string, any[]>();
    [...actionsDue, ...actionsOverdue].forEach(action => {
      const assignee = action.assignee || 'Unassigned';
      if (!actionsByAssignee.has(assignee)) {
        actionsByAssignee.set(assignee, []);
      }
      actionsByAssignee.get(assignee)!.push(action);
    });

    // Emit reminders
    for (const [assignee, actions] of actionsByAssignee) {
      await (emit as any)({
        topic: 'reminder.due',
        data: {
          assignee,
          actions,
          dueCount: actions.filter(a => {
            const dueDate = new Date(a.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            return dueDate.getTime() === today.getTime();
          }).length,
          overdueCount: actions.filter(a => {
            const dueDate = new Date(a.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            return dueDate < today;
          }).length,
        },
      });
    }

    return {
      status: 200,
      body: { 
        message: `Reminders triggered for ${actionsByAssignee.size} assignee(s)`,
        details: {
          dueToday: actionsDue.length,
          overdue: actionsOverdue.length,
        }
      },
    };
  } catch (error: any) {
    logger.error('Test reminder failed', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};