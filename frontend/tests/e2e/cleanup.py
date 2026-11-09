# Removes everything the end-to-end tests created: users named e2e-...@example.com and their
# crafts, stories, photos, reports, notifications, and added list items. Runs inside the backend
# container with `manage.py shell`. The e2e admin, sample crafts, and real accounts stay.
from django.db import transaction
from django.db.models import Q

from accounts.models import User
from crafts.models import LOOKUP_MODELS, Craft, CraftMedia, CraftStory
from moderation.models import (
    ItemReport,
    ItemReviewAction,
    Report,
    ReviewAction,
    StoryReport,
    StoryReviewAction,
)
from notifications.models import Notification

with transaction.atomic():
    users = User.objects.filter(email__startswith="e2e-", email__endswith="@example.com")
    crafts = Craft.all_objects.filter(author__in=users)
    item_reports = ItemReport.objects.filter(reporter__in=users)
    reports = Report.objects.filter(Q(reporter__in=users) | Q(craft__in=crafts))
    ItemReviewAction.objects.filter(report__in=item_reports).delete()
    item_reports.delete()
    ReviewAction.objects.filter(report__in=reports).delete()
    reports.delete()
    Notification.objects.filter(
        Q(recipient__in=users) | Q(actor__in=users) | Q(craft__in=crafts)
    ).delete()
    media = CraftMedia.all_objects.filter(craft__in=crafts)
    for item in media:
        if item.file:
            item.file.delete(save=False)
    media.hard_delete()
    stories = CraftStory.all_objects.filter(Q(author__in=users) | Q(craft__in=crafts))
    story_reports = StoryReport.objects.filter(Q(reporter__in=users) | Q(story__in=stories))
    StoryReviewAction.objects.filter(report__in=story_reports).delete()
    story_reports.delete()
    stories.hard_delete()
    crafts.hard_delete()
    for model in LOOKUP_MODELS.values():
        model.objects.filter(created_by__in=users).delete()
    users.delete()
