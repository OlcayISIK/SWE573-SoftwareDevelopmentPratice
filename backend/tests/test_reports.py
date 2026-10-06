import pytest
from rest_framework.throttling import ScopedRateThrottle

from crafts.models import Craft
from moderation.models import Report
from tests.factories import CraftFactory

pytestmark = pytest.mark.django_db


def report_url(craft):
    return f"/api/v1/crafts/{craft.id}/report/"


@pytest.fixture
def craft():
    return CraftFactory()


def test_registered_user_reports_craft(client_for, user, craft):
    response = client_for(user).post(
        report_url(craft), {"reason": "inaccurate", "note": "Wrong region."}, format="json"
    )

    data = response.json()["data"]
    assert response.status_code == 201
    assert data["status"] == "open"
    assert data["craft"] == craft.id
    report = Report.objects.get()
    assert (report.reporter, report.reason, report.note) == (user, "inaccurate", "Wrong region.")


def test_note_is_optional(client_for, user, craft):
    response = client_for(user).post(report_url(craft), {"reason": "disrespectful"}, format="json")

    assert response.status_code == 201


def test_guest_cannot_report(api_client, craft):
    assert (
        api_client.post(report_url(craft), {"reason": "inaccurate"}, format="json").status_code
        == 401
    )


def test_reason_must_be_valid(client_for, user, craft):
    response = client_for(user).post(report_url(craft), {"reason": "boring"}, format="json")

    assert response.status_code == 400
    assert "reason" in response.json()["errors"]


def test_one_open_report_per_user_per_craft(client_for, user, craft):
    client = client_for(user)
    client.post(report_url(craft), {"reason": "inaccurate"}, format="json")

    response = client.post(report_url(craft), {"reason": "inappropriate"}, format="json")

    assert response.status_code == 409
    assert "already reported" in response.json()["message"]
    assert Report.objects.count() == 1


def test_user_can_report_again_after_review(client_for, user, craft):
    client = client_for(user)
    client.post(report_url(craft), {"reason": "inaccurate"}, format="json")
    Report.objects.update(status=Report.Status.DISMISSED)

    response = client.post(report_url(craft), {"reason": "inaccurate"}, format="json")

    assert response.status_code == 201


def test_different_users_can_report_the_same_craft(client_for, user, admin_user, craft):
    client_for(user).post(report_url(craft), {"reason": "inaccurate"}, format="json")
    response = client_for(admin_user).post(
        report_url(craft), {"reason": "inaccurate"}, format="json"
    )

    assert response.status_code == 201
    assert Report.objects.filter(craft=craft, status="open").count() == 2


def test_author_cannot_report_own_craft(client_for, craft):
    response = client_for(craft.author).post(
        report_url(craft), {"reason": "inaccurate"}, format="json"
    )

    assert response.status_code == 400


@pytest.mark.parametrize("state", [{"status": Craft.Status.HIDDEN}, {"is_deleted": True}])
def test_cannot_report_crafts_the_user_cannot_see(client_for, user, state):
    craft = CraftFactory(**state)

    response = client_for(user).post(report_url(craft), {"reason": "inaccurate"}, format="json")

    assert response.status_code == 404


def test_reporting_is_rate_limited(client_for, user, monkeypatch):
    monkeypatch.setitem(ScopedRateThrottle.THROTTLE_RATES, "report", "2/hour")
    client = client_for(user)
    crafts = CraftFactory.create_batch(3)

    codes = [
        client.post(report_url(craft), {"reason": "inaccurate"}, format="json").status_code
        for craft in crafts
    ]

    assert codes == [201, 201, 429]
