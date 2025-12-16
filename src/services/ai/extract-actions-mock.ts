import { ExtractedAction } from '../../types/schemas';

/**
 * Mock AI extraction for testing purposes
 * This simulates what Claude/OpenAI would return
 */
export async function extractActionsFromTranscript(
  transcript: string
): Promise<ExtractedAction[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));

  // Simple pattern matching to extract names and tasks
  const lines = transcript.split('\n').filter(line => line.trim());
  const actions: ExtractedAction[] = [];

  // Look for common patterns
  const patterns = [
    /(\w+):\s*(.+?)\s+by\s+(Monday|Tuesday|Wednesday|Thursday|Friday|today|tomorrow)/gi,
    /(\w+)\s+will\s+(.+?)\s+by\s+(Monday|Tuesday|Wednesday|Thursday|Friday|today|tomorrow)/gi,
    /(\w+)\s+needs? to\s+(.+)/gi,
    /(\w+),?\s+(?:can you|please)\s+(.+)/gi,
  ];

  for (const line of lines) {
    for (const pattern of patterns) {
      const matches = [...line.matchAll(pattern)];
      for (const match of matches) {
        const assignee = match[1];
        const task = match[2];
        const deadline = match[3];

        // Calculate due date
        let dueDate: string | null = null;
        if (deadline) {
          const today = new Date();
          const dayMap: Record<string, number> = {
            'monday': 1, 'tuesday': 2, 'wednesday': 3,
            'thursday': 4, 'friday': 5, 'today': today.getDay(),
            'tomorrow': (today.getDay() + 1) % 7
          };
          
          const targetDay = dayMap[deadline.toLowerCase()];
          if (targetDay !== undefined) {
            const daysUntil = (targetDay - today.getDay() + 7) % 7 || 7;
            const futureDate = new Date(today);
            futureDate.setDate(today.getDate() + daysUntil);
            dueDate = futureDate.toISOString().split('T')[0];
          }
        }

        // Determine priority based on keywords
        let priority: 'low' | 'medium' | 'high' = 'medium';
        if (line.toLowerCase().includes('urgent') || 
            line.toLowerCase().includes('critical') ||
            line.toLowerCase().includes('asap') ||
            line.toLowerCase().includes('today')) {
          priority = 'high';
        } else if (line.toLowerCase().includes('when you can') ||
                   line.toLowerCase().includes('eventually')) {
          priority = 'low';
        }

        actions.push({
          description: task.trim(),
          assignee: assignee.trim(),
          dueDate,
          priority,
        });
      }
    }
  }

  // If no patterns matched, create a generic action
  if (actions.length === 0) {
    actions.push({
      description: 'Follow up on meeting discussion',
      assignee: 'Unassigned',
      dueDate: null,
      priority: 'medium',
    });
  }

  return actions;
}