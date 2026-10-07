import pytest
from django.contrib import admin

from crafts.models import Category

pytestmark = pytest.mark.django_db


def test_categories_are_seeded_and_listed_alphabetically(api_client):
    response = api_client.get("/api/v1/categories/")

    data = response.json()["data"]
    assert response.status_code == 200
    assert isinstance(data, list)
    names = [category["name"] for category in data]
    assert names == sorted(names)
    assert {"Ceramics", "Textiles", "Woodwork", "Metalwork"} <= set(names)
    assert set(data[0]) == {"id", "name", "slug", "user_added"}


def test_admins_manage_reference_data_in_django_admin():
    assert admin.site.is_registered(Category)
