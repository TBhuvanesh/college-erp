export interface SubjectCurriculumMappingDetail {
  id: string;
  subjectId: string;
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  programId: string | null;
  programName: string | null;
  programCode: string | null;
  program: string | null;
  regulation: string;
  year: 'I' | 'II' | 'III' | 'IV';
  semester: number;
  semesterRaw: 'I' | 'II' | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubjectDetail {
  id: string;
  code: string;
  name: string;
  credits: number;
  type: 'core' | 'elective' | 'lab' | 'mandatory' | 'project' | 'workshop';
  status: 'active' | 'inactive' | 'archived';
  lectureHours: number;
  tutorialHours: number;
  practicalHours: number;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  mappings: SubjectCurriculumMappingDetail[];
}

export interface SubjectSummary {
  id: string;
  code: string;
  name: string;
  credits: number;
  type: 'core' | 'elective' | 'lab' | 'mandatory' | 'project' | 'workshop';
  status: 'active' | 'inactive' | 'archived';
  lectureHours: number;
  tutorialHours: number;
  practicalHours: number;
  // If filtered by department, these fields represent that matching mapping's details:
  departmentId?: string;
  departmentName?: string;
  programId?: string | null;
  programName?: string | null;
  regulation?: string;
  year?: string | null;
  semester?: number;
  semesterRaw?: string | null;
  // General view: all mappings
  mappings?: SubjectCurriculumMappingDetail[];
}

export interface PaginatedSubjects {
  subjects: SubjectSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ImportErrorLog {
  rowNumber: number;
  subjectCode: string;
  error: string;
}

export interface ImportPreviewResult {
  validRows: any[];
  failedRows: ImportErrorLog[];
  summary: {
    imported: number;
    duplicates: number;
    failed: number;
    total: number;
  };
}

export interface ImportCommitResult {
  rowsProcessed: number;
  newSubjectsCreated: number;
  existingSubjectsReused: number;
  newCurriculumMappings: number;
  existingMappingsSkipped: number;
  failedRows: number;
}
