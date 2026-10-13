from pathlib import Path

import pytest
from django.core.management import CommandError, call_command

from accounts.models import User
from crafts.models import Craft, CraftMedia, Tool
from crafts.samples import SAMPLE_DATA, read_samples, sample_email

pytestmark = pytest.mark.django_db

SAMPLES = read_samples()


def places_of(item):
    """A sample in several places lists them; otherwise its own fields are its place."""
    return item.get("places", [item])


def sample_crafts():
    return Craft.all_objects.filter(
        author__email__endswith="@example.org", author__email__startswith="sample-"
    )


def test_the_data_file_is_complete():
    names = [item["name"] for item in SAMPLES["crafts"]]
    assert len(names) == len(set(names)) >= 25
    for item in SAMPLES["crafts"]:
        assert item["author"] in SAMPLES["authors"]
        for place in places_of(item):
            assert -90 <= place["latitude"] <= 90 and -180 <= place["longitude"] <= 180
            assert place["address"] and place["city"] and place["country"]
        assert item["photos"], item["name"]
        for photo in item["photos"]:
            assert (SAMPLE_DATA / "photos" / photo["file"]).is_file()
            assert photo["alt_text"]
            # Free licenses ask for credit, so every caption names the author and license.
            assert photo["credit"]["author"] in photo["caption"]
            assert photo["credit"]["license"] in photo["caption"]
            assert len(photo["caption"]) <= 200


def test_every_photo_is_credited():
    credits = (SAMPLE_DATA / "CREDITS.md").read_text(encoding="utf-8")
    files = {path.name for path in (SAMPLE_DATA / "photos").iterdir()}
    listed = {photo["file"] for item in SAMPLES["crafts"] for photo in item["photos"]}

    assert files == listed
    assert all(name in credits for name in files)


def test_sample_crafts_are_loaded_with_their_details(api_client):
    call_command("load_sample_crafts")

    assert sample_crafts().count() == len(SAMPLES["crafts"])
    craft = Craft.objects.get(name="Kütahya Çinisi")
    assert craft.category.slug == "ceramics"
    assert craft.craft_type.name == "Tile"
    assert craft.culture.name == "Turkish"
    assert (craft.city, craft.country) == ("Kütahya", "Türkiye")
    assert craft.tools.filter(name="Kiln").exists()
    assert craft.colors.count() == 5
    assert craft.attributes["dimensions"][0] == {"type": "height", "value": 20, "unit": "cm"}

    detail = api_client.get(f"/api/v1/crafts/{craft.id}/").json()["data"]
    photo = detail["media"][0]
    assert photo["media_type"] == "photo"
    assert "Wikimedia Commons" in photo["caption"]
    assert detail["author"]["display_name"] == "Sample Contributor (Anatolia)"


def test_sample_crafts_show_on_the_map_and_filters(api_client):
    call_command("load_sample_crafts")

    pins = api_client.get("/api/v1/crafts/map/").json()["data"]
    facets = api_client.get("/api/v1/crafts/facets/").json()["data"]
    countries = [item["name"] for item in facets["countries"]]

    # A pin for each place of each craft.
    assert len(pins) == sum(len(places_of(item)) for item in SAMPLES["crafts"])
    assert {"Türkiye", "Ghana", "Japan", "Mexico"} <= set(countries)


def test_samples_in_several_places_get_each_place(api_client):
    call_command("load_sample_crafts")
    craft = Craft.objects.get(name="Yörük kilim")

    detail = api_client.get(f"/api/v1/crafts/{craft.id}/").json()["data"]

    assert [place["city"] for place in detail["places"]] == ["Fethiye", "Mut"]
    assert not any(place["is_origin"] for place in detail["places"])
    kilims = api_client.get("/api/v1/crafts/", {"search": "kilim"}).json()["data"]["items"]
    assert {"Yörük kilim", "Konya kilim", "Shirvan kilim"} <= {item["name"] for item in kilims}


def test_loading_twice_adds_nothing():
    call_command("load_sample_crafts")
    photos = CraftMedia.objects.count()

    call_command("load_sample_crafts")

    assert sample_crafts().count() == len(SAMPLES["crafts"])
    assert CraftMedia.objects.count() == photos


def test_sample_contributors_cannot_log_in(api_client):
    call_command("load_sample_crafts")
    user = User.objects.get(email=sample_email("anatolia"))

    assert user.is_email_verified
    assert not user.has_usable_password()


def test_removing_takes_out_crafts_photos_and_contributors():
    call_command("load_sample_crafts")
    files = [Path(media.file.path) for media in CraftMedia.objects.all()]

    call_command("load_sample_crafts", "--remove")

    assert not sample_crafts().exists()
    assert not CraftMedia.all_objects.exists()
    assert not User.objects.filter(email__startswith="sample-").exists()
    assert not any(path.exists() for path in files)


def test_loading_stops_cleanly_when_a_lookup_item_is_missing():
    Tool.objects.filter(name="Kiln").delete()

    with pytest.raises(CommandError, match="Tool not found"):
        call_command("load_sample_crafts")

    # Nothing is half loaded.
    assert not sample_crafts().exists()
