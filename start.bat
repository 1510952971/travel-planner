@echo off
cd /d "%~dp0"
title Travel Planner
echo.
echo  旅途规划 · 本地服务
echo  目录: %CD%
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo [提示] 未找到 python，将直接用浏览器打开 index.html
  start "" "%~dp0index.html"
  goto :end
)

echo [OK] 启动 http://127.0.0.1:8765
echo      浏览器打开后，可关闭本窗口结束服务
echo.
start "" "http://127.0.0.1:8765"
python -m http.server 8765
:end
pause
