import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    const playlistUrl = request.nextUrl.searchParams.get('url')
    if (!playlistUrl?.trim()) {
        return NextResponse.json({ error: 'Playlist URL required' }, { status: 400 })
    }

    const match = playlistUrl.match(/[?&]list=([a-zA-Z0-9_-]+)/)
    if (!match) {
        return NextResponse.json({ error: 'Invalid YouTube playlist URL' }, { status: 400 })
    }
    const playlistId = match[1]

    const apiKey = process.env.YOUTUBE_API_KEY
    if (!apiKey) {
        return NextResponse.json({ error: 'YouTube API key not configured' }, { status: 500 })
    }

    try {
        // Fetch ALL playlist items first (no metadata call needed)
        const allItems: any[] = []
        let pageToken: string | undefined = undefined

        do {
            const itemsUrl = new URL('https://www.googleapis.com/youtube/v3/playlistItems')
            itemsUrl.searchParams.set('part', 'snippet,contentDetails')
            itemsUrl.searchParams.set('playlistId', playlistId)
            itemsUrl.searchParams.set('maxResults', '50')
            itemsUrl.searchParams.set('key', apiKey)
            if (pageToken) itemsUrl.searchParams.set('pageToken', pageToken)

            const itemsRes = await fetch(itemsUrl.toString())
            const itemsData = await itemsRes.json()

            if (!itemsRes.ok) {
                console.error('playlistItems error:', JSON.stringify(itemsData))
                return NextResponse.json(
                    { error: itemsData.error?.message || 'Playlist not found or is private' },
                    { status: itemsRes.status }
                )
            }

            allItems.push(...(itemsData.items || []))
            pageToken = itemsData.nextPageToken
        } while (pageToken)

        if (allItems.length === 0) {
            return NextResponse.json({ error: 'Playlist is empty or private' }, { status: 404 })
        }

        // Try to get playlist title from first item's snippet
        const playlistTitle = allItems[0]?.snippet?.playlistId
            ? `YouTube Playlist (${allItems.length} songs)`
            : 'Imported Playlist'

        // Filter out deleted/private videos
        const validItems = allItems.filter((item: any) => {
            const title = item.snippet?.title
            return (
                item.contentDetails?.videoId &&
                title !== 'Deleted video' &&
                title !== 'Private video'
            )
        })

        const videoIds = validItems.map((item: any) => item.contentDetails.videoId)

        // Batch duration requests in groups of 50
        const durationMap: Record<string, number> = {}
        for (let i = 0; i < videoIds.length; i += 50) {
            const batch = videoIds.slice(i, i + 50).join(',')
            const detailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
            detailsUrl.searchParams.set('part', 'contentDetails,snippet')
            detailsUrl.searchParams.set('id', batch)
            detailsUrl.searchParams.set('key', apiKey)

            const detailsRes = await fetch(detailsUrl.toString())
            const detailsData = await detailsRes.json()

            for (const item of detailsData.items || []) {
                const iso = item.contentDetails?.duration || 'PT0S'
                const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
                if (m) {
                    durationMap[item.id] =
                        (parseInt(m[1] || '0') * 3600) +
                        (parseInt(m[2] || '0') * 60) +
                        parseInt(m[3] || '0')
                }
            }
        }

        const songs = validItems.map((item: any) => ({
            videoId: item.contentDetails.videoId,
            title: item.snippet.title
                .replace(/&amp;/g, '&')
                .replace(/&#39;/g, "'")
                .replace(/&quot;/g, '"'),
            artist: item.snippet.videoOwnerChannelTitle
                ?.replace(/VEVO$/i, '')
                ?.replace(/- Topic$/i, '')
                ?.trim() || 'Unknown Artist',
            thumbnail:
                item.snippet.thumbnails?.high?.url ||
                item.snippet.thumbnails?.medium?.url ||
                item.snippet.thumbnails?.default?.url || '',
            duration: durationMap[item.contentDetails.videoId] || 0,
        }))

        // Use first song thumbnail as playlist thumbnail
        const playlistThumbnail = songs[0]?.thumbnail || ''

        return NextResponse.json({
            playlistId,
            title: playlistTitle,
            thumbnail: playlistThumbnail,
            songCount: songs.length,
            songs,
        })

    } catch (error) {
        console.error('Playlist import error:', error)
        return NextResponse.json({ error: 'Failed to import playlist' }, { status: 500 })
    }
}