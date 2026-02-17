const request = require('supertest');

const { app, server, client } = require('../server'); 

// Група тестів для API та логіки
describe('Unit & Integration Tests (Server Module)', () => {

    // 1. Тест GET запиту (перевірка типу даних та статусу)
    test('GET /api/history - має повертати масив та статус 200', async () => {
        const res = await request(app).get('/api/history');
        
        // Assert 1: Перевірка статусу
        expect(res.statusCode).toBe(200);
        // Assert 2: Перевірка типу контенту
        expect(res.headers['content-type']).toMatch(/json/);
        // Assert 3: Перевірка структури даних
        expect(Array.isArray(res.body)).toBeTruthy();
    });

    // 2. Тест логіки фільтрації (імітація запиту з параметрами)
    test('GET /api/export - має фільтрувати дані за датою', async () => {
        const startDate = new Date().toISOString();
        const res = await request(app).get(`/api/export?start=${startDate}`);
        
        expect(res.statusCode).toBe(200);
        // Assert 4: Перевірка, що результат не null
        expect(res.body).not.toBeNull();
    });

    // 3. Тест обробки помилок (негативний тест)
    test('POST /api/settings/threshold - має видати 400 при пустих даних', async () => {
        const res = await request(app).post('/api/settings/threshold').send({});
        
        // Assert 5: Перевірка коду помилки
        expect(res.statusCode).toEqual(400);
        // Assert 6: Перевірка повідомлення про помилку
        expect(res.body).toHaveProperty('error');
    });

    // 4. Тест зміни налаштувань (Assert Equality)
    test('POST /api/settings/threshold - має змінювати значення', async () => {
        const newVal = 750;
        const res = await request(app)
            .post('/api/settings/threshold')
            .send({ threshold: newVal });

        expect(res.statusCode).toBe(200);
        expect(res.body.newThreshold).toBe(newVal);
    });

    afterAll((done) => {
        const closeMqtt = () => {
            if (client && typeof client.end === 'function') {
                // true означає "force close", щоб не чекати завершення пакетів
                client.end(true, done);
            } else {
                done();
            }
        };

        if (server && typeof server.close === 'function') {
            server.close(closeMqtt);
        } else {
            closeMqtt();
        }
    });
});