"""
Urban Monk Branded QR Code Generator
=====================================
Generates a high-resolution QR code with the Urban Monk icon
embedded at the center. The QR code uses error correction level H
(30% of data can be obscured) so the icon overlay remains scannable.

Usage:
    python3 urban_monk_qr_generator.py --url "https://theurbanmonk.com/web-of-life" --output "qr_web_of_life.png"

Or import and call generate_branded_qr() directly.
"""

import argparse
import os
from PIL import Image, ImageDraw, ImageFilter, ImageOps
import qrcode
from qrcode.constants import ERROR_CORRECT_H


def generate_branded_qr(
    url: str,
    output_path: str,
    icon_path: str = "/home/ubuntu/urban_monk_icon.png",
    qr_size: int = 2400,          # Final output size in pixels (2400px = 8" @ 300dpi)
    icon_ratio: float = 0.22,     # Icon takes up 22% of QR width — max safe with H correction
    qr_color: str = "#1a1a1a",    # Near-black for the QR modules
    bg_color: str = "#ffffff",    # White background
    border_modules: int = 2,      # QR quiet zone border
    icon_padding: int = 18,       # White padding ring around icon
    icon_shadow: bool = True,     # Subtle shadow under icon for separation
) -> Image.Image:
    """
    Generate a branded QR code with the Urban Monk icon at center.
    Returns a PIL Image object and saves to output_path.
    """

    # --- 1. Generate the raw QR code ---
    qr = qrcode.QRCode(
        version=None,               # Auto-select version
        error_correction=ERROR_CORRECT_H,  # 30% error correction — allows icon overlay
        box_size=10,
        border=border_modules,
    )
    qr.add_data(url)
    qr.make(fit=True)

    # Create QR image at large internal size, then resize
    qr_img = qr.make_image(
        fill_color=qr_color,
        back_color=bg_color
    ).convert("RGBA")

    # Resize to target output size
    qr_img = qr_img.resize((qr_size, qr_size), Image.NEAREST)

    # --- 2. Prepare the icon ---
    icon_orig = Image.open(icon_path).convert("RGBA")

    # The icon is black-on-white with no true transparency — make white transparent
    icon_arr = icon_orig.load()
    w_i, h_i = icon_orig.size
    for y in range(h_i):
        for x in range(w_i):
            r, g, b, a = icon_arr[x, y]
            # Make near-white pixels transparent
            if r > 220 and g > 220 and b > 220:
                icon_orig.putpixel((x, y), (255, 255, 255, 0))

    # Target icon size
    icon_target = int(qr_size * icon_ratio)
    icon_resized = icon_orig.resize((icon_target, icon_target), Image.LANCZOS)

    # --- 3. Create white backing circle with padding ---
    backing_size = icon_target + (icon_padding * 2)
    backing = Image.new("RGBA", (backing_size, backing_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(backing)

    # Draw white filled circle
    draw.ellipse(
        [0, 0, backing_size - 1, backing_size - 1],
        fill=(255, 255, 255, 255)
    )

    # Optional: subtle shadow ring
    if icon_shadow:
        shadow = Image.new("RGBA", (backing_size + 20, backing_size + 20), (0, 0, 0, 0))
        shadow_draw = ImageDraw.Draw(shadow)
        shadow_draw.ellipse([10, 10, backing_size + 9, backing_size + 9],
                             fill=(0, 0, 0, 60))
        shadow = shadow.filter(ImageFilter.GaussianBlur(radius=8))
        # Paste shadow onto QR first
        sx = (qr_size - backing_size - 20) // 2
        sy = (qr_size - backing_size - 20) // 2
        qr_img.paste(shadow, (sx, sy), shadow)

    # Paste icon onto backing circle
    icon_x = icon_padding
    icon_y = icon_padding
    backing.paste(icon_resized, (icon_x, icon_y), icon_resized)

    # --- 4. Composite backing + icon onto QR ---
    center_x = (qr_size - backing_size) // 2
    center_y = (qr_size - backing_size) // 2
    qr_img.paste(backing, (center_x, center_y), backing)

    # --- 5. Convert to RGB and save ---
    final = Image.new("RGB", (qr_size, qr_size), (255, 255, 255))
    final.paste(qr_img, mask=qr_img.split()[3])
    final.save(output_path, "PNG", dpi=(300, 300))

    print(f"✓ QR code saved: {output_path}")
    print(f"  URL: {url}")
    print(f"  Size: {qr_size}x{qr_size}px @ 300 DPI ({qr_size/300:.1f}\" x {qr_size/300:.1f}\")")
    print(f"  Error correction: H (30%) — scannable with icon overlay")

    return final


def generate_subtle_embed(
    design_path: str,
    qr_img: Image.Image,
    output_path: str,
    embed_size_ratio: float = 0.12,   # QR takes 12% of design width — subtle but scannable
    position: str = "bottom-right",   # Where to place it
    opacity: float = 0.18,            # Very faint — only visible if you know it's there
) -> Image.Image:
    """
    Subtly embed a QR code into a t-shirt design at low opacity.
    The QR is faint enough to be invisible at a glance but scannable
    by a phone camera when the wearer points it out.
    """
    design = Image.open(design_path).convert("RGBA")
    dw, dh = design.size

    # Scale QR to embed size
    embed_w = int(dw * embed_size_ratio)
    embed_h = embed_w
    qr_small = qr_img.resize((embed_w, embed_h), Image.LANCZOS).convert("RGBA")

    # Apply opacity
    r, g, b, a = qr_small.split()
    a = a.point(lambda x: int(x * opacity))
    qr_small = Image.merge("RGBA", (r, g, b, a))

    # Position
    padding = int(dw * 0.04)
    if position == "bottom-right":
        x = dw - embed_w - padding
        y = dh - embed_h - padding
    elif position == "bottom-left":
        x = padding
        y = dh - embed_h - padding
    elif position == "bottom-center":
        x = (dw - embed_w) // 2
        y = dh - embed_h - padding
    elif position == "center":
        x = (dw - embed_w) // 2
        y = (dh - embed_h) // 2
    else:
        x = dw - embed_w - padding
        y = dh - embed_h - padding

    design.paste(qr_small, (x, y), qr_small)

    final = Image.new("RGB", design.size, (255, 255, 255))
    final.paste(design, mask=design.split()[3])
    final.save(output_path, "PNG", dpi=(300, 300))

    print(f"✓ Embedded QR saved: {output_path}")
    print(f"  QR size in design: {embed_w}x{embed_h}px ({embed_size_ratio*100:.0f}% of design width)")
    print(f"  Opacity: {opacity*100:.0f}% — subtle, discoverable on close inspection")

    return final


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Urban Monk Branded QR Code Generator")
    parser.add_argument("--url", default="https://theurbanmonk.com/web-of-life",
                        help="URL the QR code should point to")
    parser.add_argument("--output", default="/home/ubuntu/urban_monk_qr.png",
                        help="Output file path")
    parser.add_argument("--size", type=int, default=2400,
                        help="QR code size in pixels (default 2400 = 8\" @ 300dpi)")
    parser.add_argument("--icon", default="/home/ubuntu/urban_monk_icon.png",
                        help="Path to Urban Monk icon PNG")
    args = parser.parse_args()

    generate_branded_qr(
        url=args.url,
        output_path=args.output,
        icon_path=args.icon,
        qr_size=args.size,
    )
