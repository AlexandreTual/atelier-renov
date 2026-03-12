const request = require('supertest');
const { app, setupDb, closeDb } = require('../server');

let tokenA, tokenB;
let bagIdA, consumableIdA, expenseIdA, brandIdA;

const authA = () => ({ Authorization: `Bearer ${tokenA}` });
const authB = () => ({ Authorization: `Bearer ${tokenB}` });

beforeAll(async () => {
    await setupDb();

    // Register two distinct users
    const resA = await request(app)
        .post('/api/register')
        .send({ email: 'usera@example.com', password: 'passwordA123' });
    tokenA = resA.body.token;

    const resB = await request(app)
        .post('/api/register')
        .send({ email: 'userb@example.com', password: 'passwordB123' });
    tokenB = resB.body.token;

    // User A creates data
    const bagRes = await request(app)
        .post('/api/bags')
        .set(authA())
        .send({ name: 'Sac de A', brand: 'Hermès' });
    bagIdA = bagRes.body.id;

    const consumableRes = await request(app)
        .post('/api/consumables')
        .set(authA())
        .send({ name: 'Cire de A', purchase_price: 10 });
    consumableIdA = consumableRes.body.id;

    const expenseRes = await request(app)
        .post('/api/expenses')
        .set(authA())
        .send({ description: 'Dépense de A', amount: 50 });
    expenseIdA = expenseRes.body.id;

    const brandRes = await request(app)
        .post('/api/brands')
        .set(authA())
        .send({ name: 'Marque de A' });
    brandIdA = brandRes.body.id;
});

afterAll(async () => {
    await closeDb();
});

// --- Bags isolation ---
describe('Isolation — bags', () => {
    it('userA sees their own bag', async () => {
        const res = await request(app).get('/api/bags').set(authA());
        expect(res.status).toBe(200);
        const ids = res.body.map(b => b.id);
        expect(ids).toContain(bagIdA);
    });

    it('userB sees an empty bag list', async () => {
        const res = await request(app).get('/api/bags').set(authB());
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('userB cannot GET bag belonging to userA', async () => {
        const res = await request(app).get(`/api/bags/${bagIdA}`).set(authB());
        expect(res.status).toBe(404);
    });

    it('userB cannot PUT bag belonging to userA', async () => {
        const res = await request(app)
            .put(`/api/bags/${bagIdA}`)
            .set(authB())
            .send({ name: 'Vol de B' });
        expect(res.status).toBe(404);
    });

    it('userB cannot DELETE bag belonging to userA', async () => {
        const res = await request(app).delete(`/api/bags/${bagIdA}`).set(authB());
        expect(res.status).toBe(404);
    });
});

// --- Bag sub-resources isolation ---
describe('Isolation — bag sub-resources (logs, consumables, images)', () => {
    it('userB cannot GET logs of userA bag', async () => {
        const res = await request(app).get(`/api/bags/${bagIdA}/logs`).set(authB());
        expect(res.status).toBe(404);
    });

    it('userB cannot POST log on userA bag', async () => {
        const res = await request(app)
            .post(`/api/bags/${bagIdA}/logs`)
            .set(authB())
            .send({ action: 'Tentative', date: '2026-01-01' });
        expect(res.status).toBe(404);
    });

    it('userB cannot GET consumables of userA bag', async () => {
        const res = await request(app).get(`/api/bags/${bagIdA}/consumables`).set(authB());
        expect(res.status).toBe(404);
    });

    it('userB cannot POST image on userA bag', async () => {
        const res = await request(app)
            .post(`/api/bags/${bagIdA}/images`)
            .set(authB())
            .send({ url: 'http://evil.com/img.jpg', type: 'before' });
        expect(res.status).toBe(404);
    });
});

// --- Consumables isolation ---
describe('Isolation — consumables', () => {
    it('userA sees their consumable', async () => {
        const res = await request(app).get('/api/consumables').set(authA());
        expect(res.status).toBe(200);
        const ids = res.body.map(c => c.id);
        expect(ids).toContain(consumableIdA);
    });

    it('userB sees empty consumables list', async () => {
        const res = await request(app).get('/api/consumables').set(authB());
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('userB cannot DELETE consumable of userA', async () => {
        const res = await request(app).delete(`/api/consumables/${consumableIdA}`).set(authB());
        expect(res.status).toBe(404);
    });
});

// --- Expenses isolation ---
describe('Isolation — expenses', () => {
    it('userA sees their expense', async () => {
        const res = await request(app).get('/api/expenses').set(authA());
        expect(res.status).toBe(200);
        const ids = res.body.map(e => e.id);
        expect(ids).toContain(expenseIdA);
    });

    it('userB sees empty expenses list', async () => {
        const res = await request(app).get('/api/expenses').set(authB());
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('userB cannot DELETE expense of userA', async () => {
        const res = await request(app).delete(`/api/expenses/${expenseIdA}`).set(authB());
        expect(res.status).toBe(404);
    });
});

// --- Brands isolation ---
describe('Isolation — brands', () => {
    it('userA sees their brand', async () => {
        const res = await request(app).get('/api/brands').set(authA());
        expect(res.status).toBe(200);
        const ids = res.body.map(b => b.id);
        expect(ids).toContain(brandIdA);
    });

    it('userB sees empty brands list', async () => {
        const res = await request(app).get('/api/brands').set(authB());
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('userB can create a brand with the same name as userA', async () => {
        const res = await request(app)
            .post('/api/brands')
            .set(authB())
            .send({ name: 'Marque de A' }); // same name, different user → should succeed
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('id');
    });

    it('userB cannot DELETE brand of userA', async () => {
        const res = await request(app).delete(`/api/brands/${brandIdA}`).set(authB());
        expect(res.status).toBe(404);
    });
});

// --- Dashboard lists isolation ---
describe('Isolation — dashboard lists', () => {
    let listIdA;

    beforeAll(async () => {
        const res = await request(app)
            .post('/api/dashboard-lists')
            .set(authA())
            .send({ title: 'Liste de A', filters: ['cleaning'] });
        listIdA = res.body.id;
    });

    it('userA sees their dashboard list', async () => {
        const res = await request(app).get('/api/dashboard-lists').set(authA());
        expect(res.status).toBe(200);
        const ids = res.body.map(l => l.id);
        expect(ids).toContain(listIdA);
    });

    it('userB sees empty dashboard lists', async () => {
        const res = await request(app).get('/api/dashboard-lists').set(authB());
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });
});

// --- Item types isolation ---
describe('Isolation — item types', () => {
    it('userB sees empty item types list', async () => {
        const res = await request(app).get('/api/item-types').set(authB());
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('userB can create an item type', async () => {
        const res = await request(app)
            .post('/api/item-types')
            .set(authB())
            .send({ name: 'Sac' });
        expect(res.status).toBe(200);
    });
});
