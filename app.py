import os
import json
import shutil
import logging
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

from config import UPLOAD_FOLDER, PROCESSED_FOLDER, ALLOWED_EXTENSIONS
from utils.video_processor import VideoProcessor

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='frontend/dist', static_url_path='')
CORS(app)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['PROCESSED_FOLDER'] = PROCESSED_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024 * 1024  # 10 ГБ

# Хранилище активных процессоров
active_processors = {}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[
        1].lower() in ALLOWED_EXTENSIONS


def resolve_file_path(file_path: str) -> str:
    """Определяет полный путь к файлу."""
    file_path = file_path.strip()

    if os.path.isabs(file_path) or '/' in file_path or '\\' in file_path:
        if os.path.exists(file_path):
            return file_path
        raise FileNotFoundError(f"File not found: {file_path}")
    else:
        full_path = os.path.join(UPLOAD_FOLDER, file_path)
        if os.path.exists(full_path):
            return full_path
        raise FileNotFoundError(f"File not found in uploads: {file_path}")


def cleanup_finished_processors():
    """Удаляет завершенные процессоры из active_processors."""
    to_remove = []
    for name, processor in active_processors.items():
        if not processor.is_alive():
            to_remove.append(name)
            logger.info(f"Removing finished processor: {name}")

    for name in to_remove:
        del active_processors[name]


# ============ API ============

@app.route('/api/process', methods=['POST'])
def process_video():
    """Запускает обработку видео."""
    data = request.get_json()
    logger.info(f"Process request: {data}")

    if not data or 'path' not in data:
        return jsonify({'error': 'No path provided'}), 400

    raw_path = data['path'].strip()
    interval = int(data.get('interval', 10))
    options = data.get('options', {})

    # Опции по умолчанию
    default_options = {
        'detect_faces': False,
        'detect_people': False,
        'describe_frame': False,
        'nsfw': False
    }
    default_options.update(options)

    try:
        file_path = resolve_file_path(raw_path)

        if not allowed_file(file_path):
            return jsonify({'error': f'File type not allowed'}), 400

        filename = os.path.basename(file_path)
        video_name = os.path.splitext(filename)[0]

        cleanup_finished_processors()

        if video_name in active_processors:
            processor = active_processors[video_name]
            if processor.is_alive():
                return jsonify({
                    'status': 'already_processing',
                    'video_name': video_name,
                }), 200
            else:
                del active_processors[video_name]

        processor = VideoProcessor(
            input_path=file_path,
            output_base_dir=PROCESSED_FOLDER,
            video_name=video_name,
            options=default_options
        )

        processor.process_async(interval=interval)
        active_processors[video_name] = processor

        logger.info(
            f"Started processing: {video_name} with options: {default_options}")

        return jsonify({
            'status': 'processing',
            'video_name': video_name,
            'source_path': file_path,
            'interval': interval,
            'options': default_options,
            'message': f'Started processing {filename}'
        }), 200

    except Exception as e:
        logger.error(f"Process error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/stop/<video_name>', methods=['POST'])
def stop_processing(video_name):
    """Останавливает обработку видео."""
    logger.info(f"Stop request for: {video_name}")

    # Проверяем активные процессоры
    if video_name in active_processors:
        processor = active_processors[video_name]
        processor.stop()
        logger.info(f"Stopped processor for: {video_name}")
        return jsonify({'status': 'stopped', 'video_name': video_name}), 200

    # Если процессор не найден, пробуем обновить JSON
    json_path = os.path.join(PROCESSED_FOLDER, video_name, f'{video_name}.json')
    if os.path.exists(json_path):
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                metadata = json.load(f)

            if metadata.get('processing'):
                metadata['processing'] = False
                metadata['stopped_by_user'] = True
                metadata['total_frames'] = len(metadata.get('frames', []))

                with open(json_path, 'w', encoding='utf-8') as f:
                    json.dump(metadata, f, indent=2, ensure_ascii=False)

                logger.info(f"Marked as stopped in JSON: {video_name}")
                return jsonify(
                    {'status': 'marked_stopped', 'video_name': video_name}), 200
        except Exception as e:
            logger.error(f"Error updating JSON: {e}")
            return jsonify({'error': str(e)}), 500

    return jsonify({'error': 'Video not found'}), 404


@app.route('/api/videos', methods=['GET'])
def list_videos():
    """Возвращает список всех видео."""
    cleanup_finished_processors()

    videos = []

    if os.path.exists(PROCESSED_FOLDER):
        for folder in os.listdir(PROCESSED_FOLDER):
            folder_path = os.path.join(PROCESSED_FOLDER, folder)
            json_file = os.path.join(folder_path, f'{folder}.json')

            if os.path.isdir(folder_path) and os.path.exists(json_file):
                try:
                    with open(json_file, 'r', encoding='utf-8') as f:
                        data = json.load(f)

                    # Актуальный статус обработки
                    is_processing = folder in active_processors
                    if is_processing:
                        processor = active_processors[folder]
                        is_processing = processor.is_alive()
                        if not is_processing:
                            del active_processors[folder]

                    # Синхронизируем processing в JSON с реальным статусом
                    if data.get('processing') != is_processing:
                        data['processing'] = is_processing

                    created_at = None
                    if os.path.exists(folder_path):
                        created_timestamp = os.path.getctime(folder_path)
                        created_at = datetime.fromtimestamp(
                            created_timestamp).isoformat()

                    processed_at = None
                    if not is_processing and os.path.exists(json_file):
                        modified_timestamp = os.path.getmtime(json_file)
                        processed_at = datetime.fromtimestamp(
                            modified_timestamp).isoformat()

                    # Получаем статистику
                    statistics = data.get('statistics', {})

                    videos.append({
                        'name': folder,
                        'source_path': data.get('source_path', ''),
                        'source_file': data.get('source_file', ''),
                        'duration_seconds': data.get('duration_seconds', 0),
                        'duration_formatted': data.get('duration_formatted',
                                                       '0:00:00'),
                        'total_frames': data.get('total_frames', 0),
                        'total_frames_estimated': data.get(
                            'total_frames_estimated', 0),
                        'frames_processed': data.get('frames_processed', 0),
                        'processed': data.get('processed', False),
                        'processing': is_processing,
                        'stopped_by_user': data.get('stopped_by_user', False),
                        'frames_interval': data.get('frames_interval', 10),
                        'created_at': created_at,
                        'processed_at': processed_at,
                        'statistics': {
                            'total_faces_detected': statistics.get(
                                'total_faces_detected', 0),
                            'total_nsfw_detected': statistics.get(
                                'total_nsfw_detected', 0)
                        }
                    })
                except Exception as e:
                    logger.error(f"Error reading {json_file}: {e}")

    # Сортируем: активные первыми, затем по времени обработки
    videos.sort(key=lambda x: (
        not x['processing'],
        x.get('processed_at') or x.get('created_at') or ''
    ), reverse=True)

    return jsonify(videos)


@app.route('/api/videos/<video_name>', methods=['GET'])
def get_video_details(video_name):
    """Возвращает детали видео."""
    json_file = os.path.join(PROCESSED_FOLDER, video_name, f'{video_name}.json')

    if not os.path.exists(json_file):
        return jsonify({'error': 'Video not found'}), 404

    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Актуальный статус
        is_processing = video_name in active_processors
        if is_processing:
            processor = active_processors[video_name]
            is_processing = processor.is_alive()

        data['is_processing'] = is_processing
        data['processor_status'] = active_processors[
            video_name].get_status() if video_name in active_processors else None

        return jsonify(data)
    except Exception as e:
        logger.error(f"Error reading video details: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/videos/<video_name>', methods=['DELETE'])
def delete_video(video_name):
    """Удаляет видео."""
    logger.info(f"Delete request for: {video_name}")

    if video_name in active_processors:
        active_processors[video_name].stop()
        del active_processors[video_name]

    video_folder = os.path.join(PROCESSED_FOLDER, video_name)

    if os.path.exists(video_folder):
        shutil.rmtree(video_folder)
        logger.info(f"Deleted: {video_name}")
        return jsonify({'status': 'deleted', 'video_name': video_name}), 200

    return jsonify({'error': 'Video not found'}), 404


@app.route('/api/frames/<video_name>/<filename>')
def serve_frame(video_name, filename):
    """Отдает кадр."""
    frames_dir = os.path.join(PROCESSED_FOLDER, video_name, 'frames')
    return send_from_directory(frames_dir, filename)


@app.route('/api/upload', methods=['POST'])
def upload_file():
    """Загружает файл."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'File type not allowed'}), 400

    filename = secure_filename(file.filename)
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(file_path)

    logger.info(f"Uploaded: {filename}")

    return jsonify({
        'status': 'uploaded',
        'filename': filename,
        'path': file_path
    }), 200


@app.route('/api/status', methods=['GET'])
def get_status():
    """Возвращает статус сервера."""
    cleanup_finished_processors()
    return jsonify({
        'active_processors': len(active_processors),
        'processors': {name: p.get_status() for name, p in
                       active_processors.items()}
    })


# ============ Статика ============

@app.route('/')
@app.route('/<path:path>')
def serve_react(path=''):
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')


if __name__ == '__main__':
    logger.info(f"Upload folder: {UPLOAD_FOLDER}")
    logger.info(f"Processed folder: {PROCESSED_FOLDER}")
    app.run(debug=True, host='0.0.0.0', port=5000)