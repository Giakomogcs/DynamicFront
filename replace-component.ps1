# PowerShell Script to Replace ApiKeyInput Component in SettingsView.jsx

$settingsFile = "C:\Github\DynamicFront\client\src\components\SettingsView.jsx"
$newComponentFile = "C:\Github\DynamicFront\REPLACE_ApiKeyInput.txt"

Write-Host "Reading files..." -ForegroundColor Cyan

# Read both files
$content = Get-Content $settingsFile -Raw
$newComponent = Get-Content $newComponentFile -Raw

# Find and replace the ApiKeyInput component
# Pattern to match the old component (from line starting with "const ApiKeyInput" until the closing );)
$pattern = '(?s)const ApiKeyInput = \(\{ label.*?\}\);'

if ($content -match $pattern) {
    Write-Host "Found ApiKeyInput component. Replacing..." -ForegroundColor Yellow
    
    # Create backup
    $backupFile = "$settingsFile.backup"
    Copy-Item $settingsFile $backupFile
    Write-Host "Backup created: $backupFile" -ForegroundColor Green
    
    # Replace
    $newContent = $content -replace $pattern, $newComponent
    
    # Save
    Set-Content -Path $settingsFile -Value $newContent -NoNewline
    
    Write-Host "✓ Component replaced successfully!" -ForegroundColor Green
    Write-Host "  Backup saved at: $backupFile" -ForegroundColor Gray
    
} else {
    Write-Host "✗ Could not find ApiKeyInput component pattern" -ForegroundColor Red
    Write-Host "  Please replace manually" -ForegroundColor Yellow
}

Write-Host "`nDone!" -ForegroundColor Cyan
