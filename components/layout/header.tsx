'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Bell, User, Search, Settings, LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useState } from 'react';
import Link from 'next/link';

export function Header() {
  const router = useRouter();
  const { user, profile, isAuthenticated, signOut } = useAuthStore();
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <header className="h-[64px] fixed top-0 right-0 left-0 md:left-[256px] z-30 bg-[rgba(0,0,0,0.8)] backdrop-blur-xl border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between px-4 md:px-6 transition-all duration-200">
      
      {/* Back/Forward Nav */}
      <div className="flex items-center gap-2">
        <button 
          onClick={() => router.back()}
          className="w-8 h-8 rounded-full bg-[#141414] flex items-center justify-center text-[#a1a1aa] hover:text-white hover:bg-[#222222] transition-all duration-200"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button 
          onClick={() => router.forward()}
          className="w-8 h-8 rounded-full bg-[#141414] flex items-center justify-center text-[#a1a1aa] hover:text-white hover:bg-[#222222] transition-all duration-200"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Centered Search Bar */}
      <div className="relative flex-1 max-w-[360px] mx-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a1a1aa]" />
        <input
          type="text"
          placeholder="What do you want to play?"
          className="w-full h-[40px] bg-[#1a1a1a] rounded-full border border-[rgba(255,255,255,0.08)] focus:border-[#2563eb] focus:outline-none pl-10 pr-4 text-[14px] text-white placeholder:text-[#52525b] transition-colors duration-200"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const val = e.currentTarget.value.trim()
              if (val) router.push(`/search?q=${encodeURIComponent(val)}`)
            }
          }}
        />
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-4">
        {isAuthenticated ? (
          <>
            <button className="w-10 h-10 rounded-full flex items-center justify-center text-[#a1a1aa] hover:text-white hover:bg-[#222222] transition-all duration-200 relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#2563eb] border border-black"></span>
            </button>
            
            <div className="relative">
              <div 
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-[34px] h-[34px] rounded-full bg-[#2563eb] overflow-hidden cursor-pointer border border-[rgba(255,255,255,0.06)] hover:border-[#a1a1aa] transition-all duration-200"
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="User" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm">
                    {profile?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || <User className="w-4 h-4" />}
                  </div>
                )}
              </div>

              {/* Dropdown Menu */}
              {showDropdown && (
                <>
                  <div 
                    className="fixed inset-0 z-40"
                    onClick={() => setShowDropdown(false)}
                  />
                  <div className="absolute top-12 right-0 w-48 bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-xl py-2 shadow-2xl z-50">
                    <div className="px-4 py-2 border-b border-[rgba(255,255,255,0.06)] mb-1">
                      <p className="text-sm font-bold text-white truncate">{profile?.full_name || 'User'}</p>
                      <p className="text-[10px] text-[#52525b] truncate">{user?.email}</p>
                    </div>
                    
                    <Link 
                      href="/settings"
                      onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#a1a1aa] hover:bg-[#222222] hover:text-white transition-colors"
                    >
                      <User className="w-4 h-4" /> Profile
                    </Link>

                    <Link 
                      href="/settings"
                      onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#a1a1aa] hover:bg-[#222222] hover:text-white transition-colors"
                    >
                      <Settings className="w-4 h-4" /> Settings
                    </Link>
                    
                    <div className="h-px bg-[rgba(255,255,255,0.06)] my-1" />

                    <button 
                      onClick={() => {
                        signOut();
                        setShowDropdown(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#a1a1aa] hover:bg-[#222222] hover:text-white transition-colors"
                    >
                      <LogOut className="w-4 h-4" /> Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <button 
            onClick={() => router.push('/login')}
            className="bg-[#2563eb] text-white rounded-full px-5 py-2 font-semibold hover:bg-[#1d4ed8] transition-all duration-200 text-sm"
          >
            Log in
          </button>
        )}
      </div>

    </header>
  );
}
