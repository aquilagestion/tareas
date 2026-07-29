# Build local APK (sin EAS cloud) → copia a C:\grefa-tareas\releases
param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"

$mobile = Join-Path $Root "apps\mobile"
$releases = Join-Path $Root "releases"
$androidDir = Join-Path $mobile "android"
$sourceApk = Join-Path $androidDir "app\build\outputs\apk\release\app-release.apk"

if (-not (Test-Path $mobile)) {
  throw "No existe apps/mobile en $Root"
}

$appJsonPath = Join-Path $mobile "app.json"
$appJson = Get-Content $appJsonPath -Raw | ConvertFrom-Json
$version = [string]$appJson.expo.version
if ([string]::IsNullOrWhiteSpace($version)) { $version = "0.0.0" }

$outputName = "GREFA_TAREAS_$version.apk"
$outputApk = Join-Path $releases $outputName
$lastPathFile = Join-Path $releases "last_apk_path.txt"

Write-Host "[1/4] Prebuild Android (Expo)..." -ForegroundColor Cyan
$env:CI = "1"
$env:NODE_ENV = "production"
# Evita que Metro tome C:\grefa-tareas como project root en monorepo
$env:EXPO_NO_METRO_WORKSPACE_ROOT = "1"
Push-Location $mobile
try {
  npx expo prebuild -p android
  if ($LASTEXITCODE -ne 0) { throw "expo prebuild falló (exit $LASTEXITCODE)" }
}
finally {
  Pop-Location
}

# Copiar google-services.json al módulo app si existe (FCM / Google Services)
$gsSrc = Join-Path $mobile "google-services.json"
$gsDst = Join-Path $androidDir "app\google-services.json"
if (Test-Path $gsSrc) {
  New-Item -ItemType Directory -Force -Path (Split-Path $gsDst) | Out-Null
  Copy-Item $gsSrc $gsDst -Force
  Write-Host "     google-services.json copiado a android/app/" -ForegroundColor DarkGray
}

# Parchear build.gradle tras prebuild (Metro monorepo → apps/mobile)
$appGradle = Join-Path $androidDir "app\build.gradle"
if (Test-Path $appGradle) {
  $gradleText = Get-Content $appGradle -Raw
  if ($gradleText -notmatch 'entryFilePath = new File\(projectRoot, "index.js"\)') {
    Write-Host "     Parcheando android/app/build.gradle (project-root monorepo)..." -ForegroundColor DarkGray
    $patchScript = Join-Path $Root "scripts\patch-android-build-gradle.ps1"
    if (Test-Path $patchScript) {
      & $patchScript -AppGradlePath $appGradle
    }
  }
}

Write-Host "[2/4] Compilando assembleRelease..." -ForegroundColor Cyan
$env:NODE_ENV = "production"
$env:CI = "1"
Push-Location $androidDir
try {
  if (-not (Test-Path ".\gradlew.bat")) {
    throw "No se encontró gradlew.bat. ¿Falló el prebuild?"
  }
  & .\gradlew.bat assembleRelease
  if ($LASTEXITCODE -ne 0) { throw "gradlew assembleRelease falló (exit $LASTEXITCODE)" }
}
finally {
  Pop-Location
}

if (-not (Test-Path $sourceApk)) {
  throw "APK no generado en: $sourceApk"
}

Write-Host "[3/4] Copiando a releases\..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $releases | Out-Null
Copy-Item $sourceApk $outputApk -Force
Set-Content -Path $lastPathFile -Value $outputApk -Encoding UTF8

Write-Host "[4/4] Listo:" -ForegroundColor Green
Write-Host "  $outputApk"
Write-Host "  (ruta también en $lastPathFile)"
