from django.urls import path

from . import views

urlpatterns = [
    path("crafts/<int:craft_id>/report/", views.ReportCraftView.as_view(), name="report-craft"),
]
