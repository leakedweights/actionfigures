// API Configuration
export const API_URL = '';

// File Upload Configuration
export const VALID_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Polling Configuration
export const POLL_INTERVAL_MS = 2000;
export const MAX_POLL_RETRIES = 60;

// Color Palette
export const COLORS = {
  primary: '#FF0066',
  primaryHover: '#E6005C',
  secondary: '#FFB3D9',
  background: '#FFF5F9',
  panel: '#FFD9ED',
  accent: '#FFC4E1',
  viewerBg: 0xFFD9ED,
  modelColor: 0xFF4D94,
} as const;

// Three.js Configuration
export const CAMERA_FOV = 75;
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 1000;
export const CAMERA_POSITION = { x: 0, y: 1, z: 3 };
export const TONE_MAPPING_EXPOSURE = 1.3;

// Placeholder Model URL
export const PLACEHOLDER_MODEL_URL = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Binary/Duck.glb';
export const PLACEHOLDER_MODEL_ID = 'placeholder-3d-model';
