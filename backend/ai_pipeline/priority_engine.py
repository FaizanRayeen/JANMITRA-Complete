"""
AI Priority Scoring Engine Module for JANMITRA.

Calculates an actionable priority score (0-100) and urgency SLA for municipal complaints
using Team ResolveIT's weighted 5-factor formula:
1. Formula:
   Score = (severity * 0.30) + (public_safety * 0.25) + (traffic_impact * 0.20) +
           (duplicate_factor * 0.15) + (sla_urgency * 0.10)

2. 4 Priority Tiers & Target SLAs:
   - Score >= 80 -> 'Severe' (Target SLA: 24h)
   - Score 60-79 -> 'High'   (Target SLA: 48h)
   - Score 40-59 -> 'Medium' (Target SLA: 72h)
   - Score < 40  -> 'Low'    (Target SLA: 7 days)
"""

import math
import unittest
from typing import Dict, Any, Union

# Safety baseline scores per department category (0-100)
SAFETY_MAPPING = {
    # Electrical (Live wires, broken streetlights) -> Dept 4
    'electrical': 90,
    'broken_streetlight': 90,
    'streetlight': 90,
    'street_light': 90,
    'street lighting': 90,
    'flickering light': 90,
    'high mast': 90,
    'cable fault': 90,
    'ele': 90,

    # Roads (Potholes, broken roads, pavement collapses) -> Dept 1
    'roads': 80,
    'pothole': 80,
    'potholes': 80,
    'pothole repair': 80,
    'roads & infrastructure': 80,
    'footpath': 70,
    'pwd': 80,

    # Water (Flooding, open drains, waterlogging, contamination) -> Dept 3
    'water': 70,
    'water leak': 70,
    'water pipeline leakage': 70,
    'waterlogging': 70,
    'flooding': 70,
    'drainage': 75,
    'sewer': 75,
    'contaminated water supply': 85,
    'phe': 70,

    # Sanitation (Garbage dumps, overflowing bins, debris) -> Dept 2
    'garbage': 40,
    'garbage & solid waste': 40,
    'overflowing dustbin': 45,
    'construction debris': 45,
    'trash': 40,
    'waste': 40,
    'swm': 40,
}

# NLP keyword lists for severity calculation
HIGH_SEVERITY_KEYWORDS = [
    'severe', 'critical', 'dangerous', 'hazard', 'injury', 'accident', 'fatal',
    'blocked completely', 'flooding', 'sparking', 'live wire', 'electrocution',
    'emergency', 'collapsed', 'cave-in', 'cave in', 'crater', 'gaping',
    'burst', 'gushing', 'contaminated', 'open manhole'
]
MED_SEVERITY_KEYWORDS = [
    'pothole', 'broken', 'not working', 'waterlogging', 'overflowing',
    'dark', 'no light', 'flickering', 'leaking', 'smelly', 'stagnant',
    'choke', 'damaged', 'deep', 'major'
]
LOW_SEVERITY_KEYWORDS = ['minor', 'small', 'cosmetic', 'faint', 'slight']

TRAFFIC_HOTSPOT_KEYWORDS = [
    'traffic', 'jam', 'blocked completely', 'main road', 'highway',
    'college', 'school', 'hospital', 'market', 'junction', 'crossing', 'heavy'
]


def _resolve_safety_score(category_str: str, dept_id: int = None) -> float:
    """Resolve 0-100 public safety risk score from exact, substring, or department ID match."""
    cat = (category_str or '').strip().lower()
    if cat in SAFETY_MAPPING:
        return float(SAFETY_MAPPING[cat])
    for key, val in SAFETY_MAPPING.items():
        if key in cat:
            return float(val)
    dept_defaults = {1: 80.0, 2: 40.0, 3: 70.0, 4: 90.0}
    return dept_defaults.get(dept_id, 50.0)


def _compute_text_severity(text: str, category_str: str = '') -> float:
    """Compute severity (0-100) from defect text keywords and category."""
    combined = f"{category_str} {text}".lower()
    high_hits = sum(1 for kw in HIGH_SEVERITY_KEYWORDS if kw in combined)
    med_hits = sum(1 for kw in MED_SEVERITY_KEYWORDS if kw in combined)
    low_hits = sum(1 for kw in LOW_SEVERITY_KEYWORDS if kw in combined)

    severity = 50.0
    if high_hits >= 2:
        severity += 40.0
    elif high_hits == 1:
        severity += 30.0
    elif med_hits > 0:
        severity += 15.0

    if low_hits > 0 and high_hits == 0:
        severity -= 20.0

    return min(max(severity, 0.0), 100.0)


def _compute_traffic_impact(text: str, category_str: str = '', dept_id: int = None) -> float:
    """Compute 0-100 traffic / public impact factor."""
    combined = f"{category_str} {text}".lower()
    if any(kw in combined for kw in TRAFFIC_HOTSPOT_KEYWORDS):
        return 90.0
    if dept_id == 1 or any(k in combined for k in ['road', 'pothole', 'footpath', 'street']):
        return 60.0
    return 40.0


def _load_admin_sla_hours() -> Dict[str, int]:
    """Read configured Admin SLA hours if persisted; fall back to defaults cleanly."""
    defaults = {'critical_sla_hours': 24, 'high_sla_hours': 48, 'medium_sla_hours': 72}
    try:
        import os, json
        from django.conf import settings
        if settings.configured:
            p = os.path.join(settings.BASE_DIR, 'media', 'admin_system_settings.json')
            if os.path.exists(p):
                with open(p, 'r', encoding='utf-8') as fp:
                    loaded = json.load(fp)
                    if isinstance(loaded, dict):
                        for k in defaults:
                            if loaded.get(k):
                                defaults[k] = max(1, int(loaded[k]))
    except Exception:
        pass
    return defaults


def get_priority_level_and_sla(score: int) -> tuple[str, str]:
    """Maps numerical score (0-100) to the 4 official priority tiers and SLA target."""
    sla_cfg = _load_admin_sla_hours()
    if score >= 80:
        return 'Severe', f"{sla_cfg['critical_sla_hours']}h"
    elif score >= 60:
        return 'High', f"{sla_cfg['high_sla_hours']}h"
    elif score >= 40:
        return 'Medium', f"{sla_cfg['medium_sla_hours']}h"
    else:
        return 'Low', '7 days'


def calculate_priority(complaint_data: Union[Dict[str, Any], Any], persist: bool = False) -> Dict[str, Any]:
    """
    Priority calculation function using the weighted 5-factor AI formula:
    Score = (severity * 0.30) + (public_safety * 0.25) + (traffic_impact * 0.20) +
            (duplicate_factor * 0.15) + (sla_urgency * 0.10)

    :param complaint_data: Either a dictionary of parameters or a Django Complaint instance.
    :param persist: Whether to save computed priority fields back onto Complaint model instance.
    :return: Dict containing integer score, level ('Severe'|'High'|'Medium'|'Low'), target_sla, and breakdown.
    """
    # 1. Parameter Extraction: handle both dictionary and model object
    if isinstance(complaint_data, dict):
        has_direct_scores = all(
            k in complaint_data for k in ['severity', 'public_safety', 'traffic_impact', 'duplicate_factor', 'sla_urgency']
        )
        if has_direct_scores:
            severity = float(complaint_data['severity'])
            public_safety = float(complaint_data['public_safety'])
            traffic_impact = float(complaint_data['traffic_impact'])
            duplicate_factor = float(complaint_data['duplicate_factor'])
            sla_urgency = float(complaint_data['sla_urgency'])
        else:
            title = str(complaint_data.get('title', '') or '')
            description = str(complaint_data.get('description', '') or '')
            text = f"{title} {description}".strip()
            category = str(complaint_data.get('category', '') or '')
            dept_id = complaint_data.get('department_id')
            dup_count = int(complaint_data.get('duplicate_count', 0) or 0)

            severity = _compute_text_severity(text, category)
            public_safety = float(complaint_data.get('public_safety', _resolve_safety_score(category, dept_id)))
            traffic_impact = float(complaint_data['traffic_impact']) if 'traffic_impact' in complaint_data else _compute_traffic_impact(text, category, dept_id)
            duplicate_factor = min(dup_count * 20.0, 100.0)
            sla_urgency = float(complaint_data.get('sla_urgency', 50.0))

        complaint_obj = None

    else:
        complaint_obj = complaint_data
        title = str(getattr(complaint_obj, 'title', '') or '')
        description = str(getattr(complaint_obj, 'description', '') or '')
        text = f"{title} {description}".strip()
        cat_obj = getattr(complaint_obj, 'category', None)
        category = getattr(cat_obj, 'name', None) or str(cat_obj or '')
        dept_id = getattr(cat_obj, 'department_id', None)
        dup_count = int(getattr(complaint_obj, 'duplicate_count', 0) or 0)

        # 1. Severity (0-100)
        severity = _compute_text_severity(text, category)

        # 2. Public Safety (0-100)
        public_safety = _resolve_safety_score(category, dept_id)

        # 3. Traffic / Public Impact (0-100)
        traffic_impact = _compute_traffic_impact(text, category, dept_id)

        # 4. Duplicate Factor (0-100)
        duplicate_factor = min(dup_count * 20.0, 100.0)

        # 5. SLA Urgency (0-100): combines open department workload & elapsed ticket age
        sla_urgency = 50.0
        try:
            from django.utils import timezone
            created_at = getattr(complaint_obj, 'created_at', None)
            target_hrs = getattr(cat_obj, 'sla_hours', 48) or 48
            if created_at:
                elapsed_hrs = max((timezone.now() - created_at).total_seconds() / 3600.0, 0.0)
                age_ratio = min((elapsed_hrs / float(target_hrs)) * 100.0, 100.0)
                sla_urgency = max(50.0, round(age_ratio, 1))
        except Exception:
            dept = getattr(complaint_obj, 'department', None)
            active_complaints = getattr(dept, 'active_complaints', 50) if dept else 50
            total_capacity = getattr(dept, 'total_capacity', 100) if dept else 100
            if total_capacity > 0:
                sla_urgency = min(max((active_complaints / total_capacity) * 100.0, 0.0), 100.0)

    # 2. Mathematical Weighted Formula
    raw_score = (
        (severity * 0.30) +
        (public_safety * 0.25) +
        (traffic_impact * 0.20) +
        (duplicate_factor * 0.15) +
        (sla_urgency * 0.10)
    )

    # Clamp bounds and round half-up to integer
    clamped_score = min(max(raw_score, 0.0), 100.0)
    final_score = int(math.floor(clamped_score + 0.5))

    # 3. Priority Level & Target SLA Mapping
    level, target_sla = get_priority_level_and_sla(final_score)

    # 4. Optionally persist computed values on Complaint model instance
    if complaint_obj is not None:
        complaint_obj.priority_score = final_score
        complaint_obj.priority_level = level
        complaint_obj.target_sla = target_sla
        if persist and hasattr(complaint_obj, 'save'):
            complaint_obj.save(update_fields=['priority_score', 'priority_level'])

    return {
        'score': final_score,
        'level': level,
        'target_sla': target_sla,
        'breakdown': {
            'severity': round(severity, 1),
            'public_safety': round(public_safety, 1),
            'traffic_impact': round(traffic_impact, 1),
            'duplicate_factor': round(duplicate_factor, 1),
            'sla_urgency': round(sla_urgency, 1)
        }
    }


class PriorityEngine:
    """
    Object-oriented wrapper class providing backward compatibility
    for existing pipeline tasks and test suites.
    """

    def calculate(self, complaint) -> Dict[str, Any]:
        """Wrapper method for calculate_priority."""
        return calculate_priority(complaint)

    def calculate_priority(self, complaint_data) -> Dict[str, Any]:
        """Direct alias for calculate_priority function."""
        return calculate_priority(complaint_data)


# =====================================================================
# Unit Test Cases
# =====================================================================

class TestPriorityEngine(unittest.TestCase):
    """Unit test suite verifying formulas, thresholds, and SLAs."""

    def test_severe_priority(self):
        # Severe scenario: High values across all factors -> Score >= 80 (SLA: 24h)
        # (90*0.30) + (90*0.25) + (85*0.20) + (80*0.15) + (70*0.10)
        # = 27.0 + 22.5 + 17.0 + 12.0 + 7.0 = 85.5 -> 86 (Severe)
        data = {
            'severity': 90,
            'public_safety': 90,
            'traffic_impact': 85,
            'duplicate_factor': 80,
            'sla_urgency': 70
        }
        res = calculate_priority(data)
        self.assertGreaterEqual(res['score'], 80)
        self.assertEqual(res['level'], 'Severe')
        self.assertEqual(res['target_sla'], '24h')
        self.assertEqual(res['score'], 86)

    def test_high_priority(self):
        # High scenario: Score between 60 and 79 (SLA: 48h)
        # (70*0.30) + (80*0.25) + (60*0.20) + (50*0.15) + (60*0.10)
        # = 21.0 + 20.0 + 12.0 + 7.5 + 6.0 = 66.5 -> 67 (High)
        data = {
            'severity': 70,
            'public_safety': 80,
            'traffic_impact': 60,
            'duplicate_factor': 50,
            'sla_urgency': 60
        }
        res = calculate_priority(data)
        self.assertTrue(60 <= res['score'] <= 79)
        self.assertEqual(res['level'], 'High')
        self.assertEqual(res['target_sla'], '48h')
        self.assertEqual(res['score'], 67)

    def test_medium_priority(self):
        # Medium scenario: Score between 40 and 59 (SLA: 72h)
        # (50*0.30) + (50*0.25) + (50*0.20) + (40*0.15) + (50*0.10)
        # = 15.0 + 12.5 + 10.0 + 6.0 + 5.0 = 48.5 -> 49 (Medium)
        data = {
            'severity': 50,
            'public_safety': 50,
            'traffic_impact': 50,
            'duplicate_factor': 40,
            'sla_urgency': 50
        }
        res = calculate_priority(data)
        self.assertTrue(40 <= res['score'] <= 59)
        self.assertEqual(res['level'], 'Medium')
        self.assertEqual(res['target_sla'], '72h')
        self.assertEqual(res['score'], 49)

    def test_low_priority(self):
        # Low scenario: Score < 40 (SLA: 7 days)
        # (30*0.30) + (40*0.25) + (20*0.20) + (10*0.15) + (30*0.10)
        # = 9.0 + 10.0 + 4.0 + 1.5 + 3.0 = 27.5 -> 28 (Low)
        data = {
            'severity': 30,
            'public_safety': 40,
            'traffic_impact': 20,
            'duplicate_factor': 10,
            'sla_urgency': 30
        }
        res = calculate_priority(data)
        self.assertLess(res['score'], 40)
        self.assertEqual(res['level'], 'Low')
        self.assertEqual(res['target_sla'], '7 days')
        self.assertEqual(res['score'], 28)

    def test_exact_boundary_thresholds(self):
        # Exactly 80 -> Severe
        res_80 = calculate_priority({'severity': 80, 'public_safety': 80, 'traffic_impact': 80, 'duplicate_factor': 80, 'sla_urgency': 80})
        self.assertEqual(res_80['score'], 80)
        self.assertEqual(res_80['level'], 'Severe')

        # Exactly 60 -> High
        res_60 = calculate_priority({'severity': 60, 'public_safety': 60, 'traffic_impact': 60, 'duplicate_factor': 60, 'sla_urgency': 60})
        self.assertEqual(res_60['score'], 60)
        self.assertEqual(res_60['level'], 'High')

        # Exactly 40 -> Medium
        res_40 = calculate_priority({'severity': 40, 'public_safety': 40, 'traffic_impact': 40, 'duplicate_factor': 40, 'sla_urgency': 40})
        self.assertEqual(res_40['score'], 40)
        self.assertEqual(res_40['level'], 'Medium')

        # Exactly 39 -> Low
        res_39 = calculate_priority({'severity': 39, 'public_safety': 39, 'traffic_impact': 39, 'duplicate_factor': 39, 'sla_urgency': 39})
        self.assertEqual(res_39['score'], 39)
        self.assertEqual(res_39['level'], 'Low')


if __name__ == '__main__':
    unittest.main()
