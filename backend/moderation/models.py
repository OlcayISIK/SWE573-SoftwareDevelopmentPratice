from django.conf import settings
from django.db import models

from core.models import BaseModel


class Report(BaseModel):
    class Reason(models.TextChoices):
        INACCURATE = "inaccurate", "Inaccurate"
        INAPPROPRIATE = "inappropriate", "Inappropriate"
        DISRESPECTFUL = "disrespectful", "Disrespectful"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        RESOLVED = "resolved", "Resolved"
        DISMISSED = "dismissed", "Dismissed"

    craft = models.ForeignKey("crafts.Craft", on_delete=models.PROTECT, related_name="reports")
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="reports"
    )
    reason = models.CharField(max_length=20, choices=Reason.choices)
    note = models.TextField(max_length=1000, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["status"], name="report_status_idx")]
        constraints = [
            models.UniqueConstraint(
                fields=["craft", "reporter"],
                condition=models.Q(status="open"),
                name="unique_open_report_per_user",
            ),
        ]

    def __str__(self):
        return f"{self.get_reason_display()} report on {self.craft_id}"


class ReviewAction(BaseModel):
    class Action(models.TextChoices):
        EDIT = "edit", "Edit"
        HIDE = "hide", "Hide"
        REMOVE = "remove", "Remove"
        DISMISS = "dismiss", "Dismiss"

    report = models.ForeignKey(Report, on_delete=models.PROTECT, related_name="actions")
    admin = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="review_actions"
    )
    action = models.CharField(max_length=10, choices=Action.choices)
    reason = models.TextField(max_length=1000)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"{self.get_action_display()} on report {self.report_id}"
