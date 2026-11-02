from django.conf import settings
from django.db import models

from core.models import BaseModel


class Notification(BaseModel):
    class Type(models.TextChoices):
        NEW_CRAFT_FROM_FOLLOWED = "new_craft_from_followed", "New craft from someone you follow"
        FAVORITE_UPDATED = "favorite_updated", "A favorited craft was updated"
        REPORT_RESOLVED = "report_resolved", "Your report was reviewed"
        NEW_STORY = "new_story", "Someone shared a story about your craft"

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    type = models.CharField(max_length=30, choices=Type.choices)
    craft = models.ForeignKey(
        "crafts.Craft", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    data = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["recipient", "is_read"], name="notification_unread_idx"),
        ]

    def __str__(self):
        return f"{self.get_type_display()} for {self.recipient_id}"
