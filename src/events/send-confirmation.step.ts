import { EventConfig } from 'motia';
import { z } from 'zod';
import { actionItemSchema } from '../types/schemas';
import { sendEmail, generateConfirmationEmail } from '../services/email/send-email';

const inputSchema = z.object({
  meetingId: z.string(),
  title: z.string(),
  actionIds: z.array(z.string()),
  actionItems: z.array(actionItemSchema),
  actionsCount: z.number(),
});

export const config: EventConfig = {
  name: 'SendConfirmation',
  type: 'event',
  description: 'Send confirmation email after actions are saved',
  subscribes: ['actions.saved'],
  emits: [],
  input: inputSchema,
  flows: ['meeting-processing'],
};

export const handler = async (input: any, { logger, state }: any) => {
  const { meetingId, title, actionItems, actionsCount } = input;

  logger.info('Sending confirmation email', { meetingId, actionsCount });

  try {
    // Get meeting to retrieve uploader's email
    const meeting = await state.get('meetings', meetingId);
    
    if (!meeting) {
      logger.warn('Meeting not found in state', { meetingId });
      return;
    }

    const recipientEmail = meeting.uploadedBy || 'test@example.com';

    // Generate HTML email content
    const htmlContent = generateConfirmationEmail(title, actionsCount, actionItems);

    // Send email via Resend
    await sendEmail({
      to: recipientEmail,
      subject: `✅ ${actionsCount} Action Items Extracted from "${title}"`,
      html: htmlContent,
    });

    logger.info('Confirmation email sent successfully', { 
      meetingId, 
      recipientEmail,
      actionsCount 
    });
  } catch (error: any) {
    logger.error('Failed to send confirmation email', {
      meetingId,
      error: error.message,
      stack: error.stack,
    });

    // Don't throw - we don't want to retry email sending indefinitely
    // The meeting is already processed successfully
  }
};