export interface CanvasUser {
  id: number;
  name: string;
  email: string;
  login_id: string;
}

export interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
  enrollment_term_id: number;
  workflow_state: string;
}

export interface CanvasAssignment {
  id: number;
  name: string;
  due_at: string | null;
  points_possible: number | null;
  course_id: number;
  description: string | null;
  submission_types: string[];
  has_submitted_submissions: boolean;
  workflow_state: string;
}

export interface CanvasCalendarEvent {
  id: number;
  title: string;
  start_at: string;
  end_at: string | null;
  type: string;
  context_code: string;
}

export interface CanvasEnrollment {
  type: string;
  computed_current_score: number | null;
  computed_current_grade: string | null;
  course_id: number;
}

export interface CanvasAnnouncement {
  id: number;
  title: string;
  message: string;
  posted_at: string;
  context_code: string;
}

export interface CanvasModule {
  id: number;
  name: string;
  position: number;
  workflow_state: string;
  items_count: number;
}

export class CanvasError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "CanvasError";
  }
}
