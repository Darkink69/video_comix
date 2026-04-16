import os

# Базовые пути
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
UPLOAD_FOLDER = os.path.join(DATA_DIR, 'uploads')
PROCESSED_FOLDER = os.path.join(DATA_DIR, 'processed')

# Создаем папки при импорте
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PROCESSED_FOLDER, exist_ok=True)

# Разрешенные расширения видеофайлов
ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov', 'mkv', 'flv', 'webm','MP4', 'AVI', 'MOV', 'MKV', 'FLV'}