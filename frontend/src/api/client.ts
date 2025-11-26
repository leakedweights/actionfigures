import type {
    CreateModelRequest,
    Generate2DResponse,
    LoginResponse,
    Model,
    UpdateModelRequest,
    User,
} from '../types';
import { API_URL } from '../utils/constants';
import { handleApiError } from './errors';

export class ApiClient {
  private baseURL: string;

  constructor(baseURL: string = API_URL) {
    this.baseURL = baseURL;
  }

  // Auth endpoints
  async register(username: string, email: string, password: string): Promise<LoginResponse> {
    const response = await fetch(`${this.baseURL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    if (!response.ok) await handleApiError(response, 'Registration failed');
    return response.json();
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await fetch(`${this.baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) await handleApiError(response, 'Login failed');
    return response.json();
  }

  async getMe(token: string): Promise<User> {
    const response = await fetch(`${this.baseURL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) await handleApiError(response, 'Failed to get user info');
    return response.json();
  }

  // Model endpoints
  async getModels(token: string, tokenType: string = 'Bearer'): Promise<Model[]> {
    const response = await fetch(`${this.baseURL}/api/models`, {
      headers: { Authorization: `${tokenType} ${token}` },
    });
    if (!response.ok) await handleApiError(response, 'Failed to fetch models');
    return response.json();
  }

  async getPublicModels(search?: string): Promise<Model[]> {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    const response = await fetch(`${this.baseURL}/api/public/models${query}`);
    if (!response.ok) await handleApiError(response, 'Failed to fetch public models');
    return response.json();
  }

  async getModel(token: string, modelId: number): Promise<Model> {
    const response = await fetch(`${this.baseURL}/api/models/${modelId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) await handleApiError(response, 'Failed to fetch model');
    return response.json();
  }

  async createModel(token: string, modelData: CreateModelRequest): Promise<Model> {
    const response = await fetch(`${this.baseURL}/api/models`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(modelData),
    });
    if (!response.ok) await handleApiError(response, 'Failed to create model');
    return response.json();
  }

  async updateModel(token: string, modelId: number, modelData: UpdateModelRequest): Promise<Model> {
    const response = await fetch(`${this.baseURL}/api/models/${modelId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(modelData),
    });
    if (!response.ok) await handleApiError(response, 'Failed to update model');
    return response.json();
  }

  async deleteModel(token: string, modelId: number): Promise<void> {
    const response = await fetch(`${this.baseURL}/api/models/${modelId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) await handleApiError(response, 'Failed to delete model');
  }

  // Generation endpoints
  async generate(token: string, file: File): Promise<Model> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${this.baseURL}/api/generate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) await handleApiError(response, 'Generation failed');
    return response.json();
  }

  async generate2D(token: string, instructions: string, file?: File): Promise<Generate2DResponse> {
    const formData = new FormData();
    formData.append('instructions', instructions);
    if (file) {
      formData.append('file', file);
    }

    const response = await fetch(`${this.baseURL}/api/generate-2d`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) await handleApiError(response, 'Failed to generate 2D image');
    return response.json();
  }
}

// Export singleton instance
export const api = new ApiClient();
