"""
PostGIS & Geospatial Duplicate Complaint Detector Module.

Identifies redundant or duplicate civic complaints within a 100-meter radius using:
1. Production: GeoDjango PostGIS ST_DWithin spatial queries.
2. Development: Haversine distance mathematical fallback for SQLite / local testing.

When a duplicate is detected:
- Flags the current complaint as a duplicate linked to the parent complaint.
- Increments the parent complaint's duplicate_count by +1.
- Boosts the parent complaint's priority score by +15 points.
"""

import math
from typing import Dict, Any, Optional

# Attempt to import GeoDjango spatial measurement; fallback to mock for non-GIS environments
try:
    from django.contrib.gis.measure import D
except Exception:
    D = lambda m: m


# Active statuses eligible for duplicate matching
ACTIVE_STATUSES = ['Submitted', 'Pending Validation', 'Validated', 'Routed', 'Assigned', 'In-Progress']


def haversine_distance(coord1, coord2) -> float:
    """
    Calculate the great circle distance in meters between two points on Earth
    using the Haversine formula.

    Supports:
    - GeoDjango GEOSGeometry Point instances (.y for lat, .x for lon)
    - Tuples or lists: (lat, lon) or (x, y)
    """
    def extract_lat_lon(c):
        if hasattr(c, 'y') and hasattr(c, 'x'):
            return float(c.y), float(c.x)
        if hasattr(c, 'coords') and len(c.coords) >= 2:
            return float(c.coords[1]), float(c.coords[0])
        if isinstance(c, (tuple, list)) and len(c) >= 2:
            return float(c[0]), float(c[1])
        return 0.0, 0.0

    lat1, lon1 = extract_lat_lon(coord1)
    lat2, lon2 = extract_lat_lon(coord2)

    R = 6371000.0  # Earth's radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def duplicate_check(complaint) -> Dict[str, Any]:
    """
    Executes a geospatial 100-meter radius search to find existing duplicate complaints.

    Rules:
    - category == complaint.category
    - status in ['Submitted', 'Validated', 'Routed', 'Assigned', 'In-Progress']
    - ST_DWithin(location, complaint.location, D(m=100))
    - id != complaint.id (exclude self)

    If a duplicate match is found:
    - complaint.is_duplicate = True
    - complaint.parent_complaint = existing_complaint
    - existing_complaint.duplicate_count += 1
    - existing_complaint.priority_score += 15 (capped at 100)

    :param complaint: The incoming Complaint model instance.
    :return: Dict containing duplicate status, parent ID, count, and boosted priority.
    """
    result = {
        'is_duplicate': False,
        'parent_id': None,
        'duplicate_count': 0,
        'boosted_priority_score': getattr(complaint, 'priority_score', 0)
    }

    # Resolve QuerySet source (Django ORM or mock testing harness)
    queryset = None
    if hasattr(complaint, '_mock_queryset') and complaint._mock_queryset is not None:
        queryset = complaint._mock_queryset
    else:
        try:
            from django.conf import settings
            if settings.configured:
                from complaints.models import Complaint
                queryset = getattr(Complaint, 'objects', None)
        except Exception:
            queryset = None

    if queryset is None:
        return result

    existing_complaint = None

    # 1. Primary: GeoDjango PostGIS Spatial Query (ST_DWithin)
    try:
        spatial_query = queryset.filter(
            category=complaint.category,
            status__in=ACTIVE_STATUSES,
            location__distance_lte=(complaint.location, D(m=100))
        ).exclude(id=complaint.id)

        # Order by creation date if attribute exists to find the earliest parent
        if hasattr(complaint, 'created_at'):
            spatial_query = spatial_query.order_by('created_at')

        if spatial_query.count() > 0:
            existing_complaint = spatial_query.first()

    except Exception as spatial_err:
        # 2. Secondary Fallback: SQLite Development Mode (Haversine calculation)
        # Triggered when SQLite is used without the SpatiaLite extension
        try:
            comp_cat = getattr(complaint, 'category', None)
            if isinstance(comp_cat, str):
                c_low = comp_cat.strip().lower()
                dept_map = {
                    'pothole': 1, 'potholes': 1, 'road': 1, 'roads': 1, 'pwd': 1, 'roads & infrastructure': 1,
                    'garbage': 2, 'trash': 2, 'waste': 2, 'swm': 2, 'garbage & solid waste': 2,
                    'water leak': 3, 'water': 3, 'waterlogging': 3, 'drainage': 3, 'sewer': 3, 'phe': 3, 'water & drainage': 3,
                    'streetlight': 4, 'broken_streetlight': 4, 'street lighting': 4, 'electrical': 4, 'ele': 4,
                }
                dept_id = dept_map.get(c_low)
                cat_filter = {'category__department_id': dept_id} if dept_id else {'category__name__icontains': comp_cat}
            elif getattr(comp_cat, 'department_id', None) is not None:
                cat_filter = {'category__department_id': comp_cat.department_id}
            else:
                cat_filter = {'category': comp_cat}

            query = queryset.filter(status__in=ACTIVE_STATUSES, **cat_filter)
            if getattr(complaint, 'id', None):
                query = query.exclude(id=complaint.id)
            candidates = query.order_by('created_at') if hasattr(query, 'order_by') else query

            for cand in candidates:
                cand_loc = getattr(cand, 'location', None)
                if cand_loc is None:
                    c_lat = getattr(cand, 'latitude', None)
                    c_lng = getattr(cand, 'longitude', None)
                    if c_lat is not None and c_lng is not None:
                        cand_loc = (c_lat, c_lng)

                comp_loc = getattr(complaint, 'location', None)
                if comp_loc is None:
                    cp_lat = getattr(complaint, 'latitude', None)
                    cp_lng = getattr(complaint, 'longitude', None)
                    if cp_lat is not None and cp_lng is not None:
                        comp_loc = (cp_lat, cp_lng)

                if cand_loc is not None and comp_loc is not None:
                    dist = haversine_distance(comp_loc, cand_loc)
                    if dist <= 100.0:
                        existing_complaint = cand
                        break

        except Exception as sqlite_err:
            print(f"[DuplicateDetector] SQLite fallback query notice: {sqlite_err}")

    # 3. Apply Duplicate Resolution Rules if Match is Found
    if existing_complaint is not None:
        # A. Flag incoming mock/test complaint as a duplicate
        complaint.is_duplicate = True
        complaint.parent_complaint = existing_complaint
        if getattr(complaint, '_mock_queryset', None) is not None and hasattr(complaint, 'save'):
            complaint.save()

        # B. Increment parent complaint's duplicate count by 1
        current_dups = getattr(existing_complaint, 'duplicate_count', 0) or 0
        existing_complaint.duplicate_count = current_dups + 1

        # C. Boost parent complaint priority score by +15 points (capped at 100)
        current_score = getattr(existing_complaint, 'priority_score', 0.0) or 0.0
        boosted_score = min(float(current_score) + 15.0, 100.0)
        existing_complaint.priority_score = int(round(boosted_score)) if isinstance(current_score, int) else round(boosted_score, 2)

        # D. Update priority level tier consistently with AI priority engine
        if hasattr(existing_complaint, 'priority_level'):
            from .priority_engine import get_priority_level_and_sla
            new_level, _ = get_priority_level_and_sla(int(round(boosted_score)))
            existing_complaint.priority_level = new_level

        if hasattr(existing_complaint, 'save'):
            existing_complaint.save()

        result['is_duplicate'] = True
        result['parent_id'] = getattr(existing_complaint, 'id', None)
        result['duplicate_count'] = existing_complaint.duplicate_count
        result['boosted_priority_score'] = existing_complaint.priority_score

    return result


class DuplicateDetector:
    """
    Object-oriented wrapper class providing backward compatibility
    for existing pipeline tasks and test suites.
    """

    def detect(self, complaint) -> Dict[str, Any]:
        """Wrapper method for duplicate_check."""
        return duplicate_check(complaint)

    def duplicate_check(self, complaint) -> Dict[str, Any]:
        """Direct alias for duplicate_check function."""
        return duplicate_check(complaint)
