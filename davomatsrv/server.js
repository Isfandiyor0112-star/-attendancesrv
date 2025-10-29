const express = require('express');
const cors = require('cors');
const fs = require('fs');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// --- Telegram настройки ---
const BOT_TOKEN = '8435086507:AAHo3--P4pW_pLkLxoVcCOc-Jn7GApWQGd0';
const CHAT_ID = '6881699459';

async function sendToTelegram(message) {
  try {
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text: message
    });
  } catch (error) {
    console.error('Ошибка Telegram:', error.message);
  }
}

// --- Пользователи ---
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
  { login: "matlyuba", password: "ironkey", name: "Abdunamatova.M" },
  { login: "admin", password: "goldenkey", name: "Bayjanova.Sh" }
];

app.use(cors());
app.use(express.json());

// --- Работа с файлом absents.json ---
const ABSENTS_FILE = 'absents.json';

function loadAbsents() {
  try {
    if (!fs.existsSync(ABSENTS_FILE)) {
      fs.writeFileSync(ABSENTS_FILE, '[]');
      return [];
    }
    return JSON.parse(fs.readFileSync(ABSENTS_FILE, 'utf8'));
  } catch (err) {
        return [];
  }
}

function saveAbsents(data) {
  try {
    fs.writeFileSync(ABSENTS_FILE, JSON.stringify(data, null, 2));
    
  } catch (err) {
    console.error("Ошибка при сохранении absents.json:", err);
  }
}

let absents = loadAbsents();

// --- API ---
app.get('/api/absents', (req, res) => {
  absents = loadAbsents();
  res.json(absents);
});

app.post('/api/absent', (req, res) => {
  console.log('[RECEIVED] Новый absent:', req.body);
  absents.push(req.body);
  saveAbsents(absents);

  // Telegram-уведомление о пришедших
  const { date, teacher, className, allstudents, count } = req.body;
  const total = parseFloat(allstudents);
  const sick = parseFloat(count);
  const present = total - sick;
  const percent = total ? ((present / total) * 100).toFixed(1) : '0';
  const msg = `📊 ${teacher} отметил класс ${className} (${date}):\nПришли: ${present} из ${total} (${percent}%)`;
  sendToTelegram(msg);

  res.json({ status: "ok" });
});

app.delete('/api/absents', (req, res) => {
  absents = [];
  saveAbsents(absents);
  res.json({ status: "ok" });
});

app.post('/api/login', (req, res) => {
  const { login, password } = req.body;
  const user = users.find(u => u.login === login && u.password === password);
  if (user) {
    const { password, ...userData } = user;
    res.json({ status: "ok", user: userData });
  } else {
    res.json({ status: "error", message: "Неверный логин или пароль" });
  }
});

app.get('/api/ping', (req, res) => {
  res.status(200).send('TheServerDoesntSleep');
});

app.get('/api/ping-tg', async (req, res) => {
  try {
    const now = new Date();
    now.setHours(now.getHours() + 5);
    const msg = `[SERVER INFO] Пинг: ${now.toLocaleString('ru-RU', { hour12: false })} — сервер не спит`;
    await sendToTelegram(msg);
    console.log('Крон работает');
    res.status(200).send('pong + tg');
  } catch (error) {
    const errMsg = `[ERROR] ${new Date().toLocaleString()} — ${error.message}`;
    await sendToTelegram(errMsg);
    console.error('Ошибка в /api/ping-tg:', error);
    res.status(500).send('api/ping-tg или api/ping упал');
  }
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
   });


