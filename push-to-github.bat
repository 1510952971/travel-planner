@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ============================================================
echo   旅途 Fluid Travel  /  仓库名固定: travel-planner
echo   本脚本目录: %CD%
echo   请勿在其它项目文件夹中运行此脚本！
echo ============================================================
echo.

echo %CD% | findstr /I /C:"travel-planner" >nul
if errorlevel 1 (
  echo [错误] 当前目录名不像 travel-planner，已中止，防止推错项目。
  echo 请把本 bat 放在 C:\project\travel-planner 内再运行。
  pause
  exit /b 1
)

if not exist "index.html" (
  echo [错误] 未找到 index.html，这不是「旅途」项目目录。
  pause
  exit /b 1
)
if not exist "js\app.js" (
  echo [错误] 未找到 js\app.js，这不是「旅途」项目目录。
  pause
  exit /b 1
)

where gh >nul 2>&1
if errorlevel 1 (
  echo [错误] 未找到 gh。请先安装: winget install --id GitHub.cli -e
  pause
  exit /b 1
)

gh auth status >nul 2>&1
if errorlevel 1 (
  echo 尚未登录 GitHub，即将打开浏览器授权...
  echo.
  gh auth login --hostname github.com --git-protocol https --web
  if errorlevel 1 (
    echo 登录失败，请重试。
    pause
    exit /b 1
  )
)

for /f "delims=" %%u in ('gh api user --jq .login') do set GH_USER=%%u
if "%GH_USER%"=="" (
  echo 无法获取 GitHub 用户名。
  pause
  exit /b 1
)

set REPO_NAME=travel-planner
echo 当前账号: %GH_USER%
echo 将使用仓库: https://github.com/%GH_USER%/%REPO_NAME%
echo （不会创建或推送到其它项目名）
echo.
set /p CONFIRM=确认上传「旅途 travel-planner」？输入 Y 继续: 
if /I not "%CONFIRM%"=="Y" (
  echo 已取消。
  pause
  exit /b 0
)
echo.

if not exist ".git" (
  git init
  git branch -M main
)

git status --porcelain >nul
git add -A
git status --porcelain | findstr /r "." >nul
if not errorlevel 1 (
  git commit -m "Update: sync local travel-planner"
)

gh repo view "%GH_USER%/%REPO_NAME%" >nul 2>&1
if errorlevel 1 (
  echo 创建远程仓库 %REPO_NAME% ...
  gh repo create %REPO_NAME% --public --source=. --remote=origin --push --description "旅途 Fluid Travel - multi-city trip planner (standalone)"
) else (
  echo 远程仓库已存在，仅推送本目录更新...
  git remote remove origin 2>nul
  git remote add origin "https://github.com/%GH_USER%/%REPO_NAME%.git"
  git push -u origin main
)

if errorlevel 1 (
  echo.
  echo 推送失败。请确认 remote 是否为 travel-planner:
  echo   git remote -v
  echo 再试: git push -u origin main
  pause
  exit /b 1
)

echo.
echo ============================================================
echo  成功！仅上传了「旅途」项目。
echo  仓库: https://github.com/%GH_USER%/%REPO_NAME%
echo.
echo  换电脑:
echo    git clone https://github.com/%GH_USER%/%REPO_NAME%.git
echo    cd travel-planner
echo    双击 start.bat
echo.
echo  详细说明: docs\项目身份与GitHub换机说明.md
echo ============================================================
echo.
start "" "https://github.com/%GH_USER%/%REPO_NAME%"
pause
