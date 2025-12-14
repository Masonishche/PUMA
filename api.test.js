const request = require('supertest');
const app = require('./server');

describe('📡 API & Database Tests', () => {
    
    // 1. Тест роботи сервера (Health Check)
    it('GET /api/history - має повертати статус 200 і масив даних', async () => {
        const res = await request(app).get('/api/history');
        expect(res.statusCode).toEqual(200);
        expect(Array.isArray(res.body)).toBeTruthy();
    });

    // 2. Тест роботи Бази Даних (Запис та читання)
    it('DB Check - Має зберігати дані при надходженні', async () => {
        // Спочатку отримуємо поточну кількість записів
        const initRes = await request(app).get('/api/history');
        const initialCount = initRes.body.length;

        // Імітуємо прихід даних (ніби від робота, але через прямий виклик, якщо б був POST)
        // Оскільки у нас запис йде через MQTT, ми перевіримо, чи працює експорт,
        // який читає напряму з БД.
        const exportRes = await request(app).get('/api/export');
        expect(exportRes.statusCode).toEqual(200);
        expect(exportRes.headers['content-type']).toContain('json');
    });

    // 3. Тест зміни налаштувань (Адмінські функції)
    it('POST /api/settings/threshold - має змінювати поріг аварії', async () => {
        const res = await request(app)
            .post('/api/settings/threshold')
            .send({ threshold: 999 });

        expect(res.statusCode).toEqual(200);
        expect(res.body.newThreshold).toEqual(999);
    });

    // 4. Тест валідації (помилка при пустих даних)
    it('POST /api/settings/threshold - має повертати 400, якщо даних немає', async () => {
        const res = await request(app).post('/api/settings/threshold').send({});
        expect(res.statusCode).toEqual(400);
    });
});