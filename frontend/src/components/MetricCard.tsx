import React from 'react';

interface Props {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  onClick?: () => void;
}

export const MetricCard: React.FC<Props> = ({
  title,
  value,
  subtitle,
  icon,
  variant = 'default',
  onClick
}) => {
  const borderColors = {
    default: 'border-slate-800 hover:border-slate-700',
    success: 'border-emerald-500/20 hover:border-emerald-500/40',
    warning: 'border-amber-500/20 hover:border-amber-500/40',
    danger: 'border-rose-500/20 hover:border-rose-500/40',
    info: 'border-blue-500/20 hover:border-blue-500/40',
  };

  const iconBg = {
    default: 'bg-slate-800/80 text-slate-300',
    success: 'bg-emerald-500/10 text-emerald-400',
    warning: 'bg-amber-500/10 text-amber-400',
    danger: 'bg-rose-500/10 text-rose-400',
    info: 'bg-blue-500/10 text-blue-400',
  };

  return (
    <div
      onClick={onClick}
      className={`bg-slate-900/60 backdrop-blur border ${borderColors[variant]} rounded-xl p-5 transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:translate-y-[-2px]' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</span>
        <div className={`p-2 rounded-lg ${iconBg[variant]}`}>{icon}</div>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-bold tracking-tight text-slate-100">{value}</span>
        {subtitle && <span className="text-xs text-slate-400">{subtitle}</span>}
      </div>
    </div>
  );
};
