import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LeafletMap } from '../components/maps/LeafletMap';
import { RoadHazardDetailsModal } from '../components/common/RoadHazardDetailsModal';
import api from '../services/api';
import {
  Filter,
  MapPin,
  AlertTriangle,
  Layers,
  RefreshCw,
  Search,
  Activity,
  CheckCircle2,
  ShieldCheck,
  Loader2,
  XCircle,
  Info,
  Wifi,
  WifiOff,
  Navigation,
  Maximize2,
  Compass,
  Zap
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { useNotifications } from '../context/NotificationContext';

// Quick Jump Landmark Hubs in Anand
const ANAND_LANDMARKS = [
  { name: 'All Anand', coords: [22.5645, 72.9289], zoom: 13 },
  { name: 'Railway Station', coords: [22.5606, 72.9575], zoom: 15 },
  { name: 'Amul Dairy Hub', coords: [22.5535, 72.9515], zoom: 15 },
  { name: 'Vidyanagar', coords: [22.5528, 72.9242], zoom: 15 },
  { name: 'Karamsad', coords: [22.5475, 72.8988], zoom: 15 },
  { name: 'Borsad Chokdi', coords: [22.5400, 72.9320], zoom: 15 },
];

export const InteractiveMapPage = () => {
  const { addToast } = useNotifications();

  const [reports, setReports] = useState([]);
  const [rqiSegments, setRqiSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState('All');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('Active');
  const [searchQuery, setSearchQuery] = useState('');
  const [showRqiLayer, setShowRqiLayer] = useState(true);
  const [showHeatCircles, setShowHeatCircles] = useState(false);
  const [showRoutePreview, setShowRoutePreview] = useState(false);
  const [routePreviewData, setRoutePreviewData] = useState([]);
  const [selectedHazard, setSelectedHazard] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [mapCenter, setMapCenter] = useState([22.5645, 72.9289]);
  const [mapZoom, setMapZoom] = useState(13);
  const [mapBounds, setMapBounds] = useState(null);

  // ─── Fetch All Map Data from Real Backend ────────────────────────────────
  const fetchMapData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const params = {};
      if (typeFilter !== 'All') params.type = typeFilter;
      if (severityFilter !== 'All') params.severity = severityFilter;
      if (statusFilter !== 'All') params.status = statusFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const [reportsRes, rqiRes] = await Promise.allSettled([
        api.get('/reports', { params }),
        api.get('/map/rqi-segments'),
      ]);

      if (reportsRes.status === 'fulfilled' && reportsRes.value.data?.reports) {
        let fetched = reportsRes.value.data.reports;
        if (statusFilter === 'Active') {
          fetched = fetched.filter(r => (r.status || '').toLowerCase() !== 'resolved');
        }
        setReports(fetched);
        setIsOnline(true);

        // Auto-compute bounding box to fit all active markers on initial load
        if (fetched.length > 0 && !isRefresh) {
          const lats = fetched.map(r => Number(r.lat)).filter(n => !isNaN(n));
          const lngs = fetched.map(r => Number(r.lng)).filter(n => !isNaN(n));
          if (lats.length && lngs.length) {
            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);
            const minLng = Math.min(...lngs);
            const maxLng = Math.max(...lngs);
            setMapBounds([[minLat, minLng], [maxLat, maxLng]]);
          }
        }
      } else {
        console.warn('Reports fetch failed:', reportsRes.reason?.message);
        setIsOnline(false);
      }

      if (rqiRes.status === 'fulfilled' && rqiRes.value.data?.segments) {
        setRqiSegments(rqiRes.value.data.segments);
      }

      setLastUpdated(new Date());
    } catch (err) {
      console.warn('Map data fetch error:', err.message);
      setIsOnline(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [typeFilter, severityFilter, statusFilter, searchQuery]);

  // Initial load
  useEffect(() => {
    fetchMapData(false);
  }, []);

  // Re-fetch when server filters change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMapData(true);
    }, 400);
    return () => clearTimeout(timer);
  }, [typeFilter, severityFilter, statusFilter, searchQuery]);

  // Auto-refresh every 30 seconds for live telemetry & new citizen reports
  useEffect(() => {
    const interval = setInterval(() => {
      fetchMapData(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchMapData]);

  // Client-side search filtering
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (statusFilter === 'Active' && (r.status || '').toLowerCase() === 'resolved') {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (r.locationName || '').toLowerCase().includes(q) ||
        (r.id || '').toLowerCase().includes(q) ||
        (r.type || '').toLowerCase().includes(q) ||
        (r.district || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q)
      );
    });
  }, [reports, searchQuery, statusFilter]);

  // Fit all active pins into view
  const handleFitAllPins = () => {
    if (!filteredReports.length) return;
    const lats = filteredReports.map(r => Number(r.lat)).filter(n => !isNaN(n));
    const lngs = filteredReports.map(r => Number(r.lng)).filter(n => !isNaN(n));
    if (lats.length && lngs.length) {
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      setMapBounds([[minLat, minLng], [maxLat, maxLng]]);
      addToast(`Fitted ${filteredReports.length} hazard markers in view`, 'info');
    }
  };

  // Toggle Type Filter via interactive Legend
  const handleLegendClick = (type) => {
    if (typeFilter === type) {
      setTypeFilter('All');
    } else {
      setTypeFilter(type);
    }
  };

  // Click RQI Corridor banner to smoothly focus on it
  const handleFocusRqiCorridor = (rqi) => {
    if (rqi.lat1 && rqi.lng1) {
      const midLat = (Number(rqi.lat1) + Number(rqi.lat2 || rqi.lat1)) / 2;
      const midLng = (Number(rqi.lng1) + Number(rqi.lng2 || rqi.lng1)) / 2;
      setMapBounds(null);
      setMapCenter([midLat, midLng]);
      setMapZoom(16);
      addToast(`Viewing Corridor: ${rqi.name} (RQI ${rqi.rqiScore}/100)`, 'info');
    }
  };

  // Click Landmark jump
  const handleJumpLandmark = (landmark) => {
    setMapBounds(null);
    setMapCenter(landmark.coords);
    setMapZoom(landmark.zoom);
  };

  // Click a map marker -> open real hazard detail modal
  const handleMarkerClick = useCallback(async (report) => {
    try {
      const res = await api.get(`/reports/${report.id}`);
      if (res.data?.report) {
        setSelectedHazard(res.data.report);
      } else {
        setSelectedHazard(report);
      }
    } catch {
      setSelectedHazard(report);
    }
  }, []);

  // Upvote hazard via real API
  const handleUpvote = useCallback(async (reportId) => {
    try {
      await api.post(`/reports/${reportId}/upvote`);
      setReports(prev =>
        prev.map(r => (r.id === reportId ? { ...r, upvotes: (r.upvotes || 0) + 1 } : r))
      );
      if (selectedHazard?.id === reportId) {
        setSelectedHazard(prev => ({ ...prev, upvotes: (prev.upvotes || 0) + 1 }));
      }
      addToast('Upvoted report verification!', 'success');
    } catch (err) {
      console.warn('Upvote failed:', err.message);
    }
  }, [selectedHazard]);

  // Add comment via real API
  const handleAddComment = useCallback(async (reportId, text, userName) => {
    try {
      const res = await api.post(`/reports/${reportId}/comments`, {
        text,
        user: userName || 'Inspector',
      });
      if (res.data?.comment && selectedHazard?.id === reportId) {
        setSelectedHazard(prev => ({
          ...prev,
          comments: [res.data.comment, ...(prev.comments || [])],
        }));
      }
      addToast('Comment recorded to road safety log.', 'success');
      return res.data?.comment;
    } catch (err) {
      console.warn('Comment failed:', err.message);
    }
  }, [selectedHazard, addToast]);

  // Toggle Route Preview on this map
  const handleToggleRoutePreview = async () => {
    if (showRoutePreview) {
      setShowRoutePreview(false);
      setRoutePreviewData([]);
      return;
    }

    try {
      addToast('Calculating Safest vs Fastest route across Anand...', 'info');
      const res = await api.post('/map/safe-route', {
        startLat: 22.5606,
        startLng: 72.9575,
        endLat: 22.5528,
        endLng: 72.9242,
        avoidanceLevel: 'High'
      });

      if (res.data?.routes) {
        setRoutePreviewData(res.data.routes);
        setShowRoutePreview(true);
        addToast('SafeRoute Overlay active: Station Rd → Vidyanagar', 'success');
      } else {
        // Fallback demo routes
        setRoutePreviewData([
          {
            id: 'safest',
            name: 'Safest Route (AI Verified)',
            positions: [[22.5606, 72.9575], [22.5640, 72.9450], [22.5580, 72.9320], [22.5528, 72.9242]],
            color: '#10b981',
            isSafest: true,
            duration: '11 mins',
            distance: '4.2 km',
            safetyScore: 94
          },
          {
            id: 'fastest',
            name: 'Fastest Route (Has 3 Defects)',
            positions: [[22.5606, 72.9575], [22.5595, 72.9460], [22.5535, 72.9515], [22.5528, 72.9242]],
            color: '#f59e0b',
            isSafest: false,
            duration: '8 mins',
            distance: '3.6 km',
            safetyScore: 68
          }
        ]);
        setShowRoutePreview(true);
      }
    } catch (err) {
      console.warn('Safe route preview error:', err.message);
    }
  };

  // RQI color helper
  const rqiColor = (score) =>
    score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="space-y-6 pb-12">

      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 text-xs font-bold border border-brand-500/20 mb-1">
            <Layers className="w-4 h-4" /> Road Quality Index (RQI) Spatial Map
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Road Quality &amp; Hazard Interactive Map
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Real-time geospatial road condition mapping with RQI surface smoothness heatmap layers.
          </p>
        </div>

        {/* Marker Legend & Map Feature Toggles */}
        <div className="flex flex-wrap items-center gap-2.5 glass-panel p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs shadow-sm">
          
          <button
            onClick={() => setShowRqiLayer(!showRqiLayer)}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition ${
              showRqiLayer ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            {showRqiLayer ? 'RQI Layer ACTIVE' : 'Enable RQI'}
          </button>

          <button
            onClick={() => setShowHeatCircles(!showHeatCircles)}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition ${
              showHeatCircles ? 'bg-red-600 text-white shadow-md shadow-red-600/30' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            {showHeatCircles ? 'Heat Glow ON' : 'Heat Glow'}
          </button>

          <button
            onClick={handleToggleRoutePreview}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition ${
              showRoutePreview ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{showRoutePreview ? 'Route Preview ON' : 'Fastest vs Safest Route'}</span>
          </button>

          <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 hidden sm:block" />

          {/* Interactive Legend with click-to-filter */}
          <span className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px]">Filter:</span>
          <button
            onClick={() => handleLegendClick('Pothole')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold transition ${
              typeFilter === 'Pothole' ? 'bg-safety-500 text-white' : 'text-safety-600 dark:text-safety-400 hover:bg-safety-500/10'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-safety-500" /> Potholes
          </button>
          <button
            onClick={() => handleLegendClick('Crack')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold transition ${
              typeFilter === 'Crack' ? 'bg-amber-500 text-white' : 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" /> Cracks
          </button>
          <button
            onClick={() => handleLegendClick('Accident')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold transition ${
              typeFilter === 'Accident' ? 'bg-red-500 text-white' : 'text-red-600 dark:text-red-400 hover:bg-red-500/10'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-500" /> Accidents
          </button>
          <button
            onClick={() => handleLegendClick('Repair')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold transition ${
              typeFilter === 'Repair' ? 'bg-emerald-500 text-white' : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Repairs
          </button>
        </div>
      </div>

      {/* FILTER & LANDMARK QUICK JUMP BAR */}
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">

          {/* Search Location */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search street, area, or report ID..."
              className="w-full pl-9 pr-3 py-2 rounded-xl glass-input text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl glass-input text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="All">All Types</option>
              <option value="Pothole">Potholes</option>
              <option value="Crack">Surface Cracks</option>
              <option value="Accident">Accidents</option>
              <option value="Repair">Repairs</option>
            </select>
          </div>

          {/* Severity Filter */}
          <div>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl glass-input text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="All">All Severities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          {/* Status Filter & Actions */}
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl glass-input text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="Active">Active Hazards (Excludes Resolved)</option>
              <option value="All">All Reports (Include Resolved)</option>
              <option value="Pending">Pending</option>
              <option value="Under Review">Under Review</option>
              <option value="In Progress">In Progress</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Resolved">Resolved</option>
            </select>

            <button
              onClick={handleFitAllPins}
              title="Fit all markers in view"
              className="p-2 rounded-xl glass-panel hover:bg-slate-200 dark:hover:bg-slate-800 transition text-brand-600 dark:text-brand-400"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            <button
              onClick={() => fetchMapData(true)}
              disabled={refreshing}
              title="Refresh live data"
              className="p-2 rounded-xl glass-panel hover:bg-slate-200 dark:hover:bg-slate-800 transition text-slate-600 dark:text-slate-300 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

        </div>

        {/* Landmark Quick Jump Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200/60 dark:border-slate-800">
          <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
            <Compass className="w-3.5 h-3.5" /> Jump to Area:
          </span>
          {ANAND_LANDMARKS.map(lm => (
            <button
              key={lm.name}
              onClick={() => handleJumpLandmark(lm)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800/80 hover:bg-brand-500 hover:text-white dark:hover:bg-brand-600 text-slate-700 dark:text-slate-300 transition"
            >
              {lm.name}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-200/60 dark:border-slate-800">
          <div className="flex items-center gap-3">
            {loading ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-500" />
                Loading live data...
              </span>
            ) : (
              <span>
                Displaying <strong>{filteredReports.length}</strong> active map pin(s)
                {lastUpdated && (
                  <span className="ml-2 text-slate-400">
                    · Updated {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </span>
            )}
            <span className={`flex items-center gap-1 font-medium ${isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
              {isOnline
                ? <><Wifi className="w-3 h-3" /> Live</>
                : <><WifiOff className="w-3 h-3" /> Offline</>
              }
            </span>
          </div>
          <span className="font-medium text-brand-600 dark:text-brand-400 cursor-default">
            Click markers to view depth specs &amp; full hazard details
          </span>
        </div>
      </Card>

      {/* ROAD QUALITY INDEX (RQI) SEGMENTS BANNER — INTERACTIVE CLICK TO FLY */}
      {showRqiLayer && rqiSegments.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shadow-xl">
          <div className="flex items-center gap-2 shrink-0">
            <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="font-bold">Live Surface Smoothness RQI Corridors:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {rqiSegments.map(rqi => (
              <button
                key={rqi.id}
                onClick={() => handleFocusRqiCorridor(rqi)}
                title="Click to view corridor on map"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 hover:border-brand-500 hover:bg-slate-750 transition text-left cursor-pointer group"
              >
                <span className="font-semibold text-slate-300 group-hover:text-white">{rqi.name}:</span>
                <span className={`font-extrabold ${rqiColor(rqi.rqiScore)}`}>
                  RQI {rqi.rqiScore}/100 ({rqi.status})
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* MAP CONTAINER */}
      <div className="relative h-[620px] w-full rounded-3xl overflow-hidden shadow-2xl border border-slate-200/80 dark:border-slate-800">
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/60 rounded-3xl">
            <div className="flex flex-col items-center gap-3 text-white">
              <Loader2 className="w-10 h-10 animate-spin text-brand-400" />
              <span className="text-sm font-semibold">Loading live map data...</span>
            </div>
          </div>
        )}
        <LeafletMap
          center={mapCenter}
          zoom={mapZoom}
          bounds={mapBounds}
          reports={filteredReports}
          showRqiLayer={showRqiLayer}
          rqiSegments={rqiSegments}
          heatmapMode={showHeatCircles}
          heatRadius={120}
          routes={routePreviewData}
          onMarkerClick={handleMarkerClick}
          hideResolved={statusFilter !== 'Resolved' && statusFilter !== 'All'}
        />

        {/* Refreshing indicator overlay */}
        {refreshing && !loading && (
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 text-white text-xs font-semibold shadow-lg">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-400" />
            Syncing live data...
          </div>
        )}
      </div>

      {/* Summary Stats Bar */}
      {!loading && filteredReports.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Hazards', value: filteredReports.length, color: 'text-slate-900 dark:text-white' },
            { label: 'Critical / High', value: filteredReports.filter(r => r.severity === 'Critical' || r.severity === 'High').length, color: 'text-red-600 dark:text-red-400' },
            { label: 'Pending', value: filteredReports.filter(r => r.status === 'Pending').length, color: 'text-amber-600 dark:text-amber-400' },
            { label: 'Resolved', value: filteredReports.filter(r => r.status === 'Resolved').length, color: 'text-emerald-600 dark:text-emerald-400' },
          ].map(stat => (
            <Card key={stat.label} className="p-4 text-center">
              <div className={`text-2xl font-extrabold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">{stat.label}</div>
            </Card>
          ))}
        </div>
      )}

      {/* HAZARD DETAILS MODAL — with real API upvote & comment */}
      <RoadHazardDetailsModal
        isOpen={Boolean(selectedHazard)}
        onClose={() => setSelectedHazard(null)}
        hazard={selectedHazard}
        onUpvote={handleUpvote}
        onAddComment={handleAddComment}
      />

    </div>
  );
};
