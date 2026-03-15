'use client';

import { Suspense, useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { Play, Trophy, Sparkles, Compass, Radio, Mic, Search, User } from 'lucide-react';
import { usePlayerStore } from '@/stores/player-store';
import { useSearchParams, useRouter } from 'next/navigation';

function VerifyToast() {
  const searchParams = useSearchParams();
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (searchParams.get('verified') === 'true') {
      setToast('Email verified! Welcome to Sonic 🎵');
      setTimeout(() => setToast(''), 4000);
      
      // Clean URL without reload
      window.history.replaceState({}, '', '/');
    }
  }, [searchParams]);

  if (!toast) return null;

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-6 py-3 rounded-full font-medium text-[14px] shadow-lg animate-fade-in">
      ✓ {toast}
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { user, profile, isAuthenticated } = useAuthStore();
  const playSong = usePlayerStore((s) => s.playSong);

  // Time based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 18) return 'Good afternoon';
    if (hour >= 18 && hour < 23) return 'Good evening';
    return 'Good night';
  };

  const name = isAuthenticated && profile ? profile.full_name?.split(' ')[0] : 'Guest';

  const [trendingSongs, setTrendingSongs] = useState<any[]>([]);
  const [isTrendingLoading, setIsTrendingLoading] = useState(true);

  useEffect(() => {
    fetchTrending();
  }, []);

  const fetchTrending = async () => {
    try {
      const res = await fetch('/api/search?q=top%20hits%202025');
      const data = await res.json();
      if (data.songs) setTrendingSongs(data.songs.slice(0, 10));
    } catch (error) {
      console.error('Failed to fetch trending:', error);
    } finally {
      setIsTrendingLoading(false);
    }
  };

  const quickPicks = [
    { title: 'Top Hits', image: '/images/card-top-hits.jpeg', icon: Trophy },
    { title: 'New Releases', image: '/images/card-new-releases.jpeg', icon: Sparkles },
    { title: 'Discover', image: '/images/card-discover.jpeg', icon: Compass },
    { title: 'Radio', image: '/images/card-radio.jpeg', icon: Radio },
    { title: 'Podcasts', image: '/images/card-podcasts.jpeg', icon: Mic },
  ];

  const popularArtists = [
    { name: "Arijit Singh", initials: "AS", gradient: "linear-gradient(135deg, #1e40af, #3b82f6)" },
    { name: "AR Rahman", initials: "AR", gradient: "linear-gradient(135deg, #065f46, #10b981)" },
    { name: "The Weeknd", initials: "TW", gradient: "linear-gradient(135deg, #4c1d95, #8b5cf6)" },
    { name: "Taylor Swift", initials: "TS", gradient: "linear-gradient(135deg, #831843, #ec4899)" },
    { name: "Diljit Dosanjh", initials: "DD", gradient: "linear-gradient(135deg, #7c2d12, #f97316)" },
    { name: "Shreya Ghoshal", initials: "SG", gradient: "linear-gradient(135deg, #1e3a5f, #0ea5e9)" },
  ];

  return (
    <div className="pb-32 px-4 md:px-6 max-w-[1400px] mx-auto relative">
      
      {/* Mobile Inline Search Bar */}
      <div className="flex md:hidden items-center justify-between pt-4 pb-2">
        <div
          onClick={() => router.push('/search')}
          className="flex-1 flex items-center gap-2 bg-[#141414] rounded-full px-4 py-2.5 mr-3 cursor-pointer border border-[rgba(255,255,255,0.06)]"
        >
          <Search className="w-4 h-4 text-[#52525b]" />
          <span className="text-[#52525b] text-sm">What do you want to play?</span>
        </div>
        {isAuthenticated ? (
          <div
            onClick={() => router.push('/settings')}
            className="w-9 h-9 rounded-full bg-[#2563eb] flex items-center justify-center cursor-pointer flex-shrink-0 shadow-lg"
          >
            <span className="text-white text-sm font-bold">
              {user?.email?.[0]?.toUpperCase() || 'P'}
            </span>
          </div>
        ) : (
          <button
            onClick={() => router.push('/login')}
            className="px-4 py-2 bg-[#2563eb] text-white text-sm font-bold rounded-full flex-shrink-0 shadow-lg"
          >
            Log in
          </button>
        )}
      </div>

      <Suspense fallback={null}>
        <VerifyToast />
      </Suspense>

      {/* Greeting Section */}
      <section className="mb-8">
        <h1 className="text-[28px] font-bold text-white tracking-tight">
          {getGreeting()}, {name}
        </h1>
        <p className="text-[14px] text-[#a1a1aa]">
          What do you want to listen to?
        </p>
      </section>

      {/* SECTION 1: Quick Picks */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[22px] font-bold text-white">Quick Picks</h2>
        <span className="text-[14px] text-[#2563eb] cursor-pointer hover:underline">Show all</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-10">
        {quickPicks.map((card) => (
          <div
            key={card.title}
            className="relative h-[100px] rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:brightness-110"
          >
            <img
              src={card.image}
              alt={card.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to right, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.15) 100%)',
              }}
            />
            <card.icon className="absolute top-3 right-3 w-6 h-6 text-white opacity-70 z-10" />
            <span className="absolute bottom-0 left-0 p-4 text-white font-bold text-[15px] z-10 drop-shadow-lg">
              {card.title}
            </span>
          </div>
        ))}
      </div>

      {/* SECTION 2: Trending Songs */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[22px] font-bold text-white">Trending Now</h2>
        <span className="text-[14px] text-[#2563eb] cursor-pointer hover:underline">Show all</span>
      </div>
      
      {isTrendingLoading ? (
        <div className="flex gap-4 pb-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="flex-shrink-0 w-[160px] animate-pulse">
              <div className="w-[160px] h-[160px] rounded-xl bg-[#141414]" />
              <div className="h-4 bg-[#141414] rounded w-3/4 mt-3" />
              <div className="h-3 bg-[#141414] rounded w-1/2 mt-1" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide mb-10">
          {trendingSongs.map((song) => (
            <div 
              key={song.videoId} 
              className="flex-shrink-0 w-[160px] cursor-pointer group"
              onClick={() => playSong(song, trendingSongs)}
            >
              <div className="relative w-[160px] h-[160px] rounded-xl overflow-hidden bg-[#141414] shadow-lg">
                <img src={song.thumbnail} alt={song.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 bg-black/40">
                  <div className="w-12 h-12 rounded-full bg-[#2563eb] flex items-center justify-center translate-y-2 group-hover:translate-y-0 transition-all duration-200 shadow-xl">
                    <Play className="w-6 h-6 text-white ml-0.5" fill="white" />
                  </div>
                </div>
              </div>
              <p className="text-[14px] font-bold text-white truncate mt-3 group-hover:text-[#2563eb] transition-colors">{song.title}</p>
              <p className="text-[12px] text-[#a1a1aa] truncate mt-1 font-medium">{song.artist}</p>
            </div>
          ))}
        </div>
      )}

      {/* SECTION 3: Popular Artists */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[22px] font-bold text-white">Popular Artists</h2>
        <span className="text-[14px] text-[#2563eb] cursor-pointer hover:underline">Show all</span>
      </div>
      <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide mb-10">
        {popularArtists.map((artist) => (
          <div key={artist.name} className="flex-shrink-0 w-[150px] text-center cursor-pointer group">
            <div className="relative w-[150px] h-[150px] rounded-full overflow-hidden mx-auto transition-transform duration-200 group-hover:scale-105">
              <div className="w-full h-full flex items-center justify-center" style={{ background: artist.gradient }}>
                <span className="text-white text-[28px] font-bold">{artist.initials}</span>
              </div>
            </div>
            <p className="text-[14px] font-medium text-white mt-3 truncate">{artist.name}</p>
            <p className="text-[12px] text-[#a1a1aa] mt-0.5">Artist</p>
          </div>
        ))}
      </div>

      {/* SECTION 4: Recently Played */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[22px] font-bold text-white">Recently Played</h2>
        <span className="text-[14px] text-[#2563eb] cursor-pointer hover:underline">Show all</span>
      </div>

      {!isAuthenticated ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <img src="/images/song-placeholder.jpeg" className="w-16 h-16 rounded-xl opacity-40 mb-4" />
          <p className="text-[15px] font-medium text-white mb-1">Sign in to see your history</p>
          <p className="text-[13px] text-[#a1a1aa] mb-4">Songs you play will appear here</p>
          <a href="/login" className="px-5 py-2 rounded-full bg-[#2563eb] text-white text-[14px] font-semibold hover:bg-[#1d4ed8] transition-colors duration-200">
            Sign in
          </a>
        </div>
      ) : (
        <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide mb-10">
           {/* Recently played items would map here */}
           <p className="text-[#52525b] text-sm">No recent music to show.</p>
        </div>
      )}
    </div>
  );
}
