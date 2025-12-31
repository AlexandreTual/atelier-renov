require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const stream = require('stream');

// --- Dual Mode Config ---
const IS_LOCAL = process.env.USE_LOCAL_MODE === 'true';

let sqlite3, open, Pool, cloudinary;

if (IS_LOCAL) {
    sqlite3 = require('sqlite3');
    open = require('sqlite').open;
    console.log('🌍 OPERATING IN LOCAL MODE (SQLite + Local Uploads)');
} else {
    Pool = require('pg').Pool;
    cloudinary = require('cloudinary').v2;
    console.log('☁️ OPERATING IN CLOUD MODE (PostgreSQL + Cloudinary)');
}

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

// --- Cloudinary Config (Cloud Mode) ---
if (!IS_LOCAL) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
}

// --- Middleware ---

// Simplify allowedOrigins calculation
const getAllowedOrigins = () => [
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URL?.replace(/\/$/, ''), // Remove trailing slash
    'https://atelier-renov.vercel.app',
    'http://localhost:5173'
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        const allowed = getAllowedOrigins();
        const isAllowed = allowed.some(o => origin.startsWith(o));

        if (process.env.FRONTEND_URL === '*' || isAllowed) {
            callback(null, true);
        } else {
            console.warn(`Blocked by CORS: ${origin}. Allowed: ${allowed.join(', ')}`);
            callback(null, true); // TEMPORARY: Allow all
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());

app.use((req, res, next) => {
    console.log(`${req.method} ${req.url} - Origin: ${req.headers.origin}`);
    next();
});

// Serve local uploads if in local mode
if (IS_LOCAL) {
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir);
    }
    app.use('/uploads', express.static(uploadsDir));
}

// Multer Config
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }
});

// --- Database Abstraction Layer ---
let db;

// Wrapper pour uniformiser les requêtes
const query = async (sql, params = []) => {
    if (IS_LOCAL) {
        let localSql = sql;
        if (localSql.trim().toUpperCase().startsWith('INSERT') ||
            localSql.trim().toUpperCase().startsWith('UPDATE') ||
            localSql.trim().toUpperCase().startsWith('DELETE')) {
            const result = await db.run(localSql, params);
            return {
                rows: [],
                rowCount: result.changes,
                lastID: result.lastID
            };
        } else {
            const rows = await db.all(localSql, params);
            return { rows, rowCount: rows.length };
        }
    } else {
        let paramIndex = 1;
        const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
        const result = await db.query(pgSql, params);
        return result;
    }
};

const insertAndGetId = async (sql, params) => {
    if (IS_LOCAL) {
        const cleanSql = sql.replace(/RETURNING\s+id/i, '');
        const result = await db.run(cleanSql, params);
        return result.lastID;
    } else {
        let pgSql = sql;
        if (!/RETURNING\s+id/i.test(pgSql)) {
            pgSql += ' RETURNING id';
        }
        let paramIndex = 1;
        pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);
        const result = await db.query(pgSql, params);
        return result.rows[0]?.id;
    }
};

// --- Storage Abstraction Layer ---

const saveImage = async (buffer) => {
    if (IS_LOCAL) {
        const filename = Date.now() + '.webp';
        const outputPath = path.join(__dirname, 'uploads', filename);
        try {
            const sharp = require('sharp');
            await sharp(buffer)
                .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
                .webp({ quality: 80 })
                .toFile(outputPath);
        } catch (e) {
            fs.writeFileSync(outputPath, buffer);
        }
        return { url: `/uploads/${filename}`, public_id: null };
    } else {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                { resource_type: 'image', folder: 'atelier-renov' },
                (error, result) => {
                    if (error) reject(error);
                    else resolve({ url: result.secure_url, public_id: result.public_id });
                }
            );
            const bufferStream = new stream.PassThrough();
            bufferStream.end(buffer);
            bufferStream.pipe(uploadStream);
        });
    }
};

const deleteImage = async (imageObj) => {
    if (!imageObj) return;
    if (IS_LOCAL) {
        if (!imageObj.url) return;
        const filename = imageObj.url.split('/').pop();
        const filePath = path.join(__dirname, 'uploads', filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } else {
        if (imageObj.public_id) {
            try {
                await cloudinary.uploader.destroy(imageObj.public_id);
            } catch (err) {
                console.error('Cloudinary delete error:', err);
            }
        }
    }
};

// --- DB Init ---
async function setupDb() {
    try {
        if (IS_LOCAL) {
            db = await open({
                filename: './database.sqlite',
                driver: sqlite3.Database
            });
            console.log('Connected to SQLite');
        } else {
            db = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
            });
            console.log('Connected to PostgreSQL');
        }

        const typeId = IS_LOCAL ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'SERIAL PRIMARY KEY';
        const typeBoolean = IS_LOCAL ? 'INTEGER DEFAULT 0' : 'BOOLEAN DEFAULT FALSE';
        const typeTimestamp = IS_LOCAL ? 'DATETIME DEFAULT CURRENT_TIMESTAMP' : 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP';

        await query(`
            CREATE TABLE IF NOT EXISTS bags (
                id ${typeId},
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
                is_donation ${typeBoolean},
                created_at ${typeTimestamp}
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS images (
                id ${typeId},
                bag_id INTEGER,
                url TEXT NOT NULL,
                public_id TEXT,
                type TEXT,
                created_at ${typeTimestamp}
                ${IS_LOCAL ? ', FOREIGN KEY(bag_id) REFERENCES bags(id) ON DELETE CASCADE' : ''}
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS dashboard_lists (
                id ${typeId},
                title TEXT NOT NULL,
                filters TEXT,
                order_index INTEGER DEFAULT 0,
                created_at ${typeTimestamp}
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS consumables (
                id ${typeId},
                name TEXT NOT NULL,
                brand TEXT,
                purchase_price REAL DEFAULT 0,
                quantity INTEGER DEFAULT 1,
                unit TEXT DEFAULT 'unité',
                remaining_percentage INTEGER DEFAULT 100,
                notes TEXT,
                created_at ${typeTimestamp}
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS expenses (
                id ${typeId},
                description TEXT NOT NULL,
                amount REAL DEFAULT 0,
                category TEXT DEFAULT 'other',
                date TEXT,
                created_at ${typeTimestamp}
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS brands (
                id ${typeId},
                name TEXT NOT NULL UNIQUE,
                created_at ${typeTimestamp}
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS bag_logs (
                id ${typeId},
                bag_id INTEGER,
                action TEXT NOT NULL,
                date TEXT,
                created_at ${typeTimestamp}
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS bag_consumables (
                id ${typeId},
                bag_id INTEGER,
                consumable_id INTEGER,
                used_percentage REAL DEFAULT 0,
                cost_at_time REAL DEFAULT 0,
                created_at ${typeTimestamp}
            )
        `);

        const brandsCount = await query('SELECT COUNT(*) as count FROM brands');
        const count = IS_LOCAL ? brandsCount.rows[0].count : brandsCount.rows[0].count;
        if (parseInt(count) === 0) {
            const defaultBrands = ['Hermès', 'Louis Vuitton', 'Chanel', 'Dior', 'Gucci', 'Prada', 'Celine', 'Saint Laurent', 'Fendi', 'Balenciaga'];
            for (const brand of defaultBrands) {
                try {
                    await query('INSERT INTO brands (name) VALUES (?)', [brand]);
                } catch (e) { /* ignore */ }
            }
        }

        const adminUser = await query('CREATE TABLE IF NOT EXISTS users (id ' + typeId + ', username TEXT UNIQUE, password TEXT, created_at ' + typeTimestamp + ')');
        const admins = await query('SELECT * FROM users WHERE username = ?', ['admin']);
        if (admins.rows.length === 0) {
            const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
            await query('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', hashedPassword]);
            console.log('Admin user created');
        }

        console.log(`Database initialized in ${IS_LOCAL ? 'LOCAL' : 'CLOUD'} mode.`);
    } catch (err) {
        console.error('Database initialization failed:', err);
    }
}

setupDb();

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

app.post('/api/login', async (req, res) => {
    try {
        const { password } = req.body;
        const result = await query('SELECT * FROM users WHERE username = ?', ['admin']);
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
        const result = await query('SELECT * FROM users WHERE id = ?', [req.user.id]);
        const user = result.rows[0];

        if (user && await bcrypt.compare(currentPassword, user.password)) {
            const hashedNewPassword = await bcrypt.hash(newPassword, 10);
            await query('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, req.user.id]);
            return res.json({ success: true });
        }
        res.status(400).json({ error: 'Ancien mot de passe incorrect' });
    } catch (err) {
        res.status(500).json({ error: 'Erreur lors du changement de mot de passe' });
    }
});

app.get('/api/bags', auth, async (req, res) => {
    try {
        const result = await query('SELECT * FROM bags ORDER BY created_at DESC');
        const bags = result.rows;

        const bagsWithImages = await Promise.all(bags.map(async (bag) => {
            const imgResult = await query('SELECT * FROM images WHERE bag_id = ?', [bag.id]);
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
        const id = await insertAndGetId(
            'INSERT INTO bags (name, brand, purchase_price, target_resale_price, status, purchase_source, is_donation) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, brand, purchase_price, target_resale_price, status || 'to_be_cleaned', purchase_source, is_donation ? (IS_LOCAL ? 1 : true) : (IS_LOCAL ? 0 : false)]
        );
        res.json({ id });
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

        await query(
            `UPDATE bags SET 
                name = ?, brand = ?, purchase_price = ?, target_resale_price = ?, 
                actual_resale_price = ?, status = ?, purchase_date = ?, sale_date = ?, 
                fees = ?, material_costs = ?, time_spent = ?, notes = ?,
                purchase_source = ?, is_donation = ?
            WHERE id = ?`,
            [name, brand, purchase_price, target_resale_price, actual_resale_price, status, purchase_date, sale_date, fees, material_costs, time_spent, notes, purchase_source, is_donation ? (IS_LOCAL ? 1 : true) : (IS_LOCAL ? 0 : false), id]
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

        const result = await query('SELECT * FROM images WHERE bag_id = ?', [id]);
        const images = result.rows;

        for (const img of images) {
            await deleteImage(img);
        }

        await query('DELETE FROM bags WHERE id = ?', [id]);

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete bag' });
    }
});

app.get('/api/bags/:id/logs', auth, async (req, res) => {
    try {
        const result = await query('SELECT * FROM bag_logs WHERE bag_id = ? ORDER BY date DESC, created_at DESC', [req.params.id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/bags/:id/logs', auth, async (req, res) => {
    try {
        const { action, date } = req.body;
        const id = await insertAndGetId(
            'INSERT INTO bag_logs (bag_id, action, date) VALUES (?, ?, ?)',
            [req.params.id, action, date]
        );
        const newLog = await query('SELECT * FROM bag_logs WHERE id = ?', [id]);
        res.json(newLog.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/logs/:id', auth, async (req, res) => {
    try {
        await query('DELETE FROM bag_logs WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/bags/:id/consumables', auth, async (req, res) => {
    try {
        const sql = `
            SELECT bc.*, c.name as consumable_name, c.brand as consumable_brand
            FROM bag_consumables bc
            LEFT JOIN consumables c ON bc.consumable_id = c.id
            WHERE bc.bag_id = ?
            ORDER BY bc.created_at DESC
        `;
        const result = await query(sql, [req.params.id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/bags/:id/consumables', auth, async (req, res) => {
    try {
        const { consumable_id, usage_percent } = req.body;
        const bag_id = req.params.id;

        const cResult = await query('SELECT * FROM consumables WHERE id = ?', [consumable_id]);
        const consumable = cResult.rows[0];
        if (!consumable) return res.status(404).json({ error: 'Consumable not found' });

        const cost = (consumable.purchase_price || 0) * (usage_percent / 100);

        await query(
            'INSERT INTO bag_consumables (bag_id, consumable_id, used_percentage, cost_at_time) VALUES (?, ?, ?, ?)',
            [bag_id, consumable_id, usage_percent, cost]
        );

        await query(
            'UPDATE consumables SET remaining_percentage = remaining_percentage - ? WHERE id = ?',
            [usage_percent, consumable_id]
        );

        await query(
            'UPDATE bags SET material_costs = material_costs + ? WHERE id = ?',
            [cost, bag_id]
        );

        res.json({ success: true, cost_added: cost });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/bag-consumables/:id', auth, async (req, res) => {
    try {
        const result = await query('SELECT * FROM bag_consumables WHERE id = ?', [req.params.id]);
        const link = result.rows[0];
        if (!link) return res.status(404).json({ error: 'Link not found' });

        await query(
            'UPDATE bags SET material_costs = material_costs - ? WHERE id = ?',
            [link.cost_at_time, link.bag_id]
        );

        if (link.consumable_id) {
            await query(
                'UPDATE consumables SET remaining_percentage = remaining_percentage + ? WHERE id = ?',
                [link.used_percentage, link.consumable_id]
            );
        }

        await query('DELETE FROM bag_consumables WHERE id = ?', [req.params.id]);
        res.json({ success: true });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/bags/:id/images', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { url, type, public_id } = req.body;
        const imageId = await insertAndGetId(
            'INSERT INTO images (bag_id, url, type, public_id) VALUES (?, ?, ?, ?)',
            [id, url, type, public_id]
        );
        res.json({ id: imageId, url });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to link image' });
    }
});

app.delete('/api/images/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query('SELECT * FROM images WHERE id = ?', [id]);
        const img = result.rows[0];
        if (img) {
            await deleteImage(img);
            await query('DELETE FROM images WHERE id = ?', [id]);
        }
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
        const result = await saveImage(req.file.buffer);
        res.json(result); // { url, public_id }
    } catch (err) {
        console.error('Image processing failed:', err);
        res.status(500).json({ error: 'Failed to process image' });
    }
});

app.get('/api/dashboard-lists', auth, async (req, res) => {
    try {
        const result = await query('SELECT * FROM dashboard_lists ORDER BY order_index ASC');
        res.json(result.rows.map(l => ({ ...l, filters: JSON.parse(l.filters || '[]') })));
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch dashboard lists' });
    }
});

app.post('/api/dashboard-lists', auth, async (req, res) => {
    try {
        const { title, filters, order_index } = req.body;
        const id = await insertAndGetId(
            'INSERT INTO dashboard_lists (title, filters, order_index) VALUES (?, ?, ?)',
            [title, JSON.stringify(filters || []), order_index || 0]
        );
        res.json({ id });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create dashboard list' });
    }
});

app.put('/api/dashboard-lists/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, filters, order_index } = req.body;
        await query(
            'UPDATE dashboard_lists SET title = ?, filters = ?, order_index = ? WHERE id = ?',
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
        await query('DELETE FROM dashboard_lists WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete dashboard list' });
    }
});

app.post('/api/dashboard-lists/reorder', auth, async (req, res) => {
    try {
        const { orders } = req.body;
        await Promise.all(orders.map(item =>
            query('UPDATE dashboard_lists SET order_index = ? WHERE id = ?', [item.order_index, item.id])
        ));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to reorder dashboard lists' });
    }
});

app.get('/api/consumables', auth, async (req, res) => {
    try {
        const result = await query('SELECT * FROM consumables ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch consumables' });
    }
});

app.post('/api/consumables', auth, async (req, res) => {
    try {
        const { name, brand, purchase_price, quantity, unit, remaining_percentage, notes } = req.body;
        const id = await insertAndGetId(
            'INSERT INTO consumables (name, brand, purchase_price, quantity, unit, remaining_percentage, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, brand, parseFloat(purchase_price) || 0, parseInt(quantity) || 1, unit || 'unité', parseInt(remaining_percentage) || 100, notes]
        );
        res.json({ id });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create consumable' });
    }
});

app.put('/api/consumables/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, brand, purchase_price, quantity, unit, remaining_percentage, notes } = req.body;
        await query(
            'UPDATE consumables SET name = ?, brand = ?, purchase_price = ?, quantity = ?, unit = ?, remaining_percentage = ?, notes = ? WHERE id = ?',
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
        await query('DELETE FROM consumables WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete consumable' });
    }
});

app.get('/api/expenses', auth, async (req, res) => {
    try {
        const result = await query('SELECT * FROM expenses ORDER BY date DESC, created_at DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch expenses' });
    }
});

app.post('/api/expenses', auth, async (req, res) => {
    try {
        const { description, amount, category, date } = req.body;
        const id = await insertAndGetId(
            'INSERT INTO expenses (description, amount, category, date) VALUES (?, ?, ?, ?)',
            [description, parseFloat(amount) || 0, category || 'other', date || new Date().toISOString().split('T')[0]]
        );
        res.json({ id });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create expense' });
    }
});

app.put('/api/expenses/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { description, amount, category, date } = req.body;
        await query(
            'UPDATE expenses SET description = ?, amount = ?, category = ?, date = ? WHERE id = ?',
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
        await query('DELETE FROM expenses WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete expense' });
    }
});

app.get('/api/export/csv', auth, async (req, res) => {
    try {
        const bagsRes = await query('SELECT * FROM bags WHERE status = ?', ['sold']);
        const expensesRes = await query('SELECT * FROM expenses');
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

app.get('/api/brands', auth, async (req, res) => {
    try {
        const result = await query('SELECT * FROM brands ORDER BY name ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch brands' });
    }
});

app.post('/api/brands', auth, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Brand name is required' });
        const id = await insertAndGetId('INSERT INTO brands (name) VALUES (?)', [name]);
        res.json({ id, name });
    } catch (err) {
        if (err.message.includes('unique constraint') || err.message.includes('duplicate key') || err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Cette marque existe déjà' });
        }
        res.status(500).json({ error: 'Failed to create brand' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
