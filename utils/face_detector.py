import os
import json
import logging
from typing import List, Dict, Optional, Tuple, Any
import cv2
import numpy as np

logger = logging.getLogger(__name__)


class FaceDetector:
    """Детектор лиц с использованием RetinaFace."""

    def __init__(self):
        self._model = None
        self._initialized = False

    def _initialize(self):
        """Ленивая инициализация модели."""
        if self._initialized:
            return

        try:
            from retinaface import RetinaFace
            self.RetinaFace = RetinaFace
            self._initialized = True
            logger.info("RetinaFace initialized successfully")
        except ImportError as e:
            logger.error(f"Failed to import RetinaFace: {e}")
            raise ImportError(
                "RetinaFace not installed. Run: pip install retina-face")

    def detect_faces(self, image_path: str) -> Dict:
        """
        Определяет лица на изображении.

        Args:
            image_path: путь к изображению

        Returns:
            Словарь с результатами распознавания
        """
        self._initialize()

        result = {
            'faces_count': 0,
            'faces': [],
            'error': None
        }

        if not os.path.exists(image_path):
            result['error'] = f"Image not found: {image_path}"
            return result

        try:
            # Загружаем изображение
            img = cv2.imread(image_path)
            if img is None:
                result['error'] = f"Failed to load image: {image_path}"
                return result

            height, width = img.shape[:2]

            # Детектируем лица
            faces = self.RetinaFace.detect_faces(image_path)

            if isinstance(faces, dict):
                for face_id, face_data in faces.items():
                    # Извлекаем координаты
                    facial_area = face_data.get('facial_area', [])
                    landmarks = face_data.get('landmarks', {})

                    if facial_area:
                        x1, y1, x2, y2 = facial_area

                        # Нормализованные координаты (0-1)
                        face_info = {
                            'bbox': {
                                'x1': int(x1),
                                'y1': int(y1),
                                'x2': int(x2),
                                'y2': int(y2),
                                'width': int(x2 - x1),
                                'height': int(y2 - y1)
                            },
                            'bbox_normalized': {
                                'x1': round(x1 / width, 4),
                                'y1': round(y1 / height, 4),
                                'x2': round(x2 / width, 4),
                                'y2': round(y2 / height, 4)
                            },
                            'confidence': round(face_data.get('score', 0), 4)
                        }

                        # Добавляем ключевые точки если есть
                        if landmarks:
                            face_info['landmarks'] = {}
                            for name, point in landmarks.items():
                                if len(point) >= 2:
                                    face_info['landmarks'][name] = {
                                        'x': int(point[0]),
                                        'y': int(point[1]),
                                        'x_normalized': round(point[0] / width,
                                                              4),
                                        'y_normalized': round(point[1] / height,
                                                              4)
                                    }

                        result['faces'].append(face_info)

            result['faces_count'] = len(result['faces'])
            result['image_size'] = {'width': width, 'height': height}

            logger.debug(
                f"Detected {result['faces_count']} faces in {os.path.basename(image_path)}")

        except Exception as e:
            logger.error(f"Face detection error: {e}")
            result['error'] = str(e)

        return result

    def detect_faces_batch(self, image_paths: List[str]) -> Dict[str, Dict]:
        """
        Определяет лица на нескольких изображениях.

        Args:
            image_paths: список путей к изображениям

        Returns:
            Словарь {путь: результаты}
        """
        results = {}
        for path in image_paths:
            results[path] = self.detect_faces(path)
        return results


# Синглтон для переиспользования модели
_face_detector_instance = None


def get_face_detector() -> FaceDetector:
    """Возвращает синглтон детектора лиц."""
    global _face_detector_instance
    if _face_detector_instance is None:
        _face_detector_instance = FaceDetector()
    return _face_detector_instance