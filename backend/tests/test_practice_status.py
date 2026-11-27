"""Whether crafts are still practiced: proposals with a source, admin review, and the filter."""

import pytest

from crafts.models import Craft, CraftType, Culture, PracticeStatusChange
from notifications.models import Notification
from social.models import Favorite
from tests.factories import AdminFactory, CraftFactory, UserFactory

pytestmark = pytest.mark.django_db

CRAFTS = "/api/v1/crafts/"
QUEUE = "/api/v1/moderation/status-proposals/"
UNESCO = "UNESCO List of Intangible Cultural Heritage in Need of Urgent Safeguarding"


def propose_url(craft):
    return f"{CRAFTS}{craft.pk}/practice-status/proposals/"


def set_url(craft):
    return f"{CRAFTS}{craft.pk}/practice-status/"


def review_url(proposal_id):
    return f"{QUEUE}{proposal_id}/actions/"


def propose(client, craft, **fields):
    body = {"practice_status": "endangered", "source": UNESCO, **fields}
    return client.post(propose_url(craft), body, format="json")


@pytest.fixture
def craft():
    return CraftFactory(name="Shirvan kilim")


# Crafts start unknown


def test_crafts_start_with_an_unknown_status(api_client, craft):
    detail = api_client.get(f"{CRAFTS}{craft.pk}/").json()["data"]
    item = api_client.get(CRAFTS).json()["data"]["items"][0]

    assert (detail["practice_status"], detail["practice_status_source"]) == ("unknown", "")
    assert item["practice_status"] == "unknown"


# The author sets it in the craft form


def craft_body(**fields):
    craft_type = CraftType.objects.first()
    return {
        "name": "Ebru",
        "category": craft_type.category_id,
        "craft_type": craft_type.pk,
        "culture": Culture.objects.first().pk,
        "description": "Marbled paper.",
        "places": [{"address": "Istanbul", "latitude": 41.0, "longitude": 29.0}],
        **fields,
    }


def test_the_author_sets_the_status_when_publishing_without_review(client_for, user):
    response = client_for(user).post(
        CRAFTS,
        craft_body(practice_status="endangered", practice_status_source=UNESCO),
        format="json",
    )

    assert response.status_code == 201, response.json()
    data = response.json()["data"]
    assert (data["practice_status"], data["practice_status_source"]) == ("endangered", UNESCO)
    (change,) = PracticeStatusChange.objects.filter(craft_id=data["id"])
    assert (change.old_status, change.new_status, change.changed_by) == (
        "unknown",
        "endangered",
        user,
    )


def test_a_source_is_optional_for_the_author(client_for, user):
    response = client_for(user).post(CRAFTS, craft_body(practice_status="living"), format="json")

    assert response.status_code == 201, response.json()
    assert response.json()["data"]["practice_status_source"] == ""


def test_the_author_changes_the_status_when_editing(client_for, craft):
    fan = UserFactory()
    Favorite.objects.create(user=fan, craft=craft)
    author = client_for(craft.author)

    changed = author.patch(
        f"{CRAFTS}{craft.pk}/", {"practice_status": "no_longer_practiced"}, format="json"
    )
    # Saving the form again without changing the status records nothing.
    author.patch(
        f"{CRAFTS}{craft.pk}/",
        {"name": "Shirvan carpet", "practice_status": "no_longer_practiced"},
        format="json",
    )

    assert changed.status_code == 200, changed.json()
    assert changed.json()["data"]["practice_status"] == "no_longer_practiced"
    assert PracticeStatusChange.objects.filter(craft=craft).count() == 1
    # Favoriters hear about the new status.
    assert Notification.objects.filter(
        recipient=fan, type=Notification.Type.PRACTICE_STATUS_CHANGED
    ).exists()
    # Others cannot change it in the form.
    other = client_for(UserFactory()).patch(
        f"{CRAFTS}{craft.pk}/", {"practice_status": "living"}, format="json"
    )
    assert other.status_code == 403


def test_an_unknown_status_keeps_no_source(client_for, user):
    response = client_for(user).post(
        CRAFTS, craft_body(practice_status="unknown", practice_status_source="x"), format="json"
    )

    assert response.json()["data"]["practice_status_source"] == ""


# Other users report it


def test_users_propose_a_status_with_its_source(client_for, user, craft):
    response = propose(client_for(user), craft, note="Few workshops are left.")

    assert response.status_code == 201, response.json()
    data = response.json()["data"]
    assert (data["practice_status"], data["source"], data["note"], data["status"]) == (
        "endangered",
        UNESCO,
        "Few workshops are left.",
        "open",
    )
    # The craft keeps its status until an admin approves.
    craft.refresh_from_db()
    assert craft.practice_status == Craft.PracticeStatus.UNKNOWN


@pytest.mark.parametrize("source", ["", "   ", None])
def test_a_report_needs_a_source_or_a_note(client_for, user, craft, source):
    body = {"practice_status": "living"}
    if source is not None:
        body["source"] = source

    response = client_for(user).post(propose_url(craft), body, format="json")
    with_note = client_for(user).post(
        propose_url(craft), {**body, "note": "I visited; nobody weaves it."}, format="json"
    )

    assert response.status_code == 400
    assert response.json()["errors"] == {
        "source": ["Give a source, or a note that says why the status is wrong."]
    }
    assert with_note.status_code == 201


def test_unsure_users_report_a_status_as_unknown(client_for, user, craft):
    Craft.objects.filter(pk=craft.pk).update(practice_status="living")

    response = propose(client_for(user), craft, practice_status="unknown", source="")
    same = propose(client_for(UserFactory()), craft, practice_status="living")

    assert response.status_code == 400  # Needs a source or a note.
    with_note = propose(client_for(user), craft, practice_status="unknown", note="No source.")
    assert with_note.status_code == 201
    # The status the craft already has is not a report.
    assert same.status_code == 400
    assert "practice_status" in same.json()["errors"]


def test_authors_do_not_report_their_own_craft(client_for, craft):
    response = propose(client_for(craft.author), craft)

    assert response.status_code == 400
    assert "edit form" in response.json()["message"]


def test_a_user_has_one_open_proposal_per_craft(client_for, user, craft):
    client = client_for(user)

    assert propose(client, craft).status_code == 201
    again = propose(client, craft, practice_status="living")

    assert again.status_code == 409
    assert "already reported" in again.json()["message"]
    # Others can still propose, and so can the user for another craft.
    assert propose(client_for(UserFactory()), craft).status_code == 201
    assert propose(client, CraftFactory()).status_code == 201


def test_a_user_proposes_again_after_the_review(client_for, user, craft):
    client = client_for(user)
    first = propose(client, craft).json()["data"]["id"]
    client_for(AdminFactory()).post(
        review_url(first), {"action": "rejected", "reason": "Not a source."}, format="json"
    )

    assert propose(client, craft).status_code == 201


def test_guests_unverified_users_and_unseen_crafts_cannot_be_proposed(
    api_client, client_for, craft
):
    hidden = CraftFactory(status=Craft.Status.HIDDEN)

    assert propose(api_client, craft).status_code == 401
    unverified = propose(client_for(UserFactory(is_email_verified=False)), craft)
    assert unverified.status_code == 403
    assert propose(client_for(UserFactory()), hidden).status_code == 404


# Reviewing


def test_admins_list_proposals_open_ones_first(client_for, craft):
    admin = client_for(AdminFactory())
    reviewed = propose(client_for(UserFactory()), craft).json()["data"]["id"]
    admin.post(review_url(reviewed), {"action": "rejected", "reason": "No."}, format="json")
    waiting = propose(client_for(UserFactory()), CraftFactory()).json()["data"]["id"]

    everything = admin.get(QUEUE).json()["data"]["items"]
    rejected = admin.get(QUEUE, {"status": "rejected"}).json()["data"]["items"]

    assert [row["id"] for row in everything] == [waiting, reviewed]
    assert everything[0]["craft"]["name"]
    assert [row["id"] for row in rejected] == [reviewed]
    assert rejected[0]["reviewed_by"]["display_name"]
    assert client_for(UserFactory()).get(QUEUE).status_code == 403


def test_approving_sets_the_status_and_source_and_records_the_change(client_for, user, craft):
    admin_user = AdminFactory()
    proposal = propose(client_for(user), craft).json()["data"]["id"]

    response = client_for(admin_user).post(
        review_url(proposal), {"action": "approved", "reason": "On the list."}, format="json"
    )

    assert response.status_code == 200, response.json()
    data = response.json()["data"]
    assert data["status"] == "approved"
    assert data["review_reason"] == "On the list."
    assert data["craft"]["practice_status"] == "endangered"
    craft.refresh_from_db()
    assert (craft.practice_status, craft.practice_status_source) == ("endangered", UNESCO)
    (change,) = PracticeStatusChange.objects.filter(craft=craft)
    assert (change.old_status, change.new_status, change.source, change.reason) == (
        "unknown",
        "endangered",
        UNESCO,
        "On the list.",
    )
    assert change.changed_by == admin_user


def test_rejecting_leaves_the_craft_as_it_was(client_for, user, craft):
    proposal = propose(client_for(user), craft).json()["data"]["id"]

    response = client_for(AdminFactory()).post(
        review_url(proposal), {"action": "rejected", "reason": "A blog post."}, format="json"
    )

    assert response.json()["data"]["status"] == "rejected"
    craft.refresh_from_db()
    assert craft.practice_status == Craft.PracticeStatus.UNKNOWN
    assert not PracticeStatusChange.objects.exists()


def test_a_proposal_is_reviewed_once_and_only_by_admins(client_for, user, craft):
    proposal = propose(client_for(user), craft).json()["data"]["id"]
    body = {"action": "approved", "reason": "Yes."}
    admin = client_for(AdminFactory())

    assert client_for(UserFactory()).post(review_url(proposal), body).status_code == 403
    assert admin.post(review_url(proposal), body, format="json").status_code == 200
    again = admin.post(review_url(proposal), {**body, "action": "rejected"}, format="json")
    assert again.status_code == 409
    assert admin.post(review_url(999999), body, format="json").status_code == 404


# Setting the status directly


def test_admins_set_the_status_directly_with_a_source_and_reason(client_for, craft):
    admin = client_for(AdminFactory())

    response = admin.post(
        set_url(craft),
        {"practice_status": "living", "source": "Field visit, 2025", "reason": "Checked."},
        format="json",
    )

    assert response.status_code == 200, response.json()
    data = response.json()["data"]
    assert (data["practice_status"], data["practice_status_source"]) == (
        "living",
        "Field visit, 2025",
    )
    assert PracticeStatusChange.objects.get(craft=craft).reason == "Checked."


def test_setting_a_status_needs_a_source_unless_it_is_unknown(client_for, craft):
    admin = client_for(AdminFactory())

    without = admin.post(
        set_url(craft), {"practice_status": "living", "reason": "Checked."}, format="json"
    )
    back_to_unknown = admin.post(
        set_url(craft), {"practice_status": "unknown", "reason": "Wrong earlier."}, format="json"
    )

    assert without.status_code == 400
    assert "source" in without.json()["errors"]
    assert back_to_unknown.status_code == 200


def test_only_admins_set_the_status(api_client, client_for, craft):
    body = {"practice_status": "living", "source": "x", "reason": "y"}

    assert api_client.post(set_url(craft), body, format="json").status_code == 401
    assert client_for(craft.author).post(set_url(craft), body, format="json").status_code == 403


# Notifications


def test_the_proposer_is_notified_of_the_decision(client_for, user, craft):
    proposal = propose(client_for(user), craft).json()["data"]["id"]

    client_for(AdminFactory()).post(
        review_url(proposal), {"action": "rejected", "reason": "No."}, format="json"
    )

    notification = Notification.objects.get(recipient=user)
    assert notification.type == Notification.Type.STATUS_PROPOSAL_REVIEWED
    assert notification.craft == craft
    assert notification.data == {
        "proposal_id": proposal,
        "decision": "rejected",
        "practice_status": "endangered",
    }


def test_users_who_favorited_the_craft_are_notified_of_a_change(client_for, user, craft):
    fan, admin_user = UserFactory(), AdminFactory()
    Favorite.objects.create(user=fan, craft=craft)
    Favorite.objects.create(user=admin_user, craft=craft)
    proposal = propose(client_for(user), craft).json()["data"]["id"]

    client_for(admin_user).post(
        review_url(proposal), {"action": "approved", "reason": "Yes."}, format="json"
    )
    # The same status again is not a change.
    client_for(admin_user).post(
        set_url(craft),
        {"practice_status": "endangered", "source": "Another source", "reason": "Updated."},
        format="json",
    )

    changed = Notification.objects.filter(type=Notification.Type.PRACTICE_STATUS_CHANGED)
    # The admin who made the change is not notified.
    assert [(item.recipient, item.data) for item in changed] == [
        (fan, {"old_status": "unknown", "practice_status": "endangered"})
    ]


# The filter


def test_crafts_are_filtered_and_counted_by_practice_status(api_client):
    CraftFactory(name="Living one", practice_status=Craft.PracticeStatus.LIVING)
    CraftFactory(name="Endangered one", practice_status=Craft.PracticeStatus.ENDANGERED)
    CraftFactory(name="Unknown one")

    listing = api_client.get(CRAFTS, {"practice_status": "endangered"}).json()["data"]
    pins = api_client.get(f"{CRAFTS}map/", {"practice_status": "living"}).json()["data"]
    facets = api_client.get(f"{CRAFTS}facets/", {"practice_status": "living"}).json()["data"]
    bad = api_client.get(CRAFTS, {"practice_status": "thriving"})

    assert [item["name"] for item in listing["items"]] == ["Endangered one"]
    assert {pin["name"] for pin in pins} == {"Living one"}
    # The list ignores its own filter, so the other statuses can still be picked.
    assert facets["practice_statuses"] == [
        {"name": "unknown", "count": 1},
        {"name": "living", "count": 1},
        {"name": "endangered", "count": 1},
    ]
    assert facets["categories"][0]["count"] == 1
    assert bad.status_code == 400


# The Django admin


def django_admin(client, user=None):
    client.force_login(user or AdminFactory(is_staff=True, is_superuser=True))
    return client


def run_action(client, action, proposals):
    return client.post(
        "/admin/moderation/statusproposal/",
        {"action": action, "_selected_action": [proposal for proposal in proposals]},
        follow=True,
    )


def test_reports_are_accepted_and_rejected_from_the_django_admin(client, client_for, craft):
    first = propose(client_for(UserFactory()), craft).json()["data"]["id"]
    other = CraftFactory()
    second = propose(client_for(UserFactory()), other).json()["data"]["id"]
    admin_client = django_admin(client)

    accepted = run_action(admin_client, "approve_proposals", [first])
    rejected = run_action(admin_client, "reject_proposals", [second])
    again = run_action(admin_client, "reject_proposals", [first])

    messages = [str(message) for message in accepted.context["messages"]]
    assert "1 report(s) reviewed." in messages
    craft.refresh_from_db()
    assert (craft.practice_status, craft.practice_status_source) == ("endangered", UNESCO)
    assert PracticeStatusChange.objects.filter(craft=craft).exists()
    assert Notification.objects.filter(type=Notification.Type.STATUS_PROPOSAL_REVIEWED).count() == 2
    assert rejected.status_code == 200
    other.refresh_from_db()
    assert other.practice_status == Craft.PracticeStatus.UNKNOWN
    # A report is reviewed once.
    assert any("already reviewed" in str(message) for message in again.context["messages"])
    craft.refresh_from_db()
    assert craft.practice_status == "endangered"


def test_reports_cannot_be_edited_added_or_deleted_in_the_django_admin(client, client_for, craft):
    proposal = propose(client_for(UserFactory()), craft).json()["data"]["id"]
    admin_client = django_admin(client)

    page = admin_client.get(f"/admin/moderation/statusproposal/{proposal}/change/")
    added = admin_client.get("/admin/moderation/statusproposal/add/")

    assert page.status_code == 200
    # Every field is shown as text, so there is nothing to save.
    assert 'name="practice_status"' not in page.content.decode()
    assert "Marked as" in page.content.decode()
    assert added.status_code == 403


def test_staff_without_the_admin_role_cannot_accept_reports(client, client_for, craft):
    proposal = propose(client_for(UserFactory()), craft).json()["data"]["id"]
    staff = django_admin(client, UserFactory(is_staff=True, is_superuser=True))

    response = run_action(staff, "approve_proposals", [proposal])

    assert any("Only admins" in str(message) for message in response.context["messages"])
    craft.refresh_from_db()
    assert craft.practice_status == Craft.PracticeStatus.UNKNOWN
