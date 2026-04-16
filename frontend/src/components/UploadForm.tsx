import React, { useState, useRef } from "react";
import { videoService } from "../services/api";
import { ProcessOptions } from "../types/video";

interface UploadFormProps {
  onSuccess: () => void;
}

// Компонент подсказки с кружочком
const Tooltip: React.FC<{ text: string }> = ({ text }) => (
  <div className="relative group inline-block">
    <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-gray-500 bg-gray-200 rounded-full cursor-help hover:bg-gray-300 hover:text-gray-700 transition-colors">
      ?
    </span>
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-lg">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
    </div>
  </div>
);

export const UploadForm: React.FC<UploadFormProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<"path" | "upload">("path");
  const [path, setPath] = useState("");
  const [interval, setInterval] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [options, setOptions] = useState<ProcessOptions>({
    detect_faces: false,
    detect_people: false,
    describe_frame: false,
    nsfw: false,
  });

  const handleOptionChange = (key: keyof ProcessOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === "path" && !path.trim()) {
      setError("Укажите путь к видеофайлу");
      return;
    }

    if (mode === "upload" && !fileInputRef.current?.files?.[0]) {
      setError("Выберите файл для загрузки");
      return;
    }

    setLoading(true);

    try {
      if (mode === "path") {
        await videoService.process(path, interval, options);
        setPath("");
        onSuccess();
      } else {
        const file = fileInputRef.current?.files?.[0];
        if (!file) return;

        setUploadProgress(10);
        const uploadResponse = await videoService.uploadFile(file);
        setUploadProgress(50);

        await videoService.process(uploadResponse.filename, interval, options);
        setUploadProgress(100);

        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        setUploadProgress(0);
        onSuccess();
      }
    } catch (err: any) {
      let errorMessage =
        err.response?.data?.error || err.message || "Ошибка обработки";
      if (err.code === "ECONNABORTED") {
        errorMessage = "Превышено время ожидания";
      } else if (err.code === "ERR_NETWORK") {
        errorMessage = "Ошибка сети";
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Левая колонка */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Обработать видео</h2>

          {/* Переключатель режима */}
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setMode("path")}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors border ${
                mode === "path"
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              По пути
            </button>
            <button
              type="button"
              onClick={() => setMode("upload")}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors border ${
                mode === "upload"
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              Загрузить
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "path" ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Путь к видеофайлу
                </label>
                <input
                  type="text"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  disabled={loading}
                  placeholder="video.mp4 или C:\videos\movie.mp4"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Если указано только имя — ищется в папке uploads
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Выберите видеофайл
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Интервал между кадрами (секунд)
              </label>
              <input
                type="number"
                min="1"
                max="300"
                value={interval}
                onChange={(e) => setInterval(parseInt(e.target.value) || 10)}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
              />
            </div>

            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="space-y-1">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 text-center">
                  {uploadProgress < 50 ? "Загрузка..." : "Запуск обработки..."}
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                <p className="font-medium">Ошибка:</p>
                <p>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 text-white py-2.5 px-4 rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  {mode === "path" ? "Обработка..." : "Загрузка..."}
                </span>
              ) : mode === "path" ? (
                "Обработать"
              ) : (
                "Загрузить и обработать"
              )}
            </button>
          </form>
        </div>

        {/* Правая колонка - опции */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 mt-0 lg:mt-10">
            Дополнительные опции
          </h3>

          <div className="space-y-2">
            {/* Распознавание лиц */}
            <label className="flex items-center p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors border-2 border-transparent hover:border-gray-300">
              <input
                type="checkbox"
                checked={options.detect_faces}
                onChange={() => handleOptionChange("detect_faces")}
                disabled={loading}
                className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 disabled:opacity-50"
              />
              <span className="ml-3 font-medium text-gray-800">
                Распознавать лица
              </span>
              <div className="ml-auto">
                <Tooltip text="Каждый кадр будет проверен на наличие лиц. Определение лиц и ключевых точек на каждом кадре. Увеличивает время обработки." />
              </div>
            </label>

            {/* Распознавание людей */}
            <label className="flex items-center p-3 bg-gray-50 rounded-lg opacity-60 cursor-not-allowed border-2 border-transparent">
              <input
                type="checkbox"
                checked={options.detect_people}
                disabled={true}
                className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="ml-3 font-medium text-gray-800">
                Распознавать людей
              </span>
              <div className="ml-auto">
                <Tooltip text="Определение присутствия людей в кадре. Поиск силуэтов людей на изображении. В разработке." />
              </div>
            </label>

            {/* Описание кадра */}
            <label className="flex items-center p-3 bg-gray-50 rounded-lg opacity-60 cursor-not-allowed border-2 border-transparent">
              <input
                type="checkbox"
                checked={options.describe_frame}
                disabled={true}
                className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="ml-3 font-medium text-gray-800">
                Описание кадра
              </span>
              <div className="ml-auto">
                <Tooltip text="Автоматическое текстовое описание содержимого кадра с помощью AI. В разработке." />
              </div>
            </label>

            {/* NSFW */}
            <label className="flex items-center p-3 bg-gray-50 rounded-lg opacity-60 cursor-not-allowed border-2 border-transparent">
              <input
                type="checkbox"
                checked={options.nsfw}
                disabled={true}
                className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="ml-3 font-medium text-gray-800">NSFW</span>
              <div className="ml-auto">
                <Tooltip text="Определение контента для взрослых. Фильтрация неприемлемого контента. В разработке." />
              </div>
            </label>

            {/* Распознавание речи */}
            <label className="flex items-center p-3 bg-gray-50 rounded-lg opacity-60 cursor-not-allowed border-2 border-transparent">
              <input
                type="checkbox"
                disabled={true}
                className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="ml-3 font-medium text-gray-800">
                Распознать речь
              </span>
              <div className="ml-auto">
                <Tooltip text="Извлечение и распознавание аудиодорожки. Транскрибация речи из видео. В разработке." />
              </div>
            </label>

            {/* Использовать субтитры */}
            <label className="flex items-center p-3 bg-gray-50 rounded-lg opacity-60 cursor-not-allowed border-2 border-transparent">
              <input
                type="checkbox"
                disabled={true}
                className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="ml-3 font-medium text-gray-800">
                Использовать субтитры
              </span>
              <div className="ml-auto">
                <Tooltip text="Извлечение и анализ встроенных субтитров. Парсинг SRT/VTT субтитров из видео. В разработке." />
              </div>
            </label>
          </div>

          {/* Предупреждение */}
          {options.detect_faces && (
            <div className="mt-4 p-3 bg-amber-50 rounded-lg border-2 border-amber-200">
              <p className="text-sm text-amber-800">
                ⏱ Включено распознавание лиц — обработка займет больше времени
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
