import { query } from '../config/database';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';
import type { MentorshipSettings, UpdateMentorshipSettingsInput } from '../types/mentorGroup';

interface SettingsRow {
  id: string;
  recommended_students_per_mentor: number;
  maximum_students: number;
  allow_cross_department: boolean;
  updated_by: string | null;
  updated_at: Date;
}

function toSettings(r: SettingsRow): MentorshipSettings {
  return {
    id: r.id,
    recommendedStudentsPerMentor: r.recommended_students_per_mentor,
    maximumStudents: r.maximum_students,
    allowCrossDepartment: r.allow_cross_department,
    updatedBy: r.updated_by,
    updatedAt: r.updated_at,
  };
}

/** Global singleton row — created by migration 032; always returns the first (only) row. */
export async function getMentorshipSettings(): Promise<MentorshipSettings> {
  const { rows } = await query<SettingsRow>('SELECT * FROM mentorship_settings ORDER BY updated_at ASC LIMIT 1');
  if (!rows[0]) throw AppError.notFound('Mentorship settings not found');
  return toSettings(rows[0]);
}

export async function updateMentorshipSettings(userId: string, data: UpdateMentorshipSettingsInput): Promise<MentorshipSettings> {
  const existing = await getMentorshipSettings();

  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (col: string, val: unknown) => {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  };

  const recommended = data.recommendedStudentsPerMentor ?? existing.recommendedStudentsPerMentor;
  const maximum = data.maximumStudents ?? existing.maximumStudents;
  if (maximum < recommended) {
    throw AppError.badRequest('Maximum students must be greater than or equal to recommended students per mentor', 'INVALID_SETTINGS');
  }

  if (data.recommendedStudentsPerMentor !== undefined) push('recommended_students_per_mentor', data.recommendedStudentsPerMentor);
  if (data.maximumStudents !== undefined) push('maximum_students', data.maximumStudents);
  if (data.allowCrossDepartment !== undefined) push('allow_cross_department', data.allowCrossDepartment);
  push('updated_by', userId);
  sets.push('updated_at = NOW()');

  params.push(existing.id);
  await query(`UPDATE mentorship_settings SET ${sets.join(', ')} WHERE id = $${params.length}`, params);

  await auditLog({
    actorId: userId,
    action: 'UPDATE',
    resource: 'mentorship_settings',
    resourceId: existing.id,
    changes: { from: existing, to: data },
  });

  return getMentorshipSettings();
}
