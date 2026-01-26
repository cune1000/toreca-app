/**
 * Google Cloud認証ユーティリティ
 */
import path from 'path'
import fs from 'fs'

export interface GoogleCredentialsConfig {
  keyFilename?: string
  credentials?: any
}

// Google Cloud認証情報を取得
export function getGoogleCredentials(): GoogleCredentialsConfig {
  // 1. ファイルパスから読み込み
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  
  if (credentialsPath) {
    const fullPath = path.resolve(credentialsPath)
    if (fs.existsSync(fullPath)) {
      return { keyFilename: fullPath }
    }
  }
  
  // 2. 環境変数からJSON文字列を読み込み（Vercel用）
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  if (credentialsJson) {
    const credentials = JSON.parse(credentialsJson)
    return { credentials }
  }
  
  throw new Error('Google Cloud credentials not found. Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_APPLICATION_CREDENTIALS_JSON')
}

// Vision APIクライアント（シングルトン）
let visionClient: any = null

export async function getVisionClient() {
  if (!visionClient) {
    const vision = await import('@google-cloud/vision')
    visionClient = new vision.ImageAnnotatorClient(getGoogleCredentials())
  }
  return visionClient
}

// Product Search クライアント（シングルトン）
let productSearchClient: any = null

export async function getProductSearchClient() {
  if (!productSearchClient) {
    const vision = await import('@google-cloud/vision')
    productSearchClient = new vision.ProductSearchClient(getGoogleCredentials())
  }
  return productSearchClient
}
