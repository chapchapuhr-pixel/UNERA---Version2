import React, { useState, useEffect, useRef, useMemo } from 'react';
import { apiFetch } from '../utils/api';

export interface GalleryMediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  file?: File;
  duration?: string;
  durationSeconds?: number;
  thumbnailUrl?: string;
  name?: string;
  size?: number;
}

export interface AttachedMusic {
  id?: number | string;
  title: string;
  artist?: string;
  audioUrl: string;
  audioFile?: File;
  duration?: number | string;
  isCustom?: boolean;
}

interface NativeMediaGalleryModalProps {
  isOpen: boolean;
  currentUser: any;
  songs?: any[];
  onClose: () => void;
  onProceed: (data: {
    files: File[];
    mediaUrls: string[];
    mediaType: 'image' | 'video' | 'mixed';
    attachedMusic: AttachedMusic | null;
  }) => void;
  onOpenCamera?: () => void;
}

export const NativeMediaGalleryModal: React.FC<NativeMediaGalleryModalProps> = ({
  isOpen,
  currentUser,
  songs = [],
  onClose,
  onProceed,
  onOpenCamera,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'videos' | 'photos'>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);

  // Music Drawer & Selection State
  const [showMusicDrawer, setShowMusicDrawer] = useState(false);
  const [musicTab, setMusicTab] = useState<'unera' | 'upload'>('unera');
  const [searchQuery, setSearchQuery] = useState('');
  const [attachedMusic, setAttachedMusic] = useState<AttachedMusic | null>(null);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Native File Pickers
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);

  // Gallery Media Items
  const [galleryItems, setGalleryItems] = useState<GalleryMediaItem[]>([
    {
      id: 'demo_vid_1',
      type: 'video',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      duration: '0:15',
      durationSeconds: 15,
      name: 'Sample Reel 1.mp4',
    },
    {
      id: 'demo_vid_2',
      type: 'video',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      duration: '0:38',
      durationSeconds: 38,
      name: 'Sample Reel 2.mp4',
    },
    {
      id: 'demo_vid_3',
      type: 'video',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
      duration: '1:08',
      durationSeconds: 68,
      name: 'Sample Reel 3.mp4',
    },
    {
      id: 'demo_img_1',
      type: 'image',
      url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop',
      name: 'Technology.jpg',
    },
    {
      id: 'demo_img_2',
      type: 'image',
      url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop',
      name: 'Scenic View.jpg',
    },
    {
      id: 'demo_img_3',
      type: 'image',
      url: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800&auto=format&fit=crop',
      name: 'Portrait.jpg',
    },
  ]);

  // UNERA Music List
  const [uneraSongs, setUneraSongs] = useState<any[]>([]);

  useEffect(() => {
    if (songs && songs.length > 0) {
      setUneraSongs(songs);
    } else {
      apiFetch('/api/songs')
        .then((data) => {
          const list = Array.isArray(data) ? data : data?.songs || data?.data || [];
          if (list.length > 0) {
            setUneraSongs(list);
          } else {
            // Default built-in UNERA catalog
            setUneraSongs([
              {
                id: 1,
                title: 'UNERA Beats - Energy Flow',
                artist: 'UNERA Sound Lab',
                audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
                duration: '1:30',
              },
              {
                id: 2,
                title: 'Sunset Vibes & Groove',
                artist: 'Afro Chillwave',
                audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
                duration: '2:15',
              },
              {
                id: 3,
                title: 'Bongo Flava Acoustic',
                artist: 'Dar Es Salaam Melodies',
                audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
                duration: '1:45',
              },
            ]);
          }
        })
        .catch(() => {});
    }
  }, [songs]);

  // Initial selection
  useEffect(() => {
    if (galleryItems.length > 0 && selectedIds.length === 0) {
      setSelectedIds([galleryItems[0].id]);
      setActivePreviewId(galleryItems[0].id);
    }
  }, [galleryItems]);

  // Filtered gallery items
  const filteredItems = useMemo(() => {
    return galleryItems.filter((item) => {
      if (filterMode === 'videos') return item.type === 'video';
      if (filterMode === 'photos') return item.type === 'image';
      return true;
    });
  }, [galleryItems, filterMode]);

  // Filtered music tracks
  const filteredSongs = useMemo(() => {
    if (!searchQuery.trim()) return uneraSongs;
    const q = searchQuery.toLowerCase();
    return uneraSongs.filter(
      (s) =>
        s?.title?.toLowerCase().includes(q) ||
        s?.name?.toLowerCase().includes(q) ||
        s?.artist?.toLowerCase().includes(q) ||
        s?.artist_name?.toLowerCase().includes(q)
    );
  }, [uneraSongs, searchQuery]);

  // Handle media selection
  const handleItemClick = (item: GalleryMediaItem) => {
    setActivePreviewId(item.id);

    if (isMultiSelect) {
      if (selectedIds.includes(item.id)) {
        // Deselect
        const next = selectedIds.filter((id) => id !== item.id);
        setSelectedIds(next);
        if (activePreviewId === item.id && next.length > 0) {
          setActivePreviewId(next[0]);
        }
      } else {
        // Select
        setSelectedIds([...selectedIds, item.id]);
      }
    } else {
      // Single select
      setSelectedIds([item.id]);
    }
  };

  // Toggle multi-select mode
  const toggleMultiSelect = () => {
    setIsMultiSelect((prev) => {
      const next = !prev;
      if (!next && selectedIds.length > 1) {
        setSelectedIds([selectedIds[0]]);
        setActivePreviewId(selectedIds[0]);
      }
      return next;
    });
  };

  // Handle uploading files from device storage
  const handleDeviceFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files: File[] = Array.from(fileList);

    const newItems: GalleryMediaItem[] = files.map((file: File, idx: number) => {
      const isVideo = file.type.startsWith('video/');
      const url = URL.createObjectURL(file);
      return {
        id: `device_${Date.now()}_${idx}`,
        type: isVideo ? 'video' : 'image',
        url,
        file,
        duration: isVideo ? '0:30' : undefined,
        durationSeconds: isVideo ? 30 : undefined,
        name: file.name,
        size: file.size,
      };
    });

    setGalleryItems((prev) => [...newItems, ...prev]);
    const newIds = newItems.map((i) => i.id);
    if (isMultiSelect) {
      setSelectedIds((prev) => [...newIds, ...prev]);
    } else {
      setSelectedIds([newIds[0]]);
    }
    setActivePreviewId(newIds[0]);

    if (e.target) {
      e.target.value = '';
    }
  };

  // Handle custom audio file upload from files
  const handleAudioFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const audioUrl = URL.createObjectURL(file);
    const musicItem: AttachedMusic = {
      id: `audio_${Date.now()}`,
      title: file.name.replace(/\.[^/.]+$/, ''),
      artist: currentUser?.name || 'My Audio',
      audioUrl,
      audioFile: file,
      isCustom: true,
    };

    setAttachedMusic(musicItem);
    setShowMusicDrawer(false);
    if (e.target) {
      e.target.value = '';
    }
  };

  // Audio preview playback toggle
  const togglePlayAudio = (url: string) => {
    if (previewAudioUrl === url && isPlayingAudio) {
      audioRef.current?.pause();
      setIsPlayingAudio(false);
    } else {
      setPreviewAudioUrl(url);
      setIsPlayingAudio(true);
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play().catch(() => {});
      }
    }
  };

  // Select UNERA song
  const handleSelectSong = (song: any) => {
    const url = song?.audio_url || song?.url || song?.file_url;
    setAttachedMusic({
      id: song?.id,
      title: song?.title || song?.name || 'UNERA Music',
      artist: song?.artist || song?.artist_name || 'UNERA Artist',
      audioUrl: url,
      duration: song?.duration || song?.duration_seconds,
      isCustom: false,
    });
    setShowMusicDrawer(false);
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    }
  };

  // Active preview item
  const activePreviewItem = useMemo(() => {
    return galleryItems.find((i) => i.id === activePreviewId) || galleryItems[0] || null;
  }, [galleryItems, activePreviewId]);

  // Proceed and attach to post
  const handleProceed = () => {
    const selectedItems = galleryItems.filter((i) => selectedIds.includes(i.id));
    if (selectedItems.length === 0) return;

    const files: File[] = [];
    const mediaUrls: string[] = [];

    selectedItems.forEach((item) => {
      if (item.file) {
        files.push(item.file);
      }
      mediaUrls.push(item.url);
    });

    const hasVideo = selectedItems.some((i) => i.type === 'video');
    const hasImage = selectedItems.some((i) => i.type === 'image');
    const mediaType = hasVideo && hasImage ? 'mixed' : hasVideo ? 'video' : 'image';

    onProceed({
      files,
      mediaUrls,
      mediaType,
      attachedMusic,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col font-sans select-none overflow-hidden">
      {/* Hidden inputs for native file choosing & camera */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        className="hidden"
        onChange={handleDeviceFilesSelected}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        className="hidden"
        onChange={handleDeviceFilesSelected}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg"
        className="hidden"
        onChange={handleAudioFileSelected}
      />
      <audio
        ref={audioRef}
        className="hidden"
        onEnded={() => setIsPlayingAudio(false)}
        onError={() => setIsPlayingAudio(false)}
      />

      {/* 1. TOP BAR (Close ✕, New post, Camera icon) */}
      <div className="h-14 bg-[#050B18] border-b border-[#1E293B] px-4 flex items-center justify-between flex-shrink-0 z-20">
        <button
          onClick={onClose}
          type="button"
          className="w-9 h-9 rounded-full bg-[#0F172A] hover:bg-[#1E293B] text-[#94A3B8] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Close"
        >
          <i className="fas fa-times text-base"></i>
        </button>

        <h2 className="text-[17px] font-bold text-[#F8FAFC]">New post</h2>

        {/* Camera capture button */}
        <button
          onClick={() => {
            if (onOpenCamera) {
              onOpenCamera();
            } else if (cameraInputRef.current) {
              cameraInputRef.current.click();
            }
          }}
          type="button"
          className="w-9 h-9 rounded-full bg-[#0F172A] hover:bg-[#1E293B] text-[#38BDF8] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Open Camera"
          title="Take Photo or Video"
        >
          <i className="fas fa-camera text-base"></i>
        </button>
      </div>

      {/* 2. SUBHEADER FILTER BAR (Gallery dropdown, Select multiple pill) */}
      <div className="h-12 bg-[#080E1E] border-b border-[#1E293B] px-4 flex items-center justify-between flex-shrink-0 relative z-20">
        {/* Gallery Dropdown Toggle */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className="flex items-center gap-2 text-[#F8FAFC] font-bold text-[15px] hover:text-[#38BDF8] transition-colors cursor-pointer"
          >
            <span>
              {filterMode === 'all'
                ? 'Gallery'
                : filterMode === 'videos'
                ? 'Videos'
                : 'Pictures'}
            </span>
            <i
              className={`fas fa-chevron-down text-xs text-[#94A3B8] transition-transform ${
                showFilterDropdown ? 'rotate-180' : ''
              }`}
            ></i>
          </button>

          {/* Filter Popover Dropdown */}
          {showFilterDropdown && (
            <div className="absolute top-10 left-0 w-44 bg-[#0F172A] border border-[#1E293B] rounded-xl shadow-2xl py-1.5 z-30 animate-fadeIn">
              <button
                onClick={() => {
                  setFilterMode('all');
                  setShowFilterDropdown(false);
                }}
                className={`w-full text-left px-3.5 py-2 text-xs font-semibold flex items-center gap-2.5 transition-colors ${
                  filterMode === 'all'
                    ? 'text-[#1877F2] bg-[#1877F2]/10'
                    : 'text-[#94A3B8] hover:bg-[#1E293B] hover:text-white'
                }`}
              >
                <i className="fas fa-photo-video text-[13px]"></i>
                <span>All Media</span>
              </button>
              <button
                onClick={() => {
                  setFilterMode('videos');
                  setShowFilterDropdown(false);
                }}
                className={`w-full text-left px-3.5 py-2 text-xs font-semibold flex items-center gap-2.5 transition-colors ${
                  filterMode === 'videos'
                    ? 'text-[#1877F2] bg-[#1877F2]/10'
                    : 'text-[#94A3B8] hover:bg-[#1E293B] hover:text-white'
                }`}
              >
                <i className="fas fa-video text-[13px]"></i>
                <span>Videos Only</span>
              </button>
              <button
                onClick={() => {
                  setFilterMode('photos');
                  setShowFilterDropdown(false);
                }}
                className={`w-full text-left px-3.5 py-2 text-xs font-semibold flex items-center gap-2.5 transition-colors ${
                  filterMode === 'photos'
                    ? 'text-[#1877F2] bg-[#1877F2]/10'
                    : 'text-[#94A3B8] hover:bg-[#1E293B] hover:text-white'
                }`}
              >
                <i className="fas fa-image text-[13px]"></i>
                <span>Pictures Only</span>
              </button>
              <div className="border-t border-[#1E293B] my-1"></div>
              <button
                onClick={() => {
                  setShowFilterDropdown(false);
                  fileInputRef.current?.click();
                }}
                className="w-full text-left px-3.5 py-2 text-xs font-semibold flex items-center gap-2.5 text-[#38BDF8] hover:bg-[#1E293B]"
              >
                <i className="fas fa-folder-open text-[13px]"></i>
                <span>Browse Device Files...</span>
              </button>
            </div>
          )}
        </div>

        {/* Multi-select Toggle Button */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={toggleMultiSelect}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              isMultiSelect
                ? 'bg-[#1877F2] text-white shadow-md shadow-[#1877F2]/30'
                : 'bg-[#1E293B] hover:bg-[#334155] text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            <span
              className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                isMultiSelect ? 'bg-white text-[#1877F2]' : 'border border-[#64748B]'
              }`}
            >
              {isMultiSelect ? '✓' : ''}
            </span>
            <span>Select multiple</span>
          </button>
        </div>
      </div>

      {/* 3. UPPER PREVIEW AREA (Large active photo / video) */}
      <div className="relative w-full aspect-[4/3] sm:aspect-[16/9] max-h-[380px] bg-black flex items-center justify-center overflow-hidden flex-shrink-0 border-b border-[#1E293B]">
        {activePreviewItem ? (
          activePreviewItem.type === 'video' ? (
            <video
              src={activePreviewItem.url}
              controls
              playsInline
              loop
              className="w-full h-full object-contain"
            />
          ) : (
            <img
              src={activePreviewItem.url}
              alt="Preview"
              className="w-full h-full object-contain"
            />
          )
        ) : (
          <div className="text-[#64748B] text-sm">Select a photo or video</div>
        )}

        {/* Selected badge overlay on preview */}
        {activePreviewItem && (
          <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] text-white flex items-center gap-1.5 border border-white/15 pointer-events-none">
            <i
              className={`fas fa-${
                activePreviewItem.type === 'video' ? 'video text-[#38BDF8]' : 'image text-[#1877F2]'
              } text-[10px]`}
            ></i>
            <span>{activePreviewItem.type === 'video' ? 'Video' : 'Photo'}</span>
            {activePreviewItem.duration && (
              <span className="text-[#94A3B8]">• {activePreviewItem.duration}</span>
            )}
          </div>
        )}
      </div>

      {/* 4. ATTACHED MUSIC STRIP (If music is attached) */}
      {attachedMusic && (
        <div className="bg-[#0B1120] border-b border-[#1E293B] px-4 py-2 flex items-center justify-between gap-3 flex-shrink-0 animate-fadeIn">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-[#1877F2]/20 border border-[#1877F2]/40 text-[#38BDF8] flex items-center justify-center flex-shrink-0">
              <i className="fas fa-music text-[11px]"></i>
            </div>
            <div className="truncate text-xs">
              <span className="font-bold text-[#F8FAFC]">{attachedMusic.title}</span>
              {attachedMusic.artist && (
                <span className="text-[#94A3B8] ml-1.5">• {attachedMusic.artist}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Play/pause preview */}
            <button
              type="button"
              onClick={() => togglePlayAudio(attachedMusic.audioUrl)}
              className="w-7 h-7 rounded-full bg-[#1E293B] hover:bg-[#334155] text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <i
                className={`fas fa-${
                  previewAudioUrl === attachedMusic.audioUrl && isPlayingAudio
                    ? 'pause'
                    : 'play'
                } text-[10px]`}
              ></i>
            </button>
            {/* Remove music button */}
            <button
              type="button"
              onClick={() => {
                setAttachedMusic(null);
                if (audioRef.current) {
                  audioRef.current.pause();
                  setIsPlayingAudio(false);
                }
              }}
              className="w-7 h-7 rounded-full bg-[#1E293B] hover:bg-red-900/50 text-[#94A3B8] hover:text-red-400 flex items-center justify-center transition-colors cursor-pointer"
              title="Remove music"
            >
              <i className="fas fa-times text-[10px]"></i>
            </button>
          </div>
        </div>
      )}

      {/* 5. MEDIA GRID (Gallery stream matching the screenshot) */}
      <div className="flex-1 overflow-y-auto p-1 bg-[#050B18]">
        <div className="grid grid-cols-3 gap-1">
          {/* First Tile: Pick from Device Files button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="aspect-square bg-[#0F172A] hover:bg-[#1E293B] border border-dashed border-[#334155] rounded-lg flex flex-col items-center justify-center gap-1.5 text-[#94A3B8] hover:text-[#38BDF8] transition-colors cursor-pointer p-2 text-center"
          >
            <div className="w-8 h-8 rounded-full bg-[#1877F2]/15 flex items-center justify-center text-[#1877F2]">
              <i className="fas fa-folder-open text-sm"></i>
            </div>
            <span className="text-[11px] font-semibold leading-tight">Browse Files</span>
          </button>

          {/* Gallery Media Items */}
          {filteredItems.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            const selectionIndex = selectedIds.indexOf(item.id) + 1;

            return (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`relative aspect-square bg-[#0F172A] rounded-lg overflow-hidden cursor-pointer group border-2 transition-all ${
                  isSelected
                    ? 'border-[#1877F2] shadow-md shadow-[#1877F2]/20'
                    : 'border-transparent hover:border-[#334155]'
                }`}
              >
                {/* Media Image / Video Thumbnail */}
                {item.type === 'video' ? (
                  <div className="w-full h-full bg-black relative flex items-center justify-center">
                    <video
                      src={item.url}
                      preload="metadata"
                      className="w-full h-full object-cover pointer-events-none"
                    />
                    {/* Video Camera Icon + Duration Badge (matches screenshot) */}
                    <div className="absolute bottom-1.5 left-1.5 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] text-white flex items-center gap-1 border border-white/10 font-medium">
                      <i className="fas fa-video text-[9px] text-[#38BDF8]"></i>
                      <span>{item.duration || '0:15'}</span>
                    </div>
                  </div>
                ) : (
                  <img
                    src={item.url}
                    alt={item.name || 'Photo'}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                )}

                {/* Selection Circle Badge (Matches screenshot) */}
                <div className="absolute top-1.5 right-1.5 z-10">
                  {isSelected ? (
                    <div className="w-5 h-5 rounded-full bg-[#1877F2] text-white text-[11px] font-bold flex items-center justify-center shadow-md">
                      {isMultiSelect ? selectionIndex : '✓'}
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-white/70 bg-black/30 backdrop-blur-sm group-hover:border-white transition-colors" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. BOTTOM ACTION BAR (Music selector button & Proceed Next button) */}
      <div className="h-16 bg-[#0B1120] border-t border-[#1E293B] px-4 flex items-center justify-between gap-3 flex-shrink-0 z-20">
        {/* Open Music Selector Drawer Button */}
        <button
          type="button"
          onClick={() => setShowMusicDrawer(true)}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            attachedMusic
              ? 'bg-[#1877F2]/20 text-[#38BDF8] border border-[#1877F2]/40'
              : 'bg-[#0F172A] hover:bg-[#1E293B] text-[#CBD5E1] border border-[#1E293B]'
          }`}
        >
          <i className="fas fa-music text-[13px] text-[#38BDF8]"></i>
          <span>{attachedMusic ? 'Change Music' : 'Select Music'}</span>
        </button>

        {/* Selected Count & Next / Create Post Button */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#94A3B8]">
            {selectedIds.length} {selectedIds.length === 1 ? 'item' : 'items'}
          </span>
          <button
            type="button"
            onClick={handleProceed}
            disabled={selectedIds.length === 0}
            className="flex items-center gap-2 bg-[#1877F2] hover:bg-[#166FE5] disabled:opacity-50 disabled:cursor-not-allowed text-white text-[14px] font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-[#1877F2]/30 active:scale-95 transition-all cursor-pointer"
          >
            <span>Next</span>
            <i className="fas fa-arrow-right text-xs"></i>
          </button>
        </div>
      </div>

      {/* 7. MUSIC SELECTOR DRAWER / SHEET */}
      {showMusicDrawer && (
        <div className="absolute inset-0 z-40 bg-black/75 backdrop-blur-md flex flex-col justify-end animate-fadeIn">
          <div className="w-full max-h-[80vh] bg-[#0B1120] border-t border-[#1E293B] rounded-t-3xl flex flex-col overflow-hidden shadow-2xl">
            {/* Drawer Header */}
            <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-[#1E293B] flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#1877F2]/15 text-[#38BDF8] flex items-center justify-center">
                  <i className="fas fa-music text-sm"></i>
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-[#F8FAFC] leading-none">Add Music</h3>
                  <span className="text-[11px] text-[#94A3B8]">
                    Choose from UNERA catalog or upload custom file
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowMusicDrawer(false);
                  if (audioRef.current) {
                    audioRef.current.pause();
                    setIsPlayingAudio(false);
                  }
                }}
                className="w-8 h-8 rounded-full bg-[#0F172A] hover:bg-[#1E293B] text-[#94A3B8] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <i className="fas fa-times text-xs"></i>
              </button>
            </div>

            {/* Music Tabs (UNERA Music vs Upload from files) */}
            <div className="flex border-b border-[#1E293B] bg-[#080E1E] flex-shrink-0">
              <button
                type="button"
                onClick={() => setMusicTab('unera')}
                className={`flex-1 py-3 text-xs font-bold text-center transition-colors flex items-center justify-center gap-2 ${
                  musicTab === 'unera'
                    ? 'text-[#1877F2] border-b-2 border-[#1877F2]'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                <i className="fas fa-fire-alt text-xs"></i>
                <span>UNERA Music</span>
              </button>
              <button
                type="button"
                onClick={() => setMusicTab('upload')}
                className={`flex-1 py-3 text-xs font-bold text-center transition-colors flex items-center justify-center gap-2 ${
                  musicTab === 'upload'
                    ? 'text-[#1877F2] border-b-2 border-[#1877F2]'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                <i className="fas fa-upload text-xs"></i>
                <span>Upload from files</span>
              </button>
            </div>

            {/* Tab 1: UNERA Music Catalog */}
            {musicTab === 'unera' && (
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {/* Search Bar */}
                <div className="relative">
                  <i className="fas fa-search absolute left-3.5 top-3 text-[#64748B] text-xs"></i>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search songs or artists..."
                    className="w-full bg-[#0F172A] border border-[#1E293B] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-[#1877F2]"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-2.5 text-[#64748B] hover:text-white text-xs"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  )}
                </div>

                {/* Song List */}
                <div className="flex flex-col divide-y divide-[#1E293B]">
                  {filteredSongs.map((song) => {
                    const songUrl = song?.audio_url || song?.url || song?.file_url;
                    const isPreviewing = previewAudioUrl === songUrl && isPlayingAudio;
                    const isSelected = attachedMusic?.title === (song?.title || song?.name);

                    return (
                      <div
                        key={song.id || song.title}
                        className="py-2.5 flex items-center justify-between gap-3 group hover:bg-[#0F172A]/50 px-2 rounded-xl transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Play / Pause Preview Button */}
                          <button
                            type="button"
                            onClick={() => togglePlayAudio(songUrl)}
                            className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-transform active:scale-95 cursor-pointer ${
                              isPreviewing
                                ? 'bg-[#1877F2] text-white'
                                : 'bg-[#1E293B] text-[#38BDF8] group-hover:bg-[#334155]'
                            }`}
                          >
                            <i
                              className={`fas fa-${isPreviewing ? 'pause' : 'play'} text-xs ${
                                !isPreviewing ? 'ml-0.5' : ''
                              }`}
                            ></i>
                          </button>

                          {/* Song Details */}
                          <div className="truncate">
                            <h4 className="text-xs font-bold text-[#F8FAFC] truncate">
                              {song?.title || song?.name || 'Track'}
                            </h4>
                            <p className="text-[11px] text-[#94A3B8] truncate">
                              {song?.artist || song?.artist_name || 'UNERA Artist'}
                              {song?.duration && ` • ${song.duration}`}
                            </p>
                          </div>
                        </div>

                        {/* Attach Button */}
                        <button
                          type="button"
                          onClick={() => handleSelectSong(song)}
                          className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#1877F2] text-white shadow-sm'
                              : 'bg-[#1E293B] hover:bg-[#1877F2] text-[#38BDF8] hover:text-white'
                          }`}
                        >
                          {isSelected ? 'Attached' : 'Use'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tab 2: Upload from Files */}
            {musicTab === 'upload' && (
              <div className="p-6 flex flex-col items-center justify-center text-center gap-4">
                <div className="w-16 h-16 rounded-full bg-[#1877F2]/10 border border-[#1877F2]/30 flex items-center justify-center text-[#1877F2] text-2xl">
                  <i className="fas fa-file-audio"></i>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#F8FAFC]">Upload Audio File</h4>
                  <p className="text-xs text-[#94A3B8] max-w-xs mt-1">
                    Select any MP3, WAV, M4A, or AAC file from your device files and attach it to your post.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => audioInputRef.current?.click()}
                  className="flex items-center gap-2 bg-[#1877F2] hover:bg-[#166FE5] text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-[#1877F2]/30 transition-transform active:scale-95 cursor-pointer"
                >
                  <i className="fas fa-folder-open"></i>
                  <span>Choose Audio File</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
