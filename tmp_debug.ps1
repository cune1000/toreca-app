# Search for the specific card by looking through all pages
for ($page = 1; $page -le 31; $page++) {
    $html = (Invoke-WebRequest -UseBasicParsing -Uri "https://kaitori.toreca-lounge.com/products/pokemon?page=$page" -Headers @{'User-Agent'='Mozilla/5.0'}).Content
    # Look for "173/086" (Touko's model number)
    $idx = $html.IndexOf('173/086')
    if ($idx -gt 0) {
        Write-Host "Found on page $page at position $idx"
        $start = [Math]::Max(0, $idx - 300)
        $snippet = $html.Substring($start, 800)
        Write-Host $snippet
        break
    }
}
