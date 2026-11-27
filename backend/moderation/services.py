from django.db import IntegrityError, transaction
from django.utils import timezone

from core.exceptions import ConflictError, NotFoundError, PermissionDeniedError, ValidationError
from crafts import services as craft_services
from crafts.models import LOOKUP_MODELS
from crafts.selectors import get_published_story, get_visible_craft

from . import signals
from .models import (
    ItemReport,
    ItemReviewAction,
    Report,
    ReviewAction,
    StatusProposal,
    StoryReport,
    StoryReviewAction,
)
from .selectors import PROPOSAL_NOT_FOUND, REPORT_NOT_FOUND

ALREADY_REPORTED = "You have already reported this craft. It is under review."
OWN_CRAFT = "You cannot report your own craft."
ADMIN_ONLY = "Only admins can review reports."
ALREADY_REVIEWED = "This report has already been reviewed."
CHANGES_REQUIRED = "Describe the changes to make to the craft."
ITEM_NOT_FOUND = "Item not found."
SEEDED_ITEM = "Only items added by users can be reported."
OWN_ITEM = "You cannot report an item you added."
ITEM_ALREADY_REPORTED = "You have already reported this item. It is under review."
ITEM_GONE = "This item no longer exists. Dismiss the report instead."
OWN_STORY = "You cannot report your own story."
STORY_ALREADY_REPORTED = "You have already reported this story. It is under review."
VERIFY_BEFORE_PROPOSING = "Verify your email address before reporting a practice status."
ALREADY_PROPOSED = (
    "You have already reported the practice status of this craft. It is under review."
)
OWN_CRAFT_STATUS = "Change the practice status of your own craft in its edit form."
SAME_STATUS = "This is already the craft's practice status."
PROPOSAL_ALREADY_REVIEWED = "This report has already been reviewed."


def report_craft(*, reporter, craft_id, reason, note=""):
    craft = get_visible_craft(craft_id, reporter)
    if craft.author_id == reporter.id:
        raise ValidationError(OWN_CRAFT)
    if Report.objects.filter(craft=craft, reporter=reporter, status=Report.Status.OPEN).exists():
        raise ConflictError(ALREADY_REPORTED)

    try:
        with transaction.atomic():
            return Report.objects.create(craft=craft, reporter=reporter, reason=reason, note=note)
    except IntegrityError as exc:
        raise ConflictError(ALREADY_REPORTED) from exc


def _apply_to_craft(craft, admin, action, changes):
    if action == ReviewAction.Action.EDIT:
        if not changes:
            raise ValidationError(CHANGES_REQUIRED, errors={"changes": [CHANGES_REQUIRED]})
        craft_services.update_craft(craft=craft, actor=admin, data=changes)
    elif action == ReviewAction.Action.HIDE:
        craft_services.hide_craft(craft=craft, actor=admin)
    elif action == ReviewAction.Action.REMOVE:
        craft_services.remove_craft(craft=craft, actor=admin)


@transaction.atomic
def review_report(*, admin, report_id, action, reason, changes=None):
    if not admin.is_admin:
        raise PermissionDeniedError(ADMIN_ONLY)
    report = Report.objects.select_for_update().filter(pk=report_id).first()
    if report is None:
        raise NotFoundError(REPORT_NOT_FOUND)
    if report.status != Report.Status.OPEN:
        raise ConflictError(ALREADY_REVIEWED)

    _apply_to_craft(report.craft, admin, action, changes)

    closing = [report]
    if action in (ReviewAction.Action.HIDE, ReviewAction.Action.REMOVE):
        # The craft is gone from public view, so every other open report on it is settled too.
        closing += list(
            Report.objects.select_for_update()
            .filter(craft_id=report.craft_id, status=Report.Status.OPEN)
            .exclude(pk=report.pk)
        )

    new_status = (
        Report.Status.DISMISSED if action == ReviewAction.Action.DISMISS else Report.Status.RESOLVED
    )
    for closed in closing:
        closed.status = new_status
        closed.save(update_fields=["status", "updated_at"])
        ReviewAction.objects.create(report=closed, admin=admin, action=action, reason=reason)
        signals.report_resolved.send(sender=Report, report=closed, admin=admin, action=action)
    return report


def _item(item_type, item_id):
    return LOOKUP_MODELS[item_type].objects.filter(pk=item_id).first()


def report_item(*, reporter, item_type, item_id, reason, note=""):
    item = _item(item_type, item_id)
    if item is None or item.is_hidden:
        raise NotFoundError(ITEM_NOT_FOUND)
    if item.created_by_id is None:
        raise ValidationError(SEEDED_ITEM)
    if item.created_by_id == reporter.id:
        raise ValidationError(OWN_ITEM)
    open_reports = ItemReport.objects.filter(
        item_type=item_type, item_id=item_id, reporter=reporter, status=Report.Status.OPEN
    )
    if open_reports.exists():
        raise ConflictError(ITEM_ALREADY_REPORTED)

    try:
        with transaction.atomic():
            return ItemReport.objects.create(
                item_type=item_type,
                item_id=item_id,
                item_name=item.name,
                reporter=reporter,
                reason=reason,
                note=note,
            )
    except IntegrityError as exc:
        raise ConflictError(ITEM_ALREADY_REPORTED) from exc


def _apply_to_item(report, admin, action, merge_into, **edits):
    """Changes the reported item and returns what changed, for the review history."""
    if action == ItemReviewAction.Action.DISMISS:
        return {}
    item = _item(report.item_type, report.item_id)
    if item is None:
        raise ConflictError(ITEM_GONE)
    if action == ItemReviewAction.Action.EDIT:
        craft_services.edit_lookup(item=item, actor=admin, **edits)
        return {key: value for key, value in edits.items() if value is not None}
    if action == ItemReviewAction.Action.HIDE:
        craft_services.hide_lookup(item=item, actor=admin)
        return {}
    into = _item(report.item_type, merge_into)
    if into is None:
        raise ValidationError(ITEM_NOT_FOUND, errors={"merge_into": [ITEM_NOT_FOUND]})
    craft_services.merge_lookup(item=item, into=into, actor=admin)
    return {"merged_into": into.id, "merged_into_name": into.name}


@transaction.atomic
def review_item_report(
    *,
    admin,
    report_id,
    action,
    reason,
    name=None,
    description=None,
    merge_into=None,
    wikidata_id=None,
    other_names=None,
):
    if not admin.is_admin:
        raise PermissionDeniedError(ADMIN_ONLY)
    report = ItemReport.objects.select_for_update().filter(pk=report_id).first()
    if report is None:
        raise NotFoundError(REPORT_NOT_FOUND)
    if report.status != Report.Status.OPEN:
        raise ConflictError(ALREADY_REVIEWED)

    details = _apply_to_item(
        report,
        admin,
        action,
        merge_into,
        name=name,
        description=description,
        wikidata_id=wikidata_id,
        other_names=other_names,
    )

    closing = [report]
    if action in (ItemReviewAction.Action.HIDE, ItemReviewAction.Action.MERGE):
        # The item is gone from the lists, so every other open report on it is settled too.
        closing += list(
            ItemReport.objects.select_for_update()
            .filter(item_type=report.item_type, item_id=report.item_id, status=Report.Status.OPEN)
            .exclude(pk=report.pk)
        )

    new_status = (
        Report.Status.DISMISSED
        if action == ItemReviewAction.Action.DISMISS
        else Report.Status.RESOLVED
    )
    for closed in closing:
        closed.status = new_status
        closed.save(update_fields=["status", "updated_at"])
        ItemReviewAction.objects.create(
            report=closed, admin=admin, action=action, reason=reason, details=details
        )
    return report


def report_story(*, reporter, story_id, reason, note=""):
    story = get_published_story(story_id, reporter)
    if story.author_id == reporter.id:
        raise ValidationError(OWN_STORY)
    open_reports = StoryReport.objects.filter(
        story=story, reporter=reporter, status=Report.Status.OPEN
    )
    if open_reports.exists():
        raise ConflictError(STORY_ALREADY_REPORTED)

    try:
        with transaction.atomic():
            return StoryReport.objects.create(
                story=story, reporter=reporter, reason=reason, note=note
            )
    except IntegrityError as exc:
        raise ConflictError(STORY_ALREADY_REPORTED) from exc


@transaction.atomic
def review_story_report(*, admin, report_id, action, reason):
    if not admin.is_admin:
        raise PermissionDeniedError(ADMIN_ONLY)
    report = StoryReport.objects.select_for_update().filter(pk=report_id).first()
    if report is None:
        raise NotFoundError(REPORT_NOT_FOUND)
    if report.status != Report.Status.OPEN:
        raise ConflictError(ALREADY_REVIEWED)

    closing = [report]
    if action in (StoryReviewAction.Action.HIDE, StoryReviewAction.Action.REMOVE):
        if action == StoryReviewAction.Action.HIDE:
            craft_services.hide_story(story=report.story, actor=admin)
        else:
            craft_services.remove_story(story=report.story, actor=admin)
        # The story is gone from public view, so every other open report on it is settled too.
        closing += list(
            StoryReport.objects.select_for_update()
            .filter(story_id=report.story_id, status=Report.Status.OPEN)
            .exclude(pk=report.pk)
        )

    new_status = (
        Report.Status.DISMISSED
        if action == StoryReviewAction.Action.DISMISS
        else Report.Status.RESOLVED
    )
    for closed in closing:
        closed.status = new_status
        closed.save(update_fields=["status", "updated_at"])
        StoryReviewAction.objects.create(report=closed, admin=admin, action=action, reason=reason)
        signals.story_report_resolved.send(
            sender=StoryReport, report=closed, admin=admin, action=action
        )
    return report


def propose_practice_status(*, proposer, craft_id, practice_status, source, note=""):
    """
    A user reports that a craft's practice status is wrong, with the status they think is right
    (unknown when they are not sure) and a source or a note.
    """
    if not proposer.is_email_verified:
        raise PermissionDeniedError(VERIFY_BEFORE_PROPOSING)
    craft = get_visible_craft(craft_id, proposer)
    if craft.author_id == proposer.id:
        raise ValidationError(OWN_CRAFT_STATUS)
    if practice_status == craft.practice_status:
        raise ValidationError(SAME_STATUS, errors={"practice_status": [SAME_STATUS]})
    open_proposals = StatusProposal.objects.filter(
        craft=craft, proposer=proposer, status=StatusProposal.Status.OPEN
    )
    if open_proposals.exists():
        raise ConflictError(ALREADY_PROPOSED)

    try:
        with transaction.atomic():
            return StatusProposal.objects.create(
                craft=craft,
                proposer=proposer,
                practice_status=practice_status,
                source=source.strip(),
                note=note,
            )
    except IntegrityError as exc:
        raise ConflictError(ALREADY_PROPOSED) from exc


@transaction.atomic
def review_status_proposal(*, admin, proposal_id, action, reason):
    """
    Accepts a report, which sets the craft's practice status and source to the ones reported,
    or rejects it. A report is reviewed once.
    """
    if not admin.is_admin:
        raise PermissionDeniedError(ADMIN_ONLY)
    proposal = StatusProposal.objects.select_for_update().filter(pk=proposal_id).first()
    if proposal is None:
        raise NotFoundError(PROPOSAL_NOT_FOUND)
    if proposal.status != StatusProposal.Status.OPEN:
        raise ConflictError(PROPOSAL_ALREADY_REVIEWED)

    if action == StatusProposal.Status.APPROVED:
        craft_services.set_practice_status(
            craft=proposal.craft,
            actor=admin,
            practice_status=proposal.practice_status,
            source=proposal.source,
            reason=reason,
        )
    proposal.status = action
    proposal.reviewed_by = admin
    proposal.review_reason = reason
    proposal.reviewed_at = timezone.now()
    proposal.save(
        update_fields=["status", "reviewed_by", "review_reason", "reviewed_at", "updated_at"]
    )
    signals.status_proposal_reviewed.send(sender=StatusProposal, proposal=proposal, admin=admin)
    return proposal
