from django.conf import settings
from django.db import models

from core.models import BaseModel


class Favorite(BaseModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorites"
    )
    craft = models.ForeignKey("crafts.Craft", on_delete=models.CASCADE, related_name="favorites")

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "craft"], name="unique_favorite"),
        ]

    def __str__(self):
        return f"{self.user_id} favorited {self.craft_id}"


class Follow(BaseModel):
    follower = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="following"
    )
    following = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="followers"
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["follower", "following"], name="unique_follow"),
            models.CheckConstraint(
                condition=~models.Q(follower=models.F("following")), name="no_self_follow"
            ),
        ]

    def __str__(self):
        return f"{self.follower_id} follows {self.following_id}"
