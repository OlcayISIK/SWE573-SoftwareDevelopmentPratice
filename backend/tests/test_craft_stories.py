import pytest

from crafts.models import MAX_STORY_LENGTH, CraftStory
from notifications.models import Notification
from tests.factories import AdminFactory, CraftFactory, CraftStoryFactory, UserFactory

pytestmark = pytest.mark.django_db


def stories_url(craft):
    return f"/api/v1/crafts/{craft.pk}/stories/"


def story_url(story):
    return f"/api/v1/crafts/{story.craft_id}/stories/{story.pk}/"


# Listing


def test_anyone_can_read_the_stories_oldest_first_with_their_writers(api_client):
    craft = CraftFactory()
    first = CraftStoryFactory(craft=craft, text="First story.")
    second = CraftStoryFactory(craft=craft, text="Second story.")

    data = api_client.get(stories_url(craft)).json()["data"]

    assert data["total"] == 2
    assert [item["text"] for item in data["items"]] == ["First story.", "Second story."]
    assert data["items"][0]["author"] == {
        "id": first.author_id,
        "display_name": first.author.profile.display_name,
    }
    assert data["items"][1]["id"] == second.pk


def test_stories_come_ten_to_a_page(api_client):
    craft = CraftFactory()
    CraftStoryFactory.create_batch(12, craft=craft)

    first = api_client.get(stories_url(craft)).json()["data"]
    second = api_client.get(stories_url(craft), {"page": 2}).json()["data"]

    assert (len(first["items"]), first["totalPages"]) == (10, 2)
    assert len(second["items"]) == 2


def test_the_list_can_be_narrowed_to_one_writer(api_client):
    craft = CraftFactory()
    CraftStoryFactory(craft=craft)
    mine = CraftStoryFactory(craft=craft)

    data = api_client.get(stories_url(craft), {"author": mine.author_id}).json()["data"]

    assert [item["id"] for item in data["items"]] == [mine.pk]


def test_hidden_and_deleted_stories_are_not_listed(api_client):
    craft = CraftFactory()
    shown = CraftStoryFactory(craft=craft)
    CraftStoryFactory(craft=craft, status=CraftStory.Status.HIDDEN)
    CraftStoryFactory(craft=craft).delete()

    items = api_client.get(stories_url(craft)).json()["data"]["items"]

    assert [item["id"] for item in items] == [shown.pk]


def test_stories_of_a_hidden_craft_are_not_found(api_client):
    craft = CraftFactory(status="hidden")
    CraftStoryFactory(craft=craft)

    assert api_client.get(stories_url(craft)).status_code == 404


def test_the_craft_shows_how_many_stories_it_has(api_client):
    craft = CraftFactory()
    CraftStoryFactory.create_batch(2, craft=craft)
    CraftStoryFactory(craft=craft, status=CraftStory.Status.HIDDEN)

    data = api_client.get(f"/api/v1/crafts/{craft.pk}/").json()["data"]

    assert data["story_count"] == 2


def test_listing_stories_takes_the_same_queries_however_many_there_are(
    api_client, django_assert_max_num_queries
):
    craft = CraftFactory()
    CraftStoryFactory.create_batch(10, craft=craft)

    with django_assert_max_num_queries(4):
        api_client.get(stories_url(craft))


# Sharing


def test_a_user_shares_a_story_about_a_craft(client_for, user):
    craft = CraftFactory()

    response = client_for(user).post(stories_url(craft), {"text": "  We make these in Avanos.  "})

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["text"] == "We make these in Avanos."
    assert data["author"]["id"] == user.pk
    assert CraftStory.objects.get().author == user


def test_the_craft_author_is_notified_of_a_new_story(client_for, user):
    craft = CraftFactory()

    story_id = client_for(user).post(stories_url(craft), {"text": "A story."}).json()["data"]["id"]

    notification = Notification.objects.get(recipient=craft.author)
    assert notification.type == Notification.Type.NEW_STORY
    assert (notification.craft_id, notification.actor_id) == (craft.pk, user.pk)
    assert notification.data == {"story_id": story_id}


def test_guests_cannot_share_stories(api_client):
    craft = CraftFactory()

    assert api_client.post(stories_url(craft), {"text": "A story."}).status_code == 401


def test_unverified_users_cannot_share_stories(client_for, unverified_user):
    craft = CraftFactory()

    response = client_for(unverified_user).post(stories_url(craft), {"text": "A story."})

    assert response.status_code == 403
    assert not CraftStory.objects.exists()


def test_the_craft_author_tells_their_story_in_the_craft_itself(client_for):
    craft = CraftFactory()

    response = client_for(craft.author).post(stories_url(craft), {"text": "A story."})

    assert response.status_code == 403
    assert "Story field" in response.json()["message"]


def test_a_user_has_one_story_per_craft(client_for, user):
    craft = CraftFactory()
    CraftStoryFactory(craft=craft, author=user)

    response = client_for(user).post(stories_url(craft), {"text": "Another story."})

    assert response.status_code == 409
    assert "Edit it instead" in response.json()["message"]


def test_a_user_whose_story_was_hidden_is_told_so(client_for, user):
    craft = CraftFactory()
    CraftStoryFactory(craft=craft, author=user, status=CraftStory.Status.HIDDEN)

    response = client_for(user).post(stories_url(craft), {"text": "Another story."})

    assert response.status_code == 409
    assert "hidden by an admin" in response.json()["message"]


def test_a_deleted_story_can_be_written_again(client_for, user):
    craft = CraftFactory()
    CraftStoryFactory(craft=craft, author=user).delete()

    response = client_for(user).post(stories_url(craft), {"text": "A new story."})

    assert response.status_code == 201


@pytest.mark.parametrize("text", ["", "   ", "x" * (MAX_STORY_LENGTH + 1)])
def test_a_story_needs_text_within_the_limit(client_for, user, text):
    craft = CraftFactory()

    response = client_for(user).post(stories_url(craft), {"text": text})

    assert response.status_code == 400
    assert "text" in response.json()["errors"]


# Editing and deleting


def test_the_writer_edits_their_story(client_for):
    story = CraftStoryFactory()

    response = client_for(story.author).patch(story_url(story), {"text": "Told better."})

    assert response.status_code == 200
    assert response.json()["data"]["text"] == "Told better."
    story.refresh_from_db()
    assert story.text == "Told better."


def test_other_users_cannot_edit_or_delete_a_story(client_for):
    story = CraftStoryFactory()
    other = client_for(UserFactory())

    assert other.patch(story_url(story), {"text": "Mine now."}).status_code == 403
    assert other.delete(story_url(story)).status_code == 403
    story.refresh_from_db()
    assert (story.text, story.is_deleted) != ("Mine now.", True)


def test_admins_can_edit_and_delete_any_story(client_for):
    story = CraftStoryFactory()
    admin = client_for(AdminFactory())

    assert admin.patch(story_url(story), {"text": "Edited by an admin."}).status_code == 200
    assert admin.delete(story_url(story)).status_code == 204


def test_the_writer_deletes_their_story(client_for, api_client):
    story = CraftStoryFactory()

    assert client_for(story.author).delete(story_url(story)).status_code == 204

    assert not CraftStory.objects.filter(pk=story.pk).exists()
    assert CraftStory.all_objects.get(pk=story.pk).is_deleted
    assert api_client.get(stories_url(story.craft)).json()["data"]["total"] == 0


def test_a_hidden_story_is_found_only_by_its_writer(client_for):
    story = CraftStoryFactory(status=CraftStory.Status.HIDDEN)

    assert client_for(UserFactory()).patch(story_url(story), {"text": "x"}).status_code == 404
    assert client_for(story.author).delete(story_url(story)).status_code == 204


def test_a_story_of_another_craft_is_not_found(client_for):
    story = CraftStoryFactory()
    other_craft = CraftFactory()

    response = client_for(story.author).patch(
        f"/api/v1/crafts/{other_craft.pk}/stories/{story.pk}/", {"text": "x"}
    )

    assert response.status_code == 404
