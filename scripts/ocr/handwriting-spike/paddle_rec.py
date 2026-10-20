# PP-OCRv5 recognition only, on the same value crops. Writes {file: [text, score]}.
import json, sys, time
from paddleocr import TextRecognition
model_name, crops_files, out = sys.argv[1], sys.argv[2].split(","), sys.argv[3]
rec = TextRecognition(model_name=model_name)
res = {}
for cf in crops_files:
    for c in json.load(open(cf)):
        t = time.time()
        r = rec.predict("/w/" + c["file"])[0]
        res[c["file"]] = [r["rec_text"], float(r["rec_score"]), round((time.time() - t) * 1000)]
json.dump(res, open(out, "w"), indent=1)
print(model_name, len(res))
