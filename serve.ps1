# 로컬 정적 서버 (python 이 없을 때). 사용: pwsh -File serve.ps1 [-Port 8080]
param([int]$Port = 8080)
$root = $PSScriptRoot
$types = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8';
  '.webmanifest'='application/manifest+json'; '.json'='application/json'; '.svg'='image/svg+xml'; '.png'='image/png'; '.ico'='image/x-icon'; '.md'='text/plain; charset=utf-8' }
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:$Port/")
$l.Start()
Write-Host "http://localhost:$Port/ 에서 실행 중 (Ctrl+C 로 종료)"
try {
  while ($l.IsListening) {
    $ctx = $l.GetContext()
    $p = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    if ($p -eq '/') { $p = '/index.html' }
    $f = Join-Path $root ($p.TrimStart('/'))
    $full = [IO.Path]::GetFullPath($f)
    if ($full.StartsWith($root) -and (Test-Path $full -PathType Leaf)) {
      $b = [IO.File]::ReadAllBytes($full)
      $ext = [IO.Path]::GetExtension($full).ToLower()
      $ctx.Response.ContentType = $(if ($types[$ext]) { $types[$ext] } else { 'application/octet-stream' })
      $ctx.Response.Headers.Add('Cache-Control', 'no-cache')
      $ctx.Response.OutputStream.Write($b, 0, $b.Length)
    } else {
      $ctx.Response.StatusCode = 404
    }
    $ctx.Response.Close()
  }
} finally { $l.Stop() }
