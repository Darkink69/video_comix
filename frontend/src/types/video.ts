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
  options?: ProcessOptions;
  statistics?: {
    total_faces_detected: number;
  };
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

export interface FaceBBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
}

export interface FaceBBoxNormalized {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface FaceLandmark {
  x: number;
  y: number;
  x_normalized: number;
  y_normalized: number;
}

export interface FaceInfo {
  bbox: FaceBBox;
  bbox_normalized: FaceBBoxNormalized;
  confidence: number;
  landmarks?: {
    left_eye?: FaceLandmark;
    right_eye?: FaceLandmark;
    nose?: FaceLandmark;
    left_lip?: FaceLandmark;
    right_lip?: FaceLandmark;
  };
}

export interface FaceDetectionResult {
  faces_count: number;
  faces: FaceInfo[];
  image_size?: { width: number; height: number };
  error?: string | null;
}

export interface Frame {
  id: number;
  filename: string;
  time_seconds: number;
  time_formatted: string;
  faces_count?: number;
  face_detection?: FaceDetectionResult;
}

export interface ProcessOptions {
  detect_faces: boolean;
  detect_people: boolean;
  describe_frame: boolean;
  nsfw: boolean;
  recognize_speech?: boolean;
  use_subtitles?: boolean;
}

export interface ProcessResponse {
  status: string;
  video_name: string;
  source_path: string;
  interval: number;
  options: ProcessOptions;
  message: string;
}

export type SortType = "time" | "name" | "duration";
