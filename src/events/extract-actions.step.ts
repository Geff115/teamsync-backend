import { EventConfig, Handlers } from 'motia';
import { z } from 'zod';
import { extractActionsFromTranscript } from '../services/ai/extract-actions';

const inputSchema = z.object({
  meetingId: z.string(),
  title: z.string(),
  transcript: z.string(),
});

export const config: EventConfig = {
  name: 'ExtractActions',
  type: 'event',
  description: 'Extract action items from meeting transcript using AI',
  subscribes: ['meeting.uploaded'],
  emits: [],
  virtualEmits: ['actions.extracted'],
  input: inputSchema,
  flows: ['meeting-processing'],
};

export const handler: Handlers['ExtractActions'] = async (input, { emit, logger, state }) => {
  const { meetingId, title, transcript } = input;

  logger.info('Starting AI extraction for meeting', { meetingId, title });

  try {
    // Call AI service to extract actions
    const extractedActions = await extractActionsFromTranscript(transcript);

    logger.info('AI extraction completed', {
      meetingId,
      actionsCount: extractedActions.length,
    });

    // If no actions found, log and still mark as processed
    if (extractedActions.length === 0) {
      logger.warn('No action items found in transcript', { meetingId, title });
      
      // Update meeting as processed
      const meeting = await state.get('meetings', meetingId);
      if (meeting) {
        await state.set('meetings', meetingId, {
          ...meeting,
          processed: true,
        });
      }
      
      return;
    }

    // Emit event with extracted actions (will be handled by save-actions step)
    await (emit as any)({
      topic: 'actions.extracted',
      data: {
        meetingId,
        title,
        extractedActions,
      },
    });

    logger.info('Actions extraction event emitted', { meetingId, count: extractedActions.length });
  } catch (error: any) {
    logger.error('AI extraction failed', {
      meetingId,
      error: error.message,
      stack: error.stack,
    });

    // Update meeting with error status
    const meeting = await state.get('meetings', meetingId);
    if (meeting) {
      await state.set('meetings', meetingId, {
        ...meeting,
        processed: true,
        // You could add: error: error.message
      });
    }

    throw error; // Re-throw so Motia can retry if configured
  }
};