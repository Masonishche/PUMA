const socket = io();
let currentThreshold = 500;

// --- ДОПОМІЖНІ ФУНКЦІЇ ---
const getEl = (id) => document.getElementById(id);
const setText = (id, text) => { const el = getEl(id); if (el) el.textContent = text; };
const showElement = (id, show = true) => { const el = getEl(id); if (el) el.style.display = show ? 'block' : 'none'; };

// Форматування дати для input type="datetime-local" (YYYY-MM-DDTHH:mm)
const toLocalISO = (date) => {
    const offset = date.getTimezoneOffset() * 60000; // зміщення в мс
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

// --- CHART.JS ---
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
            backgroundColor: color.replace(')', ', 0.1)').replace('rgb', 'rgba').replace('#', 'rgba(13, 202, 240, 0.1'),
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 0
        }]
    },
    options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { display: false },
            y: { display: true, ...(maxY ? { suggestedMax: maxY } : { beginAtZero: true }) }
        },
        interaction: { intersect: false, mode: 'index' }
    }
});

const updateChartData = (chart, label, dataPoint, maxLen) => {
    if (chart.data.labels.length > maxLen) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
    }
    chart.data.labels.push(label);
    chart.data.datasets[0].data.push(dataPoint);
    chart.update();
};

// Ініціалізація графіків
const mainChart = createChart(getEl('mainChart'), 'Total Power (W)', '#0dcaf0', 400);
const motorCharts = Array.from({ length: 6 }, (_, i) => 
    createChart(getEl(`chartM${i + 1}`).getContext('2d'), `M${i + 1} (W)`, '#198754')
);

// --- SOCKET.IO ОБРОБКА ---
socket.on('new-data', (data) => {
    const { power, voltage, current, temperature, joints, motors_power, timestamp } = data;

    setText('livePower', `${power} W`);
    setText('liveVoltage', voltage);
    setText('liveCurrent', current);
    if (temperature) setText('robotTemp', `${temperature}°C`);
    if (joints) joints.forEach((angle, i) => setText(`val_q${i + 1}`, `${angle}°`));

    const statusSpan = getEl('systemStatus');
    const isOverload = power > currentThreshold;
    statusSpan.textContent = isOverload ? "ПЕРЕВАНТАЖЕННЯ!" : "НОРМА";
    statusSpan.className = isOverload ? "status-danger" : "status-ok";

    const time = new Date(timestamp).toLocaleTimeString();
    updateChartData(mainChart, time, power, 50);

    if (motors_power) {
        motorCharts.forEach((chart, i) => updateChartData(chart, time, motors_power[i], 30));
    }
});

const showPopup = (id, msg, duration = 3000) => {
    const el = getEl(id);
    el.innerText = msg;
    showElement(id, true);
    setTimeout(() => showElement(id, false), duration);
};

socket.on('alert', (data) => showPopup('alertBox', `⚠️ ${data.msg}`, 4000));
socket.on('forecast', (data) => showPopup('forecastBox', data.msg, 3000));

// --- ЛОГІКА ІНТЕРФЕЙСУ ---
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

    // НОВЕ: Ініціалізуємо дати при вході
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

// --- НОВЕ: ФУНКЦІЇ ЕКСПОРТУ (з вашого запиту) ---

// Встановлює значення input-ів: "Зараз" та "5 хвилин тому"
const initDateInputs = () => {
    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60000); // мінус 5 хв

    const startInput = getEl('startTime');
    const endInput = getEl('endTime');

    if (startInput && endInput) {
        startInput.value = toLocalISO(fiveMinAgo);
        endInput.value = toLocalISO(now);
    }
};

// Експорт за діапазоном
const exportRange = () => {
    const start = getEl('startTime').value;
    const end = getEl('endTime').value;

    if (!start || !end) {
        alert("Будь ласка, виберіть обидві дати (початок і кінець).");
        return;
    }

    // Формуємо посилання з параметрами
    const url = `/api/export-csv?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
    window.open(url, '_blank');
};

// Старий повний експорт (можна залишити як альтернативу)
const exportAll = () => window.open('/api/export-csv', '_blank');