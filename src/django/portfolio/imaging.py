"""
Preparing an uploaded photograph for the web.

Neida uploads straight from her phone, and a phone photograph is not a web
image. A recent iPhone produces roughly 4000x3000 at 2-3MB, which the grid then
draws into a cell a few hundred pixels wide — so without this every visitor
downloads about ten times the picture they are shown, and a gallery of twenty
runs to tens of megabytes on a phone connection.

It cannot be done at request time. The site is a static build served by nginx
with no Node process behind it, so there is nothing to resize on the fly; the
files that land on disk have to be the files that are served.

Three things happen here, and the third is the one that matters most:

  Orientation is applied. Phones record "this is sideways" as an EXIF tag
  rather than rotating the pixels. Browsers honour the tag, so an untouched
  upload looks right — but the moment it is resized, the tag is gone and the
  picture is on its side. Baking the rotation in first is what keeps that from
  happening.

  Metadata is dropped. Every one of these carries GPS coordinates alongside the
  camera model and timestamp. Serving the file as uploaded publishes the place
  it was taken, which for someone photographing work at home is her address.
  Re-encoding through a fresh image is what removes it.

  Size comes down, twice. A long edge for the lightbox, a shorter one for the
  grid, both WebP — which is smaller than JPEG at the same quality and, unlike
  JPEG, keeps transparency for scans.
"""

from __future__ import annotations

from io import BytesIO

from django.core.files.base import ContentFile
from PIL import Image, ImageOps

# The longest edge of each version, in pixels.
FULL_EDGE = 2000
THUMB_EDGE = 900

FULL_QUALITY = 82
THUMB_QUALITY = 78


def _clean(image: Image.Image) -> Image.Image:
    """Applies the orientation tag and returns an image carrying no metadata."""
    # Must come first: once the pixels are resampled the tag no longer applies,
    # and anything relying on it afterwards renders the picture on its side.
    image = ImageOps.exif_transpose(image)

    # WebP handles both, and keeping alpha means a scan with a transparent
    # background does not arrive with a black one.
    mode = "RGBA" if image.mode in ("RGBA", "LA", "PA") else "RGB"
    if image.mode != mode:
        image = image.convert(mode)

    # A fresh image with only the pixels copied across. Editing the metadata in
    # place is easy to get half-right; starting from nothing cannot be.
    stripped = Image.new(mode, image.size)
    stripped.putdata(list(image.getdata()))
    return stripped


def _encode(image: Image.Image, edge: int, quality: int) -> ContentFile:
    """Scales to fit within `edge` on its longest side and encodes as WebP."""
    scaled = image.copy()
    # thumbnail() only ever shrinks, so a picture already smaller than the
    # target is left at its own size rather than being blown up.
    scaled.thumbnail((edge, edge), Image.LANCZOS)

    buffer = BytesIO()
    scaled.save(buffer, format="WEBP", quality=quality, method=6)
    return ContentFile(buffer.getvalue())


def prepare(source) -> tuple[ContentFile, ContentFile]:
    """
    Returns (full, thumbnail) for an uploaded image file.

    `source` is anything Pillow can open — an upload still in memory, or a file
    already on disk being reprocessed.
    """
    with Image.open(source) as opened:
        # Loaded eagerly: the caller's file may be closed by the time the second
        # encode runs, and Pillow reads lazily.
        opened.load()
        cleaned = _clean(opened)

    return (
        _encode(cleaned, FULL_EDGE, FULL_QUALITY),
        _encode(cleaned, THUMB_EDGE, THUMB_QUALITY),
    )
