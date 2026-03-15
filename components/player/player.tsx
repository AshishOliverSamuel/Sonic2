'use client';

import { useRef } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Repeat, Repeat1, Shuffle, Heart, ListMusic, Music
} from 'lucide-react';
import { cn, formatDuration } from '@/lib/utils';
import { usePlayerStore } from '@/stores/player-store';
import { YouTubePlayer } from './youtube-player';
import { useLikedSongs } from '@/hooks/useLikedSongs';

export function Player() {
  const progressRef = useRef<HTMLDivElement>(null);

  const {
    currentSong, isPlaying, volume, progress, duration,
    repeat, shuffle, seekTo, togglePlay, next, prev,
    setVolume, setProgress, setDuration, seek, toggleRepeat, toggleShuffle,
  } = usePlayerStore();

  const { isLiked, toggleLike } = useLikedSongs(currentSong?.videoId);

  if (!currentSong) return null;

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    seek((e.clientX - rect.left) / rect.width * (duration || 0));
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

      <div className="fixed bottom-[56px] md:bottom-0 left-0 right-0 z-50 h-[72px] md:h-[88px] bg-[rgba(0,0,0,0.92)] backdrop-blur-2xl border-t border-[rgba(255,255,255,0.08)] px-4 md:px-6 flex items-center justify-between transition-all duration-200">

        {/* LEFT — Song Info */}
        <div className="flex items-center gap-3 md:gap-4 w-[40%] md:w-[30%] min-w-0">
          <div className="w-[44px] h-[44px] md:w-[52px] md:h-[52px] rounded-[8px] md:rounded-[10px] overflow-hidden flex-shrink-0 bg-[#141414] border border-[rgba(255,255,255,0.08)]">
            {currentSong.thumbnail ? (
              <img src={currentSong.thumbnail} alt={currentSong.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Music className="w-5 h-5 md:w-6 md:h-6 text-[#52525b]" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] md:text-[14px] font-semibold text-white truncate">{currentSong.title}</p>
            <p className="text-[11px] md:text-[12px] font-medium text-[#a1a1aa] truncate mt-0.5">{currentSong.artist}</p>
          </div>
          <button
            onClick={() => currentSong && toggleLike({
              videoId: currentSong.videoId, title: currentSong.title,
              artist: currentSong.artist, thumbnail: currentSong.thumbnail,
              duration: currentSong.duration,
            })}
            className={cn('flex-shrink-0 transition-all duration-200 ml-1 md:ml-2',
              isLiked ? 'text-[#2563eb]' : 'text-[#a1a1aa] hover:text-white')}
          >
            <Heart className="w-4 h-4 md:w-5 md:h-5" fill={isLiked ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* CENTER — Controls */}
        <div className="flex flex-col items-center justify-center flex-1 md:w-[40%] px-2 md:px-4 gap-1 md:gap-2">
          <div className="flex items-center gap-3 md:gap-6">

            {/* Shuffle — visible on ALL screen sizes now */}
            <button
              onClick={toggleShuffle}
              className={cn(
                'transition-all duration-200 relative',
                shuffle ? 'text-[#2563eb]' : 'text-[#a1a1aa] hover:text-white'
              )}
              title="Shuffle"
            >
              <Shuffle className="w-4 h-4" />
              {/* Active indicator dot */}
              {shuffle && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#2563eb]" />
              )}
            </button>

            <button onClick={prev} className="text-[#a1a1aa] hover:text-white transition-all duration-200">
              <SkipBack className="w-5 h-5" />
            </button>

            <button
              onClick={togglePlay}
              className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white flex items-center justify-center transition-all duration-200"
            >
              {isPlaying
                ? <Pause className="w-5 h-5" fill="currentColor" />
                : <Play className="w-5 h-5 ml-1" fill="currentColor" />}
            </button>

            <button onClick={next} className="text-[#a1a1aa] hover:text-white transition-all duration-200">
              <SkipForward className="w-5 h-5" />
            </button>

            {/* Repeat */}
            <button
              onClick={toggleRepeat}
              className={cn(
                'transition-all duration-200 relative',
                repeat !== 'off' ? 'text-[#2563eb]' : 'text-[#a1a1aa] hover:text-white'
              )}
              title={repeat === 'off' ? 'Repeat off' : repeat === 'all' ? 'Repeat all' : 'Repeat one'}
            >
              {repeat === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
              {repeat !== 'off' && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#2563eb]" />
              )}
            </button>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-2 md:gap-3 w-full max-w-md">
            <span className="text-[10px] font-medium text-[#a1a1aa] min-w-[30px] md:min-w-[32px] text-right font-mono hidden sm:block">
              {formatDuration(progress)}
            </span>
            <div
              ref={progressRef}
              className="h-1 flex-1 relative cursor-pointer group flex items-center touch-none"
              onClick={handleProgressClick}
            >
              <div className="absolute inset-0 h-1 rounded-full bg-[rgba(255,255,255,0.1)] w-full" />
              <div className="absolute h-1 rounded-full bg-[#2563eb] transition-all duration-100" style={{ width: `${progressPercent}%` }} />
              <div className="absolute h-3 w-3 rounded-full bg-white opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 shadow z-10" style={{ left: `calc(${progressPercent}% - 6px)` }} />
            </div>
            <span className="text-[10px] font-medium text-[#a1a1aa] min-w-[30px] md:min-w-[32px] text-left font-mono hidden sm:block">
              {formatDuration(duration)}
            </span>
          </div>
        </div>

        {/* RIGHT — Volume (desktop only) */}
        <div className="items-center justify-end gap-4 w-[30%] hidden md:flex">
          <button className="text-[#a1a1aa] hover:text-white transition-all duration-200">
            <ListMusic className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 w-28 group">
            <button
              onClick={() => setVolume(volume === 0 ? 0.7 : 0)}
              className="text-[#a1a1aa] hover:text-white transition-all duration-200"
            >
              {volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <div className="h-1 flex-1 relative rounded-full bg-[rgba(255,255,255,0.1)] flex items-center cursor-pointer overflow-hidden">
              <input
                type="range" min="0" max="1" step="0.01" value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div
                className="absolute h-1 rounded-full bg-[#a1a1aa] group-hover:bg-[#2563eb] transition-colors duration-200"
                style={{ width: `${volume * 100}%` }}
              />
            </div>
          </div>
        </div>

      </div>
    </>
  );
}