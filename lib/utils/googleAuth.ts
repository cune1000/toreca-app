/**
 * Google Cloud認証ユーティリティ
 */
import path from 'path'
import fs from 'fs'

export interface GoogleCredentialsConfig {
  keyFilename?: string
  credentials?: Record<string, any>
}

// Google Cloud認証情報を取得
export function getGoogleCredentials(): GoogleCredentialsConfig {
  // 1. 明示的なJSON環境変数（Vercel推奨）
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  if (credentialsJson) {
    try {
      const credentials = JSON.parse(credentialsJson)
      return { credentials }
    } catch (e) {
      console.error('Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON', e)
    }
  }

  // 2. GOOGLE_APPLICATION_CREDENTIALS (ファイルパス または JSON文字列)
  const credentialsOrPath = process.env.GOOGLE_APPLICATION_CREDENTIALS

  if (credentialsOrPath) {
    // ケースA: JSON文字列が直接入っている場合（よくある設定ミスを救済）
    if (credentialsOrPath.trim().startsWith('{')) {
      try {
        const credentials = JSON.parse(credentialsOrPath)
        return { credentials }
      } catch (e) {
        console.warn('Failed to parse GOOGLE_APPLICATION_CREDENTIALS as JSON, treating as path')
      }
    }

    // ケースB: ファイルパスとして扱う
    const fullPath = path.resolve(credentialsOrPath)
    if (fs.existsSync(fullPath)) {
      return { keyFilename: fullPath }
    } else {
      console.warn(`Google credentials file not found at: ${fullPath}`)
    }
  }

  // 3. その他の変数名（念のため）
  const googleCreds = process.env.GOOGLE_CREDENTIALS
  if (googleCreds) {
    try {
      const credentials = typeof googleCreds === 'string' ? JSON.parse(googleCreds) : googleCreds
      return { credentials }
    } catch (e) {/* ignore */ }
  }

  throw new Error('Google Cloud credentials not found. Set GOOGLE_APPLICATION_CREDENTIALS containing JSON or file path.')
}

// Vision APIクライアント（シングルトン）
let visionClient: any = null

export async function getVisionClient() {
  if (!visionClient) {
    const vision = await import('@google-cloud/vision')
    const creds = getGoogleCredentials()
    visionClient = new vision.ImageAnnotatorClient(creds as any)
  }
  return visionClient
}

// Product Search クライアント（シングルトン）
let productSearchClient: any = null

export async function getProductSearchClient() {
  if (!productSearchClient) {
    const vision = await import('@google-cloud/vision')
    const creds = getGoogleCredentials()
    productSearchClient = new vision.ProductSearchClient(creds as any)
  }
  return productSearchClient
}
