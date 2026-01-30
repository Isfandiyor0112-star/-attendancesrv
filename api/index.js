require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const mongoose = require('mongoose');

const app = express();
let userStates = {}; 

// 1. Настройка CORS
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID; 
const MONGO_URI = process.env.MONGO_URI;

// Подключение к БД
if (MONGO_URI) {
    mongoose.connect(MONGO_URI)
      .then(() => console.log('✅ Connected to MongoDB'))
      .catch(err => console.error('❌ DB Error:', err));
}

// --- МОДЕЛИ ---
const User = mongoose.model('User', new mongoose.Schema({
  login: String, 
  password: { type: String },
  name: String, 
  className: String, 
  role: { type: String, default: "teacher" }
}));

const News = mongoose.model('News', new mongoose.Schema({
  text: String,
  date: { type: Date, default: Date.now }
}));

const Absent = mongoose.model('Absent', new mongoose.Schema({
  teacher: String, 
  className: String, 
  date: String,
  count: String, 
  studentName: String, 
  reason: String, 
  allstudents: String
}), 'absents_fixed');

// --- ТЕЛЕГРАМ БОТ ---
app.post('/api/bot', async (req, res) => {
  try {
    const { message, callback_query } = req.body;

    const fromId = message ? message.from.id : callback_query.from.id;
    const userId = fromId.toString();
    const chatId = message ? message.chat.id : callback_query.message.chat.id;

    const allowedUsers = process.env.CHAT_ID ? process.env.CHAT_ID.split(',') : [];
    if (!allowedUsers.includes(userId)) return res.sendStatus(200);

    // --- CALLBACK КНОПКИ (Inline) ---
    if (callback_query) {
      const [action, targetId] = callback_query.data.split(':');

      if (action === 'manage') {
        const user = await User.findById(targetId);
        if (!user) return res.sendStatus(200);
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: `👤 **${user.name}**\n📍 Класс: ${user.className}\n🔑 Логин: \`${user.login}\``,
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
          chat_id: chatId, text: "📝 Введите: `логин пароль имя класс`", parse_mode: "Markdown"
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

    // 1. Кнопка из нижнего меню (Reply Keyboard)
    if (text === "📢 Yangilik / Новости") {
      userStates[chatId] = { action: 'adding_news' };
      return await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text: "📝 **Введите текст новости:**\nЕё увидят все учителя на сайте.",
        parse_mode: "Markdown"
      });
    }

    // 2. Обработка состояний (ввод данных)
    if (userStates[chatId]) {
      const state = userStates[chatId];

      if (state.action === 'adding_news') {
        await new News({ text: text }).save();
        delete userStates[chatId];
        return await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { 
            chat_id: chatId, text: "✅ **Новость сохранена!**" 
        });
      }

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

    // 3. Команды старта и меню
    if (text === "/start" || text === "O'qituvchilar ro'yxati") {
      const teachers = await User.find();
      const inlineKeyboard = teachers.map((t, i) => ([{ text: `${i+1}. ${t.name} (${t.className})`, callback_data: `manage:${t._id}` }]));
      inlineKeyboard.push([{ text: "➕ Добавить учителя", callback_data: "start_add" }]);

      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        chat_id: chatId, 
        text: "👨‍🏫 **Управление системой:**", 
        parse_mode: "Markdown", 
        reply_markup: { 
          inline_keyboard: inlineKeyboard,
          keyboard: [
            [{ text: "O'qituvchilar ro'yxati" }],
            [{ text: "📢 Yangilik / Новости" }]
          ],
          resize_keyboard: true 
        }
      });
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("🔴 Ошибка:", err.message);
    res.sendStatus(200);
  }
});

// --- API ЭНДПОИНТЫ ДЛЯ САЙТА ---
app.get('/api/latest-news', async (req, res) => {
  try {
    const latest = await News.findOne().sort({ date: -1 });
    res.json(latest || { text: "" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/login', async (req, res) => {
  const { login, password } = req.body;
  const user = await User.findOne({ login, password });
  if (user) res.json({ status: "ok", user });
  else res.json({ status: "error" });
});

app.post('/api/absent', async (req, res) => {
  try {
    const data = req.body;
    await new Absent(data).save();
    const msg = `📊 **Hisobot**: ${data.teacher}\n❌ Yo'q: ${data.count}\n📝 ${data.studentName}`;
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { chat_id: CHAT_ID, text: msg }).catch(()=>{});
    res.json({ status: "ok" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/absents', async (req, res) => {
  const data = await Absent.find().sort({ date: -1 });
  res.json(data);
});

app.delete('/api/absents', async (req, res) => {
  try { await Absent.deleteMany({}); res.json({ status: "ok" }); } 
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/users', async (req, res) => {
  const { key } = req.query;
  if (key !== process.env.ADMIN_QUERY_KEY) return res.status(403).json({ error: "Access Denied" });
  const users = await User.find();
  res.json(users);
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(3000, () => console.log(`🚀 Server on http://localhost:3000`));
}

module.exports = app;
