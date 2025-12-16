import { GoogleGenerativeAI } from '@google/generative-ai';
import { ExtractedAction } from '../../types/schemas';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function extractActionsFromTranscript(
  transcript: string
): Promise<ExtractedAction[]> {
  const prompt = `You are analyzing a meeting transcript to extract actionable tasks.

Extract ALL action items from this meeting. For each action item, identify:
1. description: A clear, specific task (e.g., "Send Q4 budget to finance team")
2. assignee: Person responsible (extract from phrases like "John will...", "Sarah to...", or "Unassigned" if unclear)
3. due_date: Deadline in YYYY-MM-DD format (extract from "by Friday", "next week", "end of month", or null if not mentioned)
4. priority: Classify as "high" (urgent/critical), "medium" (important), or "low" (nice-to-have)

Meeting Transcript:
${transcript}

Return ONLY a JSON array with this exact structure:
[
  {
    "description": "string",
    "assignee": "string",
    "due_date": "YYYY-MM-DD" or null,
    "priority": "low" | "medium" | "high"
  }
]

No markdown, no explanations, just the JSON array.`;

  try {
    // Use Gemini 1.5 Flash (faster and free)
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2000,
      },
    });

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    if (!text) {
      throw new Error('No text content in Gemini response');
    }

    let responseText = text.trim();

    // Remove markdown code fences if present
    responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    // Parse the JSON response
    const extractedActions = JSON.parse(responseText);

    // Validate the structure
    if (!Array.isArray(extractedActions)) {
      throw new Error('Gemini response is not an array');
    }

    // Map due_date to dueDate (snake_case to camelCase)
    const normalizedActions: ExtractedAction[] = extractedActions.map((action: any) => ({
      description: action.description,
      assignee: action.assignee,
      dueDate: action.due_date || null,
      priority: action.priority,
    }));

    return normalizedActions;
  } catch (error: any) {
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse Gemini response as JSON: ${error.message}`);
    }
    throw new Error(`AI extraction failed: ${error.message}`);
  }
}