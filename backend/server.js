require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const stream = require('stream');
const pino = require('pino');
const pinoHttp = require('pino-http');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// --- Dual Mode Config ---
const IS_LOCAL = process.env.USE_LOCAL_MODE === 'true';

let sqlite3, open, Pool, cloudinary;

if (IS_LOCAL) {
    sqlite3 = require('sqlite3');
    open = require('sqlite').open;
    logger.info('Operating in local mode (SQLite + local uploads)');
} else {
    Pool = require('pg').Pool;
    cloudinary = require('cloudinary').v2;
    logger.info('Operating in cloud mode (PostgreSQL + Cloudinary)');
}

const app = express();
const PORT = process.env.PORT || 5000;

const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@atelier-renov.fr';
if (!JWT_SECRET || !ADMIN_PASSWORD) {
    logger.fatal('Missing JWT_SECRET or ADMIN_PASSWORD — shutting down');
    process.exit(1);
}

// --- Configuration constants ---
const FILE_SIZE_LIMIT_MB = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;   // 15 min
const LOGIN_MAX_ATTEMPTS = 10;
const API_WINDOW_MS = 60 * 1000;           // 1 min
const API_MAX_REQUESTS = 120;
const UPLOAD_WINDOW_MS = 60 * 1000;        // 1 min
const UPLOAD_MAX_REQUESTS = 20;
const BCRYPT_ROUNDS = 10;
const PG_POOL_MAX = 20;
const JWT_EXPIRES_IN = '24h';

// --- Cloudinary Config (Cloud Mode) ---
if (!IS_LOCAL) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
}

// --- Middleware ---
app.use(helmet());

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
        const isAllowed = allowed.some(o => origin === o);

        if (process.env.FRONTEND_URL === '*' || isAllowed) {
            callback(null, true);
        } else {
            logger.warn({ origin, allowed }, 'Request blocked by CORS');
            callback(new Error(`CORS: origin ${origin} not allowed`));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use(pinoHttp({ logger, redact: ['req.headers.authorization'] }));

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
    limits: { fileSize: FILE_SIZE_LIMIT_MB * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        allowed.includes(file.mimetype)
            ? cb(null, true)
            : cb(new Error('Type de fichier non autorisé. Utilisez JPEG, PNG, WebP ou GIF.'));
    }
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

const withTransaction = async (fn) => {
    if (IS_LOCAL) {
        await db.run('BEGIN');
        try {
            const result = await fn(query);
            await db.run('COMMIT');
            return result;
        } catch (err) {
            await db.run('ROLLBACK');
            throw err;
        }
    } else {
        const client = await db.connect();
        const txQuery = async (sql, params = []) => {
            let paramIndex = 1;
            const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
            return client.query(pgSql, params);
        };
        try {
            await client.query('BEGIN');
            const result = await fn(txQuery);
            await client.query('COMMIT');
            return result;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
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
                logger.error({ err }, 'Cloudinary delete error');
            }
        }
    }
};

// --- DB Init ---
async function setupDb() {
    try {
        if (IS_LOCAL) {
            db = await open({
                filename: process.env.SQLITE_PATH || './database.sqlite',
                driver: sqlite3.Database
            });
            await db.run('PRAGMA foreign_keys = ON');
            logger.info('Connected to SQLite');
        } else {
            db = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
                max: PG_POOL_MAX
            });
            logger.info('Connected to PostgreSQL');
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
                item_type TEXT DEFAULT 'Sac',
                listing_url TEXT,
                user_id INTEGER NOT NULL DEFAULT 1,
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
                created_at ${typeTimestamp},
                FOREIGN KEY (bag_id) REFERENCES bags(id) ON DELETE CASCADE
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS dashboard_lists (
                id ${typeId},
                title TEXT NOT NULL,
                filters TEXT,
                order_index INTEGER DEFAULT 0,
                user_id INTEGER NOT NULL DEFAULT 1,
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
                user_id INTEGER NOT NULL DEFAULT 1,
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
                user_id INTEGER NOT NULL DEFAULT 1,
                created_at ${typeTimestamp}
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS brands (
                id ${typeId},
                name TEXT NOT NULL,
                user_id INTEGER NOT NULL DEFAULT 1,
                created_at ${typeTimestamp},
                UNIQUE(name, user_id)
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS item_types (
                id ${typeId},
                name TEXT NOT NULL,
                user_id INTEGER NOT NULL DEFAULT 1,
                created_at ${typeTimestamp},
                UNIQUE(name, user_id)
            )
        `);



        await query(`
            CREATE TABLE IF NOT EXISTS bag_logs (
                id ${typeId},
                bag_id INTEGER,
                action TEXT NOT NULL,
                date TEXT,
                created_at ${typeTimestamp},
                FOREIGN KEY (bag_id) REFERENCES bags(id) ON DELETE CASCADE
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS bag_consumables (
                id ${typeId},
                bag_id INTEGER,
                consumable_id INTEGER,
                used_percentage REAL DEFAULT 0,
                cost_at_time REAL DEFAULT 0,
                created_at ${typeTimestamp},
                FOREIGN KEY (bag_id) REFERENCES bags(id) ON DELETE CASCADE
            )
        `);

        // Migration: add listing_url to bags (idempotent)
        try { await query('ALTER TABLE bags ADD COLUMN listing_url TEXT'); } catch(e) { /* already exists */ }

        // Migration: soft delete columns (idempotent)
        const tsType = IS_LOCAL ? 'DATETIME' : 'TIMESTAMP';
        try { await query(`ALTER TABLE bags ADD COLUMN deleted_at ${tsType}`); } catch(e) { /* already exists */ }
        try { await query(`ALTER TABLE consumables ADD COLUMN deleted_at ${tsType}`); } catch(e) { /* already exists */ }
        try { await query(`ALTER TABLE expenses ADD COLUMN deleted_at ${tsType}`); } catch(e) { /* already exists */ }

        // Migration: multi-tenancy — add user_id to data tables (idempotent)
        const userIdMigrations = [
            'ALTER TABLE users ADD COLUMN email TEXT',
            'ALTER TABLE bags ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1',
            'ALTER TABLE consumables ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1',
            'ALTER TABLE expenses ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1',
            'ALTER TABLE dashboard_lists ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1',
        ];
        for (const sql of userIdMigrations) {
            try { await query(sql); } catch(e) { /* column already exists */ }
        }

        // Migration: brands/item_types — replace UNIQUE(name) with UNIQUE(name, user_id)
        // SQLite: recreate table; PostgreSQL: add column + swap constraint
        if (IS_LOCAL) {
            const brandsInfo = await query("PRAGMA table_info(brands)");
            if (!brandsInfo.rows.some(c => c.name === 'user_id')) {
                await query(`CREATE TABLE brands_v2 (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    user_id INTEGER NOT NULL DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(name, user_id)
                )`);
                await query('INSERT INTO brands_v2 SELECT id, name, 1, created_at FROM brands');
                await query('DROP TABLE brands');
                await query('ALTER TABLE brands_v2 RENAME TO brands');
            }
            const typesInfo = await query("PRAGMA table_info(item_types)");
            if (!typesInfo.rows.some(c => c.name === 'user_id')) {
                await query(`CREATE TABLE item_types_v2 (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    user_id INTEGER NOT NULL DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(name, user_id)
                )`);
                await query('INSERT INTO item_types_v2 SELECT id, name, 1, created_at FROM item_types');
                await query('DROP TABLE item_types');
                await query('ALTER TABLE item_types_v2 RENAME TO item_types');
            }
        } else {
            try { await query('ALTER TABLE brands ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1'); } catch(e) {}
            try { await query('ALTER TABLE item_types ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1'); } catch(e) {}
            try {
                await query(`DO $$ BEGIN ALTER TABLE brands DROP CONSTRAINT brands_name_key; EXCEPTION WHEN undefined_object THEN NULL; END $$`);
                await query('CREATE UNIQUE INDEX IF NOT EXISTS brands_name_user_id ON brands(name, user_id)');
            } catch(e) {}
            try {
                await query(`DO $$ BEGIN ALTER TABLE item_types DROP CONSTRAINT item_types_name_key; EXCEPTION WHEN undefined_object THEN NULL; END $$`);
                await query('CREATE UNIQUE INDEX IF NOT EXISTS item_types_name_user_id ON item_types(name, user_id)');
            } catch(e) {}
        }

        // Migration : add FK constraints on existing PostgreSQL tables (idempotent)
        if (!IS_LOCAL) {
            const fkMigrations = [
                `DO $$ BEGIN ALTER TABLE images ADD CONSTRAINT fk_images_bag_id FOREIGN KEY (bag_id) REFERENCES bags(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
                `DO $$ BEGIN ALTER TABLE bag_logs ADD CONSTRAINT fk_bag_logs_bag_id FOREIGN KEY (bag_id) REFERENCES bags(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
                `DO $$ BEGIN ALTER TABLE bag_consumables ADD CONSTRAINT fk_bag_consumables_bag_id FOREIGN KEY (bag_id) REFERENCES bags(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
            ];
            for (const sql of fkMigrations) {
                try { await db.query(sql); } catch (e) { /* ignore */ }
            }
        }

        // Cleanup orphaned rows (belt-and-suspenders for existing data in production)
        await query('DELETE FROM images WHERE bag_id NOT IN (SELECT id FROM bags)');
        await query('DELETE FROM bag_logs WHERE bag_id NOT IN (SELECT id FROM bags)');
        await query('DELETE FROM bag_consumables WHERE bag_id NOT IN (SELECT id FROM bags)');

        await query('CREATE INDEX IF NOT EXISTS idx_images_bag_id ON images(bag_id)');
        await query('CREATE INDEX IF NOT EXISTS idx_bag_logs_bag_id ON bag_logs(bag_id)');
        await query('CREATE INDEX IF NOT EXISTS idx_bag_consumables_bag_id ON bag_consumables(bag_id)');
        await query('CREATE INDEX IF NOT EXISTS idx_bag_consumables_consumable_id ON bag_consumables(consumable_id)');
        await query('CREATE INDEX IF NOT EXISTS idx_bags_status ON bags(status)');
        await query('CREATE INDEX IF NOT EXISTS idx_bags_brand ON bags(brand)');
        await query('CREATE INDEX IF NOT EXISTS idx_bags_created_at ON bags(created_at)');

        const brandsCount = await query('SELECT COUNT(*) as count FROM brands WHERE user_id = 1');
        const count = brandsCount.rows[0].count;
        if (parseInt(count) === 0) {
            const defaultBrands = ['Hermès', 'Louis Vuitton', 'Chanel', 'Dior', 'Gucci', 'Prada', 'Celine', 'Saint Laurent', 'Fendi', 'Balenciaga'];
            for (const brand of defaultBrands) {
                try {
                    await query('INSERT INTO brands (name, user_id) VALUES (?, 1)', [brand]);
                } catch (e) { /* ignore */ }
            }
        }

        const typesCount = await query('SELECT COUNT(*) as count FROM item_types WHERE user_id = 1');
        const tCount = typesCount.rows[0].count;
        if (parseInt(tCount) === 0) {
            const defaultTypes = ['Sac', 'Chaussures', 'Petite Maroquinerie', 'Vêtements', 'Accessoires', 'Autre'];
            for (const t of defaultTypes) {
                try {
                    await query('INSERT INTO item_types (name, user_id) VALUES (?, 1)', [t]);
                } catch (e) { /* ignore */ }
            }
        }

        await query('CREATE TABLE IF NOT EXISTS users (id ' + typeId + ', username TEXT UNIQUE, email TEXT UNIQUE, password TEXT, created_at ' + typeTimestamp + ')');
        const admins = await query('SELECT * FROM users WHERE username = ?', ['admin']);
        if (admins.rows.length === 0) {
            const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);
            await query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', ['admin', ADMIN_EMAIL, hashedPassword]);
            logger.info('Admin user created');
        } else {
            // Backfill email for existing admin
            await query('UPDATE users SET email = ? WHERE username = ? AND email IS NULL', [ADMIN_EMAIL, 'admin']);
        }

        logger.info({ mode: IS_LOCAL ? 'LOCAL' : 'CLOUD' }, 'Database initialized');
    } catch (err) {
        logger.error({ err }, 'Database initialization failed');
    }
}

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
    const { name, purchase_price, target_resale_price, listing_url } = req.body;
    if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'Le nom du modèle est obligatoire' });
    }
    if (listing_url && listing_url.trim() !== '') {
        try { new URL(listing_url); } catch {
            return res.status(400).json({ error: 'L\'URL de l\'annonce n\'est pas valide' });
        }
    }
    req.body.purchase_price = parseFloat(purchase_price) || 0;
    req.body.target_resale_price = parseFloat(target_resale_price) || 0;
    req.body.actual_resale_price = parseFloat(req.body.actual_resale_price) || 0;
    req.body.fees = parseFloat(req.body.fees) || 0;
    req.body.material_costs = parseFloat(req.body.material_costs) || 0;
    if (req.body.purchase_price < 0 || req.body.target_resale_price < 0 ||
        req.body.actual_resale_price < 0 || req.body.fees < 0 || req.body.material_costs < 0) {
        return res.status(400).json({ error: 'Les prix et frais ne peuvent pas être négatifs' });
    }
    next();
};

const loginLimiter = rateLimit({
    windowMs: LOGIN_WINDOW_MS,
    max: LOGIN_MAX_ATTEMPTS,
    message: { error: 'Trop de tentatives de connexion, réessayez dans 15 minutes' }
});

const apiLimiter = rateLimit({
    windowMs: API_WINDOW_MS,
    max: API_MAX_REQUESTS,
    message: { error: 'Trop de requêtes, réessayez dans une minute' }
});

const uploadLimiter = rateLimit({
    windowMs: UPLOAD_WINDOW_MS,
    max: UPLOAD_MAX_REQUESTS,
    message: { error: "Trop d'uploads, réessayez dans une minute" }
});

app.use('/api/', apiLimiter);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post('/api/register', loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !EMAIL_REGEX.test(email)) {
            return res.status(400).json({ error: 'Email invalide' });
        }
        if (!password || password.length < 8) {
            return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
        }
        const existing = await query('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Un compte existe déjà avec cet email' });
        }
        const username = email.split('@')[0];
        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const id = await insertAndGetId(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            [username, email.toLowerCase(), hashedPassword]
        );
        const token = jwt.sign({ id, username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        res.status(201).json({ token });
    } catch (err) {
        logger.error({ err });
        res.status(500).json({ error: "Erreur lors de la création du compte" });
    }
});

app.post('/api/login', loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email et mot de passe requis' });
        }
        const result = await query('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
        const user = result.rows[0];

        if (user && await bcrypt.compare(password, user.password)) {
            const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
            return res.json({ token });
        }
        res.status(401).json({ error: 'Identifiants invalides' });
    } catch (err) {
        logger.error({ err });
        res.status(500).json({ error: 'Erreur lors de la connexion' });
    }
});

app.post('/api/change-password', auth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
        }
        const result = await query('SELECT * FROM users WHERE id = ?', [req.user.id]);
        const user = result.rows[0];

        if (user && await bcrypt.compare(currentPassword, user.password)) {
            const hashedNewPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
            await query('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, req.user.id]);
            return res.json({ success: true });
        }
        res.status(400).json({ error: 'Ancien mot de passe incorrect' });
    } catch (err) {
        res.status(500).json({ error: 'Erreur lors du changement de mot de passe' });
    }
});

async function checkBagOwnership(bagId, userId) {
    const result = await query('SELECT id FROM bags WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [bagId, userId]);
    return result.rows[0] || null;
}

app.get('/api/bags', auth, async (req, res) => {
    try {
        const bagsResult = await query('SELECT * FROM bags WHERE deleted_at IS NULL AND user_id = ? ORDER BY created_at DESC', [req.user.id]);
        const bags = bagsResult.rows;

        if (bags.length === 0) return res.json([]);

        const placeholders = bags.map(() => '?').join(', ');
        const imagesResult = await query(
            `SELECT * FROM images WHERE bag_id IN (${placeholders})`,
            bags.map(b => b.id)
        );

        const imagesByBagId = {};
        for (const img of imagesResult.rows) {
            if (!imagesByBagId[img.bag_id]) imagesByBagId[img.bag_id] = [];
            imagesByBagId[img.bag_id].push(img);
        }

        res.json(bags.map(bag => ({ ...bag, images: imagesByBagId[bag.id] || [] })));
    } catch (err) {
        logger.error({ err });
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/bags', auth, validateBag, async (req, res) => {
    try {
        const { name, brand, purchase_price, target_resale_price, status, purchase_source, is_donation, item_type, listing_url } = req.body;
        const id = await insertAndGetId(
            'INSERT INTO bags (name, brand, purchase_price, target_resale_price, status, purchase_source, is_donation, item_type, listing_url, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [name, brand, purchase_price, target_resale_price, status || 'to_be_cleaned', purchase_source, is_donation ? (IS_LOCAL ? 1 : true) : (IS_LOCAL ? 0 : false), item_type || 'Sac', listing_url || null, req.user.id]
        );
        res.json({ id });
    } catch (err) {
        logger.error({ err });
        res.status(500).json({ error: 'Erreur lors de la création' });
    }
});

app.put('/api/bags/:id', auth, validateBag, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name, brand, purchase_price, target_resale_price, actual_resale_price,
            status, purchase_date, sale_date, fees, material_costs, time_spent, notes,
            purchase_source, is_donation, item_type, listing_url
        } = req.body;

        const result = await query(
            `UPDATE bags SET
                name = ?, brand = ?, purchase_price = ?, target_resale_price = ?,
                actual_resale_price = ?, status = ?, purchase_date = ?, sale_date = ?,
                fees = ?, material_costs = ?, time_spent = ?, notes = ?,
                purchase_source = ?, is_donation = ?, item_type = ?, listing_url = ?
            WHERE id = ? AND user_id = ?`,
            [name, brand, purchase_price, target_resale_price, actual_resale_price, status, purchase_date, sale_date, fees, material_costs, time_spent, notes, purchase_source, is_donation ? (IS_LOCAL ? 1 : true) : (IS_LOCAL ? 0 : false), item_type || '', listing_url || null, id, req.user.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'Article non trouvé' });
        res.json({ success: true });
    } catch (err) {
        logger.error({ err });
        res.status(500).json({ error: 'Erreur lors de la mise à jour' });
    }
});

app.delete('/api/bags/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query(
            'UPDATE bags SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
            [id, req.user.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'Article non trouvé' });
        res.json({ success: true });
    } catch (err) {
        logger.error({ err });
        res.status(500).json({ error: 'Erreur lors de la suppression' });
    }
});

app.get('/api/bags/:id/logs', auth, async (req, res) => {
    try {
        if (!await checkBagOwnership(req.params.id, req.user.id)) return res.status(404).json({ error: 'Article non trouvé' });
        const result = await query('SELECT * FROM bag_logs WHERE bag_id = ? ORDER BY date DESC, created_at DESC', [req.params.id]);
        res.json(result.rows);
    } catch (err) {
        logger.error({ err });
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/bags/:id/logs', auth, async (req, res) => {
    try {
        if (!await checkBagOwnership(req.params.id, req.user.id)) return res.status(404).json({ error: 'Article non trouvé' });
        const { action, date } = req.body;
        const id = await insertAndGetId(
            'INSERT INTO bag_logs (bag_id, action, date) VALUES (?, ?, ?)',
            [req.params.id, action, date]
        );
        const newLog = await query('SELECT * FROM bag_logs WHERE id = ?', [id]);
        res.json(newLog.rows[0]);
    } catch (err) {
        logger.error({ err });
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/logs/:id', auth, async (req, res) => {
    try {
        const logResult = await query('SELECT bag_id FROM bag_logs WHERE id = ?', [req.params.id]);
        const log = logResult.rows[0];
        if (!log) return res.status(404).json({ error: 'Entrée non trouvée' });
        if (!await checkBagOwnership(log.bag_id, req.user.id)) return res.status(404).json({ error: 'Non autorisé' });
        await query('DELETE FROM bag_logs WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        logger.error({ err });
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/bags/:id/consumables', auth, async (req, res) => {
    try {
        if (!await checkBagOwnership(req.params.id, req.user.id)) return res.status(404).json({ error: 'Article non trouvé' });
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
        logger.error({ err });
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/bags/:id/consumables', auth, async (req, res) => {
    try {
        if (!await checkBagOwnership(req.params.id, req.user.id)) return res.status(404).json({ error: 'Article non trouvé' });
        const { consumable_id, usage_percent } = req.body;
        const bag_id = req.params.id;

        const usagePct = parseFloat(usage_percent) || 0;
        if (usagePct <= 0 || usagePct > 100) {
            return res.status(400).json({ error: "Le pourcentage d'utilisation doit être entre 1 et 100" });
        }

        const cResult = await query('SELECT * FROM consumables WHERE id = ? AND deleted_at IS NULL', [consumable_id]);
        const consumable = cResult.rows[0];
        if (!consumable) return res.status(404).json({ error: 'Produit introuvable' });

        const cost = parseFloat(((consumable.purchase_price || 0) * (usagePct / 100)).toFixed(4));

        await withTransaction(async (txQuery) => {
            // UPDATE conditionnel atomique : échoue si stock insuffisant au moment du commit (élimine la race condition)
            const stockResult = await txQuery(
                'UPDATE consumables SET remaining_percentage = remaining_percentage - ? WHERE id = ? AND remaining_percentage >= ?',
                [usagePct, consumable_id, usagePct]
            );
            if (stockResult.rowCount === 0) {
                throw Object.assign(new Error('Stock insuffisant'), { code: 'STOCK_INSUFFISANT' });
            }
            await txQuery(
                'INSERT INTO bag_consumables (bag_id, consumable_id, used_percentage, cost_at_time) VALUES (?, ?, ?, ?)',
                [bag_id, consumable_id, usagePct, cost]
            );
            await txQuery(
                'UPDATE bags SET material_costs = material_costs + ? WHERE id = ?',
                [cost, bag_id]
            );
        });

        res.json({ success: true, cost_added: cost });

    } catch (err) {
        if (err.code === 'STOCK_INSUFFISANT') {
            return res.status(400).json({ error: 'Stock insuffisant' });
        }
        logger.error({ err });
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/bag-consumables/:id', auth, async (req, res) => {
    try {
        const result = await query('SELECT * FROM bag_consumables WHERE id = ?', [req.params.id]);
        const link = result.rows[0];
        if (!link) return res.status(404).json({ error: 'Liaison non trouvée' });
        if (!await checkBagOwnership(link.bag_id, req.user.id)) return res.status(404).json({ error: 'Non autorisé' });

        await withTransaction(async (txQuery) => {
            await txQuery(
                'UPDATE bags SET material_costs = material_costs - ? WHERE id = ?',
                [link.cost_at_time, link.bag_id]
            );
            if (link.consumable_id) {
                await txQuery(
                    'UPDATE consumables SET remaining_percentage = remaining_percentage + ? WHERE id = ?',
                    [link.used_percentage, link.consumable_id]
                );
            }
            await txQuery('DELETE FROM bag_consumables WHERE id = ?', [req.params.id]);
        });

        res.json({ success: true });

    } catch (err) {
        logger.error({ err });
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/bags/:id/images', auth, async (req, res) => {
    try {
        const { id } = req.params;
        if (!await checkBagOwnership(id, req.user.id)) return res.status(404).json({ error: 'Article non trouvé' });
        const { url, type, public_id } = req.body;
        const imageId = await insertAndGetId(
            'INSERT INTO images (bag_id, url, type, public_id) VALUES (?, ?, ?, ?)',
            [id, url, type, public_id]
        );
        res.json({ id: imageId, url });
    } catch (err) {
        logger.error({ err });
        res.status(500).json({ error: 'Erreur lors de l\'ajout de l\'image' });
    }
});

app.delete('/api/images/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query('SELECT * FROM images WHERE id = ?', [id]);
        const img = result.rows[0];
        if (img) {
            if (!await checkBagOwnership(img.bag_id, req.user.id)) return res.status(404).json({ error: 'Non autorisé' });
            await deleteImage(img);
            await query('DELETE FROM images WHERE id = ?', [id]);
        }
        res.json({ success: true });
    } catch (err) {
        logger.error({ err });
        res.status(500).json({ error: 'Erreur lors de la suppression de l\'image' });
    }
});

app.post('/api/upload', auth, uploadLimiter, (req, res, next) => {
    upload.single('image')(req, res, (err) => {
        if (err) return res.status(400).json({ error: err.message });
        next();
    });
}, async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const result = await saveImage(req.file.buffer);
        res.json(result); // { url, public_id }
    } catch (err) {
        logger.error({ err }, 'Image processing failed');
        res.status(500).json({ error: 'Erreur lors du traitement de l\'image' });
    }
});

app.get('/api/dashboard-lists', auth, async (req, res) => {
    try {
        const result = await query('SELECT * FROM dashboard_lists WHERE user_id = ? ORDER BY order_index ASC', [req.user.id]);
        res.json(result.rows.map(l => {
            let filters = [];
            try { filters = JSON.parse(l.filters || '[]'); } catch {}
            return { ...l, filters };
        }));
    } catch (err) {
        res.status(500).json({ error: 'Erreur lors du chargement des listes' });
    }
});

app.post('/api/dashboard-lists', auth, async (req, res) => {
    try {
        const { title, filters, order_index } = req.body;
        const id = await insertAndGetId(
            'INSERT INTO dashboard_lists (title, filters, order_index, user_id) VALUES (?, ?, ?, ?)',
            [title, JSON.stringify(filters || []), order_index || 0, req.user.id]
        );
        res.json({ id });
    } catch (err) {
        res.status(500).json({ error: 'Erreur lors de la création de la liste' });
    }
});

app.put('/api/dashboard-lists/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, filters, order_index } = req.body;
        await query(
            'UPDATE dashboard_lists SET title = ?, filters = ?, order_index = ? WHERE id = ? AND user_id = ?',
            [title, JSON.stringify(filters || []), order_index || 0, id, req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erreur lors de la mise à jour de la liste' });
    }
});

app.delete('/api/dashboard-lists/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        await query('DELETE FROM dashboard_lists WHERE id = ? AND user_id = ?', [id, req.user.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erreur lors de la suppression de la liste' });
    }
});

app.post('/api/dashboard-lists/reorder', auth, async (req, res) => {
    try {
        const { orders } = req.body;
        await Promise.all(orders.map(item =>
            query('UPDATE dashboard_lists SET order_index = ? WHERE id = ? AND user_id = ?', [item.order_index, item.id, req.user.id])
        ));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erreur lors de la réorganisation des listes' });
    }
});

app.get('/api/consumables', auth, async (req, res) => {
    try {
        const result = await query('SELECT * FROM consumables WHERE deleted_at IS NULL AND user_id = ? ORDER BY created_at DESC', [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Erreur lors du chargement des produits' });
    }
});

app.post('/api/consumables', auth, async (req, res) => {
    try {
        const { name, brand, purchase_price, quantity, unit, remaining_percentage, notes } = req.body;
        if (!name || name.trim() === '') return res.status(400).json({ error: 'Le nom du produit est obligatoire' });
        const price = parseFloat(purchase_price) || 0;
        if (price < 0) return res.status(400).json({ error: 'Le prix ne peut pas être négatif' });
        const pct = Math.max(0, Math.min(100, parseInt(remaining_percentage) ?? 100));
        const id = await insertAndGetId(
            'INSERT INTO consumables (name, brand, purchase_price, quantity, unit, remaining_percentage, notes, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [name, brand, price, parseInt(quantity) || 1, unit || 'unité', pct, notes, req.user.id]
        );
        res.json({ id });
    } catch (err) {
        res.status(500).json({ error: 'Erreur lors de la création du produit' });
    }
});

app.put('/api/consumables/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, brand, purchase_price, quantity, unit, remaining_percentage, notes } = req.body;
        if (!name || name.trim() === '') return res.status(400).json({ error: 'Le nom du produit est obligatoire' });
        const price = parseFloat(purchase_price) || 0;
        if (price < 0) return res.status(400).json({ error: 'Le prix ne peut pas être négatif' });
        const pct = Math.max(0, Math.min(100, parseInt(remaining_percentage) ?? 100));
        await query(
            'UPDATE consumables SET name = ?, brand = ?, purchase_price = ?, quantity = ?, unit = ?, remaining_percentage = ?, notes = ? WHERE id = ? AND user_id = ?',
            [name, brand, price, parseInt(quantity) || 1, unit || 'unité', pct, notes, id, req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erreur lors de la mise à jour du produit' });
    }
});

app.delete('/api/consumables/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query(
            'UPDATE consumables SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
            [id, req.user.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'Produit non trouvé' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erreur lors de la suppression du produit' });
    }
});

app.get('/api/expenses', auth, async (req, res) => {
    try {
        const result = await query('SELECT * FROM expenses WHERE deleted_at IS NULL AND user_id = ? ORDER BY date DESC, created_at DESC', [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Erreur lors du chargement des dépenses' });
    }
});

app.post('/api/expenses', auth, async (req, res) => {
    try {
        const { description, amount, category, date } = req.body;
        if (!description || description.trim() === '') return res.status(400).json({ error: 'La description est obligatoire' });
        const amt = parseFloat(amount) || 0;
        if (amt < 0) return res.status(400).json({ error: 'Le montant ne peut pas être négatif' });
        const id = await insertAndGetId(
            'INSERT INTO expenses (description, amount, category, date, user_id) VALUES (?, ?, ?, ?, ?)',
            [description, amt, category || 'other', date || new Date().toISOString().split('T')[0], req.user.id]
        );
        res.json({ id });
    } catch (err) {
        res.status(500).json({ error: 'Erreur lors de la création de la dépense' });
    }
});

app.put('/api/expenses/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { description, amount, category, date } = req.body;
        await query(
            'UPDATE expenses SET description = ?, amount = ?, category = ?, date = ? WHERE id = ? AND user_id = ?',
            [description, parseFloat(amount) || 0, category || 'other', date || new Date().toISOString().split('T')[0], id, req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erreur lors de la mise à jour de la dépense' });
    }
});

app.delete('/api/expenses/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query(
            'UPDATE expenses SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
            [id, req.user.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'Dépense non trouvée' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erreur lors de la suppression de la dépense' });
    }
});

app.get('/api/stats/monthly', auth, async (req, res) => {
    try {
        const salesSql = IS_LOCAL
            ? `SELECT substr(sale_date, 1, 7) as month,
                 COUNT(*) as count,
                 ROUND(SUM(actual_resale_price), 2) as revenue,
                 ROUND(SUM(actual_resale_price - purchase_price - fees - material_costs), 2) as profit
               FROM bags
               WHERE status = 'sold' AND sale_date IS NOT NULL AND sale_date != '' AND deleted_at IS NULL AND user_id = ?
               GROUP BY substr(sale_date, 1, 7)
               ORDER BY month ASC`
            : `SELECT substring(sale_date, 1, 7) as month,
                 COUNT(*) as count,
                 ROUND(SUM(actual_resale_price)::numeric, 2) as revenue,
                 ROUND(SUM(actual_resale_price - purchase_price - fees - material_costs)::numeric, 2) as profit
               FROM bags
               WHERE status = 'sold' AND sale_date IS NOT NULL AND sale_date != '' AND deleted_at IS NULL AND user_id = ?
               GROUP BY substring(sale_date, 1, 7)
               ORDER BY month ASC`;

        const expensesSql = IS_LOCAL
            ? `SELECT substr(date, 1, 7) as month, ROUND(SUM(amount), 2) as expenses
               FROM expenses WHERE date IS NOT NULL AND date != '' AND deleted_at IS NULL AND user_id = ?
               GROUP BY substr(date, 1, 7)
               ORDER BY month ASC`
            : `SELECT substring(date, 1, 7) as month, ROUND(SUM(amount)::numeric, 2) as expenses
               FROM expenses WHERE date IS NOT NULL AND date != '' AND deleted_at IS NULL AND user_id = ?
               GROUP BY substring(date, 1, 7)
               ORDER BY month ASC`;

        const [salesResult, expensesResult] = await Promise.all([
            query(salesSql, [req.user.id]),
            query(expensesSql, [req.user.id])
        ]);

        const months = new Map();
        for (const row of salesResult.rows) {
            months.set(row.month, {
                month: row.month,
                revenue: parseFloat(row.revenue) || 0,
                profit: parseFloat(row.profit) || 0,
                count: parseInt(row.count) || 0,
                expenses: 0
            });
        }
        for (const row of expensesResult.rows) {
            if (months.has(row.month)) {
                months.get(row.month).expenses = parseFloat(row.expenses) || 0;
            } else {
                months.set(row.month, { month: row.month, revenue: 0, profit: 0, count: 0, expenses: parseFloat(row.expenses) || 0 });
            }
        }

        res.json(Array.from(months.values()).sort((a, b) => a.month.localeCompare(b.month)));
    } catch (err) {
        logger.error({ err });
        res.status(500).json({ error: 'Internal server error' });
    }
});

function csvEscape(value) {
    const str = String(value ?? '');
    if (/^[=+\-@]/.test(str) || str.includes(';') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

app.get('/api/export/csv', auth, async (req, res) => {
    try {
        const bagsRes = await query('SELECT * FROM bags WHERE status = ? AND deleted_at IS NULL AND user_id = ?', ['sold', req.user.id]);
        const expensesRes = await query('SELECT * FROM expenses WHERE deleted_at IS NULL AND user_id = ?', [req.user.id]);
        const bags = bagsRes.rows;
        const expenses = expensesRes.rows;

        let csv = 'Type;Date;Description;Montant;Marge\n';

        bags.forEach(b => {
            const margin = b.actual_resale_price - b.purchase_price - b.fees - b.material_costs;
            csv += `Vente;${csvEscape(b.sale_date || b.created_at)};${csvEscape((b.brand || '') + ' ' + (b.name || ''))};${b.actual_resale_price};${margin.toFixed(2)}\n`;
        });

        expenses.forEach(e => {
            csv += `Dépense;${csvEscape(e.date)};${csvEscape(e.description)};-${e.amount};0\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=tableau_de_bord.csv');
        res.send(csv);
    } catch (err) {
        res.status(500).json({ error: 'Erreur lors de l\'export CSV' });
    }
});

app.get('/api/brands', auth, async (req, res) => {
    try {
        const result = await query('SELECT * FROM brands WHERE user_id = ? ORDER BY name ASC', [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Erreur lors du chargement des marques' });
    }
});



app.get('/api/item-types', auth, async (req, res) => {
    try {
        const result = await query('SELECT * FROM item_types WHERE user_id = ? ORDER BY name ASC', [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Erreur lors du chargement des types' });
    }
});

app.post('/api/item-types', auth, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Le nom est obligatoire' });
        const existing = await query('SELECT id FROM item_types WHERE name = ? AND user_id = ?', [name, req.user.id]);
        if (existing.rows.length > 0) return res.status(400).json({ error: 'Ce type existe déjà' });
        const id = await insertAndGetId('INSERT INTO item_types (name, user_id) VALUES (?, ?)', [name, req.user.id]);
        res.json({ id });
    } catch (err) {
        res.status(500).json({ error: 'Erreur lors de la création du type' });
    }
});

app.post('/api/brands', auth, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Le nom de la marque est obligatoire' });
        const existing = await query('SELECT id FROM brands WHERE name = ? AND user_id = ?', [name, req.user.id]);
        if (existing.rows.length > 0) return res.status(400).json({ error: 'Cette marque existe déjà' });
        const id = await insertAndGetId('INSERT INTO brands (name, user_id) VALUES (?, ?)', [name, req.user.id]);
        res.json({ id, name });
    } catch (err) {
        res.status(500).json({ error: 'Erreur lors de la création de la marque' });
    }
});

app.put('/api/brands/:id', auth, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Le nom est obligatoire' });
        await query('UPDATE brands SET name = ? WHERE id = ? AND user_id = ?', [name, req.params.id, req.user.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erreur lors de la mise à jour de la marque' });
    }
});

app.delete('/api/brands/:id', auth, async (req, res) => {
    try {
        const brandResult = await query('SELECT name FROM brands WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        if (brandResult.rows.length === 0) return res.status(404).json({ error: 'Marque non trouvée' });
        const brandName = brandResult.rows[0].name;
        const usageResult = await query('SELECT COUNT(*) as count FROM bags WHERE brand = ? AND user_id = ? AND deleted_at IS NULL', [brandName, req.user.id]);
        const count = parseInt(usageResult.rows[0].count) || 0;
        if (count > 0) return res.status(409).json({ error: `Cette marque est utilisée par ${count} article(s). Supprimez ou modifiez ces articles d'abord.` });
        await query('DELETE FROM brands WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erreur lors de la suppression de la marque' });
    }
});

app.put('/api/item-types/:id', auth, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Le nom est obligatoire' });
        await query('UPDATE item_types SET name = ? WHERE id = ? AND user_id = ?', [name, req.params.id, req.user.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erreur lors de la mise à jour du type' });
    }
});

app.delete('/api/item-types/:id', auth, async (req, res) => {
    try {
        const typeResult = await query('SELECT name FROM item_types WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        if (typeResult.rows.length === 0) return res.status(404).json({ error: 'Type non trouvé' });
        const typeName = typeResult.rows[0].name;
        const usageResult = await query('SELECT COUNT(*) as count FROM bags WHERE item_type = ? AND user_id = ? AND deleted_at IS NULL', [typeName, req.user.id]);
        const count = parseInt(usageResult.rows[0].count) || 0;
        if (count > 0) return res.status(409).json({ error: `Ce type est utilisé par ${count} article(s). Supprimez ou modifiez ces articles d'abord.` });
        await query('DELETE FROM item_types WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erreur lors de la suppression du type' });
    }
});

app.get('/api/bags/:id', auth, async (req, res) => {
    try {
        const bagResult = await query('SELECT * FROM bags WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [req.params.id, req.user.id]);
        if (bagResult.rows.length === 0) return res.status(404).json({ error: 'Article non trouvé' });
        const bag = bagResult.rows[0];
        const imagesResult = await query('SELECT * FROM images WHERE bag_id = ?', [bag.id]);
        res.json({ ...bag, images: imagesResult.rows });
    } catch (err) {
        res.status(500).json({ error: 'Erreur lors du chargement de l\'article' });
    }
});

async function closeDb() {
    if (!db) return;
    if (IS_LOCAL) {
        await db.close();
    } else {
        await db.end();
    }
    db = null;
}

async function start() {
    await setupDb();
    app.listen(PORT, () => {
        logger.info({ port: PORT }, 'Server started');
    });
}

if (require.main === module) {
    start().catch(err => {
        logger.fatal({ err }, 'Failed to start server');
        process.exit(1);
    });
}

module.exports = { app, setupDb, closeDb };
