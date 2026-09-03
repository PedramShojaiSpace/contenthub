from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

INPUT_DIR = Path("/tmp/meta-active-creative-thumbnails")
OUTPUT_PATH = Path("/tmp/meta-active-creative-contact-sheet.jpg")
THUMB_W = 220
THUMB_H = 220
LABEL_H = 34
COLUMNS = 5
PADDING = 12

files = sorted([*INPUT_DIR.glob("*.jpg"), *INPUT_DIR.glob("*.png")])
rows = (len(files) + COLUMNS - 1) // COLUMNS
canvas = Image.new("RGB", (
    COLUMNS * (THUMB_W + PADDING) + PADDING,
    rows * (THUMB_H + LABEL_H + PADDING) + PADDING,
), "#f5f5f5")
draw = ImageDraw.Draw(canvas)
font = ImageFont.load_default()

for index, path in enumerate(files):
    image = Image.open(path).convert("RGB")
    image.thumbnail((THUMB_W, THUMB_H))
    x = PADDING + (index % COLUMNS) * (THUMB_W + PADDING)
    y = PADDING + (index // COLUMNS) * (THUMB_H + LABEL_H + PADDING)
    frame = Image.new("RGB", (THUMB_W, THUMB_H), "#ffffff")
    frame.paste(image, ((THUMB_W - image.width) // 2, (THUMB_H - image.height) // 2))
    canvas.paste(frame, (x, y))
    label = path.stem.split("-ad-")[0]
    draw.rectangle((x, y + THUMB_H, x + THUMB_W, y + THUMB_H + LABEL_H), fill="#132c1c")
    draw.text((x + 8, y + THUMB_H + 10), f"#{label}", fill="#ffffff", font=font)

canvas.save(OUTPUT_PATH, quality=88)
print(OUTPUT_PATH)
