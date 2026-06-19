# Urban Monk QR Code Generator — Skill

## What This Does

Generates a **branded QR code** with the Urban Monk icon (circle/monk/infinity symbol) embedded at center. Used to embed scannable QR codes into merchandise designs that route to landing pages.

## When to Use

- A new merchandise design needs a QR code
- You need a standalone QR PNG for testing/scanning
- You need a print-ready 300 DPI QR for Printful or another printer

---

## Quick Start (One Command)

```bash
cd /home/ubuntu/lights-on-optin/skills/qr-generator

python3 urban_monk_qr_generator.py \
  --url "https://upstream.theurbanmonk.com/YOUR-DESIGN-SLUG" \
  --output "/home/ubuntu/qr_YOUR-DESIGN-SLUG.png"
```

**That's it.** The output is a 2400×2400px PNG at 300 DPI — ready for Printful.

---

## Required Setup (First Time Only)

```bash
sudo pip3 install qrcode[pil] pillow
```

---

## Parameters

| Flag | Default | Description |
|---|---|---|
| `--url` | `https://theurbanmonk.com/web-of-life` | URL the QR encodes |
| `--output` | `/home/ubuntu/urban_monk_qr.png` | Output file path |
| `--size` | `2400` | Pixel size (2400 = 8" @ 300 DPI) |
| `--icon` | `./urban_monk_icon.png` | Path to the Urban Monk icon |

---

## Technical Specs

- **Error Correction Level H** (30%) — required because the icon covers ~20% of the QR area
- **Output size:** 2400×2400px = 8"×8" at 300 DPI — Printful-ready
- **Icon:** centered in a white circle with subtle drop shadow
- **Colors:** near-black modules (`#1a1a1a`) on white background

---

## Embedding Into a Design

To embed the QR subtly into an existing t-shirt design (low opacity, positioned as one of the circular nodes):

```bash
python3 embed_qr_final_url.py
```

Edit the paths at the top of `embed_qr_final_url.py` to point to your design file and desired output.

---

## Files in This Skill

| File | Purpose |
|---|---|
| `urban_monk_qr_generator.py` | Main QR generator — run this for new designs |
| `embed_qr_final_url.py` | Embeds QR into an existing design at low opacity |
| `embed_qr_smaller.py` | Smaller embed variant (10% of design width) |
| `prepare_printful.py` | Converts output to Printful spec (4500×4500px, sRGB, transparent bg) |
| `urban_monk_icon.png` | The Urban Monk icon used at QR center |

---

## URL Convention

All merchandise QR codes should point to:
```
https://upstream.theurbanmonk.com/{design-slug}
```

The landing page at that URL is built in the Content Hub under the `/weboflife` route pattern.

---

## Existing QR Codes

| Design | URL | QR File |
|---|---|---|
| Web of Life t-shirt | `https://upstream.theurbanmonk.com/weboflife` | `qr_weboflife_FINAL_test.png` in server/assets |
