const express = require('express');
const http = require('http');
const fs = require('fs');
const mqtt = require('mqtt');
const { Server } = require("socket.io");
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const DB_FILE = 'database.json';

app.use(cors());
app.use(express.static(__dirname)); 
app.use(bodyParser.json());

// --- БАЗА ДАНИХ (ФАЙЛ) ---
function loadData() {
    try {
        if (!fs.existsSync(DB_FILE)) return [];
        return JSON.parse(fs.readFileSync(DB_FILE));
    } catch (e) { console.error(e); return []; }
}
function saveData(data) {
    try { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); } catch (e) { console.error(e); }
}

let dbMemory = loadData();
console.log(`Database loaded. Records: ${dbMemory.length}`);

// --- MQTT ---
// Зберігаємо клієнт у змінну, щоб потім експортувати її
const mqttClient = mqtt.connect('mqtt://test.mosquitto.org');
let ALARM_THRESHOLD = 500; 

mqttClient.on('connect', () => {
    console.log('MQTT Connected');
    mqttClient.subscribe('puma560/telemetry');
});

mqttClient.on('message', (topic, message) => {
    if (topic === 'puma560/telemetry') {
        const data = JSON.parse(message.toString());
        
        const newData = {
            timestamp: new Date(),
            voltage: data.voltage,
            current: data.current,
            power: data.power,
            temperature: data.temperature || 0,
            joints: data.joints || [0,0,0,0,0,0],
            // ВАЖЛИВО: Зберігаємо дані про 6 моторів
            motors_power: data.motors_power || [0,0,0,0,0,0] 
        };

        dbMemory.push(newData);
        if (dbMemory.length > 5000) dbMemory.shift(); // Тримаємо 5000 записів
        saveData(dbMemory);

        // Перевірка аварії
        if (data.power > ALARM_THRESHOLD) {
            io.emit('alert', { msg: `ПЕРЕВАНТАЖЕННЯ: ${data.power.toFixed(1)} W` });
        }

        io.emit('new-data', newData);
    }
});

// --- API ФУНКЦІЇ ДЛЯ ФІЛЬТРАЦІЇ ---
function filterByDate(data, startStr, endStr) {
    if (!startStr || !endStr) return data; // Якщо дат немає, повертаємо все
    const startDate = new Date(startStr);
    const endDate = new Date(endStr);
    return data.filter(item => {
        const itemTime = new Date(item.timestamp);
        return itemTime >= startDate && itemTime <= endDate;
    });
}

// --- REST API ENDPOINTS ---

// 1. Історія для графіка (останні 50)
app.get('/api/history', (req, res) => {
    res.json(dbMemory.slice(-50));
});

// 2. Експорт JSON (з підтримкою фільтру ?start=...&end=...)
app.get('/api/export', (req, res) => {
    const { start, end } = req.query;
    const filteredData = filterByDate(dbMemory, start, end);
    
    res.header("Content-Type", "application/json");
    res.header("Content-Disposition", "attachment; filename=energy_data.json");
    res.send(JSON.stringify(filteredData, null, 4));
});

// 3. Експорт CSV (з підтримкою фільтру + МОТОРИ)
app.get('/api/export-csv', (req, res) => {
    const { start, end } = req.query;
    const filteredData = filterByDate(dbMemory, start, end);

    let csv = "Timestamp,Voltage(V),Current(A),Power(W),Temp(C),J1,J2,J3,J4,J5,J6,Motor1(W),Motor2(W),Motor3(W),Motor4(W),Motor5(W),Motor6(W)\n";
    
    filteredData.forEach(row => {
        const d = new Date(row.timestamp).toISOString();
        const j = row.joints || [0,0,0,0,0,0];
        const m = row.motors_power || [0,0,0,0,0,0];
        const t = row.temperature || 0;
        
        csv += `${d},${row.voltage},${row.current},${row.power},${t},${j[0]},${j[1]},${j[2]},${j[3]},${j[4]},${j[5]},${m[0]},${m[1]},${m[2]},${m[3]},${m[4]},${m[5]}\n`;
    });

    res.header("Content-Type", "text/csv");
    res.attachment("energy_report.csv"); 
    res.send(csv);
});

// 4. Налаштування порогу
app.post('/api/settings/threshold', (req, res) => {
    if(req.body.threshold) {
        ALARM_THRESHOLD = parseFloat(req.body.threshold);
        res.json({ status: 'ok', newThreshold: ALARM_THRESHOLD });
    } else {
        res.status(400).json({ error: 'No threshold' });
    }
});

// 5. Розрахунок споживання (Аналітика)
app.post('/api/stats/consumption', (req, res) => {
    const { start, end } = req.body;
    const filteredData = filterByDate(dbMemory, start, end);

    if (filteredData.length < 2) return res.json({ energy: 0, count: 0 });

    let totalEnergyWh = 0;
    for (let i = 1; i < filteredData.length; i++) {
        const t1 = new Date(filteredData[i-1].timestamp).getTime();
        const t2 = new Date(filteredData[i].timestamp).getTime();
        const pAvg = (filteredData[i-1].power + filteredData[i].power) / 2;
        const hours = (t2 - t1) / (1000 * 3600);
        totalEnergyWh += pAvg * hours;
    }

    res.json({ energy: totalEnergyWh.toFixed(5), count: filteredData.length });
});

const PORT = process.env.PORT || 3000;

// Ця умова перевіряє: "Файл запущено напряму чи імпортовано в тест?"
if (require.main === module) {
    // Якщо запускаємо сайт вручну -> слухаємо порт
    server.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

// Експортуємо ОБ'ЄКТ, щоб unit.test.js міг взяти 'app', 'server' та 'client'
module.exports = { 
    app, 
    server, 
    client: mqttClient 
};