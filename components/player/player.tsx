'use client';

import { useRef, useState, useCallback } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Repeat, Repeat1, Shuffle, Heart, ListMusic, Music,
  ChevronDown, X
} from 'lucide-react';
import { cn, formatDuration } from '@/lib/utils';
import { usePlayerStore } from '@/stores/player-store';
import { YouTubePlayer } from './youtube-player';
import { useLikedSongs } from '@/hooks/useLikedSongs';

// ─── Draggable seek bar (used in both mini and expanded) ──────────────────────
function SeekBar({
  progress, duration, onSeek,
  className = '', trackClass = '', fillClass = '', thumbClass = '',
}: {
  progress: number; duration: number; onSeek: (t: number) => void;
  className?: string; trackClass?: string; fillClass?: string; thumbClass?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const pct = duration > 0 ? Math.min((progress / duration) * 100, 100) : 0;

  const calc = useCallback((clientX: number) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeek(frac * duration);
  }, [duration, onSeek]);

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    calc(e.clientX);
    const onMove = (e: MouseEvent) => { if (dragging.current) calc(e.clientX); };
    const onUp = () => { dragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    dragging.current = true;
    calc(e.touches[0].clientX);
    const onMove = (e: TouchEvent) => { if (dragging.current) calc(e.touches[0].clientX); };
    const onEnd = () => { dragging.current = false; window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onEnd); };
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
  };

  return (
    <div
      ref={ref}
      className={cn('relative flex items-center cursor-pointer group', className)}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
    >
      {/* Track */}
      <div className={cn('absolute inset-0 rounded-full', trackClass)} />
      {/* Fill */}
      <div className={cn('absolute left-0 top-0 bottom-0 rounded-full transition-none', fillClass)} style={{ width: `${pct}%` }} />
      {/* Thumb */}
      <div
        className={cn('absolute rounded-full shadow-lg transition-opacity', thumbClass)}
        style={{ left: `calc(${pct}% - 8px)` }}
      />
    </div>
  );
}

// ─── Expanded full-screen player ──────────────────────────────────────────────
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
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      {/* Blurred background artwork */}
      <div className="absolute inset-0 overflow-hidden">
        {currentSong.thumbnail && (
          <img
            src={currentSong.thumbnail}
            alt=""
            className="w-full h-full object-cover scale-110 blur-3xl opacity-30"
          />
        )}
        <div className="absolute inset-0 bg-black/60" />
      </div>

      <div className="relative z-10 flex flex-col h-full">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 pt-12 pb-4">
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
            <ChevronDown className="w-5 h-5 text-white" />
          </button>
          <div className="text-center">
            <p className="text-white text-xs font-bold uppercase tracking-widest opacity-60">Now Playing</p>
          </div>
          <div className="w-9" />
        </div>

        {/* Artwork */}
        <div className="flex-1 flex items-center justify-center px-10 py-4">
          <div className="w-full max-w-[320px] aspect-square rounded-2xl overflow-hidden shadow-2xl">
            {currentSong.thumbnail
              ? <img src={currentSong.thumbnail} alt={currentSong.title} className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-[#141414] flex items-center justify-center"><Music className="w-20 h-20 text-[#52525b]" /></div>
            }
          </div>
        </div>

        {/* Song info + like */}
        <div className="px-8 pb-4 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-white text-xl font-bold truncate">{currentSong.title}</p>
            <p className="text-[#a1a1aa] text-sm mt-1 truncate">{currentSong.artist}</p>
          </div>
          <button onClick={() => toggleLike(likeProps)} className={cn('flex-shrink-0 ml-4 p-1', isLiked ? 'text-[#2563eb]' : 'text-[#a1a1aa]')}>
            <Heart className="w-6 h-6" fill={isLiked ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* Seek bar with timestamps */}
        <div className="px-8 pb-4">
          <SeekBar
            progress={progress} duration={duration} onSeek={seek}
            className="h-10"
            trackClass="h-1 bg-white/20"
            fillClass="h-1 bg-[#2563eb]"
            thumbClass="w-4 h-4 bg-white top-1/2 -translate-y-1/2 opacity-100"
          />
          <div className="flex justify-between mt-1">
            <span className="text-[11px] text-[#a1a1aa] font-mono">{formatDuration(progress)}</span>
            <span className="text-[11px] text-[#a1a1aa] font-mono">{formatDuration(duration)}</span>
          </div>
        </div>

        {/* Main controls */}
        <div className="flex items-center justify-between px-10 pb-6">
          <button onClick={toggleShuffle} className={cn('relative', shuffle ? 'text-[#2563eb]' : 'text-white/50')}>
            <Shuffle className="w-5 h-5" />
            {shuffle && <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#2563eb]" />}
          </button>

          <button onClick={prev} className="text-white">
            <SkipBack className="w-7 h-7" fill="currentColor" />
          </button>

          <button
            onClick={togglePlay}
            className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-xl active:scale-95 transition-transform"
          >
            {isPlaying
              ? <Pause className="w-7 h-7 text-black" fill="currentColor" />
              : <Play className="w-7 h-7 text-black ml-1" fill="currentColor" />
            }
          </button>

          <button onClick={next} className="text-white">
            <SkipForward className="w-7 h-7" fill="currentColor" />
          </button>

          <button onClick={toggleRepeat} className={cn('relative', repeat !== 'off' ? 'text-[#2563eb]' : 'text-white/50')}>
            {repeat === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
            {repeat !== 'off' && <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#2563eb]" />}
          </button>
        </div>

        {/* Volume (mobile) */}
        <div className="flex items-center gap-3 px-8 pb-10">
          <button onClick={() => setVolume(volume === 0 ? 0.7 : 0)} className="text-white/50">
            {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <div className="flex-1 relative h-8 flex items-center">
            <div className="w-full h-1 rounded-full bg-white/20 overflow-hidden">
              <div className="h-full bg-white/60 transition-none" style={{ width: `${volume * 100}%` }} />
            </div>
            <input
              type="range" min="0" max="1" step="0.01" value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          <Volume2 className="w-4 h-4 text-white/50" />
        </div>
      </div>
    </div>
  );
}

// ─── Main Player ──────────────────────────────────────────────────────────────
export function Player() {
  const [expanded, setExpanded] = useState(false);

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

      {/* Expanded player */}
      {expanded && <ExpandedPlayer onClose={() => setExpanded(false)} />}

      {/* ── MOBILE MINI PLAYER ── */}
      <div className="md:hidden fixed bottom-[56px] left-0 right-0 z-50 bg-[rgba(0,0,0,0.95)] backdrop-blur-2xl border-t border-[rgba(255,255,255,0.08)]">

        {/* Thin progress bar at top — not clickable here, tap to expand */}
        <div className="h-0.5 w-full bg-[rgba(255,255,255,0.08)]">
          <div className="h-full bg-[#2563eb] transition-all duration-300" style={{ width: `${progressPercent}%` }} />
        </div>

        {/* Tap area — opens expanded player */}
        <div
          className="flex items-center gap-3 px-4 pt-3 pb-1 cursor-pointer"
          onClick={() => setExpanded(true)}
        >
          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-[#141414] border border-[rgba(255,255,255,0.08)]">
            {currentSong.thumbnail
              ? <img src={currentSong.thumbnail} alt={currentSong.title} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center"><Music className="w-5 h-5 text-[#52525b]" /></div>
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-white truncate leading-tight">{currentSong.title}</p>
            <p className="text-[11px] text-[#a1a1aa] truncate mt-0.5">{currentSong.artist}</p>
          </div>
          {/* Stop propagation on action buttons so tap doesn't open expanded */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleLike(likeProps); }}
            className={cn('flex-shrink-0 p-2', isLiked ? 'text-[#2563eb]' : 'text-[#a1a1aa]')}
          >
            <Heart className="w-5 h-5" fill={isLiked ? 'currentColor' : 'none'} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); prev(); }} className="p-2 text-white">
            <SkipBack className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            className="w-9 h-9 rounded-full bg-[#2563eb] flex items-center justify-center flex-shrink-0"
          >
            {isPlaying ? <Pause className="w-4 h-4 text-white" fill="currentColor" /> : <Play className="w-4 h-4 text-white ml-0.5" fill="currentColor" />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); next(); }} className="p-2 text-white">
            <SkipForward className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── DESKTOP PLAYER ── */}
      <div className="hidden md:flex fixed bottom-0 left-0 right-0 z-50 h-[88px] bg-[rgba(0,0,0,0.92)] backdrop-blur-2xl border-t border-[rgba(255,255,255,0.08)] px-6 items-center justify-between">

        {/* LEFT — click thumbnail to expand */}
        <div className="flex items-center gap-4 w-[30%] min-w-0">
          <div
            className="w-[52px] h-[52px] rounded-[10px] overflow-hidden flex-shrink-0 bg-[#141414] border border-[rgba(255,255,255,0.08)] cursor-pointer hover:opacity-80 transition-opacity group relative"
            onClick={() => setExpanded(true)}
            title="Expand player"
          >
            {currentSong.thumbnail
              ? <img src={currentSong.thumbnail} alt={currentSong.title} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center"><Music className="w-6 h-6 text-[#52525b]" /></div>
            }
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <ChevronDown className="w-4 h-4 text-white rotate-180" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-white truncate">{currentSong.title}</p>
            <p className="text-[12px] font-medium text-[#a1a1aa] truncate mt-0.5">{currentSong.artist}</p>
          </div>
          <button onClick={() => toggleLike(likeProps)} className={cn('flex-shrink-0 ml-2', isLiked ? 'text-[#2563eb]' : 'text-[#a1a1aa] hover:text-white')}>
            <Heart className="w-5 h-5" fill={isLiked ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* CENTER */}
        <div className="flex flex-col items-center flex-1 w-[40%] px-4 gap-2">
          <div className="flex items-center gap-6">
            <button onClick={toggleShuffle} className={cn('relative transition-all', shuffle ? 'text-[#2563eb]' : 'text-[#a1a1aa] hover:text-white')}>
              <Shuffle className="w-4 h-4" />
              {shuffle && <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#2563eb]" />}
            </button>
            <button onClick={prev} className="text-[#a1a1aa] hover:text-white transition-all">
              <SkipBack className="w-5 h-5" />
            </button>
            <button onClick={togglePlay} className="w-10 h-10 rounded-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white flex items-center justify-center transition-all">
              {isPlaying ? <Pause className="w-5 h-5" fill="currentColor" /> : <Play className="w-5 h-5 ml-1" fill="currentColor" />}
            </button>
            <button onClick={next} className="text-[#a1a1aa] hover:text-white transition-all">
              <SkipForward className="w-5 h-5" />
            </button>
            <button onClick={toggleRepeat} className={cn('relative transition-all', repeat !== 'off' ? 'text-[#2563eb]' : 'text-[#a1a1aa] hover:text-white')}>
              {repeat === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
              {repeat !== 'off' && <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#2563eb]" />}
            </button>
          </div>

          {/* Seekable progress bar */}
          <div className="flex items-center gap-3 w-full max-w-md">
            <span className="text-[10px] font-mono text-[#a1a1aa] min-w-[32px] text-right">{formatDuration(progress)}</span>
            <SeekBar
              progress={progress} duration={duration} onSeek={seek}
              className="h-4 flex-1"
              trackClass="h-1 bg-white/10"
              fillClass="h-1 bg-[#2563eb]"
              thumbClass="w-3 h-3 bg-white top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100"
            />
            <span className="text-[10px] font-mono text-[#a1a1aa] min-w-[32px]">{formatDuration(duration)}</span>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex items-center justify-end gap-4 w-[30%]">
          <button
            onClick={() => setExpanded(true)}
            className="text-[#a1a1aa] hover:text-white transition-all"
            title="Expand player"
          >
            <ListMusic className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 w-28 group">
            <button onClick={() => setVolume(volume === 0 ? 0.7 : 0)} className="text-[#a1a1aa] hover:text-white transition-all">
              {volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <div className="h-1 flex-1 relative rounded-full bg-[rgba(255,255,255,0.1)] flex items-center cursor-pointer overflow-hidden">
              <input type="range" min="0" max="1" step="0.01" value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="absolute h-1 rounded-full bg-[#a1a1aa] group-hover:bg-[#2563eb] transition-colors" style={{ width: `${volume * 100}%` }} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}