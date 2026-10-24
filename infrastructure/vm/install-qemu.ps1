param([string]$Destination = 'C:\Program Files\qemu')
$ErrorActionPreference = 'Stop'
# Windows build linked by https://www.qemu.org/download/#windows
$release = 'qemu-w64-setup-20260811'
$downloadDir = Join-Path $PSScriptRoot 'downloads'
New-Item -ItemType Directory -Force $downloadDir | Out-Null
$installer = Join-Path $downloadDir "$release.exe"
Invoke-WebRequest "https://qemu.weilnetz.de/w64/$release.exe" -OutFile $installer
$checksum = (Invoke-WebRequest "https://qemu.weilnetz.de/w64/$release.sha512").Content
$expected = ($checksum.Trim() -split '\s+')[0]
if ((Get-FileHash -Algorithm SHA512 -LiteralPath $installer).Hash -ne $expected) { throw 'QEMU checksum mismatch' }
# Run this script from an elevated PowerShell. No automatic reboot or network changes.
$process = Start-Process -FilePath $installer -ArgumentList @('/S', "/D=$Destination") -WindowStyle Hidden -Wait -PassThru
if ($process.ExitCode -ne 0) { throw "QEMU installer failed: $($process.ExitCode)" }
& (Join-Path $Destination 'qemu-system-x86_64.exe') --version
& (Join-Path $Destination 'qemu-system-x86_64.exe') -accel help
& (Join-Path $Destination 'qemu-img.exe') --version
