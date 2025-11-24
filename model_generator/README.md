# 3D Model Generator
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](https://www.docker.com/)
[![CUDA](https://img.shields.io/badge/cuda-11.8%2B-green.svg)](https://developer.nvidia.com/cuda-toolkit)
Egy modern, AI-alapú webalkalmazás, amely képes egyetlen feltöltött képből háromdimenziós (3D) modellt generálni Hunyuan3D v2.1 neurális hálózat segítségével.
![3D Model Generator](https://img.shields.io/badge/3D-Model%20Generator-red?style=for-the-badge)
## Projekt Áttekintés
Ez a projekt egy teljes körű, konténerizált full-stack megoldás, amely lehetővé teszi a felhasználók számára, hogy:
- Képeiket töltsenek fel a webes felületen
- AI segítségével 3D modelleket generáljanak
- A modelleket megtekintsék egy beépített 3D viewerben
- A modelleket .glb formátumban letölthessék
## Főbb Funkciók
-  **Kép feltöltés** - Base64 formátumban, PNG/JPEG támogatással
-  **AI 3D generálás** - Hunyuan3D v2.1 modell használata
-  **Valós idejű státusz** - WebSocket alapú progress tracking
-  **RESTful API** - FastAPI alapú backend szolgáltatások
-  **3D viewer** - ThreeJS alapú webes megjelenítés
-  **Konténerizált** - Docker és Docker Compose támogatás
-  **Gyors telepítés** - One-click deployment
##  Gyors Telepítés
### Előfeltételek
- **Operációs rendszer:** Linux (Ubuntu 20.04+, Arch Linux)
- **GPU:** NVIDIA RTX 3080+ / RTX 4060 Ti+ (CUDA 11.8+)
- **RAM:** 16GB DDR4 minimum
- **Tárhely:** 50GB szabad hely
- **Docker:** 24.0.0+
- **Docker Compose:** 2.0.0+
### 1. Klónozás és navigálás
```bash
git clone <repository-url>
cd model_generator
```
### 2. NVIDIA Container Toolkit telepítése (Arch Linux)
```bash
sudo pacman -S nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```
### 3. Szolgáltatások indítása
```bash
docker-compose --profile client up --build --force-recreate
```
## Részletes Telepítési Útmutató

```bash

cd model_generator
sudo pacman -S nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker

docker-compose --profile client up --build --force-recreate

docker-compose logs -f
