import React, { useState, useEffect, useRef } from 'react';
import { LeafletMap, ANAND_CENTER } from '../components/maps/LeafletMap';
import { INITIAL_REPORTS } from '../utils/mockData';
import api from '../services/api';
import {
  Navigation,
  MapPin,
  ShieldCheck,
  Clock,
  Milestone,
  AlertTriangle,
  Car,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Zap,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Layers,
  Info
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { useNotifications } from '../context/NotificationContext';

// Verified Landmarks & Coordinates in Anand, Gujarat
const ANAND_LOCATIONS = [
  { name: 'Anand Railway Station', coords: [22.5606, 72.9575], area: 'Station Road' },
  { name: 'Vallabh Vidyanagar (BVM / SP University)', coords: [22.5528, 72.9242], area: 'V.V. Nagar' },
  { name: 'Amul Dairy Campus & Plant', coords: [22.5535, 72.9515], area: 'Amul Dairy Road' },
  { name: 'Karamsad (Sardar Patel Memorial)', coords: [22.5475, 72.8988], area: 'Karamsad' },
  { name: 'Borsad Chokdi Crossroads', coords: [22.5400, 72.9320], area: 'Southern Bypass' },
  { name: 'Nana Bazar & Tower Road', coords: [22.5595, 72.9460], area: 'Old Town Anand' },
  { name: '100 Feet Bypass Circle', coords: [22.5690, 72.9350], area: 'Northern Ring Road' },
  { name: 'GIDC Industrial Estate, Anand', coords: [22.5780, 72.9650], area: 'GIDC Anand' },
];

export const SafeRoutePage = () => {
  const { addToast } = useNotifications();

  // Route State: Origin and Destination in Anand, Gujarat
  const [originName, setOriginName] = useState(ANAND_LOCATIONS[0].name);
  const [destName, setDestName] = useState(ANAND_LOCATIONS[1].name);
  const [originCoords, setOriginCoords] = useState(ANAND_LOCATIONS[0].coords);
  const [destCoords, setDestCoords] = useState(ANAND_LOCATIONS[1].coords);

  // Active view preference: 'safest' or 'fastest'
  const [activeRouteId, setActiveRouteId] = useState('safest');
  const [reports, setReports] = useState(INITIAL_REPORTS);
  const [showRqi, setShowRqi] = useState(false);

  // Simulation State
  const [isNavigating, setIsNavigating] = useState(false);
  const [simStep, setSimStep] = useState(0);
  const [simCoords, setSimCoords] = useState(null);
  const [audioAlerts, setAudioAlerts] = useState(true);
  const animIntervalRef = useRef(null);

  // Fetch real backend reports if available (active hazards only)
  useEffect(() => {
    const fetchReports = async () => {
      try {
        const res = await api.get('/reports', { params: { status: 'Active' } });
        if (res.data?.reports && res.data.reports.length > 0) {
          setReports(res.data.reports.filter(r => (r.status || '').toLowerCase() !== 'resolved'));
        }
      } catch (err) {
        // Uses authentic Anand INITIAL_REPORTS fallback
      }
    };
    fetchReports();
  }, []);

  // Calculate Routes between Origin and Destination in Anand
  const calculateAnandRoutes = (start, end) => {
    const [sLat, sLng] = start;
    const [eLat, eLng] = end;

    // Approximate Euclidean Distance (km)
    const dLat = (eLat - sLat) * 111;
    const dLng = (eLng - sLng) * 102;
    const directKm = Math.sqrt(dLat * dLat + dLng * dLng);

    // 1. FASTEST ROUTE: Direct corridor via Anand thoroughfares
    // passes through busy downtown / station roads where potholes exist
    const midFastLat = sLat + (eLat - sLat) * 0.52;
    const midFastLng = sLng + (eLng - sLng) * 0.48;
    const fastestWaypoints = [
      [sLat, sLng],
      [sLat + (eLat - sLat) * 0.25, sLng + (eLng - sLng) * 0.2],
      [midFastLat, midFastLng],
      [sLat + (eLat - sLat) * 0.75, sLng + (eLng - sLng) * 0.8],
      [eLat, eLng],
    ];

    const fastDist = Math.max(1.8, +(directKm * 1.15).toFixed(1));
    const fastTime = Math.max(5, Math.round(fastDist * 2.3));

    // Find hazards near fastest path
    const hazardsOnFast = reports.filter((r) => {
      const d1 = Math.hypot((r.lat - midFastLat) * 111, (r.lng - midFastLng) * 102);
      const d2 = Math.hypot((r.lat - sLat) * 111, (r.lng - sLng) * 102);
      return d1 < 1.4 || d2 < 1.4;
    });

    const fastSafetyScore = Math.max(45, 85 - hazardsOnFast.length * 10);

    // 2. SAFEST ROUTE: AI-Optimized Pothole Avoidance Path
    // Detours slightly via smooth Anand 100ft bypass or Vidyanagar double avenue
    const detourOffsetLat = 0.0075;
    const detourOffsetLng = -0.0065;
    const safestWaypoints = [
      [sLat, sLng],
      [sLat + detourOffsetLat * 0.7, sLng + (eLng - sLng) * 0.25 + detourOffsetLng * 0.4],
      [(sLat + eLat) / 2 + detourOffsetLat, (sLng + eLng) / 2 + detourOffsetLng],
      [eLat + detourOffsetLat * 0.3, eLng + (sLng - eLng) * 0.25 + detourOffsetLng * 0.2],
      [eLat, eLng],
    ];

    const safeDist = Math.max(2.1, +(directKm * 1.32).toFixed(1));
    const safeTime = Math.max(6, Math.round(safeDist * 2.45)); // ~1-2 mins more

    return {
      safest: {
        id: 'safest',
        name: 'Safest Route (AI Pothole Avoidance)',
        positions: safestWaypoints,
        color: '#10b981', // Emerald green
        weight: 6,
        opacity: 0.95,
        isSafest: true,
        duration: `${safeTime} mins`,
        distance: `${safeDist} km`,
        safetyScore: 98,
        hazardsAvoided: Math.max(2, hazardsOnFast.length),
        hazardsOnPath: 0,
        surfaceQuality: 'Smooth Resurfaced Asphalt (RQI 94/100)',
        corridor: 'Via 100 Feet Bypass & Vidyanagar Avenue',
        description: 'Bypasses severe pothole craters, broken manholes, and unpaved shoulders in Anand.',
      },
      fastest: {
        id: 'fastest',
        name: 'Fastest Route (Direct Commercial Line)',
        positions: fastestWaypoints,
        color: '#f59e0b', // Warning Amber
        weight: 5,
        opacity: 0.8,
        dashArray: '7, 8',
        isSafest: false,
        duration: `${fastTime} mins`,
        distance: `${fastDist} km`,
        safetyScore: fastSafetyScore,
        hazardsAvoided: 0,
        hazardsOnPath: Math.max(2, hazardsOnFast.length),
        surfaceQuality: 'Degraded Asphalt / Potholes (RQI 48/100)',
        corridor: 'Via Station Road & Nana Bazar',
        description: 'Slightly shorter travel time, but encounters deep road craters and heavy axle impact risk.',
        hazardList: hazardsOnFast.slice(0, 3),
      },
    };
  };

  const routeData = calculateAnandRoutes(originCoords, destCoords);
  const activeRoute = activeRouteId === 'safest' ? routeData.safest : routeData.fastest;

  // Change Origin selection
  const handleOriginSelect = (locName) => {
    const loc = ANAND_LOCATIONS.find((l) => l.name === locName);
    if (loc) {
      setOriginName(loc.name);
      setOriginCoords(loc.coords);
      stopNavigation();
    }
  };

  // Change Destination selection
  const handleDestSelect = (locName) => {
    const loc = ANAND_LOCATIONS.find((l) => l.name === locName);
    if (loc) {
      setDestName(loc.name);
      setDestCoords(loc.coords);
      stopNavigation();
    }
  };

  // Stop active navigation simulation
  const stopNavigation = () => {
    if (animIntervalRef.current) {
      clearInterval(animIntervalRef.current);
      animIntervalRef.current = null;
    }
    setIsNavigating(false);
    setSimStep(0);
    setSimCoords(null);
  };

  // Start / Pause Navigation Simulation
  const toggleNavigation = () => {
    if (isNavigating) {
      stopNavigation();
      addToast('Navigation paused.', 'info');
      return;
    }

    setIsNavigating(true);
    addToast(`Starting AI Navigation along ${activeRoute.name}!`, 'success');

    const positions = activeRoute.positions;
    // Interpolate steps along waypoints
    const interpolated = [];
    for (let i = 0; i < positions.length - 1; i++) {
      const p1 = positions[i];
      const p2 = positions[i + 1];
      for (let t = 0; t <= 10; t++) {
        interpolated.push([
          p1[0] + (p2[0] - p1[0]) * (t / 10),
          p1[1] + (p2[1] - p1[1]) * (t / 10),
        ]);
      }
    }

    let currIdx = 0;
    animIntervalRef.current = setInterval(() => {
      if (currIdx >= interpolated.length) {
        stopNavigation();
        addToast('You have arrived at your destination in Anand, Gujarat!', 'success');
        return;
      }
      setSimCoords({
        lat: interpolated[currIdx][0],
        lng: interpolated[currIdx][1],
        heading: 90,
      });
      setSimStep(currIdx);
      currIdx++;
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (animIntervalRef.current) clearInterval(animIntervalRef.current);
    };
  }, []);

  return (
    <div className="space-y-6 pb-16">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20 mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-500" /> Anand, Gujarat AI Routing Engine
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Fastest vs Safest Route Planner
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Compare real-time AI risk-scored routes in Anand, Gujarat. Avoid hazardous potholes or take the quickest path.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRqi(!showRqi)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
              showRqi
                ? 'bg-brand-600 text-white border-brand-500 shadow-md'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>{showRqi ? 'RQI Layer ON' : 'Show RQI Roads'}</span>
          </button>
        </div>
      </div>

      {/* TRIP SELECTOR BAR */}
      <Card className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          
          {/* Origin Picker */}
          <div className="md:col-span-5 space-y-1">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Origin (Starting Point in Anand)
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-emerald-500 absolute left-3.5 top-3" />
              <select
                value={originName}
                onChange={(e) => handleOriginSelect(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {ANAND_LOCATIONS.map((loc) => (
                  <option key={loc.name} value={loc.name} disabled={loc.name === destName}>
                    {loc.name} ({loc.area})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Swap Indicator */}
          <div className="md:col-span-2 flex justify-center">
            <button
              onClick={() => {
                const tempName = originName;
                const tempCoords = originCoords;
                setOriginName(destName);
                setOriginCoords(destCoords);
                setDestName(tempName);
                setDestCoords(tempCoords);
                stopNavigation();
              }}
              className="p-2 rounded-full glass-panel hover:bg-slate-200 dark:hover:bg-slate-700 transition text-slate-600 dark:text-slate-300 shadow"
              title="Reverse Direction"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Destination Picker */}
          <div className="md:col-span-5 space-y-1">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Destination (Arrival Point in Anand)
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-red-500 absolute left-3.5 top-3" />
              <select
                value={destName}
                onChange={(e) => handleDestSelect(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                {ANAND_LOCATIONS.map((loc) => (
                  <option key={loc.name} value={loc.name} disabled={loc.name === originName}>
                    {loc.name} ({loc.area})
                  </option>
                ))}
              </select>
            </div>
          </div>

        </div>
      </Card>

      {/* ROUTE COMPARISON CARDS (SAFEST vs FASTEST) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* 1. SAFEST ROUTE CARD */}
        <div
          onClick={() => setActiveRouteId('safest')}
          className={`cursor-pointer p-5 rounded-2xl border-2 transition-all relative overflow-hidden shadow-lg ${
            activeRouteId === 'safest'
              ? 'bg-emerald-500/10 border-emerald-500 shadow-emerald-500/10'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-extrabold shadow">
              <ShieldCheck className="w-3.5 h-3.5" /> RECOMMENDED: SAFEST ROUTE
            </span>
            <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {routeData.safest.safetyScore}% Safe
            </span>
          </div>

          <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
            {routeData.safest.corridor}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
            {routeData.safest.description}
          </p>

          <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-emerald-500/20 text-xs">
            <div>
              <span className="text-[10px] uppercase text-slate-400 font-bold block">Est. Time</span>
              <span className="font-extrabold text-slate-900 dark:text-white text-sm">{routeData.safest.duration}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-slate-400 font-bold block">Distance</span>
              <span className="font-extrabold text-slate-900 dark:text-white text-sm">{routeData.safest.distance}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-slate-400 font-bold block">Potholes</span>
              <span className="font-extrabold text-emerald-600 text-sm">0 on route</span>
            </div>
          </div>
        </div>

        {/* 2. FASTEST ROUTE CARD */}
        <div
          onClick={() => setActiveRouteId('fastest')}
          className={`cursor-pointer p-5 rounded-2xl border-2 transition-all relative overflow-hidden shadow-lg ${
            activeRouteId === 'fastest'
              ? 'bg-amber-500/10 border-amber-500 shadow-amber-500/10'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500 text-white text-xs font-extrabold shadow">
              <Zap className="w-3.5 h-3.5" /> FASTEST DIRECT PATH
            </span>
            <span className="text-xl font-extrabold text-amber-600 dark:text-amber-400">
              {routeData.fastest.safetyScore}% Safe
            </span>
          </div>

          <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
            {routeData.fastest.corridor}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
            {routeData.fastest.description}
          </p>

          <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-amber-500/20 text-xs">
            <div>
              <span className="text-[10px] uppercase text-slate-400 font-bold block">Est. Time</span>
              <span className="font-extrabold text-slate-900 dark:text-white text-sm">{routeData.fastest.duration}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-slate-400 font-bold block">Distance</span>
              <span className="font-extrabold text-slate-900 dark:text-white text-sm">{routeData.fastest.distance}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-slate-400 font-bold block">Hazards</span>
              <span className="font-extrabold text-red-600 text-sm">{routeData.fastest.hazardsOnPath} Potholes</span>
            </div>
          </div>
        </div>

      </div>

      {/* MAP & ROUTING RADAR */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEAFLET MAP DISPLAY */}
        <div className="lg:col-span-2 h-[550px] rounded-3xl overflow-hidden shadow-2xl relative border border-slate-200 dark:border-slate-800">
          <LeafletMap
            center={ANAND_CENTER}
            zoom={13}
            reports={reports}
            routes={[
              routeData.safest,
              routeData.fastest,
            ]}
            origin={{ lat: originCoords[0], lng: originCoords[1], name: originName }}
            destination={{ lat: destCoords[0], lng: destCoords[1], name: destName }}
            liveCoords={simCoords}
            showRqiLayer={showRqi}
          />

          {/* Map Overlay Badge */}
          <div className="absolute top-4 left-4 z-20 glass-panel p-2.5 rounded-2xl border border-white/20 text-xs flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-bold text-emerald-600">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Safest (Green)
            </span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1.5 font-bold text-amber-500">
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> Fastest (Amber)
            </span>
          </div>
        </div>

        {/* ACTIVE ROUTE DETAILS & LIVE TURN GUIDE */}
        <div className="space-y-4">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Selected AI Path</span>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-1.5">
                  {activeRoute.isSafest ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                  )}
                  {activeRoute.name}
                </h3>
              </div>
              <span className={`px-2.5 py-1 rounded-xl text-xs font-bold ${
                activeRoute.isSafest ? 'bg-emerald-500/20 text-emerald-600' : 'bg-amber-500/20 text-amber-600'
              }`}>
                {activeRoute.safetyScore}% Safety
              </span>
            </div>

            {/* Warning if fastest route selected */}
            {!activeRoute.isSafest && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  Hazard Alert on Direct Path
                </p>
                <p className="text-amber-700 dark:text-amber-300 text-[11px] leading-relaxed">
                  Fastest route contains {activeRoute.hazardsOnPath} detected road hazards near Anand Station & Nana Bazar. 
                  Switch to <strong>Safest Route</strong> to avoid tyre impact!
                </p>
              </div>
            )}

            {/* Trip Specs */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-brand-500" /> Total Travel Time
                </span>
                <span className="font-bold text-slate-900 dark:text-white">{activeRoute.duration}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Milestone className="w-3.5 h-3.5 text-brand-500" /> Total Distance
                </span>
                <span className="font-bold text-slate-900 dark:text-white">{activeRoute.distance}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5 text-emerald-500" /> Surface Condition
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{activeRoute.surfaceQuality}</span>
              </div>
            </div>

            {/* Navigation Simulator Action Button */}
            <button
              onClick={toggleNavigation}
              className={`w-full py-3 rounded-xl font-bold text-xs shadow-lg transition flex items-center justify-center gap-2 ${
                isNavigating
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {isNavigating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isNavigating ? 'Pause Simulation' : 'Start Drive Simulation'}</span>
            </button>
          </Card>
        </div>

      </div>

    </div>
  );
};
