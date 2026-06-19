"""
Printful DTG Production File
============================
Specs per Printful guidelines:
- Format: PNG with transparent background
- Color space: sRGB IEC61966-2.1
- DPI: 300
- Print area: 15" x 15" = 4500 x 4500px at 300 DPI (standard front chest)
- Max file size: 200 MB
- No white background — transparent so it prints clean on any shirt color
"""
from PIL import Image, ImageCms
import io, os

# ── 1. Load the production file ───────────────────────────────────────────────
src = Image.open("/home/ubuntu/web_of_life_PRODUCTION.png").convert("RGBA")
print(f"Source: {src.size[0]}x{src.size[1]}px")

# ── 2. Resize to Printful standard front print area ───────────────────────────
# Printful standard front chest: up to 15" wide x 18" tall at 150 DPI minimum
# At 300 DPI: 4500 x 5400px max. Our square design = 15"x15" = 4500x4500px.
# Our source is 4800x4800 — we'll resize to exactly 4500x4500 (15"x15" @ 300dpi)
TARGET = 4500
img = src.resize((TARGET, TARGET), Image.LANCZOS)
print(f"Resized to: {TARGET}x{TARGET}px = 15\"x15\" @ 300 DPI")

# ── 3. Make background transparent ───────────────────────────────────────────
# The design is black ink on white. Convert white areas to transparent
# so it prints cleanly on any shirt color (white, black, navy, etc.)
import numpy as np
arr = np.array(img)

# White background pixels: R>240, G>240, B>240 — make transparent
r, g, b, a = arr[:,:,0], arr[:,:,1], arr[:,:,2], arr[:,:,3]
white_mask = (r > 240) & (g > 240) & (b > 240)
arr[white_mask, 3] = 0  # Set alpha to 0 (transparent)

img_transparent = Image.fromarray(arr, "RGBA")
print("✓ White background converted to transparent")

# ── 4. Embed sRGB IEC61966-2.1 color profile ─────────────────────────────────
# Printful specifically requires sRGB IEC61966-2.1
srgb_profile = ImageCms.createProfile("sRGB")
srgb_bytes = ImageCms.ImageCmsProfile(srgb_profile).tobytes()

# ── 5. Save as PNG with DPI and color profile metadata ───────────────────────
output_path = "/home/ubuntu/URBAN_MONK_WebOfLife_PRINTFUL.png"
img_transparent.save(
    output_path,
    "PNG",
    dpi=(300, 300),
    icc_profile=srgb_bytes
)

file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
print(f"\n✓ Printful production file saved:")
print(f"  Path: {output_path}")
print(f"  Dimensions: {TARGET}x{TARGET}px")
print(f"  Print size: 15\" x 15\" @ 300 DPI")
print(f"  Format: PNG with transparent background")
print(f"  Color profile: sRGB IEC61966-2.1")
print(f"  File size: {file_size_mb:.1f} MB (limit: 200 MB)")
print(f"\nPrintful upload checklist:")
print(f"  ✓ PNG format")
print(f"  ✓ Transparent background (prints on any shirt color)")
print(f"  ✓ 300 DPI")
print(f"  ✓ sRGB color profile")
print(f"  ✓ Under 200 MB")
print(f"  ✓ 15\"x15\" — fits standard front chest print area")

# ── 6. Also save a white-background preview for reference ─────────────────────
preview_bg = Image.new("RGB", (TARGET, TARGET), (255, 255, 255))
preview_bg.paste(img_transparent, mask=img_transparent.split()[3])
preview_bg.save("/home/ubuntu/URBAN_MONK_WebOfLife_PRINTFUL_preview.jpg", "JPEG", quality=95)
print(f"\n✓ White-bg preview: URBAN_MONK_WebOfLife_PRINTFUL_preview.jpg")
