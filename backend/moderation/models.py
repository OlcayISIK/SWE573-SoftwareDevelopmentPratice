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


class ItemReport(BaseModel):
    """A report on a lookup item (a category, craft type, tool, material, or culture)."""

    class ItemType(models.TextChoices):
        CATEGORY = "category", "Category"
        CRAFT_TYPE = "craft_type", "Craft type"
        TOOL = "tool", "Tool"
        MATERIAL = "material", "Material"
        CULTURE = "culture", "Culture"

    class Reason(models.TextChoices):
        DUPLICATE = "duplicate", "Duplicate"
        INACCURATE = "inaccurate", "Inaccurate"
        INAPPROPRIATE = "inappropriate", "Inappropriate"

    item_type = models.CharField(max_length=20, choices=ItemType.choices)
    item_id = models.PositiveBigIntegerField()
    # Kept so the report still reads well after the item is renamed or merged away.
    item_name = models.CharField(max_length=80)
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="item_reports"
    )
    reason = models.CharField(max_length=20, choices=Reason.choices)
    note = models.TextField(max_length=1000, blank=True)
    status = models.CharField(
        max_length=10, choices=Report.Status.choices, default=Report.Status.OPEN
    )

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["status"], name="item_report_status_idx"),
            models.Index(fields=["item_type", "item_id"], name="item_report_item_idx"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["item_type", "item_id", "reporter"],
                condition=models.Q(status="open"),
                name="unique_open_item_report_per_user",
            ),
        ]

    def __str__(self):
        return f"{self.get_reason_display()} report on {self.item_type} {self.item_name}"


class ItemReviewAction(BaseModel):
    class Action(models.TextChoices):
        EDIT = "edit", "Edit"
        HIDE = "hide", "Hide"
        MERGE = "merge", "Merge"
        DISMISS = "dismiss", "Dismiss"

    report = models.ForeignKey(ItemReport, on_delete=models.PROTECT, related_name="actions")
    admin = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="item_review_actions"
    )
    action = models.CharField(max_length=10, choices=Action.choices)
    reason = models.TextField(max_length=1000)
    # What changed: the new name or description for an edit, the item merged into for a merge.
    details = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"{self.get_action_display()} on item report {self.report_id}"
