import React from 'react';
import { X, ExternalLink, MapPin } from 'lucide-react';

interface ImagePreviewModalProps {
  imageUrl: string | null;
  title?: string;
  subtitle?: string;
  location?: string;
  onClose: () => void;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  imageUrl,
  title,
  subtitle,
  location,
  onClose,
}) => {
  if (!imageUrl) return null;

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl relative text-white animate-scaleUp"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 backdrop-blur-xs transition cursor-pointer z-10 border border-white/20"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Large Image */}
        <div className="relative aspect-4/3 sm:aspect-square bg-slate-950 flex items-center justify-center overflow-hidden">
          <img
            src={imageUrl}
            alt={title || 'Bawm Picture'}
            referrerPolicy="no-referrer"
            className="w-full h-full object-contain"
          />
        </div>

        {/* Caption & Details Footer */}
        {(title || subtitle || location) && (
          <div className="p-4 bg-gradient-to-t from-slate-950 to-slate-900 border-t border-slate-800 space-y-1">
            {title && <h3 className="font-black text-sm text-slate-100">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-300 font-medium">{subtitle}</p>}
            {location && (
              <p className="text-[10px] text-slate-400 font-semibold flex items-center gap-1 pt-0.5">
                <MapPin className="w-3 h-3 text-rose-400" /> {location}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
