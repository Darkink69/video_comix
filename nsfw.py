from nsfw_detector import predict
import json
import codecs

path_folder = 'views'


def get_nsfw_frames(path_folder):

    # model = predict.load_model('./mobilenet_v2')
    model = predict.load_model('./mobilenet_v2_140_224')
    result = predict.classify(model, path_folder)

    # print(predict.classify(model, '1.jpg'))

    porn = 0.6
    sexy = 0.15
    hentai = 0.5
    results_nsfw_all = []

    for key in result.items():
        if key[1]['porn'] > porn or key[1]['sexy'] > sexy or key[1]['hentai'] > hentai and key[1]['drawings'] < 0.2:
            # results_nsfw = {}
            # results_nsfw['file'] = key[0].split('\\')[-1]
            # results_nsfw['porn'] = key[1]['porn']
            # results_nsfw['sexy'] = key[1]['sexy']
            # results_nsfw['hentai'] = key[1]['hentai']
            # results_nsfw['neutral'] = key[1]['neutral']
            # results_nsfw_all.append(results_nsfw)
            results_nsfw_all.append(key[0].split('\\')[-1])

    print('Found', len(results_nsfw_all), 'suss nsfw')
    print(results_nsfw_all)
    print(result)
    return results_nsfw_all




get_nsfw_frames(path_folder)


# Predict single image
# print(predict.classify(model, '1.jpg'))

# # Predict multiple images at once
# result = predict.classify(model, ['./out/1.png', './out/2.jpg'])
# # {'2.jpg': {'sexy': 4.3454795e-05, 'neutral': 0.00026579312, 'porn': 0.0007733498, 'hentai': 0.14751942, 'drawings': 0.8513979}, '6.jpg': {'drawings': 0.004214506, 'hentai': 0.013342537, 'neutral': 0.01834045, 'porn': 0.4431829, 'sexy': 0.5209196}}
#
