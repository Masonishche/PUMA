const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://test.mosquitto.org');

let timeStep = 0;

client.on('connect', () => {
    console.log('🤖 PUMA 560 6-Motor Simulator: ONLINE');

    setInterval(() => {
        timeStep += 0.1;

        // 1. Генеруємо кути (щоб було красиво)
        const q1 = Math.sin(timeStep) * 160;
        const q2 = Math.sin(timeStep * 0.8) * 45;
        const q3 = Math.cos(timeStep * 1.2) * 135;
        const q4 = Math.sin(timeStep * 1.5) * 110;
        const q5 = Math.cos(timeStep * 0.5) * 100;
        const q6 = Math.sin(timeStep * 2.0) * 266;

        // 2. ГЕНЕРУЄМО ПОТУЖНІСТЬ ДЛЯ 6 МОТОРІВ ОКРЕМО
        const p1 = Math.abs(Math.sin(timeStep) * 50) + Math.random() * 1;
        const p2 = Math.abs(Math.sin(timeStep * 1.1) * 40) + Math.random() * 1;
        const p3 = Math.abs(Math.cos(timeStep * 0.9) * 35) + Math.random() * 1;
        const p4 = Math.abs(Math.sin(timeStep * 2.0) * 20) + Math.random() * 0.5;
        const p5 = Math.abs(Math.cos(timeStep * 1.5) * 15) + Math.random() * 0.5;
        const p6 = Math.abs(Math.sin(timeStep * 3.0) * 10) + Math.random() * 0.2;
        // Сумарна потужність
        const totalPower = p1 + p2 + p3 + p4 + p5 + p6 + 10; // +10Вт електроніка

        const voltage = 220 + (Math.random() * 2 - 1);
        const current = totalPower / voltage;
        const temp = 40 + (totalPower / 30);

        const telemetry = {
            voltage: parseFloat(voltage.toFixed(2)),
            current: parseFloat(current.toFixed(2)),
            power: parseFloat(totalPower.toFixed(2)),
            temperature: parseFloat(temp.toFixed(1)),
            joints: [q1.toFixed(1), q2.toFixed(1), q3.toFixed(1), q4.toFixed(1), q5.toFixed(1), q6.toFixed(1)],
            
            // ВАЖЛИВО: Ось цей масив потрібен для 6 графіків!
            motors_power: [
                parseFloat(p1.toFixed(1)),
                parseFloat(p2.toFixed(1)),
                parseFloat(p3.toFixed(1)),
                parseFloat(p4.toFixed(1)),
                parseFloat(p5.toFixed(1)),
                parseFloat(p6.toFixed(1))
            ]
        };

        console.log(`📤 Sending: Total ${telemetry.power}W | Motors Array Sent: YES`);
        client.publish('puma560/telemetry', JSON.stringify(telemetry));

    }, 2000);
});