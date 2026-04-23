# Multi Factor Authentication Project

This is a full stack starter project for a web based multi factor authentication system using:

- Node.js and Express on the backend
- React on the frontend
- PostgreSQL for the database
- Gmail SMTP through Nodemailer for real email delivery
- JWT for authentication
- bcrypt for password hashing

## Requirements

Make sure these are installed on your computer:

- Node.js
- npm
- PostgreSQL
- Visual Studio Code

## Project structure

```text
mfa_full_project_pg_email/
  backend/
  frontend/
```

## Backend setup

1. Open a terminal in VS Code
2. Go into the backend folder

```bash
cd backend
npm install
```

3. Create a PostgreSQL database named `mfa_project`

4. Run the schema script inside PostgreSQL

You can use psql or pgAdmin and run:

```sql
\i sql/schema.sql
```

Or copy the contents of `backend/sql/schema.sql` into pgAdmin and run it.

5. Create a `.env` file in the backend folder using `.env.example` as a guide

Example:

```env
PORT=4000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/mfa_project
JWT_SECRET=replace_this_with_a_long_random_secret
EMAIL_USER=yourgmail@gmail.com
EMAIL_PASS=your_gmail_app_password
EMAIL_FROM=yourgmail@gmail.com
CLIENT_URL=http://localhost:3000
```

## Important Gmail note

Do not use your regular Gmail password.

Use a Gmail App Password:
- Turn on two factor authentication on your Google account
- Create an App Password in your Google account security settings
- Put that App Password into `EMAIL_PASS`

## Start backend

```bash
npm run dev
```

The backend should run on:

```text
http://localhost:4000
```

## Frontend setup

Open a second terminal:

```bash
cd frontend
npm install
npm start
```

The frontend should run on:

```text
http://localhost:3000
```

## Demo flow

1. Register a user
2. Log in without two factor enabled
3. Open Settings
4. Enable two factor authentication with an email
5. Log out
6. Log in again
7. Receive the one time code in email
8. Enter the code
9. Access the dashboard

## Notes

- This is designed for local development and course demo use
- It uses real email through Gmail SMTP
- Protected routes are enforced after full authentication
- Verification codes expire and failed attempts are limited
