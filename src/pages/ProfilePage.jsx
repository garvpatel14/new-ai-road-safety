import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { Card } from '../components/common/Card';
import {
  User,
  Mail,
  ShieldCheck,
  Key,
  Save,
  LogOut,
  CheckCircle2,
  Bell
} from 'lucide-react';

export const ProfilePage = () => {
  const { user, updateUserProfile, changePassword, logout } = useAuth();
  const { addToast } = useNotifications();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateUserProfile({ name, email });
      addToast('Profile details updated successfully!', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to update profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      addToast('New passwords do not match.', 'error');
      return;
    }
    if (newPassword.length < 6) {
      addToast('New password must be at least 6 characters.', 'error');
      return;
    }
    setChangingPw(true);
    try {
      await changePassword(currentPassword, newPassword);
      addToast('Password updated securely.', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      addToast(err.message || 'Failed to change password.', 'error');
    } finally {
      setChangingPw(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Account Settings & Profile</h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Manage your credentials, role privileges, and notification parameters.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* QUICK USER CARD */}
        <Card className="md:col-span-1 text-center space-y-4">
          <div className="w-28 h-28 mx-auto rounded-full bg-brand-500/10 flex items-center justify-center ring-4 ring-brand-500/30">
            <User className="w-12 h-12 text-brand-500" />
          </div>

          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-lg">{user?.name}</h3>
            <p className="text-xs text-slate-500">{user?.email}</p>
            <span className="inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full text-xs font-bold bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 capitalize">
              <ShieldCheck className="w-3.5 h-3.5" /> Role: {user?.role}
            </span>
          </div>

          <div className="pt-4 border-t border-slate-200/60 dark:border-slate-800 text-xs text-slate-500 space-y-2">
            <p>Member Since: <strong>Jan 2026</strong></p>
            <p>Status: <span className="text-emerald-600 font-bold">Verified Reporter</span></p>
          </div>
        </Card>

        {/* EDIT PROFILE & PASSWORD FORMS */}
        <div className="md:col-span-2 space-y-6">
          
          {/* EDIT PROFILE */}
          <Card className="space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <User className="w-5 h-5 text-brand-500" /> Personal Information
            </h3>

            <form onSubmit={handleProfileSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-brand-600 text-white font-bold text-xs shadow-md hover:bg-brand-500 transition flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </form>
          </Card>

          {/* CHANGE PASSWORD */}
          <Card className="space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <Key className="w-5 h-5 text-safety-500" /> Change Security Password
            </h3>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="••••••••"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl glass-input text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl glass-input text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={changingPw}
                className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-bold text-xs shadow-md hover:bg-slate-800 transition flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Key className="w-4 h-4" /> {changingPw ? 'Updating...' : 'Update Security Key'}
              </button>
            </form>
          </Card>

        </div>

      </div>

    </div>
  );
};
