import React from 'react';

/**
 * WardBadge:
 * Shows 'Ward 1', 'Ward 2', 'Ward 3', 'Ward 4'
 * Small pill with dark blue background.
 * Props: ward (number or string)
 */
const WardBadge = ({ ward = '' }) => {
  const cleanWard = String(ward || '').includes('(') ? String(ward).split('(')[0].trim() : String(ward || '');
  const formattedWard = cleanWard.toLowerCase().startsWith('ward')
    ? cleanWard
    : `Ward ${cleanWard}`;

  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-900 text-white shadow-sm">
      {formattedWard}
    </span>
  );
};

export default WardBadge;
