const express = require('express');
const cors = require('cors');
const axios = require('axios');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

// --- Настройки из Environment Variables (укажи их в настройках Vercel) ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const MONGO_URI = process.env.MONGO_URI;

// Подключение к облачной базе
mongoose.connect(MONGO_URI)
  .then(() => console.log('DB Connected'))
  .catch(err => console.error('DB Error:', err));

const Absent = mongoose.model('Absent', new mongoose.Schema({
  teacher: String, className: String, date: String,
  count: String, studentName: String, reason: String, allstudents: String
}));

// Твой список пользователей
const users = [ 
  { login: "22maktab", password: "iroda", name: "Dadabayeva.I.D.", className: "1A" },
  { login: "shaxnoza", password: "22_admin", name: "Ruzimatova.Sh.R" },
  { login: "admin", password: "goldenkey", name: "Bayjanova.Sh"}
  // ... (остальные твои учителя)
];

// API: Получить всех
app.get('/api/absents', async (req, res) => {
  const data = await Absent.find().sort({ date: -1 });
  res.json(data);
});

// API: Добавить запись + Telegram
app.post('/api/absent', async (req, res) => {
  const record = new Absent(req.body);
  await record.save();

  const { date, teacher, className, allstudents, count } = req.body;
  const present = (parseFloat(allstudents) || 0) - (parseFloat(count) || 0);
  
  const msg = `📊 ${teacher} | Класс ${className} (${date})\nПришли: ${present} из ${allstudents}`;
  
  await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    chat_id: CHAT_ID, text: msg
  }).catch(e => console.log('TG Error'));

  res.json({ status: "ok" });
});

// API: Логин
app.post('/api/login', (req, res) => {
  const { login, password } = req.body;
  const user = users.find(u => u.login === login && u.password === password);
  if (user) {
    const { password: _, ...userData } = user;
    res.json({ status: "ok", user: userData });
  } else {
    res.json({ status: "error" });
  }
});

// API: Очистка (для админки)
app.delete('/api/absents', async (req, res) => {
  await Absent.deleteMany({});
  res.json({ status: "ok" });
});

module.exports = app;
