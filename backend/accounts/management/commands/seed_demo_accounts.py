"""
==============================================================================
JANMITRA - Civic Issue Reporting & Management System
File: accounts/management/commands/seed_demo_accounts.py
Developer: Team ResolveIT (Lead: Faizan Rayeen & Anas Shaikh)
Description: Master Demo Seeder Command for Nagpur Municipal Corporation (NMC).
             Creates:
             1. Super Admin: 9900000000 / admin@123
             2. 4 Officers:
                - PWD: 9900000001 / admin@123
                - SWM: 9900000002 / admin@123
                - PHE: 9900000003 / admin@123
                - Electrical: 9900000004 / admin@123
             3. 16 Field Workers: 1 per (dept, ward) combination (worker@123)
             4. 4 Citizens: 1 per ward (citizen@123)
             5. 20 Realistic Civic Complaints across Nagpur landmarks with
                GPS coordinates, categories, wards, and lifecycle statuses.
==============================================================================
"""

import sys
import uuid
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction

# Force UTF-8 on Windows console output
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

from complaints.models import Category, Ward, Complaint
from notifications.auth_views import MOCK_USERS_DB
from dashboard.admin_workers_view import WORKERS_STORE

User = get_user_model()


class Command(BaseCommand):
    help = "Seed demo accounts and 20 realistic civic complaints across Nagpur Municipal Corporation"

    def add_arguments(self, parser):
        parser.add_argument(
            '--clean',
            action='store_true',
            help='Delete previously seeded demo data before creating new records',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING("\n" + "=" * 70))
        self.stdout.write(self.style.MIGRATE_HEADING("🏛️  JANMITRA MASTER DEMO SEEDER (NAGPUR MUNICIPAL CORPORATION)"))
        self.stdout.write(self.style.MIGRATE_HEADING("=" * 70))

        if options.get('clean'):
            self.stdout.write(self.style.WARNING("🧹 Cleaning existing demo data..."))
            Complaint.objects.all().delete()
            # Clean demo users starting with 990000
            User.objects.filter(username__startswith='990000').delete()

        # ======================================================================
        # 1. ENSURE WARDS (Wards 1 to 4)
        # ======================================================================
        self.stdout.write(self.style.HTTP_INFO("\n[1/5] Seeding Nagpur Municipal Wards (Wards 1 to 4)..."))
        wards_data = [
            (1, "Ward 1 - Laxmi Nagar / South-West Nagpur"),
            (2, "Ward 2 - Dharampeth / West Nagpur"),
            (3, "Ward 3 - Hanuman Nagar / South-East Nagpur"),
            (4, "Ward 4 - Mangalwari / North Nagpur")
        ]
        wards = {}
        for num, name in wards_data:
            ward_obj, created = Ward.objects.get_or_create(
                ward_number=num,
                defaults={'name': name}
            )
            if not created and ward_obj.name != name:
                ward_obj.name = name
                ward_obj.save()
            wards[num] = ward_obj
            self.stdout.write(f"   • {ward_obj.name}")

        # ======================================================================
        # 2. ENSURE CATEGORIES (PWD, SWM, PHE, Electrical)
        # ======================================================================
        self.stdout.write(self.style.HTTP_INFO("\n[2/5] Seeding Municipal Categories across 4 Departments..."))
        categories_data = [
            # PWD (department_id=1)
            ("Roads & Infrastructure", 1, 48),
            ("Pothole Repair", 1, 48),
            ("Footpath & Paver Blocks", 1, 72),
            # SWM (department_id=2)
            ("Garbage & Solid Waste", 2, 24),
            ("Overflowing Dustbin", 2, 24),
            ("Construction Debris & Waste", 2, 48),
            # PHE (department_id=3)
            ("Water Pipeline Leakage", 3, 24),
            ("Drainage & Sewer Choke", 3, 36),
            ("Contaminated Water Supply", 3, 24),
            # Electrical (department_id=4)
            ("Street Lighting & Lamp Posts", 4, 36),
            ("Flickering Light / Cable Fault", 4, 24),
            ("High Mast Light Repair", 4, 48),
        ]
        categories = {}
        for cat_name, dept_id, sla in categories_data:
            cat_obj, created = Category.objects.get_or_create(
                name=cat_name,
                defaults={'department_id': dept_id, 'sla_hours': sla}
            )
            categories[cat_name] = cat_obj
            self.stdout.write(f"   • [{dept_id}] {cat_name} (SLA: {sla}h)")

        # ======================================================================
        # 3. CREATE USERS
        # ======================================================================
        self.stdout.write(self.style.HTTP_INFO("\n[3/5] Seeding Master Demo Users (25 Accounts)..."))

        # Helper to create/update user
        def create_user(username, password, first_name, email, role, is_staff=False, is_super=False, ward_str="Ward 2"):
            user, _ = User.objects.get_or_create(username=username)
            user.first_name = first_name
            user.email = email
            user.is_staff = is_staff
            user.is_superuser = is_super
            user.set_password(password)
            user.save()

            # Synchronize with auth_views.MOCK_USERS_DB for instant REST login
            MOCK_USERS_DB[username] = {
                "id": str(user.id),
                "name": first_name,
                "mobile": username,
                "ward": ward_str,
                "role": role,
                "email": email
            }
            return user

        # 3.1 Super Admin (1 Account)
        super_admin = create_user(
            username='9900000000',
            password='admin@123',
            first_name='Super Admin (NMC Central Command)',
            email='admin@nmc.gov.in',
            role='admin',
            is_staff=True,
            is_super=True,
            ward_str='All Wards (Headquarters)'
        )
        self.stdout.write(self.style.SUCCESS(f"   👑 Super Admin: 9900000000 / admin@123 ({super_admin.first_name})"))

        # 3.2 4 Department Officers (1 per Department)
        officers_info = [
            ('9900000001', 'admin@123', 'Executive Engineer PWD (Shri V. R. Sharma)', 'pwd_officer@nmc.gov.in', 'PWD', 1),
            ('9900000002', 'admin@123', 'Sanitation Officer SWM (Dr. Anita Deshmukh)', 'swm_officer@nmc.gov.in', 'Solid Waste Management', 2),
            ('9900000003', 'admin@123', 'Water Works Engineer PHE (Er. Rajesh Thakre)', 'phe_officer@nmc.gov.in', 'Public Health Engineering', 3),
            ('9900000004', 'admin@123', 'Executive Engineer Electrical (Shri K. L. Bawankar)', 'ele_officer@nmc.gov.in', 'Electrical', 4),
        ]
        officers = {}
        for mobile, pwd, name, email, dept_name, d_id in officers_info:
            officer_user = create_user(
                username=mobile,
                password=pwd,
                first_name=name,
                email=email,
                role='dept_officer',
                is_staff=True,
                is_super=False,
                ward_str='All Wards'
            )
            # Add department metadata to mock DB entry
            MOCK_USERS_DB[mobile]['department'] = dept_name
            MOCK_USERS_DB[mobile]['dept_id'] = d_id
            officers[d_id] = officer_user
            self.stdout.write(f"   🏢 Officer ({dept_name}): {mobile} / {pwd}")

        # 3.3 16 Field Workers (1 per dept, ward combination)
        # Formula: 990000{dept_id}{ward_number:02d} -> e.g. PWD Ward 1 = 9900001101
        workers_matrix = {
            # PWD (dept_id=1)
            (1, 1): ('9900001101', 'NMC-PWD-W1', 'Ramesh Patil (PWD W1)'),
            (1, 2): ('9900001102', 'NMC-PWD-W2', 'Nitin Bawankar (PWD W2)'),
            (1, 3): ('9900001103', 'NMC-PWD-W3', 'Sunil Shinde (PWD W3)'),
            (1, 4): ('9900001104', 'NMC-PWD-W4', 'Vilas Wankhede (PWD W4)'),
            # SWM (dept_id=2)
            (2, 1): ('9900001201', 'NMC-SWM-W1', 'Ashok Gaikwad (SWM W1)'),
            (2, 2): ('9900001202', 'NMC-SWM-W2', 'Sunita Deshmukh (SWM W2)'),
            (2, 3): ('9900001203', 'NMC-SWM-W3', 'Kishor Meshram (SWM W3)'),
            (2, 4): ('9900001204', 'NMC-SWM-W4', 'Pooja Kohale (SWM W4)'),
            # PHE (dept_id=3)
            (3, 1): ('9900001301', 'NMC-PHE-W1', 'Vinod Thakre (PHE W1)'),
            (3, 2): ('9900001302', 'NMC-PHE-W2', 'Ganesh Bawankule (PHE W2)'),
            (3, 3): ('9900001303', 'NMC-PHE-W3', 'Suresh Kamble (PHE W3)'),
            (3, 4): ('9900001304', 'NMC-PHE-W4', 'Mahesh Sahare (PHE W4)'),
            # Electrical (dept_id=4)
            (4, 1): ('9900001401', 'NMC-ELE-W1', 'Pravin Wankhede (ELE W1)'),
            (4, 2): ('9900001402', 'NMC-ELE-W2', 'Dinesh Meshram (ELE W2)'),
            (4, 3): ('9900001403', 'NMC-ELE-W3', 'Sachin Dhote (ELE W3)'),
            (4, 4): ('9900001404', 'NMC-ELE-W4', 'Raju Gondane (ELE W4)'),
        }

        dept_labels = {1: 'PWD', 2: 'Solid Waste Management', 3: 'Public Health Engineering', 4: 'Electrical'}
        workers = {}
        for (dept_id, ward_num), (mobile, emp_id, full_name) in workers_matrix.items():
            worker_user = create_user(
                username=mobile,
                password='worker@123',
                first_name=full_name,
                email=f"{emp_id.lower()}@worker.nmc.gov.in",
                role='worker',
                is_staff=False,
                is_super=False,
                ward_str=f"Ward {ward_num}"
            )
            MOCK_USERS_DB[mobile]['employee_id'] = emp_id
            MOCK_USERS_DB[mobile]['department'] = dept_labels[dept_id]
            MOCK_USERS_DB[mobile]['ward_number'] = ward_num
            workers[(dept_id, ward_num)] = worker_user

            # Also register in WORKERS_STORE for admin table sync
            if not any(w.get('employee_id') == emp_id for w in WORKERS_STORE):
                WORKERS_STORE.append({
                    "id": str(worker_user.id),
                    "employee_id": emp_id,
                    "name": full_name,
                    "mobile": mobile,
                    "email": f"{emp_id.lower()}@worker.nmc.gov.in",
                    "department": dept_labels[dept_id],
                    "dept_id": dept_id,
                    "ward": ward_num,
                    "designation": "Field Technician",
                    "active_tasks": 2,
                    "status": "Active"
                })

        self.stdout.write(f"   👷 16 Field Workers created across 4 Departments and 4 Wards (worker@123)")

        # 3.4 4 Citizens (1 per ward)
        citizens_data = [
            ('9900002001', 'citizen@123', 'Citizen Ward 1 (Rahul Deshmukh)', 'rahul.d@gmail.com', 1),
            ('9900002002', 'citizen@123', 'Citizen Ward 2 (Priya Sharma)', 'priya.s@gmail.com', 2),
            ('9900002003', 'citizen@123', 'Citizen Ward 3 (Amit Verma)', 'amit.v@gmail.com', 3),
            ('9900002004', 'citizen@123', 'Faizan Rayeen (Citizen Ward 4)', 'faizan.rayeen@example.com', 4),
        ]
        citizens = {}
        for mobile, pwd, name, email, ward_num in citizens_data:
            c_user = create_user(
                username=mobile,
                password=pwd,
                first_name=name,
                email=email,
                role='citizen',
                is_staff=False,
                is_super=False,
                ward_str=f"Ward {ward_num}"
            )
            citizens[ward_num] = c_user
            self.stdout.write(f"   👤 Citizen Ward {ward_num}: {mobile} / {pwd} ({name})")

        # ======================================================================
        # 4. SEED 20 REALISTIC NAGPUR COMPLAINTS
        # ======================================================================
        self.stdout.write(self.style.HTTP_INFO("\n[4/5] Seeding 20 Realistic Civic Complaints across Nagpur..."))

        complaints_specs = [
            # 1. PWD - Ward 2
            {
                "title": "Severe asphalt crater and road sinking on WHC Road",
                "description": "Deep asphalt crater on West High Court Road near Shankar Nagar Square. Causing severe congestion and two-wheeler skids during rush hour.",
                "category": "Pothole Repair",
                "ward": 2,
                "lat": 21.1448, "lon": 79.0682,
                "address": "West High Court Road, near Shankar Nagar Square, Dharampeth, Nagpur - 440010",
                "status": "In-Progress",
                "photo_url": "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=600&q=80",
                "resolved_photo": "",
                "dept_id": 1,
            },
            # 2. SWM - Ward 2
            {
                "title": "Overflowing green community garbage bin at Gokulpeth Market",
                "description": "Market waste bin overflowing for 3 days attracting stray cattle and blocking customer pedestrian footpath near vegetable stalls.",
                "category": "Overflowing Dustbin",
                "ward": 2,
                "lat": 21.1412, "lon": 79.0610,
                "address": "Gokulpeth Vegetable Market, Dharampeth, Nagpur - 440010",
                "status": "Work Done",
                "photo_url": "https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=600&q=80",
                "resolved_photo": "https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=600&q=80",
                "dept_id": 2,
            },
            # 3. PHE - Ward 3
            {
                "title": "Underground main drinking water pipeline rupture",
                "description": "Continuous high-pressure clean water leakage from broken cast-iron pipeline corner near Medical College Square. Flooding road berm.",
                "category": "Water Pipeline Leakage",
                "ward": 3,
                "lat": 21.1275, "lon": 79.0968,
                "address": "Medical College Square, Hanuman Nagar Road, Nagpur - 440009",
                "status": "Assigned",
                "photo_url": "https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=600&q=80",
                "resolved_photo": "",
                "dept_id": 3,
            },
            # 4. Electrical - Ward 4
            {
                "title": "Streetlight pole short-circuit and blacked-out lane",
                "description": "Five consecutive sodium vapour lamp posts dead on Lane 4 of Mangalwari Bazaar since yesterday night. Women safety hazard.",
                "category": "Street Lighting & Lamp Posts",
                "ward": 4,
                "lat": 21.1610, "lon": 79.0795,
                "address": "Mangalwari Bazaar, Lane 4, Sadar / North Nagpur - 440001",
                "status": "Resolved",
                "photo_url": "https://images.unsplash.com/photo-1508873696983-2df5293cb32b?auto=format&fit=crop&w=600&q=80",
                "resolved_photo": "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&q=80",
                "dept_id": 4,
            },
            # 5. PWD - Ward 1
            {
                "title": "Broken interlock paver blocks on Laxmi Nagar footpath",
                "description": "Broken and loose paver tiles along Metro pillar 142. Pedestrians and senior citizens tripping while walking to Laxmi Nagar ground.",
                "category": "Footpath & Paver Blocks",
                "ward": 1,
                "lat": 21.1189, "lon": 79.0652,
                "address": "Near Metro Pillar 142, Laxmi Nagar Square, Nagpur - 440022",
                "status": "Validated",
                "photo_url": "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=600&q=80",
                "resolved_photo": "",
                "dept_id": 1,
            },
            # 6. SWM - Ward 1
            {
                "title": "Illegal dumping of renovation debris on Wardha Road",
                "description": "Two truckloads of broken concrete slabs and plaster bags dumped alongside service road near Khamla Chowk. Blocking stormwater drain.",
                "category": "Construction Debris & Waste",
                "ward": 1,
                "lat": 21.1095, "lon": 79.0741,
                "address": "Khamla Service Road, off Wardha Road, Ward 1, Nagpur - 440025",
                "status": "Submitted",
                "photo_url": "https://images.unsplash.com/photo-1605600659873-d808a13e4d2a?auto=format&fit=crop&w=600&q=80",
                "resolved_photo": "",
                "dept_id": 2,
            },
            # 7. PHE - Ward 2
            {
                "title": "Blocked sewage chamber overflowing on Sitabuldi Main Road",
                "description": "Underground sewer chamber choked with silt and polythene. Dark foul-smelling effluent bubbling onto shopping street.",
                "category": "Drainage & Sewer Choke",
                "ward": 2,
                "lat": 21.1465, "lon": 79.0825,
                "address": "Sitabuldi Main Shopping Road, near Variety Square, Nagpur - 440012",
                "status": "Closed",
                "photo_url": "https://images.unsplash.com/photo-1584467735871-8e85353a8413?auto=format&fit=crop&w=600&q=80",
                "resolved_photo": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80",
                "dept_id": 3,
            },
            # 8. Electrical - Ward 3
            {
                "title": "High-mast tower spotlight failure at Sakkardara Lake garden",
                "description": "Three out of four high-mast stadium bulbs unlit for over a week. Children playground and walking track pitch dark.",
                "category": "High Mast Light Repair",
                "ward": 3,
                "lat": 21.1215, "lon": 79.1142,
                "address": "Sakkardara Lake Garden, Sakkardara, Ward 3, Nagpur - 440024",
                "status": "In-Progress",
                "photo_url": "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=600&q=80",
                "resolved_photo": "",
                "dept_id": 4,
            },
            # 9. PWD - Ward 4
            {
                "title": "Road depression and uneven bitumen seam on Central Avenue",
                "description": "Asphalt depression 4 inches deep stretching across 15 meters near Gandhibagh wholesale cloth market. Heavy truck axle impact.",
                "category": "Roads & Infrastructure",
                "ward": 4,
                "lat": 21.1524, "lon": 79.1021,
                "address": "Central Avenue, near Agrasen Chowk, Gandhibagh, Nagpur - 440002",
                "status": "Resolved",
                "photo_url": "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=600&q=80",
                "resolved_photo": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80",
                "dept_id": 1,
            },
            # 10. SWM - Ward 1
            {
                "title": "Uncollected domestic garbage heap at Pratap Nagar Park corner",
                "description": "Daily residential garbage dumping corner unattended by door-to-door ghanta-gadi for four consecutive days.",
                "category": "Garbage & Solid Waste",
                "ward": 1,
                "lat": 21.1148, "lon": 79.0532,
                "address": "Near Pratap Nagar Park, Ring Road Corner, Ward 1, Nagpur - 440022",
                "status": "Closed",
                "photo_url": "https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=600&q=80",
                "resolved_photo": "https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=600&q=80",
                "dept_id": 2,
            },
            # 11. PHE - Ward 4
            {
                "title": "Muddy turbid tap water supply in Itwari residential society",
                "description": "Drinking water supplied through municipal taps contains brown silt and foul odour. Suspected sewage line cross-leakage.",
                "category": "Contaminated Water Supply",
                "ward": 4,
                "lat": 21.1568, "lon": 79.1175,
                "address": "Sarafa Bazaar Lane, Itwari, Ward 4, Nagpur - 440002",
                "status": "Validated",
                "photo_url": "https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=600&q=80",
                "resolved_photo": "",
                "dept_id": 3,
            },
            # 12. Electrical - Ward 4
            {
                "title": "Low hanging snapped electrical line near Sadar Residency",
                "description": "Storm-damaged overhead service wire dangling 5 feet above road surface near Mount Road turning. Critical hazard.",
                "category": "Flickering Light / Cable Fault",
                "ward": 4,
                "lat": 21.1624, "lon": 79.0812,
                "address": "Mount Road Extension, Sadar, Ward 4, Nagpur - 440001",
                "status": "Assigned",
                "photo_url": "https://images.unsplash.com/photo-1508873696983-2df5293cb32b?auto=format&fit=crop&w=600&q=80",
                "resolved_photo": "",
                "dept_id": 4,
            },
            # 13. PWD - Ward 1
            {
                "title": "Cracked stormwater concrete cover slab at Trimurti Nagar",
                "description": "Heavy cement slab over roadside stormwater culvert shattered under tractor weight. Gaping 3x3 foot hole on road shoulder.",
                "category": "Roads & Infrastructure",
                "ward": 1,
                "lat": 21.1072, "lon": 79.0489,
                "address": "Ring Road Junction, Trimurti Nagar, Ward 1, Nagpur - 440022",
                "status": "In-Progress",
                "photo_url": "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=600&q=80",
                "resolved_photo": "",
                "dept_id": 1,
            },
            # 14. SWM - Ward 3
            {
                "title": "Decaying horticulture waste dumped at Reshimbagh ground",
                "description": "Tree trimmings, dried branches, and coconut shells dumped on open ground boundary attracting flies and mosquitoes.",
                "category": "Garbage & Solid Waste",
                "ward": 3,
                "lat": 21.1298, "lon": 79.1082,
                "address": "Reshimbagh Ground Outer Perimeter, Great Nag Road, Nagpur - 440009",
                "status": "Work Done",
                "photo_url": "https://images.unsplash.com/photo-1605600659873-d808a13e4d2a?auto=format&fit=crop&w=600&q=80",
                "resolved_photo": "https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=600&q=80",
                "dept_id": 2,
            },
            # 15. PHE - Ward 2
            {
                "title": "Low water pressure in municipal pipeline at Ramdaspeth",
                "description": "Morning municipal water supply running at trickle pressure on Canal Road. Overhead storage tanks unable to fill.",
                "category": "Water Pipeline Leakage",
                "ward": 2,
                "lat": 21.1382, "lon": 79.0745,
                "address": "Canal Road, Near Central Bazar Road, Ramdaspeth, Nagpur - 440010",
                "status": "Submitted",
                "photo_url": "https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=600&q=80",
                "resolved_photo": "",
                "dept_id": 3,
            },
            # 16. Electrical - Ward 4
            {
                "title": "Astronomical timer desynchronized on Koradi Road",
                "description": "LED streetlights switching on at 8 PM instead of 6:30 PM due to faulty timer relay panel near Mankapur flyover.",
                "category": "Street Lighting & Lamp Posts",
                "ward": 4,
                "lat": 21.1782, "lon": 79.0882,
                "address": "Koradi Highway, Near Mankapur Sports Stadium, Nagpur - 440030",
                "status": "Closed",
                "photo_url": "https://images.unsplash.com/photo-1508873696983-2df5293cb32b?auto=format&fit=crop&w=600&q=80",
                "resolved_photo": "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&q=80",
                "dept_id": 4,
            },
            # 17. PWD - Ward 3
            {
                "title": "Multiple asphalt cracks and potholes at Besa Square junction",
                "description": "Potholes along turning radius of Besa Chowk causing heavy vehicular jerk and motorcycle balance loss.",
                "category": "Pothole Repair",
                "ward": 3,
                "lat": 21.0965, "lon": 79.0872,
                "address": "Besa Square, Besa-Manewada Road, Ward 3, Nagpur - 440037",
                "status": "Assigned",
                "photo_url": "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=600&q=80",
                "resolved_photo": "",
                "dept_id": 1,
            },
            # 18. SWM - Ward 4
            {
                "title": "Plastic and packaging waste choking stormwater nullah",
                "description": "Single-use polythene and thermocol packaging clogged in concrete drain grate near Jaripatka market railway gate.",
                "category": "Garbage & Solid Waste",
                "ward": 4,
                "lat": 21.1812, "lon": 79.0985,
                "address": "Jaripatka Market, Near Railway Crossing, Ward 4, Nagpur - 440014",
                "status": "Validated",
                "photo_url": "https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=600&q=80",
                "resolved_photo": "",
                "dept_id": 2,
            },
            # 19. PHE - Ward 3
            {
                "title": "Overflowing sewer chamber on Manewada Ring Road",
                "description": "Manhole backflow spewing wastewater across bus stop lane on Manewada main road. Pedestrians unable to board city buses.",
                "category": "Drainage & Sewer Choke",
                "ward": 3,
                "lat": 21.1042, "lon": 79.1012,
                "address": "Manewada Ring Road Chowk, Ward 3, Nagpur - 440027",
                "status": "Resolved",
                "photo_url": "https://images.unsplash.com/photo-1584467735871-8e85353a8413?auto=format&fit=crop&w=600&q=80",
                "resolved_photo": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80",
                "dept_id": 3,
            },
            # 20. Electrical - Ward 2
            {
                "title": "Streetlight pole severely bent after vehicle impact",
                "description": "Galvanized tubular steel pole tilted at 30-degree angle after truck collision near Cotton Market square. Threatening overhead cables.",
                "category": "Street Lighting & Lamp Posts",
                "ward": 2,
                "lat": 21.1432, "lon": 79.0915,
                "address": "Subhash Road, Near Cotton Market Railway Overbridge, Nagpur - 440018",
                "status": "Work Done",
                "photo_url": "https://images.unsplash.com/photo-1508873696983-2df5293cb32b?auto=format&fit=crop&w=600&q=80",
                "resolved_photo": "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&q=80",
                "dept_id": 4,
            },
        ]

        created_complaints = 0
        for idx, spec in enumerate(complaints_specs, start=1):
            w_obj = wards[spec['ward']]
            c_obj = categories[spec['category']]
            citizen_user = citizens[spec['ward']]
            assigned_worker_user = workers[(spec['dept_id'], spec['ward'])]

            tracking_code = f"NMC-2026-N{idx:02d}{spec['ward']}"

            complaint_record, created = Complaint.objects.get_or_create(
                tracking_id=tracking_code,
                defaults={
                    'title': spec['title'],
                    'description': spec['description'],
                    'category': c_obj,
                    'ward': w_obj,
                    'citizen': citizen_user,
                    'assigned_worker': assigned_worker_user,
                    'latitude': spec['lat'],
                    'longitude': spec['lon'],
                    'address': spec['address'],
                    'status': spec['status'],
                    'photo_url': spec['photo_url'],
                    'resolved_photo_url': spec['resolved_photo'],
                }
            )
            if not created:
                complaint_record.title = spec['title']
                complaint_record.description = spec['description']
                complaint_record.category = c_obj
                complaint_record.ward = w_obj
                complaint_record.citizen = citizen_user
                complaint_record.assigned_worker = assigned_worker_user
                complaint_record.latitude = spec['lat']
                complaint_record.longitude = spec['lon']
                complaint_record.address = spec['address']
                complaint_record.status = spec['status']
                complaint_record.photo_url = spec['photo_url']
                complaint_record.resolved_photo_url = spec['resolved_photo']
                complaint_record.save()

            created_complaints += 1
            self.stdout.write(
                f"   [{idx:02d}] {tracking_code} | {spec['status']:<12} | Ward {spec['ward']} ({c_obj.name}) -> {assigned_worker_user.first_name}"
            )

        # ======================================================================
        # 5. SUMMARY REPORT
        # ======================================================================
        self.stdout.write(self.style.MIGRATE_HEADING("\n" + "=" * 70))
        self.stdout.write(self.style.SUCCESS("🎉  JANMITRA MASTER DEMO SEEDING COMPLETED SUCCESSFULLY!"))
        self.stdout.write(self.style.MIGRATE_HEADING("=" * 70))
        self.stdout.write(f"• Wards Seeded:       {len(wards)} (Wards 1 to 4)")
        self.stdout.write(f"• Categories Seeded:  {len(categories)} across 4 Departments")
        self.stdout.write(f"• Super Admin:        1 (9900000000 / admin@123)")
        self.stdout.write(f"• Officers:           4 (9900000001 to 9900000004 / admin@123)")
        self.stdout.write(f"• Field Workers:      16 (1 per Dept x Ward / worker@123)")
        self.stdout.write(f"• Citizens:           4 (1 per Ward / citizen@123)")
        self.stdout.write(f"• Total Users Seeded: 25 Accounts")
        self.stdout.write(f"• Complaints Seeded:  {created_complaints} across Nagpur City")
        self.stdout.write(self.style.MIGRATE_HEADING("=" * 70 + "\n"))
