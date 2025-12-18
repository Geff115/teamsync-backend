import { ApiRouteConfig } from 'motia';
import { dashboardMetricsSchema } from '../types/schemas';
import { coreMiddleware } from '../middlewares/core.middleware';

export const config: ApiRouteConfig = {
  name: 'GetDashboard',
  type: 'api',
  path: '/dashboard',
  method: 'GET',
  description: 'Get dashboard metrics and statistics',
  emits: [],
  responseSchema: {
    200: dashboardMetricsSchema,
  },
  middleware: [coreMiddleware],
};

export const handler = async (req: any, { logger, state }: any) => {
  logger.info('Fetching dashboard metrics');

  try {
    // Get all meetings and actions
    const allMeetings = await state.getGroup('meetings');
    const allActions = await state.getGroup('actions');

    // Calculate metrics
    const totalMeetings = allMeetings?.length || 0;
    
    const activeActions = allActions?.filter((a: any) => 
      a.status === 'pending' || a.status === 'in_progress'
    ).length || 0;

    const completedActions = allActions?.filter((a: any) => 
      a.status === 'done'
    ).length || 0;

    const overdueActions = allActions?.filter((a: any) => 
      a.status === 'overdue'
    ).length || 0;

    const totalActions = allActions?.length || 0;
    const completionRate = totalActions > 0 
      ? Math.round((completedActions / totalActions) * 100) 
      : 0;

    // Priority breakdown
    const highPriority = allActions?.filter((a: any) => 
      a.priority === 'high' && a.status !== 'done'
    ).length || 0;

    const mediumPriority = allActions?.filter((a: any) => 
      a.priority === 'medium' && a.status !== 'done'
    ).length || 0;

    const lowPriority = allActions?.filter((a: any) => 
      a.priority === 'low' && a.status !== 'done'
    ).length || 0;

    const metrics = {
      totalMeetings,
      activeActions,
      completedActions,
      overdueActions,
      completionRate,
      priorityBreakdown: {
        high: highPriority,
        medium: mediumPriority,
        low: lowPriority,
      },
    };

    logger.info('Dashboard metrics calculated', metrics);

    return {
      status: 200,
      body: metrics,
    };
  } catch (error: any) {
    logger.error('Failed to fetch dashboard metrics', {
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
};