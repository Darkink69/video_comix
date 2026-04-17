import os
import logging
from typing import Dict, List, Optional, Tuple, Any

logger = logging.getLogger(__name__)

# Пытаемся импортировать TensorFlow
TF_AVAILABLE = False
try:
    import tensorflow as tf
    from tensorflow.keras.preprocessing import image
    from tensorflow.keras.models import load_model
    import numpy as np

    TF_AVAILABLE = True
    logger.info("TensorFlow loaded successfully")
except ImportError as e:
    logger.warning(
        f"TensorFlow not installed. NSFW detection will be disabled. Error: {e}")


class NSFWTools:
    """Утилиты для NSFW-детекции на основе модели."""

    def __init__(self, model_path: str = None):
        self.model_path = model_path or os.path.join(os.path.dirname(__file__),
                                                     'mobilenet_v2_140_224')
        self._model = None
        self._categories = ['drawings', 'hentai', 'neutral', 'porn', 'sexy']
        self._initialized = False
        self._available = TF_AVAILABLE

        # Пороговые значения
        self.thresholds = {
            'porn': 0.6,
            'sexy': 0.15,
            'hentai': 0.5,
            'drawings_max': 0.2
        }

    @property
    def is_available(self) -> bool:
        """Проверяет, доступна ли NSFW-детекция."""
        return self._available and os.path.exists(self.model_path)

    def _initialize(self):
        """Ленивая инициализация модели."""
        if self._initialized:
            return

        if not self._available:
            logger.warning(
                "NSFW detection not available: TensorFlow not installed")
            return

        if not os.path.exists(self.model_path):
            logger.warning(f"NSFW model not found at {self.model_path}")
            self._available = False
            return

        try:
            self._model = load_model(self.model_path)
            self._initialized = True
            logger.info(f"NSFW model loaded from {self.model_path}")
        except Exception as e:
            logger.error(f"Failed to load NSFW model: {e}")
            self._available = False

    def _preprocess_image(self, img_path: str,
                          target_size: Tuple[int, int] = (224, 224)):
        """Предобработка изображения для модели."""
        img = image.load_img(img_path, target_size=target_size)
        x = image.img_to_array(img)
        x = np.expand_dims(x, axis=0)
        x = x / 255.0
        return x

    def predict_single(self, img_path: str) -> Dict[str, float]:
        """
        Предсказание для одного изображения.
        Если детекция недоступна, возвращает нулевые вероятности.
        """
        if not self.is_available:
            return {cat: 0.0 for cat in self._categories}

        self._initialize()

        if not self._model or not os.path.exists(img_path):
            return {cat: 0.0 for cat in self._categories}

        try:
            x = self._preprocess_image(img_path)
            predictions = self._model.predict(x, verbose=0)[0]

            result = {}
            for i, category in enumerate(self._categories):
                result[category] = float(predictions[i])

            return result
        except Exception as e:
            logger.error(f"Error predicting {img_path}: {e}")
            return {cat: 0.0 for cat in self._categories}

    def is_nsfw(self, predictions: Dict[str, float]) -> Dict[str, Any]:
        """
        Проверяет, является ли контент NSFW.
        """
        result = {
            'is_nsfw': False,
            'nsfw_type': None,
            'nsfw_score': 0.0,
            'all_scores': predictions
        }

        # Проверяем пороги
        if predictions.get('porn', 0) >= self.thresholds['porn']:
            result['is_nsfw'] = True
            result['nsfw_type'] = 'porn'
            result['nsfw_score'] = predictions['porn']
        elif predictions.get('sexy', 0) >= self.thresholds['sexy']:
            result['is_nsfw'] = True
            result['nsfw_type'] = 'sexy'
            result['nsfw_score'] = predictions['sexy']
        elif predictions.get('hentai', 0) >= self.thresholds['hentai']:
            if predictions.get('drawings', 0) < self.thresholds['drawings_max']:
                result['is_nsfw'] = True
                result['nsfw_type'] = 'hentai'
                result['nsfw_score'] = predictions['hentai']

        return result

    def get_nsfw_frames(self, folder_path: str) -> Dict[str, Any]:
        """
        Анализирует все изображения в папке на NSFW.
        """
        result = {
            'frames': {},
            'nsfw_frames': [],
            'statistics': {
                'total_frames': 0,
                'nsfw_count': 0,
                'by_type': {'porn': 0, 'sexy': 0, 'hentai': 0}
            },
            'available': self.is_available
        }

        if not self.is_available:
            logger.warning("NSFW detection not available")
            return result

        if not os.path.exists(folder_path):
            logger.warning(f"Folder not found: {folder_path}")
            return result

        image_files = [f for f in os.listdir(folder_path) if
                       f.lower().endswith('.jpg')]
        result['statistics']['total_frames'] = len(image_files)

        for filename in image_files:
            img_path = os.path.join(folder_path, filename)

            predictions = self.predict_single(img_path)
            nsfw_check = self.is_nsfw(predictions)

            frame_result = {
                'predictions': predictions,
                'is_nsfw': nsfw_check['is_nsfw'],
                'nsfw_type': nsfw_check['nsfw_type'],
                'nsfw_score': nsfw_check['nsfw_score']
            }

            result['frames'][filename] = frame_result

            if nsfw_check['is_nsfw']:
                result['nsfw_frames'].append(filename)
                result['statistics']['nsfw_count'] += 1
                if nsfw_check['nsfw_type']:
                    result['statistics']['by_type'][
                        nsfw_check['nsfw_type']] += 1

        logger.info(
            f"NSFW detection complete: {result['statistics']['nsfw_count']}/{len(image_files)} frames flagged")

        return result


# Синглтон
_nsfw_tools_instance = None


def get_nsfw_tools(model_path: str = None) -> NSFWTools:
    """Возвращает синглтон NSFW-детектора."""
    global _nsfw_tools_instance
    if _nsfw_tools_instance is None:
        _nsfw_tools_instance = NSFWTools(model_path)
    return _nsfw_tools_instance


def get_nsfw_frames(folder_path: str) -> List[str]:
    """Возвращает список имен файлов с NSFW-контентом."""
    tools = get_nsfw_tools()
    result = tools.get_nsfw_frames(folder_path)
    return result.get('nsfw_frames', [])