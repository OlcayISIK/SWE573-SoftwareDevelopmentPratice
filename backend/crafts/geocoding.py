"""
Address lookup with OpenStreetMap Nominatim.

Nominatim's usage policy asks for an identifying user agent, at most one request per second
for the whole application, and caching of results. Requests go through the backend so these
hold for every user, and the browser's security policy does not have to allow another origin.
"""

import hashlib
import json
import logging
import time
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.cache import cache

from core.exceptions import NotFoundError, ServiceUnavailableError

logger = logging.getLogger(__name__)

ADDRESS_NOT_FOUND = "Address not found."
NO_ADDRESS_HERE = "No address found for this point."
UNAVAILABLE = "Address lookup is not available right now. Try again in a moment."

TIMEOUT_SECONDS = 5
FOUND_FOR = 24 * 60 * 60
NOT_FOUND_FOR = 60 * 60
# Wait this long at most for the one-request-per-second slot before giving up.
MAX_WAIT_SECONDS = 3
SLOT_KEY = "geocoding:slot"
# Settlement names from the most to the least specific that still reads as a city.
CITY_KEYS = ["city", "town", "village", "hamlet", "municipality"]
# Official English names that the map data does not use yet, by country code.
COUNTRY_NAMES = {"tr": "Türkiye"}


def _take_slot():
    deadline = time.monotonic() + MAX_WAIT_SECONDS
    while not cache.add(SLOT_KEY, True, timeout=1):
        if time.monotonic() >= deadline:
            raise ServiceUnavailableError(UNAVAILABLE)
        time.sleep(0.2)


def _fetch(path, params):
    """Calls Nominatim and returns the decoded JSON."""
    _take_slot()
    query = urlencode({**params, "format": "jsonv2", "addressdetails": 1, "accept-language": "en"})
    request = Request(
        f"{settings.GEOCODER_URL}/{path}?{query}",
        headers={"User-Agent": settings.GEOCODER_USER_AGENT},
    )
    try:
        with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            return json.loads(response.read().decode("utf-8"))
    except (URLError, TimeoutError, ValueError) as exc:
        logger.warning("Address lookup failed: %s", exc)
        raise ServiceUnavailableError(UNAVAILABLE) from exc


def _place(result):
    address = result.get("address", {})
    return {
        "latitude": round(float(result["lat"]), 6),
        "longitude": round(float(result["lon"]), 6),
        "address": result.get("display_name", ""),
        "city": next((address[key] for key in CITY_KEYS if address.get(key)), ""),
        "country": COUNTRY_NAMES.get(address.get("country_code"), address.get("country", "")),
    }


def _cached(key, lookup, not_found_message):
    cached = cache.get(key)
    if cached is None:
        place = lookup()
        cached = place or {}
        cache.set(key, cached, FOUND_FOR if place else NOT_FOUND_FOR)
    if not cached:
        raise NotFoundError(not_found_message)
    return cached


def search(query):
    """The best match for an address: coordinates, a full address, city, and country."""
    normalized = " ".join(query.lower().split())

    def lookup():
        results = _fetch("search", {"q": normalized, "limit": 1})
        return _place(results[0]) if results else None

    # Addresses can be long and contain any character, so the cache key uses a hash.
    digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
    return _cached(f"geocoding:search:{digest}", lookup, ADDRESS_NOT_FOUND)


def reverse(latitude, longitude):
    """The address at a point, for example where the user dropped the pin."""
    # About 1 m apart, so small pin movements reuse the cached answer.
    latitude, longitude = round(latitude, 5), round(longitude, 5)

    def lookup():
        result = _fetch("reverse", {"lat": latitude, "lon": longitude, "zoom": 18})
        return None if "error" in result else _place(result)

    return _cached(f"geocoding:reverse:{latitude},{longitude}", lookup, NO_ADDRESS_HERE)
