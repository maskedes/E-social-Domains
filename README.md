# E-social-Domains (World Identity Platform)

This project provides a modular architecture for managing domains, separated into four distinct layers for redundancy, scalability, and real-world compliance.

## 📁 Architecture Overview

| Layer | Responsibility | Technology |
| :--- | :--- | :--- |
| **Registry** | Domain Database | PostgreSQL |
| **Registrar** | Business Logic | Node.js (Express) |
| **DNS** | External Record Sync | Cloudflare API / PowerDNS |
| **Dashboard** | User Interface | React (Vite) |

## 🚀 Getting Started

### 1. Registry (Database)
- Located in `backend-registrar/schema.sql`.
- Run the SQL script in your PostgreSQL instance to create the necessary tables.

### 2. Registrar (Backend)
- Located in `backend-registrar/`.
- Configure your `.env` file based on `.env.example`.
- Run `npm install` and then `node index.js`.

### 3. Dashboard (Frontend)
- Located in `lite-marketplace/frontend-v2/`.
- Connects to the Registrar API via `axios`.
- Run `npm run dev` to start the development server.

## 🛠️ Key Features
- **Redundancy**: Architecture supports multiple DNS providers.
- **Audit Logging**: Every DNS change is tracked in the Registry.
- **Real-world Sync**: Integration with Cloudflare for live domain management.
- **Free Domains**: Supports registration of permanent free domains.
