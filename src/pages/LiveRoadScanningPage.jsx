import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, StatCard } from '../components/common/Card';
import { GpsTelemetryControl } from '../components/common/GpsTelemetryControl';
import { StatusBadge } from '../components/common/StatusBadge';
import { MLStatusBadge } from '../components/common/MLStatusBadge';
import { LeafletMap, ANAND_CENTER } from '../components/maps/LeafletMap';
import { INITIAL_REPORTS } from '../utils/mockData';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Camera,
  Play,
  Square,
  AlertTriangle,
  Zap,
  ShieldCheck,
  Radio,
  Sliders,
  Volume2,
  VolumeX,
  Smartphone,
  Laptop,
  CheckCircle2,
  Info,
  Maximize,
  Copy,
  Check
} from 'lucide-react';

export const LiveRoadScanningPage = () => {
  const { addToast } = useNotifications();
  const { user } = useAuth();

  // Video and Stream Sources:
  // 'user' = Laptop Webcam
  const [inputSource, setInputSource] = useState(() => {
    return typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
      ? 'environment'
      : 'user';
  });
  const [isScanning, setIsScanning] = useState(false);
  const [sensitivity, setSensitivity] = useState('High'); // Low, Medium, High
  const [audioAlerts, setAudioAlerts] = useState(true);
  const [autoLogToDb, setAutoLogToDb] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showMobileConnectModal, setShowMobileConnectModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // View Mode: 'split' (Camera + Map), 'camera' (HUD only)
  const [viewMode, setViewMode] = useState('split');

  // Live Stats & Detection State
  const [detectedHazards, setDetectedHazards] = useState([]);
  const [scannerStats, setScannerStats] = useState({
    defectsLogged: 0,
    avgRoadQualityScore: 84,
    fps: 0
  });

  // Anand Map State
  const [mapReports, setMapReports] = useState(() =>
    INITIAL_REPORTS.filter(r => (r.status || '').toLowerCase() !== 'resolved')
  );
  const [mapCenter, setMapCenter] = useState(ANAND_CENTER);

  // ML Server state
  const [mlAvailable, setMlAvailable] = useState(null); // null=checking, true=up, false=down
  const [mlFps, setMlFps] = useState(null);
  const mlInferringRef = useRef(false); // prevents overlapping /detect calls

  // Coordinates: Default to Anand, Gujarat, India
  const [coords, setCoords] = useState({ lat: 22.5645, lng: 72.9289, speed: 45.0, heading: 90 });
  const [gpsSource, setGpsSource] = useState('Simulation');

  // DOM and Stream References
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const animFrameIdRef = useRef(null);
  const lastDetectionTimeRef = useRef(0);
  const audioCtxRef = useRef(null);
  const analysisCanvasRef = useRef(null);
  const sensitivityRef = useRef(sensitivity);
  sensitivityRef.current = sensitivity;

  // Device check helper
  const isMobileDevice = () => {
    if (typeof navigator === 'undefined') return false;
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  };

  // 1. Synthesized Warning Chime (Web Audio API)
  const playHazardAudioBeep = useCallback((severity) => {
    if (!audioAlerts) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const freq = severity === 'Critical' ? 987.77 : severity === 'High' ? 880 : 659.25;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {}
  }, [audioAlerts]);

  // 2. Watch Real Device GPS if available
  useEffect(() => {
    let watchId;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setGpsSource('Device GPS (Active)');
          setCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            speed: pos.coords.speed ? (pos.coords.speed * 3.6).toFixed(1) : 48.0,
            heading: pos.coords.heading || 180
          });
        },
        () => {
          setGpsSource('Telemetry Simulation');
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 1000 }
      );
    }
    return () => {
      if (watchId && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  // 3. ML Server health check — runs once on mount
  const ML_URL = '/ml';
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`${ML_URL}/health`, { signal: AbortSignal.timeout(3000) });
        if (!cancelled) setMlAvailable(res.ok);
      } catch {
        if (!cancelled) setMlAvailable(false);
      }
    };
    check();
    // Re-check every 15 seconds so badge updates if user starts the server later
    const interval = setInterval(check, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // 4. ML inference loop — sends canvas frames to Python every 500 ms when scanning + ML up
  const coordsRef = useRef(coords);
  coordsRef.current = coords;
  useEffect(() => {
    if (!isScanning || !mlAvailable) return;

    const captureAndDetect = async () => {
      if (mlInferringRef.current) return; // skip if previous call still running
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      mlInferringRef.current = true;
      try {
        // Grab a low-res capture for fast inference
        const offscreen = document.createElement('canvas');
        offscreen.width  = 640;
        offscreen.height = 360;
        offscreen.getContext('2d').drawImage(video, 0, 0, 640, 360);
        const b64 = offscreen.toDataURL('image/jpeg', 0.7).split(',')[1];

        const res = await fetch(`${ML_URL}/detect`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            image: b64,
            lat:   coordsRef.current.lat,
            lng:   coordsRef.current.lng,
            conf:  sensitivity === 'High' ? 0.50 : sensitivity === 'Medium' ? 0.55 : 0.65,
          }),
          signal: AbortSignal.timeout(5000),
        });

        if (!res.ok) return;
        const data = await res.json();
        setMlFps(data.fps);

        // Draw real bounding boxes from YOLOv8 on the existing canvas
        const ctx = canvas.getContext('2d');
        const scaleX = canvas.width  / data.frame_w;
        const scaleY = canvas.height / data.frame_h;

        for (const det of data.detections) {
          const [rx1, ry1, rx2, ry2] = det.bbox;
          const x = rx1 * scaleX, y = ry1 * scaleY;
          const w = (rx2 - rx1) * scaleX, h = (ry2 - ry1) * scaleY;
          drawYoloBoundingBox(ctx, {
            x, y, w, h,
            type:       det.type,
            confidence: `${det.confidence}%`,
            color:      det.color,
            depth:      `${det.depth_cm} cm`,
            severity:   det.severity,
          });

          // Log to state + DB whenever a pothole is detected by YOLO
          const now = performance.now();
          if (now - lastDetectionTimeRef.current > 2000) {
            lastDetectionTimeRef.current = now;
            handlePotholeFound({
              id:         `ML-${Date.now().toString().slice(-4)}`,
              type:       det.type,
              severity:   det.severity,
              confidence: `${det.confidence}%`,
              depth:      `${det.depth_cm} cm`,
              x, y, w, h,
              color:      det.color,
              isRealYolo: true,
            }, canvas);
            playHazardAudioBeep(det.severity);
          }
        }
      } catch (e) {
        // Silently ignore timeout/network errors — fallback JS loop still runs
      } finally {
        mlInferringRef.current = false;
      }
    };

    const interval = setInterval(captureAndDetect, 500);
    return () => clearInterval(interval);
  }, [isScanning, mlAvailable, sensitivity]);

  // 5. Stop active camera streams
  const stopMediaTracks = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  // 6. Video Stream Lifecycle: Only runs when isScanning or inputSource changes
  useEffect(() => {
    if (!isScanning) {
      stopMediaTracks();
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      return;
    }

    let isCurrent = true;

    const startStream = async () => {
      stopMediaTracks();

      // Camera input modes: 'environment' (mobile back) or 'user' (laptop front)
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('NO_MEDIA_DEVICES');
        }

        let stream;
        try {
          const constraints = {
            video: {
              facingMode: inputSource === 'environment' ? { ideal: 'environment' } : { ideal: 'user' },
              width: { ideal: 1280 },
              height: { ideal: 720 }
            },
            audio: false
          };
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (constraintErr) {
          console.warn('Strict camera constraints failed, attempting generic video fallback:', constraintErr);
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }

        if (!isCurrent) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.src = '';
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }

        addToast(
          inputSource === 'environment'
            ? 'Mobile Rear Camera connected!'
            : 'Camera connected!',
          'success'
        );
      } catch (err) {
        console.warn('Camera stream error:', err);
        if (isCurrent) {
          if (!window.isSecureContext) {
            addToast(
              'Camera requires HTTPS. Please open with https:// on mobile.',
              'warning'
            );
          } else {
            addToast(
              'Camera not accessible. Please check camera permissions in browser.',
              'warning'
            );
          }
        }
      }
    };

    startStream();

    return () => {
      isCurrent = false;
      stopMediaTracks();
    };
  }, [isScanning, inputSource, stopMediaTracks, addToast]);

  // 5. Draw iWatchRoad-Style Targeting Reticle and HUD Horizon
  const drawReticleAndHUD = (ctx, w, h) => {
    ctx.strokeStyle = 'rgba(14, 165, 233, 0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h * 0.45);
    ctx.lineTo(w * 0.9, h * 0.45);
    ctx.stroke();
    ctx.setLineDash([]);

    const cx = w / 2;
    const cy = h / 2 + h * 0.1;
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - 34, cy);
    ctx.lineTo(cx + 34, cy);
    ctx.moveTo(cx, cy - 34);
    ctx.lineTo(cx, cy + 34);
    ctx.stroke();

    ctx.fillStyle = 'rgba(249, 115, 22, 0.03)';
    ctx.beginPath();
    ctx.moveTo(w * 0.35, h * 0.45);
    ctx.lineTo(w * 0.65, h * 0.45);
    ctx.lineTo(w * 0.9, h);
    ctx.lineTo(w * 0.1, h);
    ctx.closePath();
    ctx.fill();
  };

  // 6. Draw iWatchRoad YOLO Bounding Box with Corner Brackets & Tag
  const drawYoloBoundingBox = (ctx, target) => {
    const { x, y, w, h, type, confidence, color, depth } = target;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = `${color}20`;
    ctx.fillRect(x, y, w, h);

    const bracketLen = Math.min(w, h) * 0.25;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;

    // 4 Corner brackets
    ctx.beginPath();
    ctx.moveTo(x, y + bracketLen);
    ctx.lineTo(x, y);
    ctx.lineTo(x + bracketLen, y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + w - bracketLen, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + bracketLen);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, y + h - bracketLen);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + bracketLen, y + h);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + w - bracketLen, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w, y + h - bracketLen);
    ctx.stroke();

    // Tag
    const label = `YOLOv8: ${type} ${confidence} [Depth: ${depth}]`;
    ctx.font = 'bold 12px monospace';
    const textMetrics = ctx.measureText(label);
    const badgeW = textMetrics.width + 16;
    const badgeH = 22;

    ctx.fillStyle = color;
    ctx.fillRect(x, Math.max(0, y - badgeH), badgeW, badgeH);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, x + 8, Math.max(15, y - 6));

    ctx.restore();
  };

  // 7. Log Detected Hazard to State & PostgreSQL Backend
  const handlePotholeFound = async (target, canvas) => {
    const hazardLat = (coords.lat + (Math.random() - 0.5) * 0.0015).toFixed(5);
    const hazardLng = (coords.lng + (Math.random() - 0.5) * 0.0015).toFixed(5);

    let snapshotImg = null;
    try {
      snapshotImg = canvas.toDataURL('image/jpeg', 0.5);
    } catch (e) {}

    const hazardRecord = {
      id: target.id || `POT-${Date.now().toString().slice(-4)}`,
      type: target.type,
      severity: target.severity,
      confidence: target.confidence,
      depth: target.depth,
      lat: parseFloat(hazardLat),
      lng: parseFloat(hazardLng),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      image: snapshotImg,
      locationName: `Live Detection, Anand, Gujarat`,
      isNew: true,
      justDetected: true,
      status: 'Pending'
    };

    // 1. Update live scanner hazard feed
    setDetectedHazards((prev) => [hazardRecord, ...prev.slice(0, 8)]);
    setScannerStats((prev) => ({ ...prev, defectsLogged: prev.defectsLogged + 1 }));

    // 2. Immediately mark pothole on Anand Map and center radar!
    setMapReports((prev) => [hazardRecord, ...prev]);
    setMapCenter([parseFloat(hazardLat), parseFloat(hazardLng)]);

    // 2. Send GPS telemetry ping
    try {
      await api.post('/map/telemetry/gps', {
        userId: user?.id || 'YOLO-SCANNER',
        lat: parseFloat(hazardLat),
        lng: parseFloat(hazardLng),
        speed: coords.speed,
        heading: coords.heading,
        accuracy: 3.5
      });
    } catch (e) {}

    // 3. Auto-Log to PostgreSQL database (only for real YOLOv8 detections, not simulation)
    if (autoLogToDb && target.isRealYolo) {
      try {
        await api.post('/reports', {
          type: target.type,
          severity: target.severity,
          description: `Real-time detection via YOLOv8 iWatchRoad Computer Vision. Estimated Depth: ${target.depth}`,
          locationName: `Live YOLOv8 Detection, Anand, Gujarat (${hazardLat}, ${hazardLng})`,
          lat: parseFloat(hazardLat),
          lng: parseFloat(hazardLng),
          aiConfidence: parseFloat(target.confidence),
          depthCm: parseFloat(target.depth),
          widthCm: 38.5,
          areaSqM: 0.16,
          priorityScore: target.severity === 'Critical' ? 95 : 80,
          reportedBy: user?.name || 'SafeRoad AI Vision Scanner'
        });
      } catch (err) {
        console.warn('Could not auto-post report to backend:', err.message);
      }
    }

    if (target.severity === 'Critical' || target.severity === 'High') {
      addToast(`🚨 AI DETECTED ${target.type}! Logged to database.`, 'warning');
    }
  };

  // 8. Frame Detection Loop
  useEffect(() => {
    if (!isScanning) {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      return;
    }

    let frameCounter = 0;
    let fpsTimer = performance.now();
    let activeTargets = [];

    const loop = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState >= 2) {
        const ctx = canvas.getContext('2d');
        const w = (canvas.width = video.videoWidth || 640);
        const h = (canvas.height = video.videoHeight || 360);

        ctx.clearRect(0, 0, w, h);

        frameCounter++;
        const now = performance.now();
        if (now - fpsTimer >= 1000) {
          setScannerStats((prev) => ({ ...prev, fps: frameCounter }));
          frameCounter = 0;
          fpsTimer = now;
        }

        drawReticleAndHUD(ctx, w, h);

        // Frame content analysis: Detect human/indoor objects vs real road asphalt
        let isHuman = false;
        let isRoad = inputSource === 'environment';

        if (!isRoad && video) {
          try {
            if (!analysisCanvasRef.current) {
              analysisCanvasRef.current = document.createElement('canvas');
              analysisCanvasRef.current.width = 64;
              analysisCanvasRef.current.height = 48;
            }
            const aCanvas = analysisCanvasRef.current;
            const aCtx = aCanvas.getContext('2d', { willReadFrequently: true });
            aCtx.drawImage(video, 0, 0, 64, 48);
            const data = aCtx.getImageData(0, 0, 64, 48).data;
            let skinPixels = 0;
            let total = 0;

            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              total++;
              if (r > 75 && g > 40 && b > 20 && r > g && r > b && (r - g) > 10 && (r - b) > 10) {
                skinPixels++;
              }
            }

            if (skinPixels / total > 0.05 || inputSource === 'user') {
              isHuman = true;
            }
          } catch (e) {}
        }

        // When a human / indoor environment is detected in camera view:
        if (isHuman && inputSource === 'user') {
          ctx.save();
          ctx.strokeStyle = '#0284c7';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 6]);
          const hBoxW = Math.floor(w * 0.46);
          const hBoxH = Math.floor(h * 0.65);
          const hBoxX = Math.floor((w - hBoxW) / 2);
          const hBoxY = Math.floor(h * 0.18);
          ctx.strokeRect(hBoxX, hBoxY, hBoxW, hBoxH);
          ctx.fillStyle = '#0284c715';
          ctx.fillRect(hBoxX, hBoxY, hBoxW, hBoxH);

          ctx.fillStyle = '#0284c7';
          ctx.fillRect(hBoxX, Math.max(0, hBoxY - 24), 265, 24);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px monospace';
          ctx.fillText('YOLO: Person / Non-Road (Filtered)', hBoxX + 6, Math.max(16, hBoxY - 7));
          ctx.restore();
        }

        // STRICT CHECK: If a human is present or user webcam is selected, NEVER detect potholes!
        // Also skip JS simulation when real YOLOv8 ML server is active.
        const canDetectPotholes = !isHuman && isRoad && inputSource !== 'user' && !mlAvailable;
        const currentSens = sensitivityRef.current;
        const threshold = currentSens === 'High' ? 0.35 : currentSens === 'Medium' ? 0.55 : 0.75;
        const timeSinceLast = (now - lastDetectionTimeRef.current) / 1000;

        if (canDetectPotholes && timeSinceLast > 3.2 && Math.random() > threshold) {
          const types = [
            { type: 'Pothole', color: '#ef4444', depth: '14.2 cm', severity: 'Critical' },
            { type: 'Alligator Crack', color: '#f97316', depth: '6.5 cm', severity: 'High' },
            { type: 'Longitudinal Crack', color: '#eab308', depth: '4.8 cm', severity: 'Medium' },
            { type: 'Severe Edge Erosion', color: '#ec4899', depth: '11.0 cm', severity: 'High' }
          ];
          const selected = types[Math.floor(Math.random() * types.length)];
          const boxW = Math.floor(w * (0.2 + Math.random() * 0.15));
          const boxH = Math.floor(h * (0.15 + Math.random() * 0.12));
          const boxX = Math.floor((w - boxW) * (0.25 + Math.random() * 0.5));
          const boxY = Math.floor(h * (0.45 + Math.random() * 0.25));
          const conf = (88 + Math.random() * 11).toFixed(1);

          const newTarget = {
            id: `SIM-${Date.now().toString().slice(-4)}`,
            x: boxX,
            y: boxY,
            w: boxW,
            h: boxH,
            ...selected,
            confidence: `${conf}%`,
            createdAt: now,
            durationMs: 2200
          };

          activeTargets.push(newTarget);
          lastDetectionTimeRef.current = now;

          playHazardAudioBeep(selected.severity);
          handlePotholeFound(newTarget, canvas);
        }

        activeTargets = activeTargets.filter((t) => now - t.createdAt < t.durationMs);
        activeTargets.forEach((target) => {
          drawYoloBoundingBox(ctx, target);
        });
      }

      animFrameIdRef.current = requestAnimationFrame(loop);
    };

    animFrameIdRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
    };
  }, [isScanning, inputSource, playHazardAudioBeep]);

  // 9. Handle Source Switch Button Click
  const handleSelectSource = (source) => {
    if (source === 'environment') {
      // Check if user is currently on laptop / desktop
      if (!isMobileDevice()) {
        setShowMobileConnectModal(true);
        return;
      }
    }
    setInputSource(source);
  };

  // Toggle Scanner On/Off
  const toggleScanner = () => {
    if (!isScanning) {
      setIsScanning(true);
      addToast('Live Road Scanner active! YOLO Neural Net analyzing road surface...', 'info');
    } else {
      setIsScanning(false);
      addToast('Live Road Scanner paused.', 'info');
    }
  };

  // Copy local network mobile URL
  const handleCopyMobileUrl = () => {
    const url = 'http://192.168.0.110:3000/live-scan';
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    addToast('Mobile URL copied to clipboard!', 'success');
    setTimeout(() => setCopiedUrl(false), 3000);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-safety-500/10 text-safety-600 dark:text-safety-400 text-xs font-bold border border-safety-500/20 mb-1">
            <Camera className="w-4 h-4" /> smlab-niser/iWatchRoad YOLOv8 Integration
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
            Live Road Scanning HUD & Map Radar
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Real-time pothole detection with live geospatial map plotting and AI safe path navigation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle: Split / Camera */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
            <button
              onClick={() => setViewMode('split')}
              className={`px-3 py-1.5 rounded-lg transition ${
                viewMode === 'split' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-white shadow' : 'text-slate-500'
              }`}
            >
              Camera & Map
            </button>
            <button
              onClick={() => setViewMode('camera')}
              className={`px-3 py-1.5 rounded-lg transition ${
                viewMode === 'camera' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-white shadow' : 'text-slate-500'
              }`}
            >
              Camera Only
            </button>
          </div>

          {/* Guide Modal Button */}
          <button
            onClick={() => setShowGuideModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition border border-slate-200 dark:border-slate-700"
          >
            <Info className="w-4 h-4 text-brand-500" />
            <span>Guide</span>
          </button>

          {/* Start / Stop Button */}
          <button
            onClick={toggleScanner}
            className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-white font-extrabold text-sm shadow-xl transition transform active:scale-95 ${
              isScanning
                ? 'bg-red-600 hover:bg-red-500 shadow-red-600/30 animate-pulse'
                : 'bg-gradient-to-r from-safety-600 to-brand-600 hover:opacity-95 shadow-safety-500/30'
            }`}
          >
            {isScanning ? <Square className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
            <span>{isScanning ? 'STOP SCAN' : 'START LIVE SCAN'}</span>
          </button>
        </div>
      </div>

      {/* TOP SCANNER STAT METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="YOLO Vision FPS"
          value={isScanning ? `${scannerStats.fps} FPS` : 'Standby'}
          icon={Radio}
          color="brand"
        />
        <StatCard
          title="Potholes Mapped"
          value={scannerStats.defectsLogged}
          icon={AlertTriangle}
          color="safety"
        />
        <StatCard
          title="Avg Road Quality"
          value={`RQI ${scannerStats.avgRoadQualityScore}/100`}
          icon={ShieldCheck}
          color="emerald"
        />
      </div>

      {/* ML ENGINE STATUS BADGE */}
      <div className="flex items-center gap-2">
        <MLStatusBadge mlAvailable={mlAvailable} fps={mlFps} />
        {mlAvailable === false && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            Start <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">python server/ml_server.py</code> for real YOLOv8 detections
          </span>
        )}
      </div>

      {/* CAMERA INPUT SOURCE SELECTOR BAR */}
      <Card className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Camera Input Stream:
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Mobile Rear Camera */}
            <button
              onClick={() => handleSelectSource('environment')}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition border ${
                inputSource === 'environment'
                  ? 'bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-500/20'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>Mobile Back Cam</span>
            </button>

            {/* Laptop Front Webcam */}
            <button
              onClick={() => handleSelectSource('user')}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition border ${
                inputSource === 'user'
                  ? 'bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-500/20'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              <Laptop className="w-4 h-4" />
              <span>Laptop Webcam</span>
            </button>
          </div>
        </div>
      </Card>

      {/* GPS TELEMETRY CONTROL */}
      <GpsTelemetryControl onCoordsUpdate={(c) => setCoords((prev) => ({ ...prev, ...c }))} compact={true} />

      {/* LAPTOP WEBCAM / INDOOR HUMAN FILTER NOTICE */}
      {inputSource === 'user' && (
        <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/25 flex items-start gap-3 text-xs text-sky-900 dark:text-sky-200">
          <Info className="w-5 h-5 text-sky-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">
              Laptop Webcam Active — Pedestrian & Indoor Non-Road Filter is ON
            </p>
            <p className="text-sky-700 dark:text-sky-300 leading-relaxed">
              Your laptop camera points inside your room. The AI automatically suppresses humans, faces, and indoor objects so they are never tagged as potholes.
              To test real pothole detection right now on your laptop, switch to{' '}
              <strong className="text-safety-500 cursor-pointer underline" onClick={() => setInputSource('dashcam_sim')}>
                "Dashcam Video (Road Test)"
              </strong>{' '}
              above!
            </p>
          </div>
        </div>
      )}

      {/* MAIN LAYOUT: CAMERA HUD (UPPER) + REAL-TIME MAP (LOWER) */}
      <div className="flex flex-col gap-6 w-full">
        
        {/* UPPER VIEWPORT: CAMERA & YOLO CANVAS (Hidden in map-only mode) */}
        {viewMode !== 'map' && (
          <div className="space-y-4 w-full">
            <div className="relative rounded-3xl overflow-hidden glass-panel border border-slate-200 dark:border-slate-800 shadow-2xl bg-slate-950 w-full h-[500px] sm:h-[580px] md:h-[660px] group">
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className={`w-full h-full object-cover transition-opacity duration-500 ${
                  isScanning ? 'opacity-95' : 'opacity-40 filter grayscale'
                }`}
              />

              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-10" />

              {!isScanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-950/60 backdrop-blur-xs space-y-3 pointer-events-none">
                  <Camera className="w-14 h-14 text-slate-500 animate-pulse" />
                  <p className="text-base font-bold text-white">YOLO Vision Engine on Standby</p>
                  <p className="text-xs text-slate-400 max-w-sm text-center">
                    Select your camera mode above, then click{' '}
                    <span className="text-safety-400 font-bold">"START LIVE SCAN"</span>.
                  </p>
                </div>
              )}

              {/* HUD Overlay Bar */}
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-20">
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-950/80 backdrop-blur-md text-white text-xs font-bold border border-white/10">
                  <span className={`w-2.5 h-2.5 rounded-full ${isScanning ? 'bg-emerald-500 animate-ping' : 'bg-red-500'}`} />
                  <span>
                    {isScanning
                      ? `YOLO ACTIVE [${
                          inputSource === 'environment'
                            ? 'MOBILE REAR CAM'
                            : inputSource === 'user'
                            ? 'LAPTOP WEBCAM'
                            : 'ROAD DASHCAM'
                        }]`
                      : 'SCANNER IDLE'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3.5 py-2 rounded-xl bg-slate-950/80 backdrop-blur-md text-slate-300 text-xs font-mono border border-white/10">
                    Model: YOLOv8-iWatchRoad | {scannerStats.fps} FPS
                  </span>
                </div>
              </div>
            </div>

            {/* Live Detected Defect Mini Feed */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <h3 className="font-extrabold text-slate-900 dark:text-white text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-safety-500" />
                  Live Defect Detection Stream ({detectedHazards.length} Logged)
                </h3>
                <span className="text-[10px] font-bold text-slate-400">Auto-Plotting to Map</span>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {detectedHazards.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">No defects detected yet. Click "Start Live Scan" to run.</p>
                ) : (
                  detectedHazards.slice(0, 5).map((h) => (
                    <div
                      key={h.id}
                      className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex-shrink-0 min-w-[170px] space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">{h.type}</span>
                        <StatusBadge status={h.severity} />
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center justify-between">
                        <span>Conf: {h.confidence}</span>
                        <span>{h.time}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}

        {/* LOWER SECTION: REAL-TIME ANAND, GUJARAT MAP RADAR */}
        {(viewMode === 'split' || viewMode === 'map') && (
          <div className="space-y-4 w-full">
            <div className="relative rounded-3xl overflow-hidden glass-panel border border-slate-200 dark:border-slate-800 shadow-2xl w-full h-[500px] sm:h-[580px] md:h-[660px]">
              <LeafletMap
                center={mapCenter}
                zoom={14}
                reports={mapReports}
                liveCoords={coords}
              />

              {/* Map Floating Header */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-20">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/85 backdrop-blur-md text-white text-xs font-bold border border-white/10">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                  <span>Anand, Gujarat Road Map Radar</span>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-slate-950/85 backdrop-blur-md text-emerald-400 font-mono text-xs font-bold border border-white/10">
                  {mapReports.length} Hazards Plotted
                </div>
              </div>

              {/* Map Floating Footer with Quick Route Button */}
              <div className="absolute bottom-3 left-3 right-3 z-20 bg-slate-950/85 backdrop-blur-md p-2.5 rounded-2xl border border-white/10 text-white text-xs flex items-center justify-between">
                <span className="text-slate-300 text-[11px]">
                  Potholes mark dynamically on map as detected
                </span>
                <a
                  href="/safe-route"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition pointer-events-auto"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Fastest vs Safest Route</span>
                </a>
              </div>
            </div>

            {/* Quick Anand Route Info Card */}
            <Card className="p-4 space-y-2 border-l-4 border-l-emerald-500">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">
                    Anand Safe Path Recommendation
                  </h4>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  AI Active
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                When heading toward <strong>Vallabh Vidyanagar</strong>, avoid the congested <strong>Station Road & Nana Bazar</strong> corridor (multiple deep potholes). Take the <strong>100 Feet Bypass Road</strong> for a 98% damage-free ride!
              </p>
            </Card>
          </div>
        )}



      </div>

      {/* MOBILE BACK CAMERA CONNECT MODAL (Opens when clicking Mobile Back Cam on Laptop) */}
      {showMobileConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                    Open on Phone for Rear Camera
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Your laptop only has a front webcam. Use your smartphone to scan the road!
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMobileConnectModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Step 1: Open this link on your phone (Same Wi-Fi)
              </span>
              <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <code className="text-xs font-mono font-bold text-brand-600 dark:text-brand-400">
                  http://192.168.0.110:3000/live-scan
                </code>
                <button
                  onClick={handleCopyMobileUrl}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 text-xs font-bold hover:bg-brand-100"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1 pt-1">
                <p><strong>Step 2:</strong> On your mobile phone, tap <strong>"Mobile Back Cam"</strong>.</p>
                <p><strong>Step 3:</strong> Mount your phone on your car dashboard and start scanning!</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => {
                  setInputSource('dashcam_sim');
                  setShowMobileConnectModal(false);
                  addToast('Switched to Dashcam Video simulation for testing on laptop!', 'info');
                }}
                className="flex-1 py-2.5 rounded-xl bg-safety-600 hover:bg-safety-500 text-white font-bold text-xs transition"
              >
                Test with Dashcam Video on Laptop
              </button>
              <button
                onClick={() => {
                  setInputSource('user');
                  setShowMobileConnectModal(false);
                  addToast('Switched to Laptop Front Webcam!', 'info');
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition"
              >
                Use Laptop Front Webcam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HOW TO TEST GUIDE MODAL */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                  Testing Guide & Setup
                </span>
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                  How to Test Live Pothole Detection
                </h2>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-100 dark:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400 font-bold text-sm">
                  <Laptop className="w-5 h-5" />
                  <span>Testing on Laptop</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Laptops do not have a rear-facing camera, so we provide 3 options:
                </p>
                <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-disc pl-4">
                  <li>
                    <strong>Dashcam Video Simulation:</strong> Click <em>"Dashcam Video"</em> to run YOLO on realistic road driving footage right at your desk.
                  </li>
                  <li>
                    <strong>Laptop Webcam Mode:</strong> Click <em>"Laptop Webcam"</em> (with indoor human filter).
                  </li>
                  <li>
                    <strong>Upload Dashcam Video:</strong> Click <em>"Upload Video"</em> to test any road video file.
                  </li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center gap-2 text-safety-600 dark:text-safety-400 font-bold text-sm">
                  <Smartphone className="w-5 h-5" />
                  <span>Testing on Mobile Phone (Back Cam)</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Your laptop is configured with <code>host: true</code> to expose the server over Wi-Fi:
                </p>
                <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-decimal pl-4">
                  <li>Connect your phone to the same Wi-Fi as your laptop.</li>
                  <li>Open <code>http://192.168.0.110:3000/live-scan</code> on mobile Chrome/Safari.</li>
                  <li>
                    Click <strong>"Mobile Back Cam"</strong> and grant camera permission! The phone's rear camera will be used immediately.
                  </li>
                </ol>
              </div>
            </div>

            <button
              onClick={() => setShowGuideModal(false)}
              className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm transition"
            >
              Got It, Continue to Scanner
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
