import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout, PublicLayout } from '../layouts/MainLayout';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

// Lazy-load all pages for fast initial page load & code splitting
const LandingPage = lazy(() => import('../pages/LandingPage').then(m => ({ default: m.LandingPage })));
const LoginPage = lazy(() => import('../pages/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('../pages/RegisterPage').then(m => ({ default: m.RegisterPage })));
const ResetPasswordPage = lazy(() => import('../pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));

// User Side Pages
const LiveRoadScanningPage = lazy(() => import('../pages/LiveRoadScanningPage').then(m => ({ default: m.LiveRoadScanningPage })));
const GpsLocationPage = lazy(() => import('../pages/GpsLocationPage').then(m => ({ default: m.GpsLocationPage })));
const InteractiveMapPage = lazy(() => import('../pages/InteractiveMapPage').then(m => ({ default: m.InteractiveMapPage })));
const SafeRoutePage = lazy(() => import('../pages/SafeRoutePage').then(m => ({ default: m.SafeRoutePage })));
const ReportDamagePage = lazy(() => import('../pages/ReportDamagePage').then(m => ({ default: m.ReportDamagePage })));
const MyReportsPage = lazy(() => import('../pages/MyReportsPage').then(m => ({ default: m.MyReportsPage })));
const NotificationsPage = lazy(() => import('../pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const ProfilePage = lazy(() => import('../pages/ProfilePage').then(m => ({ default: m.ProfilePage })));

// Municipality Side Pages
const AdminDashboardPage = lazy(() => import('../pages/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })));
const RoadHeatmapPage = lazy(() => import('../pages/RoadHeatmapPage').then(m => ({ default: m.RoadHeatmapPage })));
const PotholeManagementPage = lazy(() => import('../pages/PotholeManagementPage').then(m => ({ default: m.PotholeManagementPage })));
const RepairManagementPage = lazy(() => import('../pages/RepairManagementPage').then(m => ({ default: m.RepairManagementPage })));
const RoadVerificationPage = lazy(() => import('../pages/RoadVerificationPage').then(m => ({ default: m.RoadVerificationPage })));
const AnalyticsPage = lazy(() => import('../pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));

import { useAuth } from '../context/AuthContext';

/** Redirects unauthenticated users to /login */
const PrivateRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

/** Redirects admin users away from user pages */
const UserRoute = ({ children }) => {
  const { user } = useAuth();
  if (user?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }
  return children;
};

/** Redirects non-admin users away from admin pages */
const AdminRoute = ({ children }) => {
  const { user } = useAuth();
  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

export const AppRoutes = () => {
  return (
    <Suspense fallback={<LoadingSpinner label="Loading Page..." />}>
      <Routes>
        {/* Public Pages Layout */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
        </Route>

        {/* Main Dashboard & App Pages Layout — all require authentication */}
        <Route element={<PrivateRoute><MainLayout /></PrivateRoute>}>
          {/* User Side Modules */}
          <Route path="/dashboard" element={<UserRoute><LiveRoadScanningPage /></UserRoute>} />
          <Route path="/live-scan" element={<UserRoute><LiveRoadScanningPage /></UserRoute>} />
          <Route path="/gps-location" element={<Navigate to="/dashboard" replace />} />
          <Route path="/safe-route" element={<SafeRoutePage />} />
          <Route path="/report-damage" element={<ReportDamagePage />} />
          <Route path="/my-reports" element={<MyReportsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/profile" element={<ProfilePage />} />

          {/* Municipality Side Modules */}
          <Route path="/admin" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
          <Route path="/map" element={<AdminRoute><InteractiveMapPage /></AdminRoute>} />
          <Route path="/admin/heatmap" element={<AdminRoute><RoadHeatmapPage /></AdminRoute>} />
          <Route path="/admin/potholes" element={<AdminRoute><PotholeManagementPage /></AdminRoute>} />
          <Route path="/admin/repairs" element={<AdminRoute><RepairManagementPage /></AdminRoute>} />
          <Route path="/admin/verification" element={<AdminRoute><RoadVerificationPage /></AdminRoute>} />
          <Route path="/analytics" element={<AdminRoute><AnalyticsPage /></AdminRoute>} />
        </Route>

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};
