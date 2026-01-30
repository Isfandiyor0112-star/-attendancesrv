require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const mongoose = require('mongoose');

const app = express();

let userStates = {}; 

// 1. ТВОЙ CORS (БЕЗ ИЗМЕНЕНИЙ)
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

    // --- ОБРАБОТКА КНОПОК ПОД ТЕКСТОМ (CALLBACK) ---
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

      if (action === 'del_news_conf') {
        await News.deleteOne({ _id: targetId });
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { chat_id: chatId, text: "🗑 Новость удалена!" });
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
        const kb = teachers.map((t, i) => ([{ text: `${i+1}. ${t.name}`, callback_data: `manage:${t._id}` }]));
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { chat_id: chatId, text: "👨‍🏫 Список:", reply_markup: { inline_keyboard: kb } });
      }
      return res.sendStatus(200);
    }

    // --- ОБРАБОТКА ТЕКСТОВЫХ СООБЩЕНИЙ ---
    if (!message || !message.text) return res.sendStatus(200);
    const text = message.text;

    // Главные команды меню (ТВОЙ ВАРИАНТ)
    if (text === "/start" || text === "O'qituvchilar ro'yxati") {
      const teachers = await User.find();
      const inlineKb = teachers.map((t, i) => ([{ text: `${i+1}. ${t.name} (${t.className})`, callback_data: `manage:${t._id}` }]));
      inlineKb.push([{ text: "➕ Добавить учителя", callback_data: "start_add" }]);
      
      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        chat_id: chatId, 
        text: "👨‍🏫 **Управление базой:**", 
        parse_mode: "Markdown", 
        reply_markup: { 
          inline_keyboard: inlineKb,
          keyboard: [
            [{ text: "O'qituvchilar ro'yxati" }],
            [{ text: "📢 Добавить новость" }, { text: "🗑 Удалить новость" }]
          ],
          resize_keyboard: true 
        }
      });
      return res.sendStatus(200);
    }

    if (text === "📢 Добавить новость") {
      userStates[chatId] = { action: 'adding_news' };
      return axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { chat_id: chatId, text: "Введите текст новости:" });
    }

    if (text === "🗑 Удалить новость") {
      const last = await News.findOne().sort({ date: -1 });
      if (!last) return axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { chat_id: chatId, text: "Новостей нет." });
      return axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text: `Удалить эту новость?\n\n"${last.text}"`,
        reply_markup: {
          inline_keyboard: [[{ text: "✅ Да, удалить", callback_data: `del_news_conf:${last._id}` }]]
        }
      });
    }

    // ЛОГИКА ВВОДА (Здесь бот САМ выходит из режима после ввода)
    if (userStates[chatId]) {
      const state = userStates[chatId];
      
      if (state.action === 'adding_news') {
        await new News({ text: text }).save();
        delete userStates[chatId]; // ВЫХОД ИЗ РЕЖИМА НОВОСТИ
        return axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { chat_id: chatId, text: "✅ Новость опубликована!" });
      }

      if (state.action === 'edit_name') await User.findByIdAndUpdate(state.userId, { name: text });
      if (state.action === 'edit_class') await User.findByIdAndUpdate(state.userId, { className: text });
      if (state.action === 'edit_pass') await User.findByIdAndUpdate(state.userId, { password: text });
      if (state.action === 'adding_user') {
        const [l, p, n, c] = text.split(' ');
        if (c) await new User({ login: l, password: p, name: n, className: c }).save();
      }
      
      delete userStates[chatId]; // ВЫХОД ИЗ ЛЮБОГО РЕЖИМА РЕДАКТИРОВАНИЯ
      return axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { chat_id: chatId, text: "✅ Данные обновлены!" });
    }

    res.sendStatus(200);
  } catch (err) { res.sendStatus(200); }
});

// --- ТВОИ API ЭНДПОИНТЫ (БЕЗ ИЗМЕНЕНИЙ) ---

app.get('/api/latest-news', async (req, res) => {
    const latest = await News.findOne().sort({ date: -1 });
    res.json(latest || { text: "" });
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
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { chat_id: CHAT_ID, text: msg }).catch(() => {});
    res.json({ status: "ok" });
  } catch (err) { res.status(500).json({ error: err.message }); }
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
  try { await Absent.findByIdAndDelete(req.params.id); res.json({ status: "ok" }); } 
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/absents', async (req, res) => {
  try { await Absent.deleteMany({}); res.json({ status: "ok" }); } 
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/users', async (req, res) => {
  const { key } = req.query;
  if (!key || key !== process.env.ADMIN_QUERY_KEY) return res.status(403).json({ error: "Access Denied" });
  const users = await User.find();
  res.json(users);
});

module.exports = app;
