from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUTPUT = Path("/home/ubuntu/webdev-static-assets")
OUTPUT.mkdir(parents=True, exist_ok=True)

W, H = 1080, 1350
BG = "#0d241d"
PANEL = "#17372d"
GOLD = "#d3b06d"
CREAM = "#f6f0e4"
MUTED = "#c6d0c4"
ACCENT = "#4f826b"

CARDS = [
    ("tantra_card_divorce.jpg", "BEFORE A BIG DECISION", "A thoughtful video about stress, connection,\nand finding a way back to each other."),
    ("tantra_card_king_queen.jpg", "THE KING & THE QUEEN", "A grounded Taoist lens on partnership,\npresence, and the shared energy of home."),
    ("tantra_card_flower.jpg", "THE ROOTS OF CLOSENESS", "A whole-system conversation about\nwellbeing, attention, and connection."),
    ("tantra_card_why_he.jpg", "START WITH CURIOSITY", "A broader conversation about energy,\nconfidence, and closeness."),
    ("tantra_card_love_bank.jpg", "THE LOVE BANK", "Small daily deposits of warmth, attention,\nand goodwill help life feel more resilient."),
    ("tantra_card_why_she.jpg", "MAKE ROOM FOR CONNECTION", "A more compassionate conversation about\nstress, transitions, and returning to each other."),
    ("tantra_card_female_orgasm.jpg", "A BETTER LANGUAGE FOR CLOSENESS", "Attention, communication, mutual care,\nand a willingness to learn together."),
]


def font(size: int, bold: bool = False):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def centered_multiline(draw, text, y, fnt, fill, spacing=12):
    bbox = draw.multiline_textbbox((0, 0), text, font=fnt, spacing=spacing, align="center")
    width = bbox[2] - bbox[0]
    draw.multiline_text(((W - width) / 2, y), text, font=fnt, fill=fill, spacing=spacing, align="center")


for filename, title, subtitle in CARDS:
    image = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(image)

    # Geometric, non-suggestive visual texture.
    draw.ellipse((720, -170, 1240, 350), outline=ACCENT, width=4)
    draw.ellipse((785, -105, 1175, 285), outline="#2e5d4c", width=2)
    draw.arc((90, 830, 990, 1680), 190, 340, fill=ACCENT, width=5)
    draw.arc((150, 900, 930, 1620), 198, 332, fill="#2e5d4c", width=2)
    draw.rounded_rectangle((72, 94, 1008, 1256), radius=30, outline="#335e4f", width=2, fill=PANEL)

    draw.rectangle((132, 174, 310, 180), fill=GOLD)
    centered_multiline(draw, "THE URBAN MONK", 150, font(26, True), GOLD)
    centered_multiline(draw, "RELATIONSHIP EDUCATION", 202, font(18, True), MUTED)

    centered_multiline(draw, title, 470, font(58, True), CREAM, spacing=14)
    centered_multiline(draw, subtitle, 690, font(32), MUTED, spacing=18)

    draw.rounded_rectangle((350, 1054, 730, 1130), radius=38, outline=GOLD, width=2)
    centered_multiline(draw, "WATCH THE SHORT VIDEO", 1076, font(20, True), GOLD)

    image.save(OUTPUT / filename, quality=94, optimize=True)

print(f"Generated {len(CARDS)} verified static ad cards in {OUTPUT}")
