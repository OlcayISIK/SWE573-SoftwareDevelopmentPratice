"""Craft colors are stored as "#rrggbb", or "#rrggbbaa" when see-through."""

import colorsys
import re

# Stored form: lowercase hex with an optional alpha byte.
HEX_COLOR = re.compile(r"^#[0-9a-f]{6}([0-9a-f]{2})?$")

# The named colors people search by, in the order the filter shows them.
MAIN_COLORS = [
    "red",
    "orange",
    "yellow",
    "green",
    "turquoise",
    "blue",
    "purple",
    "pink",
    "brown",
    "black",
    "white",
    "grey",
]


def main_color(value):
    """
    The named main color a stored color is closest to, judged by its hue, lightness, and
    saturation the way people name colors: very dark is black, pale is white, dull is grey,
    dark orange is brown, light red is pink, and the rest follow the color wheel.
    """
    red, green, blue = (int(value[index : index + 2], 16) / 255 for index in (1, 3, 5))
    hue, lightness, saturation = colorsys.rgb_to_hls(red, green, blue)
    hue *= 360
    if lightness < 0.12:
        return "black"
    if lightness > 0.85 and saturation < 0.7:
        return "white"
    if saturation < 0.15 or (saturation < 0.25 and lightness < 0.25):
        return "black" if lightness < 0.2 else "grey"
    if 15 <= hue < 50 and lightness < 0.42:
        return "brown"
    if hue < 15 or hue >= 345:
        return "pink" if lightness > 0.75 else "red"
    for limit, name in (
        (40, "orange"),
        (65, "yellow"),
        (165, "green"),
        (195, "turquoise"),
        (255, "blue"),
        (290, "purple"),
    ):
        if hue < limit:
            return name
    return "pink"
