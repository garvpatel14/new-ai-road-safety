import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { StatCard, Card } from '../components/common/Card';
import { StatusBadge } from '../components/common/StatusBadge';
import { MonthlyTrendChart, DamageDistributionChart } from '../components/charts/DashboardCharts';
import { DASHBOARD_STATS, INITIAL_REPORTS, ANALYTICS_DATA } from '../utils/mockData';
import { RoadHazardDetailsModal } from '../components/common/RoadHazardDetailsModal';
import {
  AlertTriangle,
  CheckCircle,
  AlertOctagon,
  Users,
  Calendar,
  PlusCircle,
  MapPin,
  Navigation,
  ExternalLink,
  Eye,
  Camera,
  Radio,
  Sparkles,
  FileText,
  Activity
} from 'lucide-react';

export const DashboardPage = () => {
  const [reports] = useState(INITIAL_REPORTS);
  const [selectedReport, setSelectedReport] = useState(null);

  const quickTools = [
    { name: 'Live Road Scan', path: '/live-scan', icon: Camera, color: 'text-safety-500 bg-safety-500/10', desc: 'Real-time camera scanner HUD' },
    { name: 'Safe Route Planner', path: '/safe-route', icon: Navigation, color: 'text-amber-500 bg-amber-500/10', desc: 'Zero-hazard AI route planner' },
    { name: 'Report Damage', path: '/report-damage', icon: PlusCircle, color: 'text-red-500 bg-red-500/10', desc: 'Submit manual hazard report' },
  ];

  return (
    <div className="space-y-8 pb-12">
      
      {/* Top Header & Quick Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            User Operations & Safety Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Real-time geospatial hazard metrics, live vision scanner, and AI route planner.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/live-scan"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-safety-600 to-brand-600 text-white font-extrabold text-xs shadow-md hover:opacity-95 transition"
          >
            <Camera className="w-4 h-4" /> Start Live Scan
          </Link>
        </div>
      </div>

      {/* QUICK LAUNCHER CARDS FOR USER MODULES */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {quickTools.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.path}
              to={t.path}
              className="p-3.5 rounded-2xl glass-panel border border-slate-200/60 dark:border-slate-800/80 hover:scale-105 hover:border-brand-500/50 transition duration-200 flex flex-col justify-between space-y-2 group shadow-sm"
            >
              <div className={`p-2.5 rounded-xl w-max ${t.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-extrabold text-xs text-slate-900 dark:text-white group-hover:text-brand-600 transition">{t.name}</p>
                <p className="text-[10px] text-slate-400 font-medium line-clamp-1">{t.desc}</p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* 5 DISPLAY STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Road Damage"
          value={DASHBOARD_STATS.totalRoadDamage}
          icon={AlertTriangle}
          color="safety"
          trend="+12%"
          trendLabel="mo"
        />

        <StatCard
          title="Roads Repaired"
          value={DASHBOARD_STATS.roadsRepaired}
          icon={CheckCircle}
          color="emerald"
          trend="+28%"
          trendLabel="mo"
        />
        <StatCard
          title="Dangerous Corridors"
          value={DASHBOARD_STATS.dangerousRoads}
          icon={AlertOctagon}
          color="red"
          trend="+3"
          trendLabel="new"
        />
        <StatCard
          title="Active Users"
          value={DASHBOARD_STATS.activeUsers}
          icon={Users}
          color="brand"
          trend="+1.2k"
          trendLabel="wk"
        />
        <StatCard
          title="Today's Reports"
          value={DASHBOARD_STATS.todaysReports}
          icon={Calendar}
          color="purple"
          trend="+8"
          trendLabel="today"
        />
      </div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base">Monthly Incident & Damage Trend</h3>
              <p className="text-xs text-slate-500">Compare road damage reports vs accident frequency.</p>
            </div>
            <Link to="/analytics" className="text-xs text-brand-600 dark:text-brand-400 font-semibold hover:underline flex items-center gap-1">
              Full Analytics <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
          <MonthlyTrendChart data={ANALYTICS_DATA.monthlyReports} />
        </Card>

        <Card className="space-y-4">
          <div>
            <h3 className="font-extrabold text-slate-900 dark:text-white text-base">Damage Type Breakdown</h3>
            <p className="text-xs text-slate-500">Distribution of reported road defects.</p>
          </div>
          <DamageDistributionChart data={ANALYTICS_DATA.damageTypeDistribution} />
        </Card>
      </div>

      {/* RECENT REPORTS TABLE */}
      <Card className="space-y-4 overflow-hidden">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-slate-900 dark:text-white text-base">Recent Incident & Damage Feeds</h3>
            <p className="text-xs text-slate-500">Live community submissions and AI verified reports.</p>
          </div>
          <Link to="/my-reports" className="text-xs text-brand-600 dark:text-brand-400 font-semibold hover:underline">
            View All Reports
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/60 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3">Issue ID</th>
                <th className="p-3">Type</th>
                <th className="p-3">Location</th>
                <th className="p-3">Severity</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Inspect Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {reports.slice(0, 5).map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                  <td className="p-3 font-bold text-slate-900 dark:text-white">{r.id}</td>
                  <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">{r.type}</td>
                  <td className="p-3 text-slate-600 dark:text-slate-400 max-w-xs truncate">{r.locationName}</td>
                  <td className="p-3"><StatusBadge status={r.severity} /></td>
                  <td className="p-3"><StatusBadge status={r.status} /></td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => setSelectedReport(r)}
                      className="p-1.5 rounded-lg text-brand-600 dark:text-brand-400 hover:bg-brand-500/10 transition"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Hazard Detail Modal */}
      <RoadHazardDetailsModal
        isOpen={Boolean(selectedReport)}
        onClose={() => setSelectedReport(null)}
        hazard={selectedReport}
      />

    </div>
  );
};
