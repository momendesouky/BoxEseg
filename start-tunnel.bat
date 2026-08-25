@echo off
cd /d C:\Users\momen\Boxseg
start /b cloudflared.exe tunnel --url http://localhost:3000 > tunnel.log 2>&1
