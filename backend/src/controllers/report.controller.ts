import type { Request, Response } from 'express';
import * as reportService from '../services/report.service';
import * as exportService from '../services/export.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import type { Role } from '../types/roles';
import type { ReportFilters, ReportResult, ExportQuery } from '../types/report';

// PDF/Excel/CSV exports render the *whole* report, not just the caller's current page.
const EXPORT_LIMIT = 5000;

type ReportFn = (userId: string, role: Role, filters: ReportFilters) => Promise<ReportResult>;

function reportHandler(fn: ReportFn) {
  return asyncHandler(async (req: Request, res: Response) => {
    const filters = req.query as unknown as ReportFilters;
    const result = await fn(req.user!.id, req.user!.role, filters);
    sendSuccess(res, result);
  });
}

export const getAttendanceReport = reportHandler(reportService.getAttendanceReport);
export const getResultsReport = reportHandler(reportService.getResultsReport);
export const getFeesReport = reportHandler(reportService.getFeesReport);
export const getLmsReport = reportHandler(reportService.getLmsReport);
export const getMentorshipReport = reportHandler(reportService.getMentorshipReport);
export const getDepartmentReport = reportHandler(reportService.getDepartmentReport);
export const getStudentReport = reportHandler(reportService.getStudentReport);
export const getOpportunitiesReport = reportHandler(reportService.getOpportunitiesReport);
export const getTeachingReport = reportHandler(reportService.getTeachingReport);
export const getRoomSeatingChartReport = reportHandler(reportService.getRoomSeatingChartReport);
export const getStudentSeatingListReport = reportHandler(reportService.getStudentSeatingListReport);
export const getInvigilatorSheetReport = reportHandler(reportService.getInvigilatorSheetReport);
export const getSeatingAttendanceSheetReport = reportHandler(reportService.getSeatingAttendanceSheetReport);
export const getSeatingSummaryReport = reportHandler(reportService.getSeatingSummaryReport);

async function resolveExportReport(req: Request): Promise<{ reportType: string; report: ReportResult }> {
  const { reportType, ...rest } = req.query as unknown as ExportQuery;
  const filters: ReportFilters = { ...rest, page: 1, limit: EXPORT_LIMIT };
  const report = await reportService.getReportByType(reportType, req.user!.id, req.user!.role, filters);
  return { reportType, report };
}

export const exportPdf = asyncHandler(async (req: Request, res: Response) => {
  const { reportType, report } = await resolveExportReport(req);
  exportService.sendPdf(res, `${reportType}-report`, report);
});

export const exportExcel = asyncHandler(async (req: Request, res: Response) => {
  const { reportType, report } = await resolveExportReport(req);
  await exportService.sendExcel(res, `${reportType}-report`, report);
});

export const exportCsv = asyncHandler(async (req: Request, res: Response) => {
  const { reportType, report } = await resolveExportReport(req);
  exportService.sendCsv(res, `${reportType}-report`, report);
});
