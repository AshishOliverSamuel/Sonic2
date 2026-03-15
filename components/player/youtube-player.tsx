'use client'
import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import {
  getNativeStreamUrl,
  nativeLoadAndPlay,
  nativePlay,
  nativePause,
  nativeSeekTo,
  addNativeProgressListener,
  addNativeCompletionListener,
  addNativeErrorListener,
  removeAllNativeListeners,
} from '@/lib/youtube-music-native'

interface Props {
  videoId: string
  isPlaying: boolean
  volume: number
  onReady: (duration: number) => void
  onProgress: (time: number) => void
  onEnded: () => void
  onError: () => void
  seekTo?: number
  title?: string       // â† add
  artist?: string      // â† add
  thumbnail?: string   // â† add
}

declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
  }
}

// â”€â”€â”€ Native Android Player â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Audio lives entirely in MediaPlaybackService (background-safe).
// This component just sends commands and listens to events.

function NativePlayer({
  videoId, isPlaying, volume,
  onReady, onProgress, onEnded, onError, seekTo,
  title, artist, thumbnail
}: Props) {
  const loadedId = useRef('')
  const durationRef = useRef(0)

  // Load new song whenever videoId changes
  useEffect(() => {
    if (!videoId || videoId.length !== 11) return
    if (loadedId.current === videoId) return
    loadedId.current = videoId

    const load = async () => {
      try {
        const streamUrl = await getNativeStreamUrl(videoId)
        if (!streamUrl) { onError(); return }
        await nativeLoadAndPlay({
          streamUrl,
          title: title ?? '',
          artist: artist ?? '',
          thumbnail: thumbnail ?? '',
        })
      } catch {
        onError()
      }
    }
    load()
  }, [videoId])

  // Register event listeners from the native service
  useEffect(() => {
    addNativeProgressListener((position, duration) => {
      if (durationRef.current === 0 && duration > 0) {
        durationRef.current = duration
        onReady(duration)
      }
      onProgress(position)
    })
    addNativeCompletionListener(onEnded)
    addNativeErrorListener(onError)

    return () => { removeAllNativeListeners() }
  }, [])

  // Play / Pause
  useEffect(() => {
    if (isPlaying) nativePlay().catch(() => { })
    else nativePause().catch(() => { })
  }, [isPlaying])

  // Seek
  useEffect(() => {
    if (seekTo !== undefined) nativeSeekTo(seekTo).catch(() => { })
  }, [seekTo])

  // Volume â€” native MediaPlayer uses system volume; nothing to do here
  // but you could add a nativeSetVolume() method later if needed

  return null // No DOM element needed â€” service owns the audio
}

// â”€â”€â”€ Web YouTube IFrame Player (unchanged) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function WebPlayer({
  videoId, isPlaying, volume,
  onReady, onProgress, onEnded, onError, seekTo
}: Props) {
  const playerRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const readyRef = useRef(false)

  useEffect(() => {
    if (!document.getElementById('yt-iframe-api')) {
      const tag = document.createElement('script')
      tag.id = 'yt-iframe-api'
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    }
  }, [])

  useEffect(() => {
    if (!videoId || videoId.length !== 11) return
    readyRef.current = false
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }

    const create = () => {
      if (!containerRef.current || !window.YT?.Player) return
      if (playerRef.current) playerRef.current.destroy()

      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: {
          autoplay: 1, controls: 0, disablekb: 1,
          fs: 0, iv_load_policy: 3, modestbranding: 1,
          rel: 0, playsinline: 1,
        },
        events: {
          onReady: (e: any) => {
            readyRef.current = true
            e.target.setVolume(volume * 100)
            onReady(e.target.getDuration())
            if (isPlaying) e.target.playVideo()
          },
          onStateChange: (e: any) => {
            const YT = window.YT.PlayerState
            if (e.data === YT.PLAYING) {
              if (intervalRef.current) clearInterval(intervalRef.current)
              intervalRef.current = setInterval(() => {
                onProgress(playerRef.current?.getCurrentTime?.() || 0)
              }, 500)
            } else {
              if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
            }
            if (e.data === YT.ENDED) onEnded()
          },
          onError: () => onError(),
        },
      })
    }

    if (window.YT?.Player) create()
    else window.onYouTubeIframeAPIReady = create

    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [videoId])

  useEffect(() => {
    if (!readyRef.current || !playerRef.current) return
    isPlaying ? playerRef.current.playVideo() : playerRef.current.pauseVideo()
  }, [isPlaying])

  useEffect(() => { playerRef.current?.setVolume?.(volume * 100) }, [volume])

  useEffect(() => {
    if (seekTo !== undefined && readyRef.current) {
      playerRef.current?.seekTo?.(seekTo, true)
    }
  }, [seekTo])

  return (
    <div style={{ position: 'fixed', left: '-9999px', bottom: '-9999px', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }}>
      <div ref={containerRef} />
    </div>
  )
}

// â”€â”€â”€ Main Export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function YouTubePlayer(props: Props) {
  if (Capacitor.isNativePlatform()) {
    return <NativePlayer {...props} />
  }
  return <WebPlayer {...props} />
}
