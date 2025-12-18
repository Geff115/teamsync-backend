import { ApiRouteConfig, Handlers } from 'motia';
import { uploadMeetingSchema, meetingSchema } from '../types/schemas';
import { coreMiddleware } from '../middlewares/core.middleware';

export const config: ApiRouteConfig = {
  name: 'UploadMeeting',
  type: 'api',
  path: '/meetings/upload',
  method: 'POST',
  description: 'Upload a meeting transcript for processing',
  bodySchema: uploadMeetingSchema,
  responseSchema: {
    201: meetingSchema,
    400: { type: 'object', properties: { error: { type: 'string' } } },
  },
  emits: ['meeting.uploaded'],
  flows: ['meeting-processing'],
  middleware: [coreMiddleware],
};

export const handler = async (req: any, { emit, logger, state }: any) => {
  const { title, transcript, uploadedBy } = uploadMeetingSchema.parse(req.body);

  logger.info('Meeting upload started', { title, uploadedBy });

  // Generate unique meeting ID
  const meetingId = `meeting_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // Create meeting object
  const meeting = {
    id: meetingId,
    title,
    transcript,
    uploadedBy: uploadedBy || 'anonymous',
    createdAt: new Date().toISOString(),
    processed: false,
  };

  // Store meeting in Motia state
  await state.set('meetings', meetingId, meeting);

  // Track meeting ID in metadata
  const meetingIds = (await state.get('metadata', 'meetingIds')) || [];
  meetingIds.push(meetingId);
  await state.set('metadata', 'meetingIds', meetingIds);

  logger.info('Meeting stored in state', { meetingId, title });

  // Emit event to trigger extraction
  await emit({
    topic: 'meeting.uploaded',
    data: {
      meetingId,
      title,
      transcript,
    },
  });

  logger.info('Meeting upload completed, extraction triggered', { meetingId });

  return {
    status: 201,
    body: meeting,
  };
};