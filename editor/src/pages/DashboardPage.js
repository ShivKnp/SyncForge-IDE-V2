// src/pages/DashboardPage.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, List, Button, Tag, Typography } from 'antd';
import { FaCode, FaComments, FaWhiteboard, FaPlay } from 'react-icons/fa';

const DashboardPage = () => {
  const { user, token } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/dashboard/sessions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const resumeSession = (sessionId) => {
    // Navigate to the session
    window.location.href = `/editor/${sessionId}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome back, {user?.username}!
          </h1>
          <p className="text-slate-400">Manage your coding sessions and collaborate with others.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card 
              title="Recent Sessions" 
              className="bg-slate-800 border-slate-700"
              bodyStyle={{ padding: 0 }}
            >
              <List
                loading={loading}
                dataSource={sessions}
                renderItem={session => (
                  <List.Item className="p-4 border-b border-slate-700 hover:bg-slate-700/30">
                    <div className="flex justify-between items-center w-full">
                      <div>
                        <h3 className="text-white font-medium">
                          {session.title || `Session ${session.id.substring(0, 8)}`}
                        </h3>
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                          <span className="flex items-center gap-1">
                            <FaCode /> {session.file_count || 0} files
                          </span>
                          <span className="flex items-center gap-1">
                            <FaComments /> {session.message_count || 0} messages
                          </span>
                          <Tag color={session.role === 'host' ? 'gold' : 'blue'}>
                            {session.role}
                          </Tag>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Last active: {new Date(session.last_activity || session.updated_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          type="primary" 
                          icon={<FaPlay />}
                          onClick={() => resumeSession(session.id)}
                          className="bg-cyan-600 hover:bg-cyan-700"
                        >
                          Resume
                        </Button>
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            </Card>
          </div>

          <div>
            <Card title="Quick Actions" className="bg-slate-800 border-slate-700 mb-6">
              <div className="space-y-3">
                <Button 
                  type="primary" 
                  block 
                  size="large"
                  className="bg-gradient-to-r from-cyan-500 to-violet-600 border-0"
                  href="/lobby/new"
                >
                  Start New Session
                </Button>
                <Button block size="large" className="bg-slate-700 text-white border-slate-600">
                  Join Session
                </Button>
              </div>
            </Card>

            <Card title="Statistics" className="bg-slate-800 border-slate-700">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Sessions:</span>
                  <span className="text-white">{sessions.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">As Host:</span>
                  <span className="text-white">
                    {sessions.filter(s => s.role === 'host').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Files:</span>
                  <span className="text-white">
                    {sessions.reduce((acc, s) => acc + (s.file_count || 0), 0)}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;



// import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
// import { 
//   Tldraw, 
//   useEditor, 
//   exportAs,
//   createShapeId,
//   getSnapshot,
//   loadSnapshot,
//   useValue,
//   track
// } from '@tldraw/tldraw';
// import { useSync } from '@tldraw/sync';
// import { v4 as uuidv4 } from 'uuid';
// import 'tldraw/tldraw.css';
// import { 
//   Lock, 
//   MessageCircle, 
//   X, 
//   Send, 
//   Upload, 
//   Pencil, 
//   Moon, 
//   Sun, 
//   Bot,
//   Maximize2,
//   Minimize2,
//   Download
// } from 'lucide-react';

// const WEBSOCKET_URL = process.env.REACT_APP_WEB_SOCKET_URL || 'ws://localhost:8080';

// // Theme context for tldraw
// const THEMES = {
//   light: 'light',
//   dark: 'dark'
// };

// // Chat message types
// const MESSAGE_TYPES = {
//   TEXT: 'text',
//   IMAGE: 'image',
//   SKETCH: 'sketch',
//   AGENT_ACTION: 'agent_action'
// };

// // Mock AI agent responses (replace with actual API calls)
// const mockAgentResponse = async (message, canvasData) => {
//   await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
  
//   const responses = [
//     "I can see your sketch! Let me add some annotations to help clarify the concept.",
//     "Based on your diagram, I'll create a complementary flowchart to expand on this idea.",
//     "Great visual! I'm adding some labels and connecting arrows to make it clearer.",
//     "Let me enhance your drawing with additional details and structure."
//   ];
  
//   return responses[Math.floor(Math.random() * responses.length)];
// };

// // stable tab id per browser tab (used as presence id)
// const useTabId = () =>
//   useMemo(() => {
//     const existing = sessionStorage.getItem('tldraw-tab-id');
//     if (existing) return existing;
//     const id = uuidv4();
//     sessionStorage.setItem('tldraw-tab-id', id);
//     return id;
//   }, []);

// // Theme provider component
// const ThemeProvider = ({ children, theme, onThemeChange }) => {
//   useEffect(() => {
//     document.documentElement.setAttribute('data-color-mode', theme);
//     document.documentElement.setAttribute('data-theme', theme);
//   }, [theme]);

//   return children;
// };

// // Helper functions
// const getCanvasSnapshot = async (editor) => {
//   if (!editor) return null;
//   try {
//     return getSnapshot(editor.store);
//   } catch (error) {
//     console.error('Error getting canvas snapshot:', error);
//     return null;
//   }
// };

// const simulateAgentCanvasAction = (editor) => {
//   if (!editor) return;
  
//   const actions = [
//     () => {
//       // Add a text annotation using correct tldraw v4 text shape properties
//       // Add a small 'note' shape as an annotation (schema-safe)
// const shapeId = createShapeId();
// editor.createShape({
//   id: shapeId,
//   type: 'note',            // use 'note' (starter-kit SimpleNoteShape uses `note` prop)
//   x: Math.random() * 400 + 100,
//   y: Math.random() * 400 + 100,
//   props: {
//     note: 'AI: ' + ['Great!', 'Consider this...', 'Important', 'Key insight'][Math.floor(Math.random() * 4)],
//     w: 200,
//     h: 80,
//     // optional styling that the note schema supports:
//     color: ['yellow', 'blue', 'green', 'pink'][Math.floor(Math.random() * 4)],
//     emoji: '💡'
//   }
// });

//     },
//     () => {
//       // Add a simple shape
//       const shapeId = createShapeId();
//       editor.createShape({
//         id: shapeId,
//         type: 'geo',
//         x: Math.random() * 400 + 100,
//         y: Math.random() * 400 + 100,
//         props: {
//           w: 100,
//           h: 60,
//           geo: ['rectangle', 'ellipse'][Math.floor(Math.random() * 2)],
//           fill: 'semi',
//           color: ['blue', 'red', 'green', 'orange'][Math.floor(Math.random() * 4)]
//         }
//       });
//     }
//   ];
  
//   const action = actions[Math.floor(Math.random() * actions.length)];
//   action();
// };

// // Chat Modal Component
// const ChatModal = ({ isOpen, onClose, editor, theme }) => {
//   const [messages, setMessages] = useState([]);
//   const [inputMessage, setInputMessage] = useState('');
//   const [isLoading, setIsLoading] = useState(false);
//   const [isExpanded, setIsExpanded] = useState(false);
//   const messagesEndRef = useRef(null);
//   const fileInputRef = useRef(null);

//   const scrollToBottom = () => {
//     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//   };

//   useEffect(() => {
//     scrollToBottom();
//   }, [messages]);

//   const addMessage = (content, type = MESSAGE_TYPES.TEXT, isAgent = false) => {
//     const message = {
//       id: uuidv4(),
//       content,
//       type,
//       isAgent,
//       timestamp: new Date().toISOString()
//     };
//     setMessages(prev => [...prev, message]);
//     return message;
//   };

//   const handleSendMessage = async () => {
//     if (!inputMessage.trim() || isLoading) return;

//     const userMessage = inputMessage;
//     setInputMessage('');
//     addMessage(userMessage, MESSAGE_TYPES.TEXT, false);

//     setIsLoading(true);
//     try {
//       // Get canvas data for context
//       const canvasData = editor ? await getCanvasSnapshot(editor) : null;
//       const agentResponse = await mockAgentResponse(userMessage, canvasData);
//       addMessage(agentResponse, MESSAGE_TYPES.TEXT, true);

//       // Simulate agent making changes to canvas
//       if (editor && Math.random() > 0.5) {
//         setTimeout(() => {
//           simulateAgentCanvasAction(editor);
//         }, 500);
//       }
//     } catch (error) {
//       addMessage('Sorry, I encountered an error processing your request.', MESSAGE_TYPES.TEXT, true);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const handleImageUpload = async (event) => {
//     const file = event.target.files?.[0];
//     if (!file || !editor) return;

//     try {
//       const imageUrl = URL.createObjectURL(file);
//       addMessage(imageUrl, MESSAGE_TYPES.IMAGE, false);
      
//       // Add image to canvas
//       const asset = await editor.getAssetForExternalContent({ type: 'file', file });
//       if (asset) {
//         const shapeId = createShapeId();
//         editor.createShape({
//           id: shapeId,
//           type: 'image',
//           x: 100,
//           y: 100,
//           props: {
//             assetId: asset.id,
//             w: 300,
//             h: 200
//           }
//         });
//         editor.zoomToFit();
//       }
//     } catch (error) {
//       console.error('Error uploading image:', error);
//     }

//     event.target.value = '';
//   };

//   const createWhiteboardSketch = async () => {
//     if (!editor) return;

//     try {
//       // Instead of trying to show the snapshot object, just add a message
//       addMessage('Started sketching on whiteboard...', MESSAGE_TYPES.SKETCH, false);
      
//       // Focus on canvas for immediate drawing
//       editor.selectNone();
//       editor.setCurrentTool('draw');
      
//       // Close the modal so user can draw
//       setTimeout(() => {
//         onClose();
//       }, 500);
//     } catch (error) {
//       console.error('Error creating whiteboard sketch:', error);
//     }
//   };

//   const exportCanvas = async () => {
//   if (!editor) return;

//   try {
//     const shapes = editor.getCurrentPageShapes();
//     if (!shapes || shapes.length === 0) {
//       console.warn('Nothing to export');
//       return;
//     }

//     const ids = shapes.map(s => s.id);

//     // Call exportAs and handle different possible return shapes (Blob, { blob }, url string, or undefined)
//     const res = await exportAs(editor, ids, 'png');

//     // Try to resolve a Blob from the result
//     let blob = null;

//     if (!res) {
//       // Some tldraw versions don't return a value — in that case try the older two-arg form or export the first shape as fallback
//       console.warn('exportAs returned undefined — attempting fallback export');

//       // Fallback attempt: try to export a single shape via exportAs with just editor and type (best-effort)
//       try {
//         const fallback = await exportAs(editor, ids[0], 'png');
//         if (fallback instanceof Blob) blob = fallback;
//         else if (fallback && fallback.blob) blob = fallback.blob;
//         else if (typeof fallback === 'string') {
//           const a = document.createElement('a');
//           a.href = fallback;
//           a.download = `whiteboard-export-${Date.now()}.png`;
//           document.body.appendChild(a);
//           a.click();
//           a.remove();
//           return;
//         }
//       } catch (e) {
//         console.warn('Fallback export failed', e);
//       }
//     } else if (res instanceof Blob) {
//       blob = res;
//     } else if (res.blob instanceof Blob) {
//       blob = res.blob;
//     } else if (typeof res === 'string') {
//       // res is a URL — download it
//       const a = document.createElement('a');
//       a.href = res;
//       a.download = `whiteboard-export-${Date.now()}.png`;
//       document.body.appendChild(a);
//       a.click();
//       a.remove();
//       return;
//     }

//     if (!blob) {
//       console.warn('Unable to obtain a blob from exportAs; export aborted.');
//       return;
//     }

//     const url = URL.createObjectURL(blob);
//     const a = document.createElement('a');
//     a.href = url;
//     a.download = `whiteboard-export-${Date.now()}.png`;
//     document.body.appendChild(a);
//     a.click();
//     a.remove();
//     URL.revokeObjectURL(url);
//   } catch (error) {
//     console.error('Export failed:', error);
//   }
// };


//   if (!isOpen) return null;

//   const modalWidth = isExpanded ? '80vw' : '400px';
//   const modalHeight = isExpanded ? '80vh' : '600px';

//   return (
//     <div style={{
//       position: 'fixed',
//       top: 0,
//       left: 0,
//       right: 0,
//       bottom: 0,
//       backgroundColor: 'rgba(0, 0, 0, 0.5)',
//       display: 'flex',
//       alignItems: 'center',
//       justifyContent: 'center',
//       zIndex: 10000
//     }}>
//       <div style={{
//         width: modalWidth,
//         height: modalHeight,
//         backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
//         borderRadius: '12px',
//         display: 'flex',
//         flexDirection: 'column',
//         boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
//         border: theme === 'dark' ? '1px solid #374151' : '1px solid #e5e7eb',
//         overflow: 'hidden'
//       }}>
//         {/* Header */}
//         <div style={{
//           padding: '16px 20px',
//           borderBottom: theme === 'dark' ? '1px solid #374151' : '1px solid #e5e7eb',
//           display: 'flex',
//           alignItems: 'center',
//           justifyContent: 'space-between',
//           backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc'
//         }}>
//           <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
//             <Bot size={20} color={theme === 'dark' ? '#60a5fa' : '#3b82f6'} />
//             <h3 style={{ 
//               margin: 0, 
//               fontSize: '16px', 
//               fontWeight: '600',
//               color: theme === 'dark' ? '#f8fafc' : '#1e293b'
//             }}>
//               Visual AI Assistant
//             </h3>
//           </div>
//           <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
//             <button
//               onClick={() => setIsExpanded(!isExpanded)}
//               style={{
//                 background: 'none',
//                 border: 'none',
//                 padding: '8px',
//                 borderRadius: '6px',
//                 cursor: 'pointer',
//                 display: 'flex',
//                 alignItems: 'center',
//                 color: theme === 'dark' ? '#9ca3af' : '#6b7280',
//                 backgroundColor: 'transparent'
//               }}
//               onMouseEnter={e => e.target.style.backgroundColor = theme === 'dark' ? '#374151' : '#f3f4f6'}
//               onMouseLeave={e => e.target.style.backgroundColor = 'transparent'}
//             >
//               {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
//             </button>
//             <button
//               onClick={onClose}
//               style={{
//                 background: 'none',
//                 border: 'none',
//                 padding: '8px',
//                 borderRadius: '6px',
//                 cursor: 'pointer',
//                 display: 'flex',
//                 alignItems: 'center',
//                 color: theme === 'dark' ? '#9ca3af' : '#6b7280',
//                 backgroundColor: 'transparent'
//               }}
//               onMouseEnter={e => e.target.style.backgroundColor = theme === 'dark' ? '#374151' : '#f3f4f6'}
//               onMouseLeave={e => e.target.style.backgroundColor = 'transparent'}
//             >
//               <X size={16} />
//             </button>
//           </div>
//         </div>

//         {/* Messages */}
//         <div style={{
//           flex: 1,
//           overflowY: 'auto',
//           padding: '16px',
//           display: 'flex',
//           flexDirection: 'column',
//           gap: '12px'
//         }}>
//           {messages.length === 0 && (
//             <div style={{
//               textAlign: 'center',
//               color: theme === 'dark' ? '#9ca3af' : '#6b7280',
//               padding: '40px 20px',
//               fontSize: '14px'
//             }}>
//               <Bot size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
//               <div>Start a conversation with your AI assistant</div>
//               <div style={{ fontSize: '12px', marginTop: '8px' }}>
//                 Upload images, create sketches, or ask questions about your whiteboard
//               </div>
//             </div>
//           )}
          
//           {messages.map((message) => (
//             <div key={message.id} style={{
//               display: 'flex',
//               justifyContent: message.isAgent ? 'flex-start' : 'flex-end'
//             }}>
//               <div style={{
//                 maxWidth: '80%',
//                 padding: '12px 16px',
//                 borderRadius: '12px',
//                 backgroundColor: message.isAgent 
//                   ? (theme === 'dark' ? '#374151' : '#f3f4f6')
//                   : (theme === 'dark' ? '#3b82f6' : '#3b82f6'),
//                 color: message.isAgent 
//                   ? (theme === 'dark' ? '#f8fafc' : '#1e293b')
//                   : '#ffffff',
//                 fontSize: '14px',
//                 lineHeight: '1.5'
//               }}>
//                 {message.type === MESSAGE_TYPES.IMAGE ? (
//                   <img 
//                     src={message.content} 
//                     alt="Uploaded"
//                     style={{ 
//                       maxWidth: '100%', 
//                       borderRadius: '8px',
//                       height: 'auto'
//                     }}
//                   />
//                 ) : (
//                   message.content
//                 )}
//               </div>
//             </div>
//           ))}
          
//           {isLoading && (
//             <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
//               <div style={{
//                 padding: '12px 16px',
//                 borderRadius: '12px',
//                 backgroundColor: theme === 'dark' ? '#374151' : '#f3f4f6',
//                 color: theme === 'dark' ? '#9ca3af' : '#6b7280',
//                 fontSize: '14px'
//               }}>
//                 <div style={{ display: 'flex', gap: '4px' }}>
//                   <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'currentColor', animation: 'pulse 1.5s infinite' }}></div>
//                   <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'currentColor', animation: 'pulse 1.5s infinite 0.5s' }}></div>
//                   <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'currentColor', animation: 'pulse 1.5s infinite 1s' }}></div>
//                 </div>
//               </div>
//             </div>
//           )}
//           <div ref={messagesEndRef} />
//         </div>

//         {/* Input Area */}
//         <div style={{
//           padding: '16px',
//           borderTop: theme === 'dark' ? '1px solid #374151' : '1px solid #e5e7eb',
//           backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc'
//         }}>
//           {/* Action Buttons */}
//           <div style={{ 
//             display: 'flex', 
//             gap: '8px', 
//             marginBottom: '12px',
//             flexWrap: 'wrap'
//           }}>
//             <input
//               ref={fileInputRef}
//               type="file"
//               accept="image/*"
//               onChange={handleImageUpload}
//               style={{ display: 'none' }}
//             />
//             <button
//               onClick={() => fileInputRef.current?.click()}
//               style={{
//                 display: 'flex',
//                 alignItems: 'center',
//                 gap: '6px',
//                 padding: '8px 12px',
//                 fontSize: '12px',
//                 border: theme === 'dark' ? '1px solid #374151' : '1px solid #d1d5db',
//                 borderRadius: '6px',
//                 backgroundColor: 'transparent',
//                 color: theme === 'dark' ? '#9ca3af' : '#6b7280',
//                 cursor: 'pointer'
//               }}
//               onMouseEnter={e => e.target.style.backgroundColor = theme === 'dark' ? '#374151' : '#f3f4f6'}
//               onMouseLeave={e => e.target.style.backgroundColor = 'transparent'}
//             >
//               <Upload size={14} />
//               Upload Image
//             </button>
            
//             <button
//               onClick={createWhiteboardSketch}
//               style={{
//                 display: 'flex',
//                 alignItems: 'center',
//                 gap: '6px',
//                 padding: '8px 12px',
//                 fontSize: '12px',
//                 border: theme === 'dark' ? '1px solid #374151' : '1px solid #d1d5db',
//                 borderRadius: '6px',
//                 backgroundColor: 'transparent',
//                 color: theme === 'dark' ? '#9ca3af' : '#6b7280',
//                 cursor: 'pointer'
//               }}
//               onMouseEnter={e => e.target.style.backgroundColor = theme === 'dark' ? '#374151' : '#f3f4f6'}
//               onMouseLeave={e => e.target.style.backgroundColor = 'transparent'}
//             >
//               <Pencil size={14} />
//               Create Sketch
//             </button>

//             <button
//               onClick={exportCanvas}
//               style={{
//                 display: 'flex',
//                 alignItems: 'center',
//                 gap: '6px',
//                 padding: '8px 12px',
//                 fontSize: '12px',
//                 border: theme === 'dark' ? '1px solid #374151' : '1px solid #d1d5db',
//                 borderRadius: '6px',
//                 backgroundColor: 'transparent',
//                 color: theme === 'dark' ? '#9ca3af' : '#6b7280',
//                 cursor: 'pointer'
//               }}
//               onMouseEnter={e => e.target.style.backgroundColor = theme === 'dark' ? '#374151' : '#f3f4f6'}
//               onMouseLeave={e => e.target.style.backgroundColor = 'transparent'}
//             >
//               <Download size={14} />
//               Export
//             </button>
//           </div>

//           {/* Message Input */}
//           <div style={{ display: 'flex', gap: '8px' }}>
//             <input
//               type="text"
//               value={inputMessage}
//               onChange={(e) => setInputMessage(e.target.value)}
//               onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
//               placeholder="Ask about your whiteboard, request changes, or get visual assistance..."
//               disabled={isLoading}
//               style={{
//                 flex: 1,
//                 padding: '12px 16px',
//                 border: theme === 'dark' ? '1px solid #374151' : '1px solid #d1d5db',
//                 borderRadius: '8px',
//                 fontSize: '14px',
//                 backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
//                 color: theme === 'dark' ? '#f8fafc' : '#1e293b',
//                 outline: 'none'
//               }}
//             />
//             <button
//               onClick={handleSendMessage}
//               disabled={!inputMessage.trim() || isLoading}
//               style={{
//                 padding: '12px 16px',
//                 backgroundColor: '#3b82f6',
//                 color: '#ffffff',
//                 border: 'none',
//                 borderRadius: '8px',
//                 cursor: inputMessage.trim() && !isLoading ? 'pointer' : 'not-allowed',
//                 display: 'flex',
//                 alignItems: 'center',
//                 opacity: inputMessage.trim() && !isLoading ? 1 : 0.5
//               }}
//             >
//               <Send size={16} />
//             </button>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// // small read-only badge
// const ReadonlyBadge = ({ boardConfig, theme }) => (
//   <div style={{
//     position: 'absolute',
//     top: 12,
//     right: 12,
//     zIndex: 1400,
//     background: theme === 'dark' ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.92)',
//     color: theme === 'dark' ? '#fff' : '#1e293b',
//     padding: '8px 12px',
//     borderRadius: 8,
//     fontSize: 12,
//     display: 'flex',
//     gap: 8,
//     alignItems: 'center',
//     border: theme === 'dark' ? '1px solid rgba(255,255,255,0.03)' : '1px solid rgba(0,0,0,0.08)'
//   }}>
//     <Lock size={14}/>
//     <div style={{ lineHeight: 1 }}>
//       Read-only — editing disabled
//       {boardConfig?.isSharedNote && (
//         <div style={{ fontSize: 11, color: theme === 'dark' ? '#93c5fd' : '#3b82f6', fontWeight: 600 }}>
//           Shared by {boardConfig.sharedFrom}
//         </div>
//       )}
//     </div>
//   </div>
// );

// // Theme Toggle Button - Updated for tldraw v4 API
// // Theme Toggle Button - Updated for tldraw v4 API
// const ThemeToggle = ({ theme, onThemeChange, editor }) => {
//   // NOTE: do NOT call useEditor() here — ThemeToggle is rendered outside the Tldraw provider.
//   const handleThemeToggle = () => {
//     const newTheme = theme === 'light' ? 'dark' : 'light';
//     onThemeChange(newTheme);

//     // Try a few safe fallbacks to update tldraw's internal state if editor is available.
//     if (!editor) return;

//     try {
//       // Preferred: update user preferences if available
//       if (editor.user && typeof editor.user.updateUserPreferences === 'function') {
//         editor.user.updateUserPreferences({ colorScheme: newTheme });
//         return;
//       }

//       // Some versions expose setInstancePresence / broadcast / store APIs; try gracefully
//       if (typeof editor.setInstancePresence === 'function') {
//         // no-op but avoid crash (presence isn't theme)
//       }
//       if (editor.store && typeof editor.store.setState === 'function') {
//         // attempt to set a theme-like value if present (best-effort only)
//         try {
//           const state = editor.store.getState ? editor.store.getState() : {};
//           editor.store.setState({ ...state, colorScheme: newTheme });
//         } catch (e) { /* ignore */ }
//       }
//     } catch (err) {
//       // Best-effort only — don't throw
//       console.warn('ThemeToggle: failed to update editor preferences', err);
//     }
//   };

//   return (
//     <div style={{
//       position: 'absolute',
//       top: 42,
//       left: 3,
//       zIndex: 1400
//     }}>
//       <button
//         onClick={handleThemeToggle}
//         style={{
//           background: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
//           color: theme === 'dark' ? '#fff' : '#1e293b',
//           border: 'none',
//           padding: '8px',
//           borderRadius: '6px',
//           cursor: 'pointer',
//           display: 'flex',
//           alignItems: 'center',
//           backdropFilter: 'blur(8px)'
//         }}
//         onMouseEnter={e => e.target.style.background = theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}
//         onMouseLeave={e => e.target.style.background = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}
//       >
//         {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
//       </button>
//     </div>
//   );
// };


// // Chat Toggle Button
// const ChatToggle = ({ onToggle, theme }) => (
//   <div style={{
//     position: 'absolute',
//     bottom: 20,
//     right: 20,
//     zIndex: 1400
//   }}>
//     <button
//       onClick={onToggle}
//       style={{
//         background: '#3b82f6',
//         color: '#ffffff',
//         border: 'none',
//         padding: '12px',
//         borderRadius: '50%',
//         cursor: 'pointer',
//         display: 'flex',
//         alignItems: 'center',
//         justifyContent: 'center',
//         boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
//         width: '48px',
//         height: '48px'
//       }}
//       onMouseEnter={e => {
//         e.target.style.transform = 'scale(1.05)';
//         e.target.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
//       }}
//       onMouseLeave={e => {
//         e.target.style.transform = 'scale(1)';
//         e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
//       }}
//     >
//       <MessageCircle size={20} />
//     </button>
//   </div>
// );

// // Custom collaborator cursor + presence sender
// const CustomCollaboratorCursor = () => {
//   const editor = useEditor();

//   useEffect(() => {
//     if (!editor) return;

//     // Screen -> page conversion with multiple fallbacks
//     const screenToPage = (screen) => {
//       try {
//         if (typeof editor.viewportScreenToPage === 'function') {
//           const r = editor.viewportScreenToPage(screen);
//           if (r) return r;
//         }
//         if (typeof editor.screenToPage === 'function') {
//           const r = editor.screenToPage(screen);
//           if (r) return r;
//         }

//         // fallback: use container bounding rect to compute relative coordinates
//         const container = document.querySelector('.tldraw__wrap, .tldraw, .tlui__app') || (editor && editor.container) || document.body;
//         const rect = container.getBoundingClientRect();
//         const rel = { x: screen.x - rect.left, y: screen.y - rect.top };

//         if (typeof editor.viewportScreenToPage === 'function') return editor.viewportScreenToPage(rel);
//         if (typeof editor.screenToPage === 'function') return editor.screenToPage(rel);
//       } catch (e) {
//         // ignore
//       }
//       return null;
//     };

//     // Try available presence APIs in order and return true if accepted
//     const trySetPresenceOnce = (presence) => {
//       try {
//         if (typeof editor.setInstancePresence === 'function') {
//           editor.setInstancePresence(presence);
//           return true;
//         }
//         if (typeof editor.setPresence === 'function') {
//           editor.setPresence(presence);
//           return true;
//         }
//         if (editor.store && typeof editor.store.setPresence === 'function') {
//           editor.store.setPresence(presence);
//           return true;
//         }
//         if (typeof editor.broadcast === 'function') {
//           editor.broadcast({ type: 'presence', payload: presence });
//           return true;
//         }
//       } catch (e) {
//         // swallow error; we'll retry
//       }
//       return false;
//     };

//     // Build canonical presence object using sessionStorage username + tab id
//     const tabId = sessionStorage.getItem('tldraw-tab-id') || uuidv4();
//     const providedName = sessionStorage.getItem('codecrew-username') || 'anonymous';
//     const color = sessionStorage.getItem('tldraw-cursor-color') || '#60a5fa';

//     // Heartbeat presence - send once on mount and periodically
//     const sendPresenceNow = async (pagePoint) => {
//       const presence = {
//         id: tabId,
//         userId: providedName,
//         name: providedName,
//         userName: providedName,
//         point: pagePoint ? { x: pagePoint.x, y: pagePoint.y } : undefined,
//         lastActivity: new Date().toISOString(),
//         color
//       };
//       trySetPresenceOnce(presence);
//     };

//     // send initial presence (no point yet)
//     sendPresenceNow(undefined).catch(() => { /* ignore */ });

//     // periodic heartbeat to keep collaborator record alive
//     const heartbeat = setInterval(() => {
//       sendPresenceNow(undefined).catch(() => {});
//     }, 5000);

//     // pointer move handler -> compute page point and publish presence
//     let last = 0;
//     const onPointerMove = (e) => {
//       const now = Date.now();
//       if (now - last < 60) return; // throttle ~16fps
//       last = now;

//       const screen = { x: e.clientX, y: e.clientY };
//       const pagePoint = screenToPage(screen);

//       const presence = {
//         id: tabId,
//         userId: providedName,
//         name: providedName,
//         userName: providedName,
//         point: pagePoint ? { x: pagePoint.x, y: pagePoint.y } : undefined,
//         lastActivity: new Date().toISOString(),
//         color
//       };

//       trySetPresenceOnce(presence);
//     };

//     window.addEventListener('mousemove', onPointerMove);

//     return () => {
//       clearInterval(heartbeat);
//       window.removeEventListener('mousemove', onPointerMove);
//     };
//   }, [editor]);

//   // Render collaborator cursors
//   const collaborators = (() => {
//     try {
//       if (!editor) return [];
//       if (typeof editor.getCollaboratorsOnCurrentPage === 'function') {
//         return editor.getCollaboratorsOnCurrentPage() || [];
//       }
//       if (typeof editor.getCollaborators === 'function') {
//         return editor.getCollaborators() || [];
//       }
//       if (editor.store && typeof editor.store.getPresence === 'function') {
//         const map = editor.store.getPresence() || {};
//         return Object.values(map);
//       }
//     } catch (e) {
//       // ignore
//     }
//     return [];
//   })();

//   const pageToScreen = (p) => {
//     try {
//       if (!p) return null;
//       if (typeof editor.viewportPageToScreen === 'function') return editor.viewportPageToScreen(p);
//       if (typeof editor.pageToScreenPoint === 'function') return editor.pageToScreenPoint(p);
//       if (typeof editor.pageToScreen === 'function') return editor.pageToScreen(p);
//     } catch (e) { /* ignore */ }
//     return null;
//   };

//   const renderCursors = () => {
//     if (!editor) return null;
//     return collaborators.map((c, i) => {
//       try {
//         const page = c?.point || c?.camera?.point || c?.position;
//         if (!page) return null;
//         const screen = pageToScreen(page);
//         if (!screen) return null;
//         const left = Math.round(screen.x);
//         const top = Math.round(screen.y);
//         const name = c.name || c.userName || c.userId || c.id || 'anon';
//         const color = c.color || '#60a5fa';
//         return (
//           <div key={c.id || c.userId || i} style={{
//             position: 'absolute',
//             left,
//             top,
//             transform: 'translate(-50%,-110%)',
//             pointerEvents: 'none',
//             zIndex: 2000
//           }}>
//             <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
//               <div style={{ width: 10, height: 10, borderRadius: 999, background: color, boxShadow: '0 4px 12px rgba(0,0,0,0.45)' }} />
//               <div style={{
//                 background: 'rgba(0,0,0,0.72)',
//                 color: '#fff',
//                 padding: '2px 6px',
//                 borderRadius: 6,
//                 fontSize: 11,
//                 whiteSpace: 'nowrap'
//               }}>
//                 {name}
//               </div>
//             </div>
//           </div>
//         );
//       } catch (e) {
//         return null;
//       }
//     });
//   };

//   return (
//     <>
//       {renderCursors()}
//     </>
//   );
// };

// /**
//  * Full Enhanced Whiteboard component with Chat and Agent features
//  */
// export default function EnhancedWhiteboard({
//   sessionId,
//   boardId,
//   isReadOnly = false,
//   userName,
//   isHost = false,
//   boardConfig = {}
// }) {
//   const tabId = useTabId();
//   const [theme, setTheme] = useState(() => {
//     const saved = localStorage.getItem('tldraw-theme');
//     return saved === 'dark' ? 'dark' : 'light';
//   });
//   const [isChatOpen, setIsChatOpen] = useState(false);

//   // Save theme preference
//   useEffect(() => {
//     localStorage.setItem('tldraw-theme', theme);
//   }, [theme]);

//   // make sure the canonical username is stored (used by presence sender)
//   useEffect(() => {
//     if (userName) {
//       sessionStorage.setItem('codecrew-username', userName);
//     } else {
//       sessionStorage.setItem('codecrew-username', sessionStorage.getItem('codecrew-username') || 'anonymous');
//     }
//   }, [userName]);

//   const wsUrl = useMemo(() => {
//     const base = `${WEBSOCKET_URL}/whiteboard/${sessionId}/${boardId}`;
//     const params = new URLSearchParams({ tabId, userName: userName || 'anonymous' });
//     return `${base}?${params.toString()}`;
//   }, [sessionId, boardId, tabId, userName]);

//   const privatePrefixes = useMemo(() => ['private_', 'private-note', 'note_', 'note-'], []);
//   const isPrivate = useMemo(() => !!(boardId && privatePrefixes.some(p => boardId.startsWith(p))), [boardId, privatePrefixes]);

//   const canEdit = useMemo(() => {
//     if (isPrivate) return true;
//     if (!boardConfig || !boardConfig.mode) return !!isHost && !boardConfig?.isSharedNote;
//     if (boardConfig.isSharedNote) return boardConfig.sharedFrom === userName;
//     if (boardConfig.isPrivateNote) return boardConfig.createdBy === userName;
//     if (isHost) return true;
//     return boardConfig.mode === 'public' || boardConfig.mode === 'everyone';
//   }, [isPrivate, boardConfig, userName, isHost]);

//   const shouldBeReadonly = useMemo(() => isReadOnly || !canEdit, [isReadOnly, canEdit]);

//   // useSync store: pass persistenceKey only for private boards
//   const store = useSync({
//     uri: wsUrl,
//     ...(isPrivate ? { persistenceKey: `tldraw:private:${sessionId}:${boardId}:${userName}` } : {}),
//   });

//   // UI overrides for actions/tools with theme support
//   const uiOverrides = useMemo(() => ({
//     actions(editor, actions) {
//       const a = { ...(actions || {}) };
//       if (shouldBeReadonly) {
//         ['delete', 'delete-selected', 'copy', 'duplicate', 'cut', 'paste', 'undo', 'redo', 'bring-forward', 'bring-to-front', 'send-backward', 'send-to-back'].forEach(k => {
//           if (a[k]) delete a[k];
//         });
//       } else {
//         if (a['export']) delete a['export'];
//       }
//       return a;
//     },

//     tools(editor, tools) {
//       const t = { ...(tools || {}) };
//       if (shouldBeReadonly) {
//         ['style', 'color', 'fill', 'stroke', 'opacity', 'dash', 'size', 'line', 'strokeSize'].forEach(k => {
//           if (t[k]) delete t[k];
//         });
//       }
//       return t;
//     }
//   }), [shouldBeReadonly]);

//   // Components override with theme-aware customizations
//   const componentsOverride = useMemo(() => {
//     const baseComponents = {
//       CollaboratorCursor: CustomCollaboratorCursor,
//     };

//     if (shouldBeReadonly) {
//       return {
//         ...baseComponents,
//         Toolbar: () => null,
//         Sidebar: () => null,
//         ActionsMenu: () => null,
//         TopTools: () => null,
//         ToolsPanel: () => null,
//         StylePanel: () => null,
//         StyleMenu: () => null,
//         StylesMenu: () => null,
//       };
//     }

//     return baseComponents;
//   }, [shouldBeReadonly]);

//   const [permissionError, setPermissionError] = useState(null);
//   useEffect(() => {
//     if (store?.status === 'error') {
//       setPermissionError('Failed to connect to whiteboard. You may not have permission to access this board.');
//     } else {
//       setPermissionError(null);
//     }
//   }, [store?.status]);

//   // Get editor instance for chat functionality
//   const [editorInstance, setEditorInstance] = useState(null);

//   const handleMount = useCallback((editor) => {
//     setEditorInstance(editor);
//   }, []);

//   if (permissionError) {
//     return (
//       <div style={{ 
//         padding: 20,
//         color: theme === 'dark' ? '#f8fafc' : '#1e293b',
//         backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff'
//       }}>
//         {permissionError}
//       </div>
//     );
//   }

//   if (!store || store.status === 'loading') {
//     return (
//       <ThemeProvider theme={theme} onThemeChange={setTheme}>
//         <div style={{ 
//           display: 'flex', 
//           alignItems: 'center', 
//           justifyContent: 'center', 
//           height: '100%',
//           backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
//           color: theme === 'dark' ? '#9ca3af' : '#6b7280'
//         }}>
//           <div style={{ textAlign: 'center' }}>
//             <div style={{ marginBottom: 8 }}>Connecting to whiteboard...</div>
//             <div style={{ fontSize: 12, opacity: 0.7 }}>Room: {sessionId} | Board: {boardId}</div>
//           </div>
//         </div>
//       </ThemeProvider>
//     );
//   }

//   return (
//     <ThemeProvider theme={theme} onThemeChange={setTheme}>
//       <div style={{ position: 'relative', width: '100%', height: '100%' }}>
//         {/* Theme Toggle */}
//        {/* Theme Toggle */}
// <ThemeToggle theme={theme} onThemeChange={setTheme} editor={editorInstance} />

        
//         {/* Read-only Badge */}
//         {shouldBeReadonly && <ReadonlyBadge boardConfig={boardConfig} theme={theme} />}
        
//         {/* Chat Toggle Button */}
//         {!shouldBeReadonly && (
//           <ChatToggle onToggle={() => setIsChatOpen(true)} theme={theme} />
//         )}

//         {/* Main Tldraw Canvas */}
//         <Tldraw
//           store={store}
//           isReadonly={shouldBeReadonly}
//           overrides={uiOverrides}
//           components={componentsOverride}
//           onMount={handleMount}
//         />

//         {/* Chat Modal */}
//         <ChatModal 
//           isOpen={isChatOpen}
//           onClose={() => setIsChatOpen(false)}
//           editor={editorInstance}
//           theme={theme}
//         />

//         {/* CSS for animations and theming */}
//         <style jsx>{`
//           @keyframes pulse {
//             0%, 100% { opacity: 0.4; }
//             50% { opacity: 1; }
//           }
          
//           .tldraw {
//             background-color: ${theme === 'dark' ? '#0f172a' : '#ffffff'} !important;
//           }
          
//           /* Dark theme for tldraw */
//           ${theme === 'dark' ? `
//             .tlui-theme__dark,
//             .tldraw.dark {
//               --color-background: #0f172a;
//               --color-muted: #1e293b;
//               --color-panel: #374151;
//               --color-text: #f8fafc;
//               --color-text-1: #e2e8f0;
//               --color-text-2: #cbd5e1;
//             }
//           ` : `
//             .tlui-theme__light,
//             .tldraw.light {
//               --color-background: #ffffff;
//               --color-muted: #f8fafc;
//               --color-panel: #ffffff;
//               --color-text: #1e293b;
//               --color-text-1: #374151;
//               --color-text-2: #6b7280;
//             }
//           `}
          
//           /* Custom scrollbar for chat */
//           ::-webkit-scrollbar {
//             width: 6px;
//           }
          
//           ::-webkit-scrollbar-track {
//             background: ${theme === 'dark' ? '#374151' : '#f3f4f6'};
//             border-radius: 3px;
//           }
          
//           ::-webkit-scrollbar-thumb {
//             background: ${theme === 'dark' ? '#6b7280' : '#d1d5db'};
//             border-radius: 3px;
//           }
          
//           ::-webkit-scrollbar-thumb:hover {
//             background: ${theme === 'dark' ? '#9ca3af' : '#9ca3af'};
//           }
          
//           /* Enhanced focus styles */
//           button:focus-visible,
//           input:focus-visible {
//             outline: 2px solid #3b82f6;
//             outline-offset: 2px;
//           }
          
//           /* Smooth transitions */
//           button {
//             transition: all 0.15s ease-in-out;
//           }
          
//           /* Modal backdrop blur effect */
//           .modal-backdrop {
//             backdrop-filter: blur(8px);
//           }
          
//           /* Ensure proper theming cascades */
//           [data-theme="dark"] {
//             color-scheme: dark;
//           }
          
//           [data-theme="light"] {
//             color-scheme: light;
//           }
//         `}</style>
//       </div>
//     </ThemeProvider>
//   );
// }