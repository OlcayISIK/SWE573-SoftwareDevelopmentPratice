from accounts.selectors import get_public_user
from core.exceptions import ValidationError
from crafts.selectors import get_visible_craft

from .models import Favorite, Follow

SELF_FOLLOW = "You cannot follow yourself."


def favorite_craft(*, user, craft_id):
    craft = get_visible_craft(craft_id, user)
    _, created = Favorite.objects.get_or_create(user=user, craft=craft)
    return craft, created


def unfavorite_craft(*, user, craft_id):
    Favorite.objects.filter(user=user, craft_id=craft_id).delete()


def follow_user(*, follower, user_id):
    target = get_public_user(user_id)
    if target.pk == follower.pk:
        raise ValidationError(SELF_FOLLOW)
    _, created = Follow.objects.get_or_create(follower=follower, following=target)
    return target, created


def unfollow_user(*, follower, user_id):
    Follow.objects.filter(follower=follower, following_id=user_id).delete()
