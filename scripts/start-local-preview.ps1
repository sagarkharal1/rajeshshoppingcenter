$envFile = "C:\Users\sandh\OneDrive\Documents\New project\Master-Agent\.env"
$databaseLine = Get-Content $envFile | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
if (-not $databaseLine) {
  throw "DATABASE_URL not found in .env"
}

$env:DATABASE_URL = $databaseLine.Substring(13)
$env:PORT = "8092"
$env:ADMIN_JWT_SECRET = "change-this-secret"

Set-Location "C:\Users\sandh\OneDrive\Documents\New project\Master-Agent\artifacts\api-server"
node .\dist\index.mjs
