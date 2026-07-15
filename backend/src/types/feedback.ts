export type FeedbackType = 'faculty' | 'course' | 'lms' | 'erp';
export type QuestionType = 'rating' | 'mcq' | 'text' | 'boolean';

export interface FeedbackWindow {
  id: string;
  title: string;
  academic_year: string;
  semester?: number;
  department_id?: string;
  start_date: Date;
  end_date: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
}

export interface FeedbackTemplate {
  id: string;
  title: string;
  type: FeedbackType;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface FeedbackQuestion {
  id: string;
  template_id: string;
  text: string;
  type: QuestionType;
  options?: any;
  order_index: number;
  is_required: boolean;
}

export interface SubmitFeedbackRequest {
  window_id: string;
  template_id: string;
  subject_id?: string;
  faculty_id?: string;
  feedback_type: FeedbackType;
  answers: {
    question_id: string;
    rating_value?: number;
    text_value?: string;
  }[];
}

export interface FeedbackAnalyticsResult {
  question_id: string;
  question_text: string;
  average_rating?: number;
  total_responses: number;
  mcq_distribution?: Record<string, number>;
  text_comments?: string[];
}
