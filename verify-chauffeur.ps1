# Script de vérification des fichiers critiques pour l'app chauffeur
# Usage: .\verify-chauffeur.ps1

$appIndex = "app\index.tsx"
$appConfig = "app.config.js"

Write-Host "`n=== Verification des fichiers critiques ===" -ForegroundColor Cyan
Write-Host ""

# Verifier app/index.tsx
if (-not (Test-Path $appIndex)) {
    Write-Host "ERREUR: $appIndex manquant!" -ForegroundColor Red
    Write-Host "   Ce fichier est necessaire pour rediriger vers /(chauffeur)/login" -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "OK: $appIndex existe" -ForegroundColor Green
}

# Verifier app.config.js
if (-not (Test-Path $appConfig)) {
    Write-Host "ERREUR: $appConfig manquant!" -ForegroundColor Red
    exit 1
} else {
    Write-Host "OK: $appConfig existe" -ForegroundColor Green
}

# Verifier que app.config.js contient appMode: "chauffeur"
$configContent = Get-Content $appConfig -Raw
if ($configContent -notmatch 'appMode.*chauffeur') {
    Write-Host "ERREUR: $appConfig ne contient pas appMode: 'chauffeur'!" -ForegroundColor Red
    Write-Host "   Le fichier doit contenir: appMode: chauffeur" -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "OK: $appConfig contient appMode: 'chauffeur'" -ForegroundColor Green
}

# Verifier le chemin actuel
$currentPath = (Get-Location).Path
Write-Host "`nChemin actuel: $currentPath" -ForegroundColor Cyan

if ($currentPath -notmatch 'TAPEA-REACT-chauffeur') {
    Write-Host "ATTENTION: Vous n'etes pas dans le dossier TAPEA-REACT-chauffeur!" -ForegroundColor Yellow
    Write-Host "   Vous devriez etre dans: C:\Users\Planet Fenua\OneDrive\Bureau\App react github\TAPEA-REACT-chauffeur" -ForegroundColor Yellow
}

Write-Host "`nOK: Tous les fichiers critiques sont presents!" -ForegroundColor Green
Write-Host ""
