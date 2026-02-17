const socket = io();
let currentThreshold = 500;

// --- ДОПОМІЖНІ ФУНКЦІЇ ---
const getEl = (id) => document.getElementById(id);
const setText = (id, text) => { const el = getEl(id); if (el) el.textContent = text; };
const showElement = (id, show = true) => { const el = getEl(id); if (el) el.style.display = show ? 'block' : 'none'; };

// Форматування дати для input type="datetime-local"
const toLocalISO = (date) => {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

// --- CHART.JS КОНФІГУРАЦІЯ ---
Chart.defaults.color = '#aaaaaa';
Chart.defaults.borderColor = '#333333';

const createChart = (ctx, label, color, maxY = null) => new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: label,
            data: [],
            borderColor: color,
            backgroundColor: color.startsWith('#') ? color + '1A' : 'rgba(13, 202, 240, 0.1)',
            fill: true,
            tension: 0,        // Прямі лінії (без згладжування) - найстабільніший варіант
            borderWidth: 2,
            pointRadius: 0,    // Без точок, тільки лінія
            spanGaps: true     // Не розривати лінію, якщо пропущено пакет
        }]
    },
    options: {
        animation: false,      // ВИМИКАЄМО всі анімації, щоб графік не "плавав"
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { display: false }, // Приховуємо вісь X для чистоти (або display: true для перевірки)
            y: { 
                display: true, 
                min: 0,
                max: maxY || undefined, // Жорстка фіксація максимуму, якщо передано
                suggestedMax: maxY ? undefined : 100 
            }
        },
        interaction: { intersect: false, mode: 'index' }
    }
});

// Функція безпечного оновлення
const updateChartData = (chart, label, rawValue, maxLen) => {
    // 1. Конвертація в число (захист від тексту)
    const val = parseFloat(rawValue);
    
    // 2. Якщо прийшло NaN (сміття), замінюємо на 0 або останню точку
    const safeVal = isNaN(val) ? 0 : val;

    // 3. Зсув масиву
    if (chart.data.labels.length >= maxLen) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
    }

    // 4. Додавання нових даних
    chart.data.labels.push(label);
    chart.data.datasets[0].data.push(safeVal);

    // 5. Оновлення без анімації (критично для стабільності)
    chart.update('none'); 
};

// --- ІНІЦІАЛІЗАЦІЯ ---
// Main Chart: Автомасштаб, але не менше 400
const mainChart = createChart(getEl('mainChart'), 'Total Power (W)', '#0dcaf0', null);

// Motor Charts: Жорстко зафіксовані від 0 до 80 Вт
const motorCharts = Array.from({ length: 6 }, (_, i) => 
    createChart(getEl(`chartM${i + 1}`).getContext('2d'), `M${i + 1} (W)`, '#198754', 80)
);

// --- SOCKET.IO ОБРОБКА ---
socket.on('new-data', (data) => {
    // ЗАХИСТ: Перевірка валідності даних
    if (!data || typeof data !== 'object') return;

    const { power, voltage, current, temperature, joints, motors_power } = data;

    // Оновлення UI
    setText('livePower', `${Number(power).toFixed(1)} W`);
    setText('liveVoltage', Number(voltage).toFixed(1));
    setText('liveCurrent', Number(current).toFixed(2));
    if (temperature) setText('robotTemp', `${Number(temperature).toFixed(1)}°C`);
    if (joints && Array.isArray(joints)) {
        joints.forEach((angle, i) => setText(`val_q${i + 1}`, `${Number(angle).toFixed(1)}°`));
    }

    // Статус
    const statusSpan = getEl('systemStatus');
    const isOverload = power > currentThreshold;
    statusSpan.textContent = isOverload ? "ПЕРЕВАНТАЖЕННЯ!" : "НОРМА";
    statusSpan.className = isOverload ? "status-danger" : "status-ok";

    // --- ГРАФІКИ ---
    // Використовуємо локальний час браузера для плавності осі X
    const time = new Date().toLocaleTimeString();

    updateChartData(mainChart, time, power, 50);

    // ЗАХИСТ: Перевіряємо, чи є масив моторів і чи в ньому 6 значень
    if (Array.isArray(motors_power) && motors_power.length === 6) {
        motorCharts.forEach((chart, i) => {
            updateChartData(chart, time, motors_power[i], 30);
        });
    } else {
        console.warn("Отримано некоректні дані моторів:", motors_power);
        // Можна намалювати нулі, щоб графік не зупинявся
        motorCharts.forEach((chart) => updateChartData(chart, time, 0, 30));
    }
});

// --- ІНШЕ (Alerts, Login, Export) ---
const showPopup = (id, msg, duration = 3000) => {
    const el = getEl(id);
    if(el) {
        el.innerText = msg;
        showElement(id, true);
        setTimeout(() => showElement(id, false), duration);
    }
};

socket.on('alert', (data) => showPopup('alertBox', `⚠️ ${data.msg}`, 4000));
socket.on('forecast', (data) => showPopup('forecastBox', data.msg, 3000));

const attemptLogin = () => {
    const u = getEl('usernameInput').value;
    const p = getEl('passwordInput').value;
    if (u === 'admin' && p === 'admin') openDashboard(true, u);
    else if (u && p) openDashboard(false, u);
    else showPopup('loginError', 'Помилка входу', 2000);
};

const openDashboard = (isAdmin, user) => {
    showElement('loginScreen', false);
    showElement('dashboard', true);
    const badge = getEl('userRoleBadge');
    badge.innerText = isAdmin ? "ADMIN" : user;
    badge.className = `badge ${isAdmin ? 'bg-warning text-dark' : 'bg-secondary'}`;
    showElement('adminPanelCard', isAdmin);
    initDateInputs();
};

const logout = () => location.reload();

const updateThreshold = () => {
    const val = getEl('thresholdInput').value;
    currentThreshold = val;
    fetch('/api/settings/threshold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold: val })
    }).then(() => alert('Поріг оновлено!'));
};

const initDateInputs = () => {
    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60000);
    const startInput = getEl('startTime');
    const endInput = getEl('endTime');
    if (startInput && endInput) {
        startInput.value = toLocalISO(fiveMinAgo);
        endInput.value = toLocalISO(now);
    }
};

const exportRange = (type) => {
    const start = getEl('startTime').value;
    const end = getEl('endTime').value;
    if (!start || !end) { alert("Оберіть дати!"); return; }
    const endpoint = type === 'json' ? '/api/export' : '/api/export-csv';
    window.open(`${endpoint}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, '_blank');
};

const calculateEnergy = () => {
    const start = getEl('startTime').value;
    const end = getEl('endTime').value;
    if (!start || !end) { alert("Оберіть дати!"); return; }
    fetch('/api/stats/consumption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start, end })
    })
    .then(r => r.json())
    .then(data => {
        setText('energyValue', data.energy);
        setText('energyCount', data.count);
        showElement('calcResult', true);
    });
};