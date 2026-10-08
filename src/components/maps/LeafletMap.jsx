import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { StatusBadge } from '../common/StatusBadge';
import { MapPin, AlertTriangle, ShieldCheck, Zap, Navigation } from 'lucide-react';
import { getSafeImageUrl, handleImageError } from '../../utils/imageUtils';

// Default: Center of Anand, Gujarat, India
// Note: exported as a named const from this file; consumers can import it from here
const ANAND_CENTER = [22.5645, 72.9289];
export { ANAND_CENTER };

// Dynamic Custom HTML Marker Creator for Road Hazards
const createHazardMarker = (type, severity, isNew = false) => {
  let color = '#3b82f6';
  let iconHtml = '📍';

  if (type === 'Pothole') {
    color = '#ef4444'; // Red
    iconHtml = '🕳️';
  } else if (type === 'Crack' || type === 'Alligator Crack' || type === 'Longitudinal Crack') {
    color = '#f59e0b'; // Amber
    iconHtml = '⚡';
  } else if (type === 'Accident') {
    color = '#dc2626'; // Deep Red
    iconHtml = '💥';
  } else if (type === 'Repair' || type === 'Resolved') {
    color = '#10b981'; // Emerald Green
    iconHtml = '🛠️';
  } else if (type === 'Severe Edge Erosion') {
    color = '#ec4899'; // Pink
    iconHtml = '⚠️';
  }

  const pulseRing = isNew
    ? `<span style="position: absolute; width: 48px; height: 48px; border-radius: 50%; background: ${color}; opacity: 0.5; animation: leaflet-radar-ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>`
    : '';

  const svgMarker = `
    <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
      ${pulseRing}
      <div style="
        position: relative;
        background-color: ${color};
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2.5px solid white;
        box-shadow: 0 4px 14px rgba(0,0,0,0.35);
        font-size: 15px;
        cursor: pointer;
        z-index: 2;
      ">
        ${iconHtml}
      </div>
    </div>
  `;

  return L.divIcon({
    html: svgMarker,
    className: 'custom-hazard-marker',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
};

// Route Endpoint Pin (Start / Finish)
const createEndpointMarker = (label, color = '#10b981', symbol = '📍') => {
  const html = `
    <div style="
      background-color: ${color};
      color: white;
      padding: 4px 8px;
      border-radius: 12px;
      font-weight: 800;
      font-size: 11px;
      display: flex;
      align-items: center;
      gap: 4px;
      border: 2px solid white;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      white-space: nowrap;
    ">
      <span>${symbol}</span>
      <span>${label}</span>
    </div>
  `;
  return L.divIcon({
    html,
    className: 'custom-endpoint-marker',
    iconSize: [90, 28],
    iconAnchor: [45, 14],
    popupAnchor: [0, -14],
  });
};

// Live Vehicle Position Marker
const createVehicleMarker = (heading = 0) => {
  const html = `
    <div style="
      position: relative;
      width: 34px;
      height: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <span style="position: absolute; width: 44px; height: 44px; border-radius: 50%; background: #0284c7; opacity: 0.4; animation: leaflet-radar-ping 2s infinite;"></span>
      <div style="
        width: 30px;
        height: 30px;
        background: #0284c7;
        border: 3px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(2, 132, 199, 0.5);
        color: white;
        font-size: 14px;
        transform: rotate(${heading}deg);
      ">
        🚗
      </div>
    </div>
  `;
  return L.divIcon({
    html,
    className: 'custom-vehicle-marker',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
};

// Map click listener hook component
const MapClickHandler = ({ onMapClick }) => {
  useMapEvents({
    click(e) {
      if (onMapClick) {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
  });
  return null;
};

// Map view dynamic updater
const MapViewUpdater = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center && center.length === 2 && !isNaN(center[0]) && !isNaN(center[1])) {
      map.setView(center, zoom || map.getZoom(), { animate: true });
    }
  }, [center, zoom, map]);
  return null;
};

// Map bounds dynamic updater
const MapBoundsUpdater = ({ bounds }) => {
  const map = useMap();
  useEffect(() => {
    if (bounds && Array.isArray(bounds) && bounds.length === 2 && bounds[0] && bounds[1]) {
      try {
        map.fitBounds(bounds, { padding: [45, 45], maxZoom: 15, animate: true });
      } catch (e) {}
    }
  }, [bounds, map]);
  return null;
};

export const LeafletMap = ({
  reports = [],
  center = ANAND_CENTER,
  zoom = 13,
  bounds = null,
  polyline = null,
  routes = [],
  origin = null,
  destination = null,
  liveCoords = null,
  rqiSegments = [],
  showRqiLayer = false,
  heatmapMode = false,
  heatRadius = 150,
  onMapClick = null,
  onMarkerClick = null,
  interactive = true,
  className = '',
  hideResolved = true,
}) => {
  // Filter out resolved reports from the map by default
  const activeReports = useMemo(() => {
    if (!hideResolved) return reports;
    return reports.filter(r => (r.status || '').toLowerCase() !== 'resolved');
  }, [reports, hideResolved]);

  return (
    <div className={`w-full h-full min-h-[420px] rounded-2xl overflow-hidden shadow-inner border border-slate-200 dark:border-slate-800 relative z-10 ${className}`}>
      <style>{`
        @keyframes leaflet-radar-ping {
          0% { transform: scale(0.8); opacity: 0.8; }
          70% { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.8); opacity: 0; }
        }
      `}</style>

      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={interactive}
        dragging={interactive}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | SafeRoad AI Anand, Gujarat'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Dynamic Map Controller */}
        <MapViewUpdater center={center} zoom={zoom} />
        {bounds && <MapBoundsUpdater bounds={bounds} />}

        {/* Map Click Listener */}
        {onMapClick && <MapClickHandler onMapClick={onMapClick} />}

        {/* RQI Road Segments Layer */}
        {showRqiLayer &&
          rqiSegments.map((seg) => {
            const isGood = seg.rqiScore >= 80;
            const isFair = seg.rqiScore >= 50 && seg.rqiScore < 80;
            const color = isGood ? '#10b981' : isFair ? '#eab308' : '#ef4444';
            return (
              <Polyline
                key={seg.id}
                positions={[
                  [seg.lat1, seg.lng1],
                  [seg.lat2, seg.lng2],
                ]}
                color={color}
                weight={7}
                opacity={0.75}
              >
                <Tooltip sticky>
                  <div className="text-xs p-1">
                    <p className="font-bold">{seg.name}</p>
                    <p>RQI Score: <strong style={{ color }}>{seg.rqiScore}/100 ({seg.status})</strong></p>
                  </div>
                </Tooltip>
              </Polyline>
            );
          })}

        {/* Backwards-compatible single polyline */}
        {polyline && !routes.length && (
          <Polyline
            positions={polyline}
            color="#10b981"
            weight={6}
            opacity={0.85}
          />
        )}

        {/* Multi-Route Display: Fastest vs Safest Route */}
        {routes.map((route, idx) => (
          <Polyline
            key={route.id || `route-${idx}`}
            positions={route.positions}
            color={route.color || (route.isSafest ? '#10b981' : '#f59e0b')}
            weight={route.weight || (route.isSafest ? 6 : 5)}
            opacity={route.opacity || 0.85}
            dashArray={route.dashArray || (route.isSafest ? null : '6, 8')}
          >
            <Tooltip sticky>
              <div className="text-xs p-1 space-y-1">
                <p className="font-extrabold flex items-center gap-1">
                  {route.isSafest ? (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> {route.name || 'Safest Route'}
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5" /> {route.name || 'Fastest Route'}
                    </span>
                  )}
                </p>
                <div className="text-[11px] text-slate-600">
                  <span>ETA: <strong>{route.duration || 'N/A'}</strong> | Distance: <strong>{route.distance || 'N/A'}</strong></span>
                </div>
                {route.safetyScore && (
                  <p className="text-[11px]">Safety Score: <strong>{route.safetyScore}%</strong></p>
                )}
                {route.hazardsOnPath !== undefined && (
                  <p className="text-[11px] text-red-600 font-semibold">
                    Hazards Encountered: {route.hazardsOnPath}
                  </p>
                )}
              </div>
            </Tooltip>
          </Polyline>
        ))}

        {/* Origin Marker */}
        {origin && origin.lat && origin.lng && (
          <Marker
            position={[origin.lat, origin.lng]}
            icon={createEndpointMarker(origin.name || 'Start', '#10b981', '🟢')}
          />
        )}

        {/* Destination Marker */}
        {destination && destination.lat && destination.lng && (
          <Marker
            position={[destination.lat, destination.lng]}
            icon={createEndpointMarker(destination.name || 'End', '#ef4444', '🏁')}
          />
        )}

        {/* Live Car / Telemetry Marker */}
        {liveCoords && liveCoords.lat && liveCoords.lng && (
          <Marker
            position={[liveCoords.lat, liveCoords.lng]}
            icon={createVehicleMarker(liveCoords.heading || 0)}
          >
            <Popup>
              <div className="text-xs font-bold p-1">
                🚗 Live Vehicle Position (Anand, Gujarat)
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                  {liveCoords.lat.toFixed(5)}° N, {liveCoords.lng.toFixed(5)}° E
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Heatmap density glow circles */}
        {heatmapMode &&
          activeReports.map((report) => {
            if (!report.lat || !report.lng) return null;
            const isCrit = report.severity === 'Critical';
            const isHigh = report.severity === 'High';
            const color = isCrit ? '#ef4444' : isHigh ? '#f97316' : '#eab308';
            const radius = isCrit ? heatRadius * 1.6 : isHigh ? heatRadius * 1.2 : heatRadius;
            return (
              <Circle
                key={`heat-${report.id || `${report.lat}-${report.lng}`}`}
                center={[report.lat, report.lng]}
                radius={radius}
                pathOptions={{
                  fillColor: color,
                  fillOpacity: isCrit ? 0.45 : isHigh ? 0.35 : 0.22,
                  color: color,
                  weight: 1.5,
                  opacity: 0.6,
                }}
              >
                <Tooltip sticky>
                  <div className="text-xs p-1">
                    <p className="font-extrabold" style={{ color }}>{report.type} ({report.severity})</p>
                    <p className="text-slate-700 font-semibold">{report.locationName || 'Hazard Location'}</p>
                    <p className="text-[10px] text-slate-500">Priority Score: {report.priorityScore || 80}/100</p>
                  </div>
                </Tooltip>
              </Circle>
            );
          })}

        {/* Pothole & Road Hazard Markers */}
        {activeReports.map((report) => (
          <Marker
            key={report.id || `rep-${report.lat}-${report.lng}`}
            position={[report.lat, report.lng]}
            icon={createHazardMarker(report.type, report.severity, report.isNew || report.justDetected)}
            eventHandlers={onMarkerClick ? {
              click: () => onMarkerClick(report),
            } : {}}
          >
            <Popup className="custom-popup">
              <div className="p-1 max-w-xs space-y-2 text-slate-800">
                {report.image && (
                  <div className="relative h-28 w-full rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <img
                      src={getSafeImageUrl(report.image, report.type)}
                      alt={report.type}
                      onError={(e) => handleImageError(e, report.type)}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2">
                      <StatusBadge status={report.severity || report.status} />
                    </div>
                  </div>
                )}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      {report.type}
                    </h4>
                    <span className="text-[10px] font-bold text-slate-500">{report.id}</span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-brand-600" /> {report.locationName || 'Anand, Gujarat'}
                  </p>
                  <p className="text-xs text-slate-500 line-clamp-2">{report.description}</p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                  <span>{report.depthCm ? `Depth: ${report.depthCm} cm` : (report.date || 'Today')}</span>
                  <span className="font-semibold text-brand-600">Conf: {report.aiConfidence || '95%'}</span>
                </div>
                {onMarkerClick && (
                  <button
                    onClick={() => onMarkerClick(report)}
                    className="w-full mt-1 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[11px] font-bold transition"
                  >
                    View Full Details →
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};
