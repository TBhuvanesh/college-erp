import type { Request, Response } from 'express';
import * as announcementService from '../services/announcement.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import type {
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
  UpdateAnnouncementStatusInput,
  ListAnnouncementsQuery,
} from '../types/announcement';

// ── All roles: list and view ──────────────────────────────────────────────────

export const listAnnouncements = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as ListAnnouncementsQuery;
  const result = await announcementService.listAnnouncements(
    filters,
    req.user!.id,
    req.user!.role
  );
  sendSuccess(res, result);
});

export const getAnnouncement = asyncHandler(async (req: Request, res: Response) => {
  const announcement = await announcementService.getAnnouncementById(
    req.params.id,
    req.user!.id,
    req.user!.role
  );
  sendSuccess(res, { announcement });
});

// ── Admin: create, update, publish, delete ────────────────────────────────────

export const createAnnouncement = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as CreateAnnouncementInput;
  const announcement = await announcementService.createAnnouncement(data, req.user!.id);
  sendCreated(res, { announcement }, 'Announcement created successfully');
});

export const updateAnnouncement = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as UpdateAnnouncementInput;
  const announcement = await announcementService.updateAnnouncement(
    req.params.id,
    data,
    req.user!.id
  );
  sendSuccess(res, { announcement }, 'Announcement updated successfully');
});

export const updateAnnouncementStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body as UpdateAnnouncementStatusInput;
  const announcement = await announcementService.updateAnnouncementStatus(
    req.params.id,
    status,
    req.user!.id
  );
  sendSuccess(res, { announcement }, `Announcement ${status.toLowerCase()} successfully`);
});

export const deleteAnnouncement = asyncHandler(async (req: Request, res: Response) => {
  await announcementService.deleteAnnouncement(req.params.id, req.user!.id);
  sendSuccess(res, null, 'Announcement deleted successfully');
});
