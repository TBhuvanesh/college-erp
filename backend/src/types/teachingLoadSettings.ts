import { z } from 'zod';

export interface TeachingLoadSettings {
  theoryWeight: number;
  labWeight: number;
  tutorialWeight: number;
  minWeeklyLoad: number | null;
  maxWeeklyLoad: number;
  minSubjectsPerFaculty: number;
  maxSubjectsPerFaculty: number;
  autoMarksWindowDays: number | null;
  autoCloseMarksWindowDays: number | null;
  requireResultVerification: boolean;
  updatedBy: string | null;
  updatedByName?: string;
  updatedAt: Date;
}

export const updateTeachingLoadSettingsSchema = z.object({
  theoryWeight: z.number().min(0).max(10).optional(),
  labWeight: z.number().min(0).max(10).optional(),
  tutorialWeight: z.number().min(0).max(10).optional(),
  minWeeklyLoad: z.number().min(0).max(80).nullable().optional(),
  maxWeeklyLoad: z.number().min(0.01).max(80).optional(),
  minSubjectsPerFaculty: z.number().int().min(0).max(20).optional(),
  maxSubjectsPerFaculty: z.number().int().min(1).max(20).optional(),
  autoMarksWindowDays: z.number().int().min(1).max(365).nullable().optional(),
  autoCloseMarksWindowDays: z.number().int().min(1).max(365).nullable().optional(),
  requireResultVerification: z.boolean().optional(),
});
export type UpdateTeachingLoadSettingsInput = z.infer<typeof updateTeachingLoadSettingsSchema>;
