"""Example requests and responses for the craft endpoints in the API documentation.

The lookup items are the seeded ones, with their real ids, names, and descriptions, so the publish
example works as written. tests/test_api_examples.py sends every request example to the API and
checks the response against the documented one.
"""

from drf_spectacular.utils import OpenApiExample

from core.schema import error_example

CERAMICS = {
    "id": 1,
    "name": "Ceramics",
    "slug": "ceramics",
    "icon": "amphora",
    "description": (
        "Objects shaped from clay and hardened by firing, from everyday pottery to tiles, "
        "porcelain and figurines."
    ),
    "user_added": False,
    "added_by_me": False,
}
TILE = {
    "id": 2,
    "name": "Tile",
    "description": (
        "A flat piece of fired clay, usually glazed and painted, used to cover walls, floors or "
        "roofs."
    ),
    "user_added": False,
    "added_by_me": False,
}
TEXTILES = {
    "id": 2,
    "name": "Textiles",
    "slug": "textiles",
    "icon": "spool",
    "description": (
        "Cloth and objects made from fibres by spinning, weaving, knotting, felting, dyeing or "
        "stitching."
    ),
    "user_added": False,
    "added_by_me": False,
}
KILIM = {
    "id": 7,
    "name": "Kilim",
    "description": "A flat-woven rug without pile, its pattern made by the coloured weft threads.",
    "user_added": False,
    "added_by_me": False,
}
TURKISH = {
    "id": 25,
    "name": "Turkish",
    "homeland": "Anatolia, Türkiye",
    "description": (
        "The people of Türkiye, whose crafts include tiles, carpets, kilims, marbling and "
        "calligraphy."
    ),
    "user_added": False,
    "added_by_me": False,
}
TOOLS = [
    {
        "id": 7,
        "name": "Brush",
        "description": "Bristles on a handle, used to paint, glaze or spread liquids.",
        "user_added": False,
        "added_by_me": False,
    },
    {
        "id": 2,
        "name": "Kiln",
        "description": "An oven that fires clay, glaze or glass at high temperatures.",
        "user_added": False,
        "added_by_me": False,
    },
    {
        "id": 8,
        "name": "Pounce stencil",
        "description": (
            "A pricked paper pattern; charcoal dust patted through its holes transfers the "
            "design to a surface."
        ),
        "user_added": False,
        "added_by_me": False,
    },
]
MATERIALS = [
    {
        "id": 1,
        "name": "Clay",
        "description": "Fine earth that is soft when wet and hardens when fired.",
        "user_added": False,
        "added_by_me": False,
    },
    {
        "id": 6,
        "name": "Cobalt oxide",
        "description": "A mineral pigment that gives a deep blue under glaze.",
        "user_added": False,
        "added_by_me": False,
    },
    {
        "id": 3,
        "name": "Glaze",
        "description": "A glassy coating fused onto ceramics in the kiln.",
        "user_added": False,
        "added_by_me": False,
    },
    {
        "id": 5,
        "name": "Quartz",
        "description": "A hard mineral; ground quartz adds silica to clay bodies and glazes.",
        "user_added": False,
        "added_by_me": False,
    },
]

IZNIK = {
    "address": "İznik, Bursa, Türkiye",
    "city": "İznik",
    "country": "Türkiye",
    "latitude": 40.429444,
    "longitude": 29.721111,
}
KUTAHYA = {
    "address": "Kütahya, Türkiye",
    "city": "Kütahya",
    "country": "Türkiye",
    "latitude": 39.41991,
    "longitude": 29.98579,
}
DESCRIPTION = (
    "Fritware tiles painted under a clear glaze. The design is pounced onto the white slip "
    "through a pricked paper stencil, outlined in dark paint, filled with cobalt blue, turquoise, "
    "and a raised red, then glazed and fired."
)
STORY = (
    "İznik tiles cover the walls of Ottoman mosques and palaces. Their tulips, carnations, and "
    "saz leaves stand for paradise gardens, and workshops in Kütahya keep the technique alive."
)
FEATURES = "Raised tomato-red under a clear glaze"

CRAFT_REQUEST = {
    "name": "İznik tile",
    "category": 1,
    "craft_type": 2,
    "tools": [7, 2, 8],
    "materials": [1, 6, 3, 5],
    "culture": 25,
    "places": [{**IZNIK, "is_origin": True}, KUTAHYA],
    "description": DESCRIPTION,
    "story": STORY,
    "date": {"kind": "year", "year": 1575, "circa": True},
    "colors": ["#1e3a8a", "#0e9aa7", "#b91c1c", "#f8f5ee"],
    "attributes": {
        "dimensions": [
            {"type": "height", "value": 25, "unit": "cm"},
            {"type": "width", "value": 25, "unit": "cm"},
        ],
        "distinguishing_features": FEATURES,
    },
}

AUTHOR = {"id": 7, "display_name": "Ayşe"}

CRAFT_CREATED = {
    "id": 37,
    "name": "İznik tile",
    "category": CERAMICS,
    "craft_type": TILE,
    "tools": TOOLS,
    "materials": MATERIALS,
    "culture": TURKISH,
    **IZNIK,
    "places": [
        {"id": 41, **IZNIK, "is_origin": True},
        {"id": 42, **KUTAHYA, "is_origin": False},
    ],
    "media": [],
    "description": DESCRIPTION,
    "story": STORY,
    "story_count": 0,
    "date": {"kind": "year", "year": 1575, "day": None, "circa": True},
    "colors": ["#1e3a8a", "#0e9aa7", "#b91c1c", "#f8f5ee"],
    "attributes": {
        "dimensions": [
            {"type": "height", "unit": "cm", "value": 25},
            {"type": "width", "unit": "cm", "value": 25},
        ],
        "distinguishing_features": FEATURES,
    },
    "status": "published",
    "author": AUTHOR,
    "created_at": "2026-11-23T10:15:42.518204Z",
    "updated_at": "2026-11-23T10:15:42.518231Z",
}

# From the live API: GET /api/v1/crafts/1/, with the description and story shortened.
CRAFT_DETAIL = {
    "id": 1,
    "name": "Kütahya Çinisi",
    "category": CERAMICS,
    "craft_type": TILE,
    "tools": TOOLS,
    "materials": MATERIALS,
    "culture": TURKISH,
    **KUTAHYA,
    "places": [{"id": 1, **KUTAHYA, "is_origin": False}],
    "media": [
        {
            "id": 1,
            "media_type": "photo",
            "file": (
                "https://indigenous-crafts-api.onrender.com/media/crafts/1/"
                "e76293f935fc41a88448f4d3775cc9c8.jpg"
            ),
            "url": "",
            "caption": (
                "Tile at the Kütahya Ceramics Museum. Photo: Dosseman, CC BY-SA 4.0, "
                "Wikimedia Commons"
            ),
            "alt_text": (
                "Glazed tile with large blue, green, and red floral scrolls on a white ground"
            ),
            "order": 0,
        }
    ],
    "description": (
        "Glazed tiles and vessels from Kütahya in western Anatolia, a center of ceramic "
        "production since at least the 14th century."
    ),
    "story": "Kütahya tiles line mosques, fountains, and homes across Anatolia.",
    "story_count": 0,
    "date": {"kind": "unknown", "year": None, "day": None, "circa": False},
    "colors": ["#1e3a8a", "#0e9aa7", "#2f7d32", "#b91c1c", "#f8f5ee"],
    "attributes": {
        "dimensions": [
            {"type": "height", "unit": "cm", "value": 20},
            {"type": "width", "unit": "cm", "value": 20},
            {"type": "thickness", "unit": "cm", "value": 1},
        ]
    },
    "status": "published",
    "author": {"id": 1, "display_name": "Sample Contributor (Anatolia)"},
    "created_at": "2026-10-24T20:40:06.324421Z",
    "updated_at": "2026-10-24T20:40:06.324439Z",
}

# From the live API: GET /api/v1/crafts/?search=kilim, one item of the page.
CRAFT_LIST_ITEM = {
    "id": 33,
    "name": "Shirvan kilim",
    "category": TEXTILES,
    "craft_type": KILIM,
    "culture": {
        "id": 29,
        "name": "Azerbaijani",
        "homeland": "Azerbaijan and northwestern Iran",
        "description": (
            "A Turkic people of the South Caucasus and northwestern Iran, known for carpets, silk "
            "and metalwork."
        ),
        "user_added": False,
        "added_by_me": False,
    },
    "city": "Shamakhi",
    "country": "Azerbaijan",
    "latitude": 40.63412,
    "longitude": 48.63834,
    "cover_photo": {
        "url": (
            "https://indigenous-crafts-api.onrender.com/media/crafts/33/"
            "4f401e1855b44ed8b10c506636eadfb8.jpg"
        ),
        "alt_text": (
            "Kilim in progress on an upright loom: a white ground with red and dark blue motifs, "
            "with balls of yarn hanging from the weave"
        ),
    },
    "status": "published",
    "author": {"id": 4, "display_name": "Sample Contributor (Asia)"},
    "created_at": "2026-10-24T20:40:10.735951Z",
}

STORY_REQUEST = {
    "text": (
        "My grandmother painted tiles like these in a Kütahya workshop. She pounced each design "
        "through the same paper stencil for forty years, and the red was always the hardest part."
    )
}
STORY_CREATED = {
    "id": 12,
    **STORY_REQUEST,
    "author": {"id": 9, "display_name": "Mehmet"},
    "created_at": "2026-11-23T10:21:07.334512Z",
    "updated_at": "2026-11-23T10:21:07.334540Z",
}

NOT_SIGNED_IN = error_example("Not signed in", "Authentication credentials were not provided.")
CRAFT_NOT_FOUND = error_example(
    "Unknown, hidden, or removed craft",
    "Craft not found.",
)

craft_list = [
    OpenApiExample(
        "Search for kilim",
        summary="GET /api/v1/crafts/?search=kilim",
        description=(
            "Every word must start a word in the craft's fields, tools, materials, or places. "
            "Filters such as `category=textiles` or `color=blue` combine with the search."
        ),
        value=CRAFT_LIST_ITEM,
        response_only=True,
    )
]
craft_list_errors = {
    "filter": error_example(
        "Unknown main color",
        "Validation failed.",
        {"color": ['"violet" is not a valid choice.']},
        summary="GET /api/v1/crafts/?color=violet",
    ),
}
craft_detail = [
    OpenApiExample(
        "A craft", summary="GET /api/v1/crafts/1/", value=CRAFT_DETAIL, response_only=True
    )
]
craft_create = [
    OpenApiExample(
        "Publish a craft",
        summary="An İznik tile made in two places, with its origin, date, colors, and size",
        description=(
            "Ids come from the lookup lists (`/categories/`, `/craft-types/`, `/tools/`, "
            "`/materials/`, `/cultures/`). Needs a signed-in user with a verified email."
        ),
        value=CRAFT_REQUEST,
        request_only=True,
    ),
    OpenApiExample(
        "Published craft",
        summary="The new craft, as GET /api/v1/crafts/{id}/ returns it",
        value=CRAFT_CREATED,
        response_only=True,
        status_codes=["201"],
    ),
]
craft_create_errors = {
    "invalid": error_example(
        "Missing places",
        "Validation failed.",
        {"places": ["This field is required."]},
        summary="Each invalid field is listed with its messages",
    ),
    "unverified": error_example(
        "Email not verified", "Verify your email address before publishing crafts."
    ),
}
story_create = [
    OpenApiExample(
        "Share a story",
        summary="A user's own story about a craft they did not publish",
        value=STORY_REQUEST,
        request_only=True,
    ),
    OpenApiExample("Shared story", value=STORY_CREATED, response_only=True, status_codes=["201"]),
]
story_create_errors = {
    "author": error_example(
        "The craft's author",
        "As the craft's author, tell your story in the craft's Story field.",
    ),
    "twice": error_example(
        "Second story on the same craft",
        "You have already shared a story about this craft. Edit it instead.",
    ),
}
