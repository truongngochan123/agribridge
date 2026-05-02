# AGRIBRIDGE-BE

Spring Boot backend for AgriBridge.

## Requirements

- Java `25`
- Use the included Maven Wrapper: `mvnw.cmd`
- SQL Server running locally with a database named `agribridge`

## Local configuration

The backend runs with Spring profile `local`.

Local-only values should be stored in:

- OS environment variables, or
- `AGRIBRIDGE-BE/.env.local` copied from `.env.example`

Do not commit real secrets. The following files are intentionally ignored:

- `.env.local`
- `.env.*.local`

### `JAVA_HOME`

`run-be-local.cmd` no longer hardcodes a machine-specific JDK path.

Set `JAVA_HOME` to your JDK root directory before running the backend.

Example on Windows:

```cmd
setx JAVA_HOME "C:\Program Files\Java\jdk-25"
```

After reopening the terminal, confirm:

```cmd
echo %JAVA_HOME%
%JAVA_HOME%\bin\java.exe -version
```

## Cloudinary variables

Set these in `.env.local` or in your OS environment:

```properties
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret
CLOUDINARY_FOLDER=agribridge
```

Spring maps them in `application-local.properties` as:

```properties
cloudinary.cloud-name=${CLOUDINARY_CLOUD_NAME:}
cloudinary.api-key=${CLOUDINARY_API_KEY:}
cloudinary.api-secret=${CLOUDINARY_API_SECRET:}
cloudinary.folder=${CLOUDINARY_FOLDER:agribridge}
```

## Email variables

If you want admin actions and registration OTP to send real emails, set these in `.env.local`:

```properties
APP_MAIL_ENABLED=true
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USERNAME=no-reply@example.com
MAIL_PASSWORD=your-smtp-password
MAIL_FROM_ADDRESS=no-reply@example.com
MAIL_FROM_NAME=AgriBridge
MAIL_SMTP_AUTH=true
MAIL_SMTP_STARTTLS_ENABLE=true
```

When `APP_MAIL_ENABLED=false`, the system still saves in-app notifications but skips SMTP delivery.

## Database defaults for local

If you use the sample `.env.local`, local defaults are:

- host: `localhost`
- port: `1433`
- database: `agribridge`
- username: `sa`
- password: `123456`

These are configurable through:

```properties
DB_HOST=
DB_PORT=
DB_NAME=
DB_USERNAME=
DB_PASSWORD=
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=true
```

## Run locally

1. Open a terminal in `AGRIBRIDGE-BE`
2. Copy `.env.example` to `.env.local`
3. Fill in local Cloudinary values
4. Run:

```cmd
run-be-local.cmd
```

The backend starts with profile `local` on `http://localhost:8025`.

Equivalent Maven Wrapper command:

```cmd
mvnw.cmd -Dmaven.test.skip=true spring-boot:run -Dspring-boot.run.profiles=local
```

## Port cleanup behavior

The local script does not force-kill port `8025` by default.

If you want the script to help free the port during local development, run it with:

```cmd
set BE_LOCAL_CLEAN_PORT=true
run-be-local.cmd
```

The script will show the PID and ask for confirmation before stopping it.

## Files involved in local setup

- `run-be-local.cmd`: validates environment and starts Spring Boot locally
- `src/main/resources/application-local.properties`: local profile settings and placeholder mapping
- `.env.example`: sample local variables
- `.env.local`: local-only secrets and overrides, not committed

## Notes

- Backend port: `8025`
- Frontend local URL expected by default: `http://localhost:5173`
- Database schema remains managed by Hibernate `ddl-auto=update`
