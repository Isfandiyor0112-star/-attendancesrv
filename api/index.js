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
  { login: "22maktab", password: "anjilika", name: "Cherimitsina.A.K.", className: "1B" },
  { login: "22maktab", password: "dilfuza", name: "Ermakova.D.Y.", className: "1V" },
  { login: "22maktab", password: "nurjaxon", name: "Nurmatova.N.R.", className: "1G" },
  { login: "22maktab", password: "gulnara", name: "Musamatova.G.M.", className: "2A" },
  { login: "22maktab", password: "yulduz", name: "Toshmatova.Y.Z.", className: "2B" },
  { login: "22maktab", password: "umida", name: "Movlonova.U.U.", className: "2V" },
  { login: "22maktab", password: "matluba", name: "Ubaydullayeva.M.M.", className: "2G" },
  { login: "22maktab", password: "nasiba", name: "Ismoilova.N.E.", className: "2D" },
  { login: "22maktab", password: "lyubov", name: "Izalxan.L.I.", className: "3A" },
  { login: "22maktab", password: "nargiza", name: "Matkarimova.N.B.", className: "3B" },
  { login: "22maktab", password: "nilufar", name: "Qarshibayeva.N.A.", className: "3V" },
  { login: "22maktab", password: "fotima", name: "Djamalova.F.A.", className: "3D" },
  { login: "22maktab", password: "kimmat", name: "Kambarova.K.M.", className: "4A" },
  { login: "22maktab", password: "vera", name: "Polyakova.V.A.", className: "4B" },
  { login: "22maktab", password: "dilfuza", name: "Normuratova.D.X.", className: "4V" },
  { login: "22maktab", password: "sevara", name: "Madaminova.S.Y.", className: "4G" },
  { login: "22maktab", password: "dilafruz", name: "Sheranova.D.T.", className: "4D" },
  { login: "22maktab", password: "gulnara", name: "Zokirxonova.G.B.", className: "5A" },
  { login: "22maktab", password: "xilola", name: "Abdumavlonova.X.M.", className: "5B" },
  { login: "22maktab", password: "xilola", name: "Ermatova.X.A.", className: "5V" },
  { login: "22maktab", password: "orzigul", name: "Mamatqulova.O.S.", className: "5G" },
  { login: "22maktab", password: "rustam", name: "Raximov.R.R.", className: "6A" },
  { login: "22maktab", password: "avazjon", name: "Ismoilov.A.K.", className: "6B" },
  { login: "22maktab", password: "dilafruz", name: "Yettiyeva.D.M.", className: "6V" },
  { login: "22maktab", password: "barno", name: "Malikova.B.A.", className: "6G" },
  { login: "22maktab", password: "gozal", name: "Normatova.G.D.", className: "6D" },
  { login: "22maktab", password: "natasha", name: "Nefyodova.N.A.", className: "7A" },
  { login: "22maktab", password: "dilfuza", name: "Xakimova.D.A.", className: "7B" },
  { login: "22maktab", password: "inomjon", name: "Fozilov.I.O.", className: "7V" },
  { login: "22maktab", password: "viktoriya", name: "Buligina.V.Y.", className: "8A" },
  { login: "22maktab", password: "matluba", name: "Yardamova.M.M.", className: "8B" },
  { login: "22maktab", password: "orif", name: "Mandiyev.O.A.", className: "8V" },
  { login: "22maktab", password: "nigora", name: "Pardayeva.N.M.", className: "9A" },
  { login: "22maktab", password: "alisher", name: "Aripov.A.I.", className: "9B" },
  { login: "22maktab", password: "muslima", name: "Mamajanova.M.A.", className: "9V" },
  { login: "22maktab", password: "asom", name: "Xodjahanov.A.O.", className: "9G" },
  { login: "22maktab", password: "mehriniso", name: "Ismoilova.M.A.", className: "9D" },
  { login: "22maktab", password: "olesya", name: "Xasanova.O.G.", className: "10A" },
  { login: "22maktab", password: "dilafruz", name: "Satimova.D.F.", className: "10B" },
  { login: "22maktab", password: "shahodat", name: "Ruzmatova.S.M.", className: "10V" },
  { login: "22maktab", password: "marguba", name: "Baltabayeva.M.T.", className: "11A" },
  { login: "22maktab", password: "svetlana", name: "Ryabinina.S.Y.", className: "11B" },
  { login: "22maktab", password: "maftuna", name: "Abdullayeva.M.R.", className: "11V" },
  { login: "22maktab", password: "nilufar", name: "Aliyeva.N.M.", className: "11G" },
  { login: "shaxnoza", password: "22_admin", name: "Ruzimatova.Sh.R" },
  { login: "furkat", password: "diamondkey", name: "Abduraxmonov.F.N" },
  { login: "matlyuba", password: "ironkey", name: "Abdunamatova.M"},
  { login: "admin", password: "goldenkey", name: "Bayjanova.Sh"}

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

