from django.urls import path

from . import views

urlpatterns = [
    path("crafts/<int:craft_id>/report/", views.ReportCraftView.as_view(), name="report-craft"),
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
]
