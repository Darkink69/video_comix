import React, { useEffect, useState, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { videoService } from "../services/api";
import { VideoSummary, SortType } from "../types/video";

export const VideoList: React.FC = () => {
  const [videos, setVideos] = useState<VideoSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortType, setSortType] = useState<SortType>("time");
  const pollIntervalRef = useRef<number | null>(null);

  // Иконка человека (для лиц)
  const PersonIcon = () => (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );

  // Иконка предупреждения (для NSFW)
  const WarningIcon = () => (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );

  const loadVideos = async (): Promise<boolean> => {
    try {
      const data = await videoService.getVideos();
      setVideos(data);
      setError(null);

      const hasProcessing = data.some((v) => v.processing === true);
      return hasProcessing;
    } catch (err) {
      setError("Не удалось загрузить список видео");
      console.error(err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const startPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = window.setInterval(async () => {
      const hasProcessing = await loadVideos();

      if (!hasProcessing && pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }, 2000);
  };

  useEffect(() => {
    const init = async () => {
      const hasProcessing = await loadVideos();

      if (hasProcessing) {
        startPolling();
      }
    };

    init();

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const handleStopProcessing = async (videoName: string) => {
    try {
      await videoService.stop(videoName);
      await loadVideos();
    } catch (err) {
      alert("Ошибка при остановке обработки");
    }
  };

  const handleDelete = async (videoName: string) => {
    if (!confirm(`Удалить видео "${videoName}" и все его кадры?`)) {
      return;
    }

    try {
      await videoService.deleteVideo(videoName);
      await loadVideos();
    } catch (err) {
      alert("Ошибка при удалении видео");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch((err) => {
      console.error("Не удалось скопировать:", err);
    });
  };

  const sortedVideos = useMemo(() => {
    const videosCopy = [...videos];

    switch (sortType) {
      case "time":
        return videosCopy.sort((a, b) => {
          const timeA = a.processed_at ? new Date(a.processed_at).getTime() : 0;
          const timeB = b.processed_at ? new Date(b.processed_at).getTime() : 0;

          if (a.processing && !b.processing) return -1;
          if (!a.processing && b.processing) return 1;

          return timeB - timeA;
        });

      case "name":
        return videosCopy.sort((a, b) => {
          if (a.processing && !b.processing) return -1;
          if (!a.processing && b.processing) return 1;

          return a.name.localeCompare(b.name, undefined, {
            numeric: true,
            sensitivity: "base",
          });
        });

      case "duration":
        return videosCopy.sort((a, b) => {
          if (a.processing && !b.processing) return -1;
          if (!a.processing && b.processing) return 1;

          return b.duration_seconds - a.duration_seconds;
        });

      default:
        return videosCopy;
    }
  }, [videos, sortType]);

  const formatProcessedTime = (isoString?: string) => {
    if (!isoString) return "Неизвестно";

    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Только что";
    if (diffMins < 60) return `${diffMins} мин. назад`;
    if (diffHours < 24) return `${diffHours} ч. назад`;
    if (diffDays < 7) return `${diffDays} дн. назад`;

    return date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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

  if (error) {
    return <div className="bg-red-50 text-red-500 p-4 rounded-md">{error}</div>;
  }

  return (
    <div>
      {/* Панель сортировки */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          Обработанные видео ({videos.length})
        </h2>

        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setSortType("time")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              sortType === "time"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            По времени
          </button>
          <button
            onClick={() => setSortType("name")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              sortType === "name"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            По алфавиту
          </button>
          <button
            onClick={() => setSortType("duration")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              sortType === "duration"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            По длительности
          </button>
        </div>
      </div>

      {/* Сетка видео */}
      {sortedVideos.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <p className="text-gray-500">Нет обработанных видео</p>
          <p className="text-sm text-gray-400 mt-2">
            Укажите путь к видеофайлу, чтобы начать обработку
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {sortedVideos.map((video) => {
            // Получаем статистику из данных видео
            const totalFaces = video.statistics?.total_faces_detected || 0;
            const totalNSFW = video.statistics?.total_nsfw_detected || 0;

            return (
              <div
                key={video.name}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                <Link to={`/video/${video.name}`}>
                  <div className="aspect-video bg-gray-100 relative">
                    {video.frames_processed > 0 ? (
                      <>
                        <img
                          src={videoService.getFrameUrl(
                            video.name,
                            `${video.name}_001.jpg`,
                          )}
                          alt={video.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23ddd'/%3E%3Ctext x='50' y='50' font-size='14' text-anchor='middle' dy='.3em' fill='%23999'%3EНет превью%3C/text%3E%3C/svg%3E";
                          }}
                        />
                        {video.processing && (
                          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                            <div className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                              Обработка...
                            </div>
                          </div>
                        )}

                        {/* Статистика на превью */}
                        {!video.processing && (
                          <div className="absolute bottom-2 left-2 right-2 flex gap-1">
                            {totalFaces > 0 && (
                              <div className="bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
                                <PersonIcon />
                                {totalFaces}
                              </div>
                            )}
                            {totalNSFW > 0 && (
                              <div className="bg-red-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
                                <WarningIcon />
                                {totalNSFW}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        {video.processing ? (
                          <div className="text-center">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
                            <p>Начинаем обработку...</p>
                          </div>
                        ) : (
                          "Нет кадров"
                        )}
                      </div>
                    )}
                  </div>
                </Link>

                <div className="p-4">
                  <Link to={`/video/${video.name}`}>
                    <h3 className="font-semibold text-lg mb-2 hover:text-blue-500 truncate">
                      {video.name}
                    </h3>
                  </Link>

                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <span
                        className="truncate flex-1 text-xs font-mono"
                        title={video.source_path}
                      >
                        {video.source_path}
                      </span>
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
                    <p>Длительность: {video.duration_formatted}</p>
                    <p>
                      Кадров: {video.frames_processed}
                      {video.processing &&
                        video.total_frames_estimated > 0 &&
                        `/${video.total_frames_estimated}`}
                    </p>
                    <p>Интервал: {video.frames_interval}с</p>

                    {/* Статистика в текстовом виде */}
                    {!video.processing && (totalFaces > 0 || totalNSFW > 0) && (
                      <div className="flex items-center gap-3 pt-1">
                        {totalFaces > 0 && (
                          <span className="text-green-600 text-xs flex items-center gap-1">
                            <PersonIcon />
                            Лиц: {totalFaces}
                          </span>
                        )}
                        {totalNSFW > 0 && (
                          <span className="text-red-500 text-xs flex items-center gap-1">
                            <WarningIcon />
                            NSFW: {totalNSFW}
                          </span>
                        )}
                      </div>
                    )}

                    {!video.processing && video.processed_at && (
                      <p className="text-xs text-gray-400">
                        {formatProcessedTime(video.processed_at)}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Link
                      to={`/video/${video.name}`}
                      className="flex-1 text-center bg-blue-500 text-white py-2 px-3 rounded-md hover:bg-blue-600 transition-colors text-sm"
                    >
                      Просмотр
                    </Link>
                    {video.processing ? (
                      <button
                        onClick={() => handleStopProcessing(video.name)}
                        className="flex-1 bg-orange-500 text-white py-2 px-3 rounded-md hover:bg-orange-600 transition-colors text-sm"
                      >
                        Остановить
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDelete(video.name)}
                        className="flex-1 bg-red-500 text-white py-2 px-3 rounded-md hover:bg-red-600 transition-colors text-sm"
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
