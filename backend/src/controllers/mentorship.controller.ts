import type { Request, Response, NextFunction } from 'express';
import * as mentorshipService from '../services/mentorship.service';
import { 
  assignMentorSchema, 
  reassignMentorSchema, 
  createMentoringNoteSchema, 
  updateMentoringNoteSchema 
} from '../types/mentorship';
import { auditLog } from '../utils/audit';

export async function assignMentor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = assignMentorSchema.parse(req.body);
    const result = await mentorshipService.assignMentor(data, req.user!.id);
    
    await auditLog({
      actorId: req.user!.id,
      action: 'ASSIGN_MENTOR',
      resource: 'mentor_assignments',
      resourceId: result.id,
      changes: { mentorId: data.mentorId, studentId: data.studentId },
      req
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function reassignMentor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = reassignMentorSchema.parse(req.body);
    const result = await mentorshipService.reassignMentor(data, req.user!.id);
    
    await auditLog({
      actorId: req.user!.id,
      action: 'REASSIGN_MENTOR',
      resource: 'mentor_assignments',
      resourceId: result.id,
      changes: { mentorId: data.mentorId, studentId: data.studentId },
      req
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function getMentorByStudent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const studentId = req.params.id;
    const result = await mentorshipService.getMentorByStudent(studentId);
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function getStudentsByMentor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const mentorId = req.params.id;
    const result = await mentorshipService.getStudentsByMentor(mentorId);
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function getMentorDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await mentorshipService.getMentorDashboard(req.user!.id);
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function addNote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = createMentoringNoteSchema.parse(req.body);
    const result = await mentorshipService.addNote(data, req.user!.id);

    await auditLog({
      actorId: req.user!.id,
      action: 'ADD_MENTORING_NOTE',
      resource: 'mentoring_notes',
      resourceId: result.id,
      changes: data,
      req
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateNote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const noteId = req.params.id;
    const data = updateMentoringNoteSchema.parse(req.body);
    const result = await mentorshipService.updateNote(noteId, data);

    await auditLog({
      actorId: req.user!.id,
      action: 'UPDATE_MENTORING_NOTE',
      resource: 'mentoring_notes',
      resourceId: noteId,
      changes: data,
      req
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteNote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const noteId = req.params.id;
    await mentorshipService.deleteNote(noteId);

    await auditLog({
      actorId: req.user!.id,
      action: 'DELETE_MENTORING_NOTE',
      resource: 'mentoring_notes',
      resourceId: noteId,
      req
    });

    res.json({
      success: true,
      message: 'Mentoring note deleted successfully',
    });
  } catch (err) {
    next(err);
  }
}

export async function getNotesByStudent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const studentId = req.params.id;
    const result = await mentorshipService.getNotesByStudent(studentId);
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function getMentorWorkloads(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await mentorshipService.getMentorWorkloads();
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function getMentorshipReports(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await mentorshipService.getMentorshipReports();
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}
