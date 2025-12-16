import { z } from 'zod';

// Meeting schemas
export const uploadMeetingSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  transcript: z.string().min(10, 'Transcript must be at least 10 characters'),
  uploadedBy: z.string().email('Must be a valid email').optional(),
});

export type UploadMeetingInput = z.infer<typeof uploadMeetingSchema>;

export const meetingSchema = z.object({
  id: z.string(),
  title: z.string(),
  transcript: z.string(),
  uploadedBy: z.string().optional(),
  createdAt: z.string(),
  processed: z.boolean(),
});

export type Meeting = z.infer<typeof meetingSchema>;

// Action item schemas
export const actionItemSchema = z.object({
  id: z.string(),
  meetingId: z.string(),
  description: z.string(),
  assignee: z.string(),
  dueDate: z.string().nullable(),
  priority: z.enum(['low', 'medium', 'high']),
  status: z.enum(['pending', 'in_progress', 'done', 'overdue']),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
});

export type ActionItem = z.infer<typeof actionItemSchema>;

// AI extraction schema
export const extractedActionSchema = z.object({
  description: z.string(),
  assignee: z.string(),
  dueDate: z.string().nullable(),
  priority: z.enum(['low', 'medium', 'high']),
});

export type ExtractedAction = z.infer<typeof extractedActionSchema>;

// Update action schema
export const updateActionSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'done', 'overdue']).optional(),
  assignee: z.string().optional(),
  dueDate: z.string().nullable().optional(),
});

export type UpdateActionInput = z.infer<typeof updateActionSchema>;

// Dashboard metrics schema
export const dashboardMetricsSchema = z.object({
  totalMeetings: z.number(),
  activeActions: z.number(),
  completedActions: z.number(),
  overdueActions: z.number(),
  completionRate: z.number(),
  priorityBreakdown: z.object({
    high: z.number(),
    medium: z.number(),
    low: z.number(),
  }),
});

export type DashboardMetrics = z.infer<typeof dashboardMetricsSchema>;