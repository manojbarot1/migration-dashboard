import React from 'react';
import {
  LayoutDashboard,
  Server,
  Cloud,
  Layers,
  Network,
  ClipboardList,
  ArrowRightCircle,
  History,
  ShieldCheck,
  Cpu
} from 'lucide-react';

interface Props {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<Props> = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard },
    { id: 'source', label: 'Source Infrastructure', icon: Server },
    { id: 'target', label: 'Target Infrastructure', icon: Cloud },
    { id: 'inventory', label: 'VM Inventory', icon: Layers },
    { id: 'discovery', label: 'Application Discovery', icon: Network },
    { id: 'plan', label: 'Migration Plan & Architecture', icon: ClipboardList },
    { id: 'wizard', label: 'Migration Execution', icon: ArrowRightCircle },
    { id: 'history', label: 'Migration History', icon: History },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-indigo-500 to-sky-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
          <Cpu className="w-5 h-5" />
        </div>
        <div>
          <span className="font-bold text-slate-100 tracking-tight text-sm block">VM Migrate</span>
          <span className="text-[10px] uppercase font-semibold text-indigo-400 tracking-wider">KVM to AWS</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-1.5 flex-1">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
          Management
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Lab Environment Status footer */}
      <div className="p-4 m-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
        <div className="flex items-center gap-2 text-slate-300 font-semibold mb-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Home Lab Mode</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Libvirt QEMU/KVM source paired with Amazon AWS EC2 target.
        </p>
      </div>
    </aside>
  );
};
