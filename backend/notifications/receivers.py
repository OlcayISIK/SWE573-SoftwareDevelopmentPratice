from django.dispatch import receiver

from crafts.models import Craft
from crafts.signals import craft_published, craft_updated, story_shared
from moderation.signals import report_resolved, story_report_resolved
from social.selectors import favoriter_ids, follower_ids

from .models import Notification


@receiver(craft_published, dispatch_uid="notify_followers_of_new_craft")
def notify_followers_of_new_craft(sender, craft, **kwargs):
    Notification.objects.bulk_create(
        Notification(
            recipient_id=recipient_id,
            type=Notification.Type.NEW_CRAFT_FROM_FOLLOWED,
            craft=craft,
            actor_id=craft.author_id,
        )
        for recipient_id in follower_ids(craft.author_id)
    )


@receiver(craft_updated, dispatch_uid="notify_favoriters_of_update")
def notify_favoriters_of_update(sender, craft, actor, **kwargs):
    if craft.status != Craft.Status.PUBLISHED:
        return
    Notification.objects.bulk_create(
        Notification(
            recipient_id=recipient_id,
            type=Notification.Type.FAVORITE_UPDATED,
            craft=craft,
            actor=actor,
        )
        for recipient_id in favoriter_ids(craft.pk)
        if recipient_id != actor.pk
    )


@receiver(story_shared, dispatch_uid="notify_author_of_story")
def notify_author_of_story(sender, story, **kwargs):
    Notification.objects.create(
        recipient_id=story.craft.author_id,
        type=Notification.Type.NEW_STORY,
        craft_id=story.craft_id,
        actor_id=story.author_id,
        data={"story_id": story.pk},
    )


@receiver(report_resolved, dispatch_uid="notify_reporter")
def notify_reporter(sender, report, admin, action, **kwargs):
    Notification.objects.create(
        recipient_id=report.reporter_id,
        type=Notification.Type.REPORT_RESOLVED,
        craft_id=report.craft_id,
        actor=admin,
        data={"report_id": report.pk, "action": action, "report_status": report.status},
    )


@receiver(story_report_resolved, dispatch_uid="notify_story_reporter")
def notify_story_reporter(sender, report, admin, action, **kwargs):
    Notification.objects.create(
        recipient_id=report.reporter_id,
        type=Notification.Type.REPORT_RESOLVED,
        craft_id=report.story.craft_id,
        actor=admin,
        data={
            "story_report_id": report.pk,
            "subject": "story",
            "action": action,
            "report_status": report.status,
        },
    )
