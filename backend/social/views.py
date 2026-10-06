from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.selectors import get_public_user
from crafts.selectors import get_visible_craft
from crafts.serializers import CraftListSerializer

from . import selectors, services
from .serializers import FavoriteStatusSerializer, FollowStatusSerializer


class AuthenticatedWritesMixin:
    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated()]


class FavoriteView(AuthenticatedWritesMixin, APIView):
    @extend_schema(responses=FavoriteStatusSerializer, tags=["social"])
    def get(self, request, craft_id):
        craft = get_visible_craft(craft_id, request.user)
        return Response(selectors.favorite_status(request.user, craft))

    @extend_schema(
        request=None,
        responses={200: FavoriteStatusSerializer, 201: FavoriteStatusSerializer},
        tags=["social"],
    )
    def post(self, request, craft_id):
        craft, created = services.favorite_craft(user=request.user, craft_id=craft_id)
        return Response(
            selectors.favorite_status(request.user, craft),
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @extend_schema(responses={204: None}, tags=["social"])
    def delete(self, request, craft_id):
        services.unfavorite_craft(user=request.user, craft_id=craft_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["social"])
class MyFavoritesView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CraftListSerializer

    def get_queryset(self):
        return selectors.favorite_crafts(self.request.user)


class FollowView(AuthenticatedWritesMixin, APIView):
    @extend_schema(responses=FollowStatusSerializer, tags=["social"])
    def get(self, request, user_id):
        user = get_public_user(user_id)
        return Response(selectors.follow_status(request.user, user))

    @extend_schema(
        request=None,
        responses={200: FollowStatusSerializer, 201: FollowStatusSerializer},
        tags=["social"],
    )
    def post(self, request, user_id):
        user, created = services.follow_user(follower=request.user, user_id=user_id)
        return Response(
            selectors.follow_status(request.user, user),
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @extend_schema(responses={204: None}, tags=["social"])
    def delete(self, request, user_id):
        services.unfollow_user(follower=request.user, user_id=user_id)
        return Response(status=status.HTTP_204_NO_CONTENT)
