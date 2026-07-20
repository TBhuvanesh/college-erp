import { query, withTransaction } from '../config/database';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';
import { createNotification } from './notification.service';
import type {
  FeedbackCampaign,
  CreateCampaignInput,
  UpdateCampaignInput,
  PreviewEligibilityInput,
  ListCampaignsQuery,
  CampaignStatus,
  CampaignConflict,
  CampaignConflictCheckResult,
  EligibilityEntry,
  StudentCampaignView,
  StudentCampaignItem,
  SubmitFeedbackInput,
  FeedbackTemplate,
  FeedbackQuestion,
  CreateTemplateInput,
  UpdateTemplateInput,
  CreateQuestionInput,
  UpdateQuestionInput,
  CampaignAnalytics,
  CampaignAnalyticsSummary,
  CampaignQuestionAnalytics,
} from '../types/feedback';
import { SUBJECT_SCOPED_TYPES } from '../types/feedback';

// ── Row / mapping ────────────────────────────────────────────────────────────

interface CampaignRow {
  id: string;
  title: string;
  academic_year: string;
  status: CampaignStatus;
  template_id: string | null;
  template_title: string | null;
  template_type: FeedbackCampaign['templateType'];
  target_department_ids: string[];
  target_department_names: string[] | null;
  target_semesters: number[];
  target_sections: string[];
  target_subject_ids: string[];
  target_faculty_ids: string[];
  start_date: Date;
  end_date: Date;
  published_at: Date | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

const CAMPAIGN_COLS = `
  fw.id, fw.title, fw.academic_year, fw.status,
  fw.template_id, ft.title AS template_title, ft.type AS template_type,
  fw.target_department_ids,
  (SELECT array_agg(d.name ORDER BY d.name) FROM departments d WHERE d.id = ANY(fw.target_department_ids)) AS target_department_names,
  fw.target_semesters, fw.target_sections, fw.target_subject_ids, fw.target_faculty_ids,
  fw.start_date, fw.end_date, fw.published_at, fw.created_by, fw.created_at, fw.updated_at
`;

const CAMPAIGN_JOIN = `LEFT JOIN feedback_templates ft ON ft.id = fw.template_id`;

// A campaign's *stored* status is only ever 'draft' | 'published' | 'closed' | 'archived' —
// 'open' never gets written to the row. It is derived here at read time from
// 'published' + the date window, matching the "computed on demand, never
// duplicated" convention used for exam-seating conflicts / mentor-group capacity.
function deriveEffectiveStatus(status: CampaignStatus, startDate: Date, endDate: Date): CampaignStatus {
  if (status !== 'published') return status;
  const now = Date.now();
  if (now < new Date(startDate).getTime()) return 'published';
  if (now > new Date(endDate).getTime()) return 'closed';
  return 'open';
}

function toCampaign(r: CampaignRow): FeedbackCampaign {
  return {
    id: r.id,
    title: r.title,
    academicYear: r.academic_year,
    status: r.status,
    effectiveStatus: deriveEffectiveStatus(r.status, r.start_date, r.end_date),
    templateId: r.template_id,
    templateTitle: r.template_title,
    templateType: r.template_type,
    targetDepartmentIds: r.target_department_ids ?? [],
    targetDepartmentNames: r.target_department_names ?? [],
    targetSemesters: r.target_semesters ?? [],
    targetSections: r.target_sections ?? [],
    targetSubjectIds: r.target_subject_ids ?? [],
    targetFacultyIds: r.target_faculty_ids ?? [],
    startDate: r.start_date,
    endDate: r.end_date,
    publishedAt: r.published_at,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function fetchCampaignRow(id: string): Promise<CampaignRow | null> {
  const { rows } = await query<CampaignRow>(
    `SELECT ${CAMPAIGN_COLS} FROM feedback_windows fw ${CAMPAIGN_JOIN} WHERE fw.id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

async function getCampaignOrThrow(id: string): Promise<FeedbackCampaign> {
  const row = await fetchCampaignRow(id);
  if (!row) throw AppError.notFound('Feedback campaign not found');
  return toCampaign(row);
}

// ── Eligibility resolver — the single source of truth for visibility,
// submission-time validation, notifications, dashboards and analytics. ────────

interface EligibilityTarget {
  templateType: FeedbackCampaign['templateType'];
  targetDepartmentIds: string[];
  targetSemesters: number[];
  targetSections: string[];
  targetSubjectIds: string[];
  targetFacultyIds: string[];
}

export async function resolveCampaignEligibility(
  campaign: EligibilityTarget,
  options: { studentId?: string } = {}
): Promise<EligibilityEntry[]> {
  const deptFilter = campaign.targetDepartmentIds.length > 0;
  const semFilter = campaign.targetSemesters.length > 0;
  const sectionFilter = campaign.targetSections.length > 0;
  const subjectFilter = campaign.targetSubjectIds.length > 0;
  const facultyFilter = campaign.targetFacultyIds.length > 0;

  if (campaign.templateType && SUBJECT_SCOPED_TYPES.includes(campaign.templateType)) {
    const params: unknown[] = [];
    const conditions: string[] = ['fsa.is_active = TRUE', 'fsa.deleted_at IS NULL', "st.status = 'active'", 'st.deleted_at IS NULL', 's.deleted_at IS NULL'];
    const push = (val: unknown) => {
      params.push(val);
      return `$${params.length}`;
    };
    if (deptFilter) conditions.push(`s.department_id = ANY(${push(campaign.targetDepartmentIds)}::uuid[])`);
    if (semFilter) conditions.push(`s.semester = ANY(${push(campaign.targetSemesters)}::smallint[])`);
    if (sectionFilter) conditions.push(`fsa.section = ANY(${push(campaign.targetSections)}::varchar[])`);
    if (subjectFilter) conditions.push(`fsa.subject_id = ANY(${push(campaign.targetSubjectIds)}::uuid[])`);
    if (facultyFilter) conditions.push(`fsa.faculty_id = ANY(${push(campaign.targetFacultyIds)}::uuid[])`);
    if (options.studentId) conditions.push(`st.id = ${push(options.studentId)}`);

    const { rows } = await query<{ student_id: string; subject_id: string; faculty_id: string }>(
      `SELECT DISTINCT st.id AS student_id, fsa.subject_id, fsa.faculty_id
       FROM faculty_subject_assignments fsa
       JOIN subjects s ON s.id = fsa.subject_id
       JOIN students st ON st.program_id = s.program_id AND st.semester = s.semester AND st.section = fsa.section
       WHERE ${conditions.join(' AND ')}`,
      params
    );
    return rows.map((r) => ({ studentId: r.student_id, subjectId: r.subject_id, facultyId: r.faculty_id }));
  }

  // lms/erp — institution/department scoped, no subject axis.
  const params: unknown[] = [];
  const conditions: string[] = ["st.status = 'active'", 'st.deleted_at IS NULL'];
  const push = (val: unknown) => {
    params.push(val);
    return `$${params.length}`;
  };
  if (deptFilter) conditions.push(`st.department_id = ANY(${push(campaign.targetDepartmentIds)}::uuid[])`);
  if (semFilter) conditions.push(`st.semester = ANY(${push(campaign.targetSemesters)}::smallint[])`);
  if (sectionFilter) conditions.push(`st.section = ANY(${push(campaign.targetSections)}::varchar[])`);
  if (options.studentId) conditions.push(`st.id = ${push(options.studentId)}`);

  const { rows } = await query<{ student_id: string }>(
    `SELECT st.id AS student_id FROM students st WHERE ${conditions.join(' AND ')}`,
    params
  );
  return rows.map((r) => ({ studentId: r.student_id, subjectId: null, facultyId: null }));
}

// ── Conflict / Validation Engine ─────────────────────────────────────────────

async function getTemplateType(templateId: string): Promise<FeedbackCampaign['templateType']> {
  const { rows } = await query<{ type: string }>('SELECT type FROM feedback_templates WHERE id = $1 AND is_active = TRUE', [templateId]);
  if (!rows[0]) throw AppError.notFound('Feedback template not found or inactive');
  return rows[0].type as FeedbackCampaign['templateType'];
}

function sortedTargets(c: { targetDepartmentIds: string[]; targetSemesters: number[]; targetSections: string[]; targetSubjectIds: string[]; targetFacultyIds: string[] }) {
  return JSON.stringify({
    d: [...c.targetDepartmentIds].sort(),
    s: [...c.targetSemesters].sort((a, b) => a - b),
    sec: [...c.targetSections].sort(),
    subj: [...c.targetSubjectIds].sort(),
    fac: [...c.targetFacultyIds].sort(),
  });
}

interface ConflictCheckInput extends EligibilityTarget {
  startDate: string;
  endDate: string;
  templateId: string;
  excludeCampaignId?: string;
}

export async function checkCampaignConflicts(input: ConflictCheckInput): Promise<CampaignConflictCheckResult> {
  const conflicts: CampaignConflict[] = [];

  const eligibility = await resolveCampaignEligibility(input);
  const eligibleStudentIds = new Set(eligibility.map((e) => e.studentId));
  if (eligibleStudentIds.size === 0) {
    conflicts.push({ type: 'no_eligible_students', severity: 'error', message: 'No students match this campaign\'s target audience — check department, session, section and subject/faculty targets' });
  }

  if (input.targetDepartmentIds.length > 0) {
    const { rows: progRows } = await query<{ max_sem: number }>(
      `SELECT COALESCE(MAX(total_semesters), 0)::int AS max_sem FROM programs WHERE department_id = ANY($1::uuid[]) AND is_active = TRUE AND deleted_at IS NULL`,
      [input.targetDepartmentIds]
    );
    const maxSemester = progRows[0]?.max_sem ?? 0;
    if (maxSemester === 0) {
      conflicts.push({ type: 'invalid_academic_session', severity: 'error', message: 'The target department(s) have no active programs' });
    } else if (input.targetSemesters.some((s) => s > maxSemester)) {
      conflicts.push({
        type: 'invalid_academic_session',
        severity: 'error',
        message: `One or more target semesters exceed the maximum semester (${maxSemester}) offered by the target department's programs`,
      });
    }
  }

  const params: unknown[] = [input.templateId, input.endDate, input.startDate];
  let exclusion = '';
  if (input.excludeCampaignId) {
    params.push(input.excludeCampaignId);
    exclusion = `AND fw.id != $${params.length}`;
  }
  const { rows: candidateRows } = await query<CampaignRow>(
    `SELECT ${CAMPAIGN_COLS} FROM feedback_windows fw ${CAMPAIGN_JOIN}
     WHERE fw.template_id = $1 AND fw.status != 'archived'
       AND fw.start_date <= $2 AND fw.end_date >= $3 ${exclusion}`,
    params
  );
  const candidates = candidateRows.map(toCampaign);

  const targetKey = sortedTargets(input);
  const duplicate = candidates.find((c) => sortedTargets(c) === targetKey);
  if (duplicate) {
    conflicts.push({
      type: 'duplicate_campaign',
      severity: 'error',
      message: `An identical campaign ("${duplicate.title}") already targets the same audience over an overlapping date range`,
      context: { existingCampaignId: duplicate.id },
    });
  }

  if (eligibleStudentIds.size > 0) {
    for (const candidate of candidates) {
      if (duplicate && candidate.id === duplicate.id) continue;
      const otherEligibility = await resolveCampaignEligibility(candidate);
      const overlap = otherEligibility.some((e) => eligibleStudentIds.has(e.studentId));
      if (overlap) {
        conflicts.push({
          type: 'overlapping_audience',
          severity: 'warning',
          message: `This campaign's audience overlaps with an existing active campaign ("${candidate.title}") over the same date range`,
          context: { existingCampaignId: candidate.id },
        });
      }
    }
  }

  const hasBlockingConflicts = conflicts.some((c) => c.severity === 'error');
  return { hasBlockingConflicts, conflicts, eligibleCount: eligibleStudentIds.size };
}

// ── Campaign CRUD ─────────────────────────────────────────────────────────────

export async function createCampaign(data: CreateCampaignInput, actorId: string): Promise<FeedbackCampaign> {
  const templateType = await getTemplateType(data.templateId);

  const { rows: deptRows } = await query<{ id: string }>('SELECT id FROM departments WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL', [data.targetDepartmentIds]);
  if (deptRows.length !== data.targetDepartmentIds.length) throw AppError.badRequest('One or more target departments were not found');

  const conflictResult = await checkCampaignConflicts({ ...data, templateType });
  if (conflictResult.hasBlockingConflicts) {
    throw AppError.badRequest(
      `Cannot create campaign: ${conflictResult.conflicts.filter((c) => c.severity === 'error').map((c) => c.message).join('; ')}`,
      'CAMPAIGN_CONFLICT'
    );
  }

  const { rows } = await query<{ id: string }>(
    `INSERT INTO feedback_windows
       (title, academic_year, template_id, status, target_department_ids, target_semesters, target_sections, target_subject_ids, target_faculty_ids, start_date, end_date, created_by)
     VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      data.title,
      data.academicYear,
      data.templateId,
      data.targetDepartmentIds,
      data.targetSemesters,
      data.targetSections,
      data.targetSubjectIds,
      data.targetFacultyIds,
      data.startDate,
      data.endDate,
      actorId,
    ]
  );

  await auditLog({ actorId, action: 'CREATE', resource: 'feedback_campaign', resourceId: rows[0].id, changes: { to: data } });
  return getCampaignOrThrow(rows[0].id);
}

export async function updateCampaign(id: string, data: UpdateCampaignInput, actorId: string): Promise<FeedbackCampaign> {
  const existing = await getCampaignOrThrow(id);
  if (existing.status !== 'draft') throw AppError.badRequest('Only draft campaigns can be edited', 'CAMPAIGN_NOT_DRAFT');

  const merged = {
    templateId: data.templateId ?? existing.templateId!,
    targetDepartmentIds: data.targetDepartmentIds ?? existing.targetDepartmentIds,
    targetSemesters: data.targetSemesters ?? existing.targetSemesters,
    targetSections: data.targetSections ?? existing.targetSections,
    targetSubjectIds: data.targetSubjectIds ?? existing.targetSubjectIds,
    targetFacultyIds: data.targetFacultyIds ?? existing.targetFacultyIds,
    startDate: data.startDate ?? existing.startDate.toISOString(),
    endDate: data.endDate ?? existing.endDate.toISOString(),
  };
  const templateType = await getTemplateType(merged.templateId);

  const conflictResult = await checkCampaignConflicts({ ...merged, templateType, excludeCampaignId: id });
  if (conflictResult.hasBlockingConflicts) {
    throw AppError.badRequest(
      `Cannot update campaign: ${conflictResult.conflicts.filter((c) => c.severity === 'error').map((c) => c.message).join('; ')}`,
      'CAMPAIGN_CONFLICT'
    );
  }

  const sets: string[] = [];
  const params: unknown[] = [id];
  const push = (col: string, val: unknown) => {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  };
  if (data.title !== undefined) push('title', data.title);
  if (data.academicYear !== undefined) push('academic_year', data.academicYear);
  if (data.templateId !== undefined) push('template_id', data.templateId);
  if (data.targetDepartmentIds !== undefined) push('target_department_ids', data.targetDepartmentIds);
  if (data.targetSemesters !== undefined) push('target_semesters', data.targetSemesters);
  if (data.targetSections !== undefined) push('target_sections', data.targetSections);
  if (data.targetSubjectIds !== undefined) push('target_subject_ids', data.targetSubjectIds);
  if (data.targetFacultyIds !== undefined) push('target_faculty_ids', data.targetFacultyIds);
  if (data.startDate !== undefined) push('start_date', data.startDate);
  if (data.endDate !== undefined) push('end_date', data.endDate);

  if (sets.length > 0) {
    await query(`UPDATE feedback_windows SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1`, params);
  }

  await auditLog({ actorId, action: 'UPDATE', resource: 'feedback_campaign', resourceId: id, changes: { from: existing, to: data } });
  return getCampaignOrThrow(id);
}

export async function getCampaigns(filters: ListCampaignsQuery): Promise<FeedbackCampaign[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`fw.status = $${params.length}`);
  }
  if (filters.departmentId) {
    params.push(filters.departmentId);
    conditions.push(`$${params.length}::uuid = ANY(fw.target_department_ids)`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await query<CampaignRow>(
    `SELECT ${CAMPAIGN_COLS} FROM feedback_windows fw ${CAMPAIGN_JOIN} ${where} ORDER BY fw.created_at DESC`,
    params
  );
  return rows.map(toCampaign);
}

export async function getCampaignById(id: string): Promise<FeedbackCampaign> {
  return getCampaignOrThrow(id);
}

export async function previewEligibility(input: PreviewEligibilityInput): Promise<{
  eligibleCount: number;
  conflicts: CampaignConflict[];
  hasBlockingConflicts: boolean;
}> {
  const templateType = await getTemplateType(input.templateId);
  const result = await checkCampaignConflicts({
    templateId: input.templateId,
    templateType,
    targetDepartmentIds: input.targetDepartmentIds,
    targetSemesters: input.targetSemesters,
    targetSections: input.targetSections,
    targetSubjectIds: input.targetSubjectIds,
    targetFacultyIds: input.targetFacultyIds,
    startDate: input.startDate ?? new Date().toISOString(),
    endDate: input.endDate ?? new Date(Date.now() + 7 * 86400000).toISOString(),
    excludeCampaignId: input.excludeCampaignId,
  });
  return { eligibleCount: result.eligibleCount, conflicts: result.conflicts, hasBlockingConflicts: result.hasBlockingConflicts };
}

// ── Lifecycle: Publish / Close / Archive ─────────────────────────────────────

async function notifyEligibleStudents(campaign: FeedbackCampaign, studentIds: string[], actorId: string): Promise<void> {
  if (studentIds.length === 0) return;
  const { rows } = await query<{ user_id: string }>('SELECT user_id FROM students WHERE id = ANY($1::uuid[])', [studentIds]);
  for (const r of rows) {
    await createNotification(actorId, 'admin', {
      title: `Feedback Requested: ${campaign.title}`,
      message: `Your feedback is requested for "${campaign.title}". Please submit before ${new Date(campaign.endDate).toDateString()}.`,
      type: 'Academic Alert',
      targetRole: 'student',
      recipientUserId: r.user_id,
      isImportant: false,
    });
  }
}

export async function publishCampaign(id: string, actorId: string): Promise<FeedbackCampaign> {
  const campaign = await getCampaignOrThrow(id);
  if (campaign.status !== 'draft') throw AppError.badRequest('Only draft campaigns can be published', 'CAMPAIGN_NOT_DRAFT');

  const eligibility = await resolveCampaignEligibility(campaign);
  const studentIds = Array.from(new Set(eligibility.map((e) => e.studentId)));
  if (studentIds.length === 0) {
    throw AppError.badRequest('Cannot publish a campaign with no eligible students', 'NO_ELIGIBLE_STUDENTS');
  }

  await query(`UPDATE feedback_windows SET status = 'published', published_at = NOW(), updated_at = NOW() WHERE id = $1`, [id]);
  await auditLog({ actorId, action: 'PUBLISH', resource: 'feedback_campaign', resourceId: id, changes: { eligibleStudents: studentIds.length } });

  const published = await getCampaignOrThrow(id);
  await notifyEligibleStudents(published, studentIds, actorId);
  return published;
}

export async function closeCampaign(id: string, actorId: string): Promise<FeedbackCampaign> {
  const campaign = await getCampaignOrThrow(id);
  if (campaign.status !== 'published') throw AppError.badRequest('Only published campaigns can be closed', 'CAMPAIGN_NOT_PUBLISHED');

  await query(`UPDATE feedback_windows SET status = 'closed', updated_at = NOW() WHERE id = $1`, [id]);
  await auditLog({ actorId, action: 'CLOSE', resource: 'feedback_campaign', resourceId: id });
  return getCampaignOrThrow(id);
}

export async function archiveCampaign(id: string, actorId: string): Promise<FeedbackCampaign> {
  const campaign = await getCampaignOrThrow(id);
  if (campaign.status !== 'closed') throw AppError.badRequest('Only closed campaigns can be archived', 'CAMPAIGN_NOT_CLOSED');

  await query(`UPDATE feedback_windows SET status = 'archived', updated_at = NOW() WHERE id = $1`, [id]);
  await auditLog({ actorId, action: 'ARCHIVE', resource: 'feedback_campaign', resourceId: id });
  return getCampaignOrThrow(id);
}

// ── Student-facing eligibility view ──────────────────────────────────────────

interface StudentCtx {
  id: string;
  departmentId: string;
  programId: string;
  semester: number;
  section: string | null;
}

async function resolveStudentCtx(userId: string): Promise<StudentCtx> {
  const { rows } = await query<StudentCtx & { id: string }>(
    `SELECT id, department_id AS "departmentId", program_id AS "programId", semester, section
     FROM students WHERE user_id = $1 AND status = 'active' AND deleted_at IS NULL`,
    [userId]
  );
  if (!rows[0]) throw AppError.notFound('Student profile not found');
  return rows[0];
}

export async function getEligibleCampaignsForStudent(userId: string): Promise<StudentCampaignView[]> {
  const student = await resolveStudentCtx(userId);

  const { rows: campaignRows } = await query<CampaignRow>(
    `SELECT ${CAMPAIGN_COLS} FROM feedback_windows fw ${CAMPAIGN_JOIN}
     WHERE fw.status = 'published' ORDER BY fw.end_date ASC`
  );
  const campaigns = campaignRows.map(toCampaign);

  const views: StudentCampaignView[] = [];
  for (const campaign of campaigns) {
    const entries = await resolveCampaignEligibility(campaign, { studentId: student.id });
    if (entries.length === 0) continue;

    const items: StudentCampaignItem[] = [];
    for (const entry of entries) {
      let subjectCode: string | null = null;
      let facultyName: string | null = null;
      if (entry.subjectId) {
        const { rows } = await query<{ code: string }>('SELECT code FROM subjects WHERE id = $1', [entry.subjectId]);
        subjectCode = rows[0]?.code ?? null;
      }
      if (entry.facultyId) {
        const { rows } = await query<{ full_name: string }>('SELECT full_name FROM faculty WHERE id = $1', [entry.facultyId]);
        facultyName = rows[0]?.full_name ?? null;
      }
      const { rows: submittedRows } = await query<{ id: string }>(
        `SELECT id FROM feedback_submission_tracking
         WHERE window_id = $1 AND student_id = $2 AND feedback_type = $3
           AND (subject_id = $4 OR ($4::uuid IS NULL AND subject_id IS NULL))`,
        [campaign.id, student.id, campaign.templateType, entry.subjectId]
      );
      items.push({
        subjectId: entry.subjectId,
        subjectCode,
        facultyId: entry.facultyId,
        facultyName,
        submitted: submittedRows.length > 0,
      });
    }

    views.push({
      campaignId: campaign.id,
      title: campaign.title,
      templateId: campaign.templateId!,
      templateType: campaign.templateType!,
      status: campaign.effectiveStatus,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      items,
      completed: items.every((i) => i.submitted),
    });
  }

  return views;
}

// ── Submission ────────────────────────────────────────────────────────────────

export async function submitFeedback(userId: string, input: SubmitFeedbackInput): Promise<void> {
  const student = await resolveStudentCtx(userId);
  const campaign = await getCampaignOrThrow(input.campaignId);

  if (campaign.effectiveStatus !== 'open') {
    throw AppError.badRequest('Feedback campaign is not currently open for submissions', 'CAMPAIGN_NOT_OPEN');
  }
  const templateId = campaign.templateId;
  const templateType = campaign.templateType;
  if (!templateId || !templateType) {
    throw AppError.badRequest('Campaign has no associated feedback form');
  }

  const entries = await resolveCampaignEligibility(campaign, { studentId: student.id });
  if (entries.length === 0) {
    throw AppError.forbidden('You are not eligible to submit feedback for this campaign');
  }

  const isSubjectScoped = SUBJECT_SCOPED_TYPES.includes(templateType);
  if (isSubjectScoped) {
    const matches = entries.some((e) => e.subjectId === (input.subjectId ?? null) && e.facultyId === (input.facultyId ?? null));
    if (!matches) {
      throw AppError.forbidden('You are not eligible to submit feedback for this subject/faculty combination');
    }
  }

  const subjectId = isSubjectScoped ? input.subjectId ?? null : null;
  const facultyId = isSubjectScoped ? input.facultyId ?? null : null;

  await withTransaction(async (client) => {
    try {
      await client.query(
        `INSERT INTO feedback_submission_tracking (window_id, student_id, subject_id, feedback_type)
         VALUES ($1, $2, $3, $4)`,
        [campaign.id, student.id, subjectId, templateType]
      );
    } catch (err: any) {
      if (err.code === '23505') throw AppError.conflict('Feedback has already been submitted for this context.');
      throw err;
    }

    const responseResult = await client.query<{ id: string }>(
      `INSERT INTO feedback_responses (window_id, template_id, subject_id, faculty_id)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [campaign.id, templateId, subjectId, facultyId]
    );
    const responseId = responseResult.rows[0].id;

    for (const answer of input.answers) {
      await client.query(
        `INSERT INTO feedback_answers (response_id, question_id, rating_value, text_value)
         VALUES ($1, $2, $3, $4)`,
        [responseId, answer.questionId, answer.ratingValue ?? null, answer.textValue ?? null]
      );
    }
  });

  await auditLog({ actorId: userId, action: 'SUBMIT', resource: 'feedback_campaign', resourceId: campaign.id });
}

export async function getStudentSubmissions(userId: string, campaignId: string): Promise<Array<{ subjectId: string | null; feedbackType: string }>> {
  const student = await resolveStudentCtx(userId).catch(() => null);
  if (!student) return [];
  const { rows } = await query<{ subject_id: string | null; feedback_type: string }>(
    `SELECT subject_id, feedback_type FROM feedback_submission_tracking WHERE student_id = $1 AND window_id = $2`,
    [student.id, campaignId]
  );
  return rows.map((r) => ({ subjectId: r.subject_id, feedbackType: r.feedback_type }));
}

// ── Analytics — eligible students are always the denominator ────────────────

export async function getCampaignAnalytics(
  campaignId: string,
  filters: { departmentId?: string; facultyId?: string; subjectId?: string }
): Promise<CampaignAnalytics> {
  const campaign = await getCampaignOrThrow(campaignId);
  let entries = await resolveCampaignEligibility(campaign);

  if (filters.facultyId) entries = entries.filter((e) => e.facultyId === filters.facultyId);
  if (filters.subjectId) entries = entries.filter((e) => e.subjectId === filters.subjectId);
  if (filters.departmentId) {
    const studentIds = Array.from(new Set(entries.map((e) => e.studentId)));
    if (studentIds.length > 0) {
      const { rows } = await query<{ id: string }>(
        `SELECT id FROM students WHERE id = ANY($1::uuid[]) AND department_id = $2`,
        [studentIds, filters.departmentId]
      );
      const inDept = new Set(rows.map((r) => r.id));
      entries = entries.filter((e) => inDept.has(e.studentId));
    }
  }

  const requiredByStudent = new Map<string, number>();
  for (const e of entries) requiredByStudent.set(e.studentId, (requiredByStudent.get(e.studentId) ?? 0) + 1);
  const eligibleStudentIds = Array.from(requiredByStudent.keys());

  let submittedCount = 0;
  if (eligibleStudentIds.length > 0) {
    const { rows } = await query<{ student_id: string; submitted: string }>(
      `SELECT student_id, COUNT(*)::text AS submitted FROM feedback_submission_tracking
       WHERE window_id = $1 AND student_id = ANY($2::uuid[]) GROUP BY student_id`,
      [campaignId, eligibleStudentIds]
    );
    const submittedByStudent = new Map(rows.map((r) => [r.student_id, Number(r.submitted)]));
    for (const studentId of eligibleStudentIds) {
      if ((submittedByStudent.get(studentId) ?? 0) >= (requiredByStudent.get(studentId) ?? 1)) submittedCount++;
    }
  }

  const eligibleStudents = eligibleStudentIds.length;
  const pendingCount = eligibleStudents - submittedCount;
  const completionPercent = eligibleStudents > 0 ? Math.round((submittedCount / eligibleStudents) * 10000) / 100 : 0;

  const summary: CampaignAnalyticsSummary = { eligibleStudents, submittedCount, pendingCount, completionPercent };

  const qParams: unknown[] = [campaignId];
  const qConditions: string[] = ['r.window_id = $1'];
  const push = (val: unknown) => {
    qParams.push(val);
    return `$${qParams.length}`;
  };
  if (filters.facultyId) qConditions.push(`r.faculty_id = ${push(filters.facultyId)}`);
  if (filters.subjectId) qConditions.push(`r.subject_id = ${push(filters.subjectId)}`);
  if (filters.departmentId) qConditions.push(`r.faculty_id IN (SELECT id FROM faculty WHERE department_id = ${push(filters.departmentId)})`);

  const { rows: qRows } = await query<{
    question_id: string; question_text: string; question_type: string;
    total_responses: string; average_rating: string | null; mcq_distribution: Record<string, string> | null;
  }>(
    `SELECT q.id AS question_id, q.text AS question_text, q.type AS question_type,
            COUNT(a.id)::text AS total_responses,
            ROUND(AVG(a.rating_value), 2)::text AS average_rating,
            CASE WHEN q.type = 'mcq' THEN
              (SELECT jsonb_object_agg(a2.text_value, cnt) FROM (
                 SELECT a2.text_value, COUNT(*)::int AS cnt
                 FROM feedback_answers a2 JOIN feedback_responses r2 ON a2.response_id = r2.id
                 WHERE a2.question_id = q.id AND r2.window_id = $1 AND a2.text_value IS NOT NULL
                 GROUP BY a2.text_value
               ) a2)
            END AS mcq_distribution
     FROM feedback_questions q
     LEFT JOIN feedback_answers a ON a.question_id = q.id
     LEFT JOIN feedback_responses r ON a.response_id = r.id AND ${qConditions.join(' AND ')}
     WHERE q.template_id = $${qParams.length + 1}
     GROUP BY q.id, q.text, q.type`,
    [...qParams, campaign.templateId]
  );

  const questions: CampaignQuestionAnalytics[] = [];
  for (const row of qRows) {
    const q: CampaignQuestionAnalytics = {
      questionId: row.question_id,
      questionText: row.question_text,
      questionType: row.question_type as CampaignQuestionAnalytics['questionType'],
      totalResponses: Number(row.total_responses),
      averageRating: row.average_rating ? Number(row.average_rating) : null,
    };
    if (row.mcq_distribution) {
      q.mcqDistribution = Object.fromEntries(Object.entries(row.mcq_distribution).map(([k, v]) => [k, Number(v)]));
    }
    if (row.question_type === 'text') {
      const textParams: unknown[] = [row.question_id, campaignId];
      const { rows: textRows } = await query<{ text_value: string }>(
        `SELECT a.text_value FROM feedback_answers a JOIN feedback_responses r ON a.response_id = r.id
         WHERE a.question_id = $1 AND r.window_id = $2 AND a.text_value IS NOT NULL AND a.text_value != ''`,
        textParams
      );
      q.textComments = textRows.map((r) => r.text_value);
    }
    questions.push(q);
  }

  return { summary, questions };
}

// ── Institution/department-wide feedback analytics — eligible-vs-actual
// pattern, mirroring analytics.service.ts::getMentorshipAnalytics. Shared by
// dashboard.service.ts (admin/HOD widgets) and analytics.service.ts (detailed
// reports) so the aggregation logic lives in one place. ─────────────────────
export interface InstitutionFeedbackAnalytics {
  totalCampaigns: number;
  activeCampaigns: number;
  eligibleStudents: number;
  submitted: number;
  pending: number;
  completionPercent: number;
  statusBreakdown: Record<string, number>;
}

export async function getInstitutionFeedbackAnalytics(departmentId: string | null): Promise<InstitutionFeedbackAnalytics> {
  const campaigns = await getCampaigns(departmentId ? { departmentId } : {});

  const statusBreakdown: Record<string, number> = { draft: 0, published: 0, open: 0, closed: 0, archived: 0 };
  for (const c of campaigns) statusBreakdown[c.effectiveStatus] = (statusBreakdown[c.effectiveStatus] ?? 0) + 1;

  let eligibleTotal = 0;
  let submittedTotal = 0;
  for (const c of campaigns) {
    if (c.status === 'draft') continue;
    const analytics = await getCampaignAnalytics(c.id, departmentId ? { departmentId } : {});
    eligibleTotal += analytics.summary.eligibleStudents;
    submittedTotal += analytics.summary.submittedCount;
  }

  return {
    totalCampaigns: campaigns.length,
    activeCampaigns: statusBreakdown.open ?? 0,
    eligibleStudents: eligibleTotal,
    submitted: submittedTotal,
    pending: eligibleTotal - submittedTotal,
    completionPercent: eligibleTotal > 0 ? Math.round((submittedTotal / eligibleTotal) * 10000) / 100 : 0,
    statusBreakdown,
  };
}

export interface FacultyFeedbackCampaignSummary {
  campaignId: string;
  title: string;
  status: CampaignStatus;
  eligibleStudents: number;
  submittedCount: number;
  completionPercent: number;
}

export async function getFacultyFeedbackAnalytics(facultyId: string): Promise<{ activeCampaigns: number; campaigns: FacultyFeedbackCampaignSummary[] }> {
  const campaigns = await getCampaigns({ status: 'published' });
  const myCampaigns: FacultyFeedbackCampaignSummary[] = [];

  for (const c of campaigns) {
    const entries = await resolveCampaignEligibility(c);
    if (!entries.some((e) => e.facultyId === facultyId)) continue;
    const analytics = await getCampaignAnalytics(c.id, { facultyId });
    myCampaigns.push({
      campaignId: c.id,
      title: c.title,
      status: c.effectiveStatus,
      eligibleStudents: analytics.summary.eligibleStudents,
      submittedCount: analytics.summary.submittedCount,
      completionPercent: analytics.summary.completionPercent,
    });
  }

  return { activeCampaigns: myCampaigns.length, campaigns: myCampaigns };
}

// ── Templates ─────────────────────────────────────────────────────────────────

function toTemplate(r: any): FeedbackTemplate {
  return { id: r.id, title: r.title, type: r.type, isActive: r.is_active, createdAt: r.created_at, updatedAt: r.updated_at };
}

function toQuestion(r: any): FeedbackQuestion {
  return {
    id: r.id,
    templateId: r.template_id,
    text: r.text,
    type: r.type,
    options: r.options ?? null,
    orderIndex: r.order_index,
    isRequired: r.is_required,
  };
}

export async function getTemplates(type?: string): Promise<FeedbackTemplate[]> {
  const params: unknown[] = [];
  let where = 'WHERE is_active = true';
  if (type) {
    params.push(type);
    where += ` AND type = $${params.length}`;
  }
  const { rows: templates } = await query<any>(`SELECT * FROM feedback_templates ${where} ORDER BY created_at DESC`, params);

  const result: FeedbackTemplate[] = [];
  for (const t of templates) {
    const { rows: questions } = await query<any>('SELECT * FROM feedback_questions WHERE template_id = $1 ORDER BY order_index ASC', [t.id]);
    result.push({ ...toTemplate(t), questions: questions.map(toQuestion) });
  }
  return result;
}

export async function createTemplate(data: CreateTemplateInput, actorId: string): Promise<FeedbackTemplate> {
  const { rows } = await query<any>(
    `INSERT INTO feedback_templates (title, type, is_active) VALUES ($1, $2, true) RETURNING *`,
    [data.title, data.type]
  );
  await auditLog({ actorId, action: 'CREATE', resource: 'feedback_template', resourceId: rows[0].id, changes: { to: data } });
  return toTemplate(rows[0]);
}

export async function updateTemplate(id: string, data: UpdateTemplateInput, actorId: string): Promise<FeedbackTemplate> {
  const sets: string[] = [];
  const params: unknown[] = [id];
  const push = (col: string, val: unknown) => {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  };
  if (data.title !== undefined) push('title', data.title);
  if (data.type !== undefined) push('type', data.type);
  if (data.isActive !== undefined) push('is_active', data.isActive);

  const { rows } = await query<any>(
    `UPDATE feedback_templates SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`,
    params
  );
  if (!rows[0]) throw AppError.notFound('Template not found');
  await auditLog({ actorId, action: 'UPDATE', resource: 'feedback_template', resourceId: id, changes: { to: data } });
  return toTemplate(rows[0]);
}

// ── Questions ─────────────────────────────────────────────────────────────────

export async function createQuestion(data: CreateQuestionInput, actorId: string): Promise<FeedbackQuestion> {
  const { rows } = await query<any>(
    `INSERT INTO feedback_questions (template_id, text, type, options, order_index, is_required)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [data.templateId, data.text, data.type, data.options ? JSON.stringify(data.options) : null, data.orderIndex, data.isRequired]
  );
  await auditLog({ actorId, action: 'CREATE', resource: 'feedback_question', resourceId: rows[0].id, changes: { to: data } });
  return toQuestion(rows[0]);
}

export async function updateQuestion(id: string, data: UpdateQuestionInput, actorId: string): Promise<FeedbackQuestion> {
  const sets: string[] = [];
  const params: unknown[] = [id];
  const push = (col: string, val: unknown) => {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  };
  if (data.text !== undefined) push('text', data.text);
  if (data.type !== undefined) push('type', data.type);
  if (data.options !== undefined) push('options', data.options ? JSON.stringify(data.options) : null);
  if (data.orderIndex !== undefined) push('order_index', data.orderIndex);
  if (data.isRequired !== undefined) push('is_required', data.isRequired);

  const { rows } = await query<any>(`UPDATE feedback_questions SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, params);
  if (!rows[0]) throw AppError.notFound('Question not found');
  await auditLog({ actorId, action: 'UPDATE', resource: 'feedback_question', resourceId: id, changes: { to: data } });
  return toQuestion(rows[0]);
}

export async function deleteQuestion(id: string, actorId: string): Promise<void> {
  const { rowCount } = await query('DELETE FROM feedback_questions WHERE id = $1', [id]);
  if (!rowCount) throw AppError.notFound('Question not found');
  await auditLog({ actorId, action: 'DELETE', resource: 'feedback_question', resourceId: id });
}
