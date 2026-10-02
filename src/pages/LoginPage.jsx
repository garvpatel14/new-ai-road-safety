import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { ShieldAlert, Mail, Lock, LogIn, CheckCircle } from 'lucide-react';
import { Modal } from '../components/common/Modal';
import api from '../services/api';

export const LoginPage = () => {
  const { login } = useAuth();
  const { addToast } = useNotifications();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Ensure fields stay blank upon loading the page and prevent browser auto-fill
  useEffect(() => {
    setEmail('');
    setPassword('');
    const timer = setTimeout(() => {
      setEmail('');
      setPassword('');
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const loggedUser = await login(email, password, rememberMe);
      addToast('Welcome back to SafeRoad AI Platform!', 'success');
      if (loggedUser?.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: forgotEmail });
      setForgotSent(true);
    } catch (err) {
      setForgotError(err?.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleCloseForgotModal = () => {
    setShowForgotModal(false);
    setForgotEmail('');
    setForgotError('');
    setForgotSent(false);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md glass-panel rounded-3xl p-8 border border-slate-200/80 dark:border-slate-800 shadow-2xl space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-safety-500 text-white shadow-lg mb-1">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Welcome Back</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Sign in to access your road safety intelligence portal</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          {/* Hidden inputs to prevent aggressive browser autofill */}
          <input type="text" style={{ display: 'none' }} tabIndex="-1" aria-hidden="true" />
          <input type="password" style={{ display: 'none' }} tabIndex="-1" aria-hidden="true" />

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="email"
                name="email"
                id="login-email"
                autoComplete="off"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="name@saferoad.ai"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Password</label>
              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="password"
                name="password"
                id="login-password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 dark:text-slate-400">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
              />
              Remember me
            </label>
          </div>

          {error && (
            <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-600 to-safety-500 text-white font-bold text-sm shadow-lg shadow-brand-500/20 hover:opacity-95 transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <LogIn className="w-4 h-4" /> {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          Don't have an account?{' '}
          <Link to="/register" className="font-bold text-brand-600 dark:text-brand-400 hover:underline">
            Register now
          </Link>
        </p>

      </div>

      {/* Forgot Password Modal */}
      <Modal
        isOpen={showForgotModal}
        onClose={handleCloseForgotModal}
        title="Reset Account Password"
      >
        {forgotSent ? (
          /* ── Success state ── */
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle className="w-7 h-7 text-green-500" />
            </div>
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-1">Check your inbox!</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                If <strong>{forgotEmail}</strong> is registered, a password reset link has been sent.
                The link expires in <strong>1 hour</strong>.
              </p>
            </div>
            <p className="text-[11px] text-slate-400">Didn't receive it? Check your spam folder.</p>
            <button
              onClick={handleCloseForgotModal}
              className="mt-1 px-5 py-2 rounded-xl text-xs font-bold bg-brand-600 text-white hover:bg-brand-500 transition"
            >
              Back to Login
            </button>
          </div>
        ) : (
          /* ── Form state ── */
          <form onSubmit={handleForgotSubmit} className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Enter your registered email address and we'll send you a secure password reset link.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="name@domain.com"
                />
              </div>
            </div>

            {forgotError && (
              <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2">
                {forgotError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleCloseForgotModal}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={forgotLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-brand-600 text-white hover:bg-brand-500 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {forgotLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </div>
          </form>
        )}
      </Modal>

    </div>
  );
};
