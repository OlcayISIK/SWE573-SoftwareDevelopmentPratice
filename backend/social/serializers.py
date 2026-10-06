from rest_framework import serializers


class FavoriteStatusSerializer(serializers.Serializer):
    favorited = serializers.BooleanField()
    favorites_count = serializers.IntegerField()


class FollowStatusSerializer(serializers.Serializer):
    following = serializers.BooleanField()
    followers_count = serializers.IntegerField()
    following_count = serializers.IntegerField()
