"""Searching by names in other languages and other words, from Wikidata and from admins."""

import importlib
import json
from datetime import timedelta
from io import StringIO

import pytest
from django.apps import apps
from django.core.management import call_command
from django.db import connection
from django.utils import timezone

from crafts import selectors, services, wikidata
from crafts.models import Category, CraftPart, CraftType, Material, fold
from moderation.models import ItemReport
from tests.factories import AdminFactory, CraftFactory, UserFactory

pytestmark = pytest.mark.django_db

CRAFTS = "/api/v1/crafts/"
TERMS = "/api/v1/crafts/search-terms/"
WIKIDATA_SEARCH = "/api/v1/wikidata/search/"


@pytest.fixture
def textiles():
    return Category.objects.get(slug="textiles")


@pytest.fixture
def rugs(textiles):
    """A carpet, a kilim, and a craft that is neither."""
    carpet = CraftFactory(
        name="Uşak", category=textiles, craft_type=CraftType.objects.get(name="Carpet")
    )
    kilim = CraftFactory(
        name="Yörük", category=textiles, craft_type=CraftType.objects.get(name="Kilim")
    )
    CraftFactory(name="Kente", category=textiles, craft_type=CraftType.objects.get(name="Lace"))
    return carpet, kilim


def found(api_client, search, **params):
    rows = api_client.get(CRAFTS, {"search": search, **params}).json()["data"]["items"]
    return {row["name"] for row in rows}


def terms(api_client, search):
    data = api_client.get(TERMS, {"search": search}).json()["data"]
    return {term["word"]: [item["name"] for item in term["related"]] for term in data}


@pytest.fixture
def fake_wikidata(monkeypatch):
    """Wikidata answers from a dict instead of the network; None makes it unavailable."""
    items = {
        "Q42329": {
            "label": "wool",
            "description": "textile fibre from sheep",
            "names": ["wool", "Yün"],
            "broader": ["Q11426"],
        },
        "Q9999": {
            "label": "yak wool",
            "description": "",
            "names": ["yak wool", "Yak yünü"],
            "broader": ["Q42329"],
        },
        "Q395": {
            "label": "mathematics",
            "description": "field of study",
            "names": ["mathematics", "matematik"],
            "broader": [],
        },
    }

    def describe_many(wikidata_ids, parents=None):
        return {item: items[item] for item in wikidata_ids if item in items}

    # describe() looks items up through describe_many(), so both are answered from the dict.
    monkeypatch.setattr(wikidata, "describe_many", describe_many)
    return items


# The seeded lists


def test_seeded_items_are_linked_to_wikidata():
    carpet = CraftType.objects.get(name="Carpet")
    kilim = CraftType.objects.get(name="Kilim")

    assert carpet.wikidata_id == "Q163446"
    assert "halı" in carpet.names
    assert "rug" in carpet.names
    # A kilim is a kind of carpet, a few steps up in Wikidata.
    assert carpet.wikidata_id in kilim.broader
    assert Material.objects.get(name="Wool").wikidata_id == "Q42329"


# Searching


def test_a_turkish_name_finds_crafts_of_the_item_and_its_narrower_kinds(api_client, rugs):
    assert found(api_client, "halı") == {"Uşak", "Yörük"}


def test_names_are_found_without_turkish_letters(api_client, rugs):
    assert fold("Halı kökboya çini") == "Hali kokboya cini"
    assert found(api_client, "hali") == {"Uşak", "Yörük"}


def test_other_words_admins_added_find_the_crafts(api_client, rugs):
    assert found(api_client, "rug") == {"Uşak", "Yörük"}


def test_an_exact_search_skips_other_names(api_client, rugs):
    assert found(api_client, "halı", exact="true") == set()
    assert found(api_client, "uşak", exact="true") == {"Uşak"}


def test_materials_and_parts_are_found_by_their_other_names(api_client):
    wool = Material.objects.get(name="Wool")
    rug = CraftFactory(name="Felt rug")
    rug.materials.add(wool)
    knife = CraftFactory(name="Knife")
    CraftPart.objects.create(craft=knife, name="Sheath").materials.add(wool)
    CraftFactory(name="Plain")

    assert found(api_client, "yün") == {"Felt rug", "Knife"}


def test_the_map_and_facets_use_other_names_too(api_client, rugs):
    pins = api_client.get(f"{CRAFTS}map/", {"search": "halı"}).json()["data"]
    facets = api_client.get(f"{CRAFTS}facets/", {"search": "halı"}).json()["data"]

    assert {pin["name"] for pin in pins} == {"Uşak", "Yörük"}
    assert {row["name"] for row in facets["craft_types"]} == {"Carpet", "Kilim"}


def test_search_terms_say_what_else_a_word_finds(api_client):
    Material.objects.create(name="Spam", other_names=["halı"], is_hidden=True)

    related = terms(api_client, "halı tile")

    # Carpet by its Turkish name, Kilim as a kind of carpet; hidden items are not shown.
    assert related["halı"][:2] == ["Carpet", "Kilim"]
    assert "Spam" not in related["halı"]
    # Items found by their own name are not listed again.
    assert "Tile" not in related["tile"]
    data = api_client.get(TERMS, {"search": "halı"}).json()["data"][0]["related"][0]
    assert (data["kind"], data["name"]) == ("craft_type", "Carpet")
    assert "halı" in data["names"]


# Adding items


def test_an_added_item_is_linked_to_the_wikidata_item_the_user_picked(
    client_for, user, api_client, fake_wikidata
):
    response = client_for(user).post(
        "/api/v1/materials/", {"name": "Yak wool", "wikidata_id": "Q9999"}, format="json"
    )

    assert response.status_code == 201
    yak = Material.objects.get(name="Yak wool")
    assert yak.wikidata_id == "Q9999"
    assert yak.names == ["Yak yünü"]
    rug = CraftFactory(name="Tibetan rug")
    rug.materials.add(yak)
    assert found(api_client, "yünü") == {"Tibetan rug"}
    # Yak wool is a kind of wool, so a search for wool in Turkish finds it.
    assert found(api_client, "yün") == {"Tibetan rug"}


def test_an_item_is_still_added_when_wikidata_is_down(client_for, user, monkeypatch):
    def down(wikidata_id):
        raise wikidata.WikidataUnavailable(wikidata.UNAVAILABLE)

    monkeypatch.setattr(wikidata, "describe", down)

    response = client_for(user).post(
        "/api/v1/materials/", {"name": "Yak wool", "wikidata_id": "Q9999"}, format="json"
    )

    assert response.status_code == 201
    assert Material.objects.get(name="Yak wool").wikidata_id == ""


def test_a_wikidata_id_must_look_like_one(client_for, user):
    response = client_for(user).post(
        "/api/v1/materials/", {"name": "Yak wool", "wikidata_id": "carpet"}, format="json"
    )

    assert response.status_code == 400
    assert "wikidata_id" in response.json()["errors"]


def test_users_look_up_wikidata_items_when_adding(api_client, client_for, user, monkeypatch):
    calls = []

    def search(text):
        calls.append(text)
        return [{"id": "Q585358", "label": "kilim", "description": "flat tapestry-woven rug"}]

    monkeypatch.setattr(wikidata, "search", search)

    assert api_client.get(WIKIDATA_SEARCH, {"q": "kilim"}).status_code == 401
    response = client_for(user).get(WIKIDATA_SEARCH, {"q": "kilim"})

    assert response.status_code == 200
    assert response.json()["data"] == [
        {"id": "Q585358", "label": "kilim", "description": "flat tapestry-woven rug"}
    ]
    assert calls == ["kilim"]


def test_the_wikidata_lookup_says_when_wikidata_is_down(client_for, user):
    # Tests point Wikidata at an address that does not exist.
    response = client_for(user).get(WIKIDATA_SEARCH, {"q": "felt"})

    assert response.status_code == 503


# Admins


def review_edit(admin, item, **changes):
    report = ItemReport.objects.create(
        item_type="material",
        item_id=item.id,
        item_name=item.name,
        reporter=UserFactory(),
        reason="duplicate",
    )
    return admin.post(
        f"/api/v1/moderation/item-reports/{report.id}/actions/",
        {"action": "edit", "reason": "Linked it.", **changes},
        format="json",
    )


def test_admins_link_items_and_add_other_names(client_for, api_client, fake_wikidata):
    item = Material.objects.create(name="Yak hair", created_by=UserFactory())
    admin = client_for(AdminFactory())

    response = review_edit(admin, item, wikidata_id="Q9999", other_names=[" yak  fibre ", ""])

    assert response.status_code == 200, response.json()
    item.refresh_from_db()
    assert item.wikidata_id == "Q9999"
    assert item.names == ["yak fibre", "yak wool", "Yak yünü"]
    shown = response.json()["data"]["item"]
    assert shown["other_names"] == ["yak fibre"]
    assert shown["wikidata_names"] == ["yak wool", "Yak yünü"]

    review_edit(admin, item, wikidata_id="")
    item.refresh_from_db()
    assert (item.wikidata_id, item.names) == ("", ["yak fibre"])


def test_merging_keeps_the_duplicate_names(client_for, api_client):
    duplicate = Material.objects.create(name="Yapağı", other_names=["kuzu yünü"])
    rug = CraftFactory(name="Rug")
    rug.materials.add(duplicate)
    wool = Material.objects.get(name="Wool")
    report = ItemReport.objects.create(
        item_type="material",
        item_id=duplicate.id,
        item_name=duplicate.name,
        reporter=UserFactory(),
        reason="duplicate",
    )

    client_for(AdminFactory()).post(
        f"/api/v1/moderation/item-reports/{report.id}/actions/",
        {"action": "merge", "reason": "Same thing.", "merge_into": wool.id},
        format="json",
    )

    wool.refresh_from_db()
    assert {"Yapağı", "kuzu yünü"} <= set(wool.other_names)
    assert found(api_client, "yapagi") == {"Rug"}


def test_names_are_refreshed_from_wikidata(fake_wikidata):
    fake_wikidata["Q42329"] = {"names": ["wool", "Yün", "yapağı"], "broader": []}

    call_command("refresh_wikidata_names")

    assert "yapağı" in Material.objects.get(name="Wool").names


def test_items_wikidata_does_not_answer_for_keep_their_names(monkeypatch):
    def describe_many(wikidata_ids, parents=None):
        # Wikidata has no answer for wool.
        return {
            item: {"names": ["refreshed"], "broader": []}
            for item in wikidata_ids
            if item != "Q42329"
        }

    monkeypatch.setattr(wikidata, "describe_many", describe_many)
    out = StringIO()

    call_command("refresh_wikidata_names", stdout=out)

    # Wool keeps its names; the rest are still refreshed.
    assert "Yün" in Material.objects.get(name="Wool").names
    assert Material.objects.get(name="Silk").names == ["refreshed"]
    assert "1 items kept their names" in out.getvalue()


def test_every_item_keeps_its_names_when_wikidata_is_down(monkeypatch):
    def down(wikidata_ids, parents=None):
        raise wikidata.WikidataUnavailable(wikidata.UNAVAILABLE)

    monkeypatch.setattr(wikidata, "describe_many", down)
    out = StringIO()

    call_command("refresh_wikidata_names", stdout=out)

    assert "Yün" in Material.objects.get(name="Wool").names
    assert "Refreshed the names of 0 items." in out.getvalue()


def test_names_are_refreshed_with_few_requests(monkeypatch):
    calls = []

    def call(params):
        calls.append(params)
        return {"entities": {}}

    monkeypatch.setattr(wikidata, "_call", call)

    call_command("refresh_wikidata_names", stdout=StringIO())

    # The 161 seeded links are fetched 50 at a time, not one by one.
    assert len(calls) == 4


# Refreshing from the admin panel


def refresh_in_admin(client, user, items, model="material"):
    client.force_login(user)
    return client.post(
        f"/admin/crafts/{model}/",
        {"action": "refresh_names", "_selected_action": [item.pk for item in items]},
        follow=True,
    )


def test_admins_refresh_chosen_items_from_the_admin_panel(client, fake_wikidata):
    fake_wikidata["Q42329"] = {"names": ["wool", "Yün", "yapağı"], "broader": []}
    wool = Material.objects.get(name="Wool")
    silk = Material.objects.get(name="Silk")
    unlinked = Material.objects.create(name="Yak hair")

    response = refresh_in_admin(
        client, AdminFactory(is_staff=True, is_superuser=True), [wool, silk, unlinked]
    )

    messages = [str(message) for message in response.context["messages"]]
    assert "Refreshed the names of 1 items." in messages
    # Silk is linked, but this Wikidata has no answer for it, so it keeps its names.
    assert any("1 items kept their names" in message for message in messages)
    assert "1 items are not linked to Wikidata, so they were skipped." in messages
    assert "yapağı" in Material.objects.get(pk=wool.pk).names
    assert "İpek" in Material.objects.get(pk=silk.pk).names


def test_the_admin_refresh_stops_in_time_and_goes_on_next_time(client, fake_wikidata, monkeypatch):
    fake_wikidata["Q42329"] = {"names": ["wool", "Yün", "yapağı"], "broader": []}
    materials = list(Material.objects.exclude(wikidata_id=""))
    assert len(materials) > services.REFRESH_BATCH
    # Wool was refreshed longest ago, so it goes first.
    Material.objects.filter(name="Wool").update(updated_at=timezone.now() - timedelta(days=30))
    # A clock where the first batch takes longer than the admin panel's time.
    ticks = iter([0, 0, 100])
    monkeypatch.setattr(services.time, "monotonic", lambda: next(ticks, 100))

    response = refresh_in_admin(client, AdminFactory(is_staff=True, is_superuser=True), materials)

    messages = [str(message) for message in response.context["messages"]]
    left = len(materials) - services.REFRESH_BATCH
    assert f"{left} items were not reached in time." in " ".join(messages)
    assert "yapağı" in Material.objects.get(name="Wool").names


def test_broader_kinds_already_fetched_are_not_fetched_again(monkeypatch):
    claims = {"Q1": ["Q3"], "Q2": ["Q3"], "Q3": ["Q4"], "Q4": ["Q5"]}
    fetched = []

    def call(params):
        ids = params["ids"].split("|")
        fetched.extend(ids)
        return {
            "entities": {
                item: {
                    "labels": {"en": {"value": f"item {item}"}},
                    "claims": {
                        "P279": [
                            {"mainsnak": {"datavalue": {"value": {"id": parent}}}}
                            for parent in claims.get(item, [])
                        ]
                    },
                }
                for item in ids
            }
        }

    monkeypatch.setattr(wikidata, "_call", call)
    parents = {}

    first = wikidata.describe_many(["Q1"], parents)
    fetched.clear()
    second = wikidata.describe_many(["Q2"], parents)

    assert first["Q1"]["broader"] == second["Q2"]["broader"] == ["Q3", "Q4", "Q5"]
    # Only the new item itself is fetched; Q3 and Q4 are known from the first call.
    assert fetched == ["Q2"]


# Checking links in the admin panel


def admin_messages(response):
    return [str(message) for message in response.context["messages"]]


def change_in_admin(client, item, **changes):
    client.force_login(AdminFactory(is_staff=True, is_superuser=True))
    data = {
        "name": item.name,
        "description": item.description,
        "wikidata_id": item.wikidata_id,
        "other_names": json.dumps(item.other_names),
        **changes,
    }
    return client.post(f"/admin/crafts/material/{item.pk}/change/", data, follow=True)


def test_the_admin_list_shows_links_and_names_and_finds_the_links_users_picked(client):
    user = UserFactory()
    mat = Material.objects.create(
        name="Mat",
        created_by=user,
        wikidata_id="Q395",
        wikidata_names=["mathematics", "matematik"],
    )
    Material.objects.create(name="Yak hair", created_by=user)
    client.force_login(AdminFactory(is_staff=True, is_superuser=True))

    page = client.get("/admin/crafts/material/", {"wikidata": "users"}).content.decode()

    assert 'href="https://www.wikidata.org/wiki/Q395"' in page
    assert "mathematics, matematik" in page
    # Seeded links and unlinked items are left out.
    assert "Yak hair" not in page
    assert "Q42329" not in page
    assert mat.name in page


def test_linking_in_the_admin_panel_says_which_item_it_is(client, fake_wikidata):
    item = Material.objects.create(name="Mat", created_by=UserFactory())

    response = change_in_admin(client, item, wikidata_id="Q395")

    (message,) = [message for message in admin_messages(response) if "linked to" in message]
    assert "Mat is now linked to" in message
    assert "<strong>mathematics</strong> (field of study)" in message
    assert "Searches also find it as: mathematics, matematik." in message
    assert Material.objects.get(pk=item.pk).names == ["mathematics", "matematik"]

    response = change_in_admin(client, Material.objects.get(pk=item.pk), wikidata_id="")

    assert "Mat is no longer linked to Wikidata." in admin_messages(response)
    assert Material.objects.get(pk=item.pk).names == []


def test_an_id_wikidata_does_not_have_keeps_the_earlier_link(client, fake_wikidata):
    wool = Material.objects.get(name="Wool")

    response = change_in_admin(client, wool, wikidata_id="Q123456")

    assert "Q123456 is not a Wikidata item, so Wool stays linked to Q42329." in admin_messages(
        response
    )
    wool.refresh_from_db()
    assert wool.wikidata_id == "Q42329"
    assert "Yün" in wool.names


def test_staff_without_the_admin_role_cannot_refresh(client, fake_wikidata):
    fake_wikidata["Q42329"] = {"names": ["changed"], "broader": []}
    wool = Material.objects.get(name="Wool")

    response = refresh_in_admin(client, UserFactory(is_staff=True, is_superuser=True), [wool])

    messages = [str(message) for message in response.context["messages"]]
    assert "Only admins can perform this action." in messages
    assert "Yün" in Material.objects.get(pk=wool.pk).names


# When other names cannot be looked up


@pytest.fixture
def names_broken(monkeypatch):
    """Looking up other names fails with a real database error, as with a missing column."""

    def broken(word):
        with connection.cursor() as cursor:
            cursor.execute("SELECT search_names FROM no_such_table")

    monkeypatch.setattr(selectors, "_find_related", broken)


def test_search_goes_on_without_other_names_when_they_fail(api_client, rugs, names_broken):
    # Words in the crafts themselves are still found, and the request's other queries work.
    assert found(api_client, "uşak") == {"Uşak"}
    assert found(api_client, "halı") == set()
    for path in ("map/", "facets/"):
        assert api_client.get(f"{CRAFTS}{path}", {"search": "uşak"}).status_code == 200
    assert terms(api_client, "halı") == {"halı": []}


def test_seeding_is_skipped_when_its_file_cannot_be_read(monkeypatch, tmp_path):
    seed = importlib.import_module("crafts.migrations.0022_seed_wikidata_links")
    broken = tmp_path / "links.json"
    broken.write_text("{not json", encoding="utf-8")
    CraftType.objects.filter(name="Carpet").update(wikidata_id="")

    for path in (tmp_path / "missing.json", broken):
        monkeypatch.setattr(seed, "LINKS", path)
        seed.link(apps, None)

    assert CraftType.objects.get(name="Carpet").wikidata_id == ""


# The Wikidata client


def test_names_and_broader_kinds_are_read_from_wikidata(monkeypatch):
    claims = {
        "Q1": ["Q2"],
        "Q2": ["Q3"],
        "Q3": ["Q4", "Q1"],
        "Q4": ["Q5"],
    }

    def call(params):
        ids = params["ids"].split("|")
        entities = {}
        for item in ids:
            entity = {
                "claims": {
                    "P279": [
                        {"mainsnak": {"datavalue": {"value": {"id": parent}}}}
                        for parent in claims.get(item, [])
                    ]
                }
            }
            if item == "Q1":
                entity["labels"] = {"en": {"value": "kilim"}, "tr": {"value": "Kilim"}}
                entity["descriptions"] = {"tr": {"value": "düz dokuma yaygı"}}
                entity["aliases"] = {
                    "en": [{"value": "kylym"}, {"value": "Kw"}, {"value": "element 26"}],
                    "tr": [{"value": "  düz   dokuma "}],
                }
            entities[item] = entity
        return {"entities": entities}

    monkeypatch.setattr(wikidata, "_call", call)

    found = wikidata.describe("Q1")

    # The label and description show people which item it is, in Turkish when there is no
    # English one.
    assert (found["label"], found["description"]) == ("kilim", "düz dokuma yaygı")
    # Each name once, without short names or names with digits.
    assert found["names"] == ["kilim", "kylym", "düz dokuma"]
    # Three steps up, without going round in circles.
    assert found["broader"] == ["Q2", "Q3", "Q4"]


def test_a_missing_wikidata_item_is_refused(client_for, monkeypatch):
    monkeypatch.setattr(wikidata, "_call", lambda params: {"entities": {"Q7": {"missing": ""}}})
    item = Material.objects.create(name="Yak hair", created_by=UserFactory())

    response = review_edit(client_for(AdminFactory()), item, wikidata_id="Q7")

    assert response.status_code == 400
    assert "wikidata_id" in response.json()["errors"]
