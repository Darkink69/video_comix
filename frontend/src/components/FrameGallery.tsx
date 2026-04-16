import React, { useState, useEffect, useRef } from "react";
import { Frame } from "../types/video";
import { videoService } from "../services/api";

interface FrameGalleryProps {
  videoName: string;
  frames: Frame[];
  videoPath?: string;
}

export const FrameGallery: React.FC<FrameGalleryProps> = ({
  videoName,
  frames,
  videoPath,
}) => {
  const [selectedFrameIndex, setSelectedFrameIndex] = useState<number | null>(
    null,
  );
  const [showVideo, setShowVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const selectedFrame =
    selectedFrameIndex !== null ? frames[selectedFrameIndex] : null;

  // Навигация по кадрам
  const navigateFrames = (direction: "prev" | "next") => {
    if (selectedFrameIndex === null || frames.length === 0) return;

    let newIndex =
      direction === "next" ? selectedFrameIndex + 1 : selectedFrameIndex - 1;

    // Циклическая навигация
    if (newIndex >= frames.length) {
      newIndex = 0;
    } else if (newIndex < 0) {
      newIndex = frames.length - 1;
    }

    setSelectedFrameIndex(newIndex);
  };

  // Обработчик клавиатуры
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedFrameIndex === null) return;

      switch (e.key) {
        case "Escape":
          setSelectedFrameIndex(null);
          setShowVideo(false);
          break;
        case "ArrowLeft":
          e.preventDefault();
          navigateFrames("prev");
          break;
        case "ArrowRight":
          e.preventDefault();
          navigateFrames("next");
          break;
        case "v":
        case "V":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setShowVideo(true);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedFrameIndex, frames.length]);

  // Управление видео
  useEffect(() => {
    if (showVideo && videoRef.current && selectedFrame) {
      const video = videoRef.current;
      video.currentTime = selectedFrame.time_seconds;

      // Пытаемся автоматически начать воспроизведение
      const playVideo = async () => {
        try {
          await video.play();
        } catch (err) {
          console.log("Автовоспроизведение заблокировано браузером");
        }
      };
      playVideo();
    }
  }, [showVideo, selectedFrame]);

  // Блокировка прокрутки страницы при открытом модальном окне
  useEffect(() => {
    if (selectedFrameIndex !== null) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [selectedFrameIndex]);

  const handleOpenVideo = () => {
    setShowVideo(true);
  };

  const handleCloseVideo = () => {
    setShowVideo(false);
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  const handleCloseModal = () => {
    setSelectedFrameIndex(null);
    setShowVideo(false);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">Кадры видео</h2>

      {/* Модальное окно просмотра кадра */}
      {selectedFrame && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50"
          onClick={handleCloseModal}
        >
          <div
            className="relative max-w-7xl max-h-full w-full h-full flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Хедер модального окна */}
            <div className="bg-black bg-opacity-50 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">
                  Кадр #{selectedFrame.id} из {frames.length}
                </h3>
                <p className="text-sm text-gray-300">
                  Время: {selectedFrame.time_formatted} (
                  {selectedFrame.time_seconds} сек)
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Кнопка навигации */}
                <button
                  onClick={() => navigateFrames("prev")}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
                  title="Предыдущий кадр (←)"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>

                <button
                  onClick={() => navigateFrames("next")}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
                  title="Следующий кадр (→)"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>

                <div className="w-px h-6 bg-gray-600 mx-2" />

                {/* Кнопка воспроизведения видео */}
                {videoPath && (
                  <button
                    onClick={handleOpenVideo}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md transition-colors flex items-center gap-2"
                    title="Воспроизвести видео с этого момента (Ctrl+V)"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Видео
                  </button>
                )}

                {/* Кнопка закрытия */}
                <button
                  onClick={handleCloseModal}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md transition-colors"
                  title="Закрыть (ESC)"
                >
                  Закрыть
                </button>
              </div>
            </div>

            {/* Основной контент */}
            <div className="flex-1 flex items-center justify-center p-4 min-h-0">
              {!showVideo ? (
                // Просмотр изображения
                <div className="relative group h-full flex items-center justify-center">
                  <img
                    src={videoService.getFrameUrl(
                      videoName,
                      selectedFrame.filename,
                    )}
                    alt={selectedFrame.filename}
                    className="max-w-full max-h-full object-contain"
                  />

                  {/* Стрелки навигации по бокам */}
                  <button
                    onClick={() => navigateFrames("prev")}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black bg-opacity-50 hover:bg-opacity-75 rounded-full transition-all opacity-0 group-hover:opacity-100"
                  >
                    <svg
                      className="w-8 h-8 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>

                  <button
                    onClick={() => navigateFrames("next")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black bg-opacity-50 hover:bg-opacity-75 rounded-full transition-all opacity-0 group-hover:opacity-100"
                  >
                    <svg
                      className="w-8 h-8 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                </div>
              ) : (
                // Просмотр видео
                <div className="w-full h-full flex flex-col">
                  <div className="flex-1 flex items-center justify-center bg-black rounded-lg overflow-hidden">
                    <video
                      ref={videoRef}
                      controls
                      autoPlay
                      className="max-w-full max-h-full"
                      src={
                        videoPath
                          ? `/api/video-file?path=${encodeURIComponent(videoPath)}`
                          : undefined
                      }
                    >
                      Ваш браузер не поддерживает видео.
                    </video>
                  </div>

                  <div className="mt-4 flex justify-center">
                    <button
                      onClick={handleCloseVideo}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors"
                    >
                      Вернуться к кадру
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Подсказки по клавишам */}
            {/* <div className="bg-black bg-opacity-50 text-white p-2 text-xs text-center">
              <span className="inline-flex items-center gap-1 mr-4">
                <kbd className="px-2 py-1 bg-gray-700 rounded">←</kbd>
                <kbd className="px-2 py-1 bg-gray-700 rounded">→</kbd>
                <span>навигация</span>
              </span>
              <span className="inline-flex items-center gap-1 mr-4">
                <kbd className="px-2 py-1 bg-gray-700 rounded">ESC</kbd>
                <span>закрыть</span>
              </span>
              {videoPath && (
                <span className="inline-flex items-center gap-1">
                  <kbd className="px-2 py-1 bg-gray-700 rounded">Ctrl</kbd>
                  <span>+</span>
                  <kbd className="px-2 py-1 bg-gray-700 rounded">V</kbd>
                  <span>видео</span>
                </span>
              )}
            </div> */}
          </div>
        </div>
      )}

      {/* Галерея превью */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {frames.map((frame, index) => (
          <div
            key={frame.id}
            className="cursor-pointer group"
            onClick={() => setSelectedFrameIndex(index)}
          >
            <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
              <img
                src={videoService.getFrameUrl(videoName, frame.filename)}
                alt={frame.filename}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                loading="lazy"
              />
            </div>
            <div className="mt-2 text-sm">
              <p className="font-medium">Кадр #{frame.id}</p>
              <p className="text-gray-500">{frame.time_formatted}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
