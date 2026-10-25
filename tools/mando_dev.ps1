# Levanta el entorno del mando: relay Node, emulador Android, APK instalado y app abierta.
# Uso:  powershell -ExecutionPolicy Bypass -File tools\mando_dev.ps1 [-Avd dbz34] [-Compilar] [-SinEmulador]
# Todo es idempotente: lo que ya esta corriendo se deja como esta.
param([string]$Avd = 'dbz34', [switch]$Compilar, [switch]$SinEmulador, [switch]$Red)
# -Red: el relay escucha en toda la red local (hace falta para un celular real; el emulador no lo necesita)

$repo = Split-Path $PSScriptRoot -Parent
$sdk  = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:LOCALAPPDATA\Android\Sdk" }
$adb  = "$sdk\platform-tools\adb.exe"
$apk  = "$repo\mando_android\app\build\outputs\apk\debug\app-debug.apk"
$pkg  = 'com.example.rectangulo_node'
$srv  = "$PSScriptRoot\mando_server"

# --- 1) Relay ---
if (-not (Test-Path "$srv\node_modules")) { Push-Location $srv; npm install --silent; Pop-Location }
if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) {
    Write-Host 'Relay: ya estaba corriendo en el puerto 3000'
} else {
    if ($Red) { $env:HOST = '0.0.0.0' }
    Start-Process node -ArgumentList 'server.js' -WorkingDirectory $srv -WindowStyle Minimized
    Write-Host ('Relay: arrancado en ws://' + $(if ($Red) { '0.0.0.0 (toda la red local)' } else { 'localhost' }) + ':3000')
}
if ($SinEmulador) { return }

# --- 2) APK ---
if ($Compilar -or -not (Test-Path $apk)) {
    $jdk = Get-ChildItem "$env:USERPROFILE\.jdks" -Directory -Filter 'jdk-21*' -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $jdk) { throw 'Hace falta un JDK 21 en ~\.jdks para compilar (el JDK 25 de Android Studio no sirve con este Kotlin).' }
    $env:JAVA_HOME = $jdk.FullName
    "sdk.dir=$($sdk -replace '\\','/')" | Set-Content "$repo\mando_android\local.properties" -Encoding ascii
    Write-Host 'Compilando el APK (puede tardar un par de minutos)...'
    Push-Location "$repo\mando_android"; .\gradlew.bat assembleDebug --console=plain; Pop-Location
    if (-not (Test-Path $apk)) { throw 'No se genero el APK.' }
}

# --- 3) Emulador ---
if (-not (& $adb devices | Select-String 'emulator-\d+\s+device')) {
    Write-Host "Arrancando el emulador $Avd..."
    Start-Process "$sdk\emulator\emulator.exe" -ArgumentList '-avd', $Avd, '-no-snapshot-save'
    & $adb wait-for-device
    do { Start-Sleep 3 } until ((& $adb shell getprop sys.boot_completed 2>$null) -match '1')
}

# --- 4) Instalar y abrir ---
$out = & $adb install -r $apk 2>&1 | Out-String
if ($out -match 'INSTALL_FAILED_UPDATE_INCOMPATIBLE') {      # otra clave de firma: se reemplaza
    & $adb uninstall $pkg | Out-Null
    $out = & $adb install $apk 2>&1 | Out-String
}
if ($out -notmatch 'Success') { throw "No se pudo instalar el APK: $out" }
& $adb shell am start -n "$pkg/.Inicio" | Out-Null
Write-Host 'Listo. En la app: IP 10.0.2.2, puerto 3000, y entrar a Analogico.'
