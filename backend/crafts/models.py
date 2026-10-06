from django.db import models

from core.models import BaseModel


class Category(BaseModel):
    name = models.CharField(max_length=60, unique=True)
    slug = models.SlugField(max_length=60, unique=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name


class Region(BaseModel):
    name = models.CharField(max_length=100)
    country = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["country", "name"]
        constraints = [
            models.UniqueConstraint(fields=["name", "country"], name="unique_region_per_country"),
        ]

    def __str__(self):
        return f"{self.name}, {self.country}"
