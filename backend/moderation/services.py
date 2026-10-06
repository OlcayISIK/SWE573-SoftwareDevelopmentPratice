from django.db import IntegrityError, transaction

from core.exceptions import ConflictError, ValidationError
from crafts.selectors import get_visible_craft

from .models import Report

ALREADY_REPORTED = "You have already reported this craft. It is under review."
OWN_CRAFT = "You cannot report your own craft."


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
