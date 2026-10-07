from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("crafts", views.CraftViewSet, basename="craft")

urlpatterns = [
    path("categories/", views.CategoryListView.as_view(), name="categories"),
    path("craft-types/", views.CraftTypeListView.as_view(), name="craft-types"),
    path("tools/", views.ToolListView.as_view(), name="tools"),
    path("materials/", views.MaterialListView.as_view(), name="materials"),
    path("cultures/", views.CultureListView.as_view(), name="cultures"),
    path("users/<int:user_id>/crafts/", views.UserCraftsView.as_view(), name="user-crafts"),
    *router.urls,
]
