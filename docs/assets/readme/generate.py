"""Export the standalone README terminal with Pillow; never runs its commands."""

import argparse
import math
from pathlib import Path
import random
import re

from PIL import Image
from PIL import ImageDraw
from PIL import ImageFilter
from PIL import ImageFont


ROOT = Path(__file__).resolve().parents[3]
OUTPUT = Path(__file__).resolve().parent
SCALE = 2
STEP_MS = 40
COMMANDS = [
    "npx @loop-harness/loop web",
    "npx @loop-harness/loop --provider deepseek --model deepseek-v4-pro",
    'const { session } = await createAgentSession({ model });\n'
    'await session.prompt("Hello Loop!");',
]
TOKEN_PATTERN = re.compile(
    r'("[^"]*")|(--[a-z-]+)|(\bnpx\b)|(\b(?:const|await)\b)|'
    r'(\b(?:createAgentSession|prompt)\b)|(\bmodel\b)'
)
THEMES = {
    "light": {
        "page": "#ffffff", "text": "#1f2328",
        "body": "#ffffff", "border": "#c8c8ce", "separator": "#d5d5d8",
        "bar_top": "#fafafa", "bar_bottom": "#ededee", "blue": "#316de0",
        "tokens": ["#0a3069", "#0550ae", "#167739", "#cf222e", "#8250df", "#0550ae"],
    },
    "dark": {
        "page": "#0d1117", "text": "#f0f3f6",
        "body": "#17171b", "border": "#444449", "separator": "#404045",
        "bar_top": "#323236", "bar_bottom": "#29292d", "blue": "#78a8ff",
        "tokens": ["#a5d6ff", "#79c0ff", "#7ee787", "#ff7b72", "#d2a8ff", "#79c0ff"],
    },
}


def rgb(value):
    return tuple(bytes.fromhex(value.removeprefix("#")))


def create_artwork(theme, mono_path):
    width, height = 464, 158
    image = Image.new("RGB", (width * SCALE, height * SCALE), theme["page"])
    mono = ImageFont.truetype(mono_path, 12 * SCALE)
    try:
        mono.set_variation_by_name("Regular")
    except (OSError, ValueError):
        pass
    x, y, terminal_width = 12, 8, 440
    box = tuple(v * SCALE for v in (x, y, x + terminal_width, y + 134))
    shadow = Image.new("RGBA", image.size)
    ImageDraw.Draw(shadow).rounded_rectangle(
        (box[0], box[1] + 6 * SCALE, box[2], box[3] + 6 * SCALE),
        radius=10 * SCALE, fill=(0, 0, 0, 24),
    )
    image = Image.alpha_composite(
        image.convert("RGBA"), shadow.filter(ImageFilter.GaussianBlur(6 * SCALE))
    )
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(
        box, radius=10 * SCALE, fill=theme["body"], outline=theme["border"], width=SCALE
    )
    bar = Image.new("RGBA", image.size)
    bar_draw = ImageDraw.Draw(bar)
    start, end = rgb(theme["bar_top"]), rgb(theme["bar_bottom"])
    for row in range(24 * SCALE):
        color = tuple(round(a + (b - a) * row / (24 * SCALE)) for a, b in zip(start, end))
        bar_draw.line((box[0], box[1] + row, box[2], box[1] + row), fill=color)
    mask = Image.new("L", image.size)
    ImageDraw.Draw(mask).rounded_rectangle(box, radius=10 * SCALE, fill=255)
    bar_mask = Image.composite(bar.getchannel("A"), Image.new("L", image.size), mask)
    image = Image.composite(bar, image, bar_mask)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(box, radius=10 * SCALE, outline=theme["border"], width=SCALE)
    draw.line(
        (box[0], (y + 24) * SCALE, box[2], (y + 24) * SCALE),
        fill=theme["separator"], width=SCALE,
    )
    for index, color in enumerate(["#ff5f57", "#febc2e", "#28c840"]):
        dot_x, dot_y = (x + 12 + 17 * index) * SCALE, (y + 7) * SCALE
        draw.ellipse((dot_x, dot_y, dot_x + 10 * SCALE, dot_y + 10 * SCALE), fill=color)
    prompt_x, text_y = (x + 14) * SCALE, (y + 43) * SCALE
    draw.text((prompt_x, text_y + 12 * SCALE), ">", font=mono, fill=theme["blue"], anchor="ls")
    text_x = prompt_x + draw.textlength(">", font=mono) + 8 * SCALE
    text_box = (
        round(text_x), text_y - 16 * SCALE, (terminal_width - 45) * SCALE, 88 * SCALE
    )
    return image.convert("RGB"), mono, text_box


def render_code(value, font, size, theme):
    layer = Image.new("RGBA", size)
    draw = ImageDraw.Draw(layer)
    colors = [theme["text"]] * len(value)
    for match in TOKEN_PATTERN.finditer(value):
        color = theme["tokens"][next(i for i, group in enumerate(match.groups()) if group)]
        colors[match.start():match.end()] = [color] * len(match[0])
    x, y = 0.0, 16 * SCALE
    advance = draw.textlength("M", font=font) - 0.55 * SCALE
    index = 0
    for token in re.findall(r"\n|[^\S\n]+|[^\s]+", value):
        if token != "\n" and not token.isspace() and x + len(token) * advance > size[0]:
            x, y = 0.0, y + round(19.2 * SCALE)
        for character in token:
            if character == "\n":
                x, y = 0.0, y + round(19.2 * SCALE)
            else:
                if x + advance > size[0]:
                    x, y = 0.0, y + round(19.2 * SCALE)
                # A shared baseline keeps typing and dissolution aligned.
                draw.text(
                    (round(x), y + 12 * SCALE), character,
                    font=font, fill=colors[index], anchor="ls",
                )
                x += advance
            index += 1
    return layer, (round(x), y)


def make_particles(layer):
    rng = random.Random(17)
    pixels = layer.load()
    particles = []
    for y in range(0, layer.height, 2):
        for x in range(0, layer.width, 2):
            r, g, b, alpha = pixels[x, y]
            if alpha < 32:
                continue
            particles.append((
                x, y, r, g, b, alpha, (1 - x / layer.width) * 0.36,
                (42 + rng.random() * 100) * SCALE,
                (-20 - rng.random() * 62) * SCALE,
                (rng.random() - 0.5) * 32 * SCALE,
            ))
    return particles


def dissolve(layer, particles, progress):
    result = Image.new("RGBA", layer.size)
    edge = max(0, round(layer.width * (1 - progress / 0.36)))
    if edge:
        result.paste(layer.crop((0, 0, edge, layer.height)), (0, 0))
    draw = ImageDraw.Draw(result)
    for x, y, r, g, b, alpha, delay, dx, dy, sway in particles:
        if progress <= delay:
            continue
        age = min(1, (progress - delay) / 0.65)
        if age >= 1:
            continue
        gray = (r + g + b) / 3
        color = tuple(round(c + (gray - c) * age) for c in (r, g, b))
        px = x + dx * age * age
        py = y + dy * age + math.sin(age * 5) * sway * age
        # Moving particles begin at the clipping edge. Text is never blurred.
        draw.rectangle(
            (round(px), round(py), round(px) + 1, round(py) + 1),
            fill=(*color, round(alpha * (1 - age))),
        )
    return result


def export(theme_name, mono_path):
    theme = THEMES[theme_name]
    base, font, (x, y, width, height) = create_artwork(theme, mono_path)
    size = (width, height)
    full_layers = [render_code(command, font, size, theme)[0] for command in COMMANDS]
    # Learn a single palette from the actual artwork and syntax colors, avoiding flicker.
    palette_sheet = Image.new("RGB", (base.width, base.height * 4))
    palette_sheet.paste(base, (0, 0))
    for index, layer in enumerate(full_layers):
        sample = base.copy()
        sample.paste(layer, (x, y), layer)
        palette_sheet.paste(sample, (0, base.height * (index + 1)))
    palette = palette_sheet.quantize(colors=224, method=Image.Quantize.MEDIANCUT)
    frames, durations = [], []

    def append(layer, cursor=None, duration=STEP_MS):
        image = base.copy()
        image.paste(layer, (x, y), layer)
        if cursor is not None:
            cx, cy = cursor
            ImageDraw.Draw(image).rectangle(
                (x + cx + 3 * SCALE, y + cy, x + cx + 9 * SCALE, y + cy + 15 * SCALE),
                fill=theme["blue"],
            )
        frames.append(image.quantize(palette=palette, dither=Image.Dither.NONE))
        durations.append(duration)

    for command, layer in zip(COMMANDS, full_layers):
        empty, cursor = render_code("", font, size, theme)
        append(empty, cursor, 240)
        for length in range(1, len(command) + 1):
            typed, cursor = render_code(command[:length], font, size, theme)
            append(typed, cursor, 180 if command[length - 1] == "\n" else STEP_MS)
        for tick in range(4):
            append(layer, cursor if tick % 2 == 0 else None, 450)
        particles = make_particles(layer)
        for elapsed in range(0, 1781, STEP_MS):
            append(dissolve(layer, particles, elapsed / 1700))
        append(empty, duration=220)
    path = OUTPUT / f"terminal-{theme_name}.gif"
    frames[0].save(
        path, save_all=True, append_images=frames[1:], duration=durations,
        loop=0, optimize=True, disposal=1,
    )
    still = base.copy()
    still.paste(full_layers[0], (x, y), full_layers[0])
    still.save(OUTPUT / f"terminal-{theme_name}.png", optimize=True)
    print(
        f"{path.relative_to(ROOT)}: {len(frames)} frames, "
        f"{sum(durations)} ms, {path.stat().st_size:,} bytes"
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--mono-font", required=True, type=Path,
        help="Local monospaced TTF or OTF font; the font is not copied",
    )
    parser.add_argument("--theme", choices=["light", "dark", "all"], default="all")
    args = parser.parse_args()
    themes = THEMES if args.theme == "all" else [args.theme]
    for theme in themes:
        export(theme, args.mono_font)


if __name__ == "__main__":
    main()
