require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const mongoose = require('mongoose');

const app = express();

// 1. Улучшенная настройка CORS для работы с Vercel
app.use(cors({
  origin: "*", // Позволяет запросы с любого фронтенда
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID; 
const MONGO_URI = process.env.MONGO_URI;

// Подключение к БД с обработкой ошибок для Serverless
if (MONGO_URI) {
    mongoose.connect(MONGO_URI)
      .then(() => console.log('✅ Connected to MongoDB'))
      .catch(err => console.error('❌ DB Error:', err));
} else {
    console.error("❌ MONGO_URI is missing in Environment Variables!");
}

// --- МОДЕЛИ ---
const User = mongoose.model('User', new mongoose.Schema({
  login: String, 
  password: { type: String },
  name: String, 
  className: String, 
  role: { type: String, default: "teacher" }
}));

const Absent = mongoose.model('Absent', new mongoose.Schema({
  teacher: String, 
  className: String, 
  date: String,
  count: String, 
  studentName: String, 
  reason: String, 
  allstudents: String
}));

// --- ТЕЛЕГРАМ БОТ ---
app.post('/api/bot', async (req, res) => {
  const { message } = req.body;
  if (!message || !message.text) return res.sendStatus(200);
  const userId = message.from.id.toString();
  const text = message.text;

  if (userId !== CHAT_ID) return res.sendStatus(200);

  if (text === '/start') {
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text: "🌟 **Oltin Panel**\n\n1. `O'qituvchilar ro'yxati` - ko'rish\n2. `EDIT login parol` - o'zgartirish",
      reply_markup: { keyboard: [[{ text: "O'qituvchilar ro'yxati" }]], resize_keyboard: true }
    });
  }

  if (text === "O'qituvchilar ro'yxati") {
    const teachers = await User.find();
    let msg = "👨‍🏫 **Baza:**\n\n";
    teachers.forEach((t, i) => msg += `${i+1}. ${t.name} | \`${t.login}\` : \`${t.password}\`\n`);
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { chat_id: CHAT_ID, text: msg, parse_mode: "Markdown" });
  }

  if (text.startsWith('EDIT')) {
    const [_, login, newPass] = text.split(' ');
    await User.findOneAndUpdate({ login }, { password: newPass });
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { chat_id: CHAT_ID, text: `✅ Parol yangilandi!` });
  }
  res.sendStatus(200);
});

// --- API ЭНДПОИНТЫ ---

app.post('/api/login', async (req, res) => {
  const { login, password } = req.body;
  const user = await User.findOne({ login, password });
  if (user) res.json({ status: "ok", user });
  else res.json({ status: "error" });
});

app.post('/api/absent', async (req, res) => {
  try {
    const data = req.body;
    const record = new Absent(data);
    await record.save();

    const msg = `📊 **Hisobot**: ${data.teacher} (${data.className})\n❌ Yo'q: ${data.count}\n📝 ${data.studentName}\n💬 Sabab: ${data.reason}`;
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { 
        chat_id: CHAT_ID, 
        text: msg 
    }).catch(() => {});

    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/absents', async (req, res) => {
  const data = await Absent.find().sort({ date: -1 });
  res.json(data);
});

app.put('/api/absent/:id', async (req, res) => {
  try {
    const updated = await Absent.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    res.json({ status: "ok", data: updated });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/absent/:id', async (req, res) => {
  try {
    await Absent.findByIdAndDelete(req.params.id);
    res.json({ status: "ok" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/absents', async (req, res) => {
  try {
    await Absent.deleteMany({});
    res.json({ status: "ok" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/users', async (req, res) => {
  const users = await User.find();
  res.json(users);
});

// --- ВАЖНО ДЛЯ VERCEL ---
// Не запускаем app.listen в продакшене, Vercel сделает это сам
if (process.env.NODE_ENV !== 'production') {
  const PORT = 3000;
  app.listen(PORT, () => console.log(`🚀 Локальный сервер: http://localhost:${PORT}`));
}

// Экспортируем модуль для Vercel
module.exports = app;
