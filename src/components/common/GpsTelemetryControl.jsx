import React, { useState, useEffect } from 'react';
import { Card } from './Card';
import {
  Navigation,
  Compass,
  Zap,
  Radio,
  MapPin,
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  AlertOctagon
} from 'lucide-react';

export const GpsTelemetryControl = ({ onCoordsUpdate, compact = false }) => {
  const [isSimulating, setIsSimulating] = useState(false);
  const [speed, setSpeed] = useState(45);
  const [heading, setHeading] = useState(185);
  const [coords, setCoords] = useState({ lat: 22.5645, lng: 72.9289, accuracy: 3.2 });
  const [satellites, setSatellites] = useState(14);
  const [geofenceAlert, setGeofenceAlert] = useState(false);

  // Simulation effect
  useEffect(() => {
    let interval;
    if (isSimulating) {
      interval = setInterval(() => {
        setCoords((prev) => {
          const deltaLat = (Math.random() - 0.48) * 0.0008;
          const deltaLng = (Math.random() - 0.48) * 0.0008;
          const newCoords = {
            lat: prev.lat + deltaLat,
            lng: prev.lng + deltaLng,
            accuracy: +(3 + Math.random() * 1.5).toFixed(1)
          };
          if (onCoordsUpdate) onCoordsUpdate(newCoords);
          return newCoords;
        });

        setSpeed(prev => Math.max(15, Math.min(85, +(prev + (Math.random() - 0.5) * 4).toFixed(1))));
        setHeading(prev => (prev + (Math.random() - 0.5) * 5 + 360) % 360);

        // Random trigger geofence alert
        if (Math.random() > 0.85) {
          setGeofenceAlert(true);
          setTimeout(() => setGeofenceAlert(false), 3000);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isSimulating, onCoordsUpdate]);

  const handleFetchCurrentGps = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newCoords = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy ? +pos.coords.accuracy.toFixed(1) : 4.0
          };
          setCoords(newCoords);
          if (onCoordsUpdate) onCoordsUpdate(newCoords);
        },
        () => {
          // Fallback if denied
          setCoords({ lat: 22.5645, lng: 72.9289, accuracy: 5.0 });
        }
      );
    }
  };

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-2xl glass-panel text-xs">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <span className="font-extrabold text-slate-900 dark:text-white">GPS Lock</span>
        </div>

        <div className="px-2 py-0.5 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold">
          {speed} km/h
        </div>

        <button
          onClick={() => setIsSimulating(!isSimulating)}
          className="ml-auto px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 font-bold text-[11px] hover:bg-brand-600 hover:text-white transition"
        >
          {isSimulating ? 'Pause GPS Drive' : 'Simulate Drive'}
        </button>
      </div>
    );
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 dark:text-white text-base">GPS Location & Telemetry</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">High-precision GNSS positioning & speed tracking</p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20">
          <CheckCircle className="w-3.5 h-3.5" /> GNSS Lock (±{coords.accuracy}m)
        </span>
      </div>

      {geofenceAlert && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-bold flex items-center justify-between animate-bounce">
          <span className="flex items-center gap-2">
            <AlertOctagon className="w-4 h-4" /> GEOFENCE ALERT: High hazard density zone detected ahead!
          </span>
          <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded uppercase">Slow Down</span>
        </div>
      )}

      {/* GPS Telemetry Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Latitude</span>
          <span className="font-mono font-extrabold text-slate-900 dark:text-white text-sm">{coords.lat.toFixed(5)}° N</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Longitude</span>
          <span className="font-mono font-extrabold text-slate-900 dark:text-white text-sm">{coords.lng.toFixed(5)}° E</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Current Speed</span>
          <span className="font-extrabold text-brand-600 dark:text-brand-400 text-sm flex items-center gap-1">
            <Zap className="w-4 h-4" /> {speed} km/h
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Satellites Locked</span>
          <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-1">
            <Compass className="w-4 h-4" /> {satellites} Active
          </span>
        </div>
      </div>

      {/* Simulator Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSimulating(!isSimulating)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition shadow ${
              isSimulating ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
          >
            {isSimulating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isSimulating ? 'Pause Drive Simulator' : 'Start Live Drive Simulator'}
          </button>

          <button
            onClick={handleFetchCurrentGps}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl glass-panel border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <MapPin className="w-3.5 h-3.5 text-brand-500" /> Lock Device GPS
          </button>
        </div>

        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
          Status: {isSimulating ? '🚗 Active Driving Telemetry Streaming' : '📍 Static Geolocation Mode'}
        </div>
      </div>
    </Card>
  );
};
