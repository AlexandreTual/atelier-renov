require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cloudinary = require('cloudinary').v2;
const stream = require('stream');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

// Configuration Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
}));
app.use(express.json());
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Multer Config - Memory Storage
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// PostgreSQL Pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Database Setup
async function setupDb() {
    try {
        // Bags
        await pool.query(`
            CREATE TABLE IF NOT EXISTS bags (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                brand TEXT,
                purchase_price REAL DEFAULT 0,
                target_resale_price REAL DEFAULT 0,
                actual_resale_price REAL DEFAULT 0,
                status TEXT DEFAULT 'to_be_cleaned',
                purchase_date TEXT,
                sale_date TEXT,
                fees REAL DEFAULT 0,
                material_costs REAL DEFAULT 0,
                time_spent INTEGER DEFAULT 0,
                notes TEXT,
                purchase_source TEXT,
                is_donation BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Images
        await pool.query(`
            CREATE TABLE IF NOT EXISTS images (
                id SERIAL PRIMARY KEY,
                bag_id INTEGER REFERENCES bags(id) ON DELETE CASCADE,
                url TEXT NOT NULL,
                public_id TEXT,
                type TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Dashboard Lists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS dashboard_lists (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                filters TEXT,
                order_index INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Consumables
        await pool.query(`
            CREATE TABLE IF NOT EXISTS consumables (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                brand TEXT,
                purchase_price REAL DEFAULT 0,
                quantity INTEGER DEFAULT 1,
                unit TEXT DEFAULT 'unité',
                remaining_percentage INTEGER DEFAULT 100,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Expenses
        await pool.query(`
            CREATE TABLE IF NOT EXISTS expenses (
                id SERIAL PRIMARY KEY,
                description TEXT NOT NULL,
                amount REAL DEFAULT 0,
                category TEXT DEFAULT 'other',
                date TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Brands
        await pool.query(`
            CREATE TABLE IF NOT EXISTS brands (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Check if brands empty
        const brandsCount = await pool.query('SELECT COUNT(*) as count FROM brands');
        if (parseInt(brandsCount.rows[0].count) === 0) {
            const defaultBrands = ['Hermès', 'Louis Vuitton', 'Chanel', 'Dior', 'Gucci', 'Prada', 'Celine', 'Saint Laurent', 'Fendi', 'Balenciaga'];
            for (const brand of defaultBrands) {
                await pool.query('INSERT INTO brands (name) VALUES ($1) ON CONFLICT DO NOTHING', [brand]);
            }
        }

        // Users
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE,
                password TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Bag Logs
        await pool.query(`
            CREATE TABLE IF NOT EXISTS bag_logs (
                id SERIAL PRIMARY KEY,
                bag_id INTEGER REFERENCES bags(id) ON DELETE CASCADE,
                action TEXT NOT NULL,
                date TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Bag Consumables
        await pool.query(`
            CREATE TABLE IF NOT EXISTS bag_consumables (
                id SERIAL PRIMARY KEY,
                bag_id INTEGER REFERENCES bags(id) ON DELETE CASCADE,
                consumable_id INTEGER REFERENCES consumables(id) ON DELETE SET NULL,
                used_percentage REAL DEFAULT 0,
                cost_at_time REAL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Seed admin
        const adminUser = await pool.query('SELECT * FROM users WHERE username = $1', ['admin']);
        if (adminUser.rows.length === 0) {
            const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
            await pool.query('INSERT INTO users (username, password) VALUES ($1, $2)', ['admin', hashedPassword]);
            console.log('Admin user created');
        }

        console.log('Database initialized (PostgreSQL)');
    } catch (err) {
        console.error('Database initialization failed:', err);
    }
}

setupDb();

// Auth Middleware
const auth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Accès non autorisé' });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Session expirée' });
        req.user = user;
        next();
    });
};

// Cloudinary Helper
const uploadToCloudinary = (buffer) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { resource_type: 'image', folder: 'atelier-renov' },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        const bufferStream = new stream.PassThrough();
        bufferStream.end(buffer);
        bufferStream.pipe(uploadStream);
    });
};

const deleteFromCloudinary = async (publicId) => {
    if (!publicId) return;
    try {
        await cloudinary.uploader.destroy(publicId);
    } catch (err) {
        console.error('Error deleting from Cloudinary:', err);
    }
};

// Validation Middleware
const validateBag = (req, res, next) => {
    const { name, purchase_price, target_resale_price } = req.body;
    if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'Le nom du modèle est obligatoire' });
    }
    req.body.purchase_price = parseFloat(purchase_price) || 0;
    req.body.target_resale_price = parseFloat(target_resale_price) || 0;
    req.body.actual_resale_price = parseFloat(req.body.actual_resale_price) || 0;
    req.body.fees = parseFloat(req.body.fees) || 0;
    req.body.material_costs = parseFloat(req.body.material_costs) || 0;
    next();
};

// Routes

app.post('/api/login', async (req, res) => {
    try {
        const { password } = req.body;
        const result = await pool.query('SELECT * FROM users WHERE username = $1', ['admin']);
        const user = result.rows[0];

        if (user && await bcrypt.compare(password, user.password)) {
            const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
            return res.json({ token });
        }
        res.status(401).json({ error: 'Mot de passe incorrect' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur lors de la connexion' });
    }
});

app.post('/api/change-password', auth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        const user = result.rows[0];

        if (user && await bcrypt.compare(currentPassword, user.password)) {
            const hashedNewPassword = await bcrypt.hash(newPassword, 10);
            await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedNewPassword, req.user.id]);
            return res.json({ success: true });
        }
        res.status(400).json({ error: 'Ancien mot de passe incorrect' });
    } catch (err) {
        res.status(500).json({ error: 'Erreur lors du changement de mot de passe' });
    }
});

app.get('/api/bags', auth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM bags ORDER BY created_at DESC');
        const bags = result.rows;

        // Fetch images for each bag
        const bagsWithImages = await Promise.all(bags.map(async (bag) => {
            const imgResult = await pool.query('SELECT * FROM images WHERE bag_id = $1', [bag.id]);
            return { ...bag, images: imgResult.rows };
        }));
        res.json(bagsWithImages);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/bags', auth, validateBag, async (req, res) => {
    try {
        const { name, brand, purchase_price, target_resale_price, status, purchase_source, is_donation } = req.body;
        const result = await pool.query(
            'INSERT INTO bags (name, brand, purchase_price, target_resale_price, status, purchase_source, is_donation) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
            [name, brand, purchase_price, target_resale_price, status || 'to_be_cleaned', purchase_source, is_donation ? true : false]
        );
        res.json({ id: result.rows[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create bag' });
    }
});

app.put('/api/bags/:id', auth, validateBag, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name, brand, purchase_price, target_resale_price, actual_resale_price,
            status, purchase_date, sale_date, fees, material_costs, time_spent, notes,
            purchase_source, is_donation
        } = req.body;

        await pool.query(
            `UPDATE bags SET 
                name = $1, brand = $2, purchase_price = $3, target_resale_price = $4, 
                actual_resale_price = $5, status = $6, purchase_date = $7, sale_date = $8, 
                fees = $9, material_costs = $10, time_spent = $11, notes = $12,
                purchase_source = $13, is_donation = $14
            WHERE id = $15`,
            [name, brand, purchase_price, target_resale_price, actual_resale_price, status, purchase_date, sale_date, fees, material_costs, time_spent, notes, purchase_source, is_donation ? true : false, id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update bag' });
    }
});

app.delete('/api/bags/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;

        // Get all images associated with this bag to delete from Cloudinary
        const result = await pool.query('SELECT public_id FROM images WHERE bag_id = $1', [id]);
        const images = result.rows;

        for (const img of images) {
            if (img.public_id) await deleteFromCloudinary(img.public_id);
        }

        // Delete from database (cascade handles foreign keys)
        await pool.query('DELETE FROM bags WHERE id = $1', [id]);

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete bag' });
    }
});

// Bag Logs Routes
app.get('/api/bags/:id/logs', auth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM bag_logs WHERE bag_id = $1 ORDER BY date DESC, created_at DESC', [req.params.id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/bags/:id/logs', auth, async (req, res) => {
    try {
        const { action, date } = req.body;
        const result = await pool.query(
            'INSERT INTO bag_logs (bag_id, action, date) VALUES ($1, $2, $3) RETURNING id',
            [req.params.id, action, date]
        );
        const newLog = await pool.query('SELECT * FROM bag_logs WHERE id = $1', [result.rows[0].id]);
        res.json(newLog.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/logs/:id', auth, async (req, res) => {
    try {
        await pool.query('DELETE FROM bag_logs WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Bag Consumables Routes
app.get('/api/bags/:id/consumables', auth, async (req, res) => {
    try {
        const sql = `
            SELECT bc.*, c.name as consumable_name, c.brand as consumable_brand
            FROM bag_consumables bc
            LEFT JOIN consumables c ON bc.consumable_id = c.id
            WHERE bc.bag_id = $1
            ORDER BY bc.created_at DESC
        `;
        const result = await pool.query(sql, [req.params.id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/bags/:id/consumables', auth, async (req, res) => {
    try {
        const { consumable_id, usage_percent } = req.body;
        const bag_id = req.params.id;

        // 1. Get consumable details
        const cResult = await pool.query('SELECT * FROM consumables WHERE id = $1', [consumable_id]);
        const consumable = cResult.rows[0];
        if (!consumable) return res.status(404).json({ error: 'Consumable not found' });

        // 2. Calculate cost
        const cost = (consumable.purchase_price || 0) * (usage_percent / 100);

        // 3. Updates
        await pool.query(
            'INSERT INTO bag_consumables (bag_id, consumable_id, used_percentage, cost_at_time) VALUES ($1, $2, $3, $4)',
            [bag_id, consumable_id, usage_percent, cost]
        );

        await pool.query(
            'UPDATE consumables SET remaining_percentage = remaining_percentage - $1 WHERE id = $2',
            [usage_percent, consumable_id]
        );

        await pool.query(
            'UPDATE bags SET material_costs = material_costs + $1 WHERE id = $2',
            [cost, bag_id]
        );

        res.json({ success: true, cost_added: cost });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/bag-consumables/:id', auth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM bag_consumables WHERE id = $1', [req.params.id]);
        const link = result.rows[0];
        if (!link) return res.status(404).json({ error: 'Link not found' });

        await pool.query(
            'UPDATE bags SET material_costs = material_costs - $1 WHERE id = $2',
            [link.cost_at_time, link.bag_id]
        );

        if (link.consumable_id) {
            await pool.query(
                'UPDATE consumables SET remaining_percentage = remaining_percentage + $1 WHERE id = $2',
                [link.used_percentage, link.consumable_id]
            );
        }

        await pool.query('DELETE FROM bag_consumables WHERE id = $1', [req.params.id]);
        res.json({ success: true });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Image management
app.post('/api/bags/:id/images', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { url, type, public_id } = req.body;
        const result = await pool.query(
            'INSERT INTO images (bag_id, url, type, public_id) VALUES ($1, $2, $3, $4) RETURNING id',
            [id, url, type, public_id]
        );
        res.json({ id: result.rows[0].id, url });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to link image' });
    }
});

app.delete('/api/images/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT public_id FROM images WHERE id = $1', [id]);
        const img = result.rows[0];
        if (img && img.public_id) {
            await deleteFromCloudinary(img.public_id);
        }
        await pool.query('DELETE FROM images WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete image' });
    }
});

app.post('/api/upload', auth, upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const result = await uploadToCloudinary(req.file.buffer);
        // Returns URL and public_id
        res.json({ url: result.secure_url, public_id: result.public_id });
    } catch (err) {
        console.error('Image processing failed:', err);
        res.status(500).json({ error: 'Failed to process image' });
    }
});

// Dashboard Lists Routes
app.get('/api/dashboard-lists', auth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM dashboard_lists ORDER BY order_index ASC');
        res.json(result.rows.map(l => ({ ...l, filters: JSON.parse(l.filters || '[]') })));
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch dashboard lists' });
    }
});

app.post('/api/dashboard-lists', auth, async (req, res) => {
    try {
        const { title, filters, order_index } = req.body;
        const result = await pool.query(
            'INSERT INTO dashboard_lists (title, filters, order_index) VALUES ($1, $2, $3) RETURNING id',
            [title, JSON.stringify(filters || []), order_index || 0]
        );
        res.json({ id: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create dashboard list' });
    }
});

app.put('/api/dashboard-lists/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, filters, order_index } = req.body;
        await pool.query(
            'UPDATE dashboard_lists SET title = $1, filters = $2, order_index = $3 WHERE id = $4',
            [title, JSON.stringify(filters || []), order_index || 0, id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update dashboard list' });
    }
});

app.delete('/api/dashboard-lists/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM dashboard_lists WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete dashboard list' });
    }
});

app.post('/api/dashboard-lists/reorder', auth, async (req, res) => {
    try {
        const { orders } = req.body;
        await Promise.all(orders.map(item =>
            pool.query('UPDATE dashboard_lists SET order_index = $1 WHERE id = $2', [item.order_index, item.id])
        ));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to reorder dashboard lists' });
    }
});

// Consumables Routes
app.get('/api/consumables', auth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM consumables ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch consumables' });
    }
});

app.post('/api/consumables', auth, async (req, res) => {
    try {
        const { name, brand, purchase_price, quantity, unit, remaining_percentage, notes } = req.body;
        const result = await pool.query(
            'INSERT INTO consumables (name, brand, purchase_price, quantity, unit, remaining_percentage, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
            [name, brand, parseFloat(purchase_price) || 0, parseInt(quantity) || 1, unit || 'unité', parseInt(remaining_percentage) || 100, notes]
        );
        res.json({ id: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create consumable' });
    }
});

app.put('/api/consumables/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, brand, purchase_price, quantity, unit, remaining_percentage, notes } = req.body;
        await pool.query(
            'UPDATE consumables SET name = $1, brand = $2, purchase_price = $3, quantity = $4, unit = $5, remaining_percentage = $6, notes = $7 WHERE id = $8',
            [name, brand, parseFloat(purchase_price) || 0, parseInt(quantity) || 1, unit || 'unité', parseInt(remaining_percentage) || 100, notes, id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update consumable' });
    }
});

app.delete('/api/consumables/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM consumables WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete consumable' });
    }
});

// Expenses Routes
app.get('/api/expenses', auth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM expenses ORDER BY date DESC, created_at DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch expenses' });
    }
});

app.post('/api/expenses', auth, async (req, res) => {
    try {
        const { description, amount, category, date } = req.body;
        const result = await pool.query(
            'INSERT INTO expenses (description, amount, category, date) VALUES ($1, $2, $3, $4) RETURNING id',
            [description, parseFloat(amount) || 0, category || 'other', date || new Date().toISOString().split('T')[0]]
        );
        res.json({ id: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create expense' });
    }
});

app.put('/api/expenses/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { description, amount, category, date } = req.body;
        await pool.query(
            'UPDATE expenses SET description = $1, amount = $2, category = $3, date = $4 WHERE id = $5',
            [description, parseFloat(amount) || 0, category || 'other', date || new Date().toISOString().split('T')[0], id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update expense' });
    }
});

app.delete('/api/expenses/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM expenses WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete expense' });
    }
});

// CSV Export
app.get('/api/export/csv', auth, async (req, res) => {
    try {
        const bagsRes = await pool.query('SELECT * FROM bags WHERE status = $1', ['sold']);
        const expensesRes = await pool.query('SELECT * FROM expenses');
        const bags = bagsRes.rows;
        const expenses = expensesRes.rows;

        let csv = 'Type;Date;Description;Montant;Marge\n';

        bags.forEach(b => {
            const margin = b.actual_resale_price - b.purchase_price - b.fees - b.material_costs;
            csv += `Vente;${b.sale_date || b.created_at};${b.brand} ${b.name};${b.actual_resale_price};${margin.toFixed(2)}\n`;
        });

        expenses.forEach(e => {
            csv += `Dépense;${e.date};${e.description};-${e.amount};0\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=tableau_de_bord.csv');
        res.send(csv);
    } catch (err) {
        res.status(500).json({ error: 'Failed to export CSV' });
    }
});

// Brands Routes
app.get('/api/brands', auth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM brands ORDER BY name ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch brands' });
    }
});

app.post('/api/brands', auth, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Brand name is required' });
        const result = await pool.query('INSERT INTO brands (name) VALUES ($1) RETURNING id', [name]);
        res.json({ id: result.rows[0].id, name });
    } catch (err) {
        if (err.message.includes('unique constraint') || err.message.includes('duplicate key')) {
            return res.status(400).json({ error: 'Cette marque existe déjà' });
        }
        res.status(500).json({ error: 'Failed to create brand' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
