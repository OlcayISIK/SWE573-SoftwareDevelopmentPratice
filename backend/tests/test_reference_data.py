import pytest
from django.contrib import admin

from crafts.models import Category, Region

pytestmark = pytest.mark.django_db


def test_categories_are_seeded_and_listed_alphabetically(api_client):
    response = api_client.get("/api/v1/categories/")

    data = response.json()["data"]
    assert response.status_code == 200
    assert isinstance(data, list)
    names = [category["name"] for category in data]
    assert names == sorted(names)
    assert {"Ceramics", "Textiles", "Woodwork", "Metalwork"} <= set(names)
    assert set(data[0]) == {"id", "name", "slug"}


def test_regions_include_description(api_client):
    response = api_client.get("/api/v1/regions/")

    regions = {region["name"]: region for region in response.json()["data"]}
    assert response.status_code == 200
    assert regions["Kütahya"]["country"] == "Türkiye"
    assert "tile" in regions["Kütahya"]["description"]


def test_regions_filter_by_country(api_client):
    response = api_client.get("/api/v1/regions/", {"country": "türkiye"})

    countries = {region["country"] for region in response.json()["data"]}
    assert countries == {"Türkiye"}


def test_reference_lists_are_public_and_read_only(api_client):
    assert api_client.post("/api/v1/categories/", {"name": "X"}, format="json").status_code == 405
    assert api_client.post("/api/v1/regions/", {"name": "X"}, format="json").status_code == 405


def test_admins_manage_reference_data_in_django_admin():
    assert admin.site.is_registered(Category)
    assert admin.site.is_registered(Region)
