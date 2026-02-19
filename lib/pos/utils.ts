// =============================================================================
// POS 共通ユーティリティ
// =============================================================================

/** エラーオブジェクトから安全にメッセージを取得 */
export function getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message
    if (typeof err === 'string') return err
    return '予期しないエラーが発生しました'
}
