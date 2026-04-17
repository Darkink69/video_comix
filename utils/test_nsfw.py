import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from utils.nsfw_detector import get_nsfw_tools

# Инициализируем детектор
tools = get_nsfw_tools()
print(f"NSFW available: {tools.is_available}")

if tools.is_available:
    # Если есть тестовое изображение
    test_img = "sovet2_002.jpg"
    if os.path.exists(test_img):
        result = tools.predict_single(test_img)
        print(f"Predictions: {result}")
        nsfw_check = tools.is_nsfw(result)
        print(f"Is NSFW: {nsfw_check}")
    else:
        print("Тестовое изображение не найдено")