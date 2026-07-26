import type { ImportEntityType } from '../types/academicImport';
import type { ImportStrategy } from './ImportStrategy';
import { studentImportStrategy } from './strategies/studentImport.strategy';
import { AppError } from '../errors/AppError';

// The single place a new importer gets wired in. Adding Faculty/Subjects/
// Curriculum/Teaching Assignments/Departments/Classrooms/Timetable/
// Examination Schedule import later means writing one
// `strategies/<entity>Import.strategy.ts` file implementing ImportStrategy
// and adding one line here — ImportService, the routes, and the controller
// never change.
const STRATEGIES: Partial<Record<ImportEntityType, ImportStrategy<unknown>>> = {
  student: studentImportStrategy as ImportStrategy<unknown>,
};

export function getImportStrategy(entityType: ImportEntityType): ImportStrategy<unknown> {
  const strategy = STRATEGIES[entityType];
  if (!strategy) {
    throw AppError.badRequest(
      `Import is not yet supported for entity type '${entityType}'`,
      'IMPORT_STRATEGY_NOT_IMPLEMENTED'
    );
  }
  return strategy;
}

export function listSupportedImportEntityTypes(): ImportEntityType[] {
  return Object.keys(STRATEGIES) as ImportEntityType[];
}
