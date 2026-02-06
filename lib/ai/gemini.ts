/**
 * Gemini AI ヘルパー関数
 * 
 * 画像認識API間で共通のGemini関連処理を集約
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai'
import { GEMINI_API_KEY } from '@/lib/config'

/**
 * Gemini モデルを取得
 * @param modelName - モデル名（デフォルト: gemini-3-flash-preview）
 */
export function getGeminiModel(modelName = 'gemini-3-flash-preview'): GenerativeModel {
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not configured')
    }
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
    return genAI.getGenerativeModel({ model: modelName })
}

/**
 * Base64画像データをクリーンアップ
 * @param base64Data - Base64エンコードされた画像データ
 * @returns プレフィックスを除去したBase64データ
 */
export function cleanBase64(base64Data: string): string {
    return base64Data.replace(/^data:image\/[a-z]+;base64,/, '')
}

/**
 * GeminiレスポンスからJSONを抽出
 * コードブロックや説明文を除去してJSONのみを取得
 * @param text - Geminiからのレスポンステキスト
 * @returns クリーンアップされたJSON文字列
 */
export function extractJsonFromResponse(text: string): string {
    // マークダウンのコードブロックを除去
    let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    // JSON配列を抽出（説明文を除去）
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/)
    if (arrayMatch) {
        return arrayMatch[0]
    }

    // JSONオブジェクトを抽出
    const objectMatch = cleaned.match(/\{[\s\S]*\}/)
    if (objectMatch) {
        return objectMatch[0]
    }

    return cleaned
}

/**
 * URLから画像をBase64として取得
 * @param imageUrl - 画像のURL
 * @returns Base64エンコードされた画像データ
 */
export async function fetchImageAsBase64(imageUrl: string): Promise<string> {
    const response = await fetch(imageUrl)
    if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`)
    }
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer).toString('base64')
}
