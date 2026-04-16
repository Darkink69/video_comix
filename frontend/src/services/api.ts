import axios from "axios";
import {
  VideoSummary,
  VideoMetadata,
  ProcessResponse,
  UploadResponse,
} from "../types/video";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
  timeout: 60000, // 60 секунд
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API Error:", {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
    });
    return Promise.reject(error);
  },
);

export const videoService = {
  process: async (
    path: string,
    interval: number = 10,
  ): Promise<ProcessResponse> => {
    const response = await api.post("/process", {
      path: path.trim(),
      interval,
    });
    return response.data;
  },

  stop: async (
    videoName: string,
  ): Promise<{ status: string; video_name: string }> => {
    const response = await api.post(`/stop/${videoName}`);
    return response.data;
  },

  getVideos: async (): Promise<VideoSummary[]> => {
    const response = await api.get("/videos");
    return response.data;
  },

  getVideoDetails: async (videoName: string): Promise<VideoMetadata> => {
    const response = await api.get(`/videos/${videoName}`);
    return response.data;
  },

  deleteVideo: async (videoName: string): Promise<void> => {
    await api.delete(`/videos/${videoName}`);
  },

  getFrameUrl: (videoName: string, filename: string): string => {
    return `/api/frames/${videoName}/${filename}`;
  },

  uploadFile: async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  getStatus: async (): Promise<any> => {
    const response = await api.get("/status");
    return response.data;
  },
};
