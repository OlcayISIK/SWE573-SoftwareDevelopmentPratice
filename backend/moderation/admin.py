from django.contrib import admin, messages

from core.exceptions import DomainError

from . import services
from .models import (
    ItemReport,
    ItemReviewAction,
    Report,
    ReviewAction,
    StatusProposal,
    StoryReport,
    StoryReviewAction,
)

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


class ItemReviewActionInline(admin.TabularInline):
    model = ItemReviewAction
    extra = 0
    can_delete = False
    fields = ["action", "reason", "details", "admin", "created_at"]
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(ItemReport)
class ItemReportAdmin(admin.ModelAdmin):
    list_display = ["id", "item_type", "item_name", "reporter", "reason", "status", "created_at"]
    list_filter = ["status", "item_type", "reason"]
    search_fields = ["item_name", "reporter__email", "note"]
    raw_id_fields = ["reporter"]
    readonly_fields = ["item_type", "item_id", "item_name", "status", "created_at", "updated_at"]
    inlines = [ItemReviewActionInline]
    # Renaming and merging need a name or a target, so they are done in the review screen.
    actions = ["hide_items", "dismiss_reports"]

    def _review(self, request, queryset, action):
        reviewed = 0
        for report in queryset.filter(status=Report.Status.OPEN):
            try:
                services.review_item_report(
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

    @admin.action(description="Hide the reported items")
    def hide_items(self, request, queryset):
        self._review(request, queryset, ItemReviewAction.Action.HIDE)

    @admin.action(description="Dismiss the reports")
    def dismiss_reports(self, request, queryset):
        self._review(request, queryset, ItemReviewAction.Action.DISMISS)


class StoryReviewActionInline(admin.TabularInline):
    model = StoryReviewAction
    extra = 0
    can_delete = False
    fields = ["action", "reason", "admin", "created_at"]
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(StoryReport)
class StoryReportAdmin(admin.ModelAdmin):
    """Story reports are reviewed in the app; here they can be looked up."""

    list_display = ["id", "story", "reporter", "reason", "status", "created_at"]
    list_filter = ["status", "reason"]
    search_fields = ["story__text", "reporter__email", "note"]
    raw_id_fields = ["story", "reporter"]
    readonly_fields = ["status", "created_at", "updated_at"]
    inlines = [StoryReviewActionInline]


@admin.register(StatusProposal)
class StatusProposalAdmin(admin.ModelAdmin):
    """
    Reported practice statuses can be looked up here, and accepted or rejected with the actions.
    They are read-only, so a change always goes through the review: the craft's status is set,
    the change is recorded, and people are notified.
    """

    list_display = [
        "id",
        "craft",
        "current_status",
        "practice_status",
        "proposer",
        "status",
        "created_at",
    ]
    list_filter = ["status", "practice_status"]
    search_fields = ["craft__name", "proposer__email", "source", "note"]
    list_select_related = ["craft", "proposer"]
    readonly_fields = [
        "craft",
        "current_status",
        "practice_status",
        "source",
        "note",
        "proposer",
        "status",
        "reviewed_by",
        "review_reason",
        "reviewed_at",
        "created_at",
        "updated_at",
    ]
    fields = readonly_fields
    actions = ["approve_proposals", "reject_proposals"]

    @admin.display(description="Marked as")
    def current_status(self, obj):
        return obj.craft.get_practice_status_display()

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def _review(self, request, queryset, action):
        reviewed = 0
        for proposal in queryset.filter(status=StatusProposal.Status.OPEN):
            try:
                services.review_status_proposal(
                    admin=request.user,
                    proposal_id=proposal.pk,
                    action=action,
                    reason=ADMIN_REVIEW_REASON,
                )
            except DomainError as exc:
                self.message_user(request, f"Report {proposal.pk}: {exc.message}", messages.ERROR)
            else:
                reviewed += 1
        if reviewed:
            self.message_user(request, f"{reviewed} report(s) reviewed.", messages.SUCCESS)
        skipped = queryset.exclude(status=StatusProposal.Status.OPEN).count()
        if skipped:
            self.message_user(
                request, f"{skipped} report(s) were already reviewed and were left as they are."
            )

    @admin.action(description="Accept: set the crafts' status and source to the reported ones")
    def approve_proposals(self, request, queryset):
        self._review(request, queryset, StatusProposal.Status.APPROVED)

    @admin.action(description="Reject: leave the crafts as they are")
    def reject_proposals(self, request, queryset):
        self._review(request, queryset, StatusProposal.Status.REJECTED)
