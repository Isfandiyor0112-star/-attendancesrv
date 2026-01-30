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

const { BOT_TOKEN, CHAT_ID, MONGO_URI, ADMIN_QUERY_KEY } = process.env;

// Подключение к БД
if (MONGO_URI) {
    mongoose.connect(MONGO_URI).catch(err => console.error('❌ DB Error:', err));
}

// --- МОДЕЛИ ---
const User = mongoose.model('User', new mongoose.Schema({
  login: String, password: { type: String }, name: String, className: String, role: { type: String, default: "teacher" }
}));

const News = mongoose.model('News', new mongoose.Schema({
  text: String, date: { type: Date, default: Date.now }
}));

const Absent = mongoose.model('Absent', new mongoose.Schema({
  teacher: String, className: String, date: String, count: String, studentName: String, reason: String, allstudents: String
}), 'absents_fixed');

// --- ТЕЛЕГРАМ БОТ ---
app.post('/api/bot', async (req, res) => {
  try {
    const { message, callback_query } = req.body;
    const fromId = message ? message.from.id : (callback_query ? callback_query.from.id : null);
    if (!fromId) return res.sendStatus(200);

    const chatId = message ? message.chat.id : callback_query.message.chat.id;
    const userId = fromId.toString();

    const allowedUsers = CHAT_ID ? CHAT_ID.split(',') : [];
    if (!allowedUsers.includes(userId)) return res.sendStatus(200);

    // --- 1. ОБРАБОТКА CALLBACK (Кнопки) ---
    if (callback_query) {
      const [action, targetId] = callback_query.data.split(':');

      if (action === 'manage') {
        const user = await User.findById(targetId);
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: `👤 **${user.name}**\n📍 Класс: ${user.className}`,
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

      // ЛОГИКА УДАЛЕНИЯ НОВОСТИ
      if (action === 'delete_news_confirm') {
        await News.deleteOne({ _id: targetId });
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { chat_id: chatId, text: "✅ Последняя новость удалена с сайта." });
      }

      if (action === 'back_to_list') {
        const teachers = await User.find();
        const kb = teachers.map((t) => ([{ text: t.name, callback_data: `manage:${t._id}` }]));
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { chat_id: chatId, text: "👨‍🏫 Список:", reply_markup: { inline_keyboard: kb } });
      }

      if (action === 'confirm_del') {
        await User.findByIdAndDelete(targetId);
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { chat_id: chatId, text: "✅ Учитель удален." });
      }
      return res.sendStatus(200);
    }

    // --- 2. ОБРАБОТКА ТЕКСТА ---
    const text = message.text;
    if (!text) return res.sendStatus(200);

    if (text === "/start" || text === "O'qituvchilar ro'yxati") {
      delete userStates[chatId];
      const teachers = await User.find();
      const kb = teachers.map((t) => ([{ text: `${t.name} (${t.className})`, callback_data: `manage:${t._id}` }]));
      kb.push([{ text: "➕ Добавить учителя", callback_data: "start_add" }]);

      return await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text: "👨‍🏫 **Управление:**",
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: kb,
          keyboard: [
            [{ text: "O'qituvchilar ro'yxati" }],
            [{ text: "📢 Добавить новость" }, { text: "🗑 Удалить новость" }]
          ],
          resize_keyboard: true
        }
      });
    }

    // Кнопка удаления новости
    if (text === "🗑 Удалить новость") {
      const lastNews = await News.findOne().sort({ date: -1 });
      if (!lastNews) {
        return await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { chat_id: chatId, text: "❌ Новостей пока нет." });
      }
      return await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text: `**Текущая новость:**\n"${lastNews.text}"\n\nУдалить её?`,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[{ text: "✅ Да, удалить", callback_data: `delete_news_confirm:${lastNews._id}` }]]
        }
      });
    }

    if (text === "📢 Добавить новость") {
      userStates[chatId] = { action: 'adding_news' };
      return await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { chat_id: chatId, text: "📝 Введите текст новости:" });
    }

    // Обработка состояний ввода
    if (userStates[chatId]) {
      const s = userStates[chatId];
      if (s.action === 'adding_news') {
        await new News({ text }).save();
        delete userStates[chatId];
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { chat_id: chatId, text: "✅ Новость опубликована!" });
      } else if (s.action === 'adding_user') {
        const [l, p, n, c] = text.split(' ');
        if (c) await new User({ login: l, password: p, name: n, className: c }).save();
        delete userStates[chatId];
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { chat_id: chatId, text: "✅ Учитель добавлен!" });
      }
      return res.sendStatus(200);
    }

    res.sendStatus(200);
  } catch (e) { res.sendStatus(200); }
});

// --- API ЭНДПОИНТЫ ---
app.get('/api/latest-news', async (req, res) => {
  const latest = await News.findOne().sort({ date: -1 });
  res.json(latest || { text: "" });
});

app.post('/api/absent', async (req, res) => {
  try {
    await new Absent(req.body).save();
    res.json({ status: "ok" });
  } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/absents', async (req, res) => {
  const data = await Absent.find().sort({ date: -1 });
  res.json(data);
});

app.put('/api/absent/:id', async (req, res) => {
  const updated = await Absent.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
  res.json({ status: "ok", data: updated });
});

app.delete('/api/absent/:id', async (req, res) => {
  await Absent.findByIdAndDelete(req.params.id);
  res.json({ status: "ok" });
});

app.delete('/api/absents', async (req, res) => {
  await Absent.deleteMany({});
  res.json({ status: "ok" });
});

app.get('/api/users', async (req, res) => {
  if (req.query.key !== ADMIN_QUERY_KEY) return res.status(403).json({ error: "Access Denied" });
  const users = await User.find();
  res.json(users);
});

module.exports = app;
