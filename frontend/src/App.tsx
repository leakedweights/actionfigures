import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// Auth Page Component
const AuthPage = ({ onAuthenticate }: { onAuthenticate: () => void }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleAuthenticate = () => {
    if (email && password) {
      onAuthenticate();
    }
  };

  return (
    <div className="h-screen bg-[#FFF5F9] flex items-center justify-center relative overflow-hidden">
      <div className="relative z-10 w-full max-w-md px-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="font-medium text-[#FF0066]">imgto3d</h1>

          <div>
            <button
              onClick={() => setIsLogin(true)}
              className={`font-medium mr-2 cursor-pointer ${isLogin ? 'text-[#FF0066]' : 'text-[#FFB3D9]'}`}
            >
              login
            </button>
            <span className="text-[#FFB3D9]">/</span>
            <button
              onClick={() => setIsLogin(false)}
              className={`font-medium ml-2 cursor-pointer ${!isLogin ? 'text-[#FF0066]' : 'text-[#FFB3D9]'}`}
            >
              sign up
            </button>
          </div>
        </div>

        <div className="space-y-6">
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

          <div className="flex justify-end">
            <button
              onClick={handleAuthenticate}
              className="text-[#FF0066] font-medium hover:scale-105 transition-transform cursor-pointer"
            >
              authenticate
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

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xFFD9ED);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 5;
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create a placeholder 3D model (cube)
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const material = new THREE.MeshPhongMaterial({
      color: 0xFF0066,
      shininess: 100
    });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);
    cubeRef.current = cube;

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      if (cubeRef.current) {
        cubeRef.current.rotation.x += 0.01;
        cubeRef.current.rotation.y += 0.01;
      }
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;

      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
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
const MainPage = ({ onSignOut }: { onSignOut: () => void }) => {
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [instructions, setInstructions] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generated3DModel, setGenerated3DModel] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    // Placeholder for 2D generation
    // In real implementation, this would call the backend API
    setGeneratedImage('https://via.placeholder.com/300x400/FF0066/FFFFFF?text=2D+Model');
  };

  const handleGenerate3D = () => {
    // Placeholder for 3D generation
    // In real implementation, this would call the backend API
    setGenerated3DModel('placeholder-3d-model');
  };

  useEffect(() => {
    // Auto-generate 2D when instructions change (with debounce)
    const timer = setTimeout(() => {
      if (instructions.trim()) {
        handleGenerate2D();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [instructions]);

  return (
    <div className="h-screen bg-[#FFF5F9] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center p-6 flex-shrink-0">
        <h1 className="font-medium text-[#FF0066]">imgto3d</h1>
        <button
          onClick={onSignOut}
          className="text-[#FF0066] font-medium hover:scale-105 transition-transform cursor-pointer"
        >
          Sign Out
        </button>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 px-6 pb-6 flex-1 min-h-0">
        {/* Left Column - Reference Image + Instructions */}
        <div className="flex flex-col gap-4 min-h-0">
          {/* Reference Image */}
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

          {/* Instructions */}
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

        {/* Center Column - 2D Model */}
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

        {/* Right Column - 3D Figure */}
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
              Create Figure
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
      {isAuthenticated ? (
        <MainPage onSignOut={() => setIsAuthenticated(false)} />
      ) : (
        <AuthPage onAuthenticate={() => setIsAuthenticated(true)} />
      )}
    </div>
  );
};

export default App;