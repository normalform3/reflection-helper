#!/usr/bin/env python3
"""Generate a 1024x1024 app icon for Reflection Helper."""
from PIL import Image, ImageDraw
import math, os, struct

SIZE = 1024
PAD = int(SIZE * 0.06)
RADIUS = int(SIZE * 0.22)

# -- rounded-rect mask --
mask = Image.new("L", (SIZE, SIZE), 0)
ImageDraw.Draw(mask).rounded_rectangle(
    [PAD, PAD, SIZE - PAD, SIZE - PAD], radius=RADIUS, fill=255
)

# -- gradient (fast: build 1px-wide column, scale to full width) --
c1 = (61, 127, 111)   # daily teal
c2 = (109, 106, 168)  # monthly purple

col = Image.new("RGBA", (1, SIZE))
for y in range(SIZE):
    t = y / SIZE
    r = int(c1[0] + (c2[0] - c1[0]) * t)
    g = int(c1[1] + (c2[1] - c1[1]) * t)
    b = int(c1[2] + (c2[2] - c1[2]) * t)
    col.putpixel((0, y), (r, g, b, 255))

img = col.resize((SIZE, SIZE), Image.BILINEAR)
img.putalpha(mask)

# -- draw stylized pen / quill --
draw = ImageDraw.Draw(img)

def bezier(p0, p1, p2, p3, steps=120):
    pts = []
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        x = u**3*p0[0] + 3*u**2*t*p1[0] + 3*u*t**2*p2[0] + t**3*p3[0]
        y = u**3*p0[1] + 3*u**2*t*p1[1] + 3*u*t**2*p2[1] + t**3*p3[1]
        pts.append((int(x), int(y)))
    return pts

s = SIZE
p_nib = (s * 0.28, s * 0.74)
p_end = (s * 0.72, s * 0.26)

left_pts = bezier(p_nib, (s*0.34, s*0.52), (s*0.52, s*0.36), p_end)
right_pts = bezier(
    (p_nib[0]+14, p_nib[1]-6),
    (s*0.40, s*0.56),
    (s*0.58, s*0.40),
    (p_end[0]-8, p_end[1]+14)
)

poly = left_pts + list(reversed(right_pts))
draw.polygon(poly, fill=(255, 255, 255, 210))

nib_pts = [
    (int(p_nib[0] - 18), int(p_nib[1] + 18)),
    (int(p_nib[0] + 24), int(p_nib[1] - 8)),
    (int(p_nib[0] - 8), int(p_nib[1] - 24)),
]
draw.polygon(nib_pts, fill=(255, 255, 255, 240))

for i, frac in enumerate([0.35, 0.50, 0.65, 0.78]):
    mid_x = int(p_nib[0] + (p_end[0]-p_nib[0]) * frac)
    mid_y = int(p_nib[1] + (p_end[1]-p_nib[1]) * frac)
    angle = math.radians(130 + i * 5)
    length = 48 - i * 6
    bx = mid_x + int(math.cos(angle) * length)
    by = mid_y + int(math.sin(angle) * length)
    draw.line([(mid_x, mid_y), (bx, by)], fill=(255, 255, 255, 100), width=3)

# -- writing wave line --
wave_points = []
wave_y_base = int(s * 0.78)
for x_px in range(int(s * 0.22), int(s * 0.78)):
    t = (x_px - s * 0.22) / (s * 0.56)
    y_px = wave_y_base + int(math.sin(t * math.pi * 2.5) * 14)
    wave_points.append((x_px, y_px))

for i in range(len(wave_points) - 1):
    t = i / len(wave_points)
    alpha = max(60, int(200 * math.sin(t * math.pi)))
    draw.line(
        [wave_points[i], wave_points[i+1]],
        fill=(255, 255, 255, alpha),
        width=6
    )

# -- final mask cleanup --
img.putalpha(mask)

# -- save iconset --
script_dir = os.path.dirname(os.path.abspath(__file__))
mac_dir = os.path.join(script_dir, "..", "mac")
out_dir = os.path.join(mac_dir, "AppIcon.iconset")
os.makedirs(out_dir, exist_ok=True)

sizes = [16, 32, 64, 128, 256, 512, 1024]
for sz in sizes:
    resized = img.resize((sz, sz), Image.LANCZOS)
    resized.save(os.path.join(out_dir, f"icon_{sz}x{sz}.png"))
    if sz * 2 <= 1024:
        resized2x = img.resize((sz * 2, sz * 2), Image.LANCZOS)
        resized2x.save(os.path.join(out_dir, f"icon_{sz}x{sz}@2x.png"))

img.save(os.path.join(mac_dir, "icon-1024.png"))
print(f"Icon generated: {out_dir}")
