@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"

set "PORT=8081"
set "LOCAL_ENV_FILE=.env.local"

if not defined JAVA_HOME (
  echo [ERROR] JAVA_HOME is not set.
  echo [HINT] Configure JAVA_HOME to your JDK root, for example:
  echo        setx JAVA_HOME "C:\Program Files\Java\jdk-25"
  exit /b 1
)

if not exist "%JAVA_HOME%\bin\java.exe" (
  echo [ERROR] JAVA_HOME is invalid: %JAVA_HOME%
  echo [HINT] JAVA_HOME must point to the JDK root folder and contain bin\java.exe.
  exit /b 1
)

if exist "%LOCAL_ENV_FILE%" (
  echo [INFO] Local overrides detected in %LOCAL_ENV_FILE%.
) else (
  echo [INFO] %LOCAL_ENV_FILE% not found. Spring will use OS environment variables and default local placeholders.
  echo [HINT] Copy .env.example to %LOCAL_ENV_FILE% and fill in local values if needed.
)

if /I "%BE_LOCAL_CLEAN_PORT%"=="true" (
  call :cleanup_port %PORT%
  if errorlevel 1 exit /b 1
)

echo [INFO] Using JAVA_HOME=%JAVA_HOME%
echo [INFO] Starting backend with Spring profile local on port %PORT%...
call .\mvnw.cmd -Dmaven.test.skip=true spring-boot:run -Dspring-boot.run.profiles=local
exit /b %errorlevel%

:cleanup_port
set "TARGET_PORT=%~1"
set "PORT_PID="

for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%TARGET_PORT%" ^| findstr "LISTENING"') do (
  set "PORT_PID=%%p"
  goto :port_found
)

echo [INFO] Port %TARGET_PORT% is available.
exit /b 0

:port_found
echo [WARN] Local dev helper found a process listening on port %TARGET_PORT% ^(PID=!PORT_PID!^).
echo [WARN] This cleanup is optional and intended only for local development.

choice /C YN /N /M "Stop PID !PORT_PID! to free port %TARGET_PORT%? [Y/N]: "
if errorlevel 2 (
  echo [ERROR] Port %TARGET_PORT% is still in use. Stop the process manually or rerun with BE_LOCAL_CLEAN_PORT=false.
  exit /b 1
)

taskkill /PID !PORT_PID! /T >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Failed to stop PID !PORT_PID!.
  echo [HINT] Close the process manually, then rerun this script.
  exit /b 1
)

echo [INFO] Stopped PID !PORT_PID! on port %TARGET_PORT%.
exit /b 0
