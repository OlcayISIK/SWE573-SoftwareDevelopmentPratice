from core.exceptions import NotFoundError

from .models import Report

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
