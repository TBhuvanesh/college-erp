import type { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import * as service from '../services/mentorGroup.service';
import { CreateMentorGroupSchema, UpdateMentorGroupSchema } from '../types/mentorGroup';
import { AppError } from '../errors/AppError';
import { auditLog } from '../utils/audit';

export async function createGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next(AppError.unauthorized());

    const data = CreateMentorGroupSchema.parse(req.body);
    const group = await service.createMentorGroup(data, req.user.id);
    
    await auditLog({
      actorId: req.user.id,
      action: 'MENTORSHIP_GROUP_CREATE',
      resource: 'mentor_groups',
      resourceId: group.id,
      changes: { mentorId: group.mentorId, method: group.assignmentMethod },
      req
    });

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
      year: req.query.year ? Number(req.query.year) : undefined,
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
    const group = await service.updateMentorGroup(req.params.id, data);

    await auditLog({
      actorId: req.user.id,
      action: 'MENTORSHIP_GROUP_UPDATE',
      resource: 'mentor_groups',
      resourceId: req.params.id,
      changes: data,
      req
    });

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

    await service.deleteMentorGroup(req.params.id);

    await auditLog({
      actorId: req.user.id,
      action: 'MENTORSHIP_GROUP_DELETE',
      resource: 'mentor_groups',
      resourceId: req.params.id,
      changes: {},
      req
    });

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
