"""Compose the Loop repository social preview in a cyberpunk neon style."""

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent / "social-preview.png"
S = 2
W, H = 1280, 640
FONT = ROOT / "website/public/fonts/montserrat-latin-wght-normal.woff2"
ICON = ROOT / "packages/web-ui/src/docs/assets/loop-brand/png/loop-mark-white-1024.png"

NIGHT = (3, 4, 11)
DEEP = (30, 36, 74)
CYAN = (0, 238, 255)
MAGENTA = (244, 62, 178)
VIOLET = (138, 92, 255)
HOT = (255, 240, 255)
INK = (238, 243, 255)

rng = random.Random(21)


def font(size, weight=500):
    face = ImageFont.truetype(str(FONT), round(size * S))
    face.set_variation_by_axes([weight])
    return face


def blank():
    return Image.new("RGBA", (W * S, H * S), NIGHT + (255,))


def backdrop():
    """Radial field anchored at the top-left corner: darkest there, lifting outward."""
    max_r = math.hypot(W * S, H * S)
    ramp = Image.new("L", (W * S, H * S), 0)
    px = ramp.load()
    for y in range(H * S):
        dy = y * y
        for x in range(W * S):
            t = math.sqrt(x * x + dy) / max_r
            px[x, y] = int(255 * (min(1.0, t * 1.06) ** 1.25))
    ramp = ramp.filter(ImageFilter.GaussianBlur(40 * S))

    dark = Image.new("RGBA", (W * S, H * S), NIGHT + (255,))
    lit = Image.new("RGBA", (W * S, H * S), DEEP + (255,))
    return Image.composite(lit, dark, ramp)


def neon_line(layer, pts, color, width, alpha=255):
    """Draw a stroked path into a layer for later bloom."""
    d = ImageDraw.Draw(layer)
    d.line(pts, fill=color + (alpha,), width=round(width * S), joint="curve")


def bloom(layer, radius, strength=1.0):
    """Multi-pass gaussian bloom, the core of the neon look."""
    out = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    for r, w in ((radius * 0.5, 0.55), (radius * 1.6, 0.30), (radius * 3.4, 0.15)):
        blurred = layer.filter(ImageFilter.GaussianBlur(r * S))
        a = blurred.getchannel("A").point(lambda v, w=w: int(v * w * strength))
        blurred.putalpha(a)
        out = Image.alpha_composite(out, blurred)
    return Image.alpha_composite(out, layer)


def iso_box(layer, cx, cy, w, h, color, alpha=170, width=1.3):
    """Axonometric wireframe volume."""
    ax, ay = w * 0.86, w * 0.5
    top = [(cx, cy), (cx + ax, cy + ay), (cx, cy + ay * 2), (cx - ax, cy + ay)]
    d = ImageDraw.Draw(layer)
    for pts, a in [
        ([top[0], top[1]], 1.0), ([top[1], top[2]], 0.72),
        ([top[2], top[3]], 1.0), ([top[3], top[0]], 0.72),
    ]:
        d.line(pts, fill=color + (int(alpha * a),), width=round(width * S))
    for bx, by in (top[2], top[3], top[1]):
        d.line([(bx, by), (bx, by + h)], fill=color + (int(alpha * 0.6),), width=round(width * S))
    d.line([(top[2][0], top[2][1] + h), (top[3][0], top[3][1] + h)],
           fill=color + (int(alpha * 0.5),), width=round(width * S))
    d.line([(top[2][0], top[2][1] + h), (top[1][0], top[1][1] + h)],
           fill=color + (int(alpha * 0.5),), width=round(width * S))


def spiral(cx, cy, r, turns, steps=900):
    pts = []
    for i in range(steps + 1):
        t = i / steps
        ang = -math.pi / 2 + t * turns * 2 * math.pi
        rad = r * (0.40 + 0.60 * t)
        pts.append((cx + math.cos(ang) * rad, cy + math.sin(ang) * rad * 0.88))
    return pts


base = backdrop()

# ---- geometry: one cyan wireframe massing on the right ----
geom = Image.new("RGBA", base.size, (0, 0, 0, 0))
iso_box(geom, 886 * S, 196 * S, 104 * S, 196 * S, CYAN, alpha=158)
iso_box(geom, 1068 * S, 342 * S, 78 * S, 146 * S, CYAN, alpha=120)
iso_box(geom, 800 * S, 432 * S, 68 * S, 124 * S, CYAN, alpha=104)
d = ImageDraw.Draw(geom)
d.rectangle((916 * S, 152 * S, 1148 * S, 490 * S), outline=CYAN + (112,), width=round(1.4 * S))
base = Image.alpha_composite(base, bloom(geom, 4, 0.8))

# ---- the loop: one neon spiral, the only hero stroke ----
hero = Image.new("RGBA", base.size, (0, 0, 0, 0))
pts = spiral(970 * S, 320 * S, 186 * S, 1.55)
d = ImageDraw.Draw(hero)
for i in range(len(pts) - 1):
    t = i / (len(pts) - 1)
    col = tuple(int(MAGENTA[c] + (CYAN[c] - MAGENTA[c]) * t) for c in range(3))
    d.line([pts[i], pts[i + 1]], fill=col + (255,), width=round((2.0 + 2.2 * t) * S), joint="curve")
base = Image.alpha_composite(base, bloom(hero, 7, 1.1))

# ---- brand: untouched icon and wordmark, aligned on one horizontal axis ----
ICON_SIZE = 64
ICON_X, ICON_Y = 120, 148
TEXT_SIZE, TEXT_WEIGHT = 74, 700
TEXT_X = ICON_X + ICON_SIZE + 18

with Image.open(ICON) as src:
    icon = src.convert("RGBA")
mark = icon.crop(icon.getbbox())
mark = mark.resize((ICON_SIZE * S, ICON_SIZE * S), Image.Resampling.LANCZOS)
base.alpha_composite(mark, (ICON_X * S, ICON_Y * S))

face = font(TEXT_SIZE, TEXT_WEIGHT)

# render the word into a scratch tile to measure its true ink box, then centre it
probe = Image.new("L", (TEXT_SIZE * 6 * S, TEXT_SIZE * 3 * S), 0)
ImageDraw.Draw(probe).text((TEXT_SIZE * S, TEXT_SIZE * S), "Loop", font=face, fill=255, anchor="lt")
ink_box = probe.getbbox()
ink_w = ink_box[2] - ink_box[0]
ink_h = ink_box[3] - ink_box[1]
ink = probe.crop(ink_box)
tinted = Image.new("RGBA", (ink_w, ink_h), INK + (255,))
tinted.putalpha(ink)

axis_y = (ICON_Y + ICON_SIZE / 2) * S
base.alpha_composite(tinted, (TEXT_X * S, round(axis_y - ink_h / 2)))

out = base.convert("RGB").resize((W, H), Image.Resampling.LANCZOS)
out.save(OUT, optimize=True)
print(f"{OUT.name}: {W}x{H}, {OUT.stat().st_size:,} bytes")
