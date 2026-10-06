from django.db import IntegrityError, transaction

from core.exceptions import ConflictError, NotFoundError, PermissionDeniedError, ValidationError
from crafts import services as craft_services
from crafts.selectors import get_visible_craft

from . import signals
from .models import Report, ReviewAction
from .selectors import REPORT_NOT_FOUND

ALREADY_REPORTED = "You have already reported this craft. It is under review."
OWN_CRAFT = "You cannot report your own craft."
ADMIN_ONLY = "Only admins can review reports."
ALREADY_REVIEWED = "This report has already been reviewed."
CHANGES_REQUIRED = "Describe the changes to make to the craft."


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
