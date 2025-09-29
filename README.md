# SyncForge - Real-time Collaborative IDE

http://googleusercontent.com/image_generation_content/0

<div align="center">

**A full-stack, real-time collaborative IDE designed for remote pair programming, technical interviews, and educational purposes. Code together, ship faster.**

</div>

<p align="center">
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express.js">
  <img src="https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socketdotio&logoColor=white" alt="WebSockets">
  <img src="https://img.shields.io/badge/WebRTC-333333?style=for-the-badge&logo=webrtc&logoColor=white" alt="WebRTC">
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge" alt="License: MIT">
</p>

## Table of Contents

- [Introduction](#introduction)
- [Live Demo](#live-demo)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Docker Deployment](#docker-deployment)
- [Environment Variables](#environment-variables)
- [Contributing](#contributing)
- [License](#license)

## Introduction

SyncForge is a powerful, web-based Integrated Development Environment (IDE) that eliminates the friction of remote collaboration. It provides a seamless, all-in-one platform where developers can code, communicate, and create together in real-time, without needing multiple tools. Whether for a high-stakes technical interview, a pair programming session, or an interactive classroom, SyncForge provides the tools for effective collaboration.

## Live Demo

https://sync-forge-ide-v2.vercel.app/



<img width="1919" height="863" alt="image" src="https://github.com/user-attachments/assets/28f41892-5d1a-4408-aa70-e023511d0787" />

<img width="1" height="6" alt="image" src="https://github.com/user-attachments/assets/3e240f84-dbc2-43c7-89c3-0a1cabeaf5b6" />

<img width="1918" height="872" alt="image" src="https://github.com/user-attachments/assets/77feea39-547a-4aa0-809a-d9a670b896d2" />

<img width="1919" height="869" alt="image" src="https://github.com/user-attachments/assets/0f7d80ab-bf98-49e9-ae0b-e4da4c8738d5" />

<img width="1917" height="865" alt="image" src="https://github.com/user-attachments/assets/9ee3634d-ac83-4952-b46d-d6a8c4670045" />

<img width="1919" height="866" alt="image" src="https://github.com/user-attachments/assets/a6142480-a1e2-4ade-bac6-1e47847b913d" />


## Key Features

- **👨‍💻 Real-time Collaborative Editor**: A multi-file Monaco Editor instance synchronized using **Operational Transformation (OT)** via ShareDB, ensuring conflict-free, low-latency collaborative coding with shared cursors.
- **📹 Integrated Communication Suite**: Built-in **WebRTC** for multi-party video/audio conferencing and screen sharing, plus a real-time chat with file-sharing capabilities, powered by WebSockets.
- **⚙️ Multi-Language Code Execution**: A secure backend engine to compile and run **C++, Java, and Python** code, with shared `stdin` and `stdout` streamed to all participants.
- **🖥️ Shared Interactive Terminal**: An integrated, fully-functional terminal using **Xterm.js** on the frontend and `node-pty` on the backend, giving all users access to a shared shell environment within the project's workspace.
- **🤖 AI-Powered Assistant**: Leverages the **Google Gemini API** to provide an intelligent chatbot for explaining concepts and a context-aware, in-editor code completion feature that suggests "ghost text" as you type.
- **🎨 Collaborative Whiteboard**: A real-time whiteboard powered by **Tldraw**, allowing for shared diagramming and visual planning. Includes advanced functionality to import, annotate, and export multi-page **PDF documents**.
- **🗂️ Workspace & File Management**: A complete file tree explorer that supports creating, renaming, and deleting files/folders, along with drag-and-drop uploads for single files and entire `.zip` projects.
- **👑 Host Controls & Permissions**: Robust role-based access control (RBAC) allowing session hosts to manage participants, toggle features (like code execution or AI), and switch between open and host-only editing modes.

## Technology Stack

### Frontend
- **Framework:** React.js
- **UI Library:** Ant Design
- **State Management:** React Hooks (useState, useEffect, useReducer, useCallback)
- **Code Editor:** Monaco Editor
- **Terminal:** Xterm.js
- **Whiteboard:** Tldraw
- **Styling:** Tailwind CSS
- **Animations:** Framer Motion

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **API:** REST for session management & file operations

### Real-time & Collaboration
- **Editor Sync:** ShareDB (for Operational Transformation)
- **Signaling & Chat:** Custom WebSocket Server
- **Video/Audio:** WebRTC
- **Terminal Sync:** Custom WebSocket Server

### AI Integration
- **LLM Provider:** Google Gemini API (`@google/genai`) for chat and code completion.

### DevOps
- **Containerization:** Docker

## Getting Started

Follow these instructions to get a local copy of SyncForge up and running for development and testing purposes.

### Prerequisites

- Node.js (v18.x or later)
- npm (v8.x or later)
- Docker (for running the complete environment with the code execution engine)

### Backend Setup

1.  **Navigate to the backend directory:**
    ```bash
    cd editor-backend
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Create an environment file:**
    Create a `.env` file in the `editor-backend` directory and add your Google Gemini API key.
    ```env
    # .env
    GEMINI_API_KEY='AIzaSy...'
    ```
4.  **Start the backend server:**
    ```bash
    npm run dev
    ```
    The server will start on `http://localhost:8080`.

### Frontend Setup

1.  **Navigate to the frontend directory in a new terminal:**
    ```bash
    cd editor-frontend
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Start the React development server:**
    ```bash
    npm start
    ```
    The application will be available at `http://localhost:3000`.

## Docker Deployment

The provided `Dockerfile` sets up the backend server and its dependencies for the code execution environment.

1.  **Build the Docker image from the root directory:**
    ```bash
    docker build -t syncforge .
    ```
2.  **Run the Docker container:**
    This command maps the container's port `8080` to your local machine's port `8080`.
    ```bash
    docker run -p 8080:8080 --name syncforge-app syncforge
    ```
    *Note: For this setup, you still need to run the React frontend separately on `localhost:3000` which will connect to the backend running inside the Docker container.*

## Environment Variables

The following environment variables are required for the application to run correctly:

-   `GEMINI_API_KEY`: Your API key for the Google Gemini AI services.

## Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## License

Distributed under the MIT License. See `LICENSE` for more information.

---
