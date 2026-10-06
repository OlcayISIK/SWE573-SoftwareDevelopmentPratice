from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.forms import BaseUserCreationForm, UserChangeForm

from .models import Profile, User


class UserCreationForm(BaseUserCreationForm):
    class Meta:
        model = User
        fields = ("email",)


class UserEditForm(UserChangeForm):
    class Meta:
        model = User
        fields = "__all__"


class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    form = UserEditForm
    add_form = UserCreationForm
    inlines = [ProfileInline]
    ordering = ["email"]
    list_display = ["email", "role", "is_email_verified", "is_active", "is_staff", "date_joined"]
    list_filter = ["role", "is_email_verified", "is_active", "is_staff"]
    search_fields = ["email", "profile__display_name"]
    fieldsets = [
        (None, {"fields": ["email", "password"]}),
        ("Role and status", {"fields": ["role", "is_email_verified", "is_active"]}),
        (
            "Admin site access",
            {"fields": ["is_staff", "is_superuser", "groups", "user_permissions"]},
        ),
        ("Dates", {"fields": ["last_login", "date_joined"]}),
    ]
    add_fieldsets = [
        (None, {"classes": ["wide"], "fields": ["email", "password1", "password2"]}),
    ]
