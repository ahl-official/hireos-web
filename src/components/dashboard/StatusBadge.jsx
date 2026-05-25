import React from 'react';

const StatusBadge = ({ status }) => {
  let styles = 'bg-slate-50 text-slate-500 border-slate-200'; // Default

  const normalizedStatus = (status || 'Pending').toLowerCase();

  if (normalizedStatus === 'completed' || normalizedStatus === 'success') {
    styles = 'bg-emerald-50 text-emerald-600 border-emerald-200';
  } else if (
    normalizedStatus === 'pending' ||
    normalizedStatus === 'processing' ||
    normalizedStatus === 'uploading'
  ) {
    styles = 'bg-amber-50 text-amber-600 border-amber-200';
  } else if (normalizedStatus === 'error' || normalizedStatus === 'failed') {
    styles = 'bg-red-50 text-red-600 border-red-200';
  }

  return (
    <span
      className={`inline-flex items-center px-3 py-1 text-[11px] font-bold rounded-full border ${styles} uppercase tracking-wider`}
    >
      {status || 'Pending'}
    </span>
  );
};

export default StatusBadge;
