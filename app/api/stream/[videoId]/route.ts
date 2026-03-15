import { NextRequest, NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/cache'

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
    .replace(/\(hd\)/gi, '')
    .replace(/\(4k\)/gi, '')
    .replace(/\|.*$/g, '')
    .replace(/[^a-z0-9\s]/g, '') // remove special chars for comparison
    .replace(/\s+/g, ' ')
    .trim()
}

function scoreSong(result: any, cleanTitle: string, cleanArtist: string): number {
  const resultTitle = cleanString(result.name || '')
  const resultArtists = [
    ...(result.artists?.primary || []),
    ...(result.artists?.featured || []),
  ].map((a: any) => cleanString(a.name || '')).join(' ')

  let score = 0

  // Title match — most important
  if (resultTitle === cleanTitle) score += 100
  else if (resultTitle.includes(cleanTitle)) score += 60
  else if (cleanTitle.includes(resultTitle)) score += 40

  // Artist match
  if (cleanArtist) {
    const artistWords = cleanArtist.split(' ').filter(Boolean)
    const matchedWords = artistWords.filter(w => resultArtists.includes(w))
    score += (matchedWords.length / artistWords.length) * 50
  }

  // Language boost for english songs
  if (result.language === 'english') score += 10

  return score
}

async function getSaavnStream(title: string, artist: string) {
  try {
    const cleanTitle = cleanString(title)
    const cleanArtist = cleanString(artist)

    // Try multiple queries for better results
    const queries = [
      `${title} ${artist}`,           // original
      `${cleanTitle} ${cleanArtist}`, // cleaned
      `${title}`,                      // title only
    ].filter(Boolean)

    let bestSong: any = null
    let bestScore = -1

    for (const query of queries) {
      console.log(`[Stream] Trying query: "${query}"`)

      const searchRes = await fetch(
        `https://saavn.prakhar123srivastava.workers.dev/api/search/songs?query=${encodeURIComponent(query)}&limit=5`,
        { headers: { 'Accept': 'application/json' } }
      )
      if (!searchRes.ok) continue
      const searchData = await searchRes.json()
      const results: any[] = searchData?.data?.results || []

      for (const result of results) {
        const score = scoreSong(result, cleanTitle, cleanArtist)
        console.log(`[Stream] Score ${score} for: ${result.name}`)
        if (score > bestScore) {
          bestScore = score
          bestSong = result
        }
      }

      // If we found a great match, stop searching
      if (bestScore >= 100) break
    }

    if (!bestSong) return null

    const urls: any[] = bestSong.downloadUrl || []
    const best = urls.sort((a, b) => {
      const order: Record<string, number> = {
        '320kbps': 4, '160kbps': 3, '96kbps': 2, '48kbps': 1
      }
      return (order[b.quality] || 0) - (order[a.quality] || 0)
    })[0]

    if (!best?.url) return null

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params
  if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 })

  const title = request.nextUrl.searchParams.get('title') || ''
  const artist = request.nextUrl.searchParams.get('artist') || ''

  if (!title) {
    return NextResponse.json({ error: 'title param required' }, { status: 400 })
  }

  const cacheKey = `stream:saavn:${videoId}`
  const cached = getCache(cacheKey)
  if (cached) return NextResponse.json(cached)

  console.log(`[Stream] Searching for: ${title} - ${artist}`)

  const result = await getSaavnStream(title, artist)

  if (!result) {
    console.error(`[Stream] No result for "${title} ${artist}"`)
    return NextResponse.json({ error: 'Song not found' }, { status: 404 })
  }

  console.log(`[Stream] ✓ Found: ${result.title}`)

  setCache(cacheKey, result, 6 * 60 * 60 * 1000)
  return NextResponse.json(result)
}