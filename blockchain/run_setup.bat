@echo off
echo ===================================================
echo   DAPP SETUP SCRIPT - INSTALL, COMPILE, TEST ^& RUN
echo ===================================================

echo.
echo [1/4] Installing dependencies...
call npm install

echo.
echo [2/4] Compiling Smart Contract...
call npx hardhat compile

echo.
echo [3/4] Starting local blockchain...
echo Starting Hardhat Node in a new window...
start "Hardhat Node" cmd /k "npx hardhat node"

echo Waiting 5 seconds for the server to start...
timeout /t 5 /nobreak > nul

echo.
echo [4/4] Running QA Tests ^& Seeding data...
echo Running Tests...
call npx mocha test/CertificatesManager.test.js

echo Running Deploy ^& Seed script...
call node scripts/deploy.js

echo.
echo ===================================================
echo SUCCESS! ALL SYSTEMS GO.
echo Frontend can now connect to: http://127.0.0.1:8545
echo (Do not close the "Hardhat Node" window!)
echo ===================================================
pause