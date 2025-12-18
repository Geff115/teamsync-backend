import { EventConfig } from 'motia';
import { z } from 'zod';
import { extractedActionSchema } from '../types/schemas';

const inputSchema = z.object({
  meetingId: z.string(),
  title: z.string(),
  extractedActions: z.array(extractedActionSchema),
});

export const config: EventConfig = {
  name: 'SaveActions',
  type: 'event',
  description: 'Save extracted action items to state',
  subscribes: ['actions.extracted'],
  emits: ['actions.saved'],
  input: inputSchema,
  flows: ['meeting-processing'],
};

export const handler = async (input: any, { emit, logger, state }: any) => {
  const { meetingId, title, extractedActions } = input;

  logger.info('Saving extracted actions', { 
    meetingId, 
    actionsCount: extractedActions.length 
  });

  const savedActionIds: string[] = [];
  const actionItems = [];

  // Get existing action IDs list
  const existingActionIds = (await state.get('metadata', 'actionIds')) || [];

  // Save each action to state
  for (const extracted of extractedActions) {
    const actionId = `action_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const actionItem = {
      id: actionId,
      meetingId,
      description: extracted.description,
      assignee: extracted.assignee,
      dueDate: extracted.dueDate,
      priority: extracted.priority,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };

    // Store in state under 'actions' group
    await state.set('actions', actionId, actionItem);
    savedActionIds.push(actionId);
    actionItems.push(actionItem);

    logger.info('Action item saved', { 
      actionId, 
      assignee: extracted.assignee,
      description: extracted.description.substring(0, 50) + '...'
    });
  }

  // Update action IDs metadata
  existingActionIds.push(...savedActionIds);
  await state.set('metadata', 'actionIds', existingActionIds);

  // Update meeting as processed
  const meeting = await state.get('meetings', meetingId);
  if (meeting) {
    await state.set('meetings', meetingId, {
      ...meeting,
      processed: true,
    });
    logger.info('Meeting marked as processed', { meetingId });
  }

  // Emit event to trigger confirmation email
  await (emit as any)({
    topic: 'actions.saved',
    data: {
      meetingId,
      title,
      actionIds: savedActionIds,
      actionItems,
      actionsCount: extractedActions.length,
    },
  });

  logger.info('Actions saved successfully', { 
    meetingId, 
    savedCount: savedActionIds.length 
  });
};