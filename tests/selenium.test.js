const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

let chromeService = null;
try {
    const chromedriver = require('chromedriver');
    chromeService = new chrome.ServiceBuilder(chromedriver.path);
} catch (e) {
    console.log("WARN: Chromedriver package not found, relying on system PATH");
}

const HEADLESS_MODE = true; 
const SITE_URL = 'http://localhost:3000';

describe('Selenium UI Tests', () => {
    let driver;

    // Тайм-аут 60 секунд
    jest.setTimeout(60000);

    beforeAll(async () => {
        //console.log("Starting Chrome Driver...");
        
        let options = new chrome.Options();
        
        // Базові аргументи для стабільності
        options.addArguments('--no-sandbox');
        options.addArguments('--disable-dev-shm-usage');
        options.addArguments('--window-size=1920,1080');

        // Якщо headless режим увімкнено
        if (HEADLESS_MODE) {
            options.addArguments('--headless=new'); 
        }

        try {
            // Будуємо драйвер
            let builder = new Builder()
                .forBrowser('chrome')
                .setChromeOptions(options);

            // Якщо ми знайшли шлях до драйвера через npm, вказуємо його явно
            if (chromeService) {
                builder.setChromeService(chromeService);
            }

            driver = await builder.build();
            console.log("Driver started successfully!");

        } catch (error) {
            console.error("CRITICAL ERROR: Chrome Driver failed to start.");
            console.error("Possible reason: Chrome version mismatch.");
            console.error(error);
            throw error;
        }
    }, 60000);

    afterAll(async () => {
        if (driver) {
            await driver.quit();
        }
    });

    // ТЕСТ 1
    test('TC-1: Open Homepage and check Title', async () => {
        await driver.get(SITE_URL);
        const title = await driver.getTitle();
        // Перевірка, що заголовок існує (не пустий)
        expect(title).toBeTruthy();
    });

    // ТЕСТ 2
    test('TC-2: Check Body Loads', async () => {
        // Просто перевіряємо, що сторінка фізично завантажилась
        await driver.get(SITE_URL);
        const body = await driver.wait(until.elementLocated(By.tagName('body')), 5000);
        expect(body).toBeDefined();
    });
});