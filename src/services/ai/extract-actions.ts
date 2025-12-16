import { GoogleGenAI } from '@google/genai';
import { ExtractedAction } from '../../types/schemas';

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

/**
 * Helper function to convert relative dates to YYYY-MM-DD format
 */
function getActualDate(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

function getDateForDay(dayName: string): string {
  const today = new Date();
  const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const targetDay = daysOfWeek.indexOf(dayName.toLowerCase());
  
  if (targetDay === -1) return getActualDate();
  
  const currentDay = today.getDay();
  let daysUntil = targetDay - currentDay;
  
  // If the target day is today or has passed this week, assume next week
  if (daysUntil <= 0) {
    daysUntil += 7;
  }
  
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + daysUntil);
  return futureDate.toISOString().split('T')[0];
}

export async function extractActionsFromTranscript(
  transcript: string
): Promise<ExtractedAction[]> {
  const todayDate = getActualDate();
  
  const prompt = `You are analyzing a meeting transcript to extract actionable tasks.

IMPORTANT: For due dates, convert relative dates to YYYY-MM-DD format based on today's date (${todayDate}):
- "today" → ${todayDate}
- "tomorrow" → ${new Date(Date.now() + 86400000).toISOString().split('T')[0]}
- "Friday" → calculate the next upcoming Friday from ${todayDate}
- "next week" → add 7 days to ${todayDate}
- "end of month" → last day of current month
- If no due date mentioned → null

Meeting Transcript:
${transcript}`;

  try {
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      config: {
        temperature: 0.3,
        maxOutputTokens: 2000,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              description: { type: 'STRING' },
              assignee: { type: 'STRING' },
              due_date: { type: 'STRING', nullable: true },
              priority: { 
                type: 'STRING', 
                enum: ["low", "medium", "high"] 
              },
            },
            required: ["description", "assignee", "priority"],
          },
        },
      },
    });

    const responseText = response.text; 
    
    if (!responseText) {
      throw new Error('No content returned');
    }

    const extractedActions = JSON.parse(responseText);

    // Map to your internal type and normalize dates
    const normalizedActions: ExtractedAction[] = extractedActions.map((action: any) => {
      let dueDate = action.due_date || null;
      
      // If due_date is not in YYYY-MM-DD format, try to parse it
      if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        const lowerDate = dueDate.toLowerCase();
        
        if (lowerDate === 'today') {
          dueDate = getActualDate();
        } else if (lowerDate === 'tomorrow') {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          dueDate = tomorrow.toISOString().split('T')[0];
        } else if (['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].includes(lowerDate)) {
          dueDate = getDateForDay(lowerDate);
        } else if (lowerDate.includes('next week')) {
          const nextWeek = new Date();
          nextWeek.setDate(nextWeek.getDate() + 7);
          dueDate = nextWeek.toISOString().split('T')[0];
        } else {
          // If we can't parse it, set to null
          dueDate = null;
        }
      }
      
      return {
        description: action.description,
        assignee: action.assignee,
        dueDate,
        priority: action.priority,
      };
    });

    return normalizedActions;

  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw new Error(`AI extraction failed: ${error.message}`);
  }
}