import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  AlertTriangle,
  MapPin,
  Navigation,
  BarChart3,
  FileText,
  Bell,
  User,
  ShieldCheck,
  PlusCircle,
  Sparkles,
  Camera,
  Radio,
  Flame,
  Wrench,
  UserCheck,
  Activity
} from 'lucide-react';

export const Sidebar = ({ isOpen, onClose }) => {
  const { user } = useAuth();

  const userNavItems = [
    { name: 'Live Road Scan', path: '/live-scan', icon: Camera, badge: 'HUD' },
    { name: 'Safe Route Planner', path: '/safe-route', icon: Navigation, badge: 'AI' },
    { name: 'Report Damage', path: '/report-damage', icon: AlertTriangle },
    { name: 'Analytics', path: '/analytics', icon: BarChart3 },
    { name: 'My Reports', path: '/my-reports', icon: FileText },
    { name: 'Notifications', path: '/notifications', icon: Bell },
    { name: 'Profile', path: '/profile', icon: User },
  ];

  const adminNavItems = [
    { name: 'Admin Dashboard', path: '/admin', icon: ShieldCheck, badge: 'Admin' },
    { name: 'Road Surface Heatmap', path: '/admin/heatmap', icon: Flame, badge: 'Heat' },
    { name: 'Pothole Management', path: '/admin/potholes', icon: FileText, badge: 'Queue' },
    { name: 'Road Verification Desk', path: '/admin/verification', icon: UserCheck, badge: 'Audit' },
    { name: 'Interactive Map', path: '/map', icon: MapPin },
    { name: 'City Analytics', path: '/analytics', icon: BarChart3 },
    { name: 'All Damage Reports', path: '/my-reports', icon: FileText },
    { name: 'Admin Profile', path: '/profile', icon: User },
  ];

  const isAdmin = user?.role === 'admin';
  const mainNavItems = isAdmin ? adminNavItems : userNavItems;

  return (
    <>
      {/* Backdrop for Mobile */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      <aside
        className={`fixed top-16 bottom-0 left-0 z-30 w-64 glass-panel border-r border-slate-200/60 dark:border-slate-800/80 p-4 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } overflow-y-auto flex flex-col justify-between`}
      >
        <div className="space-y-5">
          
          {/* Quick Action Button */}
          <div className="pt-1">
            {isAdmin ? (
              <NavLink
                to="/admin"
                onClick={onClose}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-brand-600 hover:from-amber-500 hover:to-brand-500 text-white font-extrabold text-xs shadow-md shadow-amber-500/20 hover:shadow-lg transition group"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Admin Command Center</span>
              </NavLink>
            ) : (
              <NavLink
                to="/live-scan"
                onClick={onClose}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-safety-600 to-brand-600 hover:from-safety-500 hover:to-brand-500 text-white font-extrabold text-xs shadow-md shadow-safety-500/20 hover:shadow-lg transition group"
              >
                <Camera className="w-4 h-4 group-hover:scale-110 transition transform duration-300" />
                <span>Start Live Scanner HUD</span>
              </NavLink>
            )}
          </div>

          {/* Navigation Links */}
          <div className="space-y-1">
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
              {isAdmin ? 'Municipality Management' : 'Citizen Platform'}
            </p>
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition duration-150 ${
                      isActive
                        ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30 font-bold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`
                  }
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        item.badge === 'Admin' || item.badge === 'Dispatch' || item.badge === 'Audit'
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                          : 'bg-safety-500/20 text-safety-600 dark:text-safety-400'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        </div>

        {/* Bottom AI Status Box */}
        <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800">
          <div className="p-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
              <Sparkles className="w-3.5 h-3.5 animate-spin-slow" />
            </div>
            <div>
              <p className="text-[11px] font-extrabold text-slate-800 dark:text-slate-200">AI Vision Engine</p>
              <p className="text-[9px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Active v4.2 (17 Modules)
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
