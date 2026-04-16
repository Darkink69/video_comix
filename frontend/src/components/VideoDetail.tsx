import React, { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { videoService } from "../services/api";
import { VideoMetadata } from "../types/video";
import { FrameGallery } from "./FrameGallery";

export const VideoDetail: React.FC = () => {
  const { videoName } = useParams<{ videoName: string }>();
  const [video, setVideo] = useState<VideoMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<number | null>(null);
  const videoRef = useRef<VideoMetadata | null>(null);

  const loadVideo = async (showLoading: boolean = true) => {
    if (!videoName) return false;

    try {
      if (showLoading) {
        setLoading(true);
      }

      const data = await videoService.getVideoDetails(videoName);

      // Обновляем только если данные изменились
      if (JSON.stringify(data) !== JSON.stringify(videoRef.current)) {
        videoRef.current = data;
        setVideo(data);
      }

      setError(null);
      return data.processing || false;
    } catch (err) {
      setError("Не удалось загрузить информацию о видео");
      console.error(err);
      return false;
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!videoName) return;

    const init = async () => {
      const isProcessing = await loadVideo(true);

      // Если видео в обработке, запускаем поллинг
      if (isProcessing) {
        pollIntervalRef.current = window.setInterval(async () => {
          const stillProcessing = await loadVideo(false);

          if (!stillProcessing && pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
            // Финальная загрузка для получения полных данных
            await loadVideo(false);
          }
        }, 2000);
      }
    };

    init();

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      videoRef.current = null;
    };
  }, [videoName]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch((err) => {
      console.error("Не удалось скопировать:", err);
    });
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <p className="mt-2 text-gray-600">Загрузка...</p>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="bg-red-50 text-red-500 p-4 rounded-md">
        {error || "Видео не найдено"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/"
            className="text-blue-500 hover:text-blue-600 mb-2 inline-block"
          >
            ← Назад к списку
          </Link>
          <h1 className="text-3xl font-bold">{video.video_name}</h1>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Информация о видео</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Исходный файл</p>
            <p className="font-medium">{video.source_file}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Полный путь</p>
            <div className="flex items-center gap-1">
              <p
                className="font-medium text-xs font-mono truncate"
                title={video.source_path}
              >
                {video.source_path}
              </p>
              <button
                onClick={() => copyToClipboard(video.source_path)}
                className="p-1 hover:bg-gray-100 rounded transition-colors shrink-0"
                title="Копировать путь"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </button>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-500">Длительность</p>
            <p className="font-medium">{video.duration_formatted}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Интервал кадров</p>
            <p className="font-medium">{video.frames_interval} секунд</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">
              {video.processing ? "Обработано кадров" : "Всего кадров"}
            </p>
            <p className="font-medium">
              {video.frames_processed || 0}
              {video.processing &&
                video.total_frames_estimated &&
                video.total_frames_estimated > 0 &&
                ` / ${video.total_frames_estimated}`}
              {!video.processing &&
                video.total_frames &&
                ` (${video.total_frames})`}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Статус</p>
            <p className="font-medium">
              {video.processing ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
                  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                  Обработка...
                </span>
              ) : video.stopped_by_user ? (
                <span className="inline-block px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-700">
                  Остановлено
                </span>
              ) : video.processed ? (
                <span className="inline-block px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                  Обработано
                </span>
              ) : (
                <span className="inline-block px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                  Не обработано
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {video.frames && video.frames.length > 0 && (
        <FrameGallery
          videoName={video.video_name}
          frames={video.frames}
          videoPath={video.source_path}
        />
      )}
    </div>
  );
};
