import React, { useState, useEffect } from 'react';
import { INITIAL_REPORTS } from '../utils/mockData';
import { StatusBadge } from '../components/common/StatusBadge';
import { Card } from '../components/common/Card';
import { Modal } from '../components/common/Modal';
import { FileText, Eye, MapPin, Calendar, ThumbsUp, PlusCircle, RefreshCw, Loader2, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { getSafeImageUrl, handleImageError } from '../utils/imageUtils';

export const MyReportsPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [adminViewMode, setAdminViewMode] = useState('all'); // 'all' | 'mine'
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const { addToast } = useNotifications();

  const isUserSpecific = !isAdmin || adminViewMode === 'mine';

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = {};
      if (isUserSpecific && user?.name) {
        params.reportedBy = user.name;
      }

      const res = await api.get('/reports', { params });
      if (res.data?.reports) {
        let fetched = res.data.reports;
        if (isUserSpecific && user?.name) {
          fetched = fetched.filter(
            (r) => (r.reportedBy || '').trim().toLowerCase() === user.name.trim().toLowerCase()
          );
        }
        setReports(fetched);
      } else {
        setReports([]);
      }
    } catch (err) {
      console.warn('Fallback to local reports:', err.message);
      let fallback = INITIAL_REPORTS;
      if (isUserSpecific && user?.name) {
        fallback = fallback.filter(
          (r) => (r.reportedBy || '').trim().toLowerCase() === user.name.trim().toLowerCase()
        );
      }
      setReports(fallback);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [user?.name, isAdmin, adminViewMode]);

  const handleUpvote = async (id, e) => {
    e.stopPropagation();
    try {
      const res = await api.post(`/reports/${id}/upvote`);
      setReports((prev) =>
        prev.map((r) => (r.id === id ? { ...r, upvotes: res.data.upvotes } : r))
      );
      addToast('Upvoted report!', 'success');
    } catch (err) {
      setReports((prev) =>
        prev.map((r) => (r.id === id ? { ...r, upvotes: (r.upvotes || 0) + 1 } : r))
      );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <FileText className="w-7 h-7 text-brand-600 dark:text-brand-400" />
            {isAdmin
              ? adminViewMode === 'all'
                ? 'All City Damage Reports'
                : 'My Submitted Reports'
              : 'My Submitted Reports'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isAdmin && adminViewMode === 'all'
              ? 'Complete municipal registry of all citizen hazard submissions across the city.'
              : `Viewing personal road hazard submissions logged by ${user?.name || 'you'}.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Admin Switcher: All Reports vs My Reports Only */}
          {isAdmin && (
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold">
              <button
                onClick={() => setAdminViewMode('all')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  adminViewMode === 'all'
                    ? 'bg-brand-600 text-white shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All Reports
              </button>
              <button
                onClick={() => setAdminViewMode('mine')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  adminViewMode === 'mine'
                    ? 'bg-brand-600 text-white shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                My Reports Only
              </button>
            </div>
          )}

          <button
            onClick={fetchReports}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
            title="Refresh reports"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <Link
            to="/report-damage"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-safety-600 to-brand-600 text-white font-bold text-xs shadow-md hover:opacity-95 transition"
          >
            <PlusCircle className="w-4 h-4" /> Submit New Report
          </Link>
        </div>
      </div>

      {/* REPORTS TABLE CARD */}
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
            <p className="text-xs font-medium">Loading reports...</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-16 px-4 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 mx-auto flex items-center justify-center">
              <FileText className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                No Reports Found
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                {isUserSpecific
                  ? `You (${user?.name || 'your account'}) haven't submitted any road hazard reports yet.`
                  : 'No damage reports match the current filter criteria.'}
              </p>
            </div>
            <Link
              to="/report-damage"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-safety-600 to-brand-600 text-white font-bold text-xs shadow-md hover:opacity-95 transition"
            >
              <PlusCircle className="w-4 h-4" /> Submit Your First Report
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-4">Evidence Image</th>
                  <th className="p-4">Issue ID & Type</th>
                  {isAdmin && adminViewMode === 'all' && <th className="p-4">Reported By</th>}
                  <th className="p-4">Location</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Date Logged</th>
                  <th className="p-4 text-center">Community Upvotes</th>
                  <th className="p-4 text-right">View Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {reports.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    
                    {/* Thumbnail */}
                    <td className="p-4">
                      <div className="w-14 h-12 rounded-xl overflow-hidden bg-slate-200 border border-slate-300 dark:border-slate-700">
                        <img
                          src={getSafeImageUrl(r.image, r.type)}
                          alt={r.type}
                          onError={(e) => handleImageError(e, r.type)}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </td>

                    {/* ID & Type */}
                    <td className="p-4">
                      <p className="font-bold text-slate-900 dark:text-white text-sm">{r.id}</p>
                      <span className="text-slate-500 font-semibold">{r.type}</span>
                    </td>

                    {/* Reported By (Admin View) */}
                    {isAdmin && adminViewMode === 'all' && (
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          <User className="w-3 h-3 text-brand-500" />
                          {r.reportedBy}
                        </span>
                      </td>
                    )}

                    {/* Location */}
                    <td className="p-4 text-slate-700 dark:text-slate-300 font-medium max-w-xs truncate">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" />
                        <span className="truncate">{r.locationName}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="p-4">
                      <StatusBadge status={r.status} />
                    </td>

                    {/* Date */}
                    <td className="p-4 text-slate-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{r.date} ({r.time})</span>
                      </div>
                    </td>

                    {/* Upvotes */}
                    <td className="p-4 text-center">
                      <button
                        onClick={(e) => handleUpvote(r.id, e)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold hover:bg-brand-500/20 transition cursor-pointer"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" /> {r.upvotes || 0}
                      </button>
                    </td>

                    {/* Action */}
                    <td className="p-4 text-right">
                      <button
                        onClick={() => setSelectedReport(r)}
                        className="px-3 py-1.5 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-500 transition flex items-center gap-1.5 ml-auto"
                      >
                        <Eye className="w-3.5 h-3.5" /> Details
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* DETAIL MODAL */}
      <Modal
        isOpen={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        title={`Report Investigation - ${selectedReport?.id}`}
      >
        {selectedReport && (
          <div className="space-y-4">
            <div className="relative h-56 w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-700">
              <img
                src={getSafeImageUrl(selectedReport.image, selectedReport.type)}
                alt={selectedReport.type}
                onError={(e) => handleImageError(e, selectedReport.type)}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 right-3">
                <StatusBadge status={selectedReport.status} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                <span className="text-slate-400 block text-[10px]">Hazard Type</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedReport.type}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                <span className="text-slate-400 block text-[10px]">AI Vision Confidence</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{selectedReport.aiConfidence}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                <span className="text-slate-400 block text-[10px]">Reported By</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedReport.reportedBy}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                <span className="text-slate-400 block text-[10px]">Logged Date</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedReport.date}</span>
              </div>
            </div>

            <div>
              <span className="text-slate-400 block text-xs mb-1 font-semibold">Location & Context</span>
              <p className="text-xs text-slate-700 dark:text-slate-300 font-medium bg-slate-100 dark:bg-slate-800/80 p-3 rounded-xl">
                {selectedReport.locationName} - {selectedReport.description}
              </p>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
};
