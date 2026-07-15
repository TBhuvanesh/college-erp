import { z } from 'zod';

export const NOTIFICATION_TYPES = [
  'Announcement',
  'Assignment',
  'Grade Released',
  'Event',
  'Internship',
  'Job Opportunity',
  'Placement Drive',
  'Reminder',
  'Academic Alert',
] as const;

export const NOTIFICATION_TARGET_ROLES = ['all', 'admin', 'faculty', 'student'] as const;

export const SOURCE_MODULES = [
  'announcement',
  'academic_calendar',
  'lms_assignment',
  'opportunity',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type NotificationTargetRole = (typeof NOTIFICATION_TARGET_ROLES)[number];
export type SourceModule = (typeof SOURCE_MODULES)[number];

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  sourceModule: string | null;
  sourceId: string | null;
  targetRole: NotificationTargetRole;
  departmentId: string | null;
  departmentName: string | null;
  semester: number | null;
  recipientUserId: string | null;
  isImportant: boolean;
  isRead: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
}

export interface NotificationCount {
  total: number;
  unread: number;
}

export interface PaginatedNotifications {
  notifications: Notification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Zod schemas ──────────────────────────────────────────────────────────────────

export const createNotificationSchema = z.object({
  title:        z.string().min(1).max(255),
  message:      z.string().min(1).optional(),
  type:         z.enum(NOTIFICATION_TYPES),
  targetRole:   z.enum(NOTIFICATION_TARGET_ROLES).default('all'),
  departmentId: z.string().uuid().optional().nullable(),
  semester:     z.coerce.number().int().min(1).max(12).optional().nullable(),
  recipientUserId: z.string().uuid().optional().nullable(),
  isImportant:  z.boolean().default(false),
  sourceModule: z.enum(SOURCE_MODULES).optional(),
  sourceId:     z.string().uuid().optional(),
});

export const listNotificationsQuerySchema = z.object({
  type:        z.enum(NOTIFICATION_TYPES).optional(),
  isRead:      z.enum(['true', 'false']).optional(),
  isImportant: z.enum(['true', 'false']).optional(),
  page:        z.coerce.number().int().min(1).default(1),
  limit:       z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
export type ListNotificationsQuery  = z.infer<typeof listNotificationsQuerySchema>;
