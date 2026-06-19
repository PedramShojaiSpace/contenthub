"""
Final production version with correct URL: upstream.theurbanmonk.com/weboflife
Same specs as the approved small version (box_size=8, border=4, H correction).
"""
from PIL import Image, ImageDraw
import numpy as np
import qrcode
from qrcode.constants import ERROR_CORRECT_H

URL = "https://upstream.theurbanmonk.com/weboflife"

# ── 1. Generate QR ────────────────────────────────────────────────────────────
qr = qrcode.QRCode(
    version=None,
    error_correction=ERROR_CORRECT_H,
    box_size=8,
    border=4,
)
qr.add_data(URL)
qr.make(fit=True)
qr_img = qr.make_image(fill_color="#111111", back_color="white").convert("RGB")
qw, qh = qr_img.size
print(f"QR: {qw}x{qh}px | version={qr.version} | modules={qr.modules_count}")

# ── 2. Rounded-square node ────────────────────────────────────────────────────
PADDING = 18
NODE_SIZE = qw + PADDING * 2
CORNER_R = int(NODE_SIZE * 0.18)
print(f"Node: {NODE_SIZE}x{NODE_SIZE}px")

node = Image.new("RGB", (NODE_SIZE, NODE_SIZE), (255, 255, 255))
node.paste(qr_img, (PADDING, PADDING))

mask = Image.new("L", (NODE_SIZE, NODE_SIZE), 0)
ImageDraw.Draw(mask).rounded_rectangle(
    [0, 0, NODE_SIZE-1, NODE_SIZE-1], radius=CORNER_R, fill=255
)
node_rgba = node.convert("RGBA")
node_rgba.putalpha(mask)

border_layer = Image.new("RGBA", (NODE_SIZE, NODE_SIZE), (0, 0, 0, 0))
ImageDraw.Draw(border_layer).rounded_rectangle(
    [2, 2, NODE_SIZE-3, NODE_SIZE-3],
    radius=CORNER_R, outline=(20, 20, 20, 255), width=8
)
node_rgba = Image.alpha_composite(node_rgba, border_layer)

# ── 3. Urban Monk icon at center ──────────────────────────────────────────────
icon = Image.open("/home/ubuntu/urban_monk_icon.png").convert("RGBA")
icon_arr = np.array(icon)
white_px = (icon_arr[:,:,0] > 220) & (icon_arr[:,:,1] > 220) & (icon_arr[:,:,2] > 220)
icon_arr[white_px, 3] = 0
icon = Image.fromarray(icon_arr)

icon_size = int(qw * 0.20)
icon_r = icon.resize((icon_size, icon_size), Image.LANCZOS)

br = icon_size // 2 + 7
backing = Image.new("RGBA", (br*2, br*2), (0,0,0,0))
ImageDraw.Draw(backing).ellipse([0,0,br*2-1,br*2-1], fill=(255,255,255,255))
boff = (br*2 - icon_size) // 2
backing.paste(icon_r, (boff, boff), icon_r)
nx = (NODE_SIZE - br*2) // 2
node_rgba.paste(backing, (nx, nx), backing)

# ── 4. Standalone test ────────────────────────────────────────────────────────
test = Image.new("RGB", (NODE_SIZE, NODE_SIZE), (255, 255, 255))
test.paste(node_rgba, mask=node_rgba.split()[3])
test.save("/home/ubuntu/qr_weboflife_FINAL_test.png", "PNG")
print(f"✓ Standalone test: qr_weboflife_FINAL_test.png")
print(f"  URL encoded: {URL}")

# ── 5. Composite into 4800px design ──────────────────────────────────────────
design = Image.open("/home/ubuntu/web_clean_2.png").convert("RGBA")
design = design.resize((4800, 4800), Image.LANCZOS)

cx, cy = 3848, 1760

erase_r = NODE_SIZE // 2 + 40
erase_mask = Image.new("L", (erase_r*2, erase_r*2), 0)
ImageDraw.Draw(erase_mask).ellipse([0,0,erase_r*2-1,erase_r*2-1], fill=255)
white_patch = Image.new("RGBA", (erase_r*2, erase_r*2), (255,255,255,255))
design.paste(white_patch, (cx-erase_r, cy-erase_r), erase_mask)

px = cx - NODE_SIZE // 2
py = cy - NODE_SIZE // 2
design.paste(node_rgba, (px, py), node_rgba)

final = Image.new("RGB", (4800, 4800), (255, 255, 255))
final.paste(design, mask=design.split()[3])

# Print-ready
final.save("/home/ubuntu/web_of_life_PRODUCTION.png", "PNG", dpi=(300, 300))
print("✓ Print-ready: web_of_life_PRODUCTION.png (4800x4800 @ 300dpi)")

# Preview
preview = final.resize((1600, 1600), Image.LANCZOS)
preview.save("/home/ubuntu/web_of_life_PRODUCTION_preview.jpg", "JPEG", quality=92)
print("✓ Preview: web_of_life_PRODUCTION_preview.jpg")

# Zoom
crop_r = 500
crop = final.crop((cx-crop_r, cy-crop_r, cx+crop_r, cy+crop_r))
crop.save("/home/ubuntu/web_of_life_PRODUCTION_zoom.jpg", "JPEG", quality=95)
print("✓ Zoom: web_of_life_PRODUCTION_zoom.jpg")
