@echo off
color 0A
cd /d "%~dp0"

echo ========================================================
echo        HE THONG KHOI DONG SERVER TAI XIU
echo ========================================================

echo [1] Dang bat Server Node.js o cua so chay ngam...
start "Server Game Tai Xiu" cmd /k "npm start"

echo [2] Dang tao duong ham Cloudflare...
echo --------------------------------------------------------
echo VUI LONG COPY DUONG LINK '.trycloudflare.com' BEN DUOI:
echo (Nho them /playgame/ hoac /mobie/ vao duoi link)
echo --------------------------------------------------------
cloudflared tunnel --url http://localhost:2002
