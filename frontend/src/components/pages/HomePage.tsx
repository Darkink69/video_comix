import React, { useState, useCallback } from "react";
import { UploadForm } from "../UploadForm";
import { VideoList } from "../VideoList";

export const HomePage: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSuccess = useCallback(() => {
    console.log("HomePage: Upload success, refreshing list");
    setRefreshKey((prev) => prev + 1);
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          🎬 Video Frame Extractor
        </h1>
        <p className="text-gray-600">
          Извлекайте кадры из видео с заданным интервалом
        </p>
      </header>

      <div className="space-y-8">
        <UploadForm onSuccess={handleSuccess} />

        <div>
          <VideoList key={refreshKey} />
        </div>
      </div>
    </div>
  );
};
