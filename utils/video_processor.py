import os
import json
import subprocess
import re
import time
from datetime import timedelta
from threading import Thread, Event
import logging

logger = logging.getLogger(__name__)


class VideoProcessor:
    def __init__(self, input_path, output_base_dir, video_name):
        self.input_path = input_path
        self.video_name = video_name
        self.output_dir = os.path.join(output_base_dir, video_name)
        self.frames_dir = os.path.join(self.output_dir, 'frames')
        self.json_path = os.path.join(self.output_dir, f'{video_name}.json')
        self.stop_event = Event()
        self.ffmpeg_process = None
        self._thread = None
        self._completed = False
        self._error = None

        os.makedirs(self.frames_dir, exist_ok=True)
        logger.info(f"[{video_name}] Processor initialized")

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
                duration = float(result.stdout.strip())
                logger.info(f"[{self.video_name}] Duration: {duration}s")
                return duration
        except Exception as e:
            logger.error(f"[{self.video_name}] Error getting duration: {e}")

        return 0.0

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
            'frames': []
        }

        self._write_json(metadata)
        logger.info(f"[{self.video_name}] Initial metadata created")
        return metadata

    def _write_json(self, data):
        """Безопасная запись JSON."""
        try:
            # Сначала пишем во временный файл
            temp_path = self.json_path + '.tmp'
            with open(temp_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            # Затем атомарно заменяем
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
        frames = sorted(
            [f for f in os.listdir(self.frames_dir) if f.endswith('.jpg')])
        logger.debug(f"[{self.video_name}] Found {len(frames)} frames")
        return frames

    def update_metadata(self, interval):
        """Обновляет JSON с текущими кадрами."""
        metadata = self._read_json()
        if not metadata:
            return

        frame_files = self.scan_existing_frames()
        existing_filenames = {f['filename'] for f in metadata['frames']}

        changed = False
        for filename in frame_files:
            if filename not in existing_filenames:
                match = re.search(r'_(\d+)\.jpg$', filename)
                if match:
                    frame_num = int(match.group(1))
                    seconds = (frame_num - 1) * interval

                    metadata['frames'].append({
                        'id': frame_num,
                        'filename': filename,
                        'time_seconds': seconds,
                        'time_formatted': str(timedelta(seconds=seconds))
                    })
                    changed = True

        if changed:
            metadata['frames'].sort(key=lambda x: x['id'])
            metadata['frames_processed'] = len(metadata['frames'])
            self._write_json(metadata)
            logger.debug(
                f"[{self.video_name}] Metadata updated: {len(metadata['frames'])} frames")

    def mark_completed(self):
        """Отмечает обработку как завершенную."""
        metadata = self._read_json()
        if not metadata:
            return

        metadata['processed'] = True
        metadata['processing'] = False
        metadata['total_frames'] = len(metadata['frames'])
        metadata.pop('total_frames_estimated', None)

        self._write_json(metadata)
        self._completed = True
        logger.info(f"[{self.video_name}] Marked as completed")

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
        logger.info(f"[{self.video_name}] Marked as stopped by user")

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
            '-loglevel', 'error',  # Только ошибки
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
                    logger.info(
                        f"[{self.video_name}] Stop requested, terminating ffmpeg")
                    self.ffmpeg_process.terminate()
                    try:
                        self.ffmpeg_process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        self.ffmpeg_process.kill()
                    break

                # Обновляем метаданные каждую секунду
                if time.time() - last_update >= 1:
                    self.update_metadata(interval)
                    last_update = time.time()

                time.sleep(0.5)

            # Проверяем результат
            if self.ffmpeg_process.returncode != 0 and not self.stop_event.is_set():
                stderr = self.ffmpeg_process.stderr.read()
                error_msg = f"FFmpeg error: {stderr[:200]}"
                logger.error(f"[{self.video_name}] {error_msg}")
                raise Exception(error_msg)

        except FileNotFoundError:
            raise Exception("FFmpeg not found. Please install ffmpeg.")

        # Финальное обновление
        self.update_metadata(interval)

        if self.stop_event.is_set():
            self.mark_stopped()
        else:
            self.mark_completed()

        frames_count = len(self.scan_existing_frames())
        logger.info(f"[{self.video_name}] Completed. Frames: {frames_count}")

    def _run_async(self, interval):
        """Внутренний метод для запуска в потоке."""
        try:
            self.create_initial_metadata(interval)
            self.extract_frames(interval)
        except Exception as e:
            logger.error(f"[{self.video_name}] Async error: {e}")
            self.mark_error(str(e))

    def process_async(self, interval=10):
        """Запускает асинхронную обработку."""
        logger.info(f"[{self.video_name}] Starting async processing")
        self._thread = Thread(target=self._run_async, args=(interval,))
        self._thread.daemon = True
        self._thread.start()
        return self._thread

    def stop(self):
        """Останавливает обработку."""
        logger.info(f"[{self.video_name}] Stop called")
        self.stop_event.set()

    def is_alive(self):
        """Проверяет, выполняется ли обработка."""
        if self._thread:
            return self._thread.is_alive()
        return False

    def get_status(self):
        """Возвращает статус процессора."""
        return {
            'video_name': self.video_name,
            'is_alive': self.is_alive(),
            'completed': self._completed,
            'error': self._error,
            'frames_count': len(self.scan_existing_frames())
        }