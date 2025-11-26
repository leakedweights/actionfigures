import React, { useEffect, useRef, useState } from 'react';
import { api } from './api/client';
import { AuthPage } from './components/auth/AuthPage';
import { ConfirmationModal } from './components/common/ConfirmationModal';
import { ErrorModal } from './components/common/ErrorModal';
import { SaveModal } from './components/common/SaveModal';
import type { User } from './types';
import { API_URL } from './utils/constants';
import { ThreeDViewer } from './viewer/ThreeDViewer';

// Main Control Page Component
const MainPage = ({ token, onSignOut }: { token: string; user: User; onSignOut: () => void }) => {
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [instructions, setInstructions] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generated3DModel, setGenerated3DModel] = useState<string | null>(null);
  const [currentModelId, setCurrentModelId] = useState<number | null>(null);
  const [savedModels, setSavedModels] = useState<any[]>([]);
  const [publicModels, setPublicModels] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'create' | 'library' | 'public'>('create');
  const [searchQuery, setSearchQuery] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerating2D, setIsGenerating2D] = useState(false);
  const [fileDetails, setFileDetails] = useState<{ name: string, size: string, resolution: string } | null>(null);

  const [rotation, setRotation] = useState(0);
  const [_error, setError] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'save' | 'download' | 'rename'>('save');
  const [modalFilename, setModalFilename] = useState('');
  const [targetModelId, setTargetModelId] = useState<number | null>(null);

  // Error Modal State
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Confirmation Modal State
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'delete' | 'toggle_public' | null>(null);
  const [confirmModel, setConfirmModel] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadModels();
  }, []);

  useEffect(() => {
    if (activeTab === 'library') {
      loadModels();
    } else if (activeTab === 'public') {
      loadPublicModels();
    }
  }, [activeTab]);

  const loadModels = async () => {
    try {
      const models = await api.getModels(token);
      setSavedModels(models);
    } catch (err) {
      console.error('Failed to load models:', err);
    }
  };

  const loadPublicModels = async (search?: string) => {
    try {
      const models = await api.getPublicModels(search);
      setPublicModels(models);
    } catch (err) {
      console.error('Failed to load public models:', err);
    }
  };

  const handleSearchPublic = (e: React.FormEvent) => {
    e.preventDefault();
    loadPublicModels(searchQuery);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        setErrorMessage('Unsupported file format. Please upload PNG, JPG, or WEBP.');
        setErrorModalOpen(true);
        e.target.value = '';
        return;
      }

      setReferenceFile(file);

      let sizeDisplay = '';
      if (file.size < 1024 * 1024) {
        sizeDisplay = `${(file.size / 1024).toFixed(2)} KB`;
      } else {
        sizeDisplay = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setReferenceImage(result);

        const img = new Image();
        img.onload = () => {
          setFileDetails({
            name: file.name,
            size: sizeDisplay,
            resolution: `${img.width}x${img.height}`
          });
        };
        img.src = result;
      };
      reader.readAsDataURL(file);
    }
    // Clear input so same file can be selected again
    e.target.value = '';
  };

  const pollStatus = async (id: number) => {
    const maxRetries = 60;
    let retries = 0;

    const checkStatus = async () => {
      try {
        const model = await api.getModel(token, id);
        if (model.generated_3d_path) {
          setGenerated3DModel(model.generated_3d_path);
          setIsGenerating(false);
          // Auto-save update to get the generated path in the list
          loadModels();
          return true;
        }
      } catch (e) {
        console.error('Error polling status:', e);
      }
      return false;
    };

    const interval = setInterval(async () => {
      const done = await checkStatus();
      if (done || retries >= maxRetries) {
        clearInterval(interval);
        if (!done) {
          setIsGenerating(false);
          setErrorMessage('Generation timed out');
          setErrorModalOpen(true);
        }
      }
      retries++;
    }, 2000);
  };

  const handleGenerate2D = async () => {
    if (!instructions && !referenceFile) return;

    setIsGenerating2D(true);
    try {
      const formData = new FormData();
      formData.append('instructions', instructions || 'Generate a 2D figure based on the reference image.');
      if (referenceFile) {
        formData.append('file', referenceFile);
      }

      const response = await fetch(`${API_URL}/api/generate-2d`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to generate 2D image');
      }

      const data = await response.json();
      setGeneratedImage(data.image_url);
    } catch (error: any) {
      console.error('Error generating 2D image:', error);
      setErrorMessage(error.message || 'Failed to generate 2D image');
      setErrorModalOpen(true);
    } finally {
      setIsGenerating2D(false);
    }
  };

  const handleGenerate3D = async () => {
    if ((!referenceFile && !generatedImage) || isGenerating) return;

    setIsGenerating(true);
    setError(null);

    try {
      // If we have a generated 2D image, use that. Otherwise use the uploaded file.
      // If using generated 2D image, we need to fetch it as a blob to upload it to the 3D endpoint

      let fileToUpload = referenceFile;

      if (generatedImage && !referenceFile) {
        const response = await fetch(generatedImage);
        const blob = await response.blob();
        fileToUpload = new File([blob], "generated_2d.png", { type: "image/png" });
      } else if (generatedImage && referenceFile) {
        // If both exist, prefer the generated 2D image as it's the "approved" one in the flow
        const response = await fetch(generatedImage);
        const blob = await response.blob();
        fileToUpload = new File([blob], "generated_2d.png", { type: "image/png" });
      }

      if (!fileToUpload) {
        setErrorMessage("No image to generate 3D model from");
        setErrorModalOpen(true);
        setIsGenerating(false);
        return;
      }

      const formData = new FormData();
      formData.append('file', fileToUpload);

      const response = await fetch(`${API_URL}/api/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to start generation');
      }

      const newModel = await response.json();
      setCurrentModelId(newModel.id);
      setIsPublic(false);

      // Auto-update instructions if present
      if (instructions) {
        await api.updateModel(token, newModel.id, { instructions });
      }

      // Refresh library
      loadModels();

      // Start polling
      pollStatus(newModel.id);
    } catch (error) {
      console.error('Error starting generation:', error);
      setErrorMessage('Failed to start generation');
      setErrorModalOpen(true);
      setIsGenerating(false);
    }
  };



  const handleLoadModel = (model: any) => {
    // Handle Reference Image Path
    let refPath = model.reference_image_path;
    if (refPath && !refPath.startsWith('http') && !refPath.startsWith('data:')) {
      refPath = `${API_URL}/${refPath}`;
    }
    setReferenceImage(refPath);
    setReferenceFile(null); // Clear file so user must re-upload to regenerate

    // Don't populate instructions with the name/title to keep it clean
    setInstructions('');

    // Calculate details for file display
    if (refPath) {
      const i = new Image();
      i.onload = () => {
        // Approx size from base64
        let sizeStr = "Unknown";
        if (typeof refPath === 'string' && refPath.startsWith('data:')) {
          // Base64 length * 0.75 is approx byte size
          const sizeInBytes = Math.round((refPath.length * 3) / 4);
          if (sizeInBytes < 1024 * 1024) {
            sizeStr = `${(sizeInBytes / 1024).toFixed(2)} KB`;
          } else {
            sizeStr = `${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB`;
          }
        } else {
          // For URLs, we can't easily get size without a HEAD request, so just show resolution
          sizeStr = "Remote File";
        }

        setFileDetails({
          name: 'SAVED REFERENCE',
          size: sizeStr,
          resolution: `${i.width}x${i.height}`
        });
      };
      i.src = refPath;
    } else {
      setFileDetails(null);
    }

    // Handle Generated 2D Path
    let gen2dPath = model.generated_2d_path;
    if (gen2dPath && !gen2dPath.startsWith('http') && !gen2dPath.startsWith('data:')) {
      gen2dPath = `${API_URL}/${gen2dPath}`;
    }
    setGeneratedImage(gen2dPath);

    setGenerated3DModel(model.generated_3d_path);
    setCurrentModelId(model.id);
    setInstructions(model.instructions || '');
    setIsPublic(model.is_public);
    setActiveTab('create');
  };

  const handleDeleteModel = async (modelId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmModel({ id: modelId });
    setConfirmAction('delete');
    setConfirmModalOpen(true);
  };

  const handleDownloadModel = async (model: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = model.generated_3d_path === 'placeholder-3d-model'
      ? 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Binary/Duck.glb'
      : model.generated_3d_path;

    if (!url) return;

    const filename = model.instructions || `model-${model.id}`;
    const name = filename.endsWith('.glb') ? filename : `${filename}.glb`;

    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = name;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Download failed", err);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleRenameModel = (model: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setTargetModelId(model.id);
    setModalFilename(model.instructions || '');
    setModalMode('rename');
    setModalOpen(true);
  };

  const handleNewModel = () => {
    setReferenceImage(null);
    setReferenceFile(null);
    setFileDetails(null);
    setInstructions('');
    setGeneratedImage(null);
    setGenerated3DModel(null);
    setCurrentModelId(null);
    setIsPublic(false);
    setActiveTab('create');
  };



  const openDownloadModal = () => {
    setModalMode('download');
    setModalFilename(`model-${Date.now()}`);
    setModalOpen(true);
  };

  const handleTogglePublic = async () => {
    if (!currentModelId) return;
    setConfirmModel({ id: currentModelId, is_public: isPublic });
    setConfirmAction('toggle_public');
    setConfirmModalOpen(true);
  };

  const handleTogglePublicStatus = async (model: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmModel(model);
    setConfirmAction('toggle_public');
    setConfirmModalOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!confirmAction || !confirmModel) return;

    try {
      if (confirmAction === 'delete') {
        await api.deleteModel(token, confirmModel.id);
        await loadModels();
        if (currentModelId === confirmModel.id) {
          handleNewModel();
        }
      } else if (confirmAction === 'toggle_public') {
        // Determine current status based on where it came from (state or model obj)
        const currentStatus = confirmModel.is_public !== undefined ? confirmModel.is_public : isPublic;
        const newStatus = !currentStatus;

        await api.updateModel(token, confirmModel.id, { is_public: newStatus });

        // Update local lists
        await loadModels();
        if (activeTab === 'public') {
          await loadPublicModels(searchQuery);
        }

        // If this is the currently loaded model, update the state
        if (currentModelId === confirmModel.id) {
          setIsPublic(newStatus);
        }

        setErrorMessage(newStatus ? 'Model published to Public Repository!' : 'Model made private.');
        setErrorModalOpen(true);
      }
    } catch (err) {
      console.error('Action failed:', err);
      setErrorMessage('Action failed');
      setErrorModalOpen(true);
    } finally {
      setConfirmModalOpen(false);
      setConfirmModel(null);
      setConfirmAction(null);
    }
  };

  const handleModalConfirm = async (filename: string) => {
    if (modalMode === 'download') {
      // Download Logic
      const url = generated3DModel === 'placeholder-3d-model'
        ? 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Binary/Duck.glb'
        : generated3DModel || '';

      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = blobUrl;

        // Ensure extension
        const name = filename.endsWith('.glb') ? filename : `${filename}.glb`;
        link.download = name;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      } catch (e) {
        console.error("Download failed", e);
        // Fallback to direct link if fetch fails (e.g. CORS)
        const link = document.createElement('a');
        link.href = url;
        const name = filename.endsWith('.glb') ? filename : `${filename}.glb`;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } else if (modalMode === 'rename' && targetModelId) {
      // Rename Logic
      try {
        await api.updateModel(token, targetModelId, {
          instructions: filename
        });
        await loadModels();
      } catch (e) {
        console.error("Failed to rename model", e);
      }
    } else {
      // Add to Library Logic
      if (currentModelId) {
        // Update existing model
        try {
          await api.updateModel(token, currentModelId, {
            instructions: filename
          });
          await loadModels();
        } catch (e) {
          console.error("Failed to update model name", e);
        }
      } else {
        // Create new model (for placeholder/fallback)
        try {
          const newModel = await api.createModel(token, {
            instructions: filename,
            generated_3d_path: generated3DModel || undefined,
            reference_image_path: referenceImage || undefined // Note: This is base64, might be too large for some DBs but okay for now or we skip it
          });
          setCurrentModelId(newModel.id);
          await loadModels();
        } catch (e) {
          console.error("Failed to create model", e);
        }
      }
    }
    setModalOpen(false);
  };

  return (
    <div className="h-screen bg-[#FFF5F9] flex flex-col overflow-hidden">
      <div className="flex justify-between items-center p-6 flex-shrink-0">
        <h1 className="font-medium text-[#FF0066]">imgto3d</h1>
        <div className="flex items-center gap-8">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('create')}
              className={`font-medium transition-colors cursor-pointer ${activeTab === 'create' ? 'text-[#FF0066] border-b-2 border-[#FF0066]' : 'text-[#FFB3D9] hover:text-[#FF0066]'}`}
            >
              CREATE
            </button>
            <button
              onClick={() => setActiveTab('library')}
              className={`font-medium transition-colors cursor-pointer ${activeTab === 'library' ? 'text-[#FF0066] border-b-2 border-[#FF0066]' : 'text-[#FFB3D9] hover:text-[#FF0066]'}`}
            >
              MY MODELS [{savedModels.length}]
            </button>
            <button
              onClick={() => setActiveTab('public')}
              className={`font-medium transition-colors cursor-pointer ${activeTab === 'public' ? 'text-[#FF0066] border-b-2 border-[#FF0066]' : 'text-[#FFB3D9] hover:text-[#FF0066]'}`}
            >
              COMMUNITY
            </button>
          </div>

          <button
            onClick={onSignOut}
            className="text-[#FF0066] font-medium hover:scale-105 transition-transform cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </div>

      {
        activeTab === 'library' && (
          <div className="px-6 pb-4 flex-1 overflow-hidden flex flex-col">
            <div className="border-2 border-[#FF0066] bg-[#FFD9ED] p-4 flex-1 overflow-y-auto custom-scrollbar">
              {savedModels.length === 0 ? (
                <div className="text-center p-8 border-2 border-dashed border-[#FFB3D9]">
                  <p className="text-[#FFB3D9] font-medium">NO SAVED MODELS YET</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {savedModels.map((model) => (
                    <div
                      key={model.id}
                      onClick={() => handleLoadModel(model)}
                      className="group relative bg-[#FFF5F9] border-2 border-[#FF0066] p-4 cursor-pointer hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_#FF0066] transition-all"
                    >
                      <div className="flex flex-col gap-1 mb-8">
                        <span className="text-[#FF0066] font-medium truncate">
                          {model.instructions || 'UNTITLED MODEL'}
                        </span>
                        <span className="text-[#FFB3D9] font-medium group-hover:text-[#FF0066] transition-colors">
                          CREATED: {new Date(model.created_at).toLocaleDateString()}
                        </span>
                        {model.is_public && (
                          <span className="text-[#FF0066] text-sm font-medium border-2 border-[#FF0066] opacity-50 px-1 w-fit mt-1">PUBLIC</span>
                        )}
                      </div>

                      <div className="absolute bottom-4 right-4 flex items-center gap-4">
                        <button
                          onClick={(e) => handleRenameModel(model, e)}
                          className="text-[#FF0066] font-medium text-sm hover:bg-[#FF0066] hover:text-white px-2 py-1 transition-colors border border-transparent hover:border-[#FF0066]"
                        >
                          RENAME
                        </button>
                        <button
                          onClick={(e) => handleTogglePublicStatus(model, e)}
                          className={`font-medium text-sm px-2 py-1 transition-colors border ${model.is_public
                            ? 'text-white bg-[#FF0066] border-[#FF0066] hover:bg-[#E6005C]'
                            : 'text-[#FF0066] border-transparent hover:bg-[#FF0066] hover:text-white hover:border-[#FF0066]'
                            }`}
                        >
                          {model.is_public ? 'MAKE PRIVATE' : 'MAKE PUBLIC'}
                        </button>
                        <button
                          onClick={(e) => handleDownloadModel(model, e)}
                          className="text-[#FF0066] font-medium text-sm hover:bg-[#FF0066] hover:text-white px-2 py-1 transition-colors border border-transparent hover:border-[#FF0066]"
                        >
                          DOWNLOAD
                        </button>
                        <button
                          onClick={(e) => handleDeleteModel(model.id, e)}
                          className="text-[#FF0066] font-medium text-sm hover:bg-[#FF0066] hover:text-white px-2 py-1 transition-colors border border-transparent hover:border-[#FF0066]"
                        >
                          DELETE
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      }

      {
        activeTab === 'public' && (
          <div className="px-6 pb-4 flex-1 overflow-hidden flex flex-col">
            <div className="mb-4 flex gap-4">
              <form onSubmit={handleSearchPublic} className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="SEARCH MODELS..."
                  className="flex-1 bg-[#FFF5F9] border-2 border-[#FF0066] p-3 text-[#FF0066] font-medium outline-none placeholder-[#FFB3D9]"
                />
                <button
                  type="submit"
                  className="bg-[#FF0066] text-white font-medium px-6 hover:bg-[#E6005C] transition-colors"
                >
                  SEARCH
                </button>
              </form>
            </div>

            <div className="border-2 border-[#FF0066] bg-[#FFD9ED] p-4 flex-1 overflow-y-auto custom-scrollbar">
              {publicModels.length === 0 ? (
                <div className="text-center p-8 border-2 border-dashed border-[#FFB3D9]">
                  <p className="text-[#FFB3D9] font-medium">NO PUBLIC MODELS FOUND</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {publicModels.map((model) => (
                    <div
                      key={model.id}
                      onClick={() => handleLoadModel(model)}
                      className="group relative bg-[#FFF5F9] border-2 border-[#FF0066] p-4 cursor-pointer hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_#FF0066] transition-all"
                    >
                      <div className="flex flex-col gap-1 mb-8">
                        <span className="text-[#FF0066] font-medium truncate">
                          {model.instructions || 'UNTITLED MODEL'}
                        </span>
                        <span className="text-[#FFB3D9] font-medium group-hover:text-[#FF0066] transition-colors">
                          BY: {model.owner?.username || 'UNKNOWN'}
                        </span>
                        <span className="text-[#FFB3D9] font-medium text-xs">
                          {new Date(model.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="absolute bottom-4 right-4 flex items-center gap-4">
                        <button
                          onClick={(e) => handleDownloadModel(model, e)}
                          className="text-[#FF0066] font-medium text-sm hover:bg-[#FF0066] hover:text-white px-2 py-1 transition-colors border border-transparent hover:border-[#FF0066]"
                        >
                          DOWNLOAD
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      }

      {
        activeTab === 'create' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 px-6 pb-6 flex-1 min-h-0">
            <div className="flex flex-col gap-4 min-h-0">
              <div className="border-2 border-[#FF0066] flex-1 flex flex-col min-h-0">
                <div className="bg-[#FFC4E1] border-b-2 border-[#FF0066] p-2 flex-shrink-0">
                  <h2 className="text-[#FF0066] font-medium">reference image</h2>
                </div>
                <div
                  className="bg-[#FFD9ED] flex-1 flex items-center justify-center hover:bg-[#FFC4E1] transition-colors min-h-0 cursor-pointer relative overflow-hidden"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {fileDetails ? (
                    <>
                      {referenceImage && (
                        <img
                          src={referenceImage}
                          alt="Reference Background"
                          className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none"
                        />
                      )}
                      <div className="text-center p-4 relative z-10">
                        <p className="text-[#FF0066] font-medium">SELECTED: {fileDetails.name}</p>
                        <p className="text-[#FF0066] font-medium">SIZE: {fileDetails.size}, RESOLUTION: {fileDetails.resolution}</p>
                      </div>
                    </>
                  ) : referenceImage ? (
                    <img src={referenceImage} alt="Reference" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <span className="text-[#FF0066] font-medium">click to add</span>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
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
              <div className="bg-[#FFD9ED] flex-1 p-10 flex flex-col items-center justify-center min-h-0 relative group">
                {generatedImage ? (
                  <>
                    <img src={generatedImage} alt="2D Figure" className="max-w-full border-2 border-[#FF0066] max-h-full object-contain" />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={handleGenerate2D}
                        disabled={isGenerating2D}
                        className="bg-[#FF0066] text-white font-medium px-4 py-2 hover:bg-[#E6005C] transition-colors cursor-pointer"
                      >
                        RETRY
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <span className="text-[#FFB3D9] font-medium">waiting for generation</span>
                    <button
                      onClick={handleGenerate2D}
                      disabled={isGenerating2D || (!instructions && !referenceFile)}
                      className="bg-[#FF0066] text-white font-medium px-6 py-2 hover:bg-[#E6005C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isGenerating2D ? 'GENERATING...' : 'GENERATE 2D'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4 min-h-0">
              <div className="border-2 border-[#FF0066] flex-1 flex flex-col min-h-0">
                <div className="bg-[#FFC4E1] border-b-2 border-[#FF0066] p-2 flex-shrink-0">
                  <h2 className="text-[#FF0066] font-medium">3D Model</h2>
                </div>
                <div className="bg-[#FFD9ED] flex-1 min-h-0 relative">
                  {generated3DModel ? (
                    <ThreeDViewer modelData={generated3DModel} rotation={rotation} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-[#FFB3D9] font-medium">3D Model Will Appear Here</span>
                    </div>
                  )}
                  {isGenerating && (
                    <div className="absolute inset-0 backdrop-blur-xl bg-[#FFD9ED] flex items-center justify-center">
                      <span className="text-[#FF0066] font-medium">Generating...</span>
                    </div>
                  )}
                </div>
                {generated3DModel && (
                  <div className="bg-[#FFC4E1] border-t-2 border-[#FF0066] p-2 flex-shrink-0 flex gap-2 items-center">
                    <span className="text-[#FF0066] font-medium text-sm">ROTATION:</span>
                    <input
                      type="range"
                      min="0"
                      max="720"
                      value={rotation}
                      onChange={(e) => setRotation(Number(e.target.value))}
                      className="flex-1 h-2 bg-[#FFD9ED] appearance-none cursor-pointer border border-[#FF0066]"
                    />
                    <span className="text-[#FF0066] font-medium text-sm w-12 text-right">{rotation}°</span>
                  </div>
                )}
              </div>
              <div className="flex justify-end flex-shrink-0 gap-4">
                {generated3DModel && (
                  <>
                    <button
                      onClick={handleTogglePublic}
                      className={`border-2 font-medium px-6 py-3 transition-colors cursor-pointer ${isPublic
                        ? 'bg-[#FF0066] text-white border-[#FF0066] hover:bg-[#E6005C]'
                        : 'bg-[#FFD9ED] text-[#FF0066] border-[#FF0066] hover:bg-[#FFC4E1]'}`}
                    >
                      {isPublic ? 'MAKE PRIVATE' : 'MAKE PUBLIC'}
                    </button>
                    <button
                      onClick={openDownloadModal}
                      className="bg-[#FFD9ED] text-[#FF0066] border-2 border-[#FF0066] font-medium px-6 py-3 hover:bg-[#FFC4E1] transition-colors cursor-pointer"
                    >
                      download
                    </button>
                  </>
                )}
                <button
                  onClick={handleGenerate3D}
                  disabled={(!referenceFile && !generatedImage) || isGenerating}
                  className="bg-[#FF0066] text-white font-medium px-8 py-3 hover:bg-[#E6005C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {currentModelId ? 'RETRY' : generatedImage ? 'APPROVE & CREATE' : 'create'}
                </button>
              </div>
            </div>

          </div>
        )
      }

      <SaveModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleModalConfirm}
        title={modalMode === 'download' ? 'DOWNLOAD MODEL' : modalMode === 'rename' ? 'RENAME MODEL' : 'ADD TO LIBRARY'}
        initialValue={modalFilename}
        actionLabel={modalMode === 'download' ? 'DOWNLOAD' : 'SAVE'}
      />

      <ErrorModal
        isOpen={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        message={errorMessage}
      />

      <ConfirmationModal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={handleConfirmAction}
        title={confirmAction === 'delete' ? 'DELETE MODEL' : confirmAction === 'toggle_public' ? (confirmModel?.is_public || (confirmModel?.id === currentModelId && isPublic) ? 'MAKE PRIVATE' : 'MAKE PUBLIC') : 'CONFIRM'}
        message={confirmAction === 'delete'
          ? 'Are you sure you want to delete this model? This action cannot be undone.'
          : confirmAction === 'toggle_public'
            ? (confirmModel?.is_public || (confirmModel?.id === currentModelId && isPublic)
              ? 'Are you sure you want to remove this model from the Public Repository? It will no longer be visible to others.'
              : 'Are you sure you want to publish this model to the Public Repository? It will be visible to everyone.')
            : ''}
        confirmLabel={confirmAction === 'delete' ? 'DELETE' : 'CONFIRM'}
        isDestructive={confirmAction === 'delete'}
      />
    </div>
  );
};

// Main App Component
const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      const storedToken = localStorage.getItem('auth_token');
      if (storedToken) {
        try {
          const userData = await api.getMe(storedToken);
          setToken(storedToken);
          setUser(userData);
          setIsAuthenticated(true);
        } catch (err) {
          console.error('Failed to restore session:', err);
          localStorage.removeItem('auth_token');
        }
      }
      setIsLoading(false);
    };

    restoreSession();
  }, []);

  const handleAuthenticate = (authToken: string, userData: any) => {
    localStorage.setItem('auth_token', authToken);
    setToken(authToken);
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handleSignOut = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
  };

  if (isLoading) {
    return (
      <div className="h-screen bg-[#FFF5F9] flex items-center justify-center">
        <div className="text-[#FF0066] font-medium font-['DM_Mono',monospace] animate-pulse">LOADING</div>
      </div>
    );
  }

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

        /* Custom Scrollbar */
        .custom-scrollbar::-webkit-scrollbar {
          width: 16px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #FFD9ED;
          border-left: 2px solid #FF0066;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #FF0066;
          border: 3px solid #FFD9ED;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #E6005C;
        }

        input[type="password"] {
          font-family: sans-serif !important;
          -webkit-text-security: square !important;
          text-security: square !important;
        }
        
        button, [role="button"] {
          cursor: pointer;
        }

        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 12px;
          height: 24px;
          background: #FF0066;
          border: 2px solid #FFC4E1;
          cursor: pointer;
        }

        input[type=range]::-moz-range-thumb {
          width: 12px;
          height: 24px;
          background: #FF0066;
          border: 2px solid #FFC4E1;
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