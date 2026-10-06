from django.urls import path

from . import views

urlpatterns = [
    path("auth/register/", views.RegisterView.as_view(), name="register"),
    path("auth/verify-email/", views.VerifyEmailView.as_view(), name="verify-email"),
    path(
        "auth/verify-email/resend/",
        views.ResendVerificationView.as_view(),
        name="verify-email-resend",
    ),
]
