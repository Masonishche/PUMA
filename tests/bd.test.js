const sqlite3 = require('sqlite3').verbose();

describe('Database Component Tests (SQL Simulation)', () => {
    let db;

    // 1. Setup: Створюємо БД перед кожним тестом (SQL Scripts)
    beforeEach((done) => {
        db = new sqlite3.Database(':memory:'); // БД в оперативній пам'яті
        
        // SQL скрипт створення таблиці з обмеженнями
        const createTableSQL = `
            CREATE TABLE robot_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                power REAL NOT NULL,
                voltage REAL CHECK(voltage > 0),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `;
        
        db.run(createTableSQL, done);
    });

    afterEach((done) => {
        db.close(done);
    });

    // 2. Тестування таблиці та полів (INSERT)
    test('Should insert valid data correctly', (done) => {
        const insertSQL = `INSERT INTO robot_logs (power, voltage) VALUES (?, ?)`;
        
        db.run(insertSQL, [150.5, 220.0], function(err) {
            // Assert: Помилок немає
            expect(err).toBeNull();
            // Assert: ID створено
            expect(this.lastID).toEqual(1);
            done();
        });
    });

    // 3. Тестування бізнес-логіки (Check Constraint)
    test('Should fail when voltage is negative (Business Logic)', (done) => {
        const insertSQL = `INSERT INTO robot_logs (power, voltage) VALUES (?, ?)`;
        
        db.run(insertSQL, [100, -50], (err) => {
            expect(err).not.toBeNull();
            expect(err.message).toMatch(/CHECK constraint failed/);
            done();
        });
    });

    // 4. Тестування вибірки даних (SELECT)
    test('Should retrieve stored data', (done) => {
        db.run(`INSERT INTO robot_logs (power, voltage) VALUES (300, 220)`, () => {
            db.get(`SELECT * FROM robot_logs WHERE id = 1`, (err, row) => {
                // Assert: Перевірка полів
                expect(row.power).toBe(300);
                expect(row.voltage).toBe(220);
                done();
            });
        });
    });
});