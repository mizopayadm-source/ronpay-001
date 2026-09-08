/**
 * Media and Canva Embed Helper Utilities for RonPay Announcements
 */

export interface ParsedMedia {
  type: 'canva' | 'image' | 'gif' | 'embed' | 'unknown';
  embedUrl: string;
  originalUrl: string;
  isCanva: boolean;
  canvaViewUrl?: string;
}

export interface BgThemeDefinition {
  id: string;
  name: string;
  nameMizo: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  badgeBg: string;
  badgeText: string;
  previewColor: string;
}

export const ANNOUNCEMENT_BG_THEMES: Record<string, BgThemeDefinition> = {
  red_urgent: {
    id: 'red_urgent',
    name: 'Crimson Red / Urgent',
    nameMizo: 'Sen Pawng (Urgent Alert)',
    bgClass: 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700',
    textClass: 'text-white',
    borderClass: 'border-red-500 shadow-red-200/50',
    badgeBg: 'bg-white/25',
    badgeText: 'text-white',
    previewColor: '#dc2626'
  },
  indigo_royal: {
    id: 'indigo_royal',
    name: 'Royal Indigo & Purple',
    nameMizo: 'Pawl & Senduk (Royal Indigo)',
    bgClass: 'bg-gradient-to-r from-indigo-700 via-purple-700 to-indigo-800',
    textClass: 'text-white',
    borderClass: 'border-indigo-500 shadow-indigo-200/50',
    badgeBg: 'bg-white/25',
    badgeText: 'text-white',
    previewColor: '#4338ca'
  },
  emerald_forest: {
    id: 'emerald_forest',
    name: 'Emerald Green & Teal',
    nameMizo: 'Hring Mawi (Church & NGO)',
    bgClass: 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700',
    textClass: 'text-white',
    borderClass: 'border-emerald-500 shadow-emerald-200/50',
    badgeBg: 'bg-white/25',
    badgeText: 'text-white',
    previewColor: '#059669'
  },
  amber_gold: {
    id: 'amber_gold',
    name: 'Amber Orange & Gold',
    nameMizo: 'Eng & Arawm (Notice / Alert)',
    bgClass: 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700',
    textClass: 'text-white',
    borderClass: 'border-amber-500 shadow-amber-200/50',
    badgeBg: 'bg-white/25',
    badgeText: 'text-white',
    previewColor: '#d97706'
  },
  midnight_dark: {
    id: 'midnight_dark',
    name: 'Midnight Dark Cyber',
    nameMizo: 'Dum & Neon (Midnight Dark)',
    bgClass: 'bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950',
    textClass: 'text-white',
    borderClass: 'border-indigo-500/40 shadow-slate-900/60',
    badgeBg: 'bg-indigo-500/30',
    badgeText: 'text-indigo-200',
    previewColor: '#0f172a'
  },
  sunset_glow: {
    id: 'sunset_glow',
    name: 'Sunset Warm Glow',
    nameMizo: 'Ni tlak ruai (Sunset Gradient)',
    bgClass: 'bg-gradient-to-r from-orange-500 via-rose-600 to-purple-700',
    textClass: 'text-white',
    borderClass: 'border-rose-400 shadow-rose-200/50',
    badgeBg: 'bg-white/25',
    badgeText: 'text-white',
    previewColor: '#f97316'
  },
  ocean_blue: {
    id: 'ocean_blue',
    name: 'Ocean Cyan & Deep Blue',
    nameMizo: 'Tuifinriat Pawl (Ocean Blue)',
    bgClass: 'bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-800',
    textClass: 'text-white',
    borderClass: 'border-cyan-400 shadow-cyan-200/50',
    badgeBg: 'bg-white/25',
    badgeText: 'text-white',
    previewColor: '#0284c7'
  },
  rose_berry: {
    id: 'rose_berry',
    name: 'Rose Berry & Pink',
    nameMizo: 'Senduk & Hnute hring (Rose)',
    bgClass: 'bg-gradient-to-r from-pink-600 via-rose-600 to-red-600',
    textClass: 'text-white',
    borderClass: 'border-pink-400 shadow-pink-200/50',
    badgeBg: 'bg-white/25',
    badgeText: 'text-white',
    previewColor: '#db2777'
  },
  gold_vip: {
    id: 'gold_vip',
    name: 'Radiant Gold / VIP',
    nameMizo: 'Rangkachak (VIP Golden)',
    bgClass: 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500',
    textClass: 'text-slate-950 font-medium',
    borderClass: 'border-amber-300 shadow-amber-200/50',
    badgeBg: 'bg-black/20',
    badgeText: 'text-slate-950',
    previewColor: '#eab308'
  },
  clean_light: {
    id: 'clean_light',
    name: 'Clean Light & Pearl',
    nameMizo: 'Var Thianghlim (Clean White)',
    bgClass: 'bg-white',
    textClass: 'text-slate-900',
    borderClass: 'border-slate-200 shadow-slate-100',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    previewColor: '#f8fafc'
  }
};

export interface HeightPresetDefinition {
  id: string;
  name: string;
  nameMizo: string;
  containerMinHeightClass: string;
  mediaHeightClass: string;
  mediaHeightPx: number;
  containerHeightPx?: number;
}

export const ANNOUNCEMENT_HEIGHT_PRESETS: Record<string, HeightPresetDefinition> = {
  auto: {
    id: 'auto',
    name: 'Auto / Flexible',
    nameMizo: 'Auto (A zat zat mil zelin)',
    containerMinHeightClass: '',
    mediaHeightClass: 'aspect-video sm:aspect-[21/9] max-h-56',
    mediaHeightPx: 200
  },
  compact: {
    id: 'compact',
    name: 'Compact Equal (180px)',
    nameMizo: 'Tawi In-ang tlang (180px)',
    containerMinHeightClass: 'min-h-[180px]',
    mediaHeightClass: 'h-28 sm:h-32',
    mediaHeightPx: 120,
    containerHeightPx: 180
  },
  medium: {
    id: 'medium',
    name: 'Medium Standard (240px)',
    nameMizo: 'Standard In-ang tlang (240px)',
    containerMinHeightClass: 'min-h-[240px]',
    mediaHeightClass: 'h-36 sm:h-44',
    mediaHeightPx: 160,
    containerHeightPx: 240
  },
  tall: {
    id: 'tall',
    name: 'Tall Banner (320px)',
    nameMizo: 'Lian / Sang In-ang tlang (320px)',
    containerMinHeightClass: 'min-h-[320px]',
    mediaHeightClass: 'h-48 sm:h-56',
    mediaHeightPx: 220,
    containerHeightPx: 320
  },
  extra_tall: {
    id: 'extra_tall',
    name: 'Extra Tall / Cinema (400px)',
    nameMizo: 'Lian Fal / Cinema (400px)',
    containerMinHeightClass: 'min-h-[400px]',
    mediaHeightClass: 'h-64 sm:h-72',
    mediaHeightPx: 280,
    containerHeightPx: 400
  }
};

/**
 * Extracts and normalizes media URLs, with special handling for Canva designs
 */
export function parseMediaUrl(inputUrl?: string): ParsedMedia | null {
  if (!inputUrl || typeof inputUrl !== 'string') return null;
  const trimmed = inputUrl.trim();
  if (!trimmed) return null;

  // Check if raw iframe code was pasted
  const iframeSrcMatch = trimmed.match(/src=["']([^"']+)["']/i);
  const actualUrl = iframeSrcMatch ? iframeSrcMatch[1] : trimmed;

  // 1. Canva Design Detection
  if (actualUrl.includes('canva.com/design/')) {
    // Examples:
    // https://www.canva.com/design/DAHTTgdvhsU/77qJSQZdradri_piWLrIzw/edit?category=tACFapY0WQc
    // https://www.canva.com/design/DAHTTgdvhsU/77qJSQZdradri_piWLrIzw/view
    // https://www.canva.com/design/DAHTTgdvhsU/view?embed
    try {
      const urlObj = new URL(actualUrl.startsWith('http') ? actualUrl : `https://${actualUrl}`);
      const pathParts = urlObj.pathname.split('/').filter(Boolean); // ['design', 'DAHTTgdvhsU', '77qJSQZdradri_piWLrIzw', 'edit']
      
      const designIdx = pathParts.indexOf('design');
      if (designIdx !== -1 && pathParts.length > designIdx + 1) {
        const id1 = pathParts[designIdx + 1];
        const id2 = pathParts.length > designIdx + 2 && !['edit', 'view', 'watch'].includes(pathParts[designIdx + 2])
          ? pathParts[designIdx + 2]
          : '';

        const basePath = id2 ? `/design/${id1}/${id2}` : `/design/${id1}`;
        const embedUrl = `https://www.canva.com${basePath}/view?embed`;
        const canvaViewUrl = `https://www.canva.com${basePath}/view`;

        return {
          type: 'canva',
          embedUrl,
          originalUrl: actualUrl,
          isCanva: true,
          canvaViewUrl
        };
      }
    } catch {
      // fallback if regex parsing needed
      const match = actualUrl.match(/canva\.com\/design\/([a-zA-Z0-9_-]+)(?:\/([a-zA-Z0-9_-]+))?/);
      if (match) {
        const id1 = match[1];
        const id2 = match[2] && !['edit', 'view'].includes(match[2]) ? `/${match[2]}` : '';
        const embedUrl = `https://www.canva.com/design/${id1}${id2}/view?embed`;
        return {
          type: 'canva',
          embedUrl,
          originalUrl: actualUrl,
          isCanva: true,
          canvaViewUrl: `https://www.canva.com/design/${id1}${id2}/view`
        };
      }
    }
  }

  // 2. Data URL Image (base64)
  if (actualUrl.startsWith('data:image/')) {
    return {
      type: actualUrl.includes('image/gif') ? 'gif' : 'image',
      embedUrl: actualUrl,
      originalUrl: actualUrl,
      isCanva: false
    };
  }

  // 3. GIF / Animation Detection
  if (/\.(gif)($|\?)/i.test(actualUrl) || actualUrl.includes('giphy.com') || actualUrl.includes('tenor.com')) {
    return {
      type: 'gif',
      embedUrl: actualUrl,
      originalUrl: actualUrl,
      isCanva: false
    };
  }

  // 4. Standard Images (JPG, PNG, WebP, SVG, Unsplash, etc.)
  if (/\.(jpeg|jpg|png|webp|svg|bmp)($|\?)/i.test(actualUrl) || actualUrl.includes('images.unsplash.com') || actualUrl.includes('i.imgur.com') || actualUrl.includes('cloudinary.com') || actualUrl.includes('postimg.cc') || actualUrl.includes('ibb.co')) {
    return {
      type: 'image',
      embedUrl: actualUrl,
      originalUrl: actualUrl,
      isCanva: false
    };
  }

  // 5. Generic embed / iframe or unknown link
  return {
    type: 'image', // default treat as image/media
    embedUrl: actualUrl,
    originalUrl: actualUrl,
    isCanva: false
  };
}

/**
 * Suggested Media & Animation Presets for Announcements
 */
export const ANNOUNCEMENT_MEDIA_PRESETS = [
  {
    name: 'Canva Design Sample (Church & Community)',
    url: 'https://www.canva.com/design/DAHTTgdvhsU/77qJSQZdradri_piWLrIzw/view?embed',
    type: 'canva',
    description: 'Interactive Canva Slide/Banner with animation'
  },
  {
    name: 'Emergency / Urgent Alert Banner (Red Wave)',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop',
    type: 'image',
    description: 'High-contrast abstract alert banner'
  },
  {
    name: 'Kohhran / Worship & Fellowship Theme',
    url: 'https://images.unsplash.com/photo-1544427920-c49ccfb85579?q=80&w=800&auto=format&fit=crop',
    type: 'image',
    description: 'Serene warm sunset church & prayer banner'
  },
  {
    name: 'Digital UPI & BBPS Pay Tech Banner',
    url: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?q=80&w=800&auto=format&fit=crop',
    type: 'image',
    description: 'Fast digital payment & verification theme'
  },
  {
    name: 'Celebration & Festival Banner',
    url: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?q=80&w=800&auto=format&fit=crop',
    type: 'image',
    description: 'Golden confetti & festive event banner'
  }
];
