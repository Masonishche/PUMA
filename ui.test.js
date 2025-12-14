const puppeteer = require('puppeteer');

// Даємо тесту час (30 секунд)
jest.setTimeout(30000);

describe('UI Tests (Puppeteer)', () => {
    let browser;
    let page;

    // 1. Запуск браузера
    beforeAll(async () => {
        browser = await puppeteer.launch({
            headless: "new", // Запуск без вікна (швидко і надійно)
            // headless: false, // Розкоментуй, якщо хочеш бачити, як він клікає (повільніше)
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        page = await browser.newPage();
        // Встановлюємо розмір екрану
        await page.setViewport({ width: 1280, height: 800 });
    });

    // 2. Закриття браузера
    afterAll(async () => {
        if (browser) {
            await browser.close();
        }
    });

    // ТЕСТ 1: Відкриття
    test('Має відкрити сторінку і перевірити заголовок', async () => {
        // Переконайся, що сервер запущено (node server.js)
        await page.goto('http://localhost:3000');
        
        const title = await page.title();
        console.log(`Title found: ${title}`);
        expect(title).toBe('PUMA 560 Energy Monitor');
    });

    // ТЕСТ 2: Вхід в Адмінку
    test('Вхід як Адміністратор', async () => {
        await page.goto('http://localhost:3000');

        // Чекаємо поле вводу і вводимо дані
        await page.waitForSelector('#usernameInput');
        await page.type('#usernameInput', 'admin');
        await page.type('#passwordInput', 'admin');

        // Клік по кнопці (шукаємо кнопку, що містить текст "Увійти")
        // Або просто клікаємо по кнопці з класом .btn-primary
        await page.click('button.btn-primary');

        // Чекаємо появи панелі адміна
        await page.waitForSelector('#adminPanelCard', { visible: true, timeout: 5000 });

        // Перевіряємо, чи ми бачимо панель
        const adminPanel = await page.$('#adminPanelCard');
        expect(adminPanel).not.toBeNull();
    });
});