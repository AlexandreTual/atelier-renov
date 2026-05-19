import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'

// --- Constants ---
// bcrypt rounds intentionally lower than Node.js (10) — Workers have CPU time limits
const BCRYPT_ROUNDS = 8
const JWT_EXPIRES = '7d'
const VALID_STATUSES = new Set(['to_be_cleaned','cleaning','repairing','drying','ready_for_sale','selling','sold'])
const SORT_MAP = {
    date_desc: 'created_at DESC',
    date_asc:  'created_at ASC',
    brand:     'brand ASC',
    price_asc: 'purchase_price ASC',
    price_desc:'purchase_price DESC',
}
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000

// --- D1 abstraction ---
function makeDb(DB) {
    async function query(sql, params = []) {
        const stmt = params.length ? DB.prepare(sql).bind(...params) : DB.prepare(sql)
        const result = await stmt.all()
        return { rows: result.results, rowCount: result.results.length }
    }
    async function insertAndGetId(sql, params = []) {
        const stmt = params.length ? DB.prepare(sql).bind(...params) : DB.prepare(sql)
        const result = await stmt.run()
        return result.meta.last_row_id
    }
    async function run(sql, params = []) {
        const stmt = params.length ? DB.prepare(sql).bind(...params) : DB.prepare(sql)
        return stmt.run()
    }
    // Atomic batch writes (D1 batch runs all statements or none)
    function prepare(sql) { return DB.prepare(sql) }
    return { query, insertAndGetId, run, prepare, DB }
}

// --- Cloudinary helpers (REST API — no native SDK needed) ---
async function cloudinarySign(params, apiSecret) {
    const toSign = Object.keys(params).sort()
        .filter(k => params[k] !== undefined && params[k] !== '')
        .map(k => `${k}=${params[k]}`)
        .join('&') + apiSecret
    const hashBuffer = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(toSign))
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function cloudinaryUpload(buffer, env) {
    const timestamp = Math.floor(Date.now() / 1000)
    const params = { folder: 'atelier-renov', timestamp }
    const signature = await cloudinarySign(params, env.CLOUDINARY_API_SECRET)

    const fd = new FormData()
    fd.append('file', new Blob([buffer]))
    fd.append('folder', params.folder)
    fd.append('timestamp', String(timestamp))
    fd.append('api_key', env.CLOUDINARY_API_KEY)
    fd.append('signature', signature)

    const resp = await fetch(
        `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: 'POST', body: fd }
    )
    if (!resp.ok) throw new Error('Cloudinary upload failed: ' + await resp.text())
    const data = await resp.json()
    // Apply WebP + resize transformation in the delivery URL (Cloudinary on-the-fly)
    const url = data.secure_url.replace('/upload/', '/upload/c_limit,w_1200,h_1200,f_webp,q_80/')
    return { url, public_id: data.public_id }
}

async function cloudinaryDelete(publicId, env) {
    if (!publicId) return
    try {
        const timestamp = Math.floor(Date.now() / 1000)
        const params = { public_id: publicId, timestamp }
        const signature = await cloudinarySign(params, env.CLOUDINARY_API_SECRET)

        const fd = new FormData()
        fd.append('public_id', publicId)
        fd.append('timestamp', String(timestamp))
        fd.append('api_key', env.CLOUDINARY_API_KEY)
        fd.append('signature', signature)

        await fetch(
            `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/destroy`,
            { method: 'POST', body: fd }
        )
    } catch (err) {
        console.error('Cloudinary delete error:', err)
    }
}

// --- JWT helpers ---
async function signJwt(payload, secret) {
    return new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime(JWT_EXPIRES)
        .sign(new TextEncoder().encode(secret))
}
async function verifyJwt(token, secret) {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret))
    return payload
}

// --- Crypto helpers (Web Crypto — no Node.js required) ---
function randomHex(bytes = 32) {
    const buf = new Uint8Array(bytes)
    crypto.getRandomValues(buf)
    return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('')
}
async function sha256Hex(str) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// --- Seed default data for a new user ---
async function seedDefaultDataForUser(db, userId) {
    const brands = ['Hermès', 'Louis Vuitton', 'Chanel', 'Dior', 'Gucci', 'Prada', 'Céline', 'Saint Laurent', 'Fendi', 'Balenciaga']
    const types  = ['Sac', 'Chaussures', 'Petite Maroquinerie', 'Vêtements', 'Accessoires', 'Autre']
    for (const name of brands) {
        try { await db.run('INSERT OR IGNORE INTO brands (name, user_id) VALUES (?, ?)', [name, userId]) } catch {}
    }
    for (const name of types) {
        try { await db.run('INSERT OR IGNORE INTO item_types (name, user_id) VALUES (?, ?)', [name, userId]) } catch {}
    }
}

// Ensure admin user exists (called lazily on first login so first-boot just works)
async function ensureAdmin(db, env) {
    const admins = await db.query('SELECT id FROM users WHERE username = ?', ['admin'])
    if (admins.rows.length === 0) {
        const hashed = await bcrypt.hash(env.ADMIN_PASSWORD, BCRYPT_ROUNDS)
        const adminEmail = env.ADMIN_EMAIL || 'admin@atelier-renov.fr'
        const id = await db.insertAndGetId(
            'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
            ['admin', adminEmail, hashed, 'admin']
        )
        await seedDefaultDataForUser(db, id)
    }
}

// --- CSV escape ---
function csvEscape(value) {
    const str = String(value ?? '')
    if (/^[=+\-@]/.test(str) || str.includes(';') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"'
    }
    return str
}

// --- Hono app ---
const app = new Hono()

// CORS middleware
app.use('/api/*', async (c, next) => {
    const origin = c.req.header('origin')
    const allowed = [
        c.env.FRONTEND_URL,
        'http://localhost:5173',
        'http://localhost:8081',
    ].filter(Boolean)

    const corsOrigin = (origin && allowed.some(o => origin === o)) ? origin : null

    if (c.req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin':  corsOrigin || '',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Max-Age': '86400',
            },
        })
    }

    if (origin && !corsOrigin) {
        return c.json({ error: 'CORS: origin not allowed' }, 403)
    }

    if (corsOrigin) {
        c.header('Access-Control-Allow-Origin', corsOrigin)
        c.header('Access-Control-Allow-Credentials', 'true')
        c.header('Vary', 'Origin')
    }

    await next()
})

// Security headers
app.use('*', async (c, next) => {
    c.header('X-Content-Type-Options', 'nosniff')
    c.header('X-Frame-Options', 'DENY')
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
    c.header('X-XSS-Protection', '1; mode=block')
    await next()
})

// Auth middleware
const auth = async (c, next) => {
    const token = c.req.header('authorization')?.split(' ')[1]
    if (!token) return c.json({ error: 'Accès non autorisé' }, 401)
    try {
        const user = await verifyJwt(token, c.env.JWT_SECRET)
        c.set('user', user)
        await next()
    } catch {
        return c.json({ error: 'Session expirée' }, 403)
    }
}

const requireAdmin = async (c, next) => {
    const db = makeDb(c.env.DB)
    const result = await db.query('SELECT role FROM users WHERE id = ?', [c.get('user').id])
    if (result.rows[0]?.role !== 'admin') return c.json({ error: 'Accès réservé aux administrateurs' }, 403)
    await next()
}

// Bag ownership check
async function checkBagOwnership(db, bagId, userId) {
    const result = await db.query(
        'SELECT id FROM bags WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
        [bagId, userId]
    )
    return result.rows[0] || null
}

// Bag body validation
function parseBagBody(body) {
    const { name, listing_url } = body
    if (!name || String(name).trim() === '') return { error: 'Le nom du modèle est obligatoire' }
    if (listing_url && String(listing_url).trim()) {
        try { new URL(listing_url) } catch { return { error: "L'URL de l'annonce n'est pas valide" } }
    }
    const p = (v) => parseFloat(v) || 0
    const parsed = {
        ...body,
        purchase_price:       p(body.purchase_price),
        target_resale_price:  p(body.target_resale_price),
        actual_resale_price:  p(body.actual_resale_price),
        fees:                 p(body.fees),
        material_costs:       p(body.material_costs),
    }
    if (parsed.purchase_price < 0 || parsed.target_resale_price < 0 ||
        parsed.actual_resale_price < 0 || parsed.fees < 0 || parsed.material_costs < 0) {
        return { error: 'Les prix et frais ne peuvent pas être négatifs' }
    }
    return { data: parsed }
}

// --- Health ---
app.get('/api/health', (c) => c.json({ status: 'ok' }))

// =============================================================================
// AUTH ROUTES
// =============================================================================

app.post('/api/register', async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const { email, password } = await c.req.json()
        if (!email || !EMAIL_REGEX.test(email)) return c.json({ error: 'Email invalide' }, 400)
        if (!password || password.length < 8) return c.json({ error: 'Le mot de passe doit contenir au moins 8 caractères' }, 400)

        const existing = await db.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase()])
        if (existing.rows.length > 0) return c.json({ error: 'Un compte existe déjà avec cet email' }, 409)

        const username = email.split('@')[0]
        const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS)
        const id = await db.insertAndGetId(
            'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
            [username, email.toLowerCase(), hashed, 'user']
        )
        await seedDefaultDataForUser(db, id)

        if (c.env.RESEND_API_KEY) {
            const { Resend } = await import('resend')
            const resend = new Resend(c.env.RESEND_API_KEY)
            const from = c.env.RESEND_FROM || 'onboarding@resend.dev'
            resend.emails.send({
                from, to: email,
                subject: "Bienvenue sur Atelier Rénov' !",
                html: `<div style="font-family:sans-serif;max-width:480px;margin:auto">
                    <h2 style="color:#1a1a2e">Bienvenue sur Atelier Rénov' !</h2>
                    <p>Votre compte a bien été créé. Commencez dès maintenant à gérer vos articles de luxe.</p>
                    <a href="${c.env.FRONTEND_URL}" style="display:inline-block;margin:1rem 0;padding:.75rem 1.5rem;background:#c9a84c;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold">
                        Accéder à l'application
                    </a></div>`
            }).catch(err => console.error('Welcome email error:', err))
        }

        const token = await signJwt({ id, username }, c.env.JWT_SECRET)
        return c.json({ token }, 201)
    } catch (err) {
        console.error('Register:', err)
        return c.json({ error: 'Erreur lors de la création du compte' }, 500)
    }
})

app.post('/api/login', async (c) => {
    try {
        const db = makeDb(c.env.DB)
        await ensureAdmin(db, c.env)

        const { email, password } = await c.req.json()
        if (!email || !password) return c.json({ error: 'Email et mot de passe requis' }, 400)

        const result = await db.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase()])
        const user = result.rows[0]

        if (user && await bcrypt.compare(password, user.password)) {
            const token = await signJwt({ id: user.id, username: user.username }, c.env.JWT_SECRET)
            return c.json({ token })
        }
        return c.json({ error: 'Identifiants invalides' }, 401)
    } catch (err) {
        console.error('Login:', err)
        return c.json({ error: 'Erreur lors de la connexion' }, 500)
    }
})

app.post('/api/forgot-password', async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const body = await c.req.json().catch(() => ({}))
        const { email } = body
        if (!email) return c.json({ success: true })

        const result = await db.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase()])
        const user = result.rows[0]
        if (!user) return c.json({ success: true })  // Don't reveal email existence

        const rawToken = randomHex(32)
        const tokenHash = await sha256Hex(rawToken)
        const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString()

        await db.run(
            'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
            [user.id, tokenHash, expiresAt]
        )

        const resetUrl = `${c.env.FRONTEND_URL}/reset-password?token=${rawToken}`

        if (c.env.RESEND_API_KEY) {
            const { Resend } = await import('resend')
            const resend = new Resend(c.env.RESEND_API_KEY)
            const from = c.env.RESEND_FROM || 'onboarding@resend.dev'
            await resend.emails.send({
                from, to: email,
                subject: "Réinitialisation de votre mot de passe — Atelier Rénov'",
                html: `<div style="font-family:sans-serif;max-width:480px;margin:auto">
                    <h2 style="color:#1a1a2e">Réinitialisation du mot de passe</h2>
                    <p>Cliquez sur le bouton ci-dessous. Ce lien est valable <strong>1 heure</strong>.</p>
                    <a href="${resetUrl}" style="display:inline-block;margin:1rem 0;padding:.75rem 1.5rem;background:#c9a84c;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold">
                        Réinitialiser mon mot de passe
                    </a>
                    <p style="color:#888;font-size:.85rem">Si vous n'avez pas demandé cette réinitialisation, ignorez ce message.</p>
                </div>`
            })
        } else {
            console.log('DEV — reset URL:', resetUrl)
        }

        return c.json({ success: true })
    } catch (err) {
        console.error('Forgot password:', err)
        return c.json({ error: "Erreur lors de l'envoi" }, 500)
    }
})

app.post('/api/reset-password', async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const { token, password } = await c.req.json()
        if (!token || !password || password.length < 8) {
            return c.json({ error: 'Token et mot de passe (min 8 caractères) requis' }, 400)
        }

        const tokenHash = await sha256Hex(token)
        const result = await db.query(
            'SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL',
            [tokenHash]
        )
        const record = result.rows[0]
        if (!record || new Date(record.expires_at) < new Date()) {
            return c.json({ error: 'Lien invalide ou expiré' }, 400)
        }

        const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS)
        await db.run('UPDATE users SET password = ? WHERE id = ?', [hashed, record.user_id])
        await db.run('UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?', [record.id])

        return c.json({ success: true })
    } catch (err) {
        console.error('Reset password:', err)
        return c.json({ error: 'Erreur lors de la réinitialisation' }, 500)
    }
})

app.post('/api/change-password', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const { currentPassword, newPassword } = await c.req.json()
        if (!newPassword || newPassword.length < 8) {
            return c.json({ error: 'Le mot de passe doit contenir au moins 8 caractères' }, 400)
        }
        const result = await db.query('SELECT * FROM users WHERE id = ?', [c.get('user').id])
        const user = result.rows[0]
        if (user && await bcrypt.compare(currentPassword, user.password)) {
            const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
            await db.run('UPDATE users SET password = ? WHERE id = ?', [hashed, c.get('user').id])
            return c.json({ success: true })
        }
        return c.json({ error: 'Ancien mot de passe incorrect' }, 400)
    } catch (err) {
        return c.json({ error: 'Erreur lors du changement de mot de passe' }, 500)
    }
})

app.get('/api/me', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const userResult = await db.query(
            'SELECT id, email, username, onboarding_done, role FROM users WHERE id = ?',
            [c.get('user').id]
        )
        const user = userResult.rows[0]
        if (!user) return c.json({ error: 'Utilisateur introuvable' }, 404)
        const configResult = await db.query('SELECT onboarding_enabled FROM app_config WHERE id = 1')
        const onboarding_enabled = configResult.rows[0]?.onboarding_enabled ?? 1
        return c.json({ ...user, onboarding_enabled })
    } catch (err) {
        return c.json({ error: 'Erreur serveur' }, 500)
    }
})

app.post('/api/onboarding/complete', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        await db.run('UPDATE users SET onboarding_done = 1 WHERE id = ?', [c.get('user').id])
        return c.json({ success: true })
    } catch (err) {
        return c.json({ error: 'Erreur serveur' }, 500)
    }
})

// =============================================================================
// BAGS
// =============================================================================

app.get('/api/bags/stats', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const result = await db.query(`
            SELECT
                COALESCE(SUM(CASE WHEN status = 'sold'
                    THEN actual_resale_price - purchase_price - fees - material_costs
                    ELSE 0 END), 0) as total_profit,
                COUNT(CASE WHEN status IN ('cleaning','repairing','drying') THEN 1 ELSE NULL END) as active_renovations,
                COALESCE(SUM(CASE WHEN status != 'sold' THEN target_resale_price ELSE 0 END), 0) as stock_value_est,
                COALESCE(SUM(CASE WHEN status != 'sold' THEN purchase_price + material_costs ELSE 0 END), 0) as capital_immobilized
            FROM bags WHERE deleted_at IS NULL AND user_id = ?
        `, [c.get('user').id])
        const row = result.rows[0]
        return c.json({
            totalProfit:        parseFloat(row.total_profit)        || 0,
            activeRenovations:  parseInt(row.active_renovations)    || 0,
            stockValueEst:      parseFloat(row.stock_value_est)     || 0,
            capitalImmobilized: parseFloat(row.capital_immobilized) || 0,
        })
    } catch (err) {
        console.error('Stats:', err)
        return c.json({ error: 'Erreur lors du chargement des statistiques' }, 500)
    }
})

app.get('/api/bags', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const { search, brand, status, type, sort, page, limit } = c.req.query()
        const pageNum  = Math.max(parseInt(page)  || 0, 0)
        const pageSize = Math.min(parseInt(limit) || 50, 500)
        const offset   = pageNum * pageSize

        const conditions = ['deleted_at IS NULL', 'user_id = ?']
        const params = [c.get('user').id]

        if (search && search.trim()) {
            conditions.push('(name LIKE ? OR brand LIKE ?)')
            params.push(`%${search.trim()}%`, `%${search.trim()}%`)
        }
        if (brand && brand !== 'all') {
            conditions.push('brand = ?')
            params.push(brand)
        }
        if (status && status !== 'all') {
            const statuses = status.split(',').filter(s => VALID_STATUSES.has(s))
            if (statuses.length > 0) {
                conditions.push(`status IN (${statuses.map(() => '?').join(',')})`)
                params.push(...statuses)
            }
        }
        if (type && type !== 'all') {
            conditions.push('item_type = ?')
            params.push(type)
        }

        const where   = conditions.join(' AND ')
        const orderBy = SORT_MAP[sort] || 'created_at DESC'

        const [countResult, bagsResult] = await Promise.all([
            db.query(`SELECT COUNT(*) as count FROM bags WHERE ${where}`, params),
            db.query(`SELECT * FROM bags WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`, [...params, pageSize, offset]),
        ])

        const total = parseInt(countResult.rows[0].count) || 0
        const bags  = bagsResult.rows

        if (bags.length === 0) return c.json({ bags: [], total })

        const placeholders = bags.map(() => '?').join(', ')
        const imagesResult = await db.query(
            `SELECT * FROM images WHERE bag_id IN (${placeholders})`,
            bags.map(b => b.id)
        )

        const imagesByBagId = {}
        for (const img of imagesResult.rows) {
            if (!imagesByBagId[img.bag_id]) imagesByBagId[img.bag_id] = []
            imagesByBagId[img.bag_id].push(img)
        }

        return c.json({ bags: bags.map(bag => ({ ...bag, images: imagesByBagId[bag.id] || [] })), total })
    } catch (err) {
        console.error('GET /api/bags:', err)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

app.post('/api/bags', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const body = await c.req.json()
        const { error, data } = parseBagBody(body)
        if (error) return c.json({ error }, 400)

        const { name, brand, purchase_price, target_resale_price, status, purchase_source, is_donation, item_type, listing_url } = data
        const id = await db.insertAndGetId(
            'INSERT INTO bags (name, brand, purchase_price, target_resale_price, status, purchase_source, is_donation, item_type, listing_url, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [name, brand, purchase_price, target_resale_price, status || 'to_be_cleaned', purchase_source, is_donation ? 1 : 0, item_type || 'Sac', listing_url || null, c.get('user').id]
        )
        return c.json({ id })
    } catch (err) {
        console.error('POST /api/bags:', err)
        return c.json({ error: 'Erreur lors de la création' }, 500)
    }
})

app.put('/api/bags/:id', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const body = await c.req.json()
        const { error, data } = parseBagBody(body)
        if (error) return c.json({ error }, 400)

        const { name, brand, purchase_price, target_resale_price, actual_resale_price,
            status, purchase_date, sale_date, fees, material_costs, time_spent, notes,
            purchase_source, is_donation, item_type, listing_url } = data

        const result = await db.run(
            `UPDATE bags SET
                name = ?, brand = ?, purchase_price = ?, target_resale_price = ?,
                actual_resale_price = ?, status = ?, purchase_date = ?, sale_date = ?,
                fees = ?, material_costs = ?, time_spent = ?, notes = ?,
                purchase_source = ?, is_donation = ?, item_type = ?, listing_url = ?
            WHERE id = ? AND user_id = ?`,
            [name, brand, purchase_price, target_resale_price, actual_resale_price, status,
             purchase_date, sale_date, fees, material_costs, time_spent, notes,
             purchase_source, is_donation ? 1 : 0, item_type || '', listing_url || null,
             c.req.param('id'), c.get('user').id]
        )
        if (result.meta.changes === 0) return c.json({ error: 'Article non trouvé' }, 404)
        return c.json({ success: true })
    } catch (err) {
        console.error('PUT /api/bags/:id:', err)
        return c.json({ error: 'Erreur lors de la mise à jour' }, 500)
    }
})

app.delete('/api/bags/:id', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const { id } = c.req.param()
        // Delete Cloudinary images before soft-deleting the bag
        const images = await db.query('SELECT * FROM images WHERE bag_id = ?', [id])
        await Promise.all((images.rows || []).map(img => cloudinaryDelete(img.public_id, c.env)))
        const result = await db.run(
            'UPDATE bags SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
            [id, c.get('user').id]
        )
        if (result.meta.changes === 0) return c.json({ error: 'Article non trouvé' }, 404)
        return c.json({ success: true })
    } catch (err) {
        console.error('DELETE /api/bags/:id:', err)
        return c.json({ error: 'Erreur lors de la suppression' }, 500)
    }
})

app.get('/api/bags/:id', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const bagResult = await db.query(
            'SELECT * FROM bags WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
            [c.req.param('id'), c.get('user').id]
        )
        if (bagResult.rows.length === 0) return c.json({ error: 'Article non trouvé' }, 404)
        const bag = bagResult.rows[0]
        const imagesResult = await db.query('SELECT * FROM images WHERE bag_id = ?', [bag.id])
        return c.json({ ...bag, images: imagesResult.rows })
    } catch (err) {
        return c.json({ error: "Erreur lors du chargement de l'article" }, 500)
    }
})

// =============================================================================
// LOGS
// =============================================================================

app.get('/api/bags/:id/logs', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        if (!await checkBagOwnership(db, c.req.param('id'), c.get('user').id)) {
            return c.json({ error: 'Article non trouvé' }, 404)
        }
        const result = await db.query(
            'SELECT * FROM bag_logs WHERE bag_id = ? ORDER BY date DESC, created_at DESC',
            [c.req.param('id')]
        )
        return c.json(result.rows)
    } catch (err) {
        return c.json({ error: 'Internal server error' }, 500)
    }
})

app.post('/api/bags/:id/logs', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        if (!await checkBagOwnership(db, c.req.param('id'), c.get('user').id)) {
            return c.json({ error: 'Article non trouvé' }, 404)
        }
        const { action, date } = await c.req.json()
        const id = await db.insertAndGetId(
            'INSERT INTO bag_logs (bag_id, action, date) VALUES (?, ?, ?)',
            [c.req.param('id'), action, date]
        )
        const newLog = await db.query('SELECT * FROM bag_logs WHERE id = ?', [id])
        return c.json(newLog.rows[0])
    } catch (err) {
        return c.json({ error: 'Internal server error' }, 500)
    }
})

app.delete('/api/logs/:id', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const logResult = await db.query('SELECT bag_id FROM bag_logs WHERE id = ?', [c.req.param('id')])
        const log = logResult.rows[0]
        if (!log) return c.json({ error: 'Entrée non trouvée' }, 404)
        if (!await checkBagOwnership(db, log.bag_id, c.get('user').id)) {
            return c.json({ error: 'Non autorisé' }, 404)
        }
        await db.run('DELETE FROM bag_logs WHERE id = ?', [c.req.param('id')])
        return c.json({ success: true })
    } catch (err) {
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// =============================================================================
// CONSUMABLES (linked to bags)
// =============================================================================

app.get('/api/bags/:id/consumables', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        if (!await checkBagOwnership(db, c.req.param('id'), c.get('user').id)) {
            return c.json({ error: 'Article non trouvé' }, 404)
        }
        const result = await db.query(`
            SELECT bc.*, c.name as consumable_name, c.brand as consumable_brand
            FROM bag_consumables bc
            LEFT JOIN consumables c ON bc.consumable_id = c.id
            WHERE bc.bag_id = ?
            ORDER BY bc.created_at DESC
        `, [c.req.param('id')])
        return c.json(result.rows)
    } catch (err) {
        return c.json({ error: 'Internal server error' }, 500)
    }
})

app.post('/api/bags/:id/consumables', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const bag_id = c.req.param('id')
        if (!await checkBagOwnership(db, bag_id, c.get('user').id)) {
            return c.json({ error: 'Article non trouvé' }, 404)
        }
        const { consumable_id, usage_percent } = await c.req.json()
        const usagePct = parseFloat(usage_percent) || 0
        if (usagePct <= 0 || usagePct > 100) {
            return c.json({ error: "Le pourcentage d'utilisation doit être entre 1 et 100" }, 400)
        }

        const cResult = await db.query('SELECT * FROM consumables WHERE id = ? AND deleted_at IS NULL', [consumable_id])
        const consumable = cResult.rows[0]
        if (!consumable) return c.json({ error: 'Produit introuvable' }, 404)

        const cost = parseFloat(((consumable.purchase_price || 0) * (usagePct / 100)).toFixed(4))

        // Atomic batch: insert link + update bag material costs
        await c.env.DB.batch([
            c.env.DB.prepare('INSERT INTO bag_consumables (bag_id, consumable_id, used_percentage, cost_at_time) VALUES (?, ?, ?, ?)')
                .bind(bag_id, consumable_id, usagePct, cost),
            c.env.DB.prepare('UPDATE bags SET material_costs = material_costs + ? WHERE id = ?')
                .bind(cost, bag_id),
        ])

        return c.json({ success: true, cost_added: cost })
    } catch (err) {
        console.error('POST bag consumable:', err)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

app.delete('/api/bag-consumables/:id', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const result = await db.query('SELECT * FROM bag_consumables WHERE id = ?', [c.req.param('id')])
        const link = result.rows[0]
        if (!link) return c.json({ error: 'Liaison non trouvée' }, 404)
        if (!await checkBagOwnership(db, link.bag_id, c.get('user').id)) {
            return c.json({ error: 'Non autorisé' }, 404)
        }

        const stmts = [
            c.env.DB.prepare('UPDATE bags SET material_costs = material_costs - ? WHERE id = ?')
                .bind(link.cost_at_time, link.bag_id),
            c.env.DB.prepare('DELETE FROM bag_consumables WHERE id = ?')
                .bind(c.req.param('id')),
        ]
        if (link.consumable_id) {
            stmts.splice(1, 0,
                c.env.DB.prepare('UPDATE consumables SET remaining_percentage = remaining_percentage + ? WHERE id = ?')
                    .bind(link.used_percentage, link.consumable_id)
            )
        }
        await c.env.DB.batch(stmts)

        return c.json({ success: true })
    } catch (err) {
        console.error('DELETE bag-consumable:', err)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// =============================================================================
// IMAGES
// =============================================================================

app.post('/api/bags/:id/images', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const { id } = c.req.param()
        if (!await checkBagOwnership(db, id, c.get('user').id)) {
            return c.json({ error: 'Article non trouvé' }, 404)
        }
        const { url, type, public_id } = await c.req.json()
        const imageId = await db.insertAndGetId(
            'INSERT INTO images (bag_id, url, type, public_id) VALUES (?, ?, ?, ?)',
            [id, url, type, public_id]
        )
        return c.json({ id: imageId, url })
    } catch (err) {
        return c.json({ error: "Erreur lors de l'ajout de l'image" }, 500)
    }
})

app.delete('/api/images/:id', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const result = await db.query('SELECT * FROM images WHERE id = ?', [c.req.param('id')])
        const img = result.rows[0]
        if (img) {
            if (!await checkBagOwnership(db, img.bag_id, c.get('user').id)) {
                return c.json({ error: 'Non autorisé' }, 404)
            }
            await cloudinaryDelete(img.public_id, c.env)
            await db.run('DELETE FROM images WHERE id = ?', [c.req.param('id')])
        }
        return c.json({ success: true })
    } catch (err) {
        return c.json({ error: 'Erreur lors de la suppression de l\'image' }, 500)
    }
})

// File upload — direct to Cloudinary, no Sharp (Cloudinary applies WebP + resize on delivery)
app.post('/api/upload', auth, async (c) => {
    try {
        const contentType = c.req.header('content-type') || ''
        if (!contentType.includes('multipart/form-data')) {
            return c.json({ error: 'Multipart form required' }, 400)
        }

        const formData = await c.req.formData()
        const file = formData.get('image')

        if (!file || typeof file === 'string') {
            return c.json({ error: 'No file uploaded' }, 400)
        }

        const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        if (!ALLOWED_TYPES.includes(file.type)) {
            return c.json({ error: 'Type de fichier non autorisé. Utilisez JPEG, PNG, WebP ou GIF.' }, 400)
        }

        const MAX_SIZE = 10 * 1024 * 1024
        const buffer = await file.arrayBuffer()
        if (buffer.byteLength > MAX_SIZE) {
            return c.json({ error: 'Fichier trop volumineux (max 10 MB)' }, 400)
        }

        const result = await cloudinaryUpload(buffer, c.env)
        return c.json(result)
    } catch (err) {
        console.error('Upload:', err)
        return c.json({ error: "Erreur lors du traitement de l'image" }, 500)
    }
})

// =============================================================================
// DASHBOARD LISTS
// =============================================================================

app.get('/api/dashboard-lists', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const result = await db.query(
            'SELECT * FROM dashboard_lists WHERE user_id = ? ORDER BY order_index ASC',
            [c.get('user').id]
        )
        return c.json(result.rows.map(l => {
            let filters = []
            try { filters = JSON.parse(l.filters || '[]') } catch {}
            return { ...l, filters }
        }))
    } catch (err) {
        return c.json({ error: 'Erreur lors du chargement des listes' }, 500)
    }
})

app.post('/api/dashboard-lists', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const { title, filters, order_index } = await c.req.json()
        const id = await db.insertAndGetId(
            'INSERT INTO dashboard_lists (title, filters, order_index, user_id) VALUES (?, ?, ?, ?)',
            [title, JSON.stringify(filters || []), order_index || 0, c.get('user').id]
        )
        return c.json({ id })
    } catch (err) {
        return c.json({ error: 'Erreur lors de la création de la liste' }, 500)
    }
})

app.put('/api/dashboard-lists/:id', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const { title, filters, order_index } = await c.req.json()
        await db.run(
            'UPDATE dashboard_lists SET title = ?, filters = ?, order_index = ? WHERE id = ? AND user_id = ?',
            [title, JSON.stringify(filters || []), order_index || 0, c.req.param('id'), c.get('user').id]
        )
        return c.json({ success: true })
    } catch (err) {
        return c.json({ error: 'Erreur lors de la mise à jour de la liste' }, 500)
    }
})

app.delete('/api/dashboard-lists/:id', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        await db.run(
            'DELETE FROM dashboard_lists WHERE id = ? AND user_id = ?',
            [c.req.param('id'), c.get('user').id]
        )
        return c.json({ success: true })
    } catch (err) {
        return c.json({ error: 'Erreur lors de la suppression de la liste' }, 500)
    }
})

app.post('/api/dashboard-lists/reorder', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const { orders } = await c.req.json()
        await Promise.all(orders.map(item =>
            db.run(
                'UPDATE dashboard_lists SET order_index = ? WHERE id = ? AND user_id = ?',
                [item.order_index, item.id, c.get('user').id]
            )
        ))
        return c.json({ success: true })
    } catch (err) {
        return c.json({ error: 'Erreur lors de la réorganisation des listes' }, 500)
    }
})

// =============================================================================
// CONSUMABLES (standalone)
// =============================================================================

app.get('/api/consumables', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const result = await db.query(
            'SELECT * FROM consumables WHERE deleted_at IS NULL AND user_id = ? ORDER BY created_at DESC',
            [c.get('user').id]
        )
        return c.json(result.rows)
    } catch (err) {
        return c.json({ error: 'Erreur lors du chargement des produits' }, 500)
    }
})

app.post('/api/consumables', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const { name, brand, purchase_price, quantity, unit, remaining_percentage, notes } = await c.req.json()
        if (!name || name.trim() === '') return c.json({ error: 'Le nom du produit est obligatoire' }, 400)
        const price = parseFloat(purchase_price) || 0
        if (price < 0) return c.json({ error: 'Le prix ne peut pas être négatif' }, 400)
        const pct = Math.max(0, Math.min(100, parseInt(remaining_percentage ?? 100)))
        const id = await db.insertAndGetId(
            'INSERT INTO consumables (name, brand, purchase_price, quantity, unit, remaining_percentage, notes, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [name, brand, price, parseInt(quantity) || 1, unit || 'unité', pct, notes, c.get('user').id]
        )
        return c.json({ id })
    } catch (err) {
        return c.json({ error: 'Erreur lors de la création du produit' }, 500)
    }
})

app.put('/api/consumables/:id', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const { name, brand, purchase_price, quantity, unit, remaining_percentage, notes } = await c.req.json()
        if (!name || name.trim() === '') return c.json({ error: 'Le nom du produit est obligatoire' }, 400)
        const price = parseFloat(purchase_price) || 0
        if (price < 0) return c.json({ error: 'Le prix ne peut pas être négatif' }, 400)
        const pct = Math.max(0, Math.min(100, parseInt(remaining_percentage ?? 100)))
        await db.run(
            'UPDATE consumables SET name = ?, brand = ?, purchase_price = ?, quantity = ?, unit = ?, remaining_percentage = ?, notes = ? WHERE id = ? AND user_id = ?',
            [name, brand, price, parseInt(quantity) || 1, unit || 'unité', pct, notes, c.req.param('id'), c.get('user').id]
        )
        return c.json({ success: true })
    } catch (err) {
        return c.json({ error: 'Erreur lors de la mise à jour du produit' }, 500)
    }
})

app.delete('/api/consumables/:id', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const result = await db.run(
            'UPDATE consumables SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
            [c.req.param('id'), c.get('user').id]
        )
        if (result.meta.changes === 0) return c.json({ error: 'Produit non trouvé' }, 404)
        return c.json({ success: true })
    } catch (err) {
        return c.json({ error: 'Erreur lors de la suppression du produit' }, 500)
    }
})

// =============================================================================
// EXPENSES
// =============================================================================

app.get('/api/expenses', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const result = await db.query(
            'SELECT * FROM expenses WHERE deleted_at IS NULL AND user_id = ? ORDER BY date DESC, created_at DESC',
            [c.get('user').id]
        )
        return c.json(result.rows)
    } catch (err) {
        return c.json({ error: 'Erreur lors du chargement des dépenses' }, 500)
    }
})

app.post('/api/expenses', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const { description, amount, category, date } = await c.req.json()
        if (!description || description.trim() === '') return c.json({ error: 'La description est obligatoire' }, 400)
        const amt = parseFloat(amount) || 0
        if (amt < 0) return c.json({ error: 'Le montant ne peut pas être négatif' }, 400)
        const id = await db.insertAndGetId(
            'INSERT INTO expenses (description, amount, category, date, user_id) VALUES (?, ?, ?, ?, ?)',
            [description, amt, category || 'other', date || new Date().toISOString().split('T')[0], c.get('user').id]
        )
        return c.json({ id })
    } catch (err) {
        return c.json({ error: 'Erreur lors de la création de la dépense' }, 500)
    }
})

app.put('/api/expenses/:id', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const { description, amount, category, date } = await c.req.json()
        await db.run(
            'UPDATE expenses SET description = ?, amount = ?, category = ?, date = ? WHERE id = ? AND user_id = ?',
            [description, parseFloat(amount) || 0, category || 'other',
             date || new Date().toISOString().split('T')[0], c.req.param('id'), c.get('user').id]
        )
        return c.json({ success: true })
    } catch (err) {
        return c.json({ error: 'Erreur lors de la mise à jour de la dépense' }, 500)
    }
})

app.delete('/api/expenses/:id', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const result = await db.run(
            'UPDATE expenses SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
            [c.req.param('id'), c.get('user').id]
        )
        if (result.meta.changes === 0) return c.json({ error: 'Dépense non trouvée' }, 404)
        return c.json({ success: true })
    } catch (err) {
        return c.json({ error: 'Erreur lors de la suppression de la dépense' }, 500)
    }
})

// =============================================================================
// STATS + EXPORT
// =============================================================================

app.get('/api/stats/monthly', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const uid = c.get('user').id

        const [salesResult, expensesResult] = await Promise.all([
            db.query(`
                SELECT substr(sale_date, 1, 7) as month,
                    COUNT(*) as count,
                    ROUND(SUM(actual_resale_price), 2) as revenue,
                    ROUND(SUM(actual_resale_price - purchase_price - fees - material_costs), 2) as profit
                FROM bags
                WHERE status = 'sold' AND sale_date IS NOT NULL AND sale_date != '' AND deleted_at IS NULL AND user_id = ?
                GROUP BY substr(sale_date, 1, 7)
                ORDER BY month ASC
            `, [uid]),
            db.query(`
                SELECT substr(date, 1, 7) as month, ROUND(SUM(amount), 2) as expenses
                FROM expenses
                WHERE date IS NOT NULL AND date != '' AND deleted_at IS NULL AND user_id = ?
                GROUP BY substr(date, 1, 7)
                ORDER BY month ASC
            `, [uid]),
        ])

        const months = new Map()
        for (const row of salesResult.rows) {
            months.set(row.month, {
                month: row.month,
                revenue: parseFloat(row.revenue) || 0,
                profit:  parseFloat(row.profit)  || 0,
                count:   parseInt(row.count)      || 0,
                expenses: 0,
            })
        }
        for (const row of expensesResult.rows) {
            if (months.has(row.month)) {
                months.get(row.month).expenses = parseFloat(row.expenses) || 0
            } else {
                months.set(row.month, { month: row.month, revenue: 0, profit: 0, count: 0, expenses: parseFloat(row.expenses) || 0 })
            }
        }

        return c.json(Array.from(months.values()).sort((a, b) => a.month.localeCompare(b.month)))
    } catch (err) {
        console.error('Monthly stats:', err)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

app.get('/api/export/csv', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const uid = c.get('user').id
        const [bagsRes, expensesRes] = await Promise.all([
            db.query('SELECT * FROM bags WHERE status = ? AND deleted_at IS NULL AND user_id = ?', ['sold', uid]),
            db.query('SELECT * FROM expenses WHERE deleted_at IS NULL AND user_id = ?', [uid]),
        ])

        let csv = 'Type;Date;Description;Montant;Marge\n'
        for (const b of bagsRes.rows) {
            const margin = b.actual_resale_price - b.purchase_price - b.fees - b.material_costs
            csv += `Vente;${csvEscape(b.sale_date || b.created_at)};${csvEscape((b.brand || '') + ' ' + (b.name || ''))};${b.actual_resale_price};${margin.toFixed(2)}\n`
        }
        for (const e of expensesRes.rows) {
            csv += `Dépense;${csvEscape(e.date)};${csvEscape(e.description)};-${e.amount};0\n`
        }

        return new Response(csv, {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': 'attachment; filename=tableau_de_bord.csv',
            },
        })
    } catch (err) {
        return c.json({ error: "Erreur lors de l'export CSV" }, 500)
    }
})

// =============================================================================
// BRANDS & ITEM TYPES
// =============================================================================

app.get('/api/brands', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const result = await db.query('SELECT * FROM brands WHERE user_id = ? ORDER BY name ASC', [c.get('user').id])
        return c.json(result.rows)
    } catch (err) {
        return c.json({ error: 'Erreur lors du chargement des marques' }, 500)
    }
})

app.post('/api/brands', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const { name } = await c.req.json()
        if (!name) return c.json({ error: 'Le nom de la marque est obligatoire' }, 400)
        const existing = await db.query('SELECT id FROM brands WHERE name = ? AND user_id = ?', [name, c.get('user').id])
        if (existing.rows.length > 0) return c.json({ error: 'Cette marque existe déjà' }, 400)
        const id = await db.insertAndGetId('INSERT INTO brands (name, user_id) VALUES (?, ?)', [name, c.get('user').id])
        return c.json({ id, name })
    } catch (err) {
        return c.json({ error: 'Erreur lors de la création de la marque' }, 500)
    }
})

app.put('/api/brands/:id', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const { name } = await c.req.json()
        if (!name) return c.json({ error: 'Le nom est obligatoire' }, 400)
        await db.run('UPDATE brands SET name = ? WHERE id = ? AND user_id = ?', [name, c.req.param('id'), c.get('user').id])
        return c.json({ success: true })
    } catch (err) {
        return c.json({ error: 'Erreur lors de la mise à jour de la marque' }, 500)
    }
})

app.delete('/api/brands/:id', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const uid = c.get('user').id
        const brandResult = await db.query('SELECT name FROM brands WHERE id = ? AND user_id = ?', [c.req.param('id'), uid])
        if (brandResult.rows.length === 0) return c.json({ error: 'Marque non trouvée' }, 404)
        const brandName = brandResult.rows[0].name
        const usageResult = await db.query(
            'SELECT COUNT(*) as count FROM bags WHERE brand = ? AND user_id = ? AND deleted_at IS NULL',
            [brandName, uid]
        )
        const count = parseInt(usageResult.rows[0].count) || 0
        if (count > 0) return c.json({ error: `Cette marque est utilisée par ${count} article(s). Supprimez ou modifiez ces articles d'abord.` }, 409)
        await db.run('DELETE FROM brands WHERE id = ? AND user_id = ?', [c.req.param('id'), uid])
        return c.json({ success: true })
    } catch (err) {
        return c.json({ error: 'Erreur lors de la suppression de la marque' }, 500)
    }
})

app.get('/api/item-types', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const result = await db.query('SELECT * FROM item_types WHERE user_id = ? ORDER BY name ASC', [c.get('user').id])
        return c.json(result.rows)
    } catch (err) {
        return c.json({ error: 'Erreur lors du chargement des types' }, 500)
    }
})

app.post('/api/item-types', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const { name } = await c.req.json()
        if (!name) return c.json({ error: 'Le nom est obligatoire' }, 400)
        const existing = await db.query('SELECT id FROM item_types WHERE name = ? AND user_id = ?', [name, c.get('user').id])
        if (existing.rows.length > 0) return c.json({ error: 'Ce type existe déjà' }, 400)
        const id = await db.insertAndGetId('INSERT INTO item_types (name, user_id) VALUES (?, ?)', [name, c.get('user').id])
        return c.json({ id })
    } catch (err) {
        return c.json({ error: 'Erreur lors de la création du type' }, 500)
    }
})

app.put('/api/item-types/:id', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const { name } = await c.req.json()
        if (!name) return c.json({ error: 'Le nom est obligatoire' }, 400)
        await db.run('UPDATE item_types SET name = ? WHERE id = ? AND user_id = ?', [name, c.req.param('id'), c.get('user').id])
        return c.json({ success: true })
    } catch (err) {
        return c.json({ error: 'Erreur lors de la mise à jour du type' }, 500)
    }
})

app.delete('/api/item-types/:id', auth, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const uid = c.get('user').id
        const typeResult = await db.query('SELECT name FROM item_types WHERE id = ? AND user_id = ?', [c.req.param('id'), uid])
        if (typeResult.rows.length === 0) return c.json({ error: 'Type non trouvé' }, 404)
        const typeName = typeResult.rows[0].name
        const usageResult = await db.query(
            'SELECT COUNT(*) as count FROM bags WHERE item_type = ? AND user_id = ? AND deleted_at IS NULL',
            [typeName, uid]
        )
        const count = parseInt(usageResult.rows[0].count) || 0
        if (count > 0) return c.json({ error: `Ce type est utilisé par ${count} article(s). Supprimez ou modifiez ces articles d'abord.` }, 409)
        await db.run('DELETE FROM item_types WHERE id = ? AND user_id = ?', [c.req.param('id'), uid])
        return c.json({ success: true })
    } catch (err) {
        return c.json({ error: 'Erreur lors de la suppression du type' }, 500)
    }
})

// =============================================================================
// ADMIN
// =============================================================================

app.get('/api/admin/users', auth, requireAdmin, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const result = await db.query('SELECT id, email, username, role, created_at FROM users ORDER BY created_at DESC')
        return c.json(result.rows)
    } catch (err) {
        return c.json({ error: 'Erreur serveur' }, 500)
    }
})

app.put('/api/admin/users/:id/role', auth, requireAdmin, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const { role } = await c.req.json()
        const VALID_ROLES = ['user', 'admin']
        if (!VALID_ROLES.includes(role)) return c.json({ error: 'Rôle invalide' }, 400)
        if (Number(c.req.param('id')) === c.get('user').id) {
            return c.json({ error: 'Impossible de modifier son propre rôle' }, 400)
        }
        const result = await db.run('UPDATE users SET role = ? WHERE id = ?', [role, c.req.param('id')])
        if (result.meta.changes === 0) return c.json({ error: 'Utilisateur introuvable' }, 404)
        return c.json({ success: true })
    } catch (err) {
        return c.json({ error: 'Erreur serveur' }, 500)
    }
})

app.get('/api/admin/config', auth, requireAdmin, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const result = await db.query('SELECT * FROM app_config WHERE id = 1')
        return c.json(result.rows[0] || { onboarding_enabled: 1 })
    } catch (err) {
        return c.json({ error: 'Erreur serveur' }, 500)
    }
})

app.put('/api/admin/config', auth, requireAdmin, async (c) => {
    try {
        const db = makeDb(c.env.DB)
        const { onboarding_enabled } = await c.req.json()
        if (typeof onboarding_enabled !== 'number' && typeof onboarding_enabled !== 'boolean') {
            return c.json({ error: 'Paramètre invalide' }, 400)
        }
        const val = onboarding_enabled ? 1 : 0
        await db.run('UPDATE app_config SET onboarding_enabled = ? WHERE id = 1', [val])
        return c.json({ success: true, onboarding_enabled: val })
    } catch (err) {
        return c.json({ error: 'Erreur serveur' }, 500)
    }
})

export default app
