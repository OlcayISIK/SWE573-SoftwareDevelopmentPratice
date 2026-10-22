import pytest

from tests.factories import CraftFactory
from tests.payloads import craft_payload

pytestmark = pytest.mark.django_db

CRAFTS_URL = "/api/v1/crafts/"


def publish(client, date):
    return client.post(CRAFTS_URL, craft_payload(date=date), format="json")


def test_a_craft_without_a_date_is_unknown(client_for, user):
    data = client_for(user).post(CRAFTS_URL, craft_payload(), format="json").json()["data"]

    assert data["date"] == {"kind": "unknown", "year": None, "day": None, "circa": False}


@pytest.mark.parametrize(
    ("date", "expected"),
    [
        # Milattan Önce 500: years before the common era are negative.
        ({"kind": "year", "year": -500}, {"year": -500, "day": None, "circa": False}),
        # About MS 300.
        ({"kind": "year", "year": 300, "circa": True}, {"year": 300, "day": None, "circa": True}),
        # An exact day keeps its year too.
        ({"kind": "day", "day": "1923-03-12"}, {"year": 1923, "day": "1923-03-12", "circa": False}),
    ],
)
def test_dates_before_and_after_the_common_era(client_for, user, date, expected):
    response = publish(client_for(user), date)

    assert response.status_code == 201
    assert response.json()["data"]["date"] == {"kind": date["kind"], **expected}


@pytest.mark.parametrize(
    ("date", "field"),
    [
        ({"kind": "year"}, "year"),
        ({"kind": "year", "year": 0}, "year"),
        ({"kind": "year", "year": 3000}, "year"),
        ({"kind": "day"}, "day"),
        ({"kind": "day", "day": "2999-01-01"}, "day"),
        ({"kind": "century"}, "kind"),
    ],
)
def test_invalid_dates_are_rejected(client_for, user, date, field):
    response = publish(client_for(user), date)

    assert response.status_code == 400
    assert field in response.json()["errors"]["date"]


def test_the_date_can_be_changed_or_cleared(client_for, user):
    client = client_for(user)
    craft_id = publish(client, {"kind": "year", "year": -500}).json()["data"]["id"]
    url = f"{CRAFTS_URL}{craft_id}/"

    changed = client.patch(url, {"date": {"kind": "day", "day": "1850-06-01"}}, format="json")
    cleared = client.patch(url, {"date": {"kind": "unknown"}}, format="json")

    assert changed.json()["data"]["date"]["year"] == 1850
    assert cleared.json()["data"]["date"] == {
        "kind": "unknown",
        "year": None,
        "day": None,
        "circa": False,
    }


def test_existing_crafts_have_an_unknown_date(api_client):
    craft = CraftFactory()

    data = api_client.get(f"{CRAFTS_URL}{craft.id}/").json()["data"]

    assert data["date"]["kind"] == "unknown"
