/**
 * アプリケーション設定
 * 環境変数から取得する設定値を集約
 */

/**
 * Toreca Scraper (Railway) のURL
 */
export const TORECA_SCRAPER_URL = process.env.TORECA_SCRAPER_URL || 'https://skillful-love-production.up.railway.app'

/**
 * Gemini API キー
 */
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY

/**
 * Cron認証用シークレット
 */
export const CRON_SECRET = process.env.CRON_SECRET
