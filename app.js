const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');

// Import database and routes
const { pool, testConnection, initDatabase } = require('./server/db');
const authModule = require('./server/auth');
const inventoryRoutes = require('./server/inventory');

const { router: authRoutes, authenticateToken } = authModule;

// Initialize app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/inventory', authenticateToken, inventoryRoutes);

// Serve HTML pages
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

app.get('/inventory', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'inventory.html'));
});

// Redirect root to login
app.get('/', (req, res) => {
    res.redirect('/login');
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : {}
    });
});

// Setup database and start server
async function setupDatabase() {
    try {
        await testConnection();
        await initDatabase();
        console.log('Database setup completed');
        return true;
    } catch (error) {
        console.error('Database setup failed:', error);
        return false;
    }
}

// Start server after database setup
setupDatabase()
    .then((dbSuccess) => {
        if (dbSuccess) {
            app.listen(PORT, () => {
                console.log(`Server running on port ${PORT}`);
            });
        } else {
            console.error('Server not started due to database initialization failure');
            process.exit(1);
        }
    })
    .catch(err => {
        console.error('Failed to start server:', err);
        process.exit(1);
    });

module.exports = app;