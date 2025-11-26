import { API_URL } from './constants';

/**
 * Formats file size in bytes to human-readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

/**
 * Normalizes image URLs to handle relative paths and data URIs
 */
export const normalizeImageUrl = (path: string | null | undefined): string | null => {
  if (!path) return null;
  
  // Already absolute URL or data URI
  if (path.startsWith('http') || path.startsWith('data:')) {
    return path;
  }
  
  // Relative path - prepend API_URL
  return `${API_URL}/${path}`;
};

/**
 * Normalizes model URLs, handling placeholder models
 */
export const normalizeModelUrl = (path: string | null | undefined): string | null => {
  if (!path) return null;
  
  // Handle placeholder
  if (path === 'placeholder-3d-model') {
    return 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Binary/Duck.glb';
  }
  
  // Already absolute URL
  if (path.startsWith('http')) {
    return path;
  }
  
  // Relative path - prepend API_URL
  return `${API_URL}/${path}`;
};

/**
 * Downloads a file from a URL
 */
export const downloadFile = async (url: string, filename: string): Promise<void> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename.endsWith('.glb') ? filename : `${filename}.glb`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Download failed, trying direct link', error);
    // Fallback to direct link if fetch fails (e.g. CORS)
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.glb') ? filename : `${filename}.glb`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

/**
 * Validates image file type
 */
export const isValidImageType = (type: string, validTypes: string[]): boolean => {
  return validTypes.includes(type);
};

/**
 * Loads image dimensions from a URL or data URI
 */
export const loadImageDimensions = (src: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = reject;
    img.src = src;
  });
};
