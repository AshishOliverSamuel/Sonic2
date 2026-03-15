import { create } from 'zustand';

export interface Song {
  videoId: string
  title: string
  artist: string
  thumbnail: string
  duration: number
}

export type RepeatMode = 'off' | 'all' | 'one';

interface PlayerStore {
  currentSong: Song | null;
  queue: Song[];
  queueIndex: number;
  isPlaying: boolean;
  volume: number;
  progress: number;
  duration: number;
  repeat: RepeatMode;
  shuffle: boolean;
  seekTo: number | undefined;

  playSong: (song: Song, queue?: Song[]) => Promise<void>;
  pause: () => void;
  resume: () => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;

  setVolume: (volume: number) => void;
  setProgress: (progress: number) => void;
  setDuration: (duration: number) => void;
  seek: (time: number) => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;

  addToQueue: (song: Song) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  setQueue: (songs: Song[], startIndex?: number) => void;
}

function getShuffledIndex(currentIndex: number, length: number): number {
  if (length <= 1) return 0;
  let next: number;
  do { next = Math.floor(Math.random() * length); } while (next === currentIndex);
  return next;
}

// ─── Media Session API ────────────────────────────────────────────────────────
// Sets lock screen / notification controls on Android Chrome + desktop browsers.

function updateMediaSession(song: Song, isPlaying: boolean) {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title: song.title,
    artist: song.artist,
    album: 'Sonic',
    artwork: song.thumbnail ? [
      { src: song.thumbnail, sizes: '256x256', type: 'image/jpeg' },
      { src: song.thumbnail, sizes: '512x512', type: 'image/jpeg' },
    ] : [],
  });

  navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
}

function registerMediaSessionHandlers() {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

  const store = usePlayerStore.getState;

  navigator.mediaSession.setActionHandler('play', () => {
    store().resume();
  });

  navigator.mediaSession.setActionHandler('pause', () => {
    store().pause();
  });

  navigator.mediaSession.setActionHandler('nexttrack', () => {
    store().next();
  });

  navigator.mediaSession.setActionHandler('previoustrack', () => {
    store().prev();
  });

  navigator.mediaSession.setActionHandler('seekto', (details) => {
    if (details.seekTime != null) store().seek(details.seekTime);
  });

  navigator.mediaSession.setActionHandler('seekbackward', (details) => {
    const { progress } = store();
    store().seek(Math.max(0, progress - (details.seekOffset ?? 10)));
  });

  navigator.mediaSession.setActionHandler('seekforward', (details) => {
    const { progress, duration } = store();
    store().seek(Math.min(duration, progress + (details.seekOffset ?? 10)));
  });
}

// Register handlers once on module load
if (typeof window !== 'undefined') {
  // Delay slightly to ensure store is initialized
  setTimeout(registerMediaSessionHandlers, 0);
}
// ─────────────────────────────────────────────────────────────────────────────

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  currentSong: null,
  queue: [],
  queueIndex: -1,
  isPlaying: false,
  volume: 0.7,
  progress: 0,
  duration: 0,
  repeat: 'off',
  shuffle: false,
  seekTo: undefined,

  playSong: async (song, queue) => {
    if (!song?.videoId) return;

    if (queue) {
      const index = queue.findIndex((s) => s.videoId === song.videoId);
      set({ queue, queueIndex: index >= 0 ? index : 0 });
    }

    set({
      currentSong: song,
      isPlaying: true,
      progress: 0,
      duration: song.duration || 0,
      seekTo: undefined,
    });

    // Update lock screen metadata
    updateMediaSession(song, true);
  },

  pause: () => {
    set({ isPlaying: false });
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
  },

  resume: () => {
    set({ isPlaying: true });
    const { currentSong } = get();
    if (currentSong) updateMediaSession(currentSong, true);
  },

  togglePlay: () => {
    const { isPlaying, currentSong } = get();
    const next = !isPlaying;
    set({ isPlaying: next });
    if (currentSong) updateMediaSession(currentSong, next);
  },

  next: () => {
    const { queue, queueIndex, repeat, shuffle } = get();
    if (!queue.length) return;

    let nextIndex: number;
    if (repeat === 'one') {
      nextIndex = queueIndex;
    } else if (shuffle) {
      nextIndex = getShuffledIndex(queueIndex, queue.length);
    } else {
      nextIndex = queueIndex + 1;
      if (nextIndex >= queue.length) {
        if (repeat === 'all') nextIndex = 0;
        else return;
      }
    }

    set({ queueIndex: nextIndex });
    get().playSong(queue[nextIndex]);
  },

  prev: () => {
    const { queue, queueIndex, progress, repeat } = get();
    if (!queue.length) return;

    if (progress > 3) {
      set({ progress: 0, seekTo: 0 });
      return;
    }

    let prevIndex = queueIndex - 1;
    if (prevIndex < 0) {
      prevIndex = repeat === 'all' ? queue.length - 1 : 0;
    }

    set({ queueIndex: prevIndex });
    get().playSong(queue[prevIndex]);
  },

  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),

  setProgress: (progress) => {
    set({ progress });
    // Update media session position state for seek bar on lock screen
    const { duration, isPlaying } = get();
    if ('mediaSession' in navigator && duration > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration,
          playbackRate: 1,
          position: progress,
        });
      } catch (_) { }
    }
  },

  setDuration: (duration) => set({ duration }),

  seek: (time) => {
    set({ progress: time, seekTo: time });
    const { duration } = get();
    if ('mediaSession' in navigator && duration > 0) {
      try {
        navigator.mediaSession.setPositionState({ duration, playbackRate: 1, position: time });
      } catch (_) { }
    }
  },

  toggleRepeat: () =>
    set((s) => ({
      repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off',
    })),

  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),

  addToQueue: (song) => set((s) => ({ queue: [...s.queue, song] })),

  removeFromQueue: (index) =>
    set((s) => ({
      queue: s.queue.filter((_, i) => i !== index),
      queueIndex: index < s.queueIndex ? s.queueIndex - 1 : s.queueIndex,
    })),

  clearQueue: () => set({ queue: [], queueIndex: -1 }),

  setQueue: (songs, startIndex = 0) => set({ queue: songs, queueIndex: startIndex }),
}));