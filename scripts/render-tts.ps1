# Generate WAV narration files from a JSON manifest using built-in Windows SAPI.
#
# Usage:
#   pwsh scripts/render-tts.ps1 -ManifestPath scripts/narration.json -OutDir scripts/out/audio
#
# The manifest is { "id": "narration text", ... } — one WAV per entry.

param(
  [Parameter(Mandatory=$true)][string]$ManifestPath,
  [Parameter(Mandatory=$true)][string]$OutDir,
  [string]$VoiceMatch = "Zira"   # Microsoft Zira (female en-US) — clear, common default
)

if (-not (Test-Path $ManifestPath)) {
  Write-Error "Manifest not found: $ManifestPath"
  exit 1
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

Add-Type -AssemblyName System.Speech

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer

# Voice selection: prefer name match, fall back to first en-US voice.
$voice = $synth.GetInstalledVoices() | Where-Object {
  $_.VoiceInfo.Name -like "*$VoiceMatch*"
} | Select-Object -First 1

if ($null -eq $voice) {
  $voice = $synth.GetInstalledVoices() | Where-Object {
    $_.VoiceInfo.Culture.Name -like "en-*"
  } | Select-Object -First 1
}
if ($voice) {
  $synth.SelectVoice($voice.VoiceInfo.Name)
  Write-Host "Using voice: $($voice.VoiceInfo.Name) ($($voice.VoiceInfo.Culture))"
} else {
  Write-Host "No specific voice matched; using system default."
}

$synth.Rate = -1     # slight slow-down so it lands cleaner (-10 to 10)
$synth.Volume = 100

$json = Get-Content $ManifestPath -Raw | ConvertFrom-Json

# JSON manifest is a hashtable {id: text}. Iterate ordered.
foreach ($prop in $json.PSObject.Properties) {
  $id = $prop.Name
  $text = $prop.Value
  $outPath = Join-Path $OutDir "$id.wav"
  Write-Host "Rendering $id.wav ($($text.Length) chars)..."
  $synth.SetOutputToWaveFile($outPath)
  $synth.Speak($text)
  $synth.SetOutputToNull()
}

$synth.Dispose()
Write-Host "Done. WAVs in $OutDir"
