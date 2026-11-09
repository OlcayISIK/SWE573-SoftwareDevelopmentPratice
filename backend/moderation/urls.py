from django.urls import path, re_path

from . import views

urlpatterns = [
    path("crafts/<int:craft_id>/report/", views.ReportCraftView.as_view(), name="report-craft"),
    re_path(
        rf"^(?P<items>{'|'.join(views.ITEM_LISTS)})/(?P<item_id>[0-9]+)/report/$",
        views.ReportItemView.as_view(),
        name="report-item",
    ),
    path("stories/<int:story_id>/report/", views.ReportStoryView.as_view(), name="report-story"),
    path("moderation/reports/", views.ReviewQueueView.as_view(), name="review-queue"),
    path(
        "moderation/reports/<int:report_id>/",
        views.ReportDetailView.as_view(),
        name="report-detail",
    ),
    path(
        "moderation/reports/<int:report_id>/actions/",
        views.ReviewActionView.as_view(),
        name="review-action",
    ),
    path("moderation/item-reports/", views.ItemReviewQueueView.as_view(), name="item-review-queue"),
    path(
        "moderation/item-reports/<int:report_id>/",
        views.ItemReportDetailView.as_view(),
        name="item-report-detail",
    ),
    path(
        "moderation/item-reports/<int:report_id>/actions/",
        views.ItemReviewActionView.as_view(),
        name="item-review-action",
    ),
    path(
        "moderation/story-reports/", views.StoryReviewQueueView.as_view(), name="story-review-queue"
    ),
    path(
        "moderation/story-reports/<int:report_id>/",
        views.StoryReportDetailView.as_view(),
        name="story-report-detail",
    ),
    path(
        "moderation/story-reports/<int:report_id>/actions/",
        views.StoryReviewActionView.as_view(),
        name="story-review-action",
    ),
]
