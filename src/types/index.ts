export interface Link {
  id: number;
  slug: string;
  target_url: string;
  created_at: Date;
  expires_at: Date | null;
  click_count: number;
}

export interface ClickEvent {
  id: number;
  slug: string;
  clicked_at: Date;
  user_agent: string | null;
}

export interface ValidationErrorResponse {
  error: string;
  field: string;
}

export interface ErrorResponse {
  error: string;
}
