import { API_URL } from './constants';


export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};


export const normalizeImageUrl = (path: string | null | undefined): string | null => {
  if (!path) return null;
  
  if (path.startsWith('http') || path.startsWith('data:')) {
    return path;
  }
  
  return `${API_URL}/${path}`;
};

export const normalizeModelUrl = (path: string | null | undefined): string | null => {
  if (!path) return null;
  
  if (path === 'placeholder-3d-model') {
    return 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Binary/Duck.glb';
  }
  
  if (path.startsWith('http')) {
    return path;
  }
  return `${API_URL}/${path}`;
};

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

export const isValidImageType = (type: string, validTypes: string[]): boolean => {
  return validTypes.includes(type);
};

export const loadImageDimensions = (src: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = reject;
    img.src = src;
  });
};
