import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { StatCard, Card } from '../components/common/Card';
import { StatusBadge } from '../components/common/StatusBadge';
import { INITIAL_REPORTS, MOCK_USERS, DASHBOARD_STATS } from '../utils/mockData';
import { useNotifications } from '../context/NotificationContext';
import { RoadHazardDetailsModal } from '../components/common/RoadHazardDetailsModal';
import api from '../services/api';
import {
  ShieldCheck,
  Users,
  FileText,
  Wrench,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  Search,
  Download,
  Flame,
  BarChart3,
  Building,
  Loader2,
  MapPin,
  Eye
} from 'lucide-react';

export const AdminDashboardPage = () => {
  const { addToast } = useNotifications();

  const [activeTab, setActiveTab] = useState('overview');
  const [reports, setReports] = useState(INITIAL_REPORTS);
  const [users, setUsers] = useState(MOCK_USERS);
  const [selectedReport, setSelectedReport] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [reportsRes, usersRes] = await Promise.allSettled([
        api.get('/reports'),
        api.get('/admin/users'),
      ]);
      if (reportsRes.status === 'fulfilled' && reportsRes.value.data?.reports) {
        setReports(reportsRes.value.data.reports);
      }
      if (usersRes.status === 'fulfilled' && usersRes.value.data?.users) {
        setUsers(usersRes.value.data.users);
      }
    } catch (err) {
      console.warn('Fallback admin data:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const municipalModules = [
    { name: 'Road Heatmap', path: '/admin/heatmap', icon: Flame, color: 'text-red-500 bg-red-500/10', desc: 'Defect density & corridor risk' },
    { name: 'Pothole Management', path: '/admin/potholes', icon: FileText, color: 'text-brand-500 bg-brand-500/10', desc: 'Triage & priority matrix sorting' },
    { name: 'Interactive Map', path: '/map', icon: MapPin, color: 'text-emerald-500 bg-emerald-500/10', desc: 'RQI road quality & geospatial map' },
    { name: 'City Analytics', path: '/analytics', icon: BarChart3, color: 'text-purple-500 bg-purple-500/10', desc: 'SLA response times & metrics' },
  ];

  // Handle Approve Report
  const handleApproveReport = async (id) => {
    setReports(prev =>
      prev.map(r => (r.id === id ? { ...r, status: 'Scheduled' } : r))
    );
    try {
      await api.put(`/reports/${id}/status`, { status: 'Scheduled' });
    } catch (e) {}
    addToast(`Report ${id} approved successfully!`, 'success');
  };

  // Handle Reject Report
  const handleRejectReport = async (id) => {
    setReports(prev =>
      prev.map(r => (r.id === id ? { ...r, status: 'Rejected' } : r))
    );
    try {
      await api.put(`/reports/${id}/status`, { status: 'Rejected' });
    } catch (e) {}
    addToast(`Report ${id} rejected.`, 'warning');
  };

  // Handle Repair Status Update
  const handleUpdateStatus = async (id, newStatus) => {
    setReports(prev =>
      prev.map(r => (r.id === id ? { ...r, status: newStatus } : r))
    );
    try {
      await api.put(`/reports/${id}/status`, { status: newStatus });
    } catch (e) {}
    addToast(`Report ${id} status updated to ${newStatus}`, 'info');
  };

  // Handle Export CSV
  const handleExportCSV = () => {
    const headers = ['ID', 'Type', 'Severity', 'Status', 'Location', 'Date', 'ReportedBy', 'PriorityScore'];
    const rows = reports.map(r => [
      r.id,
      r.type,
      r.severity,
      r.status,
      `"${r.locationName?.replace(/"/g, '""') || ''}"`,
      r.date,
      `"${r.reportedBy || ''}"`,
      r.priorityScore || 50
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `saferoad_reports_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    addToast('Report CSV exported successfully!', 'success');
  };

  // Handle User Role Toggle
  const handleToggleUserRole = async (userId) => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;
    const currentRole = (targetUser.role || '').toLowerCase();
    const newRole = currentRole === 'admin' ? 'user' : 'admin';

    setUsers(prev =>
      prev.map(u => (u.id === userId ? { ...u, role: newRole } : u))
    );
    try {
      await api.put(`/admin/users/${userId}/role`, { role: newRole });
      addToast(`User role updated to ${newRole === 'admin' ? 'Admin' : 'User'}.`, 'success');
    } catch (e) {
      addToast('Failed to update user role on server.', 'error');
    }
  };

  return (
    <div className="space-y-8 pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold border border-amber-500/20 mb-1">
            <ShieldCheck className="w-4 h-4" /> Municipality Command Center
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Admin Operations & Control</h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Moderate community submissions, audit AI detections, and prioritize road hazard actions.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 rounded-xl glass-panel text-xs font-bold text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <Download className="w-4 h-4" /> Export Report CSV
        </button>
      </div>

      {/* QUICK LAUNCHER CARDS FOR MUNICIPALITY MODULES */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {municipalModules.map((m) => {
          const Icon = m.icon;
          return (
            <Link
              key={m.path}
              to={m.path}
              className="p-3.5 rounded-2xl glass-panel border border-slate-200/60 dark:border-slate-800/80 hover:scale-105 hover:border-amber-500/50 transition duration-200 flex flex-col justify-between space-y-2 group shadow-sm"
            >
              <div className={`p-2.5 rounded-xl w-max ${m.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-extrabold text-xs text-slate-900 dark:text-white group-hover:text-amber-600 transition">{m.name}</p>
                <p className="text-[10px] text-slate-400 font-medium line-clamp-1">{m.desc}</p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* 4 ADMIN STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Registered Platform Users"
          value={users.length}
          icon={Users}
          color="brand"
        />
        <StatCard
          title="Total Hazard Reports"
          value={reports.length}
          icon={FileText}
          color="safety"
        />
        <StatCard
          title="Pending Action Queue"
          value={reports.filter(r => r.status === 'Pending' || r.status === 'In Progress').length}
          icon={Clock}
          color="purple"
        />
        <StatCard
          title="Dangerous Corridors"
          value={47}
          icon={AlertTriangle}
          color="red"
        />
      </div>

      {/* ADMIN NAVIGATION TABS */}
      <div className="flex border-b border-slate-200/60 dark:border-slate-800 space-x-4 overflow-x-auto pb-1 text-xs font-bold">
        {[
          { id: 'overview', name: 'Dashboard Overview', icon: ShieldCheck },
          { id: 'reports', name: 'Manage Road Reports', icon: FileText },
          { id: 'users', name: 'User Access Control', icon: Users },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl border-b-2 transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-brand-600 text-brand-600 dark:text-brand-400 bg-brand-500/5'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" /> {tab.name}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT 1: ROAD REPORTS MANAGEMENT */}
      {(activeTab === 'overview' || activeTab === 'reports') && (
        <Card className="space-y-4 p-0 overflow-hidden">
          <div className="p-4 border-b border-slate-200/60 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
              Submitted Road & Incident Reports
            </h3>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reports..."
                className="pl-9 pr-3 py-1.5 rounded-xl glass-input text-xs"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-4">Report ID</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Location</th>
                  <th className="p-4">Severity</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-center">Approve / Reject</th>
                  <th className="p-4 text-right">Update Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {reports
                  .filter(r => (r?.id || '').toLowerCase().includes(searchQuery.toLowerCase()) || (r?.locationName || '').toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="p-4 font-bold text-slate-900 dark:text-white">{r.id}</td>
                      <td className="p-4 font-semibold text-slate-700 dark:text-slate-300">{r.type}</td>
                      <td className="p-4 text-slate-600 dark:text-slate-400 max-w-xs truncate">{r.locationName}</td>
                      <td className="p-4"><StatusBadge status={r.severity} /></td>
                      <td className="p-4"><StatusBadge status={r.status} /></td>

                      {/* Approve / Reject Actions */}
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleApproveReport(r.id)}
                            title="Approve Report"
                            className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRejectReport(r.id)}
                            title="Reject Report"
                            className="p-1.5 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 transition"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setSelectedReport(r)}
                            title="Inspect Specs"
                            className="p-1.5 rounded-lg bg-brand-500/10 text-brand-600 hover:bg-brand-500/20 transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>

                      {/* Update Repair Status Dropdown */}
                      <td className="p-4 text-right">
                        <select
                          value={r.status}
                          onChange={(e) => handleUpdateStatus(r.id, e.target.value)}
                          className="px-2.5 py-1 rounded-xl glass-input text-xs font-semibold focus:outline-none"
                        >
                          <option value="Pending">Pending</option>
                          <option value="Under Review">Under Review</option>
                          <option value="Scheduled">Scheduled</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Resolved">Resolved</option>
                        </select>
                      </td>

                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB CONTENT 2: USER ACCESS CONTROL */}
      {(activeTab === 'users') && (
        <Card className="space-y-4 p-0 overflow-hidden">
          <div className="p-4 border-b border-slate-200/60 dark:border-slate-800">
            <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
              Registered Platform Users & Inspectors
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-4">User</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Reports Logged</th>
                  <th className="p-4 text-right">Toggle Admin Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="p-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-400 shrink-0">
                        <Users className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white">{u.name}</span>
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-400">{u.email}</td>
                    <td className="p-4 font-semibold text-brand-600 dark:text-brand-400">{u.role}</td>
                    <td className="p-4"><StatusBadge status={u.status} /></td>
                    <td className="p-4 font-bold text-center">{u.reportsSubmitted ?? u.reports_submitted ?? 0}</td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleToggleUserRole(u.id)}
                        className="px-3 py-1 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold hover:bg-brand-600 hover:text-white transition"
                      >
                        Change Role
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Hazard Details Modal */}
      <RoadHazardDetailsModal
        isOpen={Boolean(selectedReport)}
        onClose={() => setSelectedReport(null)}
        hazard={selectedReport}
      />

    </div>
  );
};
