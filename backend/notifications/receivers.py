from django.dispatch import receiver

from crafts.models import Craft
from crafts.signals import craft_published, craft_updated, practice_status_changed, story_shared
from moderation.signals import report_resolved, status_proposal_reviewed, story_report_resolved
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


@receiver(practice_status_changed, dispatch_uid="notify_favoriters_of_practice_status")
def notify_favoriters_of_practice_status(sender, craft, actor, old_status, new_status, **kwargs):
    if craft.status != Craft.Status.PUBLISHED or craft.is_deleted:
        return
    Notification.objects.bulk_create(
        Notification(
            recipient_id=recipient_id,
            type=Notification.Type.PRACTICE_STATUS_CHANGED,
            craft=craft,
            actor=actor,
            data={"old_status": old_status, "practice_status": new_status},
        )
        for recipient_id in favoriter_ids(craft.pk)
        if recipient_id != actor.pk
    )


@receiver(status_proposal_reviewed, dispatch_uid="notify_proposer")
def notify_proposer(sender, proposal, admin, **kwargs):
    Notification.objects.create(
        recipient_id=proposal.proposer_id,
        type=Notification.Type.STATUS_PROPOSAL_REVIEWED,
        craft_id=proposal.craft_id,
        actor=admin,
        data={
            "proposal_id": proposal.pk,
            "decision": proposal.status,
            "practice_status": proposal.practice_status,
        },
    )
