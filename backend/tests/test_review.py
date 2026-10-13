import pytest

from crafts.models import Craft
from moderation import signals
from moderation.models import Report, ReviewAction
from tests.factories import AdminFactory, CraftFactory, ReportFactory, UserFactory

pytestmark = pytest.mark.django_db

QUEUE_URL = "/api/v1/moderation/reports/"


def action_url(report):
    return f"{QUEUE_URL}{report.id}/actions/"


def review(client, report, action, reason="Checked against sources.", **extra):
    return client.post(
        action_url(report), {"action": action, "reason": reason, **extra}, format="json"
    )


@pytest.fixture
def admin_client(client_for, admin_user):
    return client_for(admin_user)


@pytest.fixture
def report():
    return ReportFactory()


@pytest.fixture
def resolved_signals():
    received = []

    def handler(sender, report, admin, action, **kwargs):
        received.append((report.id, admin.id, action))

    signals.report_resolved.connect(handler)
    yield received
    signals.report_resolved.disconnect(handler)


def test_review_endpoints_are_admin_only(api_client, client_for, user, report):
    member = client_for(user)

    assert api_client.get(QUEUE_URL).status_code == 401
    assert member.get(QUEUE_URL).status_code == 403
    assert member.get(f"{QUEUE_URL}{report.id}/").status_code == 403
    assert review(member, report, "hide").status_code == 403
    report.refresh_from_db()
    assert report.status == Report.Status.OPEN


def test_queue_lists_open_reports_newest_first(admin_client):
    older = ReportFactory()
    newer = ReportFactory()
    ReportFactory(status=Report.Status.RESOLVED)

    data = admin_client.get(QUEUE_URL).json()["data"]

    assert [item["id"] for item in data["items"]] == [newer.id, older.id]
    item = data["items"][0]
    assert item["craft"]["name"] == newer.craft.name
    assert item["reporter"]["id"] == newer.reporter.id
    assert item["actions"] == []


@pytest.mark.parametrize(("status", "expected"), [("resolved", 1), ("dismissed", 0), ("all", 2)])
def test_queue_status_filter(admin_client, status, expected):
    ReportFactory()
    ReportFactory(status=Report.Status.RESOLVED)

    assert admin_client.get(QUEUE_URL, {"status": status}).json()["data"]["total"] == expected


def test_queue_rejects_unknown_status(admin_client):
    assert admin_client.get(QUEUE_URL, {"status": "maybe"}).status_code == 400


def test_report_detail(admin_client, report):
    data = admin_client.get(f"{QUEUE_URL}{report.id}/").json()["data"]

    assert data["note"] == report.note
    assert data["craft"]["author"]["id"] == report.craft.author_id


def test_hide_resolves_report_and_records_action(
    admin_client, admin_user, api_client, client_for, report
):
    response = review(admin_client, report, "hide")

    data = response.json()["data"]
    assert response.status_code == 200
    assert data["status"] == "resolved"
    assert data["actions"][0]["action"] == "hide"
    assert data["actions"][0]["admin"]["id"] == admin_user.id
    craft = Craft.objects.get(pk=report.craft_id)
    assert craft.status == Craft.Status.HIDDEN
    assert api_client.get(f"/api/v1/crafts/{craft.id}/").status_code == 404
    assert client_for(craft.author).get(f"/api/v1/crafts/{craft.id}/").status_code == 200


def test_remove_soft_deletes_the_craft(admin_client, report):
    review(admin_client, report, "remove")

    assert Craft.all_objects.get(pk=report.craft_id).is_deleted is True
    report.refresh_from_db()
    assert report.status == Report.Status.RESOLVED


def test_dismiss_leaves_the_craft_unchanged(admin_client, report):
    data = review(admin_client, report, "dismiss").json()["data"]

    assert data["status"] == "dismissed"
    craft = Craft.objects.get(pk=report.craft_id)
    assert craft.status == Craft.Status.PUBLISHED


def test_edit_applies_changes_to_the_craft(admin_client, report):
    response = review(admin_client, report, "edit", changes={"description": "Corrected text."})

    assert response.status_code == 200
    assert Craft.objects.get(pk=report.craft_id).description == "Corrected text."


def test_edit_requires_changes(admin_client, report):
    response = review(admin_client, report, "edit")

    assert response.status_code == 400
    assert "changes" in response.json()["errors"]
    report.refresh_from_db()
    assert report.status == Report.Status.OPEN


def test_edit_changes_are_validated(admin_client, report):
    places = [{"address": "Nowhere", "latitude": 200, "longitude": 0}]
    response = review(admin_client, report, "edit", changes={"places": places})

    assert response.status_code == 400
    assert "places" in response.json()["errors"]["changes"]


def test_reason_is_required(admin_client, report):
    response = admin_client.post(action_url(report), {"action": "hide"}, format="json")

    assert response.status_code == 400
    assert "reason" in response.json()["errors"]


def test_hiding_closes_other_open_reports_on_the_craft(admin_client, report):
    other = ReportFactory(craft=report.craft)
    unrelated = ReportFactory()

    review(admin_client, report, "hide")

    other.refresh_from_db()
    unrelated.refresh_from_db()
    assert other.status == Report.Status.RESOLVED
    assert other.actions.get().action == ReviewAction.Action.HIDE
    assert unrelated.status == Report.Status.OPEN


def test_dismissing_keeps_other_reports_open(admin_client, report):
    other = ReportFactory(craft=report.craft)

    review(admin_client, report, "dismiss")

    other.refresh_from_db()
    assert other.status == Report.Status.OPEN


def test_report_can_be_reviewed_only_once(admin_client, report):
    review(admin_client, report, "dismiss")

    response = review(admin_client, report, "hide")

    assert response.status_code == 409
    assert Craft.objects.get(pk=report.craft_id).status == Craft.Status.PUBLISHED


def test_unknown_report_returns_404(admin_client):
    assert (
        admin_client.post(
            f"{QUEUE_URL}999999/actions/", {"action": "hide", "reason": "x"}, format="json"
        ).status_code
        == 404
    )


def test_reporters_are_signalled(admin_client, admin_user, report, resolved_signals):
    other = ReportFactory(craft=report.craft)

    review(admin_client, report, "hide")

    assert sorted(resolved_signals) == sorted(
        [(report.id, admin_user.id, "hide"), (other.id, admin_user.id, "hide")]
    )


def test_django_admin_action_uses_the_same_service(client):
    staff_admin = AdminFactory(is_staff=True, is_superuser=True)
    report = ReportFactory()
    client.force_login(staff_admin)

    response = client.post(
        "/admin/moderation/report/",
        {"action": "hide_crafts", "_selected_action": [report.id]},
        follow=True,
    )

    assert response.status_code == 200
    report.refresh_from_db()
    assert report.status == Report.Status.RESOLVED
    assert report.actions.get().admin == staff_admin
    assert Craft.objects.get(pk=report.craft_id).status == Craft.Status.HIDDEN


def test_staff_without_admin_role_cannot_review_in_django_admin(client):
    staff_member = UserFactory(is_staff=True, is_superuser=True)
    report = ReportFactory()
    client.force_login(staff_member)

    client.post(
        "/admin/moderation/report/",
        {"action": "hide_crafts", "_selected_action": [report.id]},
        follow=True,
    )

    report.refresh_from_db()
    assert report.status == Report.Status.OPEN


def test_admin_cannot_hide_without_admin_role_through_service(report):
    from core.exceptions import PermissionDeniedError
    from moderation.services import review_report

    with pytest.raises(PermissionDeniedError):
        review_report(admin=CraftFactory().author, report_id=report.id, action="hide", reason="x")
