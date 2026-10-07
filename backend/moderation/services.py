from django.db import IntegrityError, transaction

from core.exceptions import ConflictError, NotFoundError, PermissionDeniedError, ValidationError
from crafts import services as craft_services
from crafts.models import LOOKUP_MODELS
from crafts.selectors import get_visible_craft

from . import signals
from .models import ItemReport, ItemReviewAction, Report, ReviewAction
from .selectors import REPORT_NOT_FOUND

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


def _apply_to_item(report, admin, action, name, merge_into):
    """Changes the reported item and returns what changed, for the review history."""
    if action == ItemReviewAction.Action.DISMISS:
        return {}
    item = _item(report.item_type, report.item_id)
    if item is None:
        raise ConflictError(ITEM_GONE)
    if action == ItemReviewAction.Action.RENAME:
        craft_services.rename_lookup(item=item, name=name, actor=admin)
        return {"name": name}
    if action == ItemReviewAction.Action.HIDE:
        craft_services.hide_lookup(item=item, actor=admin)
        return {}
    into = _item(report.item_type, merge_into)
    if into is None:
        raise ValidationError(ITEM_NOT_FOUND, errors={"merge_into": [ITEM_NOT_FOUND]})
    craft_services.merge_lookup(item=item, into=into, actor=admin)
    return {"merged_into": into.id, "merged_into_name": into.name}


@transaction.atomic
def review_item_report(*, admin, report_id, action, reason, name=None, merge_into=None):
    if not admin.is_admin:
        raise PermissionDeniedError(ADMIN_ONLY)
    report = ItemReport.objects.select_for_update().filter(pk=report_id).first()
    if report is None:
        raise NotFoundError(REPORT_NOT_FOUND)
    if report.status != Report.Status.OPEN:
        raise ConflictError(ALREADY_REVIEWED)

    details = _apply_to_item(report, admin, action, name, merge_into)

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
