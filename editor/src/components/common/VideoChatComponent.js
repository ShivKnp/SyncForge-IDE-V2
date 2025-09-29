// src/components/common/VideoChatComponent.jsx
// you can enable this yo show a pop up video screen 
import React, { useEffect, useRef, useState } from 'react';
import { Resizable } from 're-resizable';
import Draggable from 'react-draggable';
import {
  FaVideo, FaVideoSlash, FaMicrophone, FaMicrophoneSlash, FaPhone,
  FaExpand, FaCompress, FaDesktop
} from 'react-icons/fa';

/**
 * Props:
 * - localStream, pinnedStream, pinnedPeer
 * - handleEndCall, pinnedStreamType
 * - isMicOn, isCameraOn, toggleMic, toggleCamera
 * - isScreenSharing, handleToggleScreenShare
 * - playbackEnabled (boolean) : global playback state
 * - enablePlayback (function) : call when user clicks central CTA to enable playback
 */
const VideoChatComponent = ({
  localStream,
  pinnedStream,
  pinnedPeer,
  handleEndCall,
  pinnedStreamType,
  isMicOn,
  isCameraOn,
  toggleMic,
  toggleCamera,
  isScreenSharing,
  handleToggleScreenShare,
  playbackEnabled = false,
  enablePlayback = () => {}
}) => {
  const localVideoRef = useRef(null);
  const pinnedVideoRef = useRef(null);
  const nodeRef = useRef(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showLocalPreview, setShowLocalPreview] = useState(true);
  // inside useVideoChat hook (near other states)


  // attach and attempt play helper
  const attachAndPlay = (el, stream, { muted = true, name = '' } = {}) => {
    if (!el) return;
    try {
      if (el.srcObject !== stream) {
        el.srcObject = stream || null;
        console.debug(`[VideoChat] attach ${name} stream`, stream ? stream.id : null);
      }
    } catch (err) {
      console.warn(`[VideoChat] failed to set srcObject (${name})`, err);
    }
    el.muted = !!muted;
    el.onloadedmetadata = () => {
      el.play().catch(err => {
        // may be blocked until user gesture
        // console.debug(`[VideoChat] play() blocked (${name})`, err);
      });
    };
    setTimeout(() => {
      el.play().catch(() => {});
    }, 300);
  };

  // local preview always muted
  useEffect(() => {
    if (localVideoRef.current) {
      attachAndPlay(localVideoRef.current, localStream, { muted: true, name: 'local' });
    }
  }, [localStream]);

  // pinned preview attaches stream and mutes/unmutes based on playbackEnabled
  useEffect(() => {
    if (!pinnedVideoRef.current) return;

    // when playbackEnabled is true -> try to unmute pinned preview (user gesture granted)
    const muted = !playbackEnabled;
    attachAndPlay(pinnedVideoRef.current, pinnedStream, { muted, name: 'pinned' });

    // if user enables playback later, unmute and play
    if (playbackEnabled && pinnedVideoRef.current) {
      try { pinnedVideoRef.current.muted = false; } catch {}
      pinnedVideoRef.current.play().catch(() => {});
    }
  }, [pinnedStream, playbackEnabled]);

  const toggleMaximize = () => setIsMaximized(s => !s);

  return (
    <Draggable nodeRef={nodeRef} disabled={isMaximized}>
      <div
        ref={nodeRef}
        className={`absolute top-6 right-6 z-40 ${isMaximized ? 'fixed top-0 left-0 w-full h-full' : ''}`}
        style={{ zIndex: 80 }}
      >
        <Resizable
          defaultSize={isMaximized ? { width: '100%', height: '100%' } : { width: 420, height: 320 }}
          minWidth={220}
          minHeight={140}
        >
          <div style={{ width: '100%', height: '100%', padding: 0, overflow: 'hidden', background: '#000', borderRadius: 8 }}>
            <div className="flex items-center justify-between p-2 bg-black/30 cursor-move">
              <div className="text-sm font-semibold">{pinnedPeer?.userName || 'Pinned'}</div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowLocalPreview(s => !s)} className="pill">{showLocalPreview ? 'Hide' : 'Show'}</button>
                <button onClick={toggleMaximize} className="pill" title={isMaximized ? 'Restore' : 'Maximize'}>
                  {isMaximized ? <FaCompress /> : <FaExpand />}
                </button>
              </div>
            </div>

            <div style={{ position:'relative', width:'100%', height:'100%' }}>
              <video
                ref={pinnedVideoRef}
                autoPlay
                playsInline
                className={pinnedStreamType === 'screen' ? 'object-contain' : 'object-cover'}
                style={{ width:'100%', height:'100%', background:'#000' }}
              />

              {/* playback CTA overlay when playback disabled */}
              {!playbackEnabled && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none'
                }}>
                  <div style={{ pointerEvents: 'auto', background: 'rgba(0,0,0,0.6)', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                    <div className="text-sm text-white mb-2">Audio playback is blocked by browser</div>
                    <button
                      onClick={() => enablePlayback()}
                      className="px-3 py-1 rounded bg-blue-600 text-white"
                    >
                      Enable Playback
                    </button>
                  </div>
                </div>
              )}

              {showLocalPreview && (
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{
                    position:'absolute',
                    right:12,
                    bottom:12,
                    width:160,
                    height:90,
                    borderRadius:8,
                    border:'1px solid rgba(255,255,255,0.06)',
                    objectFit:'cover',
                    background: '#000'
                  }}
                />
              )}

              <div style={{ position:'absolute', left: '50%', transform:'translateX(-50%)', bottom:12 }}>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <button onClick={toggleCamera} className="pill" title={isCameraOn ? 'Turn camera off' : 'Turn camera on'}>
                    {isCameraOn ? <FaVideo/> : <FaVideoSlash/>}
                  </button>
                  <button onClick={toggleMic} className="pill" title={isMicOn ? 'Mute' : 'Unmute'}>
                    {isMicOn ? <FaMicrophone/> : <FaMicrophoneSlash/>}
                  </button>
                  <button onClick={handleToggleScreenShare} className={`pill ${isScreenSharing ? 'pinned' : ''}`} title="Screen share"><FaDesktop/></button>
                  <button onClick={handleEndCall} className="pill" style={{ background:'#ef4444', color:'white' }} title="End call"><FaPhone/></button>
                </div>
              </div>

              {/* small debug overlay showing pinned stream id/tracks */}
              <div style={{ position: 'absolute', left: 8, bottom: 8, color: '#ddd', fontSize: 11, background: 'rgba(0,0,0,0.45)', padding: '6px 8px', borderRadius: 6 }}>
                {pinnedStream ? (
                  <div style={{ lineHeight: 1 }}>
                    <div>stream: {pinnedStream.id}</div>
                    <div>{pinnedStream.getVideoTracks().length} video • {pinnedStream.getAudioTracks().length} audio</div>
                  </div>
                ) : (
                  <div>no pinned stream</div>
                )}
              </div>
            </div>
          </div>
        </Resizable>
      </div>
    </Draggable>
  );
};

export default VideoChatComponent;
