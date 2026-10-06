from django.urls import path
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from config.urls import urlpatterns as project_urlpatterns


class WhoAmIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"id": request.user.id})


urlpatterns = [*project_urlpatterns, path("whoami/", WhoAmIView.as_view())]
