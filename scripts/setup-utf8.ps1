# PowerShell UTF-8 Configuration
#
# Run this BEFORE starting the server to ensure proper encoding

# Set console encoding to UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8

# Set PowerShell session encoding
$PSDefaultParameterValues['*:Encoding'] = 'utf8'

# Set environment variable for Node.js
$env:NODE_OPTIONS = "--no-warnings"
$env:LANG = "en_US.UTF-8"

Write-Host "✓ UTF-8 encoding configured for PowerShell session" -ForegroundColor Green
Write-Host "  - Console Output: UTF-8" -ForegroundColor Gray
Write-Host "  - Console Input: UTF-8" -ForegroundColor Gray  
Write-Host "  - Default Encoding: UTF-8" -ForegroundColor Gray
Write-Host ""
Write-Host "You can now run: npm run dev" -ForegroundColor Cyan
