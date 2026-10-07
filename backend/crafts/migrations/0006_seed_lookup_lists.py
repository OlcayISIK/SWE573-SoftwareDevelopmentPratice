from django.db import migrations

NEW_CATEGORIES = [
    ("Lacquerware", "lacquerware"),
    ("Musical Instruments", "musical-instruments"),
]

# Craft types per category slug, each with the tools and materials typical for it.
CRAFT_TYPES = {
    "ceramics": {
        "Pottery": (
            ["Potter's wheel", "Kiln", "Wooden rib", "Wire cutter", "Burnishing stone", "Sponge"],
            ["Clay", "Slip", "Glaze", "Mineral pigments"],
        ),
        "Tile": (
            ["Kiln", "Brush", "Pounce stencil", "Mould"],
            ["Clay", "Quartz", "Glaze", "Cobalt oxide", "Mineral pigments"],
        ),
        "Porcelain": (
            ["Potter's wheel", "Kiln", "Brush", "Mould"],
            ["Kaolin", "Quartz", "Feldspar", "Glaze", "Cobalt oxide"],
        ),
        "Stoneware": (
            ["Potter's wheel", "Kiln", "Wooden rib", "Wire cutter"],
            ["Clay", "Feldspar", "Glaze", "Wood ash"],
        ),
        "Figurine": (
            ["Mould", "Modelling tool", "Kiln", "Brush"],
            ["Clay", "Slip", "Mineral pigments"],
        ),
    },
    "textiles": {
        "Carpet": (
            ["Loom", "Knotting knife", "Beater comb", "Shears", "Drop spindle", "Dye pot"],
            ["Wool", "Cotton", "Silk", "Madder", "Indigo", "Walnut husk"],
        ),
        "Kilim": (
            ["Loom", "Beater comb", "Shuttle", "Drop spindle", "Dye pot"],
            ["Wool", "Cotton", "Goat hair", "Madder", "Indigo"],
        ),
        "Felt": (
            ["Reed mat", "Carding comb", "Wool bow"],
            ["Wool", "Soap"],
        ),
        "Embroidery": (
            ["Needle", "Embroidery hoop", "Scissors", "Thimble"],
            ["Cotton", "Silk", "Linen", "Metallic thread"],
        ),
        "Block printing": (
            ["Carved wooden block", "Printing table", "Dye vat"],
            ["Cotton", "Natural dyes", "Mordant"],
        ),
        "Batik": (
            ["Tjanting", "Tjap stamp", "Wax pot", "Dye vat"],
            ["Cotton", "Silk", "Beeswax", "Paraffin wax", "Natural dyes", "Indigo"],
        ),
        "Ikat": (
            ["Loom", "Warping frame", "Dye vat", "Shuttle"],
            ["Cotton", "Silk", "Natural dyes", "Indigo"],
        ),
        "Handwoven cloth": (
            ["Loom", "Strip loom", "Shuttle", "Heddle", "Drop spindle"],
            ["Cotton", "Silk", "Wool", "Alpaca wool", "Natural dyes"],
        ),
        "Tapestry": (
            ["Loom", "Bobbin", "Beater comb"],
            ["Wool", "Cotton", "Silk", "Natural dyes"],
        ),
        "Lace": (
            ["Needle", "Crochet hook", "Bobbin", "Scissors"],
            ["Cotton", "Silk", "Linen"],
        ),
    },
    "woodwork": {
        "Carving": (
            ["Chisel", "Gouge", "Carving knife", "Mallet", "Rasp", "Adze"],
            ["Walnut wood", "Cedar wood", "Lime wood", "Oak wood", "Natural oil", "Beeswax"],
        ),
        "Mask": (
            ["Adze", "Gouge", "Carving knife", "Rasp", "Brush"],
            ["Cedar wood", "Mahogany", "Natural pigments", "Natural oil"],
        ),
        "Totem pole": (
            ["Adze", "Chisel", "Gouge", "Mallet", "Carving knife"],
            ["Cedar wood", "Natural pigments"],
        ),
        "Marquetry": (
            ["Fret saw", "Chisel", "Clamp", "Scraper"],
            ["Walnut wood", "Ebony", "Boxwood", "Mother of pearl", "Bone", "Animal glue"],
        ),
        "Woodturning": (
            ["Lathe", "Gouge", "Parting tool", "Scraper"],
            ["Walnut wood", "Oak wood", "Lime wood", "Natural oil", "Beeswax"],
        ),
        "Furniture": (
            ["Hand saw", "Hand plane", "Chisel", "Mallet", "Clamp", "Drawknife"],
            ["Walnut wood", "Oak wood", "Cedar wood", "Animal glue", "Natural oil"],
        ),
    },
    "metalwork": {
        "Copperware": (
            ["Hammer", "Anvil", "Stake", "Chasing tools", "Forge"],
            ["Copper", "Tin"],
        ),
        "Silverware": (
            ["Hammer", "Anvil", "Chasing tools", "Engraving burin", "Soldering torch", "File"],
            ["Silver", "Copper"],
        ),
        "Filigree": (
            ["Drawplate", "Tweezers", "Pliers", "Soldering torch"],
            ["Silver", "Gold"],
        ),
        "Forged ironwork": (
            ["Forge", "Anvil", "Hammer", "Tongs", "Bellows"],
            ["Iron", "Charcoal"],
        ),
        "Lost-wax casting": (
            ["Crucible", "Furnace", "Modelling tool", "Tongs"],
            ["Bronze", "Brass", "Beeswax", "Clay"],
        ),
    },
    "glass": {
        "Blown glass": (
            ["Blowpipe", "Furnace", "Marver", "Jacks", "Punty"],
            ["Silica sand", "Soda ash", "Lime", "Metal oxides", "Recycled glass"],
        ),
        "Stained glass": (
            ["Glass cutter", "Grozing pliers", "Soldering iron", "Lead knife"],
            ["Coloured glass", "Lead came", "Solder"],
        ),
        "Glass beads": (
            ["Mandrel", "Torch", "Furnace", "Tweezers"],
            ["Coloured glass", "Recycled glass", "Metal oxides"],
        ),
        "Mosaic glass": (
            ["Furnace", "Kiln", "Glass cutter", "Tweezers"],
            ["Coloured glass", "Metal oxides"],
        ),
    },
    "jewelry": {
        "Silver jewelry": (
            ["Jeweller's saw", "File", "Pliers", "Soldering torch", "Mandrel", "Polishing wheel"],
            ["Silver", "Turquoise", "Coral", "Amber"],
        ),
        "Gold jewelry": (
            ["Jeweller's saw", "File", "Pliers", "Soldering torch", "Drawplate"],
            ["Gold", "Gemstones"],
        ),
        "Beaded jewelry": (
            ["Beading needle", "Beading loom", "Pliers", "Scissors"],
            ["Glass beads", "Seed beads", "Shell", "Leather cord", "Thread"],
        ),
        "Amber jewelry": (
            ["File", "Hand drill", "Polishing wheel"],
            ["Amber", "Silver", "Thread"],
        ),
        "Shell jewelry": (
            ["Hand drill", "File", "Abrasive stone"],
            ["Shell", "Thread", "Leather cord"],
        ),
    },
    "basketry": {
        "Coiled basket": (
            ["Awl", "Knife", "Needle"],
            ["Pine needles", "Sweetgrass", "Raffia", "Yucca", "Grass"],
        ),
        "Plaited basket": (
            ["Knife", "Awl", "Shears"],
            ["Palm leaf", "Bamboo", "Pandanus", "Harakeke (New Zealand flax)"],
        ),
        "Wicker basket": (
            ["Bodkin", "Rapping iron", "Shears", "Knife"],
            ["Willow", "Rattan", "Hazel"],
        ),
        "Twined basket": (
            ["Awl", "Knife"],
            ["Spruce root", "Cedar bark", "Grass", "Reed"],
        ),
        "Mat": (
            ["Knife", "Needle"],
            ["Reed", "Rush", "Palm leaf", "Pandanus"],
        ),
    },
    "leatherwork": {
        "Footwear": (
            ["Last", "Awl", "Stitching needle", "Skiving knife", "Hammer"],
            ["Cowhide", "Goatskin", "Deerskin", "Waxed thread"],
        ),
        "Saddlery": (
            ["Head knife", "Awl", "Stitching needle", "Edge beveler", "Stitching horse"],
            ["Cowhide", "Waxed thread", "Brass"],
        ),
        "Tooled leather": (
            ["Swivel knife", "Stamping tools", "Mallet", "Edge beveler"],
            ["Vegetable-tanned leather", "Natural dyes"],
        ),
        "Bags and pouches": (
            ["Awl", "Stitching needle", "Punch", "Skiving knife"],
            ["Goatskin", "Sheepskin", "Deerskin", "Sinew", "Glass beads"],
        ),
    },
    "paper-and-calligraphy": {
        "Calligraphy": (
            ["Reed pen", "Pen knife", "Inkwell", "Burnisher"],
            ["Soot ink", "Handmade paper", "Gold leaf"],
        ),
        "Paper marbling": (
            ["Marbling tray", "Horsehair brush", "Awl"],
            ["Ox gall", "Gum tragacanth", "Natural pigments", "Handmade paper"],
        ),
        "Illumination": (
            ["Fine brush", "Burnisher", "Pounce stencil"],
            ["Gold leaf", "Natural pigments", "Handmade paper", "Animal glue"],
        ),
        "Handmade paper": (
            ["Paper mould", "Vat", "Press"],
            ["Kozo (paper mulberry)", "Cotton rag", "Hemp"],
        ),
        "Bookbinding": (
            ["Bone folder", "Awl", "Needle", "Press"],
            ["Handmade paper", "Goatskin", "Thread", "Animal glue"],
        ),
        "Miniature painting": (
            ["Fine brush", "Burnisher"],
            ["Natural pigments", "Gold leaf", "Handmade paper", "Gum arabic"],
        ),
    },
    "stone-carving": {
        "Soapstone carving": (
            ["Rasp", "File", "Carving knife", "Saw", "Abrasive stone"],
            ["Soapstone"],
        ),
        "Greenstone carving": (
            ["Bow drill", "Abrasive stone", "Grinding wheel"],
            ["Pounamu (nephrite jade)"],
        ),
        "Meerschaum carving": (
            ["Carving knife", "File", "Hand drill"],
            ["Meerschaum", "Beeswax"],
        ),
        "Architectural carving": (
            ["Point chisel", "Chisel", "Mallet", "Rasp"],
            ["Marble", "Limestone", "Basalt", "Alabaster"],
        ),
    },
    "lacquerware": {
        "Urushi lacquerware": (
            ["Lacquer brush", "Spatula", "Polishing charcoal", "Sprinkling tube"],
            ["Urushi lacquer", "Cypress wood", "Gold powder", "Natural pigments"],
        ),
        "Painted lacquer": (
            ["Brush", "Lathe", "Kiln"],
            ["Lime wood", "Linseed oil", "Tin powder", "Natural pigments"],
        ),
        "Maque": (
            ["Brush", "Carving knife"],
            ["Chia seed oil", "Aje insect fat", "Dolomite powder", "Natural pigments"],
        ),
    },
    "musical-instruments": {
        "Drum": (
            ["Adze", "Gouge", "Drawknife", "Awl"],
            ["Rawhide", "Goatskin", "Hardwood", "Sinew"],
        ),
        "Long-necked lute": (
            ["Gouge", "Chisel", "Hand plane", "Clamp", "Hand drill"],
            ["Mulberry wood", "Spruce wood", "Juniper wood", "Metal strings"],
        ),
        "Flute": (
            ["Hand drill", "Carving knife", "File"],
            ["Cane", "Bamboo", "Bone", "Hardwood"],
        ),
        "Rattle": (
            ["Carving knife", "Hand drill"],
            ["Gourd", "Seeds", "Hardwood", "Natural pigments"],
        ),
    },
}

CULTURES = [
    ("Diné (Navajo)", "Southwestern United States"),
    ("Hopi", "Arizona, United States"),
    ("Zuni", "New Mexico, United States"),
    ("Cherokee", "Southeastern United States"),
    ("Lakota", "Great Plains, United States"),
    ("Anishinaabe (Ojibwe)", "Great Lakes, Canada and United States"),
    ("Haida", "Haida Gwaii, Canada"),
    ("Kwakwaka'wakw", "British Columbia, Canada"),
    ("Inuit", "Arctic Canada, Alaska and Greenland"),
    ("Zapotec", "Oaxaca, Mexico"),
    ("Maya", "Mexico, Guatemala and Belize"),
    ("Wixárika (Huichol)", "Western Mexico"),
    ("Otomí", "Central Mexico"),
    ("Guna", "Panama"),
    ("Wayuu", "La Guajira, Colombia and Venezuela"),
    ("Kichwa Otavalo", "Imbabura, Ecuador"),
    ("Quechua", "Andes of Peru and Bolivia"),
    ("Aymara", "Lake Titicaca, Bolivia and Peru"),
    ("Shipibo-Conibo", "Peruvian Amazon"),
    ("Mapuche", "Chile and Argentina"),
    ("Sámi", "Sápmi, Northern Europe"),
    ("Nenets", "Northern Siberia, Russia"),
    ("Sakha", "Yakutia, Russia"),
    ("Romani", "Europe"),
    ("Turkish", "Anatolia, Türkiye"),
    ("Yörük", "Anatolia, Türkiye"),
    ("Armenian", "Armenian Highlands"),
    ("Georgian", "Georgia"),
    ("Azerbaijani", "Azerbaijan and northwestern Iran"),
    ("Persian", "Iran"),
    ("Bedouin", "Arabian Peninsula and the Levant"),
    ("Turkmen", "Turkmenistan"),
    ("Uzbek", "Uzbekistan"),
    ("Kazakh", "Kazakhstan"),
    ("Kyrgyz", "Kyrgyzstan"),
    ("Mongolian", "Mongolia"),
    ("Tibetan", "Tibetan Plateau"),
    ("Kashmiri", "Kashmir Valley"),
    ("Rajasthani", "Rajasthan, India"),
    ("Gond", "Central India"),
    ("Hmong", "Southern China and Southeast Asia"),
    ("Japanese", "Japan"),
    ("Ainu", "Hokkaido, Japan"),
    ("Javanese", "Java, Indonesia"),
    ("Balinese", "Bali, Indonesia"),
    ("Dayak", "Borneo"),
    ("Toraja", "South Sulawesi, Indonesia"),
    ("Ifugao", "Luzon, Philippines"),
    ("Māori", "Aotearoa New Zealand"),
    ("Aboriginal Australian", "Australia"),
    ("Torres Strait Islander", "Torres Strait, Australia"),
    ("Kānaka Maoli (Native Hawaiian)", "Hawaiʻi"),
    ("Samoan", "Samoa"),
    ("Tongan", "Tonga"),
    ("iTaukei (Fijian)", "Fiji"),
    ("Amazigh (Berber)", "North Africa"),
    ("Tuareg", "Sahara"),
    ("Dogon", "Mali"),
    ("Fulani", "West Africa"),
    ("Hausa", "West Africa"),
    ("Asante", "Ghana"),
    ("Ewe", "Ghana and Togo"),
    ("Yoruba", "Nigeria and Benin"),
    ("Maasai", "Kenya and Tanzania"),
    ("Zulu", "South Africa"),
    ("Ndebele", "South Africa and Zimbabwe"),
    ("San", "Southern Africa"),
]


def seed(apps, schema_editor):
    Category = apps.get_model("crafts", "Category")
    CraftType = apps.get_model("crafts", "CraftType")
    Tool = apps.get_model("crafts", "Tool")
    Material = apps.get_model("crafts", "Material")
    Culture = apps.get_model("crafts", "Culture")

    for name, slug in NEW_CATEGORIES:
        Category.objects.get_or_create(slug=slug, defaults={"name": name})

    for slug, craft_types in CRAFT_TYPES.items():
        category = Category.objects.get(slug=slug)
        for type_name, (tools, materials) in craft_types.items():
            craft_type, _ = CraftType.objects.get_or_create(category=category, name=type_name)
            for tool_name in tools:
                Tool.objects.get_or_create(name=tool_name)[0].craft_types.add(craft_type)
            for material_name in materials:
                Material.objects.get_or_create(name=material_name)[0].craft_types.add(craft_type)

    for name, homeland in CULTURES:
        Culture.objects.get_or_create(name=name, defaults={"homeland": homeland})


def unseed(apps, schema_editor):
    for model in ("Culture", "Material", "Tool", "CraftType"):
        apps.get_model("crafts", model).objects.filter(created_by__isnull=True).delete()
    apps.get_model("crafts", "Category").objects.filter(
        slug__in=[slug for _, slug in NEW_CATEGORIES]
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("crafts", "0005_lookup_lists"),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
