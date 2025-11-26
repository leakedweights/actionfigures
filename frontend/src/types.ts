// Core domain types
export interface User {
  id: number;
  username: string;
  email: string;
}

export interface Model {
  id: number;
  instructions: string | null;
  reference_image_path: string | null;
  generated_2d_path: string | null;
  generated_3d_path: string | null;
  is_public: boolean;
  created_at: string;
  owner?: User;
}

export interface FileDetails {
  name: string;
  size: string;
  resolution: string;
}

// Auth types
export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface AuthState {
  token: string;
  user: User;
}

// Modal types
export type ModalMode = 'save' | 'download' | 'rename';
export type ConfirmAction = 'delete' | 'toggle_public';
export type ActiveTab = 'create' | 'library' | 'public';

// API Request/Response types
export interface CreateModelRequest {
  instructions?: string;
  reference_image_path?: string;
  generated_2d_path?: string;
  generated_3d_path?: string;
  is_public?: boolean;
}

export interface UpdateModelRequest {
  instructions?: string;
  reference_image_path?: string;
  generated_2d_path?: string;
  generated_3d_path?: string;
  is_public?: boolean;
}

export interface Generate2DRequest {
  instructions: string;
  file?: File;
}

export interface Generate2DResponse {
  image_url: string;
}
