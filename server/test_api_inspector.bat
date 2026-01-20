@echo off
REM Helper script to test API DN with MCP Inspector
REM Usage: test_api_inspector.bat

cd /d "%~dp0"

echo Starting MCP Inspector for API DN...
echo.
echo This will open a web interface where you can:
echo - View all 55 tools from the DN API
echo - Test tool execution
echo - Inspect schemas and parameters
echo.

REM Get Base64 encoded config from inspect script
for /f "delims=" %%i in ('node inspect_mcp_server.js api edcdec59-27ba-4636-8d76-49a6033f01e2 ^| findstr /v "Inspecting Run command npx"') do set CONFIG_BASE64=%%i

npx @modelcontextprotocol/inspector node ./mcp-servers/openapi-wrapper.js %CONFIG_BASE64%
