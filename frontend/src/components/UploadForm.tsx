import React, { useState, useRef } from "react";
import { videoService } from "../services/api";

interface UploadFormProps {
  onSuccess: () => void;
}

export const UploadForm: React.FC<UploadFormProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<"path" | "upload">("path");
  const [path, setPath] = useState("");
  const [interval, setInterval] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError(null);

    if (mode === "path" && !path.trim()) {
      setError("Укажите путь к видеофайлу");
      return;
    }

    if (mode === "upload") {
      const file = fileInputRef.current?.files?.[0];
      if (!file) {
        setError("Выберите файл для загрузки");
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === "path") {
        // Обработка по пути
        console.log("Processing by path:", path);
        const response = await videoService.process(path, interval);
        console.log("Process response:", response);
        setPath("");
        onSuccess();
      } else {
        // Загрузка файла и последующая обработка
        const file = fileInputRef.current?.files?.[0];
        if (!file) return;

        console.log("Uploading file:", file.name);
        setUploadProgress(10);

        // Загружаем файл
        const uploadResponse = await videoService.uploadFile(file);
        console.log("Upload response:", uploadResponse);
        setUploadProgress(50);

        // Запускаем обработку загруженного файла
        const processResponse = await videoService.process(
          uploadResponse.filename,
          interval,
        );
        console.log("Process response:", processResponse);
        setUploadProgress(100);

        // Очищаем форму
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        setUploadProgress(0);
        onSuccess();
      }
    } catch (err: any) {
      console.error("Submit error:", err);

      // Извлекаем понятное сообщение об ошибке
      let errorMessage = "Неизвестная ошибка";

      if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }

      // Особые случаи
      if (err.code === "ECONNABORTED") {
        errorMessage = "Превышено время ожидания ответа от сервера";
      } else if (err.code === "ERR_NETWORK") {
        errorMessage = "Ошибка сети. Проверьте подключение к серверу";
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log("File selected:", file.name, file.size, file.type);
      setError(null);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">Обработать видео</h2>

      {/* Переключатель режима */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => {
            setMode("path");
            setError(null);
          }}
          className={`flex-1 py-2 px-4 rounded-md transition-colors ${
            mode === "path"
              ? "bg-blue-500 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          По пути
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("upload");
            setError(null);
          }}
          className={`flex-1 py-2 px-4 rounded-md transition-colors ${
            mode === "upload"
              ? "bg-blue-500 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
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
              onChange={handleFileChange}
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
            <p className="mt-1 text-xs text-gray-500">
              Файл будет загружен в папку uploads и обработан
            </p>
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
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
          className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
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
              {mode === "path" ? "Запуск..." : "Загрузка..."}
            </span>
          ) : mode === "path" ? (
            "Обработать"
          ) : (
            "Загрузить и обработать"
          )}
        </button>
      </form>
    </div>
  );
};
