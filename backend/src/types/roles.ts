export const ROLES = ['admin', 'faculty', 'student', 'accountant'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = {
  // User management
  'users:create': ['admin'],
  'users:read': ['admin', 'faculty', 'student', 'accountant'],
  'users:update': ['admin'],
  'users:delete': ['admin'],
  // Accountant management
  'accountants:create': ['admin'],
  'accountants:read': ['admin'],
  'accountants:update': ['admin'],
  'accountants:delete': ['admin'],
  // Academic structure
  'departments:create': ['admin'],
  'departments:read': ['admin', 'faculty', 'student'],
  'departments:update': ['admin'],
  'departments:delete': ['admin'],
  'courses:create': ['admin'],
  'courses:read': ['admin', 'faculty', 'student'],
  'courses:update': ['admin'],
  'courses:delete': ['admin'],
  'subjects:create': ['admin'],
  'subjects:read': ['admin', 'faculty', 'student'],
  'subjects:update': ['admin'],
  'subjects:delete': ['admin'],
  // Attendance — faculty creates/updates within their assigned subjects
  'attendance:create': ['faculty'],
  'attendance:read': ['admin', 'faculty', 'student'],
  'attendance:update': ['faculty'],
  // Grades — faculty creates/updates; student reads only published grades
  'grades:create': ['faculty'],
  'grades:read': ['admin', 'faculty', 'student'],
  'grades:update': ['faculty'],
  // Fees — admin/accountant manages invoices; student reads own
  'fees:create': ['admin', 'accountant'],
  'fees:read': ['admin', 'student', 'accountant'],
  'fees:update': ['admin', 'accountant'],
  // Reporting
  'reports:read': ['admin', 'faculty', 'accountant'],
  // Mentorship
  'mentorship:manage': ['admin'],
  'mentorship:read': ['admin', 'faculty', 'student'],
  'mentorship:write': ['faculty'],
} as const;

export type Permission = keyof typeof PERMISSIONS;
