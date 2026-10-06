from django.urls import path

from . import views

urlpatterns = [
    path("categories/", views.CategoryListView.as_view(), name="categories"),
    path("regions/", views.RegionListView.as_view(), name="regions"),
]
