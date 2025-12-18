import { CronConfig } from 'motia';

export const config: CronConfig = {
  name: 'CheckReminders',
  type: 'cron',
  description: 'Check for due and overdue action items daily',
  cron: '0 9 * * *', // Every day at 9:00 AM
  emits: ['reminder.due'],
  flows: ['reminder-system'],
};

export const handler = async ({ emit, logger, state }: any) => {
  logger.info('Starting daily reminder check');

  try {
    // Get all actions from state
    const allActions = await state.getGroup('actions');

    if (!allActions || allActions.length === 0) {
      logger.info('No actions found in state');
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to midnight for comparison

    const actionsDue: any[] = [];
    const actionsOverdue: any[] = [];

    // Check each action
    for (const action of allActions) {
      // Skip completed actions
      if (action.status === 'done') {
        continue;
      }

      // Skip actions without due dates
      if (!action.dueDate) {
        continue;
      }

      const dueDate = new Date(action.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      // Check if due today
      if (dueDate.getTime() === today.getTime()) {
        actionsDue.push(action);
      }

      // Check if overdue
      if (dueDate < today) {
        actionsOverdue.push(action);
        
        // Update status to overdue if not already
        if (action.status !== 'overdue') {
          await state.set('actions', action.id, {
            ...action,
            status: 'overdue',
          });
          logger.info('Action marked as overdue', { 
            actionId: action.id,
            assignee: action.assignee 
          });
        }
      }
    }

    logger.info('Reminder check completed', {
      totalActions: allActions.length,
      dueToday: actionsDue.length,
      overdue: actionsOverdue.length,
    });

    // Group actions by assignee for batched reminders
    const actionsByAssignee = new Map<string, any[]>();

    [...actionsDue, ...actionsOverdue].forEach(action => {
      const assignee = action.assignee || 'Unassigned';
      if (!actionsByAssignee.has(assignee)) {
        actionsByAssignee.set(assignee, []);
      }
      actionsByAssignee.get(assignee)!.push(action);
    });

    // Emit reminder event for each assignee
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

      logger.info('Reminder event emitted', { 
        assignee, 
        actionsCount: actions.length 
      });
    }

  } catch (error: any) {
    logger.error('Failed to check reminders', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};