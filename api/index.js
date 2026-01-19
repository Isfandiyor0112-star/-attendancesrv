require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const mongoose = require('mongoose');

const app = express();

let userStates = {}; 

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
  try {
    const { message, callback_query } = req.body;

    // 1. Определяем, кто нажал кнопку или прислал текст
    const fromId = message ? message.from.id : callback_query.from.id;
    const userId = fromId.toString();
    const chatId = message ? message.chat.id : callback_query.message.chat.id;

    // 2. ПРОВЕРКА ДОСТУПА (Разрезаем CHAT_ID по запятым)
    const allowedUsers = process.env.CHAT_ID ? process.env.CHAT_ID.split(',') : [];
    
    if (!allowedUsers.includes(userId)) {
      console.log(`[!] Доступ запрещен: ${userId}`);
      return res.sendStatus(200);
    }

    // --- ОБРАБОТКА КНОПОК (CALLBACK) ---
    if (callback_query) {
      const [action, targetId] = callback_query.data.split(':');

      if (action === 'manage') {
        const user = await User.findById(targetId);
        if (!user) return res.sendStatus(200);
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: `👤 **${user.name}**\n📍 Класс: ${user.className}\n🔑 Логин: \`${user.login}\`\n\nВыберите действие:`,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "✏️ Имя", callback_data: `edit_name:${targetId}` }, { text: "🏫 Класс", callback_data: `edit_class:${targetId}` }],
              [{ text: "🔑 Пароль", callback_data: `edit_pass:${targetId}` }, { text: "🗑 Удалить", callback_data: `confirm_del:${targetId}` }],
              [{ text: "⬅️ Назад", callback_data: `back_to_list` }]
            ]
          }
        });
      }

      if (['edit_name', 'edit_class', 'edit_pass'].includes(action)) {
        userStates[chatId] = { action, userId: targetId };
        const labels = { edit_name: "новое ИМЯ", edit_class: "новый КЛАСС", edit_pass: "новый ПАРОЛЬ" };
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          chat_id: chatId, text: `⌨️ Введите ${labels[action]}:`
        });
      }

      if (action === 'confirm_del') {
        await User.findByIdAndDelete(targetId);
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { chat_id: chatId, text: "✅ Удалено." });
      }

      if (action === 'start_add') {
        userStates[chatId] = { action: 'adding_user' };
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          chat_id: chatId, text: "📝 Введите: `логин пароль имя класс` (через пробел)", parse_mode: "Markdown"
        });
      }

      if (action === 'back_to_list') {
        const teachers = await User.find();
        const keyboard = teachers.map((t, i) => ([{ text: `${i+1}. ${t.name}`, callback_data: `manage:${t._id}` }]));
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { chat_id: chatId, text: "👨‍🏫 Список:", reply_markup: { inline_keyboard: keyboard } });
      }
      return res.sendStatus(200);
    }

    // --- ОБРАБОТКА ТЕКСТА ---
    if (!message || !message.text) return res.sendStatus(200);
    const text = message.text;

    if (userStates[chatId]) {
      const state = userStates[chatId];
      if (state.action === 'edit_name') await User.findByIdAndUpdate(state.userId, { name: text });
      if (state.action === 'edit_class') await User.findByIdAndUpdate(state.userId, { className: text });
      if (state.action === 'edit_pass') await User.findByIdAndUpdate(state.userId, { password: text });
      if (state.action === 'adding_user') {
        const [l, p, n, c] = text.split(' ');
        if (c) await new User({ login: l, password: p, name: n, className: c }).save();
      }
      delete userStates[chatId];
      return await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { chat_id: chatId, text: "✅ Готово!" });
    }

    if (text === "/start" || text === "O'qituvchilar ro'yxati") {
      const teachers = await User.find();
      const keyboard = teachers.map((t, i) => ([{ text: `${i+1}. ${t.name} (${t.className})`, callback_data: `manage:${t._id}` }]));
      keyboard.push([{ text: "➕ Добавить учителя", callback_data: "start_add" }]);
      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        chat_id: chatId, text: "👨‍🏫 **Управление базой:**", parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard }
      });
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("🔴 Ошибка:", err.message);
    res.sendStatus(200);
  }
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
  const { key } = req.query; // Вытаскиваем ключ из ссылки (?key=...)
  const validKey = process.env.ADMIN_QUERY_KEY; // Вытаскиваем правильный ключ из настроек Vercel

  // Сравниваем ключ из ссылки с ключом из настроек
  if (!key || key !== validKey) {
    return res.status(403).json({ error: "Access Denied" });
  }

  // Если всё ок — отдаем список
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





