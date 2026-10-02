import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Heart, Github, Twitter, Linkedin, Sparkles } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="mt-auto border-t border-slate-200/60 dark:border-slate-800/80 bg-slate-900 text-slate-400 py-12 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          
          {/* Col 1: Brand & Tagline */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 via-brand-500 to-safety-500 text-white shadow-md">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <span className="text-xl font-extrabold tracking-tight text-white">
                SafeRoad <span className="text-safety-500">AI</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Empowering cities and drivers with real-time AI road safety detection, predictive hazard mapping, and intelligent safe routing.
            </p>
            <div className="flex items-center space-x-3 text-slate-400 pt-1">
              <a href="#github" className="hover:text-white transition"><Github className="w-4 h-4" /></a>
              <a href="#twitter" className="hover:text-white transition"><Twitter className="w-4 h-4" /></a>
              <a href="#linkedin" className="hover:text-white transition"><Linkedin className="w-4 h-4" /></a>
            </div>
          </div>

          {/* Col 2: Navigation */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Platform Views</h4>
            <ul className="space-y-2 text-xs">
              <li><Link to="/live-scan" className="hover:text-white transition">Live Road Scanner</Link></li>
              <li><Link to="/safe-route" className="hover:text-white transition">Safe Route Planner</Link></li>
              <li><Link to="/notifications" className="hover:text-white transition">Safety Notifications</Link></li>
              <li><Link to="/analytics" className="hover:text-white transition">Road Trends & Insights</Link></li>
            </ul>
          </div>

          {/* Col 3: Report & Community */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Community Actions</h4>
            <ul className="space-y-2 text-xs">
              <li><Link to="/report-damage" className="hover:text-white transition">Report Pothole / Crack</Link></li>
              <li><Link to="/my-reports" className="hover:text-white transition">Track Submitted Issues</Link></li>
              <li><Link to="/notifications" className="hover:text-white transition">Emergency Hazard Feeds</Link></li>
            </ul>
          </div>

          {/* Col 4: AI Tech Badge */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-white mb-3">AI Intelligence</h4>
            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs space-y-2">
              <div className="flex items-center gap-2 text-safety-400 font-semibold">
                <Sparkles className="w-4 h-4" /> Real-time Computer Vision
              </div>
              <p className="text-[11px] text-slate-400">
                Automated road damage classification trained on over 500,000 geospatial road images.
              </p>
            </div>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© 2026 SafeRoad AI Intelligence Platform. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Built with <Heart className="w-3.5 h-3.5 text-red-500 fill-current" /> for safer streets nationwide.
          </p>
        </div>
      </div>
    </footer>
  );
};
