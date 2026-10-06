from django.contrib import admin, messages

from core.exceptions import DomainError

from . import services
from .models import Report, ReviewAction

ADMIN_REVIEW_REASON = "Reviewed in the Django admin."


class ReviewActionInline(admin.TabularInline):
    model = ReviewAction
    extra = 0
    can_delete = False
    fields = ["action", "reason", "admin", "created_at"]
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ["id", "craft", "reporter", "reason", "status", "created_at"]
    list_filter = ["status", "reason"]
    search_fields = ["craft__name", "reporter__email", "note"]
    raw_id_fields = ["craft", "reporter"]
    readonly_fields = ["status", "created_at", "updated_at"]
    inlines = [ReviewActionInline]
    actions = ["hide_crafts", "remove_crafts", "dismiss_reports"]

    def _review(self, request, queryset, action):
        reviewed = 0
        for report in queryset.filter(status=Report.Status.OPEN):
            try:
                services.review_report(
                    admin=request.user,
                    report_id=report.pk,
                    action=action,
                    reason=ADMIN_REVIEW_REASON,
                )
            except DomainError as exc:
                self.message_user(request, f"Report {report.pk}: {exc.message}", messages.ERROR)
            else:
                reviewed += 1
        if reviewed:
            self.message_user(request, f"{reviewed} report(s) reviewed.", messages.SUCCESS)

    @admin.action(description="Hide the reported crafts")
    def hide_crafts(self, request, queryset):
        self._review(request, queryset, ReviewAction.Action.HIDE)

    @admin.action(description="Remove the reported crafts")
    def remove_crafts(self, request, queryset):
        self._review(request, queryset, ReviewAction.Action.REMOVE)

    @admin.action(description="Dismiss the reports")
    def dismiss_reports(self, request, queryset):
        self._review(request, queryset, ReviewAction.Action.DISMISS)
