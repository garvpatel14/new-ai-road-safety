import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import {
  ShieldAlert,
  Sun,
  Moon,
  Bell,
  User,
  LogOut,
  ShieldCheck,
  Menu,
  X,
  MapPin,
  CheckCircle2
} from 'lucide-react';

export const Navbar = ({ onToggleSidebar, isSidebarOpen, isPublic = false }) => {
  const { theme, toggleTheme } = useTheme();
  const { user, isAuthenticated, logout, toggleRole } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  return (
    <nav className="sticky top-0 z-40 w-full glass-panel border-b border-slate-200/60 dark:border-slate-800/80 shadow-sm transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Left: Brand Logo & Sidebar Toggle */}
          <div className="flex items-center gap-3">
            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/60 lg:hidden transition"
                aria-label="Toggle Navigation Sidebar"
              >
                {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            )}

            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-brand-500 to-safety-500 text-white shadow-md shadow-brand-500/20 group-hover:scale-105 transition transform duration-200">
                <ShieldAlert className="w-6 h-6 text-white" />
                <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-safety-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-safety-500"></span>
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-brand-700 to-safety-600 dark:from-white dark:via-brand-400 dark:to-safety-400">
                  SafeRoad <span className="text-safety-500 font-bold text-xs uppercase px-1.5 py-0.5 rounded bg-safety-500/10 border border-safety-500/20 ml-1">AI</span>
                </span>
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 -mt-1 hidden sm:inline">
                  Road Safety Intelligence
                </span>
              </div>
            </Link>
          </div>

          {/* Center Links (Desktop Header Quick Navigation) */}
          <div className="hidden md:flex items-center space-x-1 text-xs">
            <Link
              to={isPublic ? '/login' : (isAuthenticated ? '/live-scan' : '/login')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition"
            >
              <span className="w-2 h-2 rounded-full bg-safety-500 animate-ping" />
              Live Scanner
            </Link>
            {(isPublic || isAdmin) && (
              <Link
                to={isPublic ? '/login' : (isAuthenticated ? '/map' : '/login')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition"
              >
                <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                RQI Map
              </Link>
            )}
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-2">



            {/* Dark / Light Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/60 transition"
              title="Toggle Dark / Light Mode"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-700" />}
            </button>

            {isPublic ? (
              /* Public home page: always show Login + Register */
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Log In
                </Link>
                <Link
                  to="/register"
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-brand-600 to-safety-500 hover:opacity-95 shadow-md shadow-brand-500/20 transition"
                >
                  Get Started
                </Link>
              </div>
            ) : (
              <>
                {/* Notifications Menu */}
                {!isAdmin && (
                  <div className="relative">
                  <button
                    onClick={() => {
                      setShowNotifMenu(!showNotifMenu);
                      setShowUserMenu(false);
                    }}
                    className="relative p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/60 transition"
                    aria-label="Notifications"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-safety-500 text-[10px] font-bold text-white">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {showNotifMenu && (
                    <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl glass-panel shadow-2xl border border-slate-200 dark:border-slate-800 py-3 z-50 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center justify-between px-4 pb-2 border-b border-slate-200/60 dark:border-slate-800">
                        <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Notifications</h3>
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllAsRead}
                            className="text-xs text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Mark all read
                          </button>
                        )}
                      </div>
                      <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                        {notifications.length === 0 ? (
                          <p className="p-4 text-xs text-center text-slate-500">No notifications.</p>
                        ) : (
                          notifications.map((n) => (
                            <div
                              key={n.id}
                              onClick={() => markAsRead(n.id)}
                              className={`p-3 text-xs cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/50 transition ${
                                !n.read ? 'bg-brand-500/5 dark:bg-brand-500/10' : ''
                              }`}
                            >
                              <div className="flex justify-between items-start mb-1">
                                <span className="font-semibold text-slate-800 dark:text-slate-200">{n.title}</span>
                                <span className="text-[10px] text-slate-400">{n.time}</span>
                              </div>
                              <p className="text-slate-600 dark:text-slate-400 leading-snug">{n.message}</p>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="px-4 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-center">
                        <Link
                          to="/notifications"
                          onClick={() => setShowNotifMenu(false)}
                          className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
                        >
                          View all notifications
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
                )}

                {/* Auth Account Dropdown */}
                {isAuthenticated ? (
                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowUserMenu(!showUserMenu);
                        setShowNotifMenu(false);
                      }}
                      className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/60 transition"
                    >
                      <div className="w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-400">
                        <User className="w-4 h-4" />
                      </div>
                      <span className="hidden lg:inline text-xs font-medium text-slate-700 dark:text-slate-200">
                        {user?.name}
                      </span>
                    </button>

                    {showUserMenu && (
                      <div className="absolute right-0 mt-2 w-52 rounded-2xl glass-panel shadow-2xl border border-slate-200 dark:border-slate-800 py-2 z-50">
                        <div className="px-4 py-2 border-b border-slate-200/60 dark:border-slate-800">
                          <p className="text-xs font-bold text-slate-900 dark:text-white">{user?.name}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
                        </div>
                        <Link
                          to="/profile"
                          onClick={() => setShowUserMenu(false)}
                          className="flex items-center gap-2 px-4 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <User className="w-4 h-4 text-brand-500" />
                          My Profile
                        </Link>
                        {user?.role === 'admin' && (
                          <Link
                            to="/admin"
                            onClick={() => setShowUserMenu(false)}
                            className="flex items-center gap-2 px-4 py-2 text-xs text-safety-600 dark:text-safety-400 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <ShieldCheck className="w-4 h-4 text-safety-500" />
                            Admin Portal
                          </Link>
                        )}
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            logout();
                            navigate('/login');
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-500/10 transition"
                        >
                          <LogOut className="w-4 h-4" />
                          Sign Out
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Link
                      to="/login"
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      Log In
                    </Link>
                    <Link
                      to="/register"
                      className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-brand-600 to-safety-500 hover:opacity-95 shadow-md shadow-brand-500/20 transition"
                    >
                      Get Started
                    </Link>
                  </div>
                )}
              </>
            )}

          </div>

        </div>
      </div>
    </nav>
  );
};
