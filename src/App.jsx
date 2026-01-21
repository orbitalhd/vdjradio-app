import React, { useState, useEffect, useRef, useCallback } from 'react';

// VirtualDJRadio stream URLs
const STATIONS = [
  { 
    id: 'clubzone', 
    name: 'ClubZone', 
    genre: 'Club / EDM / Dance',
    color: '#00d4ff',
    stream: 'https://virtualdjradio.com/stream/channel1.mp3',
    description: 'House, dance, electro, fidget and more'
  },
  { 
    id: 'hypnotica', 
    name: 'Hypnotica', 
    genre: 'Deep / Soulful / Tech',
    color: '#a855f7',
    stream: 'https://virtualdjradio.com/stream/channel3.mp3',
    description: 'Deep house, soulful, tech and more'
  },
  { 
    id: 'powerbase', 
    name: 'PowerBase', 
    genre: 'Trance / DnB / Energy',
    color: '#22c55e',
    stream: 'https://virtualdjradio.com/stream/channel4.mp3',
    description: 'Trance, drum & bass, high energy'
  },
  { 
    id: 'thegrind', 
    name: 'TheGrind', 
    genre: 'HipHop / RnB / Top40',
    color: '#f97316',
    stream: 'https://virtualdjradio.com/stream/channel2.mp3',
    description: 'Hip-hop, R&B, mainstream hits'
  }
];

export default function VDJRadioApp() {
  const [currentStation, setCurrentStation] = useState(STATIONS[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(75);
  const [activeTab, setActiveTab] = useState('listen');
  const [visualizerBars, setVisualizerBars] = useState(Array(32).fill(20));
  const [streamError, setStreamError] = useState(false);
  const [nowPlaying, setNowPlaying] = useState({ artist: '', title: '', raw: '' });
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [trackHistory, setTrackHistory] = useState([]);
  const [metadataSource, setMetadataSource] = useState('waiting');
  const [upcomingShows, setUpcomingShows] = useState([]);
  const playerRef = useRef(null);
  const audioRef = useRef(null);
  const libLoadedRef = useRef(false);
  
  // DJ info from VirtualDJRadio
  const [djInfo, setDjInfo] = useState({});

  // Fetch current DJ info for all channels
  useEffect(() => {
    const fetchDjInfo = async () => {
      try {
        const response = await fetch('/api/nowplaying');
        if (response.ok) {
          const data = await response.json();
          // Convert array to object keyed by channel id
          const djMap = {};
          data.forEach(item => {
            djMap[item.channel] = item;
          });
          setDjInfo(djMap);
        }
      } catch (error) {
        console.log('DJ info fetch error:', error);
      }
    };
    
    const fetchSchedule = async () => {
      try {
        const response = await fetch('/api/nowplaying?type=schedule');
        if (response.ok) {
          const data = await response.json();
          setUpcomingShows(data.upcoming || []);
        }
      } catch (error) {
        console.log('Schedule fetch error:', error);
      }
    };
    
    // Fetch immediately and then periodically
    fetchDjInfo();
    fetchSchedule();
    const djInterval = setInterval(fetchDjInfo, 30000);
    const scheduleInterval = setInterval(fetchSchedule, 60000); // Check schedule every minute
    return () => {
      clearInterval(djInterval);
      clearInterval(scheduleInterval);
    };
  }, []);

  // Visualizer animation
  useEffect(() => {
    if (!isPlaying) {
      setVisualizerBars(Array(32).fill(20));
      return;
    }
    const interval = setInterval(() => {
      setVisualizerBars(prev => prev.map(() => Math.random() * 80 + 20));
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Parse metadata string into artist/title
  const parseMetadata = useCallback((metadataString) => {
    if (!metadataString) return { artist: '', title: '', raw: '' };
    
    // Common format: "Artist - Title"
    const parts = metadataString.split(' - ');
    if (parts.length >= 2) {
      return {
        artist: parts[0].trim(),
        title: parts.slice(1).join(' - ').trim(),
        raw: metadataString
      };
    }
    return { artist: '', title: metadataString, raw: metadataString };
  }, []);

  // Handle metadata updates
  const handleMetadata = useCallback((metadata) => {
    const streamTitle = metadata?.StreamTitle || metadata?.title || '';
    if (streamTitle && streamTitle !== nowPlaying.raw) {
      const parsed = parseMetadata(streamTitle);
      setNowPlaying(parsed);
      setLiked(false);
      setLikeCount(Math.floor(Math.random() * 50) + 5); // Simulated like count
      setMetadataSource('icy');
      
      // Add to history
      if (parsed.raw) {
        setTrackHistory(prev => {
          const newHistory = [{ ...parsed, time: new Date().toLocaleTimeString(), station: currentStation.name }, ...prev];
          return newHistory.slice(0, 20);
        });
      }
    }
  }, [nowPlaying.raw, parseMetadata, currentStation.name]);

  // Load IcecastMetadataPlayer library
  useEffect(() => {
    if (libLoadedRef.current) return;
    
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/icecast-metadata-player@1.17.13/build/icecast-metadata-player-1.17.13.main.min.js';
    script.async = true;
    script.onload = () => {
      libLoadedRef.current = true;
      console.log('IcecastMetadataPlayer loaded');
    };
    document.head.appendChild(script);
    
    return () => {
      if (playerRef.current) {
        try { playerRef.current.stop(); } catch (e) {}
      }
    };
  }, []);

  // Handle volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  // Handle station change
  useEffect(() => {
    if (isPlaying) {
      stopPlayback();
      // Small delay before restarting
      setTimeout(() => startPlayback(), 100);
    }
    setNowPlaying({ artist: '', title: '', raw: '' });
    setMetadataSource('waiting');
  }, [currentStation.stream]);

  const stopPlayback = () => {
    if (playerRef.current) {
      try { playerRef.current.stop(); } catch (e) {}
      playerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    setIsPlaying(false);
  };

  const startPlayback = async () => {
    setStreamError(false);
    setMetadataSource('connecting');
    
    // Try IcecastMetadataPlayer for metadata support
    if (window.IcecastMetadataPlayer && libLoadedRef.current) {
      try {
        playerRef.current = new window.IcecastMetadataPlayer(currentStation.stream, {
          onMetadata: handleMetadata,
          onPlay: () => {
            setIsPlaying(true);
            if (!nowPlaying.raw) setMetadataSource('playing');
          },
          onStop: () => setIsPlaying(false),
          onError: (error) => {
            console.log('IcecastMetadataPlayer error, falling back:', error);
            fallbackPlay();
          },
          metadataTypes: ["icy"],
          enableLogging: false
        });
        
        await playerRef.current.play();
        
        // Apply volume after a short delay
        setTimeout(() => {
          const audioEl = document.querySelector('audio');
          if (audioEl) {
            audioEl.volume = volume / 100;
            audioRef.current = audioEl;
          }
        }, 500);
        return;
      } catch (e) {
        console.log('IcecastMetadataPlayer failed:', e);
      }
    }
    
    // Fallback to regular HTML5 audio
    fallbackPlay();
  };

  const fallbackPlay = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    
    audioRef.current.src = currentStation.stream;
    audioRef.current.volume = volume / 100;
    audioRef.current.load();
    audioRef.current.play()
      .then(() => {
        setIsPlaying(true);
        setMetadataSource('fallback');
      })
      .catch(e => {
        console.log('Playback failed:', e);
        setStreamError(true);
      });
  };

  const handlePlay = () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  };

  const handleLike = () => {
    if (liked) return;
    setLiked(true);
    setLikeCount(prev => prev + 1);
    // Open VirtualDJRadio in new tab to actually register the like
    // In a real implementation, this would call their API with auth
  };

  const getStationColor = () => currentStation.color;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0f0f1a 100%)',
      fontFamily: "'Outfit', 'Segoe UI', sans-serif",
      color: '#fff',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Animated background */}
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: `radial-gradient(ellipse at 50% 0%, ${getStationColor()}15 0%, transparent 50%)`,
        pointerEvents: 'none',
        transition: 'background 0.8s ease'
      }} />
      
      {/* Noise texture */}
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        opacity: 0.03,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        pointerEvents: 'none'
      }} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        
        * { box-sizing: border-box; }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        @keyframes heartBeat {
          0% { transform: scale(1); }
          15% { transform: scale(1.3); }
          30% { transform: scale(1); }
          45% { transform: scale(1.2); }
          60% { transform: scale(1); }
        }
        
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .station-btn {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          border: none;
          outline: none;
        }
        
        .station-btn:hover {
          transform: translateY(-4px);
        }
        
        .nav-btn {
          transition: all 0.2s ease;
          cursor: pointer;
        }
        
        .nav-btn:hover {
          background: rgba(255,255,255,0.1);
        }
        
        .like-btn {
          transition: all 0.2s ease;
        }
        
        .like-btn:hover:not(.liked) {
          transform: scale(1.1);
        }
        
        .like-btn.liked svg {
          animation: heartBeat 0.6s ease;
        }
        
        .visualizer-bar {
          transition: height 0.1s ease;
        }
        
        .track-item {
          transition: all 0.2s ease;
        }
        
        .track-item:hover {
          background: rgba(255,255,255,0.05) !important;
        }
        
        ::-webkit-scrollbar {
          width: 6px;
        }
        
        ::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.05);
          border-radius: 3px;
        }
        
        ::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.2);
          border-radius: 3px;
        }
      `}</style>

      {/* Header */}
      <header style={{
        position: 'relative',
        padding: '20px 40px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.06)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: `linear-gradient(135deg, ${getStationColor()}, ${getStationColor()}80)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            fontWeight: '800',
            fontFamily: "'Space Mono', monospace",
            boxShadow: `0 4px 20px ${getStationColor()}40`,
            transition: 'all 0.5s ease'
          }}>V</div>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700', letterSpacing: '-0.5px' }}>
              VirtualDJ Radio
            </h1>
            <p style={{ 
              margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.5)',
              fontFamily: "'Space Mono', monospace", letterSpacing: '2px', textTransform: 'uppercase'
            }}>100% Live Mixes</p>
          </div>
        </div>

        <nav style={{ display: 'flex', gap: '8px' }}>
          {['listen', 'history', 'schedule', 'chat'].map(tab => (
            <button
              key={tab}
              className="nav-btn"
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 20px',
                background: activeTab === tab ? 'rgba(255,255,255,0.1)' : 'transparent',
                border: 'none',
                borderRadius: '8px',
                color: activeTab === tab ? '#fff' : 'rgba(255,255,255,0.6)',
                fontSize: '14px',
                fontWeight: '500',
                fontFamily: 'inherit',
                textTransform: 'capitalize'
              }}
            >{tab}</button>
          ))}
        </nav>

        <a
          href="https://virtualdjradio.com/login/"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: '10px 24px',
            background: `linear-gradient(135deg, ${getStationColor()}, ${getStationColor()}80)`,
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: `0 4px 15px ${getStationColor()}30`,
            textDecoration: 'none'
          }}
        >Login / Register</a>
      </header>

      {/* Main Content */}
      <main style={{ 
        position: 'relative', 
        padding: '40px',
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        
        {/* Listen Tab */}
        {activeTab === 'listen' && (
          <div style={{ animation: 'slideUp 0.4s ease' }}>
            {/* Station Selector */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px',
              marginBottom: '48px'
            }}>
              {STATIONS.map(station => (
                <button
                  key={station.id}
                  className="station-btn"
                  onClick={() => setCurrentStation(station)}
                  style={{
                    padding: '20px',
                    background: currentStation.id === station.id 
                      ? `linear-gradient(135deg, ${station.color}20, ${station.color}10)`
                      : 'rgba(255,255,255,0.03)',
                    borderRadius: '16px',
                    border: currentStation.id === station.id 
                      ? `2px solid ${station.color}60`
                      : '2px solid transparent',
                    textAlign: 'left',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {currentStation.id === station.id && isPlaying && (
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: station.color,
                      animation: 'pulse 1.5s infinite',
                      boxShadow: `0 0 10px ${station.color}`
                    }} />
                  )}
                  {/* Live indicator if DJ is live on this channel */}
                  {djInfo[station.id]?.isLive && currentStation.id !== station.id && (
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      padding: '2px 6px',
                      background: '#ef4444',
                      borderRadius: '4px',
                      fontSize: '9px',
                      fontWeight: '700',
                      color: '#fff'
                    }}>LIVE</div>
                  )}
                  <h3 style={{ 
                    margin: '0 0 4px 0', 
                    fontSize: '18px', 
                    fontWeight: '700',
                    color: currentStation.id === station.id ? station.color : '#fff'
                  }}>{station.name}</h3>
                  <p style={{ 
                    margin: '0 0 8px 0', 
                    fontSize: '11px', 
                    color: 'rgba(255,255,255,0.4)',
                    fontFamily: "'Space Mono', monospace"
                  }}>{station.genre}</p>
                  {/* Current DJ on this channel */}
                  {djInfo[station.id] && (
                    <p style={{ 
                      margin: 0, 
                      fontSize: '12px', 
                      color: djInfo[station.id].isLive ? station.color : 'rgba(255,255,255,0.5)',
                      fontWeight: '500',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {djInfo[station.id].djName}
                    </p>
                  )}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '32px' }}>
              {/* Player Card */}
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '24px',
                padding: '40px',
                border: '1px solid rgba(255,255,255,0.06)'
              }}>
                {/* Status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: isPlaying ? '#22c55e' : (streamError ? '#ef4444' : '#888'),
                    animation: isPlaying ? 'pulse 1.5s infinite' : 'none',
                    boxShadow: isPlaying ? '0 0 10px #22c55e' : 'none'
                  }} />
                  <span style={{ 
                    fontSize: '12px', 
                    fontFamily: "'Space Mono', monospace",
                    color: 'rgba(255,255,255,0.6)',
                    textTransform: 'uppercase',
                    letterSpacing: '2px'
                  }}>{isPlaying ? 'Live' : (streamError ? 'Error' : 'Ready')}</span>
                  {metadataSource === 'icy' && (
                    <span style={{
                      marginLeft: 'auto',
                      fontSize: '10px',
                      padding: '3px 8px',
                      background: 'rgba(34, 197, 94, 0.2)',
                      color: '#22c55e',
                      borderRadius: '4px',
                      fontFamily: "'Space Mono', monospace"
                    }}>METADATA</span>
                  )}
                </div>

                {/* Station Name */}
                <h2 style={{ 
                  margin: '0 0 8px 0', 
                  fontSize: '32px', 
                  fontWeight: '800',
                  background: `linear-gradient(90deg, #fff, ${getStationColor()})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>{currentStation.name}</h2>
                <p style={{ 
                  margin: '0 0 24px 0', 
                  fontSize: '14px', 
                  color: 'rgba(255,255,255,0.5)'
                }}>{currentStation.description}</p>

                {/* Current DJ Info Banner */}
                {djInfo[currentStation.id] && (
                  <div style={{
                    marginBottom: '24px',
                    padding: '16px 20px',
                    background: `linear-gradient(135deg, ${getStationColor()}15, ${getStationColor()}05)`,
                    borderRadius: '16px',
                    border: `1px solid ${getStationColor()}30`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px'
                  }}>
                    {/* DJ Image */}
                    {djInfo[currentStation.id].djImage && (
                      <img 
                        src={djInfo[currentStation.id].djImage} 
                        alt={djInfo[currentStation.id].djName}
                        style={{
                          width: '60px',
                          height: '60px',
                          borderRadius: '12px',
                          objectFit: 'cover',
                          border: `2px solid ${getStationColor()}50`
                        }}
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    )}
                    {/* DJ Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        {djInfo[currentStation.id].isLive ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            background: '#ef4444',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: '700',
                            color: '#fff',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            <span style={{
                              width: '6px',
                              height: '6px',
                              background: '#fff',
                              borderRadius: '50%',
                              animation: 'pulse 1.5s infinite'
                            }}></span>
                            LIVE
                          </span>
                        ) : djInfo[currentStation.id].isReplay ? (
                          <span style={{
                            padding: '2px 8px',
                            background: 'rgba(255,255,255,0.1)',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: '700',
                            color: 'rgba(255,255,255,0.6)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>REPLAY</span>
                        ) : null}
                        <span style={{
                          fontSize: '11px',
                          color: 'rgba(255,255,255,0.5)',
                          fontFamily: "'Space Mono', monospace",
                          textTransform: 'uppercase',
                          letterSpacing: '1px'
                        }}>On Air</span>
                      </div>
                      <p style={{ 
                        margin: '0 0 2px 0', 
                        fontSize: '18px', 
                        fontWeight: '700',
                        color: '#fff'
                      }}>{djInfo[currentStation.id].djName}</p>
                      <p style={{ 
                        margin: 0, 
                        fontSize: '13px', 
                        color: getStationColor()
                      }}>{djInfo[currentStation.id].showName}</p>
                    </div>
                  </div>
                )}

                {/* Now Playing Track Info */}
                <div style={{
                  marginBottom: '24px',
                  padding: '20px',
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: '16px',
                  border: `1px solid ${isPlaying && nowPlaying.raw ? getStationColor() + '40' : 'rgba(255,255,255,0.05)'}`
                }}>
                  {nowPlaying.raw ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ 
                            margin: '0 0 2px 0', 
                            fontSize: '11px', 
                            fontFamily: "'Space Mono', monospace",
                            color: getStationColor(),
                            textTransform: 'uppercase',
                            letterSpacing: '1px'
                          }}>Now Playing</p>
                          <p style={{ 
                            margin: '0 0 6px 0', 
                            fontSize: '20px', 
                            fontWeight: '700',
                            color: '#fff',
                            lineHeight: 1.3
                          }}>{nowPlaying.title || nowPlaying.raw}</p>
                          {nowPlaying.artist && (
                            <p style={{ 
                              margin: 0, 
                              fontSize: '15px', 
                              color: 'rgba(255,255,255,0.6)'
                            }}>{nowPlaying.artist}</p>
                          )}
                        </div>
                        
                        {/* Like Button */}
                        <div style={{ textAlign: 'center', flexShrink: 0 }}>
                          <button
                            onClick={handleLike}
                            className={`like-btn ${liked ? 'liked' : ''}`}
                            disabled={liked}
                            style={{
                              width: '56px',
                              height: '56px',
                              borderRadius: '50%',
                              background: liked ? `${getStationColor()}30` : 'rgba(255,255,255,0.05)',
                              border: `2px solid ${liked ? getStationColor() : 'rgba(255,255,255,0.1)'}`,
                              cursor: liked ? 'default' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title={liked ? "You liked this!" : "Like this track"}
                          >
                            <svg 
                              width="26" 
                              height="26" 
                              viewBox="0 0 24 24" 
                              fill={liked ? getStationColor() : 'none'} 
                              stroke={liked ? getStationColor() : 'rgba(255,255,255,0.4)'} 
                              strokeWidth="2"
                            >
                              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                            </svg>
                          </button>
                          <p style={{ 
                            margin: '6px 0 0 0', 
                            fontSize: '12px', 
                            color: liked ? getStationColor() : 'rgba(255,255,255,0.4)',
                            fontFamily: "'Space Mono', monospace"
                          }}>{likeCount}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '10px 0' }}>
                      {metadataSource === 'connecting' && (
                        <div style={{ 
                          width: '24px', 
                          height: '24px', 
                          border: '2px solid rgba(255,255,255,0.1)',
                          borderTopColor: getStationColor(),
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite',
                          margin: '0 auto 12px'
                        }} />
                      )}
                      <p style={{ 
                        margin: 0, 
                        fontSize: '14px', 
                        color: 'rgba(255,255,255,0.4)'
                      }}>
                        {metadataSource === 'connecting' ? 'Connecting to stream...' : 
                         metadataSource === 'playing' ? 'Waiting for track info...' :
                         metadataSource === 'fallback' ? 'Playing (metadata unavailable)' :
                         'Press play to start listening'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Visualizer */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  height: '80px',
                  gap: '3px',
                  marginBottom: '32px',
                  padding: '0 20px'
                }}>
                  {visualizerBars.map((height, i) => (
                    <div
                      key={i}
                      className="visualizer-bar"
                      style={{
                        width: '100%',
                        height: isPlaying ? `${height}%` : '20%',
                        background: `linear-gradient(to top, ${getStationColor()}, ${getStationColor()}40)`,
                        borderRadius: '2px',
                        opacity: isPlaying ? 1 : 0.3
                      }}
                    />
                  ))}
                </div>

                {/* Play Button */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px' }}>
                  <button
                    onClick={handlePlay}
                    style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${getStationColor()}, ${getStationColor()}80)`,
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: `0 8px 30px ${getStationColor()}40`,
                      transition: 'all 0.3s ease'
                    }}
                  >
                    {isPlaying ? (
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                        <rect x="14" y="4" width="4" height="16" rx="1" />
                      </svg>
                    ) : (
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Volume */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '32px', padding: '0 20px' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2">
                    <path d="M11 5L6 9H2v6h4l5 4V5z" />
                    {volume > 0 && <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />}
                    {volume > 50 && <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />}
                  </svg>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    style={{
                      flex: 1,
                      height: '4px',
                      borderRadius: '2px',
                      background: `linear-gradient(to right, ${getStationColor()} ${volume}%, rgba(255,255,255,0.1) ${volume}%)`,
                      appearance: 'none',
                      cursor: 'pointer'
                    }}
                  />
                  <span style={{ 
                    fontSize: '12px', 
                    fontFamily: "'Space Mono', monospace",
                    color: 'rgba(255,255,255,0.5)',
                    width: '36px'
                  }}>{volume}%</span>
                </div>

                {/* Error/Fallback */}
                {streamError && (
                  <div style={{
                    marginTop: '20px',
                    padding: '12px 16px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '8px',
                    fontSize: '13px',
                    color: '#fca5a5',
                    textAlign: 'center'
                  }}>
                    Stream unavailable. Try the{' '}
                    <a href={`https://virtualdjradio.com/${currentStation.id}/`} target="_blank" rel="noopener noreferrer" style={{ color: getStationColor() }}>
                      official player
                    </a>
                  </div>
                )}

                {/* External links */}
                <div style={{
                  marginTop: '24px',
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '12px',
                  flexWrap: 'wrap'
                }}>
                  <a
                    href={`https://virtualdjradio.com/${currentStation.id}.m3u`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: '6px',
                      color: 'rgba(255,255,255,0.6)',
                      fontSize: '12px',
                      textDecoration: 'none'
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                    .M3U
                  </a>
                  <a
                    href={`https://virtualdjradio.com/listen/${currentStation.id}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: '6px',
                      color: 'rgba(255,255,255,0.6)',
                      fontSize: '12px',
                      textDecoration: 'none'
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                    Popup
                  </a>
                  <a
                    href={`https://virtualdjradio.com/${currentStation.id}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: '6px',
                      color: 'rgba(255,255,255,0.6)',
                      fontSize: '12px',
                      textDecoration: 'none'
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                    Official
                  </a>
                </div>
              </div>

              {/* Right Column - Sidebar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Recent Tracks */}
                <div style={{
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '20px',
                  padding: '24px',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}>
                  <h3 style={{ 
                    margin: '0 0 16px 0', 
                    fontSize: '15px', 
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={getStationColor()} strokeWidth="2">
                      <path d="M9 18V5l12-2v13" />
                      <circle cx="6" cy="18" r="3" />
                      <circle cx="18" cy="16" r="3" />
                    </svg>
                    Recent Tracks
                  </h3>
                  {trackHistory.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflow: 'auto' }}>
                      {trackHistory.filter(t => t.station === currentStation.name).slice(0, 6).map((track, i) => (
                        <div key={i} className="track-item" style={{
                          padding: '12px',
                          background: i === 0 ? `${getStationColor()}10` : 'rgba(255,255,255,0.02)',
                          borderRadius: '10px',
                          borderLeft: i === 0 ? `3px solid ${getStationColor()}` : '3px solid transparent'
                        }}>
                          <p style={{ 
                            margin: '0 0 3px 0', 
                            fontSize: '13px', 
                            fontWeight: '600',
                            color: i === 0 ? '#fff' : 'rgba(255,255,255,0.8)',
                            lineHeight: 1.3
                          }}>{track.title || track.raw}</p>
                          <div style={{ 
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{track.artist}</span>
                            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontFamily: "'Space Mono', monospace" }}>{track.time}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ 
                      margin: 0, 
                      fontSize: '13px', 
                      color: 'rgba(255,255,255,0.4)',
                      textAlign: 'center',
                      padding: '30px 10px'
                    }}>Track history will appear here as you listen</p>
                  )}
                </div>

                {/* Upcoming Shows */}
                <div style={{
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '20px',
                  padding: '24px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  flex: 1
                }}>
                  <h3 style={{ 
                    margin: '0 0 16px 0', 
                    fontSize: '15px', 
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={getStationColor()} strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    Upcoming
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {upcomingShows.length > 0 ? (
                      upcomingShows.slice(0, 3).map((show, i) => (
                        <div key={i} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '10px',
                          background: 'rgba(255,255,255,0.02)',
                          borderRadius: '10px'
                        }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            background: `linear-gradient(135deg, ${STATIONS.find(s => s.id === show.channel)?.color || getStationColor()}30, transparent)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '16px'
                          }}>🎧</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: '0 0 2px 0', fontSize: '12px', fontWeight: '600' }}>{show.showName}</p>
                            <p style={{ margin: 0, fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>{show.djName}</p>
                          </div>
                          <div style={{
                            padding: '4px 8px',
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontFamily: "'Space Mono', monospace",
                            color: 'rgba(255,255,255,0.6)'
                          }}>{show.time}</div>
                        </div>
                      ))
                    ) : (
                      <p style={{
                        margin: 0,
                        padding: '20px',
                        textAlign: 'center',
                        fontSize: '12px',
                        color: 'rgba(255,255,255,0.4)'
                      }}>No upcoming shows scheduled</p>
                    )}
                  </div>
                  <a
                    href="https://virtualdjradio.com/schedule/"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'block',
                      marginTop: '16px',
                      padding: '10px',
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: '8px',
                      textAlign: 'center',
                      color: 'rgba(255,255,255,0.6)',
                      fontSize: '12px',
                      textDecoration: 'none'
                    }}
                  >View Full Schedule →</a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div style={{ animation: 'slideUp 0.4s ease' }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: '700' }}>Track History</h2>
            <p style={{ margin: '0 0 32px 0', fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>
              All tracks played during this session across all channels
            </p>
            
            {trackHistory.length > 0 ? (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: '12px',
                maxWidth: '1000px'
              }}>
                {trackHistory.map((track, i) => {
                  const station = STATIONS.find(s => s.name === track.station);
                  return (
                    <div key={i} className="track-item" style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      padding: '16px 20px',
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.06)'
                    }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '10px',
                        background: `linear-gradient(135deg, ${station?.color || '#888'}40, ${station?.color || '#888'}10)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '20px',
                        flexShrink: 0
                      }}>🎵</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ 
                          margin: '0 0 4px 0', 
                          fontSize: '14px', 
                          fontWeight: '600',
                          color: '#fff'
                        }}>{track.title || track.raw}</p>
                        <p style={{ 
                          margin: 0, 
                          fontSize: '12px', 
                          color: 'rgba(255,255,255,0.5)'
                        }}>{track.artist}</p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{
                          margin: '0 0 4px 0',
                          padding: '3px 8px',
                          background: `${station?.color || '#888'}20`,
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: '500',
                          color: station?.color || '#888',
                          display: 'inline-block'
                        }}>{track.station}</p>
                        <p style={{ 
                          margin: 0, 
                          fontSize: '11px', 
                          color: 'rgba(255,255,255,0.4)',
                          fontFamily: "'Space Mono', monospace"
                        }}>{track.time}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '80px 40px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '24px',
                border: '1px solid rgba(255,255,255,0.06)'
              }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" style={{ marginBottom: '16px' }}>
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <p style={{ margin: 0, fontSize: '15px', color: 'rgba(255,255,255,0.4)' }}>
                  No tracks yet. Start playing a station to build your history!
                </p>
              </div>
            )}
          </div>
        )}

        {/* Schedule Tab */}
        {activeTab === 'schedule' && (
          <div style={{ animation: 'slideUp 0.4s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
              <h2 style={{ margin: 0, fontSize: '28px', fontWeight: '700' }}>Upcoming Shows</h2>
              <a
                href="https://virtualdjradio.com/schedule/"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '10px 20px',
                  background: `linear-gradient(135deg, ${getStationColor()}, ${getStationColor()}80)`,
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: '500',
                  textDecoration: 'none'
                }}
              >Full Schedule</a>
            </div>
            {upcomingShows.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                {upcomingShows.map((show, i) => {
                  const station = STATIONS.find(s => s.id === show.channel);
                  return (
                    <div key={i} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '20px',
                      padding: '24px',
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: '16px',
                      border: '1px solid rgba(255,255,255,0.06)'
                    }}>
                      <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '16px',
                        background: `linear-gradient(135deg, ${station?.color || getStationColor()}40, ${station?.color || getStationColor()}10)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '32px'
                      }}>🎧</div>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '600' }}>{show.showName}</p>
                        <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>with {show.djName}</p>
                        {show.channelName && (
                          <div style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            background: `${station?.color || getStationColor()}20`,
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: '500',
                            color: station?.color || getStationColor()
                          }}>{show.channelName}</div>
                        )}
                      </div>
                      <div style={{
                        padding: '10px 16px',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontFamily: "'Space Mono', monospace",
                        fontWeight: '600'
                      }}>{show.time}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '80px 40px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '24px',
                border: '1px solid rgba(255,255,255,0.06)'
              }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" style={{ marginBottom: '16px' }}>
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <p style={{ margin: '0 0 8px 0', fontSize: '15px', color: 'rgba(255,255,255,0.4)' }}>
                  No upcoming shows scheduled right now
                </p>
                <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.3)' }}>
                  Check back later or visit the official schedule
                </p>
              </div>
            )}
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div style={{ animation: 'slideUp 0.4s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h2 style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: '700' }}>Community Chat</h2>
                <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>
                  Chat with DJs and listeners worldwide
                </p>
              </div>
              <a
                href="https://virtualdjradio.com/chat/"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '10px 20px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: '500',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Open in New Tab
              </a>
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '24px',
              border: '1px solid rgba(255,255,255,0.06)',
              overflow: 'hidden',
              height: '600px'
            }}>
              <iframe
                src="https://virtualdjradio.com/chat/"
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  background: '#1a1a2e'
                }}
                title="VirtualDJ Radio Chat"
                allow="microphone"
              />
            </div>

            <p style={{
              marginTop: '16px',
              fontSize: '13px',
              color: 'rgba(255,255,255,0.4)',
              textAlign: 'center'
            }}>
              💡 You need a VirtualDJRadio account to chat.{' '}
              <a href="https://virtualdjradio.com/register/" target="_blank" rel="noopener noreferrer" style={{ color: getStationColor() }}>
                Register free
              </a>
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        position: 'relative',
        padding: '32px 40px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        marginTop: '60px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
          © 2026 VirtualDJ Radio • 100% Live Mixes
        </p>
        <div style={{ display: 'flex', gap: '24px' }}>
          {['Website', 'Apps', 'Facebook', 'Twitter'].map((link, i) => (
            <a
              key={link}
              href={['https://virtualdjradio.com', 'https://virtualdjradio.com/apps/', 'https://facebook.com/virtualdjradio', 'https://twitter.com/virtualdjradio'][i]}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}
            >{link}</a>
          ))}
        </div>
      </footer>
    </div>
  );
}
