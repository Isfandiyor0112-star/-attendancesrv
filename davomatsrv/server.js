const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// Простая "база" пользователей (логин и пароль)
const users = [
  { login: "b", password: "1", name: "Иванов И.И.", className: "1А" },
  { login: "p", password: "2", name: "Петрова А.А.", className: "2Б" },
  { login: "i", password: "i", name: "Имамалиев Исфандиёр", className: "3А" },
  { login: "admin", password: "admin", name: "Админ" }
];

app.use(cors());
app.use(express.json());

let absents = []; // временно в памяти

// Очистить всех отсутствующих
app.delete('/api/absents', (req, res) => {
  absents = [];
  res.json({ status: "ok" });
});

// Добавить отсутствующего
app.post('/api/absent', (req, res) => {
  absents.push(req.body);
  res.json({ status: "ok" });
});

// Получить всех отсутствующих
app.get('/api/absents', (req, res) => {
  res.json(absents);
});

// Проверка логина и пароля
app.post('/api/login', (req, res) => {
  const { login, password } = req.body;
  const user = users.find(u => u.login === login && u.password === password);
  if (user) {
    // Не отправляем пароль обратно!
    const { password, ...userData } = user;
    res.json({ status: "ok", user: userData });
  } else {
    res.json({ status: "error", message: "Неверный логин или пароль" });
  }
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);

});

