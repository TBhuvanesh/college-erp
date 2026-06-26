/**
 * Grading configuration.
 *
 * DEFAULT_GRADE_RULES encodes JNTUH-aligned percentage bands.
 * To apply a different grading scheme (autonomous college, project courses,
 * lab-only subjects, etc.), pass a custom rules array to computeGrade /
 * computeResultStatus — no code changes required.
 *
 * Future path: load rules from a `grading_configs` DB table keyed by
 * (program_id, regulation_year) so regulation changes are schema-driven,
 * not deployment-driven.
 */

export const GRADES = ['O', 'A+', 'A', 'B+', 'B', 'C', 'F'] as const;
export type Grade = (typeof GRADES)[number];

export interface GradeRule {
  grade: Grade;
  minPercentage: number;
  isPass: boolean;
}

export const DEFAULT_GRADE_RULES: readonly GradeRule[] = [
  { grade: 'O',  minPercentage: 90, isPass: true  },
  { grade: 'A+', minPercentage: 80, isPass: true  },
  { grade: 'A',  minPercentage: 70, isPass: true  },
  { grade: 'B+', minPercentage: 60, isPass: true  },
  { grade: 'B',  minPercentage: 55, isPass: true  },
  { grade: 'C',  minPercentage: 50, isPass: true  },
  { grade: 'F',  minPercentage: 0,  isPass: false },
];

/**
 * Returns the highest grade whose minPercentage the student meets.
 * Rules must be sorted descending by minPercentage (default list already is).
 */
export function computeGrade(
  obtained: number,
  maximum: number,
  rules: readonly GradeRule[] = DEFAULT_GRADE_RULES
): Grade {
  if (maximum <= 0 || obtained < 0) return 'F';
  const pct = (obtained / maximum) * 100;
  const match = rules.find((r) => pct >= r.minPercentage);
  return match ? match.grade : 'F';
}

/**
 * Returns 'Absent', 'Pass', or 'Fail'.
 * isAbsent is a first-class state that overrides grade-based pass/fail.
 */
export function computeResultStatus(
  grade: Grade,
  isAbsent: boolean,
  rules: readonly GradeRule[] = DEFAULT_GRADE_RULES
): 'Pass' | 'Fail' | 'Absent' {
  if (isAbsent) return 'Absent';
  const rule = rules.find((r) => r.grade === grade);
  return rule?.isPass ? 'Pass' : 'Fail';
}
