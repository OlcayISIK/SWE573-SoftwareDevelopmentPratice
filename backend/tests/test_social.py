import pytest

from crafts.models import Craft
from social.models import Favorite, Follow
from tests.factories import CraftFactory, UserFactory

pytestmark = pytest.mark.django_db

MY_FAVORITES_URL = "/api/v1/me/favorites/"


def favorite_url(craft):
    return f"/api/v1/crafts/{craft.id}/favorite/"


def follow_url(user):
    return f"/api/v1/users/{user.id}/follow/"


@pytest.fixture
def craft():
    return CraftFactory()


def test_favorite_and_unfavorite(client_for, user, craft):
    client = client_for(user)

    added = client.post(favorite_url(craft))
    again = client.post(favorite_url(craft))
    removed = client.delete(favorite_url(craft))

    assert added.status_code == 201
    assert added.json()["data"] == {"favorited": True, "favorites_count": 1}
    assert again.status_code == 200
    assert Favorite.objects.count() == 0
    assert removed.status_code == 204


def test_favorite_status_for_guests_and_users(api_client, client_for, user, craft):
    client_for(UserFactory()).post(favorite_url(craft))
    client_for(user).post(favorite_url(craft))

    assert api_client.get(favorite_url(craft)).json()["data"] == {
        "favorited": False,
        "favorites_count": 2,
    }
    assert client_for(user).get(favorite_url(craft)).json()["data"]["favorited"] is True


def test_guest_cannot_favorite(api_client, craft):
    assert api_client.post(favorite_url(craft)).status_code == 401


def test_cannot_favorite_a_craft_the_user_cannot_see(client_for, user):
    hidden = CraftFactory(status=Craft.Status.HIDDEN)

    assert client_for(user).post(favorite_url(hidden)).status_code == 404


def test_my_favorites_lists_most_recent_first(client_for, user):
    first, second = CraftFactory(name="First"), CraftFactory(name="Second")
    client = client_for(user)
    client.post(favorite_url(first))
    client.post(favorite_url(second))

    data = client.get(MY_FAVORITES_URL).json()["data"]

    assert [item["name"] for item in data["items"]] == ["Second", "First"]


def test_my_favorites_excludes_hidden_and_removed_crafts(client_for, user):
    visible, hidden, removed = CraftFactory.create_batch(3)
    client = client_for(user)
    for craft in (visible, hidden, removed):
        client.post(favorite_url(craft))
    Craft.objects.filter(pk=hidden.pk).update(status=Craft.Status.HIDDEN)
    Craft.objects.filter(pk=removed.pk).update(is_deleted=True)

    data = client.get(MY_FAVORITES_URL).json()["data"]

    assert [item["id"] for item in data["items"]] == [visible.id]
    assert Favorite.objects.filter(user=user).count() == 3


def test_my_favorites_requires_login(api_client):
    assert api_client.get(MY_FAVORITES_URL).status_code == 401


def test_follow_and_unfollow(client_for, user):
    target = UserFactory()
    client = client_for(user)

    followed = client.post(follow_url(target))
    status_after = client.get(follow_url(target)).json()["data"]
    unfollowed = client.delete(follow_url(target))

    assert followed.status_code == 201
    assert status_after == {"following": True, "followers_count": 1, "following_count": 0}
    assert unfollowed.status_code == 204
    assert not Follow.objects.exists()


def test_follow_twice_is_idempotent(client_for, user):
    target = UserFactory()
    client = client_for(user)
    client.post(follow_url(target))

    response = client.post(follow_url(target))

    assert response.status_code == 200
    assert Follow.objects.count() == 1


def test_cannot_follow_yourself(client_for, user):
    response = client_for(user).post(follow_url(user))

    assert response.status_code == 400
    assert not Follow.objects.exists()


def test_cannot_follow_unavailable_user(client_for, user):
    inactive = UserFactory(is_active=False)

    assert client_for(user).post(follow_url(inactive)).status_code == 404


def test_follow_counts_are_public(api_client, client_for):
    target = UserFactory()
    for _ in range(2):
        client_for(UserFactory()).post(follow_url(target))

    data = api_client.get(follow_url(target)).json()["data"]

    assert data == {"following": False, "followers_count": 2, "following_count": 0}


def test_guest_cannot_follow(api_client):
    assert api_client.post(follow_url(UserFactory())).status_code == 401


MY_FOLLOWING_URL = "/api/v1/me/following/"
MY_FOLLOWERS_URL = "/api/v1/me/followers/"


def test_my_following_lists_people_most_recent_first(client_for, user):
    first, second = UserFactory(), UserFactory()
    first.profile.display_name, first.profile.city = "Mehmet", "Uşak"
    first.profile.save()
    client = client_for(user)
    client.post(follow_url(first))
    client.post(follow_url(second))

    data = client.get(MY_FOLLOWING_URL).json()["data"]

    assert data["total"] == 2
    assert [item["user"]["id"] for item in data["items"]] == [second.id, first.id]
    assert data["items"][1]["user"]["display_name"] == "Mehmet"
    assert data["items"][1]["user"]["city"] == "Uşak"
    assert set(data["items"][0]["user"]) == {"id", "display_name", "avatar", "city", "country"}
    assert data["items"][0]["since"]


def test_my_followers_lists_people_following_me(client_for, user):
    fan = UserFactory()
    client_for(fan).post(follow_url(user))

    data = client_for(user).get(MY_FOLLOWERS_URL).json()["data"]

    assert [item["user"]["id"] for item in data["items"]] == [fan.id]


def test_follow_lists_never_expose_email(client_for, user):
    other = UserFactory()
    client_for(user).post(follow_url(other))

    body = client_for(user).get(MY_FOLLOWING_URL).content.decode()

    assert other.email not in body


def test_follow_lists_leave_out_deactivated_accounts(client_for, user):
    gone = UserFactory()
    client_for(user).post(follow_url(gone))
    gone.is_active = False
    gone.save()

    assert client_for(user).get(MY_FOLLOWING_URL).json()["data"]["total"] == 0


def test_follow_lists_require_login(api_client):
    assert api_client.get(MY_FOLLOWING_URL).status_code == 401
    assert api_client.get(MY_FOLLOWERS_URL).status_code == 401
