from collections import defaultdict

from django.db.models import Count, Q

from core.exceptions import NotFoundError
from crafts.models import LOOKUP_MODELS

from .models import ItemReport, Report, StoryReport

REPORT_NOT_FOUND = "Report not found."


def _with_details(reports):
    return reports.select_related("craft__author__profile", "reporter__profile").prefetch_related(
        "actions__admin__profile"
    )


def review_queue(*, status=Report.Status.OPEN):
    reports = Report.objects.all()
    if status != "all":
        reports = reports.filter(status=status)
    return _with_details(reports)


def get_report(report_id):
    report = _with_details(Report.objects.filter(pk=report_id)).first()
    if report is None:
        raise NotFoundError(REPORT_NOT_FOUND)
    return report


def _with_item_details(reports):
    return reports.select_related("reporter__profile").prefetch_related("actions__admin__profile")


def item_review_queue(*, status=Report.Status.OPEN):
    reports = ItemReport.objects.all()
    if status != "all":
        reports = reports.filter(status=status)
    return _with_item_details(reports)


def get_item_report(report_id):
    report = _with_item_details(ItemReport.objects.filter(pk=report_id)).first()
    if report is None:
        raise NotFoundError(REPORT_NOT_FOUND)
    return attach_items([report])[0]


def attach_items(reports):
    """
    Sets `report.item` to the reported item, with who added it and how many crafts use it,
    or to None when it no longer exists. One query per kind of item.
    """
    ids = defaultdict(set)
    for report in reports:
        ids[report.item_type].add(report.item_id)
    found = {}
    for item_type, item_ids in ids.items():
        items = (
            LOOKUP_MODELS[item_type]
            .objects.filter(pk__in=item_ids)
            .select_related("created_by__profile")
            .annotate(crafts_count=Count("crafts", filter=Q(crafts__is_deleted=False)))
        )
        found.update({(item_type, item.pk): item for item in items})
    for report in reports:
        report.item = found.get((report.item_type, report.item_id))
    return reports


def _with_story_details(reports):
    # A removed story is soft deleted; the report still shows it.
    return reports.select_related(
        "story__craft", "story__author__profile", "reporter__profile"
    ).prefetch_related("actions__admin__profile")


def story_review_queue(*, status=Report.Status.OPEN):
    reports = StoryReport.objects.all()
    if status != "all":
        reports = reports.filter(status=status)
    return _with_story_details(reports)


def get_story_report(report_id):
    report = _with_story_details(StoryReport.objects.filter(pk=report_id)).first()
    if report is None:
        raise NotFoundError(REPORT_NOT_FOUND)
    return report
