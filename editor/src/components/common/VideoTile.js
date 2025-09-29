import React, { useEffect, useRef, useState } from 'react';
import {
  FaThumbtack, FaMicrophone, FaMicrophoneSlash,
  FaVideo, FaVideoSlash, FaVolumeUp, FaVolumeMute,
  FaDesktop, FaArrowsAlt, FaExpandAlt, FaCompressAlt
} from 'react-icons/fa';
import PropTypes from 'prop-types';

const parseAspect = (ratioStr) => {
  if (!ratioStr) return 16 / 9;
  const sep = ratioStr.includes('/') ? '/' : ratioStr.includes(':') ? ':' : null;
  if (!sep) return Number(ratioStr) || 16 / 9;
  const [a, b] = ratioStr.split(sep).map(Number);
  if (!a || !b) return 16 / 9;
  return a / b;
};

const VideoTile = ({
  id,
  label,
  stream,
  isLocal = false,
  isPinned = false,
  onPin,
  playbackEnabled = true,
  onRequestUnmute,
  compact = false,
  remoteMediaState = {},
  fitMode = 'cover',
  objectPosition = 'center',
  onChangeObjectPosition = null,
  showPositionControl = false,
  showStats = true,
  aspectRatio = '16/9',
  onChangeAspectRatio = null,
  showAspectControl = false,
  isScreenSharing = false,
  dockedMode = 'sidebar',
  forceFullScreen = false,
  videoQuality = 'high', visible = true,onChangeFitMode = null
}) => {
  const videoRef = useRef(null);
  const [mutedLocally, setMutedLocally] = useState(false);
  const [trackStatus, setTrackStatus] = useState({ video: false, audio: false, videoCount: 0, audioCount: 0 });
  const [speaking, setSpeaking] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [showPosMenu, setShowPosMenu] = useState(false);
  const [showAspectMenu, setShowAspectMenu] = useState(false);
  const [isInPiP, setIsInPiP] = useState(false);
    const [showFitMenu, setShowFitMenu] = useState(false);
  const [localFitMode, setLocalFitMode] = useState(fitMode);

  useEffect(() => {
    setLocalFitMode(fitMode);
  }, [fitMode]);

  
  // Add speaking detection
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const speakingCheckRef = useRef(null);

   useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const attachStream = () => {
      try {
        if (v.srcObject !== stream) {
          v.srcObject = stream || null;
        }
        v.muted = isLocal || mutedLocally;
        v.play().catch(() => {});
      } catch (err) { console.warn('[VideoTile] attachStream failed', err); }
    };

    const detachStream = () => {
      try {
        // Important: don't stop remote tracks here — only detach from element
        if (v && v.srcObject) v.srcObject = null;
      } catch (e) { /* ignore */ }
    };

    if (visible && stream) {
      attachStream();
    } else {
      detachStream();
    }

    return () => {
      // On unmount detach
      try { if (videoRef.current) videoRef.current.srcObject = null; } catch (e) {}
    };
  }, [stream, visible, isLocal, mutedLocally]);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const attach = () => {
      try {
        if (videoElement.srcObject !== stream) {
          videoElement.srcObject = stream || null;
        }
        videoElement.muted = isLocal || mutedLocally;
        videoElement.play().catch(() => {});
      } catch (e) { console.warn('[VideoTile] attach stream', e); }
    };

    attach();

    const update = () => {
      if (!stream) {
        setTrackStatus({ video: false, audio: false, videoCount: 0, audioCount: 0 });
        setHasVideo(false);
        setSpeaking(false);
        return;
      }
      
      const vTracks = stream.getVideoTracks();
      const aTracks = stream.getAudioTracks();
      const vEnabled = vTracks.length > 0 && vTracks.some(t => t.enabled && t.readyState === 'live');
      const aEnabled = aTracks.length > 0 && aTracks.some(t => t.enabled && t.readyState === 'live');

      setTrackStatus({ 
        video: vEnabled, 
        audio: aEnabled, 
        videoCount: vTracks.length, 
        audioCount: aTracks.length 
      });
      setHasVideo(vEnabled && vTracks.some(t => t.readyState === 'live'));
      setSpeaking(aEnabled && !mutedLocally && !isLocal);
    };

    update();
    
    const handleTrackChange = () => update();
    stream?.getVideoTracks().forEach(track => {
      track.addEventListener('mute', handleTrackChange);
      track.addEventListener('unmute', handleTrackChange);
    });
    stream?.getAudioTracks().forEach(track => {
      track.addEventListener('mute', handleTrackChange);
      track.addEventListener('unmute', handleTrackChange);
    });

    const iv = setInterval(update, 1000);
    return () => {
      clearInterval(iv);
      stream?.getVideoTracks().forEach(track => {
        track.removeEventListener('mute', handleTrackChange);
        track.removeEventListener('unmute', handleTrackChange);
      });
      stream?.getAudioTracks().forEach(track => {
        track.removeEventListener('mute', handleTrackChange);
        track.removeEventListener('unmute', handleTrackChange);
      });
    };
  }, [stream, isLocal, mutedLocally]);

  // Setup audio analysis for speaking detection
  useEffect(() => {
    const setupAudioAnalysis = async () => {
      if (!stream || isLocal || !playbackEnabled) return;
      
      try {
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) return;

        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        const source = audioContextRef.current.createMediaStreamSource(stream);
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        analyserRef.current.smoothingTimeConstant = 0.8;
        
        source.connect(analyserRef.current);
        
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        
        const checkSpeaking = () => {
          if (!analyserRef.current) return;
          
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
          
          // Threshold for speaking detection
          setIsSpeaking(average > 20);
        };
        
        speakingCheckRef.current = setInterval(checkSpeaking, 100);
      } catch (err) {
        console.warn('Audio analysis setup failed:', err);
      }
    };

    setupAudioAnalysis();

    return () => {
      if (speakingCheckRef.current) {
        clearInterval(speakingCheckRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.warn);
      }
    };
  }, [stream, isLocal, playbackEnabled]);

  useEffect(() => {
    if (!isLocal && videoRef.current) {
      const newMuted = !playbackEnabled;
      setMutedLocally(newMuted);
      try { videoRef.current.muted = newMuted; } catch (e) {}
    }
  }, [playbackEnabled, isLocal]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const handleEnter = () => setIsInPiP(true);
    const handleLeave = () => setIsInPiP(false);
    v.addEventListener('enterpictureinpicture', handleEnter);
    v.addEventListener('leavepictureinpicture', handleLeave);
    return () => {
      v.removeEventListener('enterpictureinpicture', handleEnter);
      v.removeEventListener('leavepictureinpicture', handleLeave);
    };
  }, []);

  const audioOn = typeof remoteMediaState.isMicOn === 'boolean' ? remoteMediaState.isMicOn : trackStatus.audio;
  const videoOn = typeof remoteMediaState.isCameraOn === 'boolean' ? remoteMediaState.isCameraOn : trackStatus.video;
  const initials = (label || 'You').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

  // Calculate aspect ratio based on docking mode
  const ratioNum = parseAspect(aspectRatio);

  // Default aspect style (keeps natural aspect ratio)
  let aspectStyle = {
    position: 'relative',
    width: '100%',
    aspectRatio: `${aspectRatio}`,
    backgroundColor: 'transparent'
  };

  let innerVideoStyle = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: localFitMode || fitMode || 'cover', // <- use localFitMode         // default 'cover' unless overridden by props
    objectPosition: objectPosition || 'center',
    backgroundColor: 'transparent'
  };

  if (videoQuality === 'low') {
    innerVideoStyle.objectFit = 'contain';
  } else if (videoQuality === 'high') {
    innerVideoStyle.objectFit = fitMode || 'cover';
  } else {
    // medium/fallback
    innerVideoStyle.objectFit = 'cover';
  }

  // Adjust styles for main screen docking
  if (dockedMode === 'main' || forceFullScreen) {
    if (isPinned || forceFullScreen) {
      // Pinned video in main screen - occupy full available space
      aspectStyle = {
        position: 'relative',
        width: '100%',
        height: '100%',         // allow parent to size pinned area
        minHeight: '320px'
      };
      // For pinned, allow 'fill' if requested (to fully stretch) otherwise 'contain' or 'cover' is applied above
            // let the user's selection (localFitMode) control pinned objectFit;
      // fallback to a sensible default depending on quality if localFitMode is falsy
      innerVideoStyle.objectFit = localFitMode || (videoQuality === 'low' ? 'contain' : 'fill');

      innerVideoStyle.objectPosition = objectPosition || 'center';
    } else {
      // Filmstrip tiles - fixed small height
      aspectStyle = {
        ...aspectStyle,
       height: '170px', // Changed from maxHeight
      width: '100%'   
      };
      // filmstrip should use contain to avoid cropping faces in tiny tiles
      innerVideoStyle.objectFit = 'fill';
    }
  }

  if (dockedMode === 'filmstrip') {
  // Custom filmstrip layout for unpinned tiles in docked mode
  aspectStyle = {
    position: 'relative',
    width: '100%',
    height: '170px', // Set your desired height
    backgroundColor: 'transparent'
  };
  innerVideoStyle = {
    ...innerVideoStyle,
    objectFit: 'cover' // Change to 'contain' if you want to see the whole video
  };
}
  // NOTE: videoQuality prop is informational here. To actually change stream resolution
  // you must implement changing of sender parameters or server-side subscription (SFU).
  // Example: call RTCRtpSender.setParameters() or request SFU to switch layer.
  // Here we only display the quality indicator and expose the UI hook via ParticipantsGrid.

  const handleTileClick = () => {
    if (!isLocal && !playbackEnabled) onRequestUnmute?.();
  };

  const handleSpeakerToggle = (e) => {
    e.stopPropagation();
    const newMuted = !mutedLocally;
    setMutedLocally(newMuted);
    if (videoRef.current) {
      try {
        videoRef.current.muted = newMuted;
        if (!newMuted) videoRef.current.play().catch(() => {});
      } catch (err) { console.debug('Speaker toggle', err); }
    }
  };

  const posOptions = [
    { key: 'center', label: 'Center' },
    { key: 'top', label: 'Top' },
    { key: 'bottom', label: 'Bottom' },
    { key: 'left', label: 'Left' },
    { key: 'right', label: 'Right' },
    { key: 'top left', label: 'Top-Left' },
    { key: 'top right', label: 'Top-Right' },
    { key: 'bottom left', label: 'Bottom-Left' },
    { key: 'bottom right', label: 'Bottom-Right' }
  ];

  const aspectOptions = [
    { key: '16/9', label: '16:9' },
    { key: '4/3', label: '4:3' },
    { key: '1/1', label: '1:1 (square)' },
    { key: '21/9', label: '21:9 (ultrawide)' }
  ];

  const requestPiP = async () => {
    try {
      const v = videoRef.current;
      if (!v) return;
      if (document.pictureInPictureElement === v) {
        await document.exitPictureInPicture();
      } else {
        try { await v.requestPictureInPicture(); } catch (err) {
          console.warn('PiP request failed', err);
        }
      }
    } catch (err) {
      console.warn('PiP error', err);
    }
  };

  return (
    <div
      className={`relative group overflow-hidden bg-gray-800 shadow-lg transition-all duration-200 hover:shadow-xl ${
        isPinned ? 'ring-2 ring-blue-500 ring-opacity-80' : ''
      } ${forceFullScreen ? 'h-full' : ''} rounded-lg shadow-md border border-slate-600/30 hover:border-cyan-400/30`}
      onClick={handleTileClick}
      role="button"
      tabIndex={0}
      aria-label={`participant-${label}`}
    >
      {/* Speaking Indicator Glow */}
      {isSpeaking && (
        <div 
          className="absolute inset-0 ring-3 ring-green-400 rounded-lg pointer-events-none animate-pulse z-20" 
          style={{boxShadow: '0 0 20px 5px rgba(72, 187, 120, 0.6)'}} 
        />
      )}

      <div style={aspectStyle} className="w-full bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal || mutedLocally}
          style={innerVideoStyle}
          className="rounded-lg"
        />

        {(!stream || !hasVideo) && (
          <div style={{ position: 'absolute', inset: 0 }} className="w-full h-full flex items-center justify-center bg-gray-700 rounded-lg">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
              {initials}
            </div>
          </div>
        )}
      </div>

      {/* Top Bar with Name */}
      <div className="absolute top-2 left-2 z-20 flex items-center gap-2">
        <div className="text-xs text-white font-semibold bg-black/70 px-2 py-1 rounded-md backdrop-blur-sm">
          {label}
        </div>
      </div>

      {/* Controls - Top Right */}
      <div className="absolute top-2 right-2 flex items-center gap-1 z-30">
        <div className={`p-1 rounded-full ${audioOn ? 'bg-green-500' : 'bg-red-500'}`}>
          {audioOn ? <FaMicrophone size={10} className="text-white" /> : <FaMicrophoneSlash size={10} className="text-white" />}
        </div>

        <div className={`p-1 rounded-full ${videoOn ? 'bg-green-500' : 'bg-red-500'}`}>
          {videoOn ? <FaVideo size={10} className="text-white" /> : <FaVideoSlash size={10} className="text-white" />}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onPin?.(); }}
          className={`p-1 rounded-full ${isPinned ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
          title="Pin"
        >
          <FaThumbtack size={10} />
        </button>

        {!isLocal && (
          <button onClick={handleSpeakerToggle} className={`p-1 rounded-full ${mutedLocally ? 'bg-red-500' : 'bg-green-500'} text-white`} title="Toggle speaker">
            {mutedLocally ? <FaVolumeMute size={10} /> : <FaVolumeUp size={10} />}
          </button>
        )}

        {/* Speaking Indicator Dot */}
        {isSpeaking && (
          <div className="p-1 rounded-full bg-green-500 animate-pulse" title="Speaking">
            <div className="w-2 h-2 bg-green-300 rounded-full"></div>
          </div>
        )}

        {isPinned && (
          <button
            onClick={(e) => { e.stopPropagation(); requestPiP(); }}
            className="p-1 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-200"
            title={isInPiP ? 'Exit picture-in-picture' : 'Open picture-in-picture'}
          >
            <FaExpandAlt size={12} />
          </button>
        )}

        {/* Aspect ratio control (only show for pinned if enabled AND not disabled by parent) */}
        {isPinned && showAspectControl && (
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowAspectMenu(v => !v); }}
              className="p-1 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-200"
              title="Aspect ratio"
            >
              <FaCompressAlt size={12} />
            </button>
            {showAspectMenu && (
              <div onClick={(e) => e.stopPropagation()} className="absolute right-0 mt-2 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-40 text-xs">
                {aspectOptions.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => { setShowAspectMenu(false); onChangeAspectRatio?.(opt.key); }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

                {/* Fit mode control for pinned tile */}
        {isPinned && (
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowFitMenu(v => !v); }}
              className="p-1 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-200"
              title={`Fit mode: ${localFitMode}`}
            >
              <FaArrowsAlt size={12} />
            </button>

            {showFitMenu && (
              <div onClick={(e) => e.stopPropagation()} className="absolute right-0 mt-2 w-28 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-40 text-xs">
                {['fill', 'contain', 'cover'].map(opt => (
                  <button
                    key={opt}
                    onClick={() => {
                      setShowFitMenu(false);
                      setLocalFitMode(opt);
                      try { onChangeFitMode?.(opt); } catch(e) {}
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}


        {/* crop position control (only show if enabled AND not disabled by parent) */}
        {showPositionControl && (
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowPosMenu(v => !v); }}
              className="p-1 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-200"
              title="Crop position"
            >
              <FaArrowsAlt size={12} />
            </button>
            {showPosMenu && (
              <div onClick={(e) => e.stopPropagation()} className="absolute right-0 mt-2 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-40 text-xs">
                {posOptions.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => { setShowPosMenu(false); onChangeObjectPosition?.(opt.key); }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* bottom stats + quality label */}
      {showStats && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 z-10 rounded-b-lg">
          <div className="text-white text-sm font-medium truncate">{label}</div>
          <div className="text-gray-300 text-xs flex items-center gap-2">
            <span>
              {trackStatus.videoCount > 0 && `${trackStatus.videoCount} video`}
              {trackStatus.videoCount > 0 && trackStatus.audioCount > 0 && ' • '}
              {trackStatus.audioCount > 0 && `${trackStatus.audioCount} audio`}
            </span>
            <span className="ml-auto text-xs text-slate-400">Q: {videoQuality === 'high' ? 'HQ' : 'LQ'}</span>
          </div>
        </div>
      )}

      {speaking && (
        <div className="absolute inset-0 ring-2 ring-green-400 rounded-lg pointer-events-none animate-pulse z-0" />
      )}
    </div>
  );
};

VideoTile.propTypes = {
  id: PropTypes.string,
  label: PropTypes.string,
  stream: PropTypes.object,
  isLocal: PropTypes.bool,
  isPinned: PropTypes.bool,
  onPin: PropTypes.func,
  playbackEnabled: PropTypes.bool,
  onRequestUnmute: PropTypes.func,
  compact: PropTypes.bool,
  remoteMediaState: PropTypes.object,
  fitMode: PropTypes.string,
  objectPosition: PropTypes.string,
  onChangeObjectPosition: PropTypes.func,
  showPositionControl: PropTypes.bool,
  showStats: PropTypes.bool,
  aspectRatio: PropTypes.string,
  onChangeAspectRatio: PropTypes.func,
  showAspectControl: PropTypes.bool,
  isScreenSharing: PropTypes.bool,
  dockedMode: PropTypes.string,
  forceFullScreen: PropTypes.bool,
  videoQuality: PropTypes.string,
   onChangeFitMode: PropTypes.func,
};

export default React.memo(VideoTile);
