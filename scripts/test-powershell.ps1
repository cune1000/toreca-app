# PowerShell でのAPIテスト（エンコーディング対策済み）
# 新しいPowerShellウインドウで実行してください

Write-Host "=== テスト開始 ==="
Write-Host "PowerShell Version: $($PSVersionTable.PSVersion)"
Write-Host ""

# テスト 1: シンプルなGETリクエスト（比較基準）
Write-Host "--- Test 1: Google へのGET（ベースライン） ---"
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri "https://www.google.com" -TimeoutSec 10
    $sw.Stop()
    Write-Host "Status: $($r.StatusCode), Time: $($sw.ElapsedMilliseconds)ms"
} catch {
    $sw.Stop()
    Write-Host "ERROR: $($_.Exception.Message) after $($sw.ElapsedMilliseconds)ms"
}
Write-Host ""

# テスト 2: Vercel APIへのシンプルなGET（ヘルスチェック的）
Write-Host "--- Test 2: Vercel API GET（疎通確認） ---"
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri "https://toreca-app.vercel.app/api/snkrdunk-scrape" -Method GET -TimeoutSec 10
    $sw.Stop()
    Write-Host "Status: $($r.StatusCode), Time: $($sw.ElapsedMilliseconds)ms"
} catch {
    $sw.Stop()
    Write-Host "ERROR: $($_.Exception.Message) after $($sw.ElapsedMilliseconds)ms"
}
Write-Host ""

# テスト 3: 本番APIへのPOST
Write-Host "--- Test 3: snkrdunk-scrape POST ---"
$jsonBody = '{"cardId":"03eb0e61-90ad-4d15-972b-0e6573ef86f2","url":"https://snkrdunk.com/apparels/466512"}'
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri "https://toreca-app.vercel.app/api/snkrdunk-scrape" -Method POST -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($jsonBody)) -TimeoutSec 30
    $sw.Stop()
    Write-Host "Status: $($r.StatusCode), Time: $($sw.ElapsedMilliseconds)ms"
    Write-Host "Response: $($r.Content)"
} catch {
    $sw.Stop()
    Write-Host "ERROR: $($_.Exception.Message) after $($sw.ElapsedMilliseconds)ms"
}
Write-Host ""

# テスト 4: ConvertTo-Json方式（ユーザーが使っている方法と同じ）
Write-Host "--- Test 4: ConvertTo-Json方式 ---"
$body = @{ cardId = "03eb0e61-90ad-4d15-972b-0e6573ef86f2"; url = "https://snkrdunk.com/apparels/466512" } | ConvertTo-Json
Write-Host "Body: $body"
Write-Host "Body length: $($body.Length)"
Write-Host "Body bytes: $([System.Text.Encoding]::UTF8.GetByteCount($body))"
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri "https://toreca-app.vercel.app/api/snkrdunk-scrape" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 30
    $sw.Stop()
    Write-Host "Status: $($r.StatusCode), Time: $($sw.ElapsedMilliseconds)ms"
    Write-Host "Response: $($r.Content)"
} catch {
    $sw.Stop()
    Write-Host "ERROR: $($_.Exception.Message) after $($sw.ElapsedMilliseconds)ms"
}
Write-Host ""

Write-Host "=== テスト完了 ==="
