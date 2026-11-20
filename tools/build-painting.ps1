# 원본 그림을 게임 해상도로 줄여 js/painting-image.js(PNG 데이터 주소)를 만든다.
# 사용: powershell -NoProfile -File tools/build-painting.ps1 -Source source/starry-night-1920.jpg -Width 1280 -Height 1014
# 폭과 높이는 js/config.js의 painting 값과 같게 준다.
# shortcut: Windows의 System.Drawing에 기대므로 Windows에서만 돈다. 다른 OS가 필요해지면 Node용 이미지 라이브러리로 옮긴다.
param(
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][int]$Width,
  [Parameter(Mandatory = $true)][int]$Height,
  [string]$Out = "js/painting-image.js"
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Image]::FromFile((Resolve-Path $Source))
try {
  $ratioSource = $src.Width / $src.Height
  $ratioTarget = $Width / $Height
  if ([Math]::Abs($ratioSource - $ratioTarget) / $ratioSource -gt 0.01) {
    Write-Warning ("원본 비율 {0:N3}과 목표 비율 {1:N3}이 1% 넘게 다릅니다. 그림이 늘어납니다." -f $ratioSource, $ratioTarget)
  }
  $bmp = New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  # 가장자리가 어두워지지 않게 가장자리 픽셀을 늘려 쓴다
  $attr = New-Object System.Drawing.Imaging.ImageAttributes
  $attr.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
  $g.DrawImage($src, (New-Object System.Drawing.Rectangle(0, 0, $Width, $Height)), 0, 0, $src.Width, $src.Height, [System.Drawing.GraphicsUnit]::Pixel, $attr)
  $g.Dispose()

  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  $b64 = [Convert]::ToBase64String($ms.ToArray())
} finally {
  $src.Dispose()
}

$lines = @(
  "'use strict';",
  "// 생성물: tools/build-painting.ps1이 만든다. 손으로 고치지 않는다.",
  "// 빈센트 반 고흐, 별이 빛나는 밤(1889), 퍼블릭 도메인. 출처는 README.",
  "// 파일에서 직접 연 페이지도 픽셀을 읽을 수 있도록 데이터 주소로 담는다. 크기: ${Width}x${Height}",
  "const PAINTING_IMAGE = 'data:image/png;base64,$b64';",
  "if (typeof module !== 'undefined') module.exports = PAINTING_IMAGE;"
)
$full = Join-Path (Get-Location) $Out
[System.IO.File]::WriteAllLines($full, $lines, (New-Object System.Text.UTF8Encoding($false)))
Write-Output ("{0} 생성: {1}x{2}, {3:N0} 바이트" -f $Out, $Width, $Height, (Get-Item $full).Length)
