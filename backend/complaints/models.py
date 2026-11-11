"""
==============================================================================
JANMITRA - Civic Issue Reporting & Management System
File: complaints/models.py
Developer: Anas Shaikh (Backend Lead)
Description: Data models for Categories, Wards, and Civic Complaints.
==============================================================================
"""

import uuid
from django.db import models
from django.conf import settings


class Category(models.Model):
    name = models.CharField(max_length=100)
    department_id = models.IntegerField(default=1, help_text="1:PWD, 2:SWM, 3:PHE, 4:Electrical")
    sla_hours = models.IntegerField(default=48)

    class Meta:
        db_table = 'categories'
        verbose_name_plural = 'Categories'

    def __str__(self):
        return self.name


class Ward(models.Model):
    ward_number = models.IntegerField(unique=True)
    name = models.CharField(max_length=100)

    class Meta:
        db_table = 'wards'

    def __str__(self):
        return f"Ward {self.ward_number} - {self.name}"


class Complaint(models.Model):
    STATUS_CHOICES = [
        ('Submitted', 'Submitted'),
        ('Validated', 'Validated'),
        ('Assigned', 'Assigned'),
        ('In-Progress', 'In-Progress'),
        ('Work Done', 'Work Done'),
        ('Resolved', 'Resolved'),
        ('Closed', 'Closed'),
        ('Rejected', 'Rejected'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tracking_id = models.CharField(max_length=32, unique=True, blank=True)
    citizen = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='complaints',
        null=True,
        blank=True
    )
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    ward = models.ForeignKey(Ward, on_delete=models.SET_NULL, null=True, blank=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    address = models.CharField(max_length=500, blank=True)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Submitted', db_index=True)
    photo_url = models.CharField(max_length=500, blank=True)
    resolved_photo_url = models.CharField(max_length=500, blank=True)
    repair_notes = models.TextField(blank=True, default='')
    priority_score = models.IntegerField(default=50)
    priority_level = models.CharField(max_length=20, default='Medium')
    duplicate_count = models.IntegerField(default=0)
    rating = models.IntegerField(null=True, blank=True)
    feedback = models.TextField(blank=True, default='')
    verified_at = models.DateTimeField(null=True, blank=True)
    assigned_worker = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_complaints'
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'complaints'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.tracking_id:
            self.tracking_id = f"JMC-2026-{str(uuid.uuid4())[:8].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"[{self.tracking_id}] {self.title} ({self.status})"
