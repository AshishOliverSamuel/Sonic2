import { NextRequest, NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/cache'

function cleanQuery(title: string, artist: string): string {
  const junk = [
    /\(official\s*(audio|video|lyric\s*video|music\s*video|hd|4k)?\)/gi,
    /\[official\s*(audio|video|lyric\s*video|music\s*video|hd|4k)?\]/gi,
    /\(lyrics?\)/gi,
    /\[lyrics?\]/gi,
    /\(ft\.?.*?\)/gi,
    /\(feat\.?.*?\)/gi,
    /vevo/gi,
    /\s*-\s*topic$/gi,
    /\(audio\)/gi,
    /\[audio\]/gi,
    /\(hd\)/gi,
    /\(4k\)/gi,
    /\|.*$/g, // remove everything after a pipe character
  ]

  let cleanTitle = title
  let cleanArtist = artist

  for (const pattern of junk) {
    cleanTitle = cleanTitle.replace(pattern, '')
    cleanArtist = cleanArtist.replace(pattern, '')
  }

  cleanTitle = cleanTitle.trim()
  cleanArtist = cleanArtist.replace(/\s*-\s*Topic$/i, '').trim()

  // If artist ends with VEVO, extract real artist name
  cleanArtist = cleanArtist.replace(/VEVO$/i, '').trim()

  return `${cleanTitle} ${cleanArtist}`.trim()
}

async function getSaavnStream(title: string, artist: string) {
  try {
    const query = cleanQuery(title, artist)
    console.log(`[Stream] JioSaavn cleaned query: "${query}"`)

    const searchRes = await fetch(
      `https://saavn.prakhar123srivastava.workers.dev/api/search/songs?query=${encodeURIComponent(query)}&limit=3`,
      { headers: { 'Accept': 'application/json' } }
    )
    if (!searchRes.ok) return null
    const searchData = await searchRes.json()

    const song = searchData?.data?.results?.[0]
    if (!song) return null

    const urls: any[] = song.downloadUrl || []
    const best = urls.sort((a, b) => {
      const order: Record<string, number> = {
        '320kbps': 4, '160kbps': 3, '96kbps': 2, '48kbps': 1
      }
      return (order[b.quality] || 0) - (order[a.quality] || 0)
    })[0]

    if (!best?.url) return null

    return {
      streamUrl: best.url,
      duration: song.duration || 0,
      title: song.name || '',
      uploader: song.artists?.primary?.[0]?.name || '',
      thumbnailUrl: song.image?.[2]?.url || song.image?.[1]?.url || '',
    }
  } catch (e: any) {
    console.error('[Stream] JioSaavn error:', e?.message)
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params
  if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 })

  // Get song title from query param (frontend should pass it)
  const title = request.nextUrl.searchParams.get('title') || ''
  const artist = request.nextUrl.searchParams.get('artist') || ''

  if (!title) {
    return NextResponse.json({ error: 'title param required' }, { status: 400 })
  }

  const cacheKey = `stream:saavn:${videoId}`
  const cached = getCache(cacheKey)
  if (cached) return NextResponse.json(cached)

  console.log(`[Stream] Searching JioSaavn for: ${title} ${artist}`)

  const result = await getSaavnStream(title, artist)

  if (!result) {
    console.error(`[Stream] JioSaavn: no result for "${title} ${artist}"`)
    return NextResponse.json({ error: 'Song not found' }, { status: 404 })
  }

  console.log(`[Stream] ✓ Found: ${result.title} | ${result.streamUrl.substring(0, 60)}...`)

  setCache(cacheKey, result, 6 * 60 * 60 * 1000)
  return NextResponse.json(result)
}
