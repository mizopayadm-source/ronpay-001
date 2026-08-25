import React, { useState, useEffect } from 'react';
import { 
  Megaphone, 
  ArrowRight, 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause, 
  X as CloseIcon, 
  ExternalLink,
  Maximize2,
  Sparkles,
  Image as ImageIcon
} from 'lucide-react';
import { AnnouncementBanner, AnnouncementItem } from '../types';
import { 
  parseMediaUrl, 
  ANNOUNCEMENT_BG_THEMES, 
  ANNOUNCEMENT_HEIGHT_PRESETS 
} from '../utils/media';

interface AnnouncementBannerCardProps {
  announcement?: AnnouncementBanner;
  onActionLink?: (action?: string) => void;
  className?: string;
  isDismissible?: boolean;
  onDismiss?: () => void;
  defaultExpandedMedia?: boolean;
}

export const AnnouncementBannerCard: React.FC<AnnouncementBannerCardProps> = ({
  announcement,
  onActionLink,
  className = '',
  isDismissible = true,
  onDismiss
}) => {
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState<boolean>(false);
  const [activeMediaUrl, setActiveMediaUrl] = useState<string>('');

  // Active items for rotating announcement banner
  const bannerItems: AnnouncementItem[] = announcement?.items && announcement.items.length > 0
    ? announcement.items.filter(item => item.isActive !== false)
    : (announcement?.title ? [{
        id: announcement.id || 'main',
        isActive: true,
        type: announcement.type || 'info',
        title: announcement.title,
        message: announcement.message,
        badge: announcement.type?.toUpperCase() || 'INFO',
        linkText: announcement.linkText,
        linkAction: announcement.linkAction,
        bannerMediaUrl: announcement.bannerMediaUrl,
        mediaType: announcement.mediaType,
        mediaLayout: announcement.mediaLayout
      }] : []);

  const animationStyle = announcement?.animationStyle || 'slide';
  const autoRotate = announcement?.autoRotate !== false;
  const rotationSpeedMs = Math.max(2, announcement?.rotationSpeedSeconds || 4) * 1000;

  // Auto rotation timer
  useEffect(() => {
    if (!autoRotate || isPaused || bannerItems.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIdx(prev => (prev + 1) % bannerItems.length);
    }, rotationSpeedMs);
    return () => clearInterval(interval);
  }, [autoRotate, isPaused, bannerItems.length, rotationSpeedMs]);

  // Keep index within bounds
  useEffect(() => {
    if (currentIdx >= bannerItems.length && bannerItems.length > 0) {
      setCurrentIdx(0);
    }
  }, [bannerItems.length, currentIdx]);

  if (!announcement || !announcement.isActive || isDismissed || bannerItems.length === 0) {
    return null;
  }

  const activeItem = bannerItems[currentIdx] || bannerItems[0];
  const parsedMedia = parseMediaUrl(activeItem.bannerMediaUrl || announcement.bannerMediaUrl);

  // 1. HEIGHT RESOLUTION (Uniform Slide Height)
  const effectiveHeightPreset = activeItem.bannerHeightPreset || announcement.globalHeightPreset || 'auto';
  const effectiveCustomHeight = activeItem.bannerCustomHeightPx || announcement.globalCustomHeightPx;
  const heightDef = ANNOUNCEMENT_HEIGHT_PRESETS[effectiveHeightPreset] || ANNOUNCEMENT_HEIGHT_PRESETS.auto;

  let containerHeightStyle: React.CSSProperties = {};
  let mediaHeightStyle: React.CSSProperties = {};

  if (effectiveHeightPreset === 'custom' && effectiveCustomHeight && effectiveCustomHeight > 100) {
    containerHeightStyle.minHeight = `${effectiveCustomHeight}px`;
    mediaHeightStyle.height = `${Math.max(80, Math.round(effectiveCustomHeight * 0.58))}px`;
  }

  // 2. BACKGROUND THEME & COLOR RESOLUTION
  const effectiveThemeId = activeItem.bgTheme || announcement.globalBgTheme || (
    activeItem.type === 'urgent' ? 'red_urgent' :
    activeItem.type === 'info' ? 'indigo_royal' :
    activeItem.type === 'notice' ? 'amber_gold' : 'emerald_forest'
  );

  const themeDef = ANNOUNCEMENT_BG_THEMES[effectiveThemeId] || ANNOUNCEMENT_BG_THEMES.indigo_royal;
  
  let bgStyle: React.CSSProperties = { ...containerHeightStyle };
  let isCustomBg = false;

  if (effectiveThemeId === 'custom') {
    isCustomBg = true;
    const gradFrom = activeItem.customGradientFrom || announcement.globalCustomGradientFrom;
    const gradTo = activeItem.customGradientTo || announcement.globalCustomGradientTo;
    const solidBg = activeItem.customBgColor || announcement.globalCustomBgColor;

    if (gradFrom && gradTo) {
      bgStyle.background = `linear-gradient(135deg, ${gradFrom}, ${gradTo})`;
    } else if (solidBg) {
      bgStyle.backgroundColor = solidBg;
    } else {
      bgStyle.background = 'linear-gradient(135deg, #4f46e5, #7c3aed)';
    }
  }

  // Text & Title Colors
  const customTextColor = activeItem.textColor;
  const customTitleColor = activeItem.titleColor;
  const textAlignment = activeItem.textAlignment || 'left';
  const fontSizePreset = activeItem.fontSizePreset || 'normal';

  const textAlignClass = textAlignment === 'center' ? 'text-center' : textAlignment === 'right' ? 'text-right' : 'text-left';

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIdx(prev => (prev - 1 + bannerItems.length) % bannerItems.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIdx(prev => (prev + 1) % bannerItems.length);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDismissed(true);
    if (onDismiss) onDismiss();
  };

  const handleActionClick = (linkAction?: string) => {
    if (!linkAction) return;
    if (linkAction.startsWith('http://') || linkAction.startsWith('https://') || linkAction.includes('canva.com')) {
      window.open(linkAction, '_blank');
      return;
    }
    if (onActionLink) {
      onActionLink(linkAction);
    }
  };

  const handleOpenMedia = (mediaUrl: string) => {
    setActiveMediaUrl(mediaUrl);
    setIsMediaModalOpen(true);
  };

  // Determine media layout: 'hero_top', 'side_thumb', or 'background_overlay'
  const effectiveLayout = activeItem.mediaLayout || (parsedMedia?.isCanva ? 'hero_top' : 'hero_top');
  const mediaFit = activeItem.mediaFit || announcement.globalMediaFit || 'cover';
  const mediaFitClass = mediaFit === 'contain' ? 'object-contain' : mediaFit === 'fill' ? 'object-fill' : 'object-cover';

  return (
    <>
      <div 
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        style={bgStyle}
        className={`p-3.5 sm:p-4 rounded-2xl border shadow-sm relative overflow-hidden transition-all flex flex-col justify-between ${
          !isCustomBg ? `${themeDef.bgClass} ${themeDef.borderClass} ${themeDef.textClass}` : 'text-white border-white/20'
        } ${heightDef.containerMinHeightClass} ${animationStyle === 'pulse' ? 'animate-pulse' : ''} ${className}`}
      >
        {/* BACKGROUND OVERLAY MODE (if layout is background_overlay) */}
        {parsedMedia && effectiveLayout === 'background_overlay' && !parsedMedia.isCanva && (
          <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
            <img 
              src={parsedMedia.embedUrl} 
              alt="Backdrop" 
              className={`w-full h-full ${mediaFitClass} opacity-25 scale-105 filter blur-xs`}
            />
            <div className="absolute inset-0 bg-black/40 backdrop-blur-3xs" />
          </div>
        )}

        <div className="relative z-10 w-full flex flex-col flex-1 justify-between">
          {/* Top Control Bar: Type Badge, Item Count, Actions */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="p-1 bg-white/20 rounded-lg shrink-0 backdrop-blur-xs shadow-2xs">
                <Megaphone className="w-3.5 h-3.5" />
              </span>
              
              <span 
                style={{
                  backgroundColor: activeItem.badgeBgColor || undefined,
                  color: activeItem.badgeTextColor || undefined
                }}
                className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider ${
                  !activeItem.badgeBgColor ? themeDef.badgeBg : ''
                } ${!activeItem.badgeTextColor ? themeDef.badgeText : ''}`}
              >
                {activeItem.badge || activeItem.type || 'NOTICE'}
              </span>

              {parsedMedia?.isCanva && (
                <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-cyan-400 text-slate-950 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> Canva Design
                </span>
              )}
              
              {parsedMedia?.type === 'gif' && (
                <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md bg-pink-400 text-slate-950">
                  GIF
                </span>
              )}
              
              {bannerItems.length > 1 && (
                <span className="text-[8.5px] font-mono font-bold bg-black/25 text-white px-1.5 py-0.5 rounded-full">
                  {currentIdx + 1}/{bannerItems.length}
                </span>
              )}

              {animationStyle === 'marquee' && (
                <span className="text-[8px] bg-amber-400 text-slate-950 font-black uppercase px-1 rounded-sm">
                  Ticker
                </span>
              )}
            </div>

            {/* Controls: Prev/Pause/Next & Close */}
            <div className="flex items-center gap-1 shrink-0">
              {bannerItems.length > 1 && (
                <div className="flex items-center bg-black/20 rounded-xl p-0.5 backdrop-blur-xs">
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
                    title="Previous announcement"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPaused(!isPaused)}
                    className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
                    title={isPaused ? "Play auto-rotation" : "Pause auto-rotation"}
                  >
                    {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
                    title="Next announcement"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {isDismissible && (
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="p-1.5 rounded-xl bg-black/20 hover:bg-black/40 text-white/80 hover:text-white transition cursor-pointer"
                  title="Dismiss announcement"
                >
                  <CloseIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* HERO MEDIA BANNER (CANVA / IMAGE / ANIMATION) on Top if present and layout is hero_top or full_card */}
          {parsedMedia && (effectiveLayout === 'hero_top' || effectiveLayout === 'full_card') && (
            <div 
              style={mediaHeightStyle}
              className={`mb-2.5 rounded-xl overflow-hidden bg-black/30 border border-white/20 shadow-md relative group ${
                !mediaHeightStyle.height ? heightDef.mediaHeightClass : ''
              }`}
            >
              {parsedMedia.isCanva ? (
                // Canva Interactive Embed
                <div className="relative w-full h-full bg-slate-950 overflow-hidden">
                  <iframe
                    src={parsedMedia.embedUrl}
                    title="Canva Design Banner"
                    loading="lazy"
                    className="w-full h-full border-0 absolute inset-0"
                    allow="fullscreen"
                  />
                  {/* Canva Quick Action floating overlay */}
                  <div className="absolute bottom-2 right-2 flex items-center gap-1.5 z-10">
                    <a
                      href={parsedMedia.canvaViewUrl || parsedMedia.originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 bg-black/80 hover:bg-black text-white text-[10px] font-bold rounded-lg backdrop-blur-xs flex items-center gap-1 transition shadow-md"
                    >
                      <ExternalLink className="w-3 h-3 text-cyan-300" />
                      <span>Open in Canva</span>
                    </a>
                  </div>
                </div>
              ) : (
                // Image / GIF Banner
                <div 
                  onClick={() => handleOpenMedia(parsedMedia.embedUrl)}
                  className="relative w-full h-full overflow-hidden cursor-zoom-in group"
                >
                  <img 
                    src={parsedMedia.embedUrl} 
                    alt={activeItem.title || 'Announcement banner'} 
                    className={`w-full h-full ${mediaFitClass} object-center transition-transform duration-300 group-hover:scale-105`}
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-2">
                    <span className="text-[10px] font-bold text-white/90 bg-black/60 px-2 py-0.5 rounded-md backdrop-blur-xs flex items-center gap-1">
                      <Maximize2 className="w-2.5 h-2.5" /> En lian rawh
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Content Body */}
          <div className="flex items-start gap-2.5 flex-1">
            {/* SIDE THUMBNAIL (if layout is side_thumb) */}
            {parsedMedia && effectiveLayout === 'side_thumb' && (
              <div 
                onClick={() => handleOpenMedia(parsedMedia.embedUrl)}
                className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-xl overflow-hidden bg-black/30 border border-white/20 shadow-xs cursor-pointer group relative mt-0.5"
              >
                <img 
                  src={parsedMedia.embedUrl} 
                  alt="Banner" 
                  className={`w-full h-full ${mediaFitClass} group-hover:scale-110 transition-transform`} 
                />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Maximize2 className="w-3 h-3 text-white" />
                </div>
              </div>
            )}

            {/* Text Content */}
            <div className={`space-y-1 min-w-0 flex-1 ${textAlignClass}`}>
              {animationStyle === 'marquee' ? (
                <div className="overflow-hidden whitespace-nowrap py-0.5">
                  <div className="inline-block animate-marquee font-bold text-xs">
                    <span className="text-amber-200 mr-2">[{activeItem.title}]</span>
                    <span>{activeItem.message}</span>
                  </div>
                </div>
              ) : (
                <div className={`transition-all duration-300 ${
                  animationStyle === 'fade' ? 'animate-fadeIn' : 
                  animationStyle === 'slide' ? 'animate-fadeIn' : ''
                }`}>
                  <h4 
                    style={{ color: customTitleColor || undefined }}
                    className={`font-black tracking-wide leading-tight drop-shadow-xs ${
                      fontSizePreset === 'small' ? 'text-xs' :
                      fontSizePreset === 'large' ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'
                    }`}
                  >
                    {activeItem.title}
                  </h4>
                  <p 
                    style={{ color: customTextColor || undefined }}
                    className={`leading-snug mt-0.5 break-words ${
                      fontSizePreset === 'small' ? 'text-[10px] sm:text-[11px]' :
                      fontSizePreset === 'large' ? 'text-xs sm:text-sm' : 'text-[11px] sm:text-xs'
                    } ${!customTextColor ? 'opacity-95' : ''}`}
                  >
                    {activeItem.message}
                  </p>
                </div>
              )}

              {/* Action Buttons & Canva Links */}
              <div className={`pt-1.5 flex items-center gap-2 flex-wrap ${
                textAlignment === 'center' ? 'justify-center' : textAlignment === 'right' ? 'justify-end' : 'justify-start'
              }`}>
                {activeItem.linkText && (
                  <button
                    type="button"
                    onClick={() => handleActionClick(activeItem.linkAction)}
                    className="inline-flex items-center gap-1 bg-white text-slate-900 hover:bg-amber-300 hover:text-slate-950 font-black text-[10.5px] px-2.5 py-1 rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
                  >
                    <span>{activeItem.linkText}</span>
                    {activeItem.linkAction?.startsWith('http') ? (
                      <ExternalLink className="w-3 h-3 text-slate-700" />
                    ) : (
                      <ArrowRight className="w-3 h-3 text-slate-700" />
                    )}
                  </button>
                )}

                {parsedMedia?.isCanva && (
                  <a
                    href={parsedMedia.canvaViewUrl || parsedMedia.originalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 bg-cyan-400/30 hover:bg-cyan-400 text-white hover:text-slate-950 font-bold text-[10px] px-2 py-0.5 rounded-lg border border-cyan-300/40 transition"
                  >
                    <Sparkles className="w-3 h-3 text-cyan-200 hover:text-slate-950" />
                    <span>Canva View</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Dots Indicator for multiple items */}
          {bannerItems.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-2 mt-1.5 border-t border-white/15">
              {bannerItems.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentIdx(idx)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    currentIdx === idx ? 'w-5 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/70'
                  }`}
                  title={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* FULL SCREEN MEDIA PREVIEW MODAL */}
      {isMediaModalOpen && activeMediaUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/90 backdrop-blur-md animate-fadeIn">
          <div className="relative max-w-3xl w-full max-h-[90vh] flex flex-col items-center justify-center">
            <button
              type="button"
              onClick={() => setIsMediaModalOpen(false)}
              className="absolute -top-10 right-0 p-2 text-white/80 hover:text-white rounded-full bg-white/10 cursor-pointer"
            >
              <CloseIcon className="w-6 h-6" />
            </button>
            <img
              src={activeMediaUrl}
              alt="Full Banner"
              className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-white/20"
            />
            <div className="mt-3 flex items-center gap-3">
              <a
                href={activeMediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-cyan-300 hover:text-cyan-200 underline flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" /> A link pui zawk ah hawng rawh
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
