@echo off
echo 🔄 Watching project (DEV mode)...

chokidar "src/**/*.*" "prisma/**/*.*" ".env" -d 7 -c "git add . && git diff --cached --quiet || git commit -m \"dev update\" && git push origin dev"