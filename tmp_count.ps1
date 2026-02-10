$total = 0
for ($p = 1; $p -le 25; $p++) {
    $html = (Invoke-WebRequest -Uri "https://kaitori.toreca-lounge.com/products?page=$p" -UseBasicParsing).Content
    $m = [regex]::Matches($html, '\\\"product\\\":\{')
    $cnt = $m.Count
    if ($cnt -eq 0) {
        Write-Host "Page ${p}: 0 items (STOP)"
        break
    }
    $total += $cnt
    Write-Host "Page ${p}: $cnt items (total: $total)"
}
Write-Host "Grand total: $total"
