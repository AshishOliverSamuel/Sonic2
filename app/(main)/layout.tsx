'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { MobileNav } from '@/components/layout/mobile-nav';
import { Player } from '@/components/player/player';
import { useUIStore } from '@/stores/ui-store';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { setMobile } = useUIStore();
  const pathname = usePathname();

  useEffect(() => {
    const checkMobile = () => setMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [setMobile]);

  // Set data-page on body so CSS can target it — no className changes, no hydration issues
  useEffect(() => {
    document.body.setAttribute('data-page', pathname === '/' ? 'home' : 'other');
  }, [pathname]);

  return (
    <div className="min-h-screen bg-black">
      <Sidebar />
      <main
        className="md:ml-[256px] pb-[160px] md:pb-[88px] min-h-screen overflow-y-auto"
        suppressHydrationWarning
      >
        <Header />
        <div className="pt-[64px]">
          {children}
        </div>
      </main>
      <MobileNav />
      <Player />
    </div>
  );
}