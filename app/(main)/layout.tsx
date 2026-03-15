'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { MobileNav } from '@/components/layout/mobile-nav';
import { Player } from '@/components/player/player';
import { useUIStore } from '@/stores/ui-store';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { setMobile } = useUIStore();
  const pathname = usePathname();
  const isHome = pathname === '/';

  // Responsive detection
  useEffect(() => {
    const checkMobile = () => {
      setMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [setMobile]);

  return (
    <div className="min-h-screen bg-black">
      <Sidebar />

      <main className="md:ml-[256px] pb-[160px] md:pb-[88px] min-h-screen overflow-y-auto">
        <div className={isHome ? 'hidden md:block' : 'block'}>
          <Header />
        </div>
        <div className={isHome ? 'pt-0' : 'pt-[64px]'}>
          {children}
        </div>
      </main>

      <MobileNav />
      <Player />
    </div>
  );
}
