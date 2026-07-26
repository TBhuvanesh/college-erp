import { query } from '../config/database';
import { auditLog } from '../utils/audit';
import type { TeachingLoadSettings, UpdateTeachingLoadSettingsInput } from '../types/teachingLoadSettings';

// Singleton row (id = 1, enforced by CHECK constraint — see migration 044).
// This is the one place Theory/Lab/Tutorial weights, min/max subjects per
// faculty, max/min weekly load, and the marks-entry window policy live —
// every workload calculation and validation in teachingAssignment.service.ts
// reads from here instead of hardcoding a threshold.

interface SettingsRow {
  theory_weight: string;
  lab_weight: string;
  tutorial_weight: string;
  min_weekly_load: string | null;
  max_weekly_load: string;
  min_subjects_per_faculty: number;
  max_subjects_per_faculty: number;
  auto_marks_window_days: number | null;
  auto_close_marks_window_days: number | null;
  require_result_verification: boolean;
  updated_by: string | null;
  updated_by_name: string | null;
  updated_at: Date;
}

function toSettings(r: SettingsRow): TeachingLoadSettings {
  return {
    theoryWeight: parseFloat(r.theory_weight),
    labWeight: parseFloat(r.lab_weight),
    tutorialWeight: parseFloat(r.tutorial_weight),
    minWeeklyLoad: r.min_weekly_load !== null ? parseFloat(r.min_weekly_load) : null,
    maxWeeklyLoad: parseFloat(r.max_weekly_load),
    minSubjectsPerFaculty: r.min_subjects_per_faculty,
    maxSubjectsPerFaculty: r.max_subjects_per_faculty,
    autoMarksWindowDays: r.auto_marks_window_days,
    autoCloseMarksWindowDays: r.auto_close_marks_window_days,
    requireResultVerification: r.require_result_verification,
    updatedBy: r.updated_by,
    updatedByName: r.updated_by_name ?? undefined,
    updatedAt: r.updated_at,
  };
}

export async function getTeachingLoadSettings(): Promise<TeachingLoadSettings> {
  const { rows } = await query<SettingsRow>(
    `SELECT tls.theory_weight, tls.lab_weight, tls.tutorial_weight, tls.min_weekly_load, tls.max_weekly_load,
            tls.min_subjects_per_faculty, tls.max_subjects_per_faculty,
            tls.auto_marks_window_days, tls.auto_close_marks_window_days, tls.require_result_verification,
            tls.updated_by, u.full_name AS updated_by_name, tls.updated_at
     FROM teaching_load_settings tls
     LEFT JOIN users u ON u.id = tls.updated_by
     WHERE tls.id = 1`
  );
  return toSettings(rows[0]);
}

export async function updateTeachingLoadSettings(
  data: UpdateTeachingLoadSettingsInput,
  actorId: string
): Promise<TeachingLoadSettings> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (col: string, val: unknown) => {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  };

  if (data.theoryWeight !== undefined) push('theory_weight', data.theoryWeight);
  if (data.labWeight !== undefined) push('lab_weight', data.labWeight);
  if (data.tutorialWeight !== undefined) push('tutorial_weight', data.tutorialWeight);
  if (data.minWeeklyLoad !== undefined) push('min_weekly_load', data.minWeeklyLoad);
  if (data.maxWeeklyLoad !== undefined) push('max_weekly_load', data.maxWeeklyLoad);
  if (data.minSubjectsPerFaculty !== undefined) push('min_subjects_per_faculty', data.minSubjectsPerFaculty);
  if (data.maxSubjectsPerFaculty !== undefined) push('max_subjects_per_faculty', data.maxSubjectsPerFaculty);
  if (data.autoMarksWindowDays !== undefined) push('auto_marks_window_days', data.autoMarksWindowDays);
  if (data.autoCloseMarksWindowDays !== undefined) push('auto_close_marks_window_days', data.autoCloseMarksWindowDays);
  if (data.requireResultVerification !== undefined) push('require_result_verification', data.requireResultVerification);
  push('updated_by', actorId);

  if (sets.length > 0) {
    await query(`UPDATE teaching_load_settings SET ${sets.join(', ')}, updated_at = NOW() WHERE id = 1`, params);
  }

  await auditLog({
    actorId,
    action: 'UPDATE_TEACHING_LOAD_SETTINGS',
    resource: 'teaching_load_settings',
    resourceId: '1',
    changes: data as Record<string, unknown>,
  });

  return getTeachingLoadSettings();
}
