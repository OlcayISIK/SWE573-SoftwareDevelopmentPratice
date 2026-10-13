"""Craft colors are stored as "#rrggbb", or "#rrggbbaa" when see-through."""

import re

# Stored form: lowercase hex with an optional alpha byte.
HEX_COLOR = re.compile(r"^#[0-9a-f]{6}([0-9a-f]{2})?$")
