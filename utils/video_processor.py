import os
import json
import subprocess
import re
import time
from datetime import timedelta
from threading import Thread, Event
import logging
from typing import Dict, List, Optional, Tuple, Any
from utils.nsfw_detector import get_nsfw_tools, NSFWTools

logger = logging.getLogger(__name__)


class VideoProcessor:
    def __init__(self, input_path, output_base_dir, video_name, options=None):
        self.input_path = input_path
        self.video_name = video_name
        self.output_dir = os.path.join(output_base_dir, video_name)
        self.frames_dir = os.path.join(self.output_dir, 'frames')
        self.json_path = os.path.join(self.output_dir, f'{video_name}.json')
        self.stop_event = Event()
        self.ffmpeg_process = None
        self._thread = None  # Добавлено
        self._completed = False
        self._error = None

        # Опции обработки
        self.options = options or {
            'detect_faces': False,
            'detect_people': False,
            'describe_frame': False,
            'nsfw': False
        }

        # Детекторы
        self._face_detector = None
        self._nsfw_tools = None

        os.makedirs(self.frames_dir, exist_ok=True)
        logger.info(
            f"[{video_name}] Processor initialized with options: {self.options}")

    @property
    def face_detector(self):
        """Ленивая инициализация детектора лиц."""
        if self._face_detector is None and self.options.get('detect_faces'):
            from utils.face_detector import get_face_detector
            self._face_detector = get_face_detector()
        return self._face_detector

    def get_duration(self):
        """Получает продолжительность видео."""
        cmd = [
            'ffprobe', '-v', 'error', '-show_entries',
            'format=duration', '-of',
            'default=noprint_wrappers=1:nokey=1', self.input_path
        ]

        try:
            result = subprocess.run(cmd, capture_output=True, text=True,
                                    timeout=30)
            if result.returncode == 0 and result.stdout.strip():
                return float(result.stdout.strip())
        except Exception as e:
            logger.error(f"[{self.video_name}] Error getting duration: {e}")

        return 0.0

    @property
    def nsfw_tools(self):
        """Ленивая инициализация NSFW-детектора."""
        if self._nsfw_tools is None and self.options.get('nsfw'):
            self._nsfw_tools = get_nsfw_tools()
        return self._nsfw_tools

    def detect_nsfw_on_frame(self, frame_path: str) -> Dict[str, Any]:
        """Определяет NSFW на одном кадре."""
        if not self.nsfw_tools:
            return {'is_nsfw': False, 'nsfw_type': None, 'nsfw_score': 0.0,
                    'predictions': {}}

        predictions = self.nsfw_tools.predict_single(frame_path)
        nsfw_check = self.nsfw_tools.is_nsfw(predictions)

        return {
            'is_nsfw': nsfw_check['is_nsfw'],
            'nsfw_type': nsfw_check['nsfw_type'],
            'nsfw_score': nsfw_check['nsfw_score'],
            'predictions': predictions
        }

    def detect_nsfw_on_folder(self) -> Dict[str, Any]:
        """Анализирует все кадры в папке на NSFW."""
        if not self.nsfw_tools:
            return {'frames': {}, 'nsfw_frames': [], 'statistics': {}}

        return self.nsfw_tools.get_nsfw_frames(self.frames_dir)

    def create_initial_metadata(self, interval=10):
        """Создает начальный JSON."""
        duration = self.get_duration()
        total_frames_estimated = int(
            duration / interval) + 1 if duration > 0 else 0

        metadata = {
            'video_name': self.video_name,
            'source_path': self.input_path,
            'source_file': os.path.basename(self.input_path),
            'duration_seconds': duration,
            'duration_formatted': str(timedelta(seconds=duration)),
            'processed': False,
            'processing': True,
            'frames_interval': interval,
            'total_frames_estimated': total_frames_estimated,
            'frames_processed': 0,
            'frames': [],
            'options': self.options,
            'statistics': {
                'total_faces_detected': 0
            }
        }

        self._write_json(metadata)
        return metadata

    def _write_json(self, data):
        """Безопасная запись JSON."""
        try:
            temp_path = self.json_path + '.tmp'
            with open(temp_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            os.replace(temp_path, self.json_path)
        except Exception as e:
            logger.error(f"[{self.video_name}] Error writing JSON: {e}")

    def _read_json(self):
        """Безопасное чтение JSON."""
        if not os.path.exists(self.json_path):
            return None
        try:
            with open(self.json_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"[{self.video_name}] Error reading JSON: {e}")
            return None

    def scan_existing_frames(self):
        """Возвращает список существующих кадров."""
        if not os.path.exists(self.frames_dir):
            return []
        return sorted(
            [f for f in os.listdir(self.frames_dir) if f.endswith('.jpg')])

    def detect_faces_on_frame(self, frame_path: str) -> Dict[str, Any]:
        """Определяет лица на одном кадре."""
        if not self.face_detector:
            return {'faces_count': 0, 'faces': [],
                    'error': 'Face detector not initialized'}

        return self.face_detector.detect_faces(frame_path)

    def update_metadata(self, interval):
        """Обновляет JSON с текущими кадрами и распознаванием."""
        metadata = self._read_json()
        if not metadata:
            return

        frame_files = self.scan_existing_frames()
        existing_filenames = {f['filename'] for f in metadata['frames']}

        total_faces = 0
        changed = False

        for filename in frame_files:
            frame_path = os.path.join(self.frames_dir, filename)

            if filename not in existing_filenames:
                match = re.search(r'_(\d+)\.jpg$', filename)
                if match:
                    frame_num = int(match.group(1))
                    seconds = (frame_num - 1) * interval

                    frame_data = {
                        'id': frame_num,
                        'filename': filename,
                        'time_seconds': seconds,
                        'time_formatted': str(timedelta(seconds=seconds))
                    }

                    # Распознавание лиц
                    if self.options.get('detect_faces'):
                        face_result = self.detect_faces_on_frame(frame_path)
                        frame_data['face_detection'] = face_result
                        frame_data['faces_count'] = face_result.get(
                            'faces_count', 0)

                    # NSFW детекция
                    if self.options.get('nsfw'):
                        nsfw_result = self.detect_nsfw_on_frame(frame_path)
                        frame_data['nsfw_detection'] = nsfw_result

                    metadata['frames'].append(frame_data)
                    changed = True

        if changed:
            metadata['frames'].sort(key=lambda x: x['id'])
            metadata['frames_processed'] = len(metadata['frames'])

            # Пересчитываем общее количество лиц
            total_faces = sum(
                f.get('faces_count', 0) for f in metadata['frames'])

            if 'statistics' not in metadata:
                metadata['statistics'] = {}
            metadata['statistics']['total_faces_detected'] = total_faces

            self._write_json(metadata)
            logger.debug(
                f"[{self.video_name}] Metadata updated: {len(metadata['frames'])} frames, {total_faces} faces")

    def mark_completed(self):
        """Отмечает обработку как завершенную."""
        metadata = self._read_json()
        if not metadata:
            return

        metadata['processed'] = True
        metadata['processing'] = False
        metadata['total_frames'] = len(metadata['frames'])
        metadata.pop('total_frames_estimated', None)

        # Подсчитываем статистику NSFW
        total_nsfw = 0
        for frame in metadata['frames']:
            if frame.get('nsfw_detection', {}).get('is_nsfw'):
                total_nsfw += 1

        # Обновляем статистику
        if 'statistics' not in metadata:
            metadata['statistics'] = {}
        metadata['statistics']['total_nsfw_detected'] = total_nsfw

        self._write_json(metadata)
        self._completed = True
        logger.info(
            f"[{self.video_name}] Marked as completed. Faces: {metadata['statistics'].get('total_faces_detected', 0)}, NSFW: {total_nsfw}")

    def mark_stopped(self):
        """Отмечает обработку как остановленную."""
        metadata = self._read_json()
        if not metadata:
            return

        metadata['processed'] = False
        metadata['processing'] = False
        metadata['stopped_by_user'] = True
        metadata['total_frames'] = len(metadata['frames'])

        self._write_json(metadata)
        logger.info(f"[{self.video_name}] Marked as stopped")

    def mark_error(self, error_msg):
        """Отмечает обработку как ошибочную."""
        metadata = self._read_json()
        if not metadata:
            return

        metadata['processed'] = False
        metadata['processing'] = False
        metadata['error'] = error_msg
        metadata['total_frames'] = len(metadata['frames'])

        self._write_json(metadata)
        self._error = error_msg
        logger.error(f"[{self.video_name}] Marked as error: {error_msg}")

    def extract_frames(self, interval=10):
        """Извлекает кадры из видео."""
        output_pattern = os.path.join(self.frames_dir,
                                      f'{self.video_name}_%03d.jpg')

        cmd = [
            'ffmpeg', '-i', self.input_path,
            '-vf', f'fps=1/{interval}',
            '-q:v', '2',
            '-y',
            '-loglevel', 'error',
            output_pattern
        ]

        logger.info(f"[{self.video_name}] Starting ffmpeg")

        try:
            self.ffmpeg_process = subprocess.Popen(
                cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                text=True
            )

            last_update = time.time()

            while self.ffmpeg_process.poll() is None:
                if self.stop_event.is_set():
                    logger.info(f"[{self.video_name}] Stop requested")
                    self.ffmpeg_process.terminate()
                    try:
                        self.ffmpeg_process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        self.ffmpeg_process.kill()
                    break

                if time.time() - last_update >= 1:
                    self.update_metadata(interval)
                    last_update = time.time()

                time.sleep(0.5)

            if self.ffmpeg_process.returncode != 0 and not self.stop_event.is_set():
                stderr = self.ffmpeg_process.stderr.read()
                raise Exception(f"FFmpeg error: {stderr[:200]}")

        except FileNotFoundError:
            raise Exception("FFmpeg not found")

        self.update_metadata(interval)

        if self.stop_event.is_set():
            self.mark_stopped()
        else:
            self.mark_completed()

        logger.info(
            f"[{self.video_name}] Completed. Frames: {len(self.scan_existing_frames())}")

    def process_async(self, interval=10):
        """
        Запускает асинхронную обработку видео.
        Возвращает поток, в котором выполняется обработка.
        """
        logger.info(f"[{self.video_name}] Starting async processing with interval {interval}")
        self._thread = Thread(target=self._run_async, args=(interval,))
        self._thread.daemon = True
        self._thread.start()
        return self._thread

    def process(self, interval=10):
        """
        Синхронная обработка видео (для обратной совместимости).
        """
        logger.info(f"[{self.video_name}] Starting sync processing")
        self.create_initial_metadata(interval)
        self.extract_frames(interval)
        return self.json_path

    def is_alive(self):
        """Проверяет, выполняется ли обработка."""
        return self._thread is not None and self._thread.is_alive()

    def _run_async(self, interval):
        """Внутренний метод для запуска в потоке."""
        try:
            self.create_initial_metadata(interval)
            self.extract_frames(interval)
        except Exception as e:
            logger.error(f"[{self.video_name}] Async error: {e}")
            import traceback
            traceback.print_exc()
            self.mark_error(str(e))

    def detect_nsfw_on_frame(self, frame_path: str) -> Dict[str, Any]:
        """Определяет NSFW на одном кадре."""
        if not self.nsfw_tools or not self.nsfw_tools.is_available:
            return {
                'is_nsfw': False,
                'nsfw_type': None,
                'nsfw_score': 0.0,
                'predictions': {},
                'available': False
            }

        predictions = self.nsfw_tools.predict_single(frame_path)
        nsfw_check = self.nsfw_tools.is_nsfw(predictions)

        return {
            'is_nsfw': nsfw_check['is_nsfw'],
            'nsfw_type': nsfw_check['nsfw_type'],
            'nsfw_score': nsfw_check['nsfw_score'],
            'predictions': predictions,
            'available': True
        }