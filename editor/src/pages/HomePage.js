import React, { useState } from "react";
import { FiCode, FiUsers, FiVideo, FiShare2, FiGithub, FiDatabase, FiZap, FiCloud, FiLock, FiCopy, FiInfo, FiAlertCircle, FiTerminal, FiMessageSquare, FiLayout, FiCpu, FiMonitor, FiBox } from "react-icons/fi";

const PROJECT_NAME = "SyncForge";
const SUBTITLE = "Full-Stack Collaborative IDE & Communication Platform";
const GITHUB_URL = "https://github.com/ShivKnp";

const features = [
  {
    icon: <FiCode size={20} />,
    title: "Real-time Collaboration",
    desc: "Operational Transformation powered Monaco editor with shared cursors and conflict-free edits."
  },
  {
    icon: <FiVideo size={20} />,
    title: "Integrated Video & Chat",
    desc: "Native WebRTC for video/audio conferencing, screen sharing, and real-time chat with file sharing."
  },
  {
    icon: <FiTerminal size={20} />,
    title: "Multi-Language Execution",
    desc: "Secure sandboxed code execution for C++, Java, and Python with shared interactive terminal."
  },
  {
    icon: <FiLayout size={20} />,
    title: "AI-Powered Assistant",
    desc: "Integrated Google Gemini API for intelligent code completion and in-app chatbot assistance."
  },
  {
    icon: <FiUsers size={20} />,
    title: "Role-Based Access",
    desc: "Host controls with permissions for enabling/disabling features, promoting hosts, and managing participants."
  },
  {
    icon: <FiShare2 size={20} />,
    title: "Collaborative Whiteboard",
    desc: "Real-time whiteboard using Tldraw with PDF import, annotation, and export capabilities."
  }
];

const techStack = [
  { name: "React", icon: <FiZap/> },
  { name: "Monaco Editor", icon: <FiCode/> },
  { name: "ShareDB (OT)", icon: <FiCloud/> },
  { name: "WebRTC", icon: <FiVideo/> },
  { name: "Node.js + Express", icon: <FiDatabase/> },
  { name: "Docker", icon: <FiLock/> },
  { name: "Xterm.js", icon: <FiTerminal/> },
  { name: "Tldraw", icon: <FiLayout/> },
  { name: "Google Gemini API", icon: <FiCpu/> }
];

const versions = [
  {
    version: "v1.0",
    name: "Code Together",
    url: "https://simultaneous-code-editor.vercel.app/",
    description: "Initial collaborative code editor",
    year: "2023"
  },
  {
    version: "v2.0",
    name: "Code Crew",
    url: "https://code-crew-nu.vercel.app/",
    description: "Enhanced collaboration features",
    year: "2023"
  },
  {
    version: "v3.0",
    name: "SyncForge IDE V1",
    url: "https://sync-forge-fgfz6xe82-fearman99s-projects.vercel.app/",
    description: "Full-featured IDE experience",
    year: "2024"
  }
];

const additionalFeatures = [
  {
    icon: <FiBox />,
    title: "Docker Containerization",
    description: "Entire application containerized for consistent, reproducible deployments and isolated execution environments"
  },
  {
    icon: <FiMonitor />,
    title: "Multi-File Tabs",
    description: "Tabbed interface supporting multiple files with synchronized editing across all participants"
  },
  {
    icon: <FiMessageSquare />,
    title: "Persistent Chat",
    description: "Real-time messaging system with file sharing capabilities built on WebSocket infrastructure"
  },
  {
    icon: <FiDatabase />,
    title: "Session Management",
    description: "Save workspace snapshots, download projects as ZIP files, and restore previous sessions"
  }
];

const HomePage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inviteInput, setInviteInput] = useState("");
  const [inputError, setInputError] = useState("");
  const [copiedVersion, setCopiedVersion] = useState(null);

  const joinId = "demo-" + Math.random().toString(36).slice(2, 8);

  const parseInviteUrl = (text) => {
    if (!text) return null;
    const trimmed = text.trim();
    const bareIdMatch = trimmed.match(/^([A-Za-z0-9\-_]{4,})$/);
    if (bareIdMatch) return bareIdMatch[1];
    const lobbyRegex = /\/lobby\/([A-Za-z0-9\-_]+)/i;
    const m = trimmed.match(lobbyRegex);
    if (m && m[1]) return m[1];
    return null;
  };

  const handleJoin = () => {
    setInputError("");
    const id = parseInviteUrl(inviteInput);
    if (!id) {
      setInputError("Please paste a valid invite URL or session ID.");
      return;
    }
    setIsModalOpen(false);
    setInviteInput("");
    window.location.href = `/lobby/${id}`;
  };

  const handlePasteClipboard = async () => {
    try {
      if (!navigator.clipboard) {
        setInputError("Clipboard API not available in this browser.");
        return;
      }
      const text = await navigator.clipboard.readText();
      if (!text) {
        setInputError("Clipboard is empty.");
        return;
      }
      setInviteInput(text);
      setInputError("");
    } catch (err) {
      setInputError("Unable to read clipboard.");
    }
  };

  const copyToClipboard = (text, version) => {
    navigator.clipboard.writeText(text);
    setCopiedVersion(version);
    setTimeout(() => setCopiedVersion(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black text-slate-100 antialiased">
      {/* Navigation */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-900/30 border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-12 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 group">
            <div className="bg-gradient-to-br from-cyan-500 to-violet-600 text-white font-extrabold rounded-xl px-3 py-2 shadow-lg shadow-cyan-500/20 transform group-hover:scale-105 transition-transform duration-300">
              SF
            </div>
            <div>
              <div className="font-bold text-lg bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-transparent">
                {PROJECT_NAME}
              </div>
              <div className="text-xs text-slate-400 -mt-0.5">Collaborative IDE Platform</div>
            </div>
          </div>

          <nav className="flex items-center gap-3">
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/60 border border-slate-700/50 hover:bg-slate-700/60 hover:border-cyan-500/30 text-slate-200 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10 backdrop-blur-sm">
              <FiGithub />
              <span className="hidden sm:inline text-sm font-medium">GitHub</span>
            </a>

            <a href={`/lobby/${joinId}`} className="px-5 py-2 rounded-full bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-semibold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/40 hover:scale-105 transform transition-all duration-300 text-sm">
              Start Session
            </a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 md:px-8 lg:px-12 py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
          {/* Left Content */}
          <div className="space-y-8 animate-slideInLeft">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/10 to-violet-600/10 border border-cyan-500/20 backdrop-blur-sm">
              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-cyan-400 to-violet-600 text-black text-xs font-bold">NEW</span>
              <span className="text-sm text-slate-300">Full-Stack IDE • AI-Powered • Docker Ready</span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-tight">
              Code <span className="bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">Together</span>,
              <br />Ship <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">Faster</span>
            </h1>

            <p className="text-lg text-slate-300 max-w-2xl leading-relaxed">
              A comprehensive collaborative IDE featuring real-time synchronization, integrated video conferencing, 
              multi-language code execution, AI assistance, and advanced whiteboarding capabilities.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <a href={`/lobby/${joinId}`} className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-bold shadow-xl shadow-cyan-500/30 hover:shadow-cyan-500/40 hover:scale-105 transform transition-all duration-300">
                <FiZap />
                New Session
              </a>

              <button onClick={() => setIsModalOpen(true)} className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:border-cyan-500/30 text-slate-200 font-semibold backdrop-blur-sm hover:bg-slate-700/60 transition-all duration-300">
                <FiUsers />
                Join Session
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-6">
              {[
                { label: "Sync Engine", value: "Operational Transform", icon: <FiCloud /> },
                { label: "Languages", value: "C++, Java, Python", icon: <FiCode /> },
                { label: "Communication", value: "WebRTC Built-in", icon: <FiVideo /> },
                { label: "Terminal", value: "Xterm.js + node-pty", icon: <FiTerminal /> },
                { label: "AI Model", value: "Google Gemini API", icon: <FiCpu /> },
                { label: "Whiteboard", value: "Tldraw + PDF Support", icon: <FiLayout /> }
              ].map((item, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-800/50 backdrop-blur-sm hover:border-cyan-500/30 transition-all duration-300 group">
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                    <span className="text-cyan-400 group-hover:scale-110 transition-transform">{item.icon}</span>
                    {item.label}
                  </div>
                  <div className="text-sm font-semibold text-cyan-400">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Code Demo */}
          <div className="flex items-center justify-center animate-slideInRight">
            <div className="w-full max-w-lg rounded-2xl overflow-hidden border border-slate-800/50 shadow-2xl backdrop-blur-sm hover:shadow-cyan-500/20 transition-all duration-500 hover:scale-[1.02]">
              <div className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-slate-900/80 to-slate-800/80 border-b border-slate-800/50 backdrop-blur-md">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                </div>
                <div className="text-xs text-slate-400 font-mono">main.cpp • Live Collaboration</div>
              </div>
              <pre className="p-6 text-sm text-slate-200 bg-gradient-to-b from-slate-900/90 to-slate-950/90 font-mono leading-relaxed backdrop-blur-sm">
{`// Real-time collaborative editing
#include <iostream>
#include <vector>
using namespace std;

int main() {
    vector<string> features = {
        "Real-time sync",
        "Video conferencing",
        "AI assistance",
        "Code execution"
    };
    
    for(const auto& f : features) {
        cout << "✓ " << f << endl;
    }
    
    return 0;
}`}
              </pre>
              <div className="flex gap-2 px-5 py-3 bg-gradient-to-r from-slate-800/80 to-slate-900/80 border-t border-slate-800/50 backdrop-blur-md">
                <button className="flex-1 px-4 py-2 bg-gradient-to-r from-cyan-500/20 to-violet-600/20 border border-cyan-500/30 text-cyan-400 rounded-lg text-sm font-medium hover:from-cyan-500/30 hover:to-violet-600/30 transition-all duration-300">
                  Run Code
                </button>
                <button className="px-4 py-2 bg-slate-700/60 border border-slate-600/50 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600/60 transition-all duration-300">
                  <FiShare2 />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Core Features */}
        <section className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
              Core Features
            </h2>
            <p className="text-slate-400">Enterprise-grade collaboration tools for modern development teams</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, idx) => (
              <div key={idx} className="group p-6 bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-800/50 rounded-2xl backdrop-blur-sm hover:border-cyan-500/30 hover:shadow-xl hover:shadow-cyan-500/10 transition-all duration-300 hover:-translate-y-1">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-600/20 border border-cyan-500/30 text-cyan-400 mb-4 group-hover:scale-110 transition-transform duration-300">
                  {f.icon}
                </div>
                <h3 className="text-lg font-bold mb-2 text-slate-100 group-hover:text-cyan-400 transition-colors duration-300">
                  {f.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Additional Features */}
        <section className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              Advanced Capabilities
            </h2>
            <p className="text-slate-400">Built for scale with modern DevOps practices</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {additionalFeatures.map((feature, idx) => (
              <div key={idx} className="p-6 bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-800/50 rounded-2xl backdrop-blur-sm hover:border-violet-500/30 hover:shadow-xl hover:shadow-violet-500/10 transition-all duration-300">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold mb-2 text-slate-100">{feature.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tech Stack & Architecture */}
        <section className="mb-20">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 p-8 bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-800/50 rounded-2xl backdrop-blur-sm">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <FiCode className="text-cyan-400" />
                What Makes SyncForge Unique?
              </h2>
              <ul className="space-y-4 text-slate-300 text-sm leading-relaxed">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-xs font-bold mt-0.5">1</span>
                  <span><strong className="text-slate-100">ShareDB Operational Transformation:</strong> Character-level synchronization with conflict-free editing and shared cursor presence. Real-time collaborative editing powered by OT ensures seamless multi-user coding sessions.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-xs font-bold mt-0.5">2</span>
                  <span><strong className="text-slate-100">Multi-Party WebRTC Architecture:</strong> Custom WebSocket signaling server enabling high-quality video/audio conferencing with screen sharing. Built-in communication eliminates the need for external tools.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-xs font-bold mt-0.5">3</span>
                  <span><strong className="text-slate-100">Sandboxed Code Execution Engine:</strong> Secure Docker containers with child_process execution for C++, Java, and Python. Shared interactive terminal powered by Xterm.js and node-pty streams stdin/stdout in real-time.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-xs font-bold mt-0.5">4</span>
                  <span><strong className="text-slate-100">AI-Powered Code Intelligence:</strong> Google Gemini API integration provides context-aware code completion with "ghost text" suggestions and an intelligent chatbot for explaining complex concepts.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-xs font-bold mt-0.5">5</span>
                  <span><strong className="text-slate-100">Collaborative Whiteboard System:</strong> Tldraw-powered real-time whiteboard with advanced PDF import, annotation, and export functionality. Perfect for visual collaboration and diagram sketching.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-xs font-bold mt-0.5">6</span>
                  <span><strong className="text-slate-100">Multi-File Tabbed Editor:</strong> Monaco Editor with full tabbed interface supporting multiple files. Create folders, organize projects, and navigate seamlessly across your codebase.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-xs font-bold mt-0.5">7</span>
                  <span><strong className="text-slate-100">Persistent Real-Time Chat:</strong> WebSocket-based messaging system with file-sharing capabilities. Share code snippets, documents, and collaborate asynchronously within sessions.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-xs font-bold mt-0.5">8</span>
                  <span><strong className="text-slate-100">Role-Based Access Control:</strong> Comprehensive RBAC with host-specific permissions for enabling/disabling features, promoting participants to hosts, kicking users, and configuring session settings.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-xs font-bold mt-0.5">9</span>
                  <span><strong className="text-slate-100">Workspace Snapshot System:</strong> Save complete workspace states to the server, download projects as ZIP files, and restore previous sessions. Full session management for continuity.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-xs font-bold mt-0.5">10</span>
                  <span><strong className="text-slate-100">Modular WebSocket Infrastructure:</strong> Distinct handlers for editor sync, video signaling, chat, and terminal I/O ensure low-latency communication and optimal performance across all features.</span>
                </li>
              </ul>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                <div className="p-4 bg-gradient-to-br from-slate-900/50 to-slate-800/50 border border-slate-800/50 rounded-xl backdrop-blur-sm">
                  <h4 className="font-semibold mb-2 text-cyan-400 flex items-center gap-2">
                    <FiLock className="text-sm" />
                    Security First
                  </h4>
                  <p className="text-slate-400 text-sm">Isolated execution environments with Docker containerization for safe code running.</p>
                </div>
                <div className="p-4 bg-gradient-to-br from-slate-900/50 to-slate-800/50 border border-slate-800/50 rounded-xl backdrop-blur-sm">
                  <h4 className="font-semibold mb-2 text-violet-400 flex items-center gap-2">
                    <FiUsers className="text-sm" />
                    Role Management
                  </h4>
                  <p className="text-slate-400 text-sm">Granular RBAC with host permissions for feature toggling and participant management.</p>
                </div>
              </div>
            </div>

            <aside className="p-8 bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-800/50 rounded-2xl backdrop-blur-sm">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <FiDatabase className="text-violet-400" />
                Tech Stack
              </h3>
              <div className="space-y-3">
                {techStack.map((t, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-slate-900/40 to-slate-800/40 border border-slate-800/30 hover:border-cyan-500/30 transition-all duration-300 hover:translate-x-1">
                    <div className="text-cyan-400 text-lg">{t.icon}</div>
                    <div className="text-slate-200 text-sm font-medium">{t.name}</div>
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <h4 className="font-semibold mb-3 text-slate-200 text-sm">Perfect For:</h4>
                <ul className="space-y-2 text-slate-400 text-sm">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400"></div>
                    Technical Interviews
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400"></div>
                    Remote Pair Programming
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-fuchsia-400"></div>
                    Code Education & Teaching
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400"></div>
                    Team Collaboration
                  </li>
                </ul>
              </div>
            </aside>
          </div>
        </section>

        {/* Version History */}
        <section className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
              Evolution Timeline
            </h2>
            <p className="text-slate-400">Journey from concept to full-featured IDE platform</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {versions.map((v, idx) => (
              <div key={idx} className="group p-6 bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-800/50 rounded-2xl backdrop-blur-sm hover:border-cyan-500/30 hover:shadow-xl hover:shadow-cyan-500/10 transition-all duration-300 hover:-translate-y-1">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-xs font-mono text-cyan-400 mb-1">{v.version}</div>
                    <h3 className="text-xl font-bold text-slate-100 group-hover:text-cyan-400 transition-colors duration-300">
                      {v.name}
                    </h3>
                  </div>
                  <div className="text-xs font-medium text-slate-500 bg-slate-800/50 px-3 py-1 rounded-full">
                    {v.year}
                  </div>
                </div>
                <p className="text-slate-400 text-sm mb-4">{v.description}</p>
                <div className="flex gap-2">
                  <a href={v.url} target="_blank" rel="noreferrer" className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500/20 to-violet-600/20 border border-cyan-500/30 text-cyan-400 rounded-lg text-sm font-medium hover:from-cyan-500/30 hover:to-violet-600/30 transition-all duration-300">
                    <FiShare2 className="text-xs" />
                    Visit
                  </a>
                  <button onClick={() => copyToClipboard(v.url, v.version)} className="px-4 py-2 bg-slate-700/60 border border-slate-600/50 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600/60 transition-all duration-300">
                    {copiedVersion === v.version ? <span className="text-green-400">✓</span> : <FiCopy className="text-xs" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/50 bg-gradient-to-b from-slate-900/30 to-slate-950/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-12 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="bg-gradient-to-br from-cyan-500 to-violet-600 text-white font-extrabold rounded-lg px-2 py-1 text-sm">SF</div>
                <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-transparent">
                  {PROJECT_NAME}
                </span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                Full-stack collaborative IDE with real-time editing, integrated communication, and AI-powered assistance.
              </p>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-3">Quick Links</h3>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href={GITHUB_URL} className="hover:text-cyan-400 transition-colors duration-300">GitHub Repository</a></li>
                <li><a href="#features" className="hover:text-cyan-400 transition-colors duration-300">Features</a></li>
                <li><a href="#tech-stack" className="hover:text-cyan-400 transition-colors duration-300">Technology</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-3">Resources</h3>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#versions" className="hover:text-cyan-400 transition-colors duration-300">Version History</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors duration-300">Documentation</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors duration-300">API Reference</a></li>
              </ul>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-slate-800/50">
            <div className="text-sm text-slate-500">
              Made with <span className="text-red-400">❤</span> by Shivansh & Team • {new Date().getFullYear()}
            </div>
            <div className="text-sm text-slate-500 mt-4 md:mt-0">
              Open-source • MIT License
            </div>
          </div>
        </div>
      </footer>

      {/* Join Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="relative w-full max-w-lg bg-gradient-to-b from-slate-800/95 to-slate-900/95 border border-slate-700/50 rounded-2xl shadow-2xl backdrop-blur-xl animate-slideInUp">
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-slate-700/50">
              <div>
                <div className="inline-flex items-center gap-2 text-xs text-cyan-400 bg-cyan-400/10 px-3 py-1 rounded-full mb-3 border border-cyan-400/20">
                  <FiUsers className="text-xs" />
                  <span>Collaborative Session</span>
                </div>
                <h3 className="text-xl font-bold text-white">Join a Session</h3>
                <p className="text-slate-400 text-sm mt-1">Enter a session ID or paste an invite URL to join an existing room</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-cyan-400 transition-colors p-2 hover:bg-slate-700/50 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              <div className="relative mb-6">
                <input
                  type="text"
                  placeholder="Paste session ID or invite URL"
                  value={inviteInput}
                  onChange={(e) => { setInviteInput(e.target.value); setInputError(""); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                  className="w-full bg-slate-800/60 rounded-xl text-white px-4 py-3 border border-slate-700/50 hover:border-slate-600/50 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all duration-300 placeholder:text-slate-500"
                />
                {inputError && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-rose-400 bg-rose-400/10 px-4 py-3 rounded-xl border border-rose-400/20">
                    <FiAlertCircle className="text-base flex-shrink-0" />
                    <span>{inputError}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                <button
                  onClick={handlePasteClipboard}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800/60 border border-slate-700/50 text-slate-200 hover:bg-slate-700/60 hover:border-slate-600/50 rounded-xl transition-all duration-300 text-sm font-medium"
                >
                  <FiCopy className="text-slate-300" />
                  Paste from clipboard
                </button>

                <button
                  onClick={handleJoin}
                  className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-semibold rounded-xl border-0 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 hover:scale-105 transition-all duration-300 text-sm"
                >
                  Join Session
                </button>
              </div>

              <div className="pt-4 border-t border-slate-700/50">
                <div className="flex items-start gap-2 text-xs text-slate-500 mb-3">
                  <FiInfo className="text-slate-400 mt-0.5 flex-shrink-0" />
                  <span>Session ID example format</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 text-sm font-mono text-cyan-300 bg-cyan-400/10 px-4 py-2 rounded-lg border border-cyan-400/20">
                    demo-3qf88i
                  </div>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText("demo-3qf88i");
                      const btn = event.target.closest('button');
                      const original = btn.innerHTML;
                      btn.innerHTML = '<span class="text-green-400">✓</span>';
                      setTimeout(() => btn.innerHTML = original, 2000);
                    }}
                    className="text-slate-400 hover:text-cyan-400 transition-colors p-2 hover:bg-slate-700/50 rounded-lg"
                    title="Copy example"
                  >
                    <FiCopy className="text-sm" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }

        .animate-slideInUp {
          animation: slideInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .animate-slideInLeft {
          animation: slideInLeft 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .animate-slideInRight {
          animation: slideInRight 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Scrollbar styling */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        ::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.5);
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(14, 165, 164, 0.3), rgba(14, 165, 164, 0.6));
          border-radius: 4px;
          border: 1px solid rgba(14, 165, 164, 0.1);
          transition: all 0.3s ease;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, rgba(14, 165, 164, 0.5), rgba(14, 165, 164, 0.8));
        }

        /* Selection styling */
        ::selection {
          background: rgba(14, 165, 164, 0.3);
          color: #f1f5f9;
        }

        /* Focus states */
        button:focus-visible,
        input:focus-visible {
          outline: 2px solid rgba(14, 165, 164, 0.6);
          outline-offset: 2px;
        }

        /* Mobile optimizations */
        @media (max-width: 768px) {
          .animate-slideInLeft,
          .animate-slideInRight {
            animation: slideInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1);
          }
        }

        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          .animate-fadeIn,
          .animate-slideInUp,
          .animate-slideInLeft,
          .animate-slideInRight {
            animation: none;
          }
          
          * {
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default HomePage;