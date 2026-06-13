export interface Link {
  id: string;
  slug: string;
  originalUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClickEvent {
  id: string;
  linkId: string;
  clickedAt: Date;
  referrer: string | null;
  userAgent: string | null;
}

export interface ApiError {
  statusCode: number;
  message: string;
  details?: unknown;
}
