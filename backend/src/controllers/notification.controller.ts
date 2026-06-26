import type { Request, Response } from 'express';
import * as notificationService from '../services/notification.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import type { CreateNotificationInput, ListNotificationsQuery } from '../types/notification';

export const createNotification = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as CreateNotificationInput;
  const notification = await notificationService.createNotification(
    req.user!.id,
    req.user!.role,
    data
  );
  sendCreated(res, { notification }, 'Notification created successfully');
});

export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as ListNotificationsQuery;
  const result = await notificationService.listNotifications(
    req.user!.id,
    req.user!.role,
    filters
  );
  sendSuccess(res, result);
});

export const getNotificationCount = asyncHandler(async (req: Request, res: Response) => {
  const count = await notificationService.getNotificationCount(
    req.user!.id,
    req.user!.role
  );
  sendSuccess(res, { count });
});

export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  await notificationService.markAsRead(req.user!.id, req.params.id);
  sendSuccess(res, null, 'Notification marked as read');
});

export const markAsUnread = asyncHandler(async (req: Request, res: Response) => {
  await notificationService.markAsUnread(req.user!.id, req.params.id);
  sendSuccess(res, null, 'Notification marked as unread');
});
