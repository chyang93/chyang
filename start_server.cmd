@echo off
rem 啟動本機 HTTP 伺服器，並以新命令視窗持續執行
cd /d "D:\楊志鴻\單字例句助手"
start "Vocabulary Helper 伺服器" cmd /k "python -m http.server 8000"
exit /b 0
