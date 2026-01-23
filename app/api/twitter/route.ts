import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const username = searchParams.get('username')

  if (!username) {
    return NextResponse.json({ error: 'username is required' }, { status: 400 })
  }

  const bearerToken = process.env.X_BEARER_TOKEN

  if (!bearerToken) {
    return NextResponse.json({ error: 'X_BEARER_TOKEN is not configured' }, { status: 500 })
  }

  try {
    // 1. ユーザーIDを取得
    const userResponse = await fetch(
      `https://api.twitter.com/2/users/by/username/${username}?user.fields=profile_image_url`,
      {
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
        },
      }
    )

    if (!userResponse.ok) {
      const error = await userResponse.json()
      console.error('Twitter API error (user):', error)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userData = await userResponse.json()
    const userId = userData.data?.id

    if (!userId) {
      return NextResponse.json({ error: 'User ID not found' }, { status: 404 })
    }

    // 2. ユーザーのツイートを取得（画像付き）
    const tweetsResponse = await fetch(
      `https://api.twitter.com/2/users/${userId}/tweets?max_results=20&expansions=attachments.media_keys&media.fields=url,preview_image_url,type&tweet.fields=created_at,text`,
      {
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
        },
      }
    )

    if (!tweetsResponse.ok) {
      const error = await tweetsResponse.json()
      console.error('Twitter API error (tweets):', error)
      return NextResponse.json({ error: 'Failed to fetch tweets' }, { status: 500 })
    }

    const tweetsData = await tweetsResponse.json()
    
    // メディア情報をマップ化（高画質版を取得）
    const mediaMap = new Map()
    if (tweetsData.includes?.media) {
      for (const media of tweetsData.includes.media) {
        if (media.type === 'photo' && media.url) {
          // 高画質版のURLに変換（?format=jpg&name=large を追加）
          let highResUrl = media.url
          if (highResUrl.includes('pbs.twimg.com')) {
            // 既存のパラメータを削除して高画質パラメータを追加
            highResUrl = highResUrl.split('?')[0] + '?format=jpg&name=large'
          }
          mediaMap.set(media.media_key, highResUrl)
        }
      }
    }

    // 画像付きツイートのみをフィルタリング
    const tweets = (tweetsData.data || [])
      .filter((tweet: any) => tweet.attachments?.media_keys?.length > 0)
      .map((tweet: any) => {
        const images = (tweet.attachments?.media_keys || [])
          .map((key: string) => mediaMap.get(key))
          .filter(Boolean)
        
        return {
          id: tweet.id,
          text: tweet.text,
          created_at: tweet.created_at,
          images,
        }
      })
      .filter((tweet: any) => tweet.images.length > 0)

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        username: userData.data.username,
        name: userData.data.name,
        profileImageUrl: userData.data.profile_image_url,
      },
      tweets,
      total: tweets.length,
    })

  } catch (error: any) {
    console.error('Twitter API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tweets' },
      { status: 500 }
    )
  }
}
