export interface Frame {
  id: number;
  filename: string;
  time_seconds: number;
  time_formatted: string;
}

export interface VideoMetadata {
  video_name: string;
  source_path: string;
  source_file: string;
  duration_seconds: number;
  duration_formatted: string;
  processed: boolean;
  processing?: boolean;
  is_processing?: boolean;
  stopped_by_user?: boolean;
  frames_interval: number;
  total_frames?: number;
  total_frames_estimated?: number;
  frames_processed?: number;
  frames: Frame[];
}

export interface VideoSummary {
  name: string;
  source_path: string;
  source_file: string;
  duration_seconds: number;
  duration_formatted: string;
  total_frames: number;
  total_frames_estimated: number;
  frames_processed: number;
  processed: boolean;
  processing: boolean;
  stopped_by_user: boolean;
  frames_interval: number;
  created_at?: string;
  processed_at?: string;
}

export interface ProcessResponse {
  status: string;
  video_name: string;
  source_path: string;
  interval: number;
  message: string;
}

export interface UploadResponse {
  status: string;
  filename: string;
  path: string;
}

export type SortType = "time" | "name" | "duration";
