/** Supabase ilike検索用のエスケープ（%、_、\をエスケープ） */
export function escapeIlike(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&')
}
