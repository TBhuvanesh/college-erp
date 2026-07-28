// ── ERP Master Registry ──────────────────────────────────────────────────────
// Barrel export for the six Master Data registries. Other modules should
// import master data (Student/Faculty/Department/Program/Curriculum/Teaching
// Assignment/Classroom) from here rather than reaching into individual
// services or querying master tables directly.

export * as StudentRegistry from './studentRegistry.service';
export * as FacultyRegistry from './facultyRegistry.service';
export * as AcademicRegistry from './academicRegistry.service';
export * as CurriculumRegistry from './curriculumRegistry.service';
export * as TeachingAssignmentRegistry from './teachingAssignmentRegistry.service';
export * as ResourceRegistry from './resourceRegistry.service';
