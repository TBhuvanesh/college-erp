export type OpportunityType =
  | 'Internship'
  | 'Job Opportunity'
  | 'Workshop'
  | 'Seminar'
  | 'Hackathon'
  | 'Competition'
  | 'Placement Drive'
  | 'College Event';

export type OpportunityStatus = 'Active' | 'Closed' | 'Archived';

export type YearGroup = 'I Year' | 'II Year' | 'III Year' | 'IV Year';

export interface Opportunity {
  id: string;
  title: string;
  description: string | null;
  type: OpportunityType;
  departmentId: string | null;
  departmentName: string | null;
  eligibleYears: YearGroup[] | null;
  registrationLink: string | null;
  startDate: string | null;
  deadline: string | null;
  location: string | null;
  organizer: string | null;
  status: OpportunityStatus;
  createdBy: string;
  createdByName: string;
  isBookmarked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedOpportunities {
  opportunities: Opportunity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
