from django.urls import path

from . import views

urlpatterns = [
    path("crafts/<int:craft_id>/favorite/", views.FavoriteView.as_view(), name="favorite"),
    path("me/favorites/", views.MyFavoritesView.as_view(), name="my-favorites"),
    path("users/<int:user_id>/follow/", views.FollowView.as_view(), name="follow"),
]
