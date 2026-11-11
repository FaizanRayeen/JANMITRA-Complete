"""
Idempotent system bootstrap command for a fresh JANMITRA installation.

Seeds:
- Wards 1..4
- 4 Municipal Department Categories (PWD, SWM, PHE, Electrical)
- Super Admin (9900000000 / Admin@123)
- 4 Department Officers (9900000001..4 / Officer@123)
- 32 Canonical Field Workers (9800{ward}{dept}0001..2 / worker123)

Leaves the complaints table untouched (0 synthetic complaints).
"""

import sys
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from complaints.models import Category, Ward
from notifications.auth_views import OFFICER_METADATA, WORKER_METADATA

User = get_user_model()

WARDS = [
    (1, "Ward 1 (Laxmi Nagar / South-West Nagpur)"),
    (2, "Ward 2 (Dhantoli / Central Nagpur)"),
    (3, "Ward 3 (Hanuman Nagar / South-East Nagpur)"),
    (4, "Ward 4 (Mangalwari / North Nagpur)"),
]

CATEGORIES = [
    ("Roads & Infrastructure", 1, 48),
    ("Garbage & Solid Waste", 2, 24),
    ("Water Pipeline Leakage", 3, 24),
    ("Street Lighting", 4, 36),
]


class Command(BaseCommand):
    help = "Bootstrap JANMITRA Wards, Departments, Admin, Officers, and 32 Canonical Field Workers"

    @transaction.atomic
    def handle(self, *args, **options):
        for ward_num, ward_name in WARDS:
            ward, created = Ward.objects.get_or_create(
                ward_number=ward_num,
                defaults={"name": ward_name},
            )
            if not created and ward.name != ward_name:
                ward.name = ward_name
                ward.save(update_fields=["name"])

        for cat_name, dept_id, sla_hours in CATEGORIES:
            Category.objects.get_or_create(
                name=cat_name,
                defaults={"department_id": dept_id, "sla_hours": sla_hours},
            )

        admin_user, _ = User.objects.get_or_create(username="9900000000")
        admin_user.first_name = "Super Admin"
        admin_user.last_name = "Ward 2"
        admin_user.email = "admin@nmc.gov.in"
        admin_user.is_staff = True
        admin_user.is_superuser = True
        admin_user.is_active = True
        admin_user.set_password("Admin@123")
        admin_user.save()

        dept_email_slug = {1: "pwd", 2: "swm", 3: "phe", 4: "ele"}
        for mobile, meta in OFFICER_METADATA.items():
            officer, _ = User.objects.get_or_create(username=mobile)
            officer.first_name = meta["name"]
            officer.last_name = "Ward 2"
            officer.email = f"{dept_email_slug.get(meta['dept_id'], 'dept')}@nmc.gov.in"
            officer.is_staff = True
            officer.is_superuser = False
            officer.is_active = True
            officer.set_password("Officer@123")
            officer.save()

        worker_count = 0
        for mobile, meta in WORKER_METADATA.items():
            if not mobile.startswith("9800"):
                continue
            ward_digit = int(mobile[4])
            dept_digit = int(mobile[5])
            worker, _ = User.objects.get_or_create(username=mobile)
            worker.first_name = meta["name"]
            worker.last_name = f"Ward {ward_digit}"
            worker.email = f"{dept_email_slug.get(dept_digit, 'worker')}w{ward_digit}@worker.nmc.gov.in"
            worker.is_staff = False
            worker.is_superuser = False
            worker.is_active = True
            worker.set_password("worker123")
            worker.save()
            worker_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"JANMITRA bootstrap complete: 4 Wards, 4 Departments, 1 Admin, {len(OFFICER_METADATA)} Officers, {worker_count} Workers."
            )
        )
