import { Capacitor, registerPlugin } from '@capacitor/core'

const YouTubeMusic = registerPlugin('YouTubeMusic')

export async function getNativeStreamUrl(videoId: string): Promise<string | null> {
    if (!Capacitor.isNativePlatform()) return null
    try {
        const res = await fetch(`https://sonic-amber-three.vercel.app/api/stream/${videoId}`)
        console.log('Stream fetch status:', res.status)
        const data = await res.json()
        console.log('Stream data:', JSON.stringify(data).substring(0, 100))
        return data.streamUrl ?? null
    } catch (e) {
        console.error('Stream URL fetch error:', e)
        return null
    }
}

export async function nativeLoadAndPlay(params: {
    streamUrl: string
    title: string
    artist: string
    thumbnail: string
}): Promise<void> {
    if (!Capacitor.isNativePlatform()) return
    await (YouTubeMusic as any).loadAndPlay(params)
}

export async function nativePlay(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return
    await (YouTubeMusic as any).play()
}

export async function nativePause(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return
    await (YouTubeMusic as any).pause()
}

export async function nativeSeekTo(positionSeconds: number): Promise<void> {
    if (!Capacitor.isNativePlatform()) return
    await (YouTubeMusic as any).seekTo({ position: positionSeconds })
}

export async function nativeGetPlaybackState(): Promise<{
    isPlaying: boolean
    position: number
    duration: number
} | null> {
    if (!Capacitor.isNativePlatform()) return null
    try {
        return await (YouTubeMusic as any).getPlaybackState()
    } catch {
        return null
    }
}

type ProgressListener = (position: number, duration: number) => void
type ReadyListener = (duration: number) => void
type SimpleListener = () => void

export function addNativeProgressListener(cb: ProgressListener) {
    if (!Capacitor.isNativePlatform()) return
    ;(YouTubeMusic as any).addListener('progressUpdate', (data: { position: number; duration: number }) => {
        cb(data.position, data.duration)
    })
}

export function addNativeReadyListener(cb: ReadyListener) {
    if (!Capacitor.isNativePlatform()) return
    ;(YouTubeMusic as any).addListener('playerReady', (data: { duration: number }) => {
        cb(data.duration)
    })
}

export function addNativeCompletionListener(cb: SimpleListener) {
    if (!Capacitor.isNativePlatform()) return
    ;(YouTubeMusic as any).addListener('playbackCompleted', cb)
}

export function addNativeErrorListener(cb: SimpleListener) {
    if (!Capacitor.isNativePlatform()) return
    ;(YouTubeMusic as any).addListener('playbackError', cb)
}

export function removeAllNativeListeners() {
    if (!Capacitor.isNativePlatform()) return
    ;(YouTubeMusic as any).removeAllListeners()
}
