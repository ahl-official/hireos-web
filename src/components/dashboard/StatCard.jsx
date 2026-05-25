import React from 'react';

const StatCard = ({ icon: Icon, label, value, color }) => {
  // Map traditional solid bg colors to "clean" soft versions
  const cleanColors = {
    'bg-indigo-600': { bg: 'bg-indigo-50', icon: 'text-indigo-600' },
    'bg-emerald-500': { bg: 'bg-emerald-50', icon: 'text-emerald-600' },
    'bg-amber-500': { bg: 'bg-amber-50', icon: 'text-amber-600' },
    'bg-blue-600': { bg: 'bg-blue-50', icon: 'text-blue-600' },
    'bg-blue-500': { bg: 'bg-blue-50', icon: 'text-blue-600' },
  };

  const theme = cleanColors[color] || { bg: 'bg-slate-50', icon: 'text-slate-600' };

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex items-center gap-4 transition-all hover:shadow-md">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${theme.bg}`}>
        <Icon className={`w-6 h-6 ${theme.icon}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.15em] truncate mb-0.5">
          {label}
        </p>
        <p className="text-2xl font-extrabold text-slate-900 truncate leading-none">{value}</p>
      </div>
    </div>
  );
};

export default StatCard;
