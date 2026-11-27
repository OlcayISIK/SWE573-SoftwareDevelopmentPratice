"""
Names of lookup items in other languages, from Wikidata.

Wikidata is free to use without a key and its data is in the public domain (CC0), so names are
stored with the items and searches never wait for it. Its API asks for an identifying user agent
and a modest request rate; lookups happen only when an item is added or linked, and when the
names are refreshed, and search results are cached.
"""

import json
import logging
import re
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.cache import cache

from core.exceptions import ServiceUnavailableError

logger = logging.getLogger(__name__)

UNAVAILABLE = "Wikidata is not available right now. Try again in a moment."
NOT_AN_ITEM = "No Wikidata item has this id."

TIMEOUT_SECONDS = 5
SEARCH_RESULTS = 5
SEARCH_CACHED_FOR = 24 * 60 * 60
# Names are kept in these languages.
LANGUAGES = ("en", "tr")
# How many "subclass of" steps up the broader kinds are followed, so a kilim, which is a kind
# of flat-woven rug, which is a kind of carpet, is found by a search for carpets.
BROADER_STEPS = 3
SUBCLASS_OF = "P279"
# Names with digits ("element 26") or shorter than this ("Cu") are not useful for search.
MIN_NAME_LENGTH = 3
MAX_NAME_LENGTH = 80
# wbgetentities takes at most this many ids at once.
BATCH = 50


class WikidataUnavailable(ServiceUnavailableError):
    pass


def page_url(wikidata_id):
    """The item's page on Wikidata, for people to check what it is."""
    return f"https://www.wikidata.org/wiki/{wikidata_id}"


def _call(params):
    query = urlencode({**params, "format": "json"})
    request = Request(
        f"{settings.WIKIDATA_URL}?{query}",
        headers={"User-Agent": settings.WIKIDATA_USER_AGENT},
    )
    try:
        with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            data = json.load(response)
    except (URLError, TimeoutError, ValueError) as exc:
        logger.warning("Wikidata request failed: %s", exc)
        raise WikidataUnavailable(UNAVAILABLE) from exc
    if "error" in data:
        logger.warning("Wikidata refused a request: %s", data["error"])
        raise WikidataUnavailable(UNAVAILABLE)
    return data


def search(text):
    """Wikidata items whose English name or alias starts with the text, best match first."""
    key = f"wikidata:search:{text.casefold()}"
    found = cache.get(key)
    if found is None:
        data = _call(
            {
                "action": "wbsearchentities",
                "search": text,
                "language": "en",
                "uselang": "en",
                "type": "item",
                "limit": SEARCH_RESULTS,
            }
        )
        found = [
            {
                "id": row["id"],
                "label": row.get("label", row["id"]),
                "description": row.get("description", ""),
            }
            for row in data.get("search", [])
        ]
        cache.set(key, found, SEARCH_CACHED_FOR)
    return found


def _entities(ids, props):
    """The entities with these ids, fetched in batches."""
    ids = list(ids)
    entities = {}
    for start in range(0, len(ids), BATCH):
        data = _call(
            {
                "action": "wbgetentities",
                "ids": "|".join(ids[start : start + BATCH]),
                "props": props,
                "languages": "|".join(LANGUAGES),
            }
        )
        entities.update(data.get("entities", {}))
    return entities


def _subclass_of(entity):
    return [
        claim["mainsnak"]["datavalue"]["value"]["id"]
        for claim in entity.get("claims", {}).get(SUBCLASS_OF, [])
        if claim["mainsnak"].get("datavalue")
    ]


def _names(entity):
    labels = [entity.get("labels", {}).get(language, {}).get("value", "") for language in LANGUAGES]
    aliases = [
        alias["value"]
        for language in LANGUAGES
        for alias in entity.get("aliases", {}).get(language, [])
    ]
    seen = set()
    names = []
    for name in (" ".join(name.split()) for name in [*labels, *aliases]):
        if (
            MIN_NAME_LENGTH <= len(name) <= MAX_NAME_LENGTH
            and not re.search(r"\d", name)
            and name.casefold() not in seen
        ):
            seen.add(name.casefold())
            names.append(name)
    return names


def _in_first_language(texts):
    """The text in the first language Wikidata has it in, or ""."""
    for language in LANGUAGES:
        value = texts.get(language, {}).get("value", "")
        if value:
            return value
    return ""


def describe(wikidata_id):
    """
    The item's label and description, so people can check it is the item they meant, its names
    in English and Turkish, and the items it is a kind of, a few steps up:
    {"label": "...", "description": "...", "names": [...], "broader": ["Q...", ...]}.
    """
    found = describe_many([wikidata_id])
    if wikidata_id not in found:
        raise LookupError(NOT_AN_ITEM)
    return found[wikidata_id]


def describe_many(wikidata_ids, parents=None):
    """
    describe() for many items with few requests: the items, and then each step of their broader
    kinds, are fetched together. Items Wikidata does not have are left out of the result.

    `parents` maps items to the items they are a kind of. Passing the same dict to later calls
    reuses what was fetched, since many items share broader kinds such as textile.
    """
    parents = {} if parents is None else parents
    ids = list(dict.fromkeys(wikidata_ids))
    entities = {
        item: entity
        for item, entity in _entities(ids, "labels|descriptions|aliases|claims").items()
        if "missing" not in entity
    }
    parents.update({item: _subclass_of(entity) for item, entity in entities.items()})
    # Each step up, the parents not known yet are fetched together for all items. The items of
    # the last step need no parents of their own.
    level = set(entities)
    for _ in range(BROADER_STEPS - 1):
        level = {parent for item in level for parent in parents.get(item, [])}
        unknown = sorted(level - parents.keys())
        if unknown:
            found = _entities(unknown, "claims")
            parents.update({item: _subclass_of(found.get(item, {})) for item in unknown})

    described = {}
    for item, entity in entities.items():
        broader, step = [], parents[item]
        for _ in range(BROADER_STEPS):
            step = [kind for kind in dict.fromkeys(step) if kind not in broader and kind != item]
            if not step:
                break
            broader += step
            step = [parent for kind in step for parent in parents.get(kind, [])]
        described[item] = {
            "label": _in_first_language(entity.get("labels", {})) or item,
            "description": _in_first_language(entity.get("descriptions", {})),
            "names": _names(entity),
            "broader": broader,
        }
    return described
