import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const API_URL = 'http://localhost:8000';

// API Functions
const api = {
  register: async (username: string, email: string, password: string) => {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Registration failed');
    }
    return response.json();
  },

  login: async (email: string, password: string) => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    }
    return response.json();
  },

  getMe: async (token: string) => {
    const response = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to get user info');
    return response.json();
  },

  getModels: async (token: string) => {
    const response = await fetch(`${API_URL}/api/models`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch models');
    return response.json();
  },

  createModel: async (token: string, modelData: any) => {
    const response = await fetch(`${API_URL}/api/models`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(modelData),
    });
    if (!response.ok) throw new Error('Failed to create model');
    return response.json();
  },

  updateModel: async (token: string, modelId: number, modelData: any) => {
    const response = await fetch(`${API_URL}/api/models/${modelId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(modelData),
    });
    if (!response.ok) throw new Error('Failed to update model');
    return response.json();
  },

  deleteModel: async (token: string, modelId: number) => {
    const response = await fetch(`${API_URL}/api/models/${modelId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to delete model');
  },
};

// Auth Page Component
const AuthPage = ({ onAuthenticate }: { onAuthenticate: (token: string, user: any) => void }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuthenticate = async () => {
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const data = await api.login(email, password);
        const user = await api.getMe(data.access_token);
        onAuthenticate(data.access_token, user);
      } else {
        if (!username) {
          setError('Username is required');
          setLoading(false);
          return;
        }
        await api.register(username, email, password);
        const data = await api.login(email, password);
        const user = await api.getMe(data.access_token);
        onAuthenticate(data.access_token, user);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-[#FFF5F9] flex items-center justify-center relative overflow-hidden">
      <div className="relative z-10 w-full max-w-md px-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="font-medium text-[#FF0066]">imgto3d</h1>

          <div>
            <button
              onClick={() => {
                setIsLogin(true);
                setError('');
              }}
              className={`font-medium mr-2 cursor-pointer ${isLogin ? 'text-[#FF0066]' : 'text-[#FFB3D9]'}`}
            >
              login
            </button>
            <span className="text-[#FFB3D9]">/</span>
            <button
              onClick={() => {
                setIsLogin(false);
                setError('');
              }}
              className={`font-medium ml-2 cursor-pointer ${!isLogin ? 'text-[#FF0066]' : 'text-[#FFB3D9]'}`}
            >
              sign up
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {!isLogin && (
            <div className="border-2 border-[#FF0066] bg-[#FFC4E1]">
              <label className="block text-[#FF0066] font-medium p-2 border-b-2 border-[#FF0066]">
                username:
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-3 bg-[#FFD9ED] text-[#FF0066] font-medium outline-none placeholder-[#FFB3D9]"
              />
            </div>
          )}

          <div className="border-2 border-[#FF0066] bg-[#FFC4E1]">
            <label className="block text-[#FF0066] font-medium p-2 border-b-2 border-[#FF0066]">
              email:
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 bg-[#FFD9ED] text-[#FF0066] font-medium outline-none placeholder-[#FFB3D9]"
            />
          </div>

          <div className="border-2 border-[#FF0066] bg-[#FFC4E1]">
            <label className="block text-[#FF0066] font-medium p-2 border-b-2 border-[#FF0066]">
              password:
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-[#FFD9ED] text-[#FF0066] font-medium outline-none placeholder-[#FFB3D9]"
            />
          </div>

          {error && (
            <div className="text-[#FF0066] font-medium text-sm text-center">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleAuthenticate}
              disabled={loading}
              className="text-[#FF0066] font-medium hover:scale-105 transition-transform cursor-pointer disabled:opacity-50"
            >
              {loading ? 'please wait...' : 'authenticate'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// 3D Viewer Component
const ThreeDViewer = ({ modelData }: { modelData: string | null }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const cubeRef = useRef<THREE.Mesh | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xFFD9ED);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 5;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const material = new THREE.MeshPhongMaterial({
      color: 0xFF0066,
      shininess: 100
    });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);
    cubeRef.current = cube;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    const animate = () => {
      requestAnimationFrame(animate);
      if (cubeRef.current) {
        cubeRef.current.rotation.x += 0.01;
        cubeRef.current.rotation.y += 0.01;
      }
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;

      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && rendererRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current?.dispose();
    };
  }, [modelData]);

  return <div ref={mountRef} className="w-full h-full" />;
};

// Main Control Page Component
const MainPage = ({ token, user, onSignOut }: { token: string; user: any; onSignOut: () => void }) => {
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [instructions, setInstructions] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generated3DModel, setGenerated3DModel] = useState<string | null>(null);
  const [currentModelId, setCurrentModelId] = useState<number | null>(null);
  const [savedModels, setSavedModels] = useState<any[]>([]);
  const [showModels, setShowModels] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      const models = await api.getModels(token);
      setSavedModels(models);
    } catch (err) {
      console.error('Failed to load models:', err);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setReferenceImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate2D = () => {
    setGeneratedImage('https://via.placeholder.com/300x400/FF0066/FFFFFF?text=2D+Model');
  };

  const handleGenerate3D = async () => {
    setGenerated3DModel('placeholder-3d-model');

    try {
      const modelData = {
        reference_image_path: referenceImage || null,
        instructions: instructions || null,
        generated_2d_path: generatedImage || null,
        generated_3d_path: 'placeholder-3d-model',
      };

      if (currentModelId) {
        await api.updateModel(token, currentModelId, modelData);
      } else {
        const newModel = await api.createModel(token, modelData);
        setCurrentModelId(newModel.id);
      }

      await loadModels();
    } catch (err) {
      console.error('Failed to save model:', err);
    }
  };

  const handleLoadModel = (model: any) => {
    setReferenceImage(model.reference_image_path);
    setInstructions(model.instructions || '');
    setGeneratedImage(model.generated_2d_path);
    setGenerated3DModel(model.generated_3d_path);
    setCurrentModelId(model.id);
    setShowModels(false);
  };

  const handleDeleteModel = async (modelId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteModel(token, modelId);
      await loadModels();
      if (currentModelId === modelId) {
        handleNewModel();
      }
    } catch (err) {
      console.error('Failed to delete model:', err);
    }
  };

  const handleNewModel = () => {
    setReferenceImage(null);
    setInstructions('');
    setGeneratedImage(null);
    setGenerated3DModel(null);
    setCurrentModelId(null);
    setShowModels(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (instructions.trim()) {
        handleGenerate2D();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [instructions]);

  return (
    <div className="h-screen bg-[#FFF5F9] flex flex-col overflow-hidden">
      <div className="flex justify-between items-center p-6 flex-shrink-0">
        <h1 className="font-medium text-[#FF0066]">imgto3d</h1>
        <div className="flex gap-16 items-center">
          <button
            onClick={handleNewModel}
            className="text-[#FF0066] font-medium hover:scale-105 transition-transform cursor-pointer"
          >
            New
          </button>
          <button
            onClick={() => setShowModels(!showModels)}
            className="text-[#FF0066] font-medium hover:scale-105 transition-transform cursor-pointer"
          >
            {showModels ? 'hide models' : `my models (${savedModels.length})`}
          </button>
          <button
            onClick={onSignOut}
            className="text-[#FF0066] font-medium hover:scale-105 transition-transform cursor-pointer"
          >
            sign out
          </button>
        </div>
      </div>

      {showModels && (
        <div className="px-6 pb-4 flex-shrink-0">
          <div className="border-2 border-[#FF0066] bg-[#FFD9ED] p-4 max-h-40 overflow-y-auto">
            {savedModels.length === 0 ? (
              <p className="text-[#FFB3D9] font-medium">no saved models yet</p>
            ) : (
              <div className="space-y-2">
                {savedModels.map((model) => (
                  <div
                    key={model.id}
                    onClick={() => handleLoadModel(model)}
                    className="flex justify-between items-center bg-[#FFC4E1] p-2 cursor-pointer hover:bg-[#FFB3D9] transition-colors"
                  >
                    <span className="text-[#FF0066] font-medium truncate">
                      {model.instructions?.substring(0, 50) || 'untitled model'} - {new Date(model.created_at).toLocaleDateString()}
                    </span>
                    <button
                      onClick={(e) => handleDeleteModel(model.id, e)}
                      className="text-[#FF0066] font-medium ml-2 hover:scale-110 transition-transform"
                    >
                      delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 px-6 pb-6 flex-1 min-h-0">
        <div className="flex flex-col gap-4 min-h-0">
          <div className="border-2 border-[#FF0066] flex-1 flex flex-col min-h-0">
            <div className="bg-[#FFC4E1] border-b-2 border-[#FF0066] p-2 flex-shrink-0">
              <h2 className="text-[#FF0066] font-medium">reference image</h2>
            </div>
            <div
              className="bg-[#FFD9ED] flex-1 flex items-center justify-center hover:bg-[#FFC4E1] transition-colors min-h-0 cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              {referenceImage ? (
                <img src={referenceImage} alt="Reference" className="max-w-full max-h-full object-contain" />
              ) : (
                <span className="text-[#FF0066] font-medium">click to add</span>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>

          <div className="border-2 border-[#FF0066] flex-1 flex flex-col min-h-0">
            <div className="bg-[#FFC4E1] border-b-2 border-[#FF0066] p-2 flex-shrink-0">
              <h2 className="text-[#FF0066] font-medium">instructions</h2>
            </div>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="describe your figure..."
              className="flex-1 w-full bg-[#FFD9ED] p-4 text-[#FF0066] font-medium outline-none resize-none placeholder-[#FFB3D9] min-h-0"
            />
          </div>
        </div>

        <div className="border-2 border-[#FF0066] flex flex-col min-h-0">
          <div className="bg-[#FFC4E1] border-b-2 border-[#FF0066] p-2 flex-shrink-0">
            <h2 className="text-[#FF0066] font-medium">2D Figure</h2>
          </div>
          <div className="bg-[#FFD9ED] flex-1 flex items-center justify-center min-h-0">
            {generatedImage ? (
              <img src={generatedImage} alt="2D Figure" className="max-w-full max-h-full object-contain" />
            ) : (
              <span className="text-[#FFB3D9] font-medium">waiting for generation...</span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 min-h-0">
          <div className="border-2 border-[#FF0066] flex-1 flex flex-col min-h-0">
            <div className="bg-[#FFC4E1] border-b-2 border-[#FF0066] p-2 flex-shrink-0">
              <h2 className="text-[#FF0066] font-medium">3D Model</h2>
            </div>
            <div className="bg-[#FFD9ED] flex-1 min-h-0">
              {generated3DModel ? (
                <ThreeDViewer modelData={generated3DModel} />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-[#FFB3D9] font-medium">3D Model Will Appear Here</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end flex-shrink-0">
            <button
              onClick={handleGenerate3D}
              disabled={!generatedImage}
              className="bg-[#FF0066] text-white font-medium px-8 py-3 hover:bg-[#E6005C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {currentModelId ? 'update figure' : 'create figure'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main App Component
const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  const handleAuthenticate = (authToken: string, userData: any) => {
    setToken(authToken);
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handleSignOut = () => {
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <div className="font-['DM_Mono',monospace]" style={{ textTransform: 'uppercase', fontSize: '16px' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&display=swap');
        
        * {
          text-transform: uppercase;
        }
        
        input::placeholder,
        textarea::placeholder {
          text-transform: uppercase;
        }
        
        button, [role="button"] {
          cursor: pointer;
        }
      `}</style>
      {isAuthenticated && token && user ? (
        <MainPage token={token} user={user} onSignOut={handleSignOut} />
      ) : (
        <AuthPage onAuthenticate={handleAuthenticate} />
      )}
    </div>
  );
};

export default App;