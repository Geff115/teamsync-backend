import { GoogleGenAI } from '@google/genai';
import { ExtractedAction } from '../../types/schemas';

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export async function extractActionsFromTranscript(
  transcript: string
): Promise<ExtractedAction[]> {
  // 1. We don't need to ask for "NO MARKDOWN" anymore. The schema handles strictness.
  const prompt = `You are analyzing a meeting transcript to extract actionable tasks.
  
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
        // 2. Enforce JSON response type
        responseMimeType: 'application/json',
        // 3. Define the exact schema you want back
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

    // 4. In the new SDK, accessing text is often a function call or direct property access depending on version.
    // However, since we requested JSON, the new SDK might offer a parsed object directly if supported,
    // otherwise we parse the text safely.
    const responseText = response.text; 
    
    if (!responseText) {
      throw new Error('No content returned');
    }

    const extractedActions = JSON.parse(responseText);

    // Map to your internal type
    const normalizedActions: ExtractedAction[] = extractedActions.map((action: any) => ({
      description: action.description,
      assignee: action.assignee,
      dueDate: action.due_date || null,
      priority: action.priority,
    }));

    return normalizedActions;

  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw new Error(`AI extraction failed: ${error.message}`);
  }
}