#!/usr/bin/env python3
"""Web-sized copies of everything in public/uploads.

For every image it writes WebP copies at a few widths into public/uploads/_web/,
and for every video a still from its first second (also as WebP copies), so the
site never has to download a full-size original just to show a thumbnail.

It also writes public/content/media.json with each file's width and height and
which copies exist. The site reads that to lay out the grid before anything loads.

Safe to run again: copies that already exist are kept, and only new or changed
uploads are processed. Needs Pillow (and ffmpeg/ffprobe for videos).
"""
import json
import os
import subprocess
import sys
import tempfile

from PIL import Image, ImageOps

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public")
UPLOADS = os.path.join(ROOT, "uploads")
WEB = os.path.join(UPLOADS, "_web")
MANIFEST = os.path.join(ROOT, "content", "media.json")
WIDTHS = [480, 960, 1600, 2400]
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".avif"}
VIDEO_EXT = {".mp4", ".mov", ".m4v", ".webm"}
QUALITY = 82


def variants(img, base, mtime):
    """Write WebP copies of an image at each width below its own; return the widths."""
    img = ImageOps.exif_transpose(img)
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA" if "A" in img.getbands() or img.mode == "P" else "RGB")
    w, h = img.size
    sizes = [x for x in WIDTHS if x < w] or []
    if w <= WIDTHS[-1]:
        sizes.append(w)              # the original width too, so the largest copy is never upscaled
    out = []
    for x in sorted(set(sizes)):
        path = os.path.join(WEB, f"{base}-{x}.webp")
        if not os.path.exists(path) or os.path.getmtime(path) < mtime:
            im = img if x == w else img.resize((x, max(1, round(h * x / w))), Image.LANCZOS)
            im.save(path, "WEBP", quality=QUALITY, method=6)
        out.append(x)
    return out, (w, h)


def video_info(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                        "stream=width,height:stream_tags=rotate:side_data=rotation", "-of", "json", path],
                       capture_output=True, text=True, check=True)
    s = json.loads(r.stdout)["streams"][0]
    w, h = s["width"], s["height"]
    rot = int(s.get("tags", {}).get("rotate", 0) or 0)
    for sd in s.get("side_data_list", []) or []:
        if "rotation" in sd:
            rot = int(sd["rotation"])
    if abs(rot) % 180 == 90:
        w, h = h, w
    return w, h


def main():
    os.makedirs(WEB, exist_ok=True)
    try:
        manifest = json.load(open(MANIFEST))
    except (FileNotFoundError, json.JSONDecodeError):
        manifest = {}
    seen = set()
    for name in sorted(os.listdir(UPLOADS)):
        src = os.path.join(UPLOADS, name)
        if not os.path.isfile(src) or name.startswith("."):
            continue
        ext = os.path.splitext(name)[1].lower()
        key = f"uploads/{name}"
        mtime = os.path.getmtime(src)
        try:
            if ext in IMAGE_EXT:
                with Image.open(src) as im:
                    widths, (w, h) = variants(im, name, mtime)
                manifest[key] = {"w": w, "h": h, "v": widths}
            elif ext in VIDEO_EXT:
                w, h = video_info(src)
                with tempfile.TemporaryDirectory() as tmp:
                    frame = os.path.join(tmp, "f.png")
                    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "0.5", "-i", src, "-frames:v", "1", frame], check=True)
                    if not os.path.exists(frame):   # very short clip: take the first frame
                        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-frames:v", "1", frame], check=True)
                    with Image.open(frame) as im:
                        widths, _ = variants(im, f"{name}.poster", mtime)
                manifest[key] = {"w": w, "h": h, "poster": widths}
            else:
                continue
            seen.add(key)
            print("ok", key, manifest[key])
        except Exception as e:  # keep going; one odd file shouldn't stop the rest
            print("skip", key, e, file=sys.stderr)
    # forget files that were removed
    manifest = {k: v for k, v in sorted(manifest.items()) if k in seen}
    with open(MANIFEST, "w") as f:
        json.dump(manifest, f, indent=1)
        f.write("\n")
    # remove copies of files that no longer exist
    keep = set()
    for k, v in manifest.items():
        base = k.split("/", 1)[1]
        for x in v.get("v", []):
            keep.add(f"{base}-{x}.webp")
        for x in v.get("poster", []):
            keep.add(f"{base}.poster-{x}.webp")
    for f in os.listdir(WEB):
        if f not in keep:
            os.remove(os.path.join(WEB, f))


if __name__ == "__main__":
    main()
