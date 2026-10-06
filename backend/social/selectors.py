from django.db.models import OuterRef, Subquery

from crafts.selectors import browse_crafts

from .models import Favorite, Follow


def favorite_status(viewer, craft):
    favorites = Favorite.objects.filter(craft=craft)
    favorited = bool(viewer and viewer.is_authenticated and favorites.filter(user=viewer).exists())
    return {"favorited": favorited, "favorites_count": favorites.count()}


def favorite_crafts(user):
    """The user's favorites that they can still see, most recently favorited first."""
    favorited_at = Favorite.objects.filter(user=user, craft=OuterRef("pk")).values("created_at")
    return (
        browse_crafts(user)
        .filter(pk__in=Favorite.objects.filter(user=user).values("craft_id"))
        .annotate(favorited_at=Subquery(favorited_at[:1]))
        .order_by("-favorited_at")
    )


def follow_status(viewer, user):
    following = bool(
        viewer
        and viewer.is_authenticated
        and Follow.objects.filter(follower=viewer, following=user).exists()
    )
    return {
        "following": following,
        "followers_count": Follow.objects.filter(following=user).count(),
        "following_count": Follow.objects.filter(follower=user).count(),
    }


def follower_ids(user_id):
    return list(Follow.objects.filter(following_id=user_id).values_list("follower_id", flat=True))


def favoriter_ids(craft_id):
    return list(Favorite.objects.filter(craft_id=craft_id).values_list("user_id", flat=True))
