import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { AuthProvider } from '@/components/providers/auth-provider';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Sonic — Stream Music Free',
    template: '%s | Sonic',
  },
  description:
    'Stream millions of songs for free. Discover music, create playlists, and enjoy high-quality audio streaming with Sonic.',
  keywords: ['music', 'streaming', 'free', 'songs', 'playlists', 'sonic'],
  openGraph: {
    title: 'Sonic — Stream Music Free',
    description: 'Stream millions of songs for free.',
    type: 'website',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Sonic',
  },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`}>
        <ThemeProvider>
          <AuthProvider>
            {children}
            <script dangerouslySetInnerHTML={{
              __html: `
                if ('serviceWorker' in navigator) {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js')
                      .then(function(reg) { console.log('SW registered'); })
                      .catch(function(err) { console.log('SW failed:', err); });
                  });
                }
              `
            }} />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
