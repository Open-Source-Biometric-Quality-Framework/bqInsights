import os
import shutil
import subprocess
import sys
from PIL import Image

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BUILD_DIR = os.path.join(ROOT_DIR, "build")

MAC_ICONSET = "AppIcon.iconset"

MAC_SIZES = [
    (16, "icon_16x16.png"),
    (32, "icon_16x16@2x.png"),
    (32, "icon_32x32.png"),
    (64, "icon_32x32@2x.png"),
    (128, "icon_128x128.png"),
    (256, "icon_128x128@2x.png"),
    (256, "icon_256x256.png"),
    (512, "icon_256x256@2x.png"),
    (512, "icon_512x512.png"),
    (1024, "icon_512x512@2x.png"),
]

LINUX_SIZES = [16, 32, 48, 64, 128, 256, 512]

def ensure_dir(path):
    os.makedirs(path, exist_ok=True)

def load_image(source_png):
    if not os.path.isfile(source_png):
        raise FileNotFoundError(f"Source PNG not found: {source_png}")
    return Image.open(source_png).convert("RGBA")

def create_icns(img):
    iconset_dir = os.path.join(BUILD_DIR, MAC_ICONSET)
    ensure_dir(BUILD_DIR)

    if os.path.exists(iconset_dir):
        shutil.rmtree(iconset_dir)
    os.makedirs(iconset_dir)

    for size, filename in MAC_SIZES:
        img.resize((size, size), Image.LANCZOS).save(
            os.path.join(iconset_dir, filename),
            format="PNG"
        )

    icns_path = os.path.join(BUILD_DIR, "icon.icns")
    subprocess.run(
        ["iconutil", "-c", "icns", iconset_dir, "-o", icns_path],
        check=True
    )

    shutil.rmtree(iconset_dir)
    print(f"✔ macOS icon: {icns_path}")

def create_ico(img):
    ensure_dir(BUILD_DIR)

    ico_path = os.path.join(BUILD_DIR, "icon.ico")

    sizes = [(s, s) for s in LINUX_SIZES]
    img.save(ico_path, format="ICO", sizes=sizes)

    print(f"✔ Windows icon: {ico_path}")

def create_linux_icons(img):
    icons_dir = os.path.join(BUILD_DIR, "icons")
    ensure_dir(icons_dir)

    for size in LINUX_SIZES:
        out = os.path.join(icons_dir, f"{size}x{size}.png")
        img.resize((size, size), Image.LANCZOS).save(out, format="PNG")

    print(f"✔ Linux icons: {icons_dir}/")

def main(source_png):
    img = load_image(source_png)

    create_icns(img)
    create_ico(img)
    create_linux_icons(img)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python png_to_icons.py input.png")
        sys.exit(1)

    main(sys.argv[1])