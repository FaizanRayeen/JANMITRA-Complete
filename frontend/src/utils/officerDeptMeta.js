/**
 * Shared metadata & theme configuration for the 4 Municipal Department Officer Portals.
 * Ensures PWD, SWM, PHE, and Electrical portals display distinct visual identity
 * without duplicating lookup tables across Officer pages.
 */

export const OFFICER_DEPT_META = {
  1: {
    dept_id: 1,
    code: 'PWD',
    shortName: 'PWD (Roads)',
    fullTitle: 'Public Works Department (PWD)',
    categoryLabel: 'Roads & Infrastructure',
    icon: '🛣️',
    headerGradient: 'from-slate-900 via-blue-950 to-slate-900',
    accentBorder: 'border-l-blue-600',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
    pillDark: 'bg-blue-500/20 text-blue-200 border-blue-400/30',
    accentHex: '#1A56DB',
  },
  2: {
    dept_id: 2,
    code: 'SWM',
    shortName: 'SWM (Sanitation)',
    fullTitle: 'Solid Waste Management (SWM)',
    categoryLabel: 'Garbage & Solid Waste',
    icon: '🗑️',
    headerGradient: 'from-slate-900 via-emerald-950 to-slate-900',
    accentBorder: 'border-l-emerald-600',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    pillDark: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30',
    accentHex: '#059669',
  },
  3: {
    dept_id: 3,
    code: 'PHE',
    shortName: 'PHE (Water Works)',
    fullTitle: 'Public Health Engineering (PHE)',
    categoryLabel: 'Water & Drainage',
    icon: '💧',
    headerGradient: 'from-slate-900 via-cyan-950 to-slate-900',
    accentBorder: 'border-l-cyan-600',
    badgeClass: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    pillDark: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/30',
    accentHex: '#0891B2',
  },
  4: {
    dept_id: 4,
    code: 'Electrical',
    shortName: 'Electrical (Lights)',
    fullTitle: 'Electrical & Street Lighting Department',
    categoryLabel: 'Street Lighting & Cables',
    icon: '💡',
    headerGradient: 'from-slate-900 via-amber-950 to-slate-900',
    accentBorder: 'border-l-amber-500',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-200',
    pillDark: 'bg-amber-500/20 text-amber-200 border-amber-400/30',
    accentHex: '#D97706',
  },
};

export const resolveOfficerDept = (user) => {
  if (user?.dept_id && OFFICER_DEPT_META[Number(user.dept_id)]) {
    return OFFICER_DEPT_META[Number(user.dept_id)];
  }
  const mob = String(user?.mobile || user?.username || '').trim();
  if (mob === '9900000001') return OFFICER_DEPT_META[1];
  if (mob === '9900000002') return OFFICER_DEPT_META[2];
  if (mob === '9900000003') return OFFICER_DEPT_META[3];
  if (mob === '9900000004') return OFFICER_DEPT_META[4];

  const dStr = String(user?.department || user?.dept || '').toLowerCase();
  if (dStr.includes('waste') || dStr.includes('swm') || dStr.includes('sanitation')) return OFFICER_DEPT_META[2];
  if (dStr.includes('water') || dStr.includes('phe') || dStr.includes('public health')) return OFFICER_DEPT_META[3];
  if (dStr.includes('electr') || dStr.includes('light')) return OFFICER_DEPT_META[4];
  return OFFICER_DEPT_META[1];
};

