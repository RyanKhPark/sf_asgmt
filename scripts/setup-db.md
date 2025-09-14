# Database Setup Instructions

## Prerequisites

1. **Install PostgreSQL**:
   ```bash
   # macOS (with Homebrew)
   brew install postgresql
   brew services start postgresql

   # Ubuntu/Debian
   sudo apt update
   sudo apt install postgresql postgresql-contrib

   # Windows
   # Download from https://www.postgresql.org/download/windows/
   ```

2. **Create Database**:
   ```sql
   -- Connect to PostgreSQL as superuser
   sudo -u postgres psql

   -- Create database and user
   CREATE DATABASE pdfchat_db;
   CREATE USER pdfchat_user WITH PASSWORD 'your_secure_password';
   GRANT ALL PRIVILEGES ON DATABASE pdfchat_db TO pdfchat_user;

   -- Exit
   \q
   ```

## Environment Setup

1. **Copy environment file**:
   ```bash
   cp .env.example .env.local
   ```

2. **Update DATABASE_URL in .env.local**:
   ```
   DATABASE_URL="postgresql://pdfchat_user:your_secure_password@localhost:5432/pdfchat_db"
   ```

3. **Add other required variables**:
   ```
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-super-secret-jwt-secret-min-32-chars
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   ```

## Database Migration

1. **Generate Prisma Client**:
   ```bash
   npx prisma generate
   ```

2. **Run migrations**:
   ```bash
   npx prisma db push
   ```

3. **Optional: Seed database**:
   ```bash
   npx prisma db seed
   ```

4. **View database (optional)**:
   ```bash
   npx prisma studio
   ```

## Verification

Test the setup by:
1. Starting the development server: `npm run dev`
2. Trying to register a new user
3. Checking the database for the new user record

## Production Setup

For production, consider:
- Using a managed PostgreSQL service (AWS RDS, Google Cloud SQL, etc.)
- Setting up proper SSL connections
- Configuring connection pooling
- Setting up database backups