'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Repeat, Repeat1, Shuffle, Heart, ListMusic, Music, ChevronDown,
} from 'lucide-react';
import { cn, formatDuration } from '@/lib/utils';
import { usePlayerStore } from '@/stores/player-store';
import { YouTubePlayer } from './youtube-player';
import { useLikedSongs } from '@/hooks/useLikedSongs';

// ─── Reusable draggable seek bar ──────────────────────────────────────────────
function SeekBar({
  progress, duration, onSeek, height = 4, className = '',
}: {
  progress: number; duration: number; onSeek: (t: number) => void;
  height?: number; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const pct = duration > 0 ? Math.min((progress / duration) * 100, 100) : 0;

  const getTime = useCallback((clientX: number) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeek(frac * duration);
  }, [duration, onSeek]);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    getTime(e.clientX);
    const move = (e: MouseEvent) => isDragging.current && getTime(e.clientX);
    const up = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    isDragging.current = true;
    getTime(e.touches[0].clientX);
    const move = (e: TouchEvent) => isDragging.current && getTime(e.touches[0].clientX);
    const end = () => {
      isDragging.current = false;
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', end);
    };
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', end);
  };

  const thumbSize = height * 3;

  return (
    <div
      ref={ref}
      className={cn('relative cursor-pointer group select-none', className)}
      style={{ height: `${Math.max(thumbSize, 24)}px` }}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
    >
      {/* Vertical center alignment wrapper */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2" style={{ height: `${height}px` }}>
        {/* Track */}
        <div className="absolute inset-0 rounded-full bg-white/15" />
        {/* Fill */}
        <div
          className="absolute left-0 top-0 bottom-0 rounded-full bg-[#2563eb]"
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Thumb — centered vertically, positioned along track */}
      <div
        className="absolute top-1/2 -translate-y-1/2 rounded-full bg-white shadow-md
                   opacity-0 group-hover:opacity-100 transition-opacity duration-150"
        style={{
          width: `${thumbSize}px`,
          height: `${thumbSize}px`,
          left: `calc(${pct}% - ${thumbSize / 2}px)`,
        }}
      />
    </div>
  );
}

// ─── Full-screen expanded player ──────────────────────────────────────────────
function ExpandedPlayer({ onClose }: { onClose: () => void }) {
  const {
    currentSong, isPlaying, volume, progress, duration,
    repeat, shuffle, seek, setVolume, togglePlay, next, prev,
    toggleRepeat, toggleShuffle,
  } = usePlayerStore();

  const { isLiked, toggleLike } = useLikedSongs(currentSong?.videoId);
  if (!currentSong) return null;

  const likeProps = {
    videoId: currentSong.videoId, title: currentSong.title,
    artist: currentSong.artist, thumbnail: currentSong.thumbnail,
    duration: currentSong.duration,
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden">
      {/* Blurred artwork bg */}
      <div className="absolute inset-0">
        {currentSong.thumbnail && (
          <img src={currentSong.thumbnail} alt="" className="w-full h-full object-cover scale-125 blur-3xl opacity-40" />
        )}
        <div className="absolute inset-0 bg-black/70" />
      </div>

      <div className="relative z-10 flex flex-col h-full max-w-lg mx-auto w-full px-6">
        {/* Header */}
        <div className="flex items-center justify-between pt-12 pb-6">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <ChevronDown className="w-5 h-5 text-white" />
          </button>
          <p className="text-white/60 text-xs font-bold uppercase tracking-widest">Now Playing</p>
          <div className="w-10" />
        </div>

        {/* Artwork */}
        <div className="flex-1 flex items-center justify-center py-4">
          <div className="w-full max-w-xs aspect-square rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
            {currentSong.thumbnail
              ? <img src={currentSong.thumbnail} alt={currentSong.title} className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-[#141414] flex items-center justify-center"><Music className="w-24 h-24 text-[#52525b]" /></div>
            }
          </div>
        </div>

        {/* Song info */}
        <div className="flex items-center justify-between py-4">
          <div className="min-w-0 flex-1">
            <p className="text-white text-xl font-bold truncate">{currentSong.title}</p>
            <p className="text-[#a1a1aa] text-sm mt-1 truncate">{currentSong.artist}</p>
          </div>
          <button
            onClick={() => toggleLike(likeProps)}
            className={cn('flex-shrink-0 ml-4 p-1 transition-colors', isLiked ? 'text-[#2563eb]' : 'text-[#a1a1aa] hover:text-white')}
          >
            <Heart className="w-6 h-6" fill={isLiked ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* Seek bar */}
        <div className="pb-2">
          <SeekBar progress={progress} duration={duration} onSeek={seek} height={4} className="w-full" />
          <div className="flex justify-between mt-1">
            <span className="text-[11px] text-[#a1a1aa] font-mono">{formatDuration(progress)}</span>
            <span className="text-[11px] text-[#a1a1aa] font-mono">{formatDuration(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between py-6">
          <button
            onClick={toggleShuffle}
            className={cn('relative p-2 transition-colors', shuffle ? 'text-[#2563eb]' : 'text-white/40 hover:text-white')}
          >
            <Shuffle className="w-5 h-5" />
            {shuffle && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#2563eb]" />}
          </button>

          <button onClick={prev} className="p-2 text-white hover:text-white/70 transition-colors">
            <SkipBack className="w-8 h-8" fill="currentColor" />
          </button>

          <button
            onClick={togglePlay}
            className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-transform"
          >
            {isPlaying
              ? <Pause className="w-7 h-7 text-black" fill="currentColor" />
              : <Play className="w-7 h-7 text-black ml-1" fill="currentColor" />
            }
          </button>

          <button onClick={next} className="p-2 text-white hover:text-white/70 transition-colors">
            <SkipForward className="w-8 h-8" fill="currentColor" />
          </button>

          <button
            onClick={toggleRepeat}
            className={cn('relative p-2 transition-colors', repeat !== 'off' ? 'text-[#2563eb]' : 'text-white/40 hover:text-white')}
          >
            {repeat === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
            {repeat !== 'off' && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#2563eb]" />}
          </button>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-3 pb-12">
          <button onClick={() => setVolume(volume === 0 ? 0.7 : 0)} className="text-white/40 hover:text-white transition-colors">
            <VolumeX className="w-4 h-4" />
          </button>
          <div className="flex-1 relative h-8 flex items-center">
            <div className="w-full h-1 rounded-full bg-white/15 overflow-hidden">
              <div className="h-full bg-white/50" style={{ width: `${volume * 100}%` }} />
            </div>
            <input
              type="range" min="0" max="1" step="0.01" value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          <button onClick={() => setVolume(1)} className="text-white/40 hover:text-white transition-colors">
            <Volume2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Player ──────────────────────────────────────────────────────────────
export function Player() {
  const [expanded, setExpanded] = useState(false);

  const openExpanded = () => {
    window.history.pushState({ expandedPlayer: true }, '');
    setExpanded(true);
  };

  const closeExpanded = () => {
    setExpanded(false);
  };

  // Intercept Android/browser back button to close expanded player
  useEffect(() => {
    const onPopState = () => {
      if (expanded) setExpanded(false);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [expanded]);

  const {
    currentSong, isPlaying, volume, progress, duration,
    repeat, shuffle, seekTo, togglePlay, next, prev,
    setVolume, setProgress, setDuration, seek, toggleRepeat, toggleShuffle,
  } = usePlayerStore();

  const { isLiked, toggleLike } = useLikedSongs(currentSong?.videoId);

  if (!currentSong) return null;

  const progressPercent = duration > 0 ? Math.min((progress / duration) * 100, 100) : 0;

  const likeProps = {
    videoId: currentSong.videoId, title: currentSong.title,
    artist: currentSong.artist, thumbnail: currentSong.thumbnail,
    duration: currentSong.duration,
  };

  return (
    <>
      <YouTubePlayer
        videoId={currentSong.videoId}
        isPlaying={isPlaying}
        volume={volume}
        seekTo={seekTo}
        onReady={(d) => setDuration(d)}
        onProgress={(t) => setProgress(t)}
        onEnded={() => next()}
        onError={() => next()}
      />

      {/* Expanded overlay */}
      {expanded && <ExpandedPlayer onClose={() => closeExpanded()} />}

      {/* ── MOBILE MINI PLAYER ── */}
      <div className="md:hidden fixed bottom-[56px] left-0 right-0 z-50 bg-[rgba(13,13,13,0.97)] backdrop-blur-2xl border-t border-white/[0.07]">

        {/* Thin progress strip */}
        <div className="h-[2px] w-full bg-white/10">
          <div className="h-full bg-[#2563eb] transition-all duration-300" style={{ width: `${progressPercent}%` }} />
        </div>

        {/* Song info row — tap to expand */}
        <div
          className="flex items-center gap-3 px-4 py-3 cursor-pointer"
          onClick={() => openExpanded()}
        >
          {/* Thumbnail */}
          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-[#141414] border border-white/[0.07]">
            {currentSong.thumbnail
              ? <img src={currentSong.thumbnail} alt={currentSong.title} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center"><Music className="w-5 h-5 text-[#52525b]" /></div>
            }
          </div>

          {/* Title / artist */}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-white truncate">{currentSong.title}</p>
            <p className="text-[11px] text-[#a1a1aa] truncate mt-0.5">{currentSong.artist}</p>
          </div>

          {/* Controls — stopPropagation so they don't open expanded */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); toggleLike(likeProps); }}
              className={cn('p-2', isLiked ? 'text-[#2563eb]' : 'text-[#a1a1aa]')}
            >
              <Heart className="w-5 h-5" fill={isLiked ? 'currentColor' : 'none'} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); prev(); }} className="p-2 text-white">
              <SkipBack className="w-5 h-5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); togglePlay(); }}
              className="w-9 h-9 rounded-full bg-[#2563eb] flex items-center justify-center"
            >
              {isPlaying
                ? <Pause className="w-4 h-4 text-white" fill="currentColor" />
                : <Play className="w-4 h-4 text-white ml-0.5" fill="currentColor" />
              }
            </button>
            <button onClick={(e) => { e.stopPropagation(); next(); }} className="p-2 text-white">
              <SkipForward className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── DESKTOP PLAYER ── */}
      <div className="hidden md:flex fixed bottom-0 left-0 right-0 z-50 h-[88px] bg-[rgba(0,0,0,0.92)] backdrop-blur-2xl border-t border-white/[0.08] px-6 items-center justify-between">

        {/* LEFT */}
        <div className="flex items-center gap-4 w-[30%] min-w-0">
          <div
            className="relative w-[52px] h-[52px] rounded-[10px] overflow-hidden flex-shrink-0 bg-[#141414] border border-white/[0.08] cursor-pointer group"
            onClick={() => openExpanded()}
            title="Expand player"
          >
            {currentSong.thumbnail
              ? <img src={currentSong.thumbnail} alt={currentSong.title} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center"><Music className="w-6 h-6 text-[#52525b]" /></div>
            }
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <ChevronDown className="w-5 h-5 text-white rotate-180" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-white truncate">{currentSong.title}</p>
            <p className="text-[12px] font-medium text-[#a1a1aa] truncate mt-0.5">{currentSong.artist}</p>
          </div>
          <button
            onClick={() => toggleLike(likeProps)}
            className={cn('flex-shrink-0 ml-2 transition-colors', isLiked ? 'text-[#2563eb]' : 'text-[#a1a1aa] hover:text-white')}
          >
            <Heart className="w-5 h-5" fill={isLiked ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* CENTER */}
        <div className="flex flex-col items-center flex-1 px-4 gap-2">
          <div className="flex items-center gap-6">
            <button onClick={toggleShuffle} className={cn('relative transition-colors', shuffle ? 'text-[#2563eb]' : 'text-[#a1a1aa] hover:text-white')}>
              <Shuffle className="w-4 h-4" />
              {shuffle && <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#2563eb]" />}
            </button>
            <button onClick={prev} className="text-[#a1a1aa] hover:text-white transition-colors">
              <SkipBack className="w-5 h-5" />
            </button>
            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white flex items-center justify-center transition-colors"
            >
              {isPlaying ? <Pause className="w-5 h-5" fill="currentColor" /> : <Play className="w-5 h-5 ml-1" fill="currentColor" />}
            </button>
            <button onClick={next} className="text-[#a1a1aa] hover:text-white transition-colors">
              <SkipForward className="w-5 h-5" />
            </button>
            <button onClick={toggleRepeat} className={cn('relative transition-colors', repeat !== 'off' ? 'text-[#2563eb]' : 'text-[#a1a1aa] hover:text-white')}>
              {repeat === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
              {repeat !== 'off' && <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#2563eb]" />}
            </button>
          </div>

          {/* Seekable progress */}
          <div className="flex items-center gap-3 w-full max-w-md">
            <span className="text-[10px] font-mono text-[#a1a1aa] min-w-[32px] text-right tabular-nums">{formatDuration(progress)}</span>
            <SeekBar progress={progress} duration={duration} onSeek={seek} height={3} className="flex-1" />
            <span className="text-[10px] font-mono text-[#a1a1aa] min-w-[32px] tabular-nums">{formatDuration(duration)}</span>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex items-center justify-end gap-3 w-[30%]">
          <button
            onClick={() => openExpanded()}
            className="text-[#a1a1aa] hover:text-white transition-colors"
            title="Full screen player"
          >
            <ListMusic className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 w-32 group">
            <button
              onClick={() => setVolume(volume === 0 ? 0.7 : 0)}
              className="text-[#a1a1aa] hover:text-white transition-colors flex-shrink-0"
            >
              {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <div className="flex-1 relative h-8 flex items-center">
              <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-[#a1a1aa] group-hover:bg-[#2563eb] transition-colors" style={{ width: `${volume * 100}%` }} />
              </div>
              <input
                type="range" min="0" max="1" step="0.01" value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}