import React, { useState, useEffect, useRef, useMemo } from 'react';
import { apiFetch } from '../utils/api';
import {
  getAllStoredGalleryMedia,
  saveGalleryMediaItems,
  deleteStoredGalleryItem,
  StoredGalleryItem,
} from '../utils/galleryStore';

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

function readVideoMetadata(file: File): Promise<{ durationStr: string; durationSec: number }> {
  return new Promise((resolve) => {
    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';
    const tempUrl = URL.createObjectURL(file);
    tempVideo.src = tempUrl;

    let resolved = false;
    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        URL.revokeObjectURL(tempUrl);
      }
    };

    tempVideo.onloadedmetadata = () => {
      const duration = tempVideo.duration || 0;
      const secs = Math.round(duration);
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      const durationStr = `${m}:${s < 10 ? '0' : ''}${s}`;
      cleanup();
      resolve({ durationStr, durationSec: secs });
    };

    tempVideo.onerror = () => {
      cleanup();
      resolve({ durationStr: '0:30', durationSec: 30 });
    };

    // Safety timeout
    setTimeout(() => {
      cleanup();
      resolve({ durationStr: '0:30', durationSec: 30 });
    }, 2000);
  });
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

  // Loading States
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [isReadingFiles, setIsReadingFiles] = useState(false);

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

  // Real Gallery Media Items (NO hardcoded fake demos)
  const [galleryItems, setGalleryItems] = useState<GalleryMediaItem[]>([]);

  // UNERA Music List
  const [uneraSongs, setUneraSongs] = useState<any[]>([]);

  // Fetch real songs catalog
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
                title: 'Sunset Vibes & Afro Groove',
                artist: 'Afro Chillwave',
                audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
                duration: '2:15',
              },
              {
                id: 3,
                title: 'Bongo Flava Acoustic Rhythms',
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

  // Load REAL media on opening: reads device storage (IndexedDB) + real user uploaded posts/reels
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoadingMedia(true);

    const loadRealMedia = async () => {
      try {
        // 1. Read real media previously chosen from device storage in IndexedDB
        const storedDeviceMedia = await getAllStoredGalleryMedia();
        const deviceItems: GalleryMediaItem[] = storedDeviceMedia.map((m) => ({
          id: m.id,
          type: m.type,
          url: m.url,
          duration: m.duration,
          durationSeconds: m.durationSeconds,
          name: m.name,
          size: m.size,
        }));

        // 2. Fetch real user media from posts and reels
        const seenUrls = new Set<string>(deviceItems.map((i) => i.url));
        const networkItems: GalleryMediaItem[] = [];

        const [postsRes, reelsRes] = await Promise.allSettled([
          apiFetch('/api/posts'),
          apiFetch('/api/reels'),
        ]);

        if (postsRes.status === 'fulfilled' && postsRes.value) {
          const pData = postsRes.value;
          const postsList = Array.isArray(pData) ? pData : pData?.posts || pData?.data || [];
          postsList.forEach((post: any) => {
            const vUrl = post.video_url || (post.media_type === 'video' ? post.media_url : null);
            if (vUrl && typeof vUrl === 'string' && !seenUrls.has(vUrl)) {
              seenUrls.add(vUrl);
              networkItems.push({
                id: `post_v_${post.id || Math.random()}`,
                type: 'video',
                url: vUrl,
                name: post.content ? post.content.slice(0, 25) : 'Video Post',
                duration: '0:30',
                durationSeconds: 30,
              });
            }

            const imgUrl = post.media_type === 'image' ? post.media_url : post.image_url;
            if (imgUrl && typeof imgUrl === 'string' && !seenUrls.has(imgUrl)) {
              seenUrls.add(imgUrl);
              networkItems.push({
                id: `post_img_${post.id || Math.random()}`,
                type: 'image',
                url: imgUrl,
                name: post.content ? post.content.slice(0, 25) : 'Photo Post',
              });
            }

            if (Array.isArray(post.images)) {
              post.images.forEach((img: any, idx: number) => {
                const u = typeof img === 'string' ? img : img?.url;
                if (u && typeof u === 'string' && !seenUrls.has(u)) {
                  seenUrls.add(u);
                  networkItems.push({
                    id: `post_img_${post.id}_${idx}`,
                    type: 'image',
                    url: u,
                    name: `Photo ${idx + 1}`,
                  });
                }
              });
            }
          });
        }

        if (reelsRes.status === 'fulfilled' && reelsRes.value) {
          const rData = reelsRes.value;
          const reelsList = Array.isArray(rData) ? rData : rData?.reels || rData?.data || [];
          reelsList.forEach((reel: any) => {
            const vUrl = reel.video_url || reel.media_url;
            if (vUrl && typeof vUrl === 'string' && !seenUrls.has(vUrl)) {
              seenUrls.add(vUrl);
              networkItems.push({
                id: `reel_v_${reel.id || Math.random()}`,
                type: 'video',
                url: vUrl,
                name: reel.caption ? reel.caption.slice(0, 25) : reel.song_name || 'Reel',
                duration: reel.duration ? String(reel.duration) : '0:30',
                durationSeconds: 30,
              });
            }
          });
        }

        if (isMounted) {
          const allReal = [...deviceItems, ...networkItems];
          setGalleryItems(allReal);
          if (allReal.length > 0 && selectedIds.length === 0) {
            setSelectedIds([allReal[0].id]);
            setActivePreviewId(allReal[0].id);
          }
        }
      } catch (err) {
        console.warn('Could not retrieve existing gallery items:', err);
      } finally {
        if (isMounted) setIsLoadingMedia(false);
      }
    };

    loadRealMedia();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Initial selection when items appear
  useEffect(() => {
    if (galleryItems.length > 0 && selectedIds.length === 0) {
      setSelectedIds([galleryItems[0].id]);
      setActivePreviewId(galleryItems[0].id);
    }
  }, [galleryItems, selectedIds.length]);

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
        s?.artist?.toLowerCase().includes(q)
    );
  }, [uneraSongs, searchQuery]);

  // Handle selecting or multi-selecting media items
  const handleItemClick = (item: GalleryMediaItem) => {
    setActivePreviewId(item.id);

    if (isMultiSelect) {
      if (selectedIds.includes(item.id)) {
        setSelectedIds((prev) => prev.filter((id) => id !== item.id));
      } else {
        setSelectedIds((prev) => [...prev, item.id]);
      }
    } else {
      setSelectedIds([item.id]);
    }
  };

  // Toggle multi-select mode
  const toggleMultiSelect = () => {
    setIsMultiSelect((prev) => {
      const next = !prev;
      if (!next && selectedIds.length > 1) {
        setSelectedIds([selectedIds[0]]);
      }
      return next;
    });
  };

  // Handle uploading real files from device storage
  const handleDeviceFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files: File[] = Array.from(fileList);
    setIsReadingFiles(true);

    try {
      const newItems: GalleryMediaItem[] = [];
      const toPersist: StoredGalleryItem[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isVideo = file.type.startsWith('video/');
        const url = URL.createObjectURL(file);
        const itemId = `dev_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`;

        let durationStr = isVideo ? '0:00' : undefined;
        let durationSec = isVideo ? 0 : undefined;

        if (isVideo) {
          const meta = await readVideoMetadata(file);
          durationStr = meta.durationStr;
          durationSec = meta.durationSec;
        }

        const item: GalleryMediaItem = {
          id: itemId,
          type: isVideo ? 'video' : 'image',
          url,
          file,
          duration: durationStr,
          durationSeconds: durationSec,
          name: file.name,
          size: file.size,
        };

        newItems.push(item);

        toPersist.push({
          id: itemId,
          type: isVideo ? 'video' : 'image',
          url,
          duration: durationStr,
          durationSeconds: durationSec,
          name: file.name,
          size: file.size,
          timestamp: Date.now() - i * 100,
        });
      }

      // Persist real media into IndexedDB
      await saveGalleryMediaItems(toPersist);

      setGalleryItems((prev) => [...newItems, ...prev]);
      const newIds = newItems.map((i) => i.id);
      if (isMultiSelect) {
        setSelectedIds((prev) => [...newIds, ...prev]);
      } else {
        setSelectedIds([newIds[0]]);
      }
      setActivePreviewId(newIds[0]);
    } catch (err) {
      console.error('Failed to read device media:', err);
    } finally {
      setIsReadingFiles(false);
      if (e.target) {
        e.target.value = '';
      }
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

  // Delete item from local device gallery store
  const handleDeleteItem = async (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    await deleteStoredGalleryItem(itemId);
    setGalleryItems((prev) => prev.filter((i) => i.id !== itemId));
    setSelectedIds((prev) => prev.filter((id) => id !== itemId));
    if (activePreviewId === itemId) {
      const remaining = galleryItems.filter((i) => i.id !== itemId);
      setActivePreviewId(remaining[0]?.id || null);
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
      {/* Real Native File Inputs */}
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

      {/* 1. TOP BAR */}
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

        <div className="flex items-center gap-2">
          {/* Quick open device storage button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            type="button"
            className="flex items-center gap-1.5 bg-[#1E293B] hover:bg-[#334155] text-[#38BDF8] text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
            title="Browse device photos and videos"
          >
            <i className="fas fa-folder-open text-xs"></i>
            <span className="hidden sm:inline">Browse</span>
          </button>

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
      </div>

      {/* 2. SUBHEADER FILTER BAR */}
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
                ? 'Device Gallery'
                : filterMode === 'videos'
                ? 'Videos Only'
                : 'Photos Only'}
            </span>
            <i
              className={`fas fa-chevron-down text-xs text-[#94A3B8] transition-transform ${
                showFilterDropdown ? 'rotate-180' : ''
              }`}
            ></i>
          </button>

          {/* Filter Popover Dropdown */}
          {showFilterDropdown && (
            <div className="absolute top-10 left-0 w-48 bg-[#0F172A] border border-[#1E293B] rounded-xl shadow-2xl py-1.5 z-30 animate-fadeIn">
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
                <i className="fas fa-images text-[13px]"></i>
                <span>Photos Only</span>
              </button>
              <div className="border-t border-[#1E293B] my-1"></div>
              <button
                onClick={() => {
                  setShowFilterDropdown(false);
                  fileInputRef.current?.click();
                }}
                className="w-full text-left px-3.5 py-2 text-xs font-semibold text-[#38BDF8] hover:bg-[#1E293B] flex items-center gap-2.5 transition-colors"
              >
                <i className="fas fa-folder-open text-[13px]"></i>
                <span>Choose From Device</span>
              </button>
            </div>
          )}
        </div>

        {/* Multi-Select Toggle Pill */}
        <div className="flex items-center gap-2">
          {isReadingFiles && (
            <div className="flex items-center gap-1.5 text-xs text-[#38BDF8] animate-pulse mr-1">
              <i className="fas fa-spinner fa-spin"></i>
              <span className="hidden sm:inline">Reading media…</span>
            </div>
          )}
          <button
            type="button"
            onClick={toggleMultiSelect}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all cursor-pointer ${
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

      {/* 3. UPPER PREVIEW AREA (Active photo / video) */}
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
          <div className="flex flex-col items-center justify-center text-[#64748B] text-center p-6">
            <i className="fas fa-photo-video text-3xl mb-2 text-[#334155]"></i>
            <span className="text-sm font-medium">Select a photo or video to preview</span>
            <span className="text-xs text-[#475569] mt-1">
              Reads all real images and videos from your device
            </span>
          </div>
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

      {/* 4. ATTACHED MUSIC STRIP */}
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

      {/* 5. MEDIA GRID */}
      <div className="flex-1 overflow-y-auto p-1 bg-[#050B18]">
        {isLoadingMedia ? (
          <div className="flex flex-col items-center justify-center h-48 text-[#94A3B8]">
            <i className="fas fa-spinner fa-spin text-2xl text-[#1877F2] mb-2"></i>
            <span className="text-xs">Loading native gallery media…</span>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {/* Tile 1: Pick from Device Files */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square bg-[#0F172A] hover:bg-[#1E293B] border border-dashed border-[#334155] rounded-lg flex flex-col items-center justify-center gap-1.5 text-[#94A3B8] hover:text-[#38BDF8] transition-colors cursor-pointer p-2 text-center"
            >
              <div className="w-8 h-8 rounded-full bg-[#1877F2]/15 flex items-center justify-center text-[#1877F2]">
                <i className="fas fa-folder-open text-sm"></i>
              </div>
              <span className="text-[11px] font-semibold leading-tight">Device Files</span>
            </button>

            {/* Tile 2: Instant Camera Capture */}
            <button
              type="button"
              onClick={() => {
                if (onOpenCamera) {
                  onOpenCamera();
                } else if (cameraInputRef.current) {
                  cameraInputRef.current.click();
                }
              }}
              className="aspect-square bg-[#0F172A] hover:bg-[#1E293B] border border-dashed border-[#334155] rounded-lg flex flex-col items-center justify-center gap-1.5 text-[#94A3B8] hover:text-[#38BDF8] transition-colors cursor-pointer p-2 text-center"
            >
              <div className="w-8 h-8 rounded-full bg-[#38BDF8]/15 flex items-center justify-center text-[#38BDF8]">
                <i className="fas fa-camera text-sm"></i>
              </div>
              <span className="text-[11px] font-semibold leading-tight">Camera</span>
            </button>

            {/* Real Gallery Items */}
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
                      {/* Video Camera Icon + Real Duration Badge */}
                      <div className="absolute bottom-1.5 left-1.5 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] text-white flex items-center gap-1 border border-white/10 font-medium">
                        <i className="fas fa-video text-[9px] text-[#38BDF8]"></i>
                        <span>{item.duration || '0:30'}</span>
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

                  {/* Selection Circle Badge */}
                  <div className="absolute top-1.5 right-1.5 z-10">
                    {isSelected ? (
                      <div className="w-5 h-5 rounded-full bg-[#1877F2] text-white text-[11px] font-bold flex items-center justify-center shadow-md">
                        {isMultiSelect ? selectionIndex : '✓'}
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-white/70 bg-black/30 backdrop-blur-sm group-hover:border-white transition-colors" />
                    )}
                  </div>

                  {/* Quick delete from local gallery for device-added items */}
                  {item.id.startsWith('dev_') && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteItem(e, item.id)}
                      title="Remove from device gallery"
                      className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-md bg-black/60 hover:bg-red-600/80 text-white/70 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    >
                      <i className="fas fa-trash-alt text-[10px]"></i>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state if user has no photos/videos loaded yet */}
        {!isLoadingMedia && filteredItems.length === 0 && (
          <div className="flex flex-col items-center justify-center p-8 text-center my-6">
            <div className="w-14 h-14 rounded-full bg-[#0F172A] border border-[#1E293B] flex items-center justify-center text-[#38BDF8] mb-3">
              <i className="fas fa-images text-2xl"></i>
            </div>
            <h3 className="text-sm font-bold text-[#F8FAFC]">Device Gallery Ready</h3>
            <p className="text-xs text-[#94A3B8] max-w-xs mt-1">
              Select real photos and videos from your device storage to view, edit, attach music, and post.
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 flex items-center gap-2 bg-[#1877F2] hover:bg-[#166FE5] text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg transition-transform active:scale-95 cursor-pointer"
            >
              <i className="fas fa-plus-circle"></i>
              <span>Select Photos & Videos from Device</span>
            </button>
          </div>
        )}
      </div>

      {/* 6. BOTTOM ACTION BAR */}
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

            {/* Music Tabs */}
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
                <i className="fas fa-cloud-upload-alt text-xs"></i>
                <span>Upload Audio</span>
              </button>
            </div>

            {/* Tab 1: UNERA Music Catalog */}
            {musicTab === 'unera' && (
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {/* Search Bar */}
                <div className="relative">
                  <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-[#64748B]"></i>
                  <input
                    type="text"
                    placeholder="Search songs or artists..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#0F172A] border border-[#1E293B] rounded-xl pl-9 pr-4 py-2 text-xs text-[#F8FAFC] placeholder-[#64748B] outline-none focus:border-[#1877F2]"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#94A3B8] hover:text-white"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  )}
                </div>

                {/* Songs List */}
                <div className="space-y-1 mt-1">
                  {filteredSongs.length === 0 ? (
                    <div className="text-center py-8 text-[#64748B] text-xs">
                      No songs found matching "{searchQuery}"
                    </div>
                  ) : (
                    filteredSongs.map((song: any) => {
                      const songUrl = song?.audio_url || song?.url || song?.file_url;
                      const isThisSelected = attachedMusic?.id === song.id;
                      const isThisPlaying = previewAudioUrl === songUrl && isPlayingAudio;

                      return (
                        <div
                          key={song.id}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                            isThisSelected
                              ? 'bg-[#1877F2]/10 border-[#1877F2]/40'
                              : 'bg-[#0F172A] border-[#1E293B] hover:border-[#334155]'
                          }`}
                        >
                          {/* Song Info & Preview Play Button */}
                          <div className="flex items-center gap-3 overflow-hidden flex-1 mr-3">
                            <button
                              type="button"
                              onClick={() => togglePlayAudio(songUrl)}
                              className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-transform active:scale-90 cursor-pointer ${
                                isThisPlaying
                                  ? 'bg-[#1877F2] text-white shadow-md shadow-[#1877F2]/40'
                                  : 'bg-[#1E293B] text-[#38BDF8] hover:bg-[#334155]'
                              }`}
                            >
                              <i
                                className={`fas fa-${isThisPlaying ? 'pause' : 'play'} text-xs ml-${
                                  isThisPlaying ? '0' : '0.5'
                                }`}
                              ></i>
                            </button>

                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-bold text-[#F8FAFC] truncate">
                                {song.title || song.name}
                              </h4>
                              <p className="text-[11px] text-[#94A3B8] truncate">
                                {song.artist || song.artist_name || 'UNERA Sound Lab'}
                                {song.duration && ` • ${song.duration}`}
                              </p>
                            </div>
                          </div>

                          {/* Attach / Select Button */}
                          <button
                            type="button"
                            onClick={() => handleSelectSong(song)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              isThisSelected
                                ? 'bg-[#1877F2] text-white'
                                : 'bg-[#1E293B] hover:bg-[#1877F2] text-[#CBD5E1] hover:text-white'
                            }`}
                          >
                            {isThisSelected ? 'Selected' : 'Use Song'}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Upload Custom Audio from Files */}
            {musicTab === 'upload' && (
              <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#1877F2]/15 text-[#38BDF8] flex items-center justify-center text-2xl mb-3">
                  <i className="fas fa-file-audio"></i>
                </div>
                <h4 className="text-sm font-bold text-[#F8FAFC]">Upload Your Own Audio Track</h4>
                <p className="text-xs text-[#94A3B8] max-w-xs mt-1">
                  Attach custom MP3, WAV, AAC, or M4A music files directly from your phone or computer.
                </p>

                <button
                  type="button"
                  onClick={() => audioInputRef.current?.click()}
                  className="mt-4 flex items-center gap-2 bg-[#1877F2] hover:bg-[#166FE5] text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg transition-transform active:scale-95 cursor-pointer"
                >
                  <i className="fas fa-upload text-xs"></i>
                  <span>Browse Audio Files</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
