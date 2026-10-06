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
    path("auth/token/", views.LoginView.as_view(), name="token"),
    path("auth/token/refresh/", views.RefreshView.as_view(), name="token-refresh"),
    path("auth/logout/", views.LogoutView.as_view(), name="logout"),
    path("auth/password-reset/", views.PasswordResetRequestView.as_view(), name="password-reset"),
    path(
        "auth/password-reset/confirm/",
        views.PasswordResetConfirmView.as_view(),
        name="password-reset-confirm",
    ),
    path("me/", views.MeView.as_view(), name="me"),
    path("users/<int:user_id>/", views.PublicProfileView.as_view(), name="public-profile"),
]
