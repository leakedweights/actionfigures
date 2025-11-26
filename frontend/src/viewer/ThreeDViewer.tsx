import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PLACEHOLDER_MODEL_URL } from '../utils/constants';

interface ThreeDViewerProps {
    modelData: string | null;
    rotation: number;
}

export const ThreeDViewer: React.FC<ThreeDViewerProps> = ({ modelData, rotation }) => {
    const mountRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const modelRef = useRef<THREE.Group | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loadingProgress, setLoadingProgress] = useState<number | null>(null);

    useEffect(() => {
        if (!mountRef.current) return;

        // Clear any existing children to prevent duplicates
        while (mountRef.current.firstChild) {
            mountRef.current.removeChild(mountRef.current.firstChild);
        }

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
        camera.position.set(0, 1, 3);
        cameraRef.current = camera;

        // Renderer setup
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.3;  // Increased exposure for better visibility
        mountRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controlsRef.current = controls;

        // Environment Map for Reflections
        const pmremGenerator = new THREE.PMREMGenerator(renderer);
        const roomEnvironment = new RoomEnvironment();
        scene.environment = pmremGenerator.fromScene(roomEnvironment, 0.04).texture;
        roomEnvironment.dispose();

        // Ambient light - provides base illumination
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        // Key Light - Main directional light (front-top-right)
        const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
        keyLight.position.set(5, 8, 5);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 2048;
        keyLight.shadow.mapSize.height = 2048;
        keyLight.shadow.camera.near = 0.1;
        keyLight.shadow.camera.far = 50;
        keyLight.shadow.camera.left = -10;
        keyLight.shadow.camera.right = 10;
        keyLight.shadow.camera.top = 10;
        keyLight.shadow.camera.bottom = -10;
        keyLight.shadow.bias = -0.0001;
        scene.add(keyLight);

        // Fill Light - Softer light from the opposite side (front-left)
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
        fillLight.position.set(-5, 3, 3);
        scene.add(fillLight);

        // Rim Light - Back light to create edge definition (back-top)
        const rimLight = new THREE.DirectionalLight(0xffffff, 0.5);
        rimLight.position.set(0, 5, -8);
        scene.add(rimLight);

        // Additional side lights for better surface coverage
        const leftLight = new THREE.DirectionalLight(0xffffff, 0.4);
        leftLight.position.set(-8, 2, 0);
        scene.add(leftLight);

        const rightLight = new THREE.DirectionalLight(0xffffff, 0.4);
        rightLight.position.set(8, 2, 0);
        scene.add(rightLight);

        // Shadow Catcher Plane
        const shadowMaterial = new THREE.ShadowMaterial({
            opacity: 0.15,  // Reduced for more subtle shadows
            color: 0x000000,
        });
        const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), shadowMaterial);
        shadowPlane.rotation.x = -Math.PI / 2;
        shadowPlane.position.y = -1; // Slightly below model
        shadowPlane.receiveShadow = true;
        scene.add(shadowPlane);

        // Animation Loop
        const animate = () => {
            requestAnimationFrame(animate);
            if (controlsRef.current) controlsRef.current.update();
            renderer.render(scene, camera);
        };
        animate();

        // Resize Handler
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
                // Check if the renderer is still a child before removing
                if (mountRef.current.contains(rendererRef.current.domElement)) {
                    mountRef.current.removeChild(rendererRef.current.domElement);
                }
            }
            rendererRef.current?.dispose();
        };
    }, []);

    // Load Model
    useEffect(() => {
        setError(null);
        setLoadingProgress(0);
        if (!sceneRef.current || !modelData) {
            setLoadingProgress(null);
            return;
        }

        let isMounted = true;

        // Clean up previous model
        if (modelRef.current) {
            sceneRef.current.remove(modelRef.current);
            modelRef.current = null;
        }

        const loader = new GLTFLoader();

        // Handle placeholder or real URL
        const url = modelData === 'placeholder-3d-model'
            ? PLACEHOLDER_MODEL_URL
            : modelData;

        loader.load(
            url,
            (gltf) => {
                if (!isMounted) return;

                const model = gltf.scene;

                const pinkMaterial = new THREE.MeshStandardMaterial({
                    color: 0xFF4D94,
                    roughness: 0.6,
                    metalness: 0.0,
                    flatShading: true,
                });

                model.traverse((child) => {
                    if ((child as THREE.Mesh).isMesh) {
                        const mesh = child as THREE.Mesh;
                        mesh.material = pinkMaterial;
                        mesh.castShadow = true;
                        mesh.receiveShadow = true;

                        if (mesh.geometry) {
                            mesh.geometry.computeVertexNormals();
                        }
                    }
                });

                // Center and scale model
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());

                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = 2 / maxDim;

                model.scale.setScalar(scale);
                model.position.sub(center.multiplyScalar(scale));

                sceneRef.current?.add(model);
                modelRef.current = model;
                setLoadingProgress(null);
            },
            (xhr) => {
                if (isMounted) {
                    const percent = (xhr.loaded / xhr.total) * 100;
                    setLoadingProgress(percent);
                }
            },
            (error) => {
                console.error('An error happened loading the model:', error);
                if (isMounted) {
                    setError('Failed to load model');
                    setLoadingProgress(null);
                }
            }
        );

        return () => {
            isMounted = false;
        };
    }, [modelData]);

    useEffect(() => {
        if (modelRef.current && !error) {
            modelRef.current.rotation.y = THREE.MathUtils.degToRad(rotation);
        }
    }, [rotation, error]);

    useEffect(() => {
        if (controlsRef.current) {
            controlsRef.current.enabled = !error;
        }
    }, [error]);

    return (
        <div className="relative w-full h-full">
            {error && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#FFF5F9]/50">
                    <div className="bg-[#FFF5F9] border-2 border-[#FF0066] px-6 py-4 shadow-[4px_4px_0px_0px_#FF0066]">
                        <span className="text-[#FF0066] font-medium">Failed to load model</span>
                    </div>
                </div>
            )}
            {loadingProgress !== null && loadingProgress < 100 && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#FFF5F9]/50 backdrop-blur-sm">
                    <div className="bg-[#FFF5F9] border-2 border-[#FF0066] px-6 py-4 shadow-[4px_4px_0px_0px_#FF0066]">
                        <span className="text-[#FF0066] font-medium font-['DM_Mono',monospace]">
                            LOADING: {loadingProgress.toFixed(1)}%
                        </span>
                    </div>
                </div>
            )}
            <div ref={mountRef} className="w-full h-full overflow-hidden" />
        </div>
    );
};
