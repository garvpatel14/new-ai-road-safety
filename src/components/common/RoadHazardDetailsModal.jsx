import React, { useState } from 'react';
import { Modal } from './Modal';
import { StatusBadge } from './StatusBadge';
import {
  MapPin,
  Calendar,
  User,
  ThumbsUp,
  MessageSquare,
  Send,
  AlertTriangle,
  Compass,
  Layers,
  Ruler,
  CheckCircle2,
  ShieldAlert
} from 'lucide-react';
import { getSafeImageUrl, handleImageError } from '../../utils/imageUtils';

export const RoadHazardDetailsModal = ({ isOpen, onClose, hazard, onUpvote, onAddComment }) => {
  if (!hazard) return null;

  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState(hazard.comments || []);
  const [upvoteCount, setUpvoteCount] = useState(hazard.upvotes || 0);
  const [hasUpvoted, setHasUpvoted] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  // Sync comments/upvotes when hazard changes
  React.useEffect(() => {
    setComments(hazard.comments || []);
    setUpvoteCount(hazard.upvotes || 0);
    setHasUpvoted(false);
    setCommentText('');
  }, [hazard?.id]);

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmittingComment(true);

    // Optimistic UI update
    const optimistic = {
      id: Date.now(),
      user: 'You (Inspector)',
      text: commentText,
      time: 'Just now',
    };
    setComments(prev => [optimistic, ...prev]);
    const text = commentText;
    setCommentText('');

    // Call real API if provided
    if (onAddComment) {
      const saved = await onAddComment(hazard.id, text, 'Inspector');
      if (saved) {
        // Replace optimistic with real server response
        setComments(prev => [saved, ...prev.filter(c => c.id !== optimistic.id)]);
      }
    }
    setSubmittingComment(false);
  };

  const handleUpvoteClick = () => {
    if (!hasUpvoted) {
      setUpvoteCount(prev => prev + 1);
      setHasUpvoted(true);
      if (onUpvote) onUpvote(hazard.id);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Hazard Details: ${hazard.id}`} maxWidth="max-w-3xl">
      <div className="space-y-6">
        
        {/* Top Hero Image with Bounding Box AI Overlay */}
        <div className="relative rounded-2xl overflow-hidden bg-slate-950 max-h-72 group">
          <img
            src={getSafeImageUrl(hazard.image, hazard.type)}
            alt={hazard.type}
            onError={(e) => handleImageError(e, hazard.type)}
            className="w-full h-72 object-cover opacity-90 group-hover:scale-105 transition duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-black/30" />

          {/* AI Detection Bounding Box Marker */}
          <div className="absolute top-1/4 left-1/3 w-36 h-28 border-2 border-dashed border-red-500 rounded-lg bg-red-500/10 animate-pulse flex items-start p-1.5 shadow-lg">
            <span className="bg-red-600 text-white font-extrabold text-[10px] px-1.5 py-0.5 rounded shadow">
              {hazard.type} ({hazard.aiConfidence || '95%'})
            </span>
          </div>

          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <StatusBadge status={hazard.severity || 'High'} />
                <StatusBadge status={hazard.status || 'Pending'} />
              </div>
              <h3 className="text-xl font-extrabold text-white">{hazard.type} Hazard Report</h3>
              <p className="text-xs text-slate-300 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-safety-400" />
                {hazard.locationName || 'Main St & 4th Ave'}
              </p>
            </div>

            <button
              onClick={handleUpvoteClick}
              disabled={hasUpvoted}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs shadow-lg transition ${
                hasUpvoted
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white/90 hover:bg-white text-slate-900'
              }`}
            >
              <ThumbsUp className={`w-4 h-4 ${hasUpvoted ? 'fill-white' : ''}`} />
              <span>{upvoteCount} Upvotes</span>
            </button>
          </div>
        </div>

        {/* Specifications & Dimensions Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Est. Depth</span>
            <div className="flex items-center gap-1.5 font-extrabold text-slate-900 dark:text-white text-sm">
              <Ruler className="w-4 h-4 text-safety-500" />
              {hazard.depthCm ? `${hazard.depthCm} cm` : '14.2 cm'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Est. Surface Area</span>
            <div className="flex items-center gap-1.5 font-extrabold text-slate-900 dark:text-white text-sm">
              <Layers className="w-4 h-4 text-brand-500" />
              {hazard.areaSqM ? `${hazard.areaSqM} m²` : '0.18 m²'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">GPS Coords</span>
            <div className="flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200 text-xs truncate">
              <Compass className="w-4 h-4 text-emerald-500 shrink-0" />
              {hazard.lat ? `${hazard.lat.toFixed(4)}, ${hazard.lng.toFixed(4)}` : '37.7749, -122.4194'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Reported By</span>
            <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 text-xs truncate">
              <User className="w-4 h-4 text-purple-500 shrink-0" />
              {hazard.reportedBy || 'Civilian Inspector'}
            </div>
          </div>
        </div>

        {/* Hazard Description */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Incident Description</h4>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
            {hazard.description || 'Severe asphalt indentation causing potential tire deflation and chassis damage.'}
          </p>
        </div>

        {/* Municipal Status Progress Timeline */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Municipal Repair Lifecycle</h4>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            {[
              { label: 'Reported', active: true },
              { label: 'AI Verified', active: true },
              { label: 'Work Order', active: hazard.status === 'Scheduled' || hazard.status === 'In Progress' || hazard.status === 'Resolved' },
              { label: 'Repaired', active: hazard.status === 'Resolved' }
            ].map((step, idx) => (
              <div
                key={idx}
                className={`p-2 rounded-xl border text-center transition ${
                  step.active
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold'
                    : 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex justify-center mb-1">
                  <CheckCircle2 className={`w-4 h-4 ${step.active ? 'text-emerald-500' : 'text-slate-400'}`} />
                </div>
                <span className="text-[11px]">{step.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Community Discussion / Comments */}
        <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-brand-500" />
            Community Comments ({comments.length})
          </h4>

          <form onSubmit={handleAddComment} className="flex gap-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add an inspection comment or update..."
              className="flex-1 px-3.5 py-2 rounded-xl glass-input text-xs"
              disabled={submittingComment}
            />
            <button
              type="submit"
              disabled={submittingComment || !commentText.trim()}
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs flex items-center gap-1 shadow transition disabled:opacity-60"
            >
              {submittingComment ? (
                <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" /> Sending</>
              ) : (
                <><Send className="w-3.5 h-3.5" /> Send</>
              )}
            </button>
          </form>

          <div className="space-y-2 max-h-40 overflow-y-auto">
            {comments.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No comments yet. Be the first to update!</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="p-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 text-xs space-y-1">
                  <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200">
                    <span>{c.user}</span>
                    <span className="text-[10px] text-slate-400 font-normal">{c.time}</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">{c.text}</p>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </Modal>
  );
};
