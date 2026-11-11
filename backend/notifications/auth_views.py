"""
==============================================================================
JANMITRA - Civic Issue Reporting & Management System
File: notifications/auth_views.py
Developer: Anas Shaikh & Faizan Rayeen
Description: Production-ready Authentication API views for Citizen Registration &
             Role-based Login (Citizen, Field Worker, Department Officer, Admin).
             100% database-backed with PBKDF2 password verification.
==============================================================================
"""

import re
import uuid
import jwt
import datetime
import logging
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

logger = logging.getLogger(__name__)
User = get_user_model()

# Keep empty dictionary for compatibility with external references
MOCK_USERS_DB = {}

# Field Worker registry mapping (4 Wards x 4 Departments x 2 Workers = 32 Dedicated Field Workers)
WORKER_METADATA = {
    # ================= Ward 1 (Laxmi Nagar / South-West Nagpur) =================
    '9800110001': {'name': 'Ramesh Patil', 'department': 'PWD', 'dept_id': 1, 'ward': 'Ward 1 (Laxmi Nagar / South-West Nagpur)', 'employee_id': 'JMC-W1-PWD-01'},
    '9800110002': {'name': 'Suresh Kamble', 'department': 'PWD', 'dept_id': 1, 'ward': 'Ward 1 (Laxmi Nagar / South-West Nagpur)', 'employee_id': 'JMC-W1-PWD-02'},
    '9800120001': {'name': 'Ashok Gaikwad', 'department': 'Solid Waste Management', 'dept_id': 2, 'ward': 'Ward 1 (Laxmi Nagar / South-West Nagpur)', 'employee_id': 'JMC-W1-SWM-01'},
    '9800120002': {'name': 'Kavita Raut', 'department': 'Solid Waste Management', 'dept_id': 2, 'ward': 'Ward 1 (Laxmi Nagar / South-West Nagpur)', 'employee_id': 'JMC-W1-SWM-02'},
    '9800130001': {'name': 'Vinod Thakre', 'department': 'Public Health Engineering', 'dept_id': 3, 'ward': 'Ward 1 (Laxmi Nagar / South-West Nagpur)', 'employee_id': 'JMC-W1-PHE-01'},
    '9800130002': {'name': 'Sachin Dhote', 'department': 'Public Health Engineering', 'dept_id': 3, 'ward': 'Ward 1 (Laxmi Nagar / South-West Nagpur)', 'employee_id': 'JMC-W1-PHE-02'},
    '9800140001': {'name': 'Pravin Wankhede', 'department': 'Electrical', 'dept_id': 4, 'ward': 'Ward 1 (Laxmi Nagar / South-West Nagpur)', 'employee_id': 'JMC-W1-ELE-01'},
    '9800140002': {'name': 'Raju Gondane', 'department': 'Electrical', 'dept_id': 4, 'ward': 'Ward 1 (Laxmi Nagar / South-West Nagpur)', 'employee_id': 'JMC-W1-ELE-02'},

    # ================= Ward 2 (Dhantoli / Central Nagpur) =================
    '9800210001': {'name': 'Nitin Bawankar', 'department': 'PWD', 'dept_id': 1, 'ward': 'Ward 2 (Dhantoli / Central Nagpur)', 'employee_id': 'JMC-W2-PWD-01'},
    '9800210002': {'name': 'Pravin Kadu', 'department': 'PWD', 'dept_id': 1, 'ward': 'Ward 2 (Dhantoli / Central Nagpur)', 'employee_id': 'JMC-W2-PWD-02'},
    '9800220001': {'name': 'Sunita Deshmukh', 'department': 'Solid Waste Management', 'dept_id': 2, 'ward': 'Ward 2 (Dhantoli / Central Nagpur)', 'employee_id': 'JMC-W2-SWM-01'},
    '9800220002': {'name': 'Vinod Meshram', 'department': 'Solid Waste Management', 'dept_id': 2, 'ward': 'Ward 2 (Dhantoli / Central Nagpur)', 'employee_id': 'JMC-W2-SWM-02'},
    '9800230001': {'name': 'Ganesh Bawankule', 'department': 'Public Health Engineering', 'dept_id': 3, 'ward': 'Ward 2 (Dhantoli / Central Nagpur)', 'employee_id': 'JMC-W2-PHE-01'},
    '9800230002': {'name': 'Anand Sharma', 'department': 'Public Health Engineering', 'dept_id': 3, 'ward': 'Ward 2 (Dhantoli / Central Nagpur)', 'employee_id': 'JMC-W2-PHE-02'},
    '9800240001': {'name': 'Dinesh Meshram', 'department': 'Electrical', 'dept_id': 4, 'ward': 'Ward 2 (Dhantoli / Central Nagpur)', 'employee_id': 'JMC-W2-ELE-01'},
    '9800240002': {'name': 'Manoj Gajbhiye', 'department': 'Electrical', 'dept_id': 4, 'ward': 'Ward 2 (Dhantoli / Central Nagpur)', 'employee_id': 'JMC-W2-ELE-02'},

    # ================= Ward 3 (Hanuman Nagar / South-East Nagpur) =================
    '9800310001': {'name': 'Sunil Shinde', 'department': 'PWD', 'dept_id': 1, 'ward': 'Ward 3 (Hanuman Nagar / South-East Nagpur)', 'employee_id': 'JMC-W3-PWD-01'},
    '9800310002': {'name': 'Sanjay Kohale', 'department': 'PWD', 'dept_id': 1, 'ward': 'Ward 3 (Hanuman Nagar / South-East Nagpur)', 'employee_id': 'JMC-W3-PWD-02'},
    '9800320001': {'name': 'Kishor Meshram', 'department': 'Solid Waste Management', 'dept_id': 2, 'ward': 'Ward 3 (Hanuman Nagar / South-East Nagpur)', 'employee_id': 'JMC-W3-SWM-01'},
    '9800320002': {'name': 'Rekha Mandpe', 'department': 'Solid Waste Management', 'dept_id': 2, 'ward': 'Ward 3 (Hanuman Nagar / South-East Nagpur)', 'employee_id': 'JMC-W3-SWM-02'},
    '9800330001': {'name': 'Sunil Thakre', 'department': 'Public Health Engineering', 'dept_id': 3, 'ward': 'Ward 3 (Hanuman Nagar / South-East Nagpur)', 'employee_id': 'JMC-W3-PHE-01'},
    '9800330002': {'name': 'Prashant Zade', 'department': 'Public Health Engineering', 'dept_id': 3, 'ward': 'Ward 3 (Hanuman Nagar / South-East Nagpur)', 'employee_id': 'JMC-W3-PHE-02'},
    '9800340001': {'name': 'Ravindra Shende', 'department': 'Electrical', 'dept_id': 4, 'ward': 'Ward 3 (Hanuman Nagar / South-East Nagpur)', 'employee_id': 'JMC-W3-ELE-01'},
    '9800340002': {'name': 'Ashish Wanjari', 'department': 'Electrical', 'dept_id': 4, 'ward': 'Ward 3 (Hanuman Nagar / South-East Nagpur)', 'employee_id': 'JMC-W3-ELE-02'},

    # ================= Ward 4 (Mangalwari / North Nagpur) =================
    '9800410001': {'name': 'Vilas Wankhede', 'department': 'PWD', 'dept_id': 1, 'ward': 'Ward 4 (Mangalwari / North Nagpur)', 'employee_id': 'JMC-W4-PWD-01'},
    '9800410002': {'name': 'Santosh Bhure', 'department': 'PWD', 'dept_id': 1, 'ward': 'Ward 4 (Mangalwari / North Nagpur)', 'employee_id': 'JMC-W4-PWD-02'},
    '9800420001': {'name': 'Pooja Kohale', 'department': 'Solid Waste Management', 'dept_id': 2, 'ward': 'Ward 4 (Mangalwari / North Nagpur)', 'employee_id': 'JMC-W4-SWM-01'},
    '9800420002': {'name': 'Dilip Gedam', 'department': 'Solid Waste Management', 'dept_id': 2, 'ward': 'Ward 4 (Mangalwari / North Nagpur)', 'employee_id': 'JMC-W4-SWM-02'},
    '9800430001': {'name': 'Mahesh Sahare', 'department': 'Public Health Engineering', 'dept_id': 3, 'ward': 'Ward 4 (Mangalwari / North Nagpur)', 'employee_id': 'JMC-W4-PHE-01'},
    '9800430002': {'name': 'Ajay Tembhurne', 'department': 'Public Health Engineering', 'dept_id': 3, 'ward': 'Ward 4 (Mangalwari / North Nagpur)', 'employee_id': 'JMC-W4-PHE-02'},
    '9800440001': {'name': 'Rahul Somkuwar', 'department': 'Electrical', 'dept_id': 4, 'ward': 'Ward 4 (Mangalwari / North Nagpur)', 'employee_id': 'JMC-W4-ELE-01'},
    '9800440002': {'name': 'Nitin Borkar', 'department': 'Electrical', 'dept_id': 4, 'ward': 'Ward 4 (Mangalwari / North Nagpur)', 'employee_id': 'JMC-W4-ELE-02'},

    # Legacy & Quick Fallback Mappings
    '9822110001': {'name': 'Nitin Bawankar', 'department': 'PWD', 'dept_id': 1, 'ward': 'Ward 2 (Dhantoli / Central Nagpur)'},
    '9822110002': {'name': 'Vinod Meshram', 'department': 'Solid Waste Management', 'dept_id': 2, 'ward': 'Ward 2 (Dhantoli / Central Nagpur)'},
    '9822345671': {'name': 'Suresh Kamble', 'department': 'PWD', 'dept_id': 1, 'ward': 'Ward 1 (Laxmi Nagar / South-West Nagpur)'},
    '9822345672': {'name': 'Sunita Deshmukh', 'department': 'Solid Waste Management', 'dept_id': 2, 'ward': 'Ward 2 (Dhantoli / Central Nagpur)'},
    '9822345673': {'name': 'Sunil Thakre', 'department': 'Public Health Engineering', 'dept_id': 3, 'ward': 'Ward 3 (Hanuman Nagar / South-East Nagpur)'},
    '9822345674': {'name': 'Pravin Wankhede', 'department': 'Electrical', 'dept_id': 4, 'ward': 'Ward 4 (Mangalwari / North Nagpur)'},
    '9900001101': {'name': 'Ramesh Patil', 'department': 'PWD', 'dept_id': 1, 'ward': 'Ward 1 (Laxmi Nagar)'},
    '9900001102': {'name': 'Nitin Bawankar', 'department': 'PWD', 'dept_id': 1, 'ward': 'Ward 2 (Dhantoli)'},
    '9900001103': {'name': 'Sunil Shinde', 'department': 'PWD', 'dept_id': 1, 'ward': 'Ward 3 (Hanuman Nagar)'},
    '9900001104': {'name': 'Vilas Wankhede', 'department': 'PWD', 'dept_id': 1, 'ward': 'Ward 4 (Mangalwari)'},
    '9900001201': {'name': 'Ashok Gaikwad', 'department': 'Solid Waste Management', 'dept_id': 2, 'ward': 'Ward 1 (Laxmi Nagar)'},
    '9900001202': {'name': 'Sunita Deshmukh', 'department': 'Solid Waste Management', 'dept_id': 2, 'ward': 'Ward 2 (Dhantoli)'},
    '9900001203': {'name': 'Kishor Meshram', 'department': 'Solid Waste Management', 'dept_id': 2, 'ward': 'Ward 3 (Hanuman Nagar)'},
    '9900001204': {'name': 'Pooja Kohale', 'department': 'Solid Waste Management', 'dept_id': 2, 'ward': 'Ward 4 (Mangalwari)'},
    '9900001301': {'name': 'Vinod Thakre', 'department': 'Public Health Engineering', 'dept_id': 3, 'ward': 'Ward 1 (Laxmi Nagar)'},
    '9900001302': {'name': 'Ganesh Bawankule', 'department': 'Public Health Engineering', 'dept_id': 3, 'ward': 'Ward 2 (Dhantoli)'},
    '9900001303': {'name': 'Suresh Kamble', 'department': 'Public Health Engineering', 'dept_id': 3, 'ward': 'Ward 3 (Hanuman Nagar)'},
    '9900001304': {'name': 'Mahesh Sahare', 'department': 'Public Health Engineering', 'dept_id': 3, 'ward': 'Ward 4 (Mangalwari)'},
    '9900001401': {'name': 'Pravin Wankhede', 'department': 'Electrical', 'dept_id': 4, 'ward': 'Ward 1 (Laxmi Nagar)'},
    '9900001402': {'name': 'Dinesh Meshram', 'department': 'Electrical', 'dept_id': 4, 'ward': 'Ward 2 (Dhantoli)'},
    '9900001403': {'name': 'Sachin Dhote', 'department': 'Electrical', 'dept_id': 4, 'ward': 'Ward 3 (Hanuman Nagar)'},
    '9900001404': {'name': 'Raju Gondane', 'department': 'Electrical', 'dept_id': 4, 'ward': 'Ward 4 (Mangalwari)'},
}

# Department Officer registry mapping
OFFICER_METADATA = {
    '9900000001': {'name': 'Executive Engineer PWD (Shri V. R. Sharma)', 'department': 'PWD', 'dept_id': 1},
    '9900000002': {'name': 'Sanitation Officer SWM (Dr. Anita Deshmukh)', 'department': 'Solid Waste Management', 'dept_id': 2},
    '9900000003': {'name': 'Water Works Engineer PHE (Er. Rajesh Thakre)', 'department': 'Public Health Engineering', 'dept_id': 3},
    '9900000004': {'name': 'Executive Engineer Electrical (Shri K. L. Bawankar)', 'department': 'Electrical', 'dept_id': 4},
}


def generate_jwt_token(user_id, role, mobile):
    """
    Generate HS256 JWT access token valid for 7 days.
    """
    payload = {
        'user_id': str(user_id),
        'role': role,
        'mobile': mobile,
        'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=7),
        'iat': datetime.datetime.now(datetime.timezone.utc)
    }
    secret = getattr(settings, 'SECRET_KEY', 'janmitra-secret-key-2026')
    return jwt.encode(payload, secret, algorithm='HS256')


def get_authenticated_user_from_request(request):
    """
    Strictly resolve authenticated active Django User object from Django session
    or HS256 Bearer JWT header. Never accepts unauthenticated mobile parameters.
    """
    if getattr(request, 'user', None) and request.user.is_authenticated:
        return request.user if request.user.is_active else None

    auth_header = (
        (request.headers.get('Authorization') if hasattr(request, 'headers') else None)
        or (request.META.get('HTTP_AUTHORIZATION') if hasattr(request, 'META') else None)
        or ''
    )
    if auth_header.startswith('Bearer '):
        token = auth_header.split(' ', 1)[1].strip()
        try:
            secret = getattr(settings, 'SECRET_KEY', 'janmitra-secret-key-2026')
            payload = jwt.decode(token, secret, algorithms=['HS256'])
            user_id = payload.get('user_id')
            mobile = payload.get('mobile')
            if user_id:
                u = User.objects.filter(id=user_id, is_active=True).first()
                if u:
                    return u
            if mobile:
                u = User.objects.filter(username=mobile, is_active=True).first()
                if u:
                    return u
        except Exception:
            pass

    return None


class RegisterView(APIView):
    """
    POST /api/v1/auth/register/
    Registers a Citizen with name, mobile, email, ward, and password.
    Saves strictly into Django User database with hashed password.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data
        name = (data.get('name') or data.get('full_name') or '').strip()
        mobile = (data.get('mobile') or data.get('phone') or '').strip()
        email = (data.get('email') or '').strip().lower()
        ward = (data.get('ward') or 'Ward 2 (Dhantoli / Central Nagpur)').strip()
        password = data.get('password') or ''

        # 1. Validation checks
        if not name:
            return Response({'name': ['Full name is required.']}, status=status.HTTP_400_BAD_REQUEST)
        if len(name) < 3:
            return Response({'name': ['Name must be at least 3 characters.']}, status=status.HTTP_400_BAD_REQUEST)

        if not mobile:
            return Response({'mobile': ['Mobile number is required.']}, status=status.HTTP_400_BAD_REQUEST)
        if not re.match(r'^[6-9]\d{9}$', mobile):
            return Response({'mobile': ['Enter a valid 10-digit Indian mobile number.']}, status=status.HTTP_400_BAD_REQUEST)
        if mobile.startswith('9800') or mobile.startswith('990000'):
            return Response({'mobile': ['This mobile number series is reserved for municipal staff.']}, status=status.HTTP_400_BAD_REQUEST)

        if not email:
            return Response({'email': ['Email address is required.']}, status=status.HTTP_400_BAD_REQUEST)
        if not re.match(r'^[\w\.-]+@[\w\.-]+\.\w+$', email):
            return Response({'email': ['Enter a valid email address.']}, status=status.HTTP_400_BAD_REQUEST)
        if '@worker' in email or email.endswith('@nmc.gov.in') or email.endswith('@janmitra.gov.in'):
            return Response({'email': ['Staff email domains cannot be used for citizen registration.']}, status=status.HTTP_400_BAD_REQUEST)

        if not password:
            return Response({'password': ['Password is required.']}, status=status.HTTP_400_BAD_REQUEST)
        if len(password) < 6:
            return Response({'password': ['Password must be at least 6 characters long.']}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Check if mobile already exists in database
        if User.objects.filter(username=mobile).exists():
            print(f"[AUTH REGISTER BLOCKED] Mobile {mobile} is already registered.", flush=True)
            return Response({
                'detail': f'Mobile number {mobile} is already registered. Please sign in.',
                'mobile': ['Mobile number is already registered.']
            }, status=status.HTTP_400_BAD_REQUEST)

        # 3. Check if email already exists in database
        if User.objects.filter(email=email).exists():
            print(f"[AUTH REGISTER BLOCKED] Email {email} is already in use.", flush=True)
            return Response({
                'detail': f'Email address {email} is already registered. Please use another email or sign in.',
                'email': ['Email address is already registered.']
            }, status=status.HTTP_400_BAD_REQUEST)

        # 4. Save new citizen to Django Database
        try:
            user = User(
                username=mobile,
                email=email,
                first_name=name,
                last_name=ward,  # Storing ward in last_name
                is_staff=False,
                is_superuser=False
            )
            user.set_password(password)
            user.save()

            # Terminal Console Logging
            print("\n" + "=" * 65, flush=True)
            print("🏛️ [JANMITRA BACKEND] NEW CITIZEN REGISTERED IN DATABASE", flush=True)
            print(f"  👤 Name:     {name}", flush=True)
            print(f"  📱 Mobile:   {mobile}", flush=True)
            print(f"  📧 Email:    {email}", flush=True)
            print(f"  📍 Ward:     {ward}", flush=True)
            print(f"  🔒 Security: PBKDF2 Password Hash Saved in SQLite", flush=True)
            print("=" * 65 + "\n", flush=True)

            user_record = {
                "id": str(user.id),
                "name": user.first_name,
                "mobile": user.username,
                "email": user.email,
                "ward": user.last_name,
                "role": "citizen"
            }

            return Response({
                "status": "success",
                "message": "You have successfully registered! Please sign in with your credentials.",
                "user": user_record
            }, status=status.HTTP_201_CREATED)

        except Exception as exc:
            print(f"[AUTH REGISTER ERROR] Failed to save user: {exc}", flush=True)
            return Response({
                "detail": f"Registration failed due to server error: {str(exc)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LoginView(APIView):
    """
    POST /api/v1/auth/login/
    Authenticates user strictly via database credentials (mobile/email & password).
    Rejects wrong credentials with 401 Unauthorized.
    Identifies role: citizen, worker, dept_officer, admin.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data
        identifier = (data.get('mobile') or data.get('phone') or data.get('username') or data.get('email') or '').strip()
        password = data.get('password') or ''

        print(f"\n[AUTH LOGIN REQUEST] Checking database credentials for: '{identifier}'", flush=True)

        if not identifier:
            return Response({'mobile': ['Mobile number or email is required.']}, status=status.HTTP_400_BAD_REQUEST)
        if not password:
            return Response({'password': ['Password is required.']}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Lookup User in SQLite Database (by mobile/username or email)
        user = User.objects.filter(username=identifier).first()
        if not user and '@' in identifier:
            user = User.objects.filter(email=identifier.lower()).first()

        if not user:
            print(f"[AUTH LOGIN REJECTED] No registered account found for identifier: '{identifier}'", flush=True)
            return Response({
                "detail": "Invalid mobile number or password. Please verify your credentials."
            }, status=status.HTTP_401_UNAUTHORIZED)

        if not user.is_active:
            return Response({
                "detail": "Account disabled: This staff account is currently inactive. Please contact Municipal Administration."
            }, status=status.HTTP_403_FORBIDDEN)

        # 2. Verify Password strictly using PBKDF2 hash stored in SQLite
        if not user.check_password(password):
            print(f"[AUTH LOGIN REJECTED] Wrong password entered for user '{user.username}' ({user.first_name})", flush=True)
            return Response({
                "detail": "Invalid mobile number or password. Please verify your credentials."
            }, status=status.HTTP_401_UNAUTHORIZED)

        # Load any custom Admin-managed worker overrides cleanly
        custom_workers = {}
        try:
            import os, json
            wp_path = os.path.join(settings.BASE_DIR, 'media', 'worker_profiles.json')
            if os.path.exists(wp_path):
                with open(wp_path, 'r', encoding='utf-8') as fp:
                    custom_workers = json.load(fp) or {}
        except Exception:
            custom_workers = {}

        # 3. Determine User Role & Metadata
        mobile = user.username
        dept = None
        ward = user.last_name or 'Ward 2 (Dhantoli / Central Nagpur)'

        if user.is_superuser or mobile == '9900000000':
            role = 'admin'
            dept = 'Central Municipal Command'
            name = user.first_name or 'Super Admin (JMC)'
        elif mobile in OFFICER_METADATA or user.is_staff:
            role = 'dept_officer'
            officer_meta = OFFICER_METADATA.get(mobile, {})
            dept = officer_meta.get('department', 'Municipal Operations')
            name = officer_meta.get('name', user.first_name or 'Department Officer')
        elif (
            mobile in WORKER_METADATA
            or mobile in custom_workers
            or mobile.startswith('9800')
            or mobile.startswith('9900001')
            or user.groups.filter(name='FIELD_WORKER').exists()
        ):
            role = 'worker'
            worker_meta = {**WORKER_METADATA.get(mobile, {}), **custom_workers.get(mobile, {})}
            dept = worker_meta.get('department', 'Field Operations')
            ward = worker_meta.get('ward_name') or (f"Ward {worker_meta['ward']}" if worker_meta.get('ward') else ward)
            name = worker_meta.get('name', user.first_name or 'Field Worker')
        else:
            role = 'citizen'
            name = user.first_name or f"Citizen {mobile[-4:]}"

        # 4. Enforce Portal-Specific Role Boundaries
        portal = (data.get('portal') or data.get('requested_role') or '').strip().lower()
        if portal == 'worker' and role != 'worker':
            print(f"[AUTH LOGIN RESTRICTED] Non-worker account '{mobile}' (Role: {role}) denied access to Field Worker Portal.", flush=True)
            return Response({
                "detail": "Access restricted: This portal is strictly for authorized municipal Field Workers. Citizen accounts cannot sign in here."
            }, status=status.HTTP_403_FORBIDDEN)

        if portal == 'citizen' and role != 'citizen':
            print(f"[AUTH LOGIN RESTRICTED] Staff/Worker account '{mobile}' (Role: {role}) denied access to Citizen Portal.", flush=True)
            return Response({
                "detail": "Access restricted: Municipal Field Workers and Staff must sign in via their respective departmental portals."
            }, status=status.HTTP_403_FORBIDDEN)

        if portal == 'officer' and role != 'dept_officer':
            print(f"[AUTH LOGIN RESTRICTED] Account '{mobile}' (Role: {role}) denied access to Department Officer Portal.", flush=True)
            return Response({
                "detail": "Access restricted: Only authorized Municipal Department Officers may sign in here."
            }, status=status.HTTP_403_FORBIDDEN)

        if portal == 'admin' and role != 'admin':
            print(f"[AUTH LOGIN RESTRICTED] Account '{mobile}' (Role: {role}) denied access to Super Admin Portal.", flush=True)
            return Response({
                "detail": "Access restricted: Only authorized Municipal Super Administrators may sign in here."
            }, status=status.HTTP_403_FORBIDDEN)

        # 5. Generate JWT Tokens
        access_token = generate_jwt_token(user.id, role, mobile)
        refresh_token = generate_jwt_token(user.id, role, mobile)

        user_record = {
            "id": str(user.id),
            "name": name,
            "mobile": mobile,
            "email": user.email,
            "ward": ward,
            "role": role
        }
        if dept:
            user_record["department"] = dept
        if role == 'dept_officer':
            user_record["dept_id"] = OFFICER_METADATA.get(mobile, {}).get('dept_id', 1)
        elif role == 'worker':
            w_meta = {**WORKER_METADATA.get(mobile, {}), **custom_workers.get(mobile, {})}
            if w_meta.get('dept_id'):
                user_record["dept_id"] = int(w_meta['dept_id'])
            if w_meta.get('employee_id'):
                user_record["employee_id"] = w_meta['employee_id']
            if w_meta.get('designation'):
                user_record["designation"] = w_meta['designation']
            user_record["is_on_duty"] = bool(w_meta.get('is_on_duty', True))
            user_record["duty_status"] = w_meta.get('duty_status', 'on_duty' if user_record["is_on_duty"] else 'on_leave')

        # Terminal Console Logging
        print("=" * 65, flush=True)
        print("✅ [JANMITRA BACKEND] AUTHENTICATION VERIFIED & GRANTED", flush=True)
        print(f"  👤 Name:       {name}", flush=True)
        print(f"  📱 Mobile:     {mobile}", flush=True)
        print(f"  📧 Email:      {user.email}", flush=True)
        print(f"  🏷️ Role:       {role.upper()}", flush=True)
        if dept:
            print(f"  🏢 Department: {dept}", flush=True)
        print(f"  📍 Ward:       {ward}", flush=True)
        print("=" * 65 + "\n", flush=True)

        return Response({
            "access": access_token,
            "refresh": refresh_token,
            "token": access_token,
            "role": role,
            "user": user_record,
            "message": "Login successful"
        }, status=status.HTTP_200_OK)


class CurrentUserView(APIView):
    """
    GET /api/v1/auth/me/
    Returns current authenticated user from Bearer JWT or Django session.
    Strictly verifies against database; returns 401 if unauthenticated.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        auth_header = request.headers.get('Authorization') or ''
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            try:
                secret = getattr(settings, 'SECRET_KEY', 'janmitra-secret-key-2026')
                payload = jwt.decode(token, secret, algorithms=['HS256'])
                user_id = payload.get('user_id')
                mobile = payload.get('mobile')

                user = None
                if user_id:
                    user = User.objects.filter(id=user_id).first()
                if not user and mobile:
                    user = User.objects.filter(username=mobile).first()

                if user and user.is_active:
                    role = payload.get('role', 'citizen')
                    custom_workers = {}
                    try:
                        import os, json
                        wp_path = os.path.join(settings.BASE_DIR, 'media', 'worker_profiles.json')
                        if os.path.exists(wp_path):
                            with open(wp_path, 'r', encoding='utf-8') as fp:
                                custom_workers = json.load(fp) or {}
                    except Exception:
                        custom_workers = {}

                    worker_meta = {**WORKER_METADATA.get(user.username, {}), **custom_workers.get(user.username, {})} if role == 'worker' else {}
                    officer_meta = OFFICER_METADATA.get(user.username, {}) if role == 'dept_officer' else {}

                    dept = worker_meta.get('department') or officer_meta.get('department') or ''
                    ward_val = worker_meta.get('ward_name') or (f"Ward {worker_meta['ward']}" if worker_meta.get('ward') else None) or user.last_name or "Ward 2 (Dhantoli / Central Nagpur)"
                    name_val = worker_meta.get('name') or officer_meta.get('name') or user.first_name or user.username

                    user_res = {
                        "id": str(user.id),
                        "name": name_val,
                        "mobile": user.username,
                        "email": user.email,
                        "ward": ward_val,
                        "role": role
                    }
                    if dept:
                        user_res["department"] = dept
                        user_res["dept"] = dept
                    if worker_meta.get('dept_id'):
                        user_res["department_id"] = worker_meta.get('dept_id')
                        user_res["dept_id"] = worker_meta.get('dept_id')
                    if officer_meta.get('dept_id'):
                        user_res["department_id"] = officer_meta.get('dept_id')
                        user_res["dept_id"] = officer_meta.get('dept_id')
                    if worker_meta.get('employee_id'):
                        user_res["employee_id"] = worker_meta.get('employee_id')
                    if role == 'worker':
                        user_res["is_on_duty"] = bool(worker_meta.get('is_on_duty', True))
                        user_res["duty_status"] = worker_meta.get('duty_status', 'on_duty' if user_res["is_on_duty"] else 'on_leave')

                    return Response(user_res, status=status.HTTP_200_OK)
            except Exception:
                pass

        if request.user and request.user.is_authenticated and request.user.is_active:
            user = request.user
            role = "admin" if user.is_superuser else ("dept_officer" if user.is_staff else "citizen")
            return Response({
                "id": str(user.id),
                "name": user.first_name or user.username,
                "mobile": user.username,
                "email": user.email,
                "ward": user.last_name or "Ward 2 (Dhantoli / Central Nagpur)",
                "role": role
            }, status=status.HTTP_200_OK)

        return Response(
            {"detail": "Authentication credentials were not provided or invalid."},
            status=status.HTTP_401_UNAUTHORIZED
        )


class TokenRefreshView(APIView):
    """
    POST /api/v1/auth/token/refresh/
    Validates refresh JWT and returns a fresh access token if user remains active.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        token = ''
        if isinstance(request.data, dict):
            token = str(request.data.get('refresh') or request.data.get('token') or '').strip()
        if not token:
            auth_header = request.headers.get('Authorization') or ''
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ', 1)[1].strip()
        if not token:
            return Response({"detail": "Refresh token is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            secret = getattr(settings, 'SECRET_KEY', 'janmitra-secret-key-2026')
            payload = jwt.decode(token, secret, algorithms=['HS256'])
            user_id = payload.get('user_id')
            mobile = payload.get('mobile')
            user = User.objects.filter(id=user_id, is_active=True).first() if user_id else None
            if not user and mobile:
                user = User.objects.filter(username=mobile, is_active=True).first()
            if not user:
                return Response({"detail": "Account not found or disabled."}, status=status.HTTP_401_UNAUTHORIZED)
            role = payload.get('role') or 'citizen'
            new_access = generate_jwt_token(user.id, role, user.username)
            new_refresh = generate_jwt_token(user.id, role, user.username)
            return Response({
                "access": new_access,
                "token": new_access,
                "refresh": new_refresh,
            }, status=status.HTTP_200_OK)
        except Exception:
            return Response({"detail": "Invalid or expired refresh token."}, status=status.HTTP_401_UNAUTHORIZED)
