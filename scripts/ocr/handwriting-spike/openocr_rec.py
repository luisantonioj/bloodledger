# OpenOCR recognition on the same value crops. Writes {file: [text, score, ms]}.
import json, sys, time
from openocr import OpenOCR
task, mode, backend, crops_files, out = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4].split(","), sys.argv[5]
if task == "unirec":
    model = OpenOCR(task="unirec")
else:
    model = OpenOCR(task="rec", mode=mode, backend=backend) if backend != "default" else OpenOCR(task="rec", mode=mode)
res = {}
for cf in crops_files:
    for c in json.load(open(cf)):
        t = time.time()
        if task == "unirec":
            text, _ = model(image_path="/w/" + c["file"], max_length=64)
            res[c["file"]] = [str(text).strip(), 1.0, round((time.time() - t) * 1000)]
        else:
            r = model(image_path="/w/" + c["file"])
            r0 = r[0] if isinstance(r, list) and r else {}
            res[c["file"]] = [r0.get("text", ""), float(r0.get("score", 0)), round((time.time() - t) * 1000)]
json.dump(res, open(out, "w"), indent=1)
print(task, mode, backend, len(res))
