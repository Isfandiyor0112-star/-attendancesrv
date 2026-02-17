require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const mongoose = require('mongoose');

const app = express();
let userStates = {}; 

app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], allowedHeaders: ["Content-Type", "Authorization"] }));
app.use(express.json());

const { BOT_TOKEN, CHAT_ID, MONGO_URI, ADMIN_QUERY_KEY } = process.env;

// --- ПОДКЛЮЧЕНИЕ ---
mongoose.connect(MONGO_URI).then(() => console.log('✅ Connected to MongoDB'));

// --- МОДЕЛИ (ИСПРАВЛЕНО) ---
const User = mongoose.model('User', new mongoose.Schema({
  login: String, 
  password: { type: String },
  name: String, 
  className: String, 
  role: { type: String, default: "teacher" }
}), 'users'); // Твоя родная коллекция

const Absent = mongoose.model('Absent', new mongoose.Schema({
  teacher: String, 
  className: String, 
  date: String,
  count: String, 
  studentName: String, 
  reason: String, 
  allstudents: String
}), 'absents_itma'); // Твоя родная коллекция для прогулов

// --- ТЕЛЕГРАМ БОТ ---
app.post('/api/bot', async (req, res) => {
  res.sendStatus(200); 
  try {
    const { message, callback_query } = req.body;
    const fromId = message?.from?.id || callback_query?.from?.id;
    const chatId = message?.chat?.id || callback_query?.message?.chat?.id;
    if (!fromId) return;

    const allowed = CHAT_ID?.split(',') || [];
    if (!allowed.includes(fromId.toString())) return;

    if (callback_query) {
      const [action, targetId] = callback_query.data.split(':');
      if (action === 'manage' || action === 'back_to_list') {
        const teachers = await User.find();
        const kb = teachers.map(t => ([{ text: `👤 ${t.name}`, callback_data: `manage:${t._id}` }]));
        if (action === 'back_to_list') return axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { chat_id: chatId, text: "👨‍🏫 Список:", reply_markup: { inline_keyboard: kb } });
        
        const user = await User.findById(targetId);
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          chat_id: chatId, text: `👤 **${user.name}**\n🔑 Логин: \`${user.login}\`\n🔐 Пароль: \`${user.password}\``, parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "✏️ Имя", callback_data: `edit_name:${targetId}` }, { text: "🏫 Класс", callback_data: `edit_class:${targetId}` }], [{ text: "🔐 Пароль", callback_data: `edit_pass:${targetId}` }, { text: "🗑 Удалить", callback_data: `confirm_del:${targetId}` }], [{ text: "⬅️ Назад", callback_data: "back_to_list" }]] }
        });
      }
      if (['edit_name', 'edit_class', 'edit_pass'].includes(action)) { userStates[chatId] = { action, userId: targetId }; await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { chat_id: chatId, text: "Введите данные:" }); }
      if (action === 'confirm_del') { await User.findByIdAndDelete(targetId); await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { chat_id: chatId, text: "✅ Удалено" }); }
      if (action === 'start_add') { userStates[chatId] = { action: 'adding_user' }; await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { chat_id: chatId, text: "Введите: логин пароль имя класс" }); }
      return;
    }

    const text = message?.text;
    if (userStates[chatId]) {
      const state = userStates[chatId];
      if (state.action === 'edit_name') await User.findByIdAndUpdate(state.userId, { name: text });
      if (state.action === 'edit_class') await User.findByIdAndUpdate(state.userId, { className: text });
      if (state.action === 'edit_pass') await User.findByIdAndUpdate(state.userId, { password: text });
      if (state.action === 'adding_user') { const [l, p, n, c] = text.split(' '); if (c) await new User({ login: l, password: p, name: n, className: c }).save(); }
      delete userStates[chatId];
      return axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { chat_id: chatId, text: "✅ Готово" });
    }

    if (text === "/start") {
      const teachers = await User.find();
      const kb = teachers.map(t => ([{ text: `👤 ${t.name}`, callback_data: `manage:${t._id}` }]));
      kb.push([{ text: "➕ Добавить учителя", callback_data: "start_add" }]);
      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { chat_id: chatId, text: "🚀 Админка:", reply_markup: { inline_keyboard: kb } });
    }
  } catch (err) { console.error(err); }
});

// --- API (ОБНОВЛЕНО) ---

// Логин работает БЕЗ КЛЮЧА (проверка по базе)
app.post('/api/login', async (req, res) => {
  const { login, password } = req.body;
  const user = await User.findOne({ login, password });
  res.json(user ? { status: "ok", user } : { status: "error" });
});

// Список прогулов для сайта (БЕЗ КЛЮЧА)
app.get('/api/absents', async (req, res) => {
  res.json(await Absent.find().sort({ date: -1 }));
});

// Добавление прогула (POST)
app.post('/api/absent', async (req, res) => {
  try {
    await new Absent(req.body).save();
    axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { chat_id: CHAT_ID, text: `📊 Hisobot: ${req.body.teacher}` }).catch(() => {});
    res.json({ status: "ok" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Редактирование и удаление (ПУСТЬ БУДУТ ОТКРЫТЫ ДЛЯ САЙТА)
app.put('/api/absent/:id', async (req, res) => { await Absent.findByIdAndUpdate(req.params.id, { $set: req.body }); res.json({ status: "ok" }); });
app.delete('/api/absent/:id', async (req, res) => { await Absent.findByIdAndDelete(req.params.id); res.json({ status: "ok" }); });

// 🛡️ ЗАЩИТА ТОЛЬКО ТУТ (ОЧИСТКА ВСЕЙ БАЗЫ)
app.delete('/api/absents', async (req, res) => {
  if (req.query.key !== ADMIN_QUERY_KEY) return res.status(403).json({ error: "No Key" });
  await Absent.deleteMany({});
  res.json({ status: "ok" });
});

// 🛡️ ЗАЩИТА ТУТ (ПОЛНЫЙ СПИСОК ЮЗЕРОВ ДЛЯ АДМИНА)
app.get('/api/users', async (req, res) => {
  if (req.query.key !== ADMIN_QUERY_KEY) return res.status(403).json({ error: "No Key" });
  res.json(await User.find());
});

module.exports = app;
