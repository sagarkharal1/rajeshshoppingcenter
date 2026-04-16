$root = "C:\Users\sandh\OneDrive\Documents\New project\Master-Agent"
$envFile = Join-Path $root ".env"

if (-not (Test-Path $envFile)) {
  throw ".env file not found at $envFile"
}

Get-Content $envFile | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith("#")) { return }
  $parts = $line -split "=", 2
  if ($parts.Length -ne 2) { return }
  [System.Environment]::SetEnvironmentVariable($parts[0], $parts[1], "Process")
}

Set-Location (Join-Path $root "artifacts\api-server")
pnpm run start
