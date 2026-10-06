import pytest
from django.db import transaction

from crafts import services as craft_services
from crafts import signals as craft_signals
from crafts.models import Category, Craft, Region
from notifications.models import Notification
from tests.factories import CraftFactory, ReportFactory, UserFactory

pytestmark = pytest.mark.django_db

NOTIFICATIONS_URL = "/api/v1/me/notifications/"
UNREAD_URL = "/api/v1/me/notifications/unread-count/"
READ_URL = "/api/v1/me/notifications/read/"


def craft_payload():
    return {
        "name": "Uşak Halısı",
        "craft_type": "Carpet",
        "category": Category.objects.get(slug="textiles").id,
        "region": Region.objects.get(name="Uşak").id,
        "latitude": 38.68,
        "longitude": 29.41,
        "description": "Hand-knotted wool carpet.",
        "production_process": "Knotted by hand on a loom.",
        "how_to_understand": "Medallion layouts are typical.",
        "cultural_relevance": "Exported widely since the 16th century.",
    }


def follow(client_for, follower, author):
    client_for(follower).post(f"/api/v1/users/{author.id}/follow/")


def favorite(client_for, user, craft):
    client_for(user).post(f"/api/v1/crafts/{craft.id}/favorite/")


def items(client):
    return client.get(NOTIFICATIONS_URL).json()["data"]["items"]


def test_followers_are_notified_of_new_crafts(client_for, user):
    author = UserFactory()
    follow(client_for, user, author)
    bystander = UserFactory()

    craft_id = (
        client_for(author)
        .post("/api/v1/crafts/", craft_payload(), format="json")
        .json()["data"]["id"]
    )

    [notification] = items(client_for(user))
    assert notification["type"] == "new_craft_from_followed"
    assert notification["craft"] == {"id": craft_id, "name": "Uşak Halısı"}
    assert notification["actor"]["id"] == author.id
    assert notification["is_read"] is False
    assert items(client_for(bystander)) == []


def test_favoriters_are_notified_of_updates_except_the_editor(client_for, user):
    craft = CraftFactory()
    favorite(client_for, user, craft)
    favorite(client_for, craft.author, craft)

    client_for(craft.author).patch(
        f"/api/v1/crafts/{craft.id}/", {"description": "Updated."}, format="json"
    )

    assert [n["type"] for n in items(client_for(user))] == ["favorite_updated"]
    assert items(client_for(craft.author)) == []


def test_admin_edit_through_moderation_notifies_favoriters(client_for, user, admin_user):
    report = ReportFactory()
    favorite(client_for, user, report.craft)

    client_for(admin_user).post(
        f"/api/v1/moderation/reports/{report.id}/actions/",
        {"action": "edit", "reason": "Fixed facts.", "changes": {"description": "Fixed."}},
        format="json",
    )

    assert "favorite_updated" in [n["type"] for n in items(client_for(user))]


def test_reporters_are_notified_when_reports_are_resolved(client_for, admin_user):
    report = ReportFactory()
    other = ReportFactory(craft=report.craft)

    client_for(admin_user).post(
        f"/api/v1/moderation/reports/{report.id}/actions/",
        {"action": "hide", "reason": "Disrespectful wording."},
        format="json",
    )

    for reviewed in (report, other):
        [notification] = items(client_for(reviewed.reporter))
        assert notification["type"] == "report_resolved"
        assert notification["data"]["action"] == "hide"
        assert notification["data"]["report_status"] == "resolved"
        assert notification["data"]["report_id"] == reviewed.id


def test_dismissed_report_notification(client_for, admin_user):
    report = ReportFactory()

    client_for(admin_user).post(
        f"/api/v1/moderation/reports/{report.id}/actions/",
        {"action": "dismiss", "reason": "Content is accurate."},
        format="json",
    )

    [notification] = items(client_for(report.reporter))
    assert notification["data"]["report_status"] == "dismissed"
    assert notification["craft"]["id"] == report.craft_id


def test_notification_drops_craft_the_user_can_no_longer_see(client_for, user):
    author = UserFactory()
    follow(client_for, user, author)
    craft_id = (
        client_for(author)
        .post("/api/v1/crafts/", craft_payload(), format="json")
        .json()["data"]["id"]
    )

    Craft.objects.filter(pk=craft_id).update(status=Craft.Status.HIDDEN)

    [notification] = items(client_for(user))
    assert notification["craft"] is None
    assert Notification.objects.get().craft_id == craft_id


def test_notifications_roll_back_with_the_change(user):
    author = UserFactory()
    from social.models import Follow

    Follow.objects.create(follower=user, following=author)

    def fail(sender, **kwargs):
        raise RuntimeError("later step failed")

    craft_signals.craft_published.connect(fail, dispatch_uid="test_fail")
    try:
        with pytest.raises(RuntimeError), transaction.atomic():
            craft_services.publish_craft(
                author=author,
                data={
                    **craft_payload(),
                    "category": Category.objects.get(slug="textiles"),
                    "region": Region.objects.get(name="Uşak"),
                },
            )
    finally:
        craft_signals.craft_published.disconnect(dispatch_uid="test_fail")

    assert not Craft.all_objects.exists()
    assert not Notification.objects.exists()


def test_users_see_only_their_own_notifications(client_for, user):
    other = UserFactory()
    Notification.objects.create(recipient=other, type=Notification.Type.FAVORITE_UPDATED)

    assert items(client_for(user)) == []


def test_unread_count_and_mark_selected_as_read(client_for, user):
    first, second, _third = (
        Notification.objects.create(recipient=user, type=Notification.Type.FAVORITE_UPDATED)
        for _ in range(3)
    )
    client = client_for(user)

    assert client.get(UNREAD_URL).json()["data"] == {"count": 3}
    marked = client.post(READ_URL, {"ids": [first.id, second.id]}, format="json")

    assert marked.json()["data"] == {"updated": 2}
    assert client.get(UNREAD_URL).json()["data"] == {"count": 1}
    unread = client.get(NOTIFICATIONS_URL, {"unread": "true"}).json()["data"]["items"]
    assert len(unread) == 1


def test_mark_all_as_read(client_for, user):
    for _ in range(2):
        Notification.objects.create(recipient=user, type=Notification.Type.FAVORITE_UPDATED)

    response = client_for(user).post(READ_URL, {}, format="json")

    assert response.json()["data"] == {"updated": 2}
    assert not Notification.objects.filter(is_read=False).exists()


def test_cannot_mark_other_users_notifications(client_for, user):
    others = Notification.objects.create(
        recipient=UserFactory(), type=Notification.Type.FAVORITE_UPDATED
    )

    response = client_for(user).post(READ_URL, {"ids": [others.id]}, format="json")

    assert response.json()["data"] == {"updated": 0}
    others.refresh_from_db()
    assert others.is_read is False


def test_notifications_require_login(api_client):
    assert api_client.get(NOTIFICATIONS_URL).status_code == 401
    assert api_client.get(UNREAD_URL).status_code == 401
    assert api_client.post(READ_URL, {}, format="json").status_code == 401


def test_notification_list_query_count_is_fixed(client_for, user, django_assert_max_num_queries):
    author = UserFactory()
    for _ in range(10):
        Notification.objects.create(
            recipient=user,
            type=Notification.Type.NEW_CRAFT_FROM_FOLLOWED,
            craft=CraftFactory(author=author),
            actor=author,
        )
    client = client_for(user)

    with django_assert_max_num_queries(4):
        client.get(NOTIFICATIONS_URL)
