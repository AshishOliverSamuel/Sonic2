import { NextRequest, NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/cache'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params
  if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 })

  const cacheKey = `stream:yt:${videoId}`
  const cached = getCache(cacheKey)
  if (cached) return NextResponse.json(cached)

  try {
    const body = {
      videoId,
      context: {
        client: {
          clientName: 'ANDROID',
          clientVersion: '19.29.37',
          androidSdkVersion: 34,
          hl: 'en',
          gl: 'US',
          utcOffsetMinutes: 0,
        }
      }
    }

    const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.android.youtube/19.29.37 (Linux; U; Android 14) gzip',
        'X-YouTube-Client-Name': '3',
        'X-YouTube-Client-Version': '19.29.37',
        'Origin': 'https://www.youtube.com',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) return NextResponse.json({ error: 'YouTube API failed' }, { status: 500 })

    const data = await res.json()
    const status = data?.playabilityStatus?.status
    if (status !== 'OK') return NextResponse.json({ error: `Not playable: ${status}` }, { status: 404 })

    const formats: any[] = data?.streamingData?.adaptiveFormats || data?.streamingData?.formats || []
    const audioFormats = formats.filter(f => f.mimeType?.startsWith('audio/') && f.url)
    const best = audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0]

    if (!best?.url) return NextResponse.json({ error: 'No audio stream found' }, { status: 404 })

    const result = {
      streamUrl: best.url,
      duration: data?.videoDetails?.lengthSeconds ? parseInt(data.videoDetails.lengthSeconds) : 0,
      title: data?.videoDetails?.title || '',
      thumbnail: data?.videoDetails?.thumbnail?.thumbnails?.pop()?.url || '',
    }

    setCache(cacheKey, result, 60 * 60 * 1000)
    return NextResponse.json(result)

  } catch (e: any) {
    console.error('[Stream] Error:', e?.message)
    return NextResponse.json({ error: 'Failed to get stream' }, { status: 500 })
  }
}
