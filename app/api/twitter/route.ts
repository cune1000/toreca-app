import { NextRequest, NextResponse } from 'next/server'

const BEARER_TOKEN = process.env.X_BEARER_TOKEN

// ユーザーIDを取得
async function getUserId(username: string): Promise<string | null> {
  const response = await fetch(
    `https://api.twitter.com/2/users/by/username/${username}`,
    {
      headers: {
        'Authorization': `Bearer ${BEARER_TOKEN}`,
      },
    }
  )
  
  if (!response.ok) {
    console.error('Failed to get user ID:', await response.text())
    return null
  }
  
  const data = await response.json()
  return data.data?.id || null
}

// ユーザーの最新ツイートを取得（画像付き）
async function getUserTweets(userId: string, maxResults: number = 10) {
  const response = await fetch(
    `https://api.twitter.com/2/users/${userId}/tweets?max_results=${maxResults}&tweet.fields=created_at,attachments&expansions=attachments.media_keys&media.fields=url,preview_image_url,type`,
    {
      headers: {
        'Authorization': `Bearer ${BEARER_TOKEN}`,
      },
    }
  )
  
  if (!response.ok) {
    console.error('Failed to get tweets:', await response.text())
    return null
  }
  
  return await response.json()
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')
    
    if (!username) {
      return NextResponse.json({ error: 'usernameが必要です' }, { status: 400 })
    }
    
    // ユーザーIDを取得
    const userId = await getUserId(username)
    if (!userId) {
      return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
    }
    
    // ツイートを取得
    const tweetsData = await getUserTweets(userId)
    if (!tweetsData) {
      return NextResponse.json({ error: 'ツイートの取得に失敗しました' }, { status: 500 })
    }
    
    // 画像付きツイートだけをフィルタリング
    const tweets = tweetsData.data || []
    const media = tweetsData.includes?.media || []
    
    const tweetsWithImages = tweets
      .filter((tweet: any) => tweet.attachments?.media_keys?.length > 0)
      .map((tweet: any) => {
        const tweetMedia = tweet.attachments.media_keys
          .map((key: string) => media.find((m: any) => m.media_key === key))
          .filter((m: any) => m && m.type === 'photo')
        
        return {
          id: tweet.id,
          text: tweet.text,
          created_at: tweet.created_at,
          images: tweetMedia.map((m: any) => m.url),
        }
      })
      .filter((tweet: any) => tweet.images.length > 0)
    
    return NextResponse.json({
      username,
      userId,
      tweets: tweetsWithImages,
    })
  } catch (error: any) {
    console.error('Twitter API error:', error)
    return NextResponse.json(
      { error: error.message || 'エラーが発生しました' },
      { status: 500 }
    )
  }
}
