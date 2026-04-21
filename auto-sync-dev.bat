


@echo off
echo 🔄 Watching full project (DEV mode)...

chokidar "backend/src/**/*.*" "backend/prisma/**/*.*" "frontend/src/**/*.*" -d 3 -c "git add . && git commit -m \"dev update\" && git push origin dev"