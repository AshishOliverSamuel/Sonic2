import { NextRequest, NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/cache'
import { Innertube } from 'youtubei.js'

let innertube: any = null

async function getInnertube() {
  if (!innertube) {
    innertube = await Innertube.create({
      retrieve_player: true,
    })
  }
  return innertube
}

async function getYTStream(videoId: string) {
  try {
    const yt = await getInnertube()
    const info = await yt.getBasicInfo(videoId)
    const format = info.chooseFormat({
      type: 'audio',
      quality: 'best'
    })

    if (!format?.url) return null

    return {
      streamUrl: format.url,
      duration: info.basic_info?.duration || 0,
      title: info.basic_info?.title || '',
      uploader: info.basic_info?.author || '',
      thumbnailUrl: info.basic_info?.thumbnail?.[0]?.url || '',
    }
  } catch (e: any) {
    console.error('[Stream] youtubei error:', e?.message)
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params
  if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 })

  const cacheKey = `stream:ytjs:${videoId}`
  const cached = getCache(cacheKey)
  if (cached) return NextResponse.json(cached)

  const result = await getYTStream(videoId)

  if (!result) {
    return NextResponse.json({ error: 'Song not found' }, { status: 404 })
  }

  setCache(cacheKey, result, 2 * 60 * 60 * 1000)
  return NextResponse.json(result)
}