# SETUP.md

## Local Development Setup for E-social-Domains

Welcome to the E-social-Domains project! This document will guide you through the steps to set up your local development environment.

### Prerequisites
- [Node.js](https://nodejs.org/) - Ensure you have the latest Version installed.
- [Docker](https://www.docker.com/get-started) - Install Docker for container management.
- A code editor of your choice (e.g., VSCode, Atom).

### Step 1: Clone the Repository

```bash
git clone https://github.com/maskedes/E-social-Domains.git
cd E-social-Domains
```

### Step 2: Install Backend Dependencies
Navigate to the backend directory and install the required packages:

```bash
cd backend
npm install
```

### Step 3: Database Setup
#### Using Docker (Recommended)
1. Ensure Docker is running on your machine.
2. In the project root, you will find a `docker-compose.yml`. Run:
   
   ```bash
docker-compose up -d
   ```

This will set up the database and the necessary services.

3. If you have a specific database migration setup, run:

```bash
npm run migrate
```

#### Manual Database Setup (Alternative)
1. Create a new database on your SQL server.
2. Import the schema defined in `backend/db/schema.sql` file.

### Step 4: Environment Configuration
Create a `.env` file in the `backend` directory and configure the following variables:

```plaintext
DATABASE_URL=<your_database_url>
JWT_SECRET=<your_jwt_secret>
NODE_ENV=development
```

Make sure to replace placeholders with your actual configuration values.

### Step 5: Running the Backend
In the `backend` directory, start the server using:

```bash
npm start
```

### Step 6: Install Frontend Dependencies
Navigate to the frontend directory and install the required packages:

```bash
cd ../frontend
npm install
```

### Step 7: Running the Frontend
In the `frontend` directory, start the development server using:

```bash
npm start
```

### Step 8: Access the Application
Open your web browser and navigate to `http://localhost:3000` for the frontend and verify that the backend is running correctly as well.

### Additional Notes
- If you encounter any issues, refer to the GitHub issues page or contact your project maintainers.
- Ensure that you frequently pull the latest changes from the main branch to stay up to date.

## Conclusion
Now you're all set to start working on the E-social-Domains project! Happy coding!