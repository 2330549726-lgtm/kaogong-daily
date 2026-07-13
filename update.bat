@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ===================================
echo   广东考公热点资讯 - 每日更新
echo   时间: %date% %time%
echo ===================================
echo.
set "PYTHON_EXE=%LocalAppData%\Programs\Python\Python313\python.exe"
if exist "%PYTHON_EXE%" (
  "%PYTHON_EXE%" fetch_news.py
) else (
  py -3.13 fetch_news.py
)
echo.
echo 更新完成! 现在可以打开 index.html 查看最新资讯
pause
