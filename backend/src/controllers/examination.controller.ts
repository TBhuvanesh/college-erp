import type { Request, Response } from 'express';
import * as examService from '../services/examination.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';
import type {
  CreateExamInput,
  UpdateExamInput,
  UpdateExamStatusInput,
  ListExamsQuery,
} from '../types/examination';

// ── Admin + Faculty: list with filters ────────────────────────────────────────

export const listExams = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as ListExamsQuery;

  // Faculty sees only their own exams in the shared list
  if (req.user!.role === 'faculty') {
    const { rows } = await (await import('../config/database')).query<{ id: string }>(
      'SELECT id FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
      [req.user!.id]
    );
    if (rows[0]) {
      (filters as ListExamsQuery & { facultyId?: string }).facultyId = rows[0].id;
    }
  }

  const result = await examService.listExams(filters);
  sendSuccess(res, result);
});

// ── Admin + Faculty + Student: single exam ────────────────────────────────────

export const getExam = asyncHandler(async (req: Request, res: Response) => {
  const exam = await examService.getExamById(req.params.id);

  // Students may only view exams for their own semester+section
  if (req.user!.role === 'student') {
    const { rows } = await (await import('../config/database')).query<{
      program_id: string;
      semester: number;
      section: string;
    }>(
      'SELECT program_id, semester, section FROM students WHERE user_id = $1 AND deleted_at IS NULL',
      [req.user!.id]
    );
    if (!rows[0]) throw AppError.forbidden('No student profile is linked to this account');

    const { rows: subRows } = await (await import('../config/database')).query<{
      program_id: string;
    }>(
      'SELECT program_id FROM subjects WHERE id = $1',
      [exam.subjectId]
    );

    const student = rows[0];
    const subjectProgram = subRows[0];

    const sameProgram = subjectProgram && subjectProgram.program_id === student.program_id;
    const sameSemester = exam.semester === Number(student.semester);
    const sameSection = exam.section === student.section;

    if (!sameProgram || !sameSemester || !sameSection) {
      throw AppError.forbidden('You do not have access to this examination');
    }
  }

  sendSuccess(res, { exam });
});

// ── Faculty: my schedule ──────────────────────────────────────────────────────

export const getMySchedule = asyncHandler(async (req: Request, res: Response) => {
  const exams = await examService.getFacultySchedule(req.user!.id);
  sendSuccess(res, { exams, total: exams.length });
});

// ── Student: timetable ────────────────────────────────────────────────────────

export const getTimetable = asyncHandler(async (req: Request, res: Response) => {
  const exams = await examService.getStudentTimetable(req.user!.id);
  sendSuccess(res, { exams, total: exams.length });
});

export const getUpcomingExams = asyncHandler(async (req: Request, res: Response) => {
  const exams = await examService.getStudentTimetable(req.user!.id, 'upcoming');
  sendSuccess(res, { exams, total: exams.length });
});

// ── Admin + Faculty: create ───────────────────────────────────────────────────

export const createExam = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as CreateExamInput;
  const exam = await examService.createExam(data, req.user!.id, req.user!.role);
  sendCreated(res, { exam }, 'Examination scheduled successfully');
});

// ── Admin + Faculty: update details ──────────────────────────────────────────

export const updateExam = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as UpdateExamInput;
  const exam = await examService.updateExam(req.params.id, data, req.user!.id, req.user!.role);
  sendSuccess(res, { exam }, 'Examination updated successfully');
});

// ── Admin + Faculty: update status ───────────────────────────────────────────

export const updateExamStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body as UpdateExamStatusInput;
  const exam = await examService.updateExamStatus(
    req.params.id,
    status,
    req.user!.id,
    req.user!.role
  );
  sendSuccess(res, { exam }, `Examination status updated to ${status}`);
});

// ── Admin: delete (soft) ──────────────────────────────────────────────────────

export const deleteExam = asyncHandler(async (req: Request, res: Response) => {
  await examService.deleteExam(req.params.id, req.user!.id);
  sendSuccess(res, null, 'Examination deleted successfully');
});

// ── Examination Sessions Controllers ──────────────────────────────────────────

export const createSession = asyncHandler(async (req: Request, res: Response) => {
  const session = await examService.createExaminationSession(req.body, req.user!.id);
  sendCreated(res, { session }, 'Examination Session created successfully');
});

export const getSession = asyncHandler(async (req: Request, res: Response) => {
  const session = await examService.getExaminationSessionById(req.params.id);
  sendSuccess(res, { session });
});

export const listSessions = asyncHandler(async (req: Request, res: Response) => {
  const filters = {
    page: req.query.page ? Number(req.query.page) : 1,
    limit: req.query.limit ? Number(req.query.limit) : 20,
    departmentId: req.query.departmentId as string | undefined,
    year: req.query.year as string | undefined,
    semester: req.query.semester ? Number(req.query.semester) : undefined,
    status: req.query.status as string | undefined,
  };
  const result = await examService.listExaminationSessions(filters);
  sendSuccess(res, result);
});

export const configureSubjectSchedule = asyncHandler(async (req: Request, res: Response) => {
  const session = await examService.configureSubjectSchedule(req.params.id, req.body, req.user!.id);
  sendSuccess(res, { session }, 'Subject examination schedule configured successfully');
});

export const publishSession = asyncHandler(async (req: Request, res: Response) => {
  const session = await examService.publishExaminationSession(req.params.id, req.user!.id);
  sendSuccess(res, { session }, 'Examination Session published successfully');
});

export const deleteSession = asyncHandler(async (req: Request, res: Response) => {
  await examService.deleteExaminationSession(req.params.id, req.user!.id);
  sendSuccess(res, null, 'Examination Session deleted successfully');
});

