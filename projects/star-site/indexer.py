from colorthief import ColorThief
from pathlib import Path
from PIL import Image
import pandas as pd

def to_hex(rgb):
    return "#%02x%02x%02x" % rgb

rows = []


inDir = "bgs"
outJSON = "bgs.json"

for i, path in enumerate(Path(inDir).iterdir(), start=1):
    # if i > 2:
    #     continue
    
    if path.suffix.lower() not in [".jpeg",".jpg"]:
        continue
    
    if i % 100 == 0:
        print(i)

    try:

        dominant = ColorThief(path).get_color(quality=2)
        

        with Image.open(path) as img:
            exif = img._getexif() or {}
            rgb = img.convert("RGB")
            avg = rgb.resize((1, 1), resample=Image.Resampling.BOX).getpixel((0, 0))

        raw_date = exif.get(36867)
        if raw_date is None:
            print(f"{path} has no date, skipping")
            # raw_date = "2026:04:09 19:00:40"
            continue

        dt = pd.to_datetime(raw_date, format="%Y:%m:%d %H:%M:%S")

        rows.append({
            "Path": str(path),
            "Avg": to_hex(avg),
            "Dominant": to_hex(dominant),
            "DateTime": dt,
            "Date": dt.date(),
            "Time": dt.time(),
        })
    except:
        print("skipping",i)

df = pd.DataFrame(rows, columns=["Path", "Avg", "Dominant", "DateTime", "Date", "Time"])
df.to_json(outJSON, orient="records", date_format="iso")