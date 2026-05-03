require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Sequelize } = require('sequelize');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Database Connection
const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
});

// Basic Route
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Import Routes (To be created)
// const domainRoutes = require('./routes/domains');
// const dnsRoutes = require('./routes/dns');

// app.use('/api/domains', domainRoutes);
// app.use('/api/dns', dnsRoutes);

async function startServer() {
    try {
        await sequelize.authenticate();
        console.log('✅ Registry Database connected successfully.');
        
        app.listen(PORT, () => {
            console.log(`🚀 Registrar API running on port ${PORT}`);
        });
    } catch (error) {
        console.error('❌ Unable to connect to the database:', error);
        process.exit(1);
    }
}

startServer();
