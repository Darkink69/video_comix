import React, { useState, useEffect, useRef } from "react";
import {
  Frame,
  FaceDetectionResult,
  NSFWDetectionResult,
} from "../types/video";
import { videoService } from "../services/api";

interface FrameGalleryProps {
  videoName: string;
  frames: Frame[];
  videoPath?: string;
}

export const FrameGallery: React.FC<FrameGalleryProps> = ({
  videoName,
  frames,
  // videoPath
}) => {
  const [selectedFrameIndex, setSelectedFrameIndex] = useState<number | null>(
    null,
  );
  // const [showVideo, setShowVideo] = useState(false);
  const [showFaceBoxes, setShowFaceBoxes] = useState(true);
  // const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedFrame =
    selectedFrameIndex !== null ? frames[selectedFrameIndex] : null;

  const navigateFrames = (direction: "prev" | "next") => {
    if (selectedFrameIndex === null || frames.length === 0) return;

    let newIndex =
      direction === "next" ? selectedFrameIndex + 1 : selectedFrameIndex - 1;

    if (newIndex >= frames.length) newIndex = 0;
    else if (newIndex < 0) newIndex = frames.length - 1;

    setSelectedFrameIndex(newIndex);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedFrameIndex === null) return;

      switch (e.key) {
        case "Escape":
          setSelectedFrameIndex(null);
          // setShowVideo(false);
          break;
        case "ArrowLeft":
          e.preventDefault();
          navigateFrames("prev");
          break;
        case "ArrowRight":
          e.preventDefault();
          navigateFrames("next");
          break;
        case "f":
        case "F":
          setShowFaceBoxes((prev) => !prev);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedFrameIndex, frames.length]);

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

  const handleCloseModal = () => {
    setSelectedFrameIndex(null);
    // setShowVideo(false);
  };

  // Компонент рамок лиц
  const FaceBoxes: React.FC<{
    faceDetection?: FaceDetectionResult;
    imageWidth: number;
    imageHeight: number;
  }> = ({ faceDetection, imageWidth, imageHeight }) => {
    if (!faceDetection?.faces || !showFaceBoxes) return null;

    return (
      <>
        {faceDetection.faces.map((face, index) => {
          const { bbox } = face;
          const left = (bbox.x1 / imageWidth) * 100;
          const top = (bbox.y1 / imageHeight) * 100;
          const width = ((bbox.x2 - bbox.x1) / imageWidth) * 100;
          const height = ((bbox.y2 - bbox.y1) / imageHeight) * 100;

          return (
            <div
              key={index}
              className="absolute border-2 border-green-500 pointer-events-none"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: `${width}%`,
                height: `${height}%`,
              }}
            >
              <div className="absolute -top-6 left-0 bg-green-500 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap">
                {(face.confidence * 100).toFixed(0)}%
              </div>
              {face.landmarks &&
                Object.entries(face.landmarks).map(([name, point]) => (
                  <div
                    key={name}
                    className="absolute w-1.5 h-1.5 bg-blue-400 rounded-full -translate-x-1/2 -translate-y-1/2 shadow-lg"
                    style={{
                      left: `${(point.x / imageWidth) * 100}%`,
                      top: `${(point.y / imageHeight) * 100}%`,
                    }}
                  />
                ))}
            </div>
          );
        })}
      </>
    );
  };

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

  // Бейдж количества лиц
  const FaceCountBadge: React.FC<{ count: number }> = ({ count }) => {
    if (count === 0) return null;
    return (
      <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-1 py-1 rounded-full flex items-center gap-1 shadow-lg z-10">
        <PersonIcon />
        {count}
      </div>
    );
  };

  // Бейдж NSFW (только иконка, без текста)
  const NSFWBadge: React.FC<{ nsfwDetection?: NSFWDetectionResult }> = ({
    nsfwDetection,
  }) => {
    if (!nsfwDetection?.is_nsfw) return null;

    return (
      <div className="absolute top-2 left-2 bg-red-500 text-white text-xs px-1 py-1 rounded-full flex items-center gap-1 shadow-lg z-10">
        <WarningIcon />
      </div>
    );
  };

  // Статистика
  const totalFaces = frames.reduce((sum, f) => sum + (f.faces_count || 0), 0);
  const totalNSFW = frames.filter((f) => f.nsfw_detection?.is_nsfw).length;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Кадры видео ({frames.length})</h2>
        <div className="flex gap-4 text-sm">
          {totalFaces > 0 && (
            <span className="text-green-600 flex items-center gap-1">
              <PersonIcon />
              Лиц: {totalFaces}
            </span>
          )}
          {totalNSFW > 0 && (
            <span className="text-red-500 flex items-center gap-1">
              <WarningIcon />
              NSFW: {totalNSFW}
            </span>
          )}
        </div>
      </div>

      {/* Модальное окно */}
      {selectedFrame && (
        <div
          className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50"
          onClick={handleCloseModal}
        >
          <div
            className="relative max-w-7xl max-h-full w-full h-full flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Хедер */}
            <div className="bg-black bg-opacity-50 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">
                  Кадр #{selectedFrame.id} из {frames.length}
                </h3>
                <p className="text-sm text-gray-300">
                  Время: {selectedFrame.time_formatted} (
                  {selectedFrame.time_seconds} сек)
                </p>

                {/* Индикаторы в хедере */}
                <div className="flex gap-3 mt-1">
                  {selectedFrame.faces_count !== undefined &&
                    selectedFrame.faces_count > 0 && (
                      <p className="text-sm text-green-400 flex items-center gap-1">
                        <PersonIcon />
                        Лиц: {selectedFrame.faces_count}
                      </p>
                    )}
                  {selectedFrame.nsfw_detection?.is_nsfw && (
                    <p className="text-sm text-red-400 flex items-center gap-1">
                      <WarningIcon />
                      NSFW: {selectedFrame.nsfw_detection.nsfw_type}(
                      {(selectedFrame.nsfw_detection.nsfw_score * 100).toFixed(
                        1,
                      )}
                      %)
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {selectedFrame.face_detection?.faces &&
                  selectedFrame.face_detection.faces.length > 0 && (
                    <button
                      onClick={() => setShowFaceBoxes((prev) => !prev)}
                      className={`p-2 rounded-full transition-colors ${
                        showFaceBoxes
                          ? "bg-green-600 hover:bg-green-700"
                          : "bg-gray-700 hover:bg-gray-600"
                      }`}
                      title="Показать/скрыть рамки лиц (F)"
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
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    </button>
                  )}

                <button
                  onClick={() => navigateFrames("prev")}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
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

                <button
                  onClick={handleCloseModal}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md transition-colors"
                >
                  Закрыть
                </button>
              </div>
            </div>

            {/* Контент */}
            <div className="flex-1 flex items-center justify-center p-4 min-h-0">
              <div
                ref={containerRef}
                className="relative group h-full flex items-center justify-center"
              >
                <div className="relative inline-block max-w-full max-h-full">
                  <img
                    ref={imageRef}
                    src={videoService.getFrameUrl(
                      videoName,
                      selectedFrame.filename,
                    )}
                    alt={selectedFrame.filename}
                    className="max-w-full max-h-full object-contain"
                  />

                  {imageRef.current && selectedFrame.face_detection && (
                    <FaceBoxes
                      faceDetection={selectedFrame.face_detection}
                      imageWidth={imageRef.current.naturalWidth}
                      imageHeight={imageRef.current.naturalHeight}
                    />
                  )}
                </div>

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
            </div>

            {/* Подсказки */}
            <div className="bg-black bg-opacity-50 text-white p-2 text-xs text-center">
              <span className="inline-flex items-center gap-1 mr-4">
                <kbd className="px-2 py-1 bg-gray-700 rounded">←</kbd>
                <kbd className="px-2 py-1 bg-gray-700 rounded">→</kbd>
                <span>навигация</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className="px-2 py-1 bg-gray-700 rounded">ESC</kbd>
                <span>закрыть</span>
              </span>
              {selectedFrame.face_detection?.faces &&
                selectedFrame.face_detection.faces.length > 0 && (
                  <span className="inline-flex items-center gap-1 ml-4">
                    <kbd className="px-2 py-1 bg-gray-700 rounded">F</kbd>
                    <span>рамки лиц</span>
                  </span>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Галерея */}
      {frames.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Кадры еще не извлечены или обработка не завершена
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {frames.map((frame, index) => (
            <div
              key={frame.id}
              className="cursor-pointer group"
              onClick={() => setSelectedFrameIndex(index)}
            >
              <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden relative">
                <img
                  src={videoService.getFrameUrl(videoName, frame.filename)}
                  alt={frame.filename}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  loading="lazy"
                />

                <FaceCountBadge count={frame.faces_count || 0} />
                <NSFWBadge nsfwDetection={frame.nsfw_detection} />

                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
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
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
              </div>
              <div className="mt-2 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-medium">Кадр #{frame.id}</p>
                  <div className="flex items-center gap-1">
                    {frame.faces_count !== undefined &&
                      frame.faces_count > 0 && (
                        <span className="text-green-500 text-xs flex items-center gap-0.5">
                          <PersonIcon />
                          {frame.faces_count}
                        </span>
                      )}
                    {frame.nsfw_detection?.is_nsfw && (
                      <span className="text-red-500 text-xs flex items-center gap-0.5">
                        <WarningIcon />
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-gray-500">{frame.time_formatted}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
