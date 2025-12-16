import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<void> {
  try {
    const result = await resend.emails.send({
      from: 'TeamSync <onboarding@resend.dev>', // Use verified domain in production
      to,
      subject,
      html,
    });

    if (result.error) {
      throw new Error(`Resend API error: ${result.error.message}`);
    }

    console.log('Email sent successfully', { to, subject, id: result.data?.id });
  } catch (error: any) {
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

export function generateConfirmationEmail(
  meetingTitle: string,
  actionsCount: number,
  actions: Array<{
    description: string;
    assignee: string;
    dueDate: string | null;
    priority: string;
  }>
): string {
  const actionsList = actions
    .map((action) => {
      let dueDateText = '<strong>Due:</strong> Not specified';
      
      if (action.dueDate) {
        try {
          const date = new Date(action.dueDate);
          // Check if date is valid
          if (!isNaN(date.getTime())) {
            dueDateText = `<strong>Due:</strong> ${date.toLocaleDateString('en-US', { 
              weekday: 'short', 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric' 
            })}`;
          } else {
            // If invalid date, just show the raw string (e.g., "Friday", "next week")
            dueDateText = `<strong>Due:</strong> ${action.dueDate}`;
          }
        } catch (e) {
          // If parsing fails, show the raw string
          dueDateText = `<strong>Due:</strong> ${action.dueDate}`;
        }
      }
      
      const priorityColor = {
        high: '#ef4444',
        medium: '#f59e0b',
        low: '#10b981',
      }[action.priority] || '#6b7280';

      return `
        <div style="margin-bottom: 16px; padding: 12px; border-left: 4px solid ${priorityColor}; background-color: #f9fafb;">
          <p style="margin: 0 0 8px 0; font-weight: 600; color: #111827;">${action.description}</p>
          <p style="margin: 0; font-size: 14px; color: #6b7280;">
            <strong>Assignee:</strong> ${action.assignee} • ${dueDateText} • 
            <span style="color: ${priorityColor}; text-transform: uppercase; font-weight: 600;">${action.priority}</span>
          </p>
        </div>
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #374151; background-color: #f3f4f6; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
          <div style="background-color: #3b82f6; color: #ffffff; padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 700;">✅ Meeting Processed Successfully</h1>
          </div>
          
          <div style="padding: 24px;">
            <p style="margin: 0 0 16px 0; font-size: 16px; color: #111827;">
              Your meeting "<strong>${meetingTitle}</strong>" has been processed by TeamSync.
            </p>
            
            <p style="margin: 0 0 24px 0; font-size: 16px; color: #6b7280;">
              We extracted <strong>${actionsCount}</strong> action item${actionsCount !== 1 ? 's' : ''} from your meeting:
            </p>
            
            ${actionsList}
            
            <div style="margin-top: 32px; padding: 16px; background-color: #eff6ff; border-radius: 6px; border: 1px solid #3b82f6;">
              <p style="margin: 0; font-size: 14px; color: #1e40af;">
                💡 <strong>What's Next?</strong> You'll receive reminder emails for upcoming action items based on their due dates.
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