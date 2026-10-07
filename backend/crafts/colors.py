"""
Craft colors are stored as "#rrggbb", or "#rrggbbaa" when see-through, and compared in the
CIELAB color space, where the distance between two colors follows how different they look.
"""

import re

# Stored form: lowercase hex with an optional alpha byte.
HEX_COLOR = re.compile(r"^#[0-9a-f]{6}([0-9a-f]{2})?$")
# Search form: the same, with or without "#", and without alpha.
SEARCH_COLOR = re.compile(r"^#?([0-9a-fA-F]{6})$")

# Colors closer than this CIE76 distance count as similar. About 2.3 is the smallest
# difference people notice. At 20, nearby shades match (two royal blues are 15 apart, dark and
# bright red 12) while other hues do not (blue and purple are 37 apart, red and orange 28).
SIMILAR_DISTANCE = 20

# D65 white point, the reference white for sRGB.
WHITE = (0.95047, 1.0, 1.08883)


def _linear(channel):
    channel /= 255
    return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4


def _lab_part(value):
    return value ** (1 / 3) if value > (6 / 29) ** 3 else value / (3 * (6 / 29) ** 2) + 4 / 29


def to_lab(hex_color):
    """The CIELAB (L, a, b) values of a "#rrggbb" color. Any alpha byte is ignored."""
    r, g, b = (_linear(int(hex_color[i : i + 2], 16)) for i in (1, 3, 5))
    x = 0.4124 * r + 0.3576 * g + 0.1805 * b
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    z = 0.0193 * r + 0.1192 * g + 0.9505 * b
    fx, fy, fz = (_lab_part(value / white) for value, white in zip((x, y, z), WHITE, strict=True))
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)
