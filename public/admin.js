
const API_URL = 'https://attendancesrv.vercel.app/api/absents';
const API_USERS = 'https://attendancesrv.vercel.app/api/users?key=22_secret_admin_key'; 

let absentsData = [];
let allTeachers = []; 
const reasonColors = ['#09ff00', '#ff0000', '#0d6efd', '#ffc107', '#6610f2', '#fd7e14', '#20c997'];

const translations = {
    ru: {
        admin_panel_title: "Админ-панель школы №22",
        choose_date: "Выберите дату:",
        export_excel: "Excel отчёт",
        clear_history: "Очистить историю",
        total_absent: "Всего отсутствующих",
        reason_stats: "Статистика причин",
        report_day: "За 1 день",
        report_week: "За неделю (6 дн.)",
        report_month: "За месяц (22 дн.)",
        xl_date: "Дата", xl_teacher: "Учитель", xl_class: "Класс", xl_total: "Всего учеников",
        xl_absent: "Отсутствует", xl_perc: "Процент %", xl_status: "Статус",
        xl_student: "Ученик", xl_reason: "Причина",
        hamma_darsda: "Все на уроках",
        err_no_data: "Недостаточно данных! Нужно {n} дн."
    },
    uz: {
        admin_panel_title: "22-maktab admin paneli",
        choose_date: "Sanani tanlang:",
        export_excel: "Excel yuklash",
        clear_history: "Tozalash",
        total_absent: "Jami yo'qlar",
        reason_stats: "Sabablar statistikasi",
        report_day: "1 kunlik",
        report_week: "Haftalik (6 kun)",
        report_month: "Oylik (22 kun)",
        xl_date: "Sana", xl_teacher: "O'qituvchi", xl_class: "Sinf", xl_total: "Jami o'quvchi",
        xl_absent: "Yo'qlar", xl_perc: "Foiz %", xl_status: "Holat",
        xl_student: "O'quvchi", xl_reason: "Sababi",
        hamma_darsda: "Hamma darsda",
        err_no_data: "Ma'lumot kam! {n} kun kerak."
    }
};

async function loadAbsents() {
    try {
        const [absRes, usersRes] = await Promise.all([fetch(API_URL), fetch(API_USERS)]);
        absentsData = await absRes.json();
        allTeachers = await usersRes.json();
        const select = document.getElementById('dateFilter');
        if (select && absentsData.length > 0) {
            const dates = [...new Set(absentsData.map(a => a.date))].sort().reverse();
            select.innerHTML = dates.map(d => `<option value="${d}">${d}</option>`).join('');
            select.onchange = renderDashboard;
        }
        renderDashboard();
    } catch (e) { console.error("Ошибка загрузки"); }
}

window.handleExcelExport = async function(type) {
    const lang = localStorage.getItem('lang') || 'ru';
    const t = translations[lang];
    const selectedDate = document.getElementById('dateFilter').value;
    if (!selectedDate) return;

    const uniqueDays = [...new Set(absentsData.map(a => a.date))].sort();
    let filtered = [];

    if (type === 'week' && uniqueDays.length < 6) return alert(t.err_no_data.replace('{n}', 6));
    if (type === 'month' && uniqueDays.length < 22) return alert(t.err_no_data.replace('{n}', 22));

    if (type === 'week') filtered = absentsData.filter(a => uniqueDays.slice(-6).includes(a.date));
    else if (type === 'month') filtered = absentsData.filter(a => a.date.startsWith(selectedDate.substring(0, 7)));
    else filtered = absentsData.filter(a => a.date === selectedDate);

    const wb = XLSX.utils.book_new();

    // 1. ЛИСТ СВОДКИ
    const summary = allTeachers.filter(u => u.role !== 'admin').map(u => {
        const matches = filtered.filter(a => a.className === u.className);
        const hasData = matches.length > 0;
        const total = hasData ? Number(matches[0].allstudents) : 0;
        const absCount = matches.filter(m => m.studentName !== translations.ru.hamma_darsda && m.studentName !== translations.uz.hamma_darsda).length;
        let perc = (hasData && total > 0) ? (((total - absCount) / total) * 100).toFixed(1) : 0;

        return {
            [t.xl_date]: selectedDate,
            [t.xl_teacher]: u.name,
            [t.xl_class]: u.className,
            [t.xl_total]: total || "-",
            [t.xl_absent]: hasData ? absCount : "-",
            [t.xl_perc]: hasData ? Number(perc) : 0,
            [t.xl_status]: hasData ? "✅" : "❌"
        };
    });
    summary.sort((a, b) => b[t.xl_perc] - a[t.xl_perc]);
    const wsSum = XLSX.utils.json_to_sheet(summary);
    wsSum['!cols'] = [{wch:12}, {wch:35}, {wch:10}, {wch:15}, {wch:12}, {wch:10}, {wch:10}];
    XLSX.utils.book_append_sheet(wb, wsSum, "Сводка");

    // 2. ОТДЕЛЬНЫЕ ЛИСТЫ ПО КЛАССАМ
    const classesWithData = [...new Set(filtered.map(a => a.className))].sort();
    classesWithData.forEach(cls => {
        const classAbsents = filtered.filter(a => a.className === cls && a.studentName !== translations.ru.hamma_darsda && a.studentName !== translations.uz.hamma_darsda);
        if (classAbsents.length > 0) {
            const classData = classAbsents.map(a => ({
                [t.xl_date]: a.date,
                [t.xl_teacher]: a.teacher,
                [t.xl_class]: a.className,
                [t.xl_student]: a.studentName,
                [t.xl_reason]: a.reason
            }));
            const wsClass = XLSX.utils.json_to_sheet(classData);
            wsClass['!cols'] = [{wch:12}, {wch:35}, {wch:10}, {wch:30}, {wch:25}];
            XLSX.utils.book_append_sheet(wb, wsClass, cls);
        }
    });

    XLSX.writeFile(wb, `Report_School22_${selectedDate}.xlsx`);
};

async function clearHistory() {
    const lang = localStorage.getItem('lang') || 'ru';
    if (!confirm(lang === 'ru' ? "Удалить всю историю?" : "Barcha ma'lumotlarni o'chirish?")) return;
    await fetch(API_URL, { method: 'DELETE' });
    location.reload();
}

function renderDashboard() {
    const val = document.getElementById('dateFilter').value;
    if (!val) return;
    const lang = localStorage.getItem('lang') || 'ru';
    const filtered = absentsData.filter(a => a.date === val);
    const realAbs = filtered.filter(a => a.studentName !== translations.ru.hamma_darsda && a.studentName !== translations.uz.hamma_darsda);
    
    document.getElementById('totalAbsent').textContent = realAbs.length;

    // ВОЗВРАЩАЕМ ГРАФИК (ЧАРТ)
    const ctx = document.getElementById('reasonChart');
    if (ctx) {
        const counts = {};
        realAbs.forEach(a => counts[a.reason] = (counts[a.reason] || 0) + 1);
        if (window.myChart) window.myChart.destroy();
        window.myChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(counts),
                datasets: [{ data: Object.values(counts), backgroundColor: reasonColors }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }

    const container = document.getElementById('classChartsContainer');
    if (container) {
        container.innerHTML = "";
        const map = {};
        filtered.forEach(a => { if(!map[a.className]) map[a.className] = []; map[a.className].push(a.studentName); });
        Object.keys(map).sort().forEach(cls => {
            const div = document.createElement('div');
            div.className = "col";
            const absOnly = map[cls].filter(n => n !== translations.ru.hamma_darsda && n !== translations.uz.hamma_darsda);
            div.innerHTML = `<div class="card stat-card h-100"><div class="card-body"><h5>${cls}</h5><p>Yo'q: ${absOnly.length}</p><small>${absOnly.length > 0 ? absOnly.join(', ') : translations[lang].hamma_darsda}</small></div></div>`;
            container.appendChild(div);
        });
    }
}

function applyTranslations(lang) {
    localStorage.setItem('lang', lang);
    const t = translations[lang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) el.textContent = t[key];
    });
    renderDashboard();
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Применяем язык
    applyTranslations(localStorage.getItem('lang') || 'ru');
    
    // 2. Загружаем данные
    loadAbsents();
    
    // 3. Привязываем переключатели языков
    document.getElementById('lang-ru').onclick = () => applyTranslations('ru');
    document.getElementById('lang-uz').onclick = () => applyTranslations('uz');
    
    // 4. ПРИВЯЗЫВАЕМ КНОПКУ ОЧИСТКИ (То, что ты просил)
    const clearBtn = document.getElementById('clearHistory');
    if (clearBtn) {
        clearBtn.onclick = clearHistory;
    }
});


