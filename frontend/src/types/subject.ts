export interface SubjectDetail {
  id: string;
  code: string;
  name: string;
  department: {
    id: string;
    name: string;
    code: string;
  };
  program: {
    id: string;
    name: string;
    code: string;
  } | null;
  programName: string | null;
  regulation: string;
  year: 'I' | 'II' | 'III' | 'IV' | null;
  semester: number;
  semesterRaw: 'I' | 'II' | null;
  lectureHours: number;
  tutorialHours: number;
  practicalHours: number;
  credits: number;
  type: 'core' | 'elective' | 'lab' | 'mandatory' | 'project' | 'workshop';
  status: 'active' | 'inactive' | 'archived';
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubjectSummary {
  id: string;
  code: string;
  name: string;
  departmentId: string;
  departmentName: string;
  programId: string | null;
  programName: string | null;
  regulation: string;
  year: string | null;
  semester: number;
  semesterRaw: string | null;
  credits: number;
  type: 'core' | 'elective' | 'lab' | 'mandatory' | 'project' | 'workshop';
  status: 'active' | 'inactive' | 'archived';
  lectureHours: number;
  tutorialHours: number;
  practicalHours: number;
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
