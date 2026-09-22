/**
 * Lightweight client-side image compressor.
 * Converts any image file to a compressed JPEG base64 string (<50KB)
 * so it doesn't slow down the mobile app, crash localStorage, or exceed Firestore 1MB limits.
 */
export const compressImageFile = (
  file: File, 
  maxWidth: number = 400, 
  maxHeight: number = 400, 
  quality: number = 0.8
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (!src) {
        reject(new Error('Failed to read file as DataURL'));
        return;
      }
      compressDataUrl(src, maxWidth, maxHeight, quality)
        .then(resolve)
        .catch(reject);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

/**
 * Checks whether an image string is an oversized Data URL that needs compression
 * before saving to localStorage or Firebase Firestore (Firestore limit is 1MB).
 */
export const isLargeDataUrl = (url?: string): boolean => {
  if (!url) return false;
  return url.startsWith('data:') && url.length > 80000; // >80KB
};

/**
 * Compress an existing DataURL string to maximum dimensions and specified JPEG quality.
 * Safe for multi-browser and mobile device synchronization.
 */
export const compressDataUrl = (
  dataUrl: string, 
  maxWidth: number = 400, 
  maxHeight: number = 400, 
  quality: number = 0.8
): Promise<string> => {
  return new Promise((resolve) => {
    if (!dataUrl || typeof dataUrl !== 'string') {
      resolve(dataUrl);
      return;
    }
    // If not a data URL or already compact (<40KB), resolve directly
    if (!dataUrl.startsWith('data:') || dataUrl.length < 40000) {
      resolve(dataUrl);
      return;
    }
    if (typeof window === 'undefined') {
      resolve(dataUrl);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let width = img.width || 400;
        let height = img.height || 400;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = Math.max(width, 1);
        canvas.height = Math.max(height, 1);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        // Draw with white background in case of transparent PNG converted to JPEG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      } catch (e) {
        console.warn('DataURL compression fallback:', e);
        resolve(dataUrl);
      }
    };
    img.onerror = () => {
      resolve(dataUrl);
    };
    img.src = dataUrl;
  });
};

