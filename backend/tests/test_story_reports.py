import pytest

from crafts.models import CraftStory
from moderation.models import Report, StoryReport, StoryReviewAction
from notifications.models import Notification
from tests.factories import AdminFactory, CraftFactory, CraftStoryFactory, UserFactory

pytestmark = pytest.mark.django_db

QUEUE_URL = "/api/v1/moderation/story-reports/"


def report_url(story):
    return f"/api/v1/stories/{story.pk}/report/"


def actions_url(report):
    return f"{QUEUE_URL}{report.pk}/actions/"


def report(story, reporter=None, reason="inappropriate"):
    return StoryReport.objects.create(
        story=story, reporter=reporter or UserFactory(), reason=reason, note="Off topic."
    )


# Reporting


def test_a_user_reports_a_story(client_for, user):
    story = CraftStoryFactory()

    response = client_for(user).post(
        report_url(story), {"reason": "disrespectful", "note": "Mocks the weavers."}
    )

    assert response.status_code == 201
    data = response.json()["data"]
    assert (data["story"], data["reason"], data["status"]) == (story.pk, "disrespectful", "open")
    assert StoryReport.objects.get().reporter == user


def test_guests_cannot_report_stories(api_client):
    assert (
        api_client.post(report_url(CraftStoryFactory()), {"reason": "inaccurate"}).status_code
        == 401
    )


def test_writers_cannot_report_their_own_story(client_for):
    story = CraftStoryFactory()

    response = client_for(story.author).post(report_url(story), {"reason": "inaccurate"})

    assert response.status_code == 400
    assert response.json()["message"] == "You cannot report your own story."


def test_a_story_is_reported_once_while_under_review(client_for, user):
    story = CraftStoryFactory()
    client = client_for(user)

    assert client.post(report_url(story), {"reason": "inaccurate"}).status_code == 201
    response = client.post(report_url(story), {"reason": "inaccurate"})

    assert response.status_code == 409
    assert StoryReport.objects.count() == 1


def test_hidden_stories_cannot_be_reported(client_for, user):
    story = CraftStoryFactory(status=CraftStory.Status.HIDDEN)

    assert client_for(user).post(report_url(story), {"reason": "inaccurate"}).status_code == 404


def test_stories_on_hidden_crafts_cannot_be_reported(client_for, user):
    story = CraftStoryFactory(craft=CraftFactory(status="hidden"))

    assert client_for(user).post(report_url(story), {"reason": "inaccurate"}).status_code == 404


def test_a_report_needs_a_known_reason(client_for, user):
    response = client_for(user).post(report_url(CraftStoryFactory()), {"reason": "boring"})

    assert response.status_code == 400
    assert "reason" in response.json()["errors"]


# Reviewing


def test_admins_see_open_story_reports_with_the_story_and_its_craft(client_for):
    story = CraftStoryFactory(text="A story worth checking.")
    open_report = report(story)
    closed = report(CraftStoryFactory())
    closed.status = Report.Status.DISMISSED
    closed.save()

    data = client_for(AdminFactory()).get(QUEUE_URL).json()["data"]

    assert [item["id"] for item in data["items"]] == [open_report.pk]
    item = data["items"][0]
    assert item["story"]["text"] == "A story worth checking."
    assert item["story"]["craft"] == {"id": story.craft_id, "name": story.craft.name}
    assert item["story"]["author"]["id"] == story.author_id
    assert item["note"] == "Off topic."


def test_only_admins_see_the_story_queue(client_for, user):
    assert client_for(user).get(QUEUE_URL).status_code == 403


def test_hiding_a_story_settles_every_open_report_and_notifies_reporters(client_for):
    story = CraftStoryFactory()
    first, second = report(story), report(story)
    admin = AdminFactory()

    response = client_for(admin).post(
        actions_url(first), {"action": "hide", "reason": "Not about the craft."}
    )

    assert response.status_code == 200
    assert response.json()["data"]["actions"][0]["action"] == "hide"
    story.refresh_from_db()
    assert story.status == CraftStory.Status.HIDDEN
    assert set(StoryReport.objects.values_list("status", flat=True)) == {"resolved"}
    assert StoryReviewAction.objects.count() == 2
    notifications = Notification.objects.filter(type=Notification.Type.REPORT_RESOLVED)
    assert {n.recipient_id for n in notifications} == {first.reporter_id, second.reporter_id}
    notification = notifications.get(recipient=first.reporter)
    assert notification.craft_id == story.craft_id
    assert notification.data == {
        "story_report_id": first.pk,
        "subject": "story",
        "action": "hide",
        "report_status": "resolved",
    }


def test_removing_a_story_deletes_it_but_keeps_the_report_readable(client_for, api_client):
    story = CraftStoryFactory(text="Gone soon.")
    open_report = report(story)
    admin = client_for(AdminFactory())

    admin.post(actions_url(open_report), {"action": "remove", "reason": "Spam."})

    assert CraftStory.all_objects.get(pk=story.pk).is_deleted
    assert api_client.get(f"/api/v1/crafts/{story.craft_id}/stories/").json()["data"]["total"] == 0
    detail = admin.get(f"{QUEUE_URL}{open_report.pk}/").json()["data"]
    assert (detail["story"]["text"], detail["story"]["is_deleted"]) == ("Gone soon.", True)
    assert detail["status"] == "resolved"


def test_dismissing_a_report_leaves_the_story_and_other_reports(client_for):
    story = CraftStoryFactory()
    dismissed, other = report(story), report(story)

    client_for(AdminFactory()).post(
        actions_url(dismissed), {"action": "dismiss", "reason": "Fine."}
    )

    story.refresh_from_db()
    assert story.status == CraftStory.Status.PUBLISHED
    dismissed.refresh_from_db()
    other.refresh_from_db()
    assert (dismissed.status, other.status) == ("dismissed", "open")
    assert Notification.objects.get().data["action"] == "dismiss"


def test_a_report_is_reviewed_once(client_for):
    open_report = report(CraftStoryFactory())
    admin = client_for(AdminFactory())
    admin.post(actions_url(open_report), {"action": "dismiss", "reason": "Fine."})

    response = admin.post(
        actions_url(open_report), {"action": "hide", "reason": "Changed my mind."}
    )

    assert response.status_code == 409


def test_a_review_needs_an_action_and_a_reason(client_for):
    open_report = report(CraftStoryFactory())

    response = client_for(AdminFactory()).post(actions_url(open_report), {"action": "edit"})

    assert response.status_code == 400
    assert set(response.json()["errors"]) == {"action", "reason"}


def test_users_cannot_review_story_reports(client_for, user):
    open_report = report(CraftStoryFactory())

    response = client_for(user).post(actions_url(open_report), {"action": "hide", "reason": "x"})

    assert response.status_code == 403
