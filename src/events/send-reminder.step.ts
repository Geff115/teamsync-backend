import { EventConfig } from 'motia';
import { z } from 'zod';
import { sendEmail } from '../services/email/send-email';
import { actionItemSchema } from '../types/schemas';

const inputSchema = z.object({
  assignee: z.string(),
  actions: z.array(actionItemSchema),
  dueCount: z.number(),
  overdueCount: z.number(),
});

export const config: EventConfig = {
  name: 'SendReminder',
  type: 'event',
  description: 'Send reminder email for due/overdue actions',
  subscribes: ['reminder.due'],
  emits: [],
  input: inputSchema,
  flows: ['reminder-system'],
};

// Resend free tier: 2 emails/second
// We use sleep to respect rate limit
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const handler = async (input: any, { logger, state }: any) => {
  const { assignee, actions, dueCount, overdueCount } = input;

  logger.info('Sending reminder email', { 
    assignee, 
    actionsCount: actions.length,
    dueCount,
    overdueCount
  });

  try {
    // For demo purposes, we'll send to a default email
    // In production, we'd look up the assignee's email from a user database
    const recipientEmail = 'gabrielnoah129@gmail.com'; // Replace with actual lookup

    const htmlContent = generateReminderEmail(assignee, actions, dueCount, overdueCount);

    // Rate limiting: 2 emails/sec = 500ms between emails
    await sleep(500);

    await sendEmail({
      to: recipientEmail,
      subject: `⏰ ${actions.length} Action Item${actions.length > 1 ? 's' : ''} ${overdueCount > 0 ? 'Overdue' : 'Due Today'} - TeamSync`,
      html: htmlContent,
    });

    // Log reminder sent
    for (const action of actions) {
      const reminderId = `reminder_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      await state.set('reminders', reminderId, {
        id: reminderId,
        actionId: action.id,
        sentAt: new Date().toISOString(),
        status: 'sent',
      });
    }

    logger.info('Reminder email sent successfully', { 
      assignee, 
      recipientEmail,
      actionsCount: actions.length 
    });

  } catch (error: any) {
    logger.error('Failed to send reminder email', {
      assignee,
      error: error.message,
      stack: error.stack,
    });

    // Log failed reminder
    for (const action of actions) {
      const reminderId = `reminder_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      await state.set('reminders', reminderId, {
        id: reminderId,
        actionId: action.id,
        sentAt: new Date().toISOString(),
        status: 'failed',
        error: error.message,
      });
    }

    // Don't throw - we don't want to retry failed reminders indefinitely
  }
};

function generateReminderEmail(
  assignee: string,
  actions: any[],
  dueCount: number,
  overdueCount: number
): string {
  const actionsList = actions
    .map((action) => {
      const isOverdue = new Date(action.dueDate) < new Date();
      const statusColor = isOverdue ? '#ef4444' : '#f59e0b';
      const statusText = isOverdue ? '🔴 OVERDUE' : '⏰ DUE TODAY';

      const priorityColorMap = {
        high: '#ef4444',
        medium: '#f59e0b',
        low: '#10b981',
      };
      const priorityColor = priorityColorMap[action.priority as keyof typeof priorityColorMap] || '#6b7280';

      let dueDateText = 'Not specified';
      if (action.dueDate) {
        try {
          const date = new Date(action.dueDate);
          if (!isNaN(date.getTime())) {
            dueDateText = date.toLocaleDateString('en-US', { 
              weekday: 'short', 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric' 
            });
          }
        } catch (e) {
          dueDateText = action.dueDate;
        }
      }

      return `
        <div style="margin-bottom: 16px; padding: 12px; border-left: 4px solid ${statusColor}; background-color: #f9fafb;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
            <p style="margin: 0; font-weight: 600; color: #111827; flex: 1;">${action.description}</p>
            <span style="background-color: ${statusColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; white-space: nowrap; margin-left: 8px;">${statusText}</span>
          </div>
          <p style="margin: 0; font-size: 14px; color: #6b7280;">
            <strong>Due:</strong> ${dueDateText} • 
            <span style="color: ${priorityColor}; text-transform: uppercase; font-weight: 600;">${action.priority} priority</span>
          </p>
        </div>
      `;
    })
    .join('');

  const headerText = overdueCount > 0 
    ? `You have ${overdueCount} overdue action item${overdueCount > 1 ? 's' : ''}${dueCount > 0 ? ` and ${dueCount} due today` : ''}`
    : `You have ${dueCount} action item${dueCount > 1 ? 's' : ''} due today`;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #374151; background-color: #f3f4f6; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
          <div style="background-color: ${overdueCount > 0 ? '#dc2626' : '#f59e0b'}; color: #ffffff; padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 700;">⏰ Action Items Reminder</h1>
          </div>
          
          <div style="padding: 24px;">
            <p style="margin: 0 0 8px 0; font-size: 18px; color: #111827; font-weight: 600;">
              Hi ${assignee},
            </p>
            
            <p style="margin: 0 0 24px 0; font-size: 16px; color: #6b7280;">
              ${headerText}:
            </p>
            
            ${actionsList}
            
            <div style="margin-top: 32px; padding: 16px; background-color: #fef3c7; border-radius: 6px; border: 1px solid #f59e0b;">
              <p style="margin: 0; font-size: 14px; color: #92400e;">
                💡 <strong>Tip:</strong> Mark items as complete in TeamSync to stop receiving reminders.
              </p>
            </div>
          </div>
          
          <div style="padding: 16px 24px; background-color: #f9fafb; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 12px; color: #6b7280; text-align: center;">
              Powered by TeamSync • Built with Motia
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}