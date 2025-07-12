@echo off
echo ========================================
echo  ReWearX - Quick Deployment Helper
echo ========================================
echo.

echo 🔍 Checking project files...
if not exist "index.html" (
    echo ❌ Error: index.html not found. Run from project root directory.
    pause
    exit /b 1
)

echo ✅ Project files found!
echo.

echo 📦 Creating deployment package...
echo.

REM Create deployment folder
if exist "deployment" rmdir /s /q deployment
mkdir deployment

REM Copy all necessary files (excluding dev files)
xcopy "*.html" deployment\ /Y
xcopy "css\*" deployment\css\ /Y /E
xcopy "js\*" deployment\js\ /Y /E
xcopy "firebase.json" deployment\ /Y
xcopy "README.md" deployment\ /Y

echo ✅ Deployment package created in 'deployment' folder!
echo.

echo 🚀 Deployment Options:
echo.
echo 1. Netlify Drop (Fastest - 2 minutes):
echo    - Go to: https://app.netlify.com/drop
echo    - Drag the 'deployment' folder
echo    - Get instant live URL!
echo.
echo 2. Vercel (Easy - 3 minutes):
echo    - Go to: https://vercel.com
echo    - Sign in and import project
echo    - Auto-deploy!
echo.
echo 3. GitHub Pages (Traditional - 5 minutes):
echo    - Create GitHub repo
echo    - Upload 'deployment' folder contents
echo    - Enable Pages in settings
echo.

echo 📱 After deployment:
echo    - Test sign up/login
echo    - Test upload feature
echo    - Test on mobile
echo    - Take demo screenshots
echo.

echo 🎉 Your ReWearX project is ready for hackathon submission!
echo.
pause
