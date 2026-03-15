import { NextRequest, NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/cache'

const INNERTUBE_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8'
const INNERTUBE_CLIENT = {
  clientName: 'ANDROID_MUSIC',
  clientVersion: '6.21.52',
  androidSdkVersion: 30,
  userAgent: 'com.google.android.apps.youtube.music/6.21.52 (Linux; U; Android 11) gzip',
}

async function getYTMusicStream(videoId: string) {
  try {
    const res = await fetch(
      `https://music.youtube.com/youtubei/v1/player?key=${INNERTUBE_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': INNERTUBE_CLIENT.userAgent,
          'X-Goog-Api-Format-Version': '1',
        },
        body: JSON.stringify({
          videoId,
          context: {
            client: {
              clientName: INNERTUBE_CLIENT.clientName,
              clientVersion: INNERTUBE_CLIENT.clientVersion,
              androidSdkVersion: INNERTUBE_CLIENT.androidSdkVersion,
            },
          },
        }),
      }
    )

    if (!res.ok) return null
    const data = await res.json()

    // Get audio-only formats, sorted by quality
    const formats: any[] = data?.streamingData?.adaptiveFormats || []
    const audioFormats = formats
      .filter((f: any) => f.mimeType?.startsWith('audio/') && f.url)
      .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))

    if (!audioFormats.length) return null

    const best = audioFormats[0]
    const videoDetails = data?.videoDetails

    console.log(`[Stream] ✓ YTMusic: ${videoDetails?.title}`)

    return {
      streamUrl: best.url,
      duration: parseInt(videoDetails?.lengthSeconds || '0'),
      title: videoDetails?.title || '',
      uploader: videoDetails?.author || '',
      thumbnailUrl: videoDetails?.thumbnail?.thumbnails?.slice(-1)[0]?.url || '',
    }
  } catch (e: any) {
    console.error('[Stream] YTMusic error:', e?.message)
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params
  if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 })

  const cacheKey = `stream:ytm:${videoId}`
  const cached = getCache(cacheKey)
  if (cached) return NextResponse.json(cached)

  const result = await getYTMusicStream(videoId)

  if (!result) {
    return NextResponse.json({ error: 'Song not found' }, { status: 404 })
  }

  setCache(cacheKey, result, 2 * 60 * 60 * 1000) // 2hr cache (URLs expire)
  return NextResponse.json(result)
}