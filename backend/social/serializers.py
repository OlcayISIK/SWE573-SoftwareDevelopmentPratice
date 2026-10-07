from rest_framework import serializers


class FavoriteStatusSerializer(serializers.Serializer):
    favorited = serializers.BooleanField()
    favorites_count = serializers.IntegerField()


class FollowStatusSerializer(serializers.Serializer):
    following = serializers.BooleanField()
    followers_count = serializers.IntegerField()
    following_count = serializers.IntegerField()


class PersonSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    display_name = serializers.CharField(source="profile.display_name", read_only=True)
    avatar = serializers.ImageField(source="profile.avatar", read_only=True)
    city = serializers.CharField(source="profile.city", read_only=True)
    country = serializers.CharField(source="profile.country", read_only=True)


class FollowingEntrySerializer(serializers.Serializer):
    user = PersonSummarySerializer(source="following", read_only=True)
    since = serializers.DateTimeField(source="created_at", read_only=True)


class FollowerEntrySerializer(serializers.Serializer):
    user = PersonSummarySerializer(source="follower", read_only=True)
    since = serializers.DateTimeField(source="created_at", read_only=True)
