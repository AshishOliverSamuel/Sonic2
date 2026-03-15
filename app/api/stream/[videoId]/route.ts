import { NextRequest, NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/cache'

// ─── Invidious instances (fallback list) ──────────────────────────────────────
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://yewtu.be',
  'https://invidious.nerdvpn.de',
]

// ─── Clean strings for comparison ─────────────────────────────────────────────
function cleanString(str: string): string {
  return str
    .toLowerCase()
    .replace(/\(official\s*(audio|video|lyric\s*video|music\s*video|hd|4k)?\)/gi, '')
    .replace(/\[official\s*(audio|video|lyric\s*video|music\s*video|hd|4k)?\]/gi, '')
    .replace(/\(lyrics?\)/gi, '')
    .replace(/\[lyrics?\]/gi, '')
    .replace(/\(ft\.?.*?\)/gi, '')
    .replace(/\(feat\.?.*?\)/gi, '')
    .replace(/vevo/gi, '')
    .replace(/\s*-\s*topic$/gi, '')
    .replace(/\(audio\)/gi, '')
    .replace(/\[audio\]/gi, '')
    .replace(/\|.*$/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Score JioSaavn result ─────────────────────────────────────────────────────
function scoreSong(result: any, cleanTitle: string, cleanArtist: string): number {
  const resultTitle = cleanString(result.name || '')
  const resultArtists = [
    ...(result.artists?.primary || []),
    ...(result.artists?.featured || []),
  ].map((a: any) => cleanString(a.name || '')).join(' ')

  let score = 0

  if (resultTitle === cleanTitle) score += 100
  else if (resultTitle.includes(cleanTitle)) score += 60
  else if (cleanTitle.includes(resultTitle)) score += 40

  if (cleanArtist) {
    const artistWords = cleanArtist.split(' ').filter(Boolean)
    const matchedWords = artistWords.filter(w => resultArtists.includes(w))
    score += (matchedWords.length / artistWords.length) * 50
  }

  if (result.language === 'hindi') score += 15
  if (result.language === 'english') score += 10

  return score
}

// ─── JioSaavn stream ──────────────────────────────────────────────────────────
async function getSaavnStream(title: string, artist: string) {
  try {
    const cleanTitle = cleanString(title)
    const cleanArtist = cleanString(artist)

    const queries = [
      `${title} ${artist}`,
      `${cleanTitle} ${cleanArtist}`,
      title,
    ]

    let bestSong: any = null
    let bestScore = -1

    for (const query of queries) {
      const res = await fetch(
        `https://saavn.prakhar123srivastava.workers.dev/api/search/songs?query=${encodeURIComponent(query)}&limit=5`,
        { headers: { 'Accept': 'application/json' } }
      )
      if (!res.ok) continue
      const data = await res.json()
      const results: any[] = data?.data?.results || []

      for (const result of results) {
        const score = scoreSong(result, cleanTitle, cleanArtist)
        if (score > bestScore) {
          bestScore = score
          bestSong = result
        }
      }

      if (bestScore >= 100) break
    }

    // Only use JioSaavn result if score is good enough
    if (!bestSong || bestScore < 40) return null

    const urls: any[] = bestSong.downloadUrl || []
    const best = urls.sort((a, b) => {
      const order: Record<string, number> = { '320kbps': 4, '160kbps': 3, '96kbps': 2, '48kbps': 1 }
      return (order[b.quality] || 0) - (order[a.quality] || 0)
    })[0]

    if (!best?.url) return null

    console.log(`[Stream] ✓ JioSaavn: ${bestSong.name} (score: ${bestScore})`)
    return {
      streamUrl: best.url,
      duration: bestSong.duration || 0,
      title: bestSong.name || '',
      uploader: bestSong.artists?.primary?.[0]?.name || '',
      thumbnailUrl: bestSong.image?.[2]?.url || bestSong.image?.[1]?.url || '',
    }
  } catch (e: any) {
    console.error('[Stream] JioSaavn error:', e?.message)
    return null
  }
}

// ─── Invidious stream (YouTube fallback) ──────────────────────────────────────
async function getInvidiousStream(videoId: string) {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      console.log(`[Stream] Trying Invidious: ${instance}`)
      const res = await fetch(
        `${instance}/api/v1/videos/${videoId}?fields=adaptiveFormats,formatStreams`,
        { headers: { 'Accept': 'application/json' } }
      )
      if (!res.ok) continue
      const data = await res.json()

      // Try adaptive formats first (audio only, better quality)
      const audioFormats = (data.adaptiveFormats || [])
        .filter((f: any) => f.type?.startsWith('audio/') && f.url)
        .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))

      if (audioFormats.length > 0) {
        console.log(`[Stream] ✓ Invidious audio: ${instance}`)
        return { streamUrl: audioFormats[0].url, duration: audioFormats[0].contentLength || 0 }
      }

      // Fallback to regular format streams
      const formatStreams = (data.formatStreams || [])
        .filter((f: any) => f.url)

      if (formatStreams.length > 0) {
        console.log(`[Stream] ✓ Invidious format: ${instance}`)
        return { streamUrl: formatStreams[0].url, duration: 0 }
      }
    } catch (e: any) {
      console.error(`[Stream] Invidious ${instance} failed:`, e?.message)
      continue
    }
  }
  return null
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params
  if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 })

  const title = request.nextUrl.searchParams.get('title') || ''
  const artist = request.nextUrl.searchParams.get('artist') || ''

  if (!title) return NextResponse.json({ error: 'title param required' }, { status: 400 })

  const cacheKey = `stream:v2:${videoId}`
  const cached = getCache(cacheKey)
  if (cached) return NextResponse.json(cached)

  console.log(`[Stream] Looking up: ${title} - ${artist}`)

  // Step 1 — Try JioSaavn (great for Hindi, decent for English)
  const saavnResult = await getSaavnStream(title, artist)
  if (saavnResult) {
    setCache(cacheKey, saavnResult, 6 * 60 * 60 * 1000)
    return NextResponse.json(saavnResult)
  }

  // Step 2 — Fallback to Invidious (YouTube audio)
  console.log(`[Stream] JioSaavn failed, trying Invidious for videoId: ${videoId}`)
  const invidiousResult = await getInvidiousStream(videoId)
  if (invidiousResult) {
    setCache(cacheKey, invidiousResult, 1 * 60 * 60 * 1000) // shorter cache for Invidious URLs
    return NextResponse.json(invidiousResult)
  }

  console.error(`[Stream] All sources failed for: ${title} - ${artist}`)
  return NextResponse.json({ error: 'Song not found' }, { status: 404 })
}