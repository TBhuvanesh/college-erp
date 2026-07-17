import type { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import * as service from '../services/mentorGroup.service';
import {
  CreateMentorGroupSchema,
  UpdateMentorGroupSchema,
  checkConflictsSchema,
  suggestBalancedGroupsSchema,
  splitMentorGroupSchema,
  mergeMentorGroupsSchema,
} from '../types/mentorGroup';
import { AppError } from '../errors/AppError';

function actorRole(req: Request): 'admin' | 'faculty' {
  return req.user!.role === 'admin' ? 'admin' : 'faculty';
}

export async function createGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next(AppError.unauthorized());

    const data = CreateMentorGroupSchema.parse(req.body);
    const group = await service.createMentorGroup(data, req.user.id, actorRole(req));

    res.status(201).json({
      success: true,
      data: group,
      message: 'Mentor group created successfully'
    });
  } catch (err) {
    next(err);
  }
}

export async function getGroups(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let mentorId = req.query.mentorId as string;
    if (req.user && req.user.role === 'faculty') {
      const facResult = await query<{ id: string }>(
        'SELECT id FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
        [req.user.id]
      );
      mentorId = facResult.rows[0]?.id;
    }

    const filters = {
      mentorId,
      departmentId: req.query.departmentId as string,
      semester: req.query.semester ? Number(req.query.semester) : undefined,
      section: req.query.section as string,
      assignmentMethod: req.query.assignmentMethod as string,
    };

    const groups = await service.getMentorGroups(filters);

    res.json({
      success: true,
      data: groups
    });
  } catch (err) {
    next(err);
  }
}

export async function updateGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next(AppError.unauthorized());

    const data = UpdateMentorGroupSchema.parse(req.body);
    const group = await service.updateMentorGroup(req.params.id, data, req.user.id, actorRole(req));

    res.json({
      success: true,
      data: group,
      message: 'Mentor group updated successfully'
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next(AppError.unauthorized());

    await service.deleteMentorGroup(req.params.id, req.user.id);

    res.json({
      success: true,
      message: 'Mentor group deleted successfully'
    });
  } catch (err) {
    next(err);
  }
}

export async function resolveStudents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const students = await service.resolveStudentsInGroup(req.params.id);
    res.json({
      success: true,
      data: students
    });
  } catch (err) {
    next(err);
  }
}

export async function checkConflicts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = checkConflictsSchema.parse(req.body);
    const result = await service.checkMentorGroupConflicts(data);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function suggestBalancedGroups(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = suggestBalancedGroupsSchema.parse(req.query);
    const result = await service.suggestBalancedGroups(data);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function listMentorCandidates(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const departmentId = req.query.departmentId as string;
    const candidates = await service.listMentorCandidates(departmentId);
    res.json({ success: true, data: candidates });
  } catch (err) {
    next(err);
  }
}

export async function splitGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next(AppError.unauthorized());
    const data = splitMentorGroupSchema.parse(req.body);
    const result = await service.splitMentorGroup(req.params.id, data, req.user.id, actorRole(req));
    res.json({ success: true, data: result, message: 'Mentor group split successfully' });
  } catch (err) {
    next(err);
  }
}

export async function mergeGroups(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next(AppError.unauthorized());
    const data = mergeMentorGroupsSchema.parse(req.body);
    const result = await service.mergeMentorGroups(data, req.user.id, actorRole(req));
    res.json({ success: true, data: result, message: 'Mentor groups merged successfully' });
  } catch (err) {
    next(err);
  }
}
