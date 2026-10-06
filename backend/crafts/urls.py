from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("crafts", views.CraftViewSet, basename="craft")

urlpatterns = [
    path("categories/", views.CategoryListView.as_view(), name="categories"),
    path("regions/", views.RegionListView.as_view(), name="regions"),
    *router.urls,
]
