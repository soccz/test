// ===== 데이터 관리 =====
const STORAGE_KEYS = {
    ROUTINES: 'exercise_routines',
    RECORDS: 'exercise_records'
};

const DEFAULT_ROUTINES = {
    squat: { name: "스쿼트", days: ["Mon", "Wed", "Fri"], reps: 20, intensity: 3, type: "lower", unit: "회" },
    pushup: { name: "푸시업", days: ["Tue", "Thu"], reps: 15, intensity: 2, type: "upper", unit: "회" },
    plank: { name: "플랭크", days: ["Mon", "Thu"], reps: 60, intensity: 2, type: "core", unit: "초" },
    lunge: { name: "런지", days: ["Wed", "Sat"], reps: 12, intensity: 3, type: "lower", unit: "회" },
    stretch: { name: "스트레칭", days: ["Sun"], reps: 10, intensity: 1, type: "mobility", unit: "분" }
};

let selectedDate = new Date();
let selectedExercise = null;
let reportMonth = new Date();
let chart = null;
let monthlyChart = null;

function loadRoutines() {
    const saved = localStorage.getItem(STORAGE_KEYS.ROUTINES);
    if (saved) return JSON.parse(saved);
    localStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(DEFAULT_ROUTINES));
    return DEFAULT_ROUTINES;
}

function saveRoutines(routines) {
    localStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(routines));
}

function loadRecords() {
    const saved = localStorage.getItem(STORAGE_KEYS.RECORDS);
    return saved ? JSON.parse(saved) : [];
}

function saveRecord(record) {
    const records = loadRecords();
    const idx = records.findIndex(r => r.date === record.date && r.exercise === record.exercise);
    if (idx >= 0) records[idx] = record;
    else records.push(record);
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
}

// ===== 유틸 =====
function formatDateISO(date) { return date.toISOString().split('T')[0]; }
function getWeekday(date) { return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()]; }

function formatDateKR(date) {
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
}

function getTypeKR(type) {
    return { upper: '상체', lower: '하체', core: '코어', cardio: '유산소', mobility: '유연성' }[type] || type;
}

function getDayKR(day) {
    return { Mon: '월', Tue: '화', Wed: '수', Thu: '목', Fri: '금', Sat: '토', Sun: '일' }[day] || day;
}

function getTodayExercises(date) {
    const routines = loadRoutines();
    const weekday = getWeekday(date);
    const result = {};
    for (const [key, info] of Object.entries(routines)) {
        if (info.days && info.days.includes(weekday)) result[key] = info;
    }
    return result;
}

function getRecordsForDate(date) {
    return loadRecords().filter(r => r.date === formatDateISO(date));
}

// ===== 회복/추천 알고리즘 =====
function needRecovery() {
    const records = loadRecords();
    if (records.length === 0) return { need: false, reasons: [] };

    const reasons = [];

    // 1. RPE 평균 체크
    const rpeValues = records.slice(-14).filter(r => r.RPE).map(r => r.RPE);
    if (rpeValues.length >= 3) {
        const avgRpe = rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length;
        if (avgRpe >= 8) reasons.push("최근 RPE 평균이 높습니다. 휴식을 권장합니다.");
    }

    // 2. 연속 운동일 체크
    const doneDates = [...new Set(records.filter(r => r.done === 'Y').map(r => r.date))].sort();
    let streak = 1;
    for (let i = doneDates.length - 1; i > 0; i--) {
        const diff = (new Date(doneDates[i]) - new Date(doneDates[i - 1])) / (1000 * 60 * 60 * 24);
        if (diff === 1) streak++;
        else break;
    }
    if (streak >= 4) reasons.push(`${streak}일 연속 운동 중! 오늘은 가벼운 운동을 권장합니다.`);

    return { need: reasons.length > 0, reasons };
}

function getRecommendations() {
    const records = loadRecords();
    const routines = loadRoutines();
    const recs = [];

    // 기록 없으면 초보 메시지
    if (records.length === 0) {
        return ["🚀 시작이 반입니다! 오늘 운동을 시작해보세요."];
    }

    const doneRecords = records.filter(r => r.done === 'Y');

    // 1. 상체/하체 균형 분석
    const counts = {};
    doneRecords.forEach(r => counts[r.exercise] = (counts[r.exercise] || 0) + 1);

    let lower = 0, upper = 0, core = 0;
    for (const [ex, info] of Object.entries(routines)) {
        if (info.type === 'lower') lower += counts[ex] || 0;
        if (info.type === 'upper') upper += counts[ex] || 0;
        if (info.type === 'core') core += counts[ex] || 0;
    }

    if (upper < lower * 0.6 && lower > 3) {
        recs.push("💪 상체 운동 비중이 낮습니다. 푸시업을 추가해보세요!");
    }
    if (lower < upper * 0.6 && upper > 3) {
        recs.push("🦵 하체 운동 비중이 낮습니다. 스쿼트나 런지를 추가해보세요!");
    }
    if (core < 3 && records.length > 10) {
        recs.push("🎯 코어 운동을 더 해보세요. 플랭크가 좋습니다!");
    }

    // 2. RPE 기반 추천
    const recentRpe = records.slice(-5).filter(r => r.RPE).map(r => r.RPE);
    if (recentRpe.length > 0) {
        const avgRpe = recentRpe.reduce((a, b) => a + b, 0) / recentRpe.length;
        if (avgRpe >= 8) {
            recs.push("😓 최근 강도가 높았습니다. 스트레칭이나 가벼운 운동을 권장합니다.");
        } else if (avgRpe <= 4) {
            recs.push("⚡ 강도를 조금 높여보는 건 어떨까요?");
        }
    }

    // 3. 수행률 분석
    const last7 = records.slice(-7);
    const completionRate = last7.filter(r => r.done === 'Y').length / Math.max(last7.length, 1);
    if (completionRate >= 0.8 && last7.length >= 5) {
        recs.push("🔥 최근 수행률이 우수합니다! 이 페이스를 유지하세요!");
    } else if (completionRate < 0.5 && last7.length >= 5) {
        recs.push("📉 최근 수행률이 낮습니다. 루틴 강도를 조정해보세요.");
    }

    // 기본 메시지
    if (recs.length === 0) {
        recs.push("✅ 좋은 페이스를 유지하고 있어요. 꾸준함이 답입니다!");
    }

    return recs;
}

function getWeeklyStats() {
    const records = loadRecords();
    const stats = [0, 0, 0, 0, 0, 0, 0];
    const today = new Date();
    const mondayOffset = today.getDay() === 0 ? -6 : 1 - today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    records.forEach(r => {
        const d = new Date(r.date);
        if (d >= monday && r.done === 'Y') stats[(d.getDay() + 6) % 7]++;
    });
    return stats;
}

// ===== 월간 보고서 =====
function getMonthlyStats(year, month) {
    const records = loadRecords();
    const routines = loadRoutines();

    // 해당 월의 기록만 필터
    const monthRecords = records.filter(r => {
        const d = new Date(r.date);
        return d.getFullYear() === year && d.getMonth() === month;
    });

    // 통계 계산
    const totalDays = new Set(monthRecords.filter(r => r.done === 'Y').map(r => r.date)).size;
    const totalExercises = monthRecords.filter(r => r.done === 'Y').length;
    const avgRpe = monthRecords.filter(r => r.RPE).length > 0
        ? (monthRecords.filter(r => r.RPE).reduce((a, b) => a + b.RPE, 0) / monthRecords.filter(r => r.RPE).length).toFixed(1)
        : '-';
    const completionRate = monthRecords.length > 0
        ? Math.round(monthRecords.filter(r => r.done === 'Y').length / monthRecords.length * 100)
        : 0;

    // 운동별 통계
    const exerciseStats = {};
    monthRecords.filter(r => r.done === 'Y').forEach(r => {
        if (!exerciseStats[r.exercise]) exerciseStats[r.exercise] = 0;
        exerciseStats[r.exercise]++;
    });

    // 주별 통계 (차트용)
    const weeklyData = [0, 0, 0, 0, 0];
    monthRecords.filter(r => r.done === 'Y').forEach(r => {
        const day = new Date(r.date).getDate();
        const week = Math.min(Math.floor((day - 1) / 7), 4);
        weeklyData[week]++;
    });

    return { totalDays, totalExercises, avgRpe, completionRate, exerciseStats, weeklyData, routines };
}

// ===== UI 렌더링 =====
function renderDate() {
    document.getElementById('dateInput').value = formatDateISO(selectedDate);
    document.getElementById('todayDate').textContent = formatDateKR(selectedDate);
}

function renderRecovery() {
    const { need, reasons } = needRecovery();
    const banner = document.getElementById('recoveryBanner');
    if (need) {
        banner.style.display = 'flex';
        document.getElementById('recoveryText').textContent = reasons[0];
    } else {
        banner.style.display = 'none';
    }
}

function renderProgress() {
    const exercises = getTodayExercises(selectedDate);
    const dateRecords = getRecordsForDate(selectedDate);
    const total = Object.keys(exercises).length;
    const done = dateRecords.filter(r => r.done === 'Y' && exercises[r.exercise]).length;

    document.getElementById('progressText').textContent = `${done}/${total} 완료`;
    document.getElementById('progressFill').style.width = total > 0 ? `${(done / total) * 100}%` : '0%';
}

function renderExercises() {
    const exercises = getTodayExercises(selectedDate);
    const dateRecords = getRecordsForDate(selectedDate);
    const list = document.getElementById('todayExerciseList');
    const empty = document.getElementById('emptyState');

    if (Object.keys(exercises).length === 0) {
        list.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    list.innerHTML = '';

    for (const [key, info] of Object.entries(exercises)) {
        const record = dateRecords.find(r => r.exercise === key);
        const isDone = record?.done === 'Y';

        const card = document.createElement('div');
        card.className = `exercise-card${isDone ? ' done' : ''}`;

        let dots = '';
        for (let i = 1; i <= 3; i++) dots += `<div class="intensity-dot${i <= info.intensity ? ' active' : ''}"></div>`;

        card.innerHTML = `
            <div class="exercise-checkbox">${isDone ? '✓' : ''}</div>
            <div class="exercise-info">
                <div class="exercise-name">${info.name}</div>
                <div class="exercise-detail">${info.reps}${info.unit}</div>
            </div>
            <div class="exercise-meta">
                <span class="type-badge ${info.type}">${getTypeKR(info.type)}</span>
                <div class="intensity-dots">${dots}</div>
            </div>
        `;

        card.addEventListener('click', () => openRecordModal(key, info));
        list.appendChild(card);
    }
}

function renderRecommendations() {
    const recs = getRecommendations();
    document.getElementById('recommendList').innerHTML = recs.map(r => `<div class="recommend-item">${r}</div>`).join('');
}

function renderManageList() {
    const routines = loadRoutines();
    const list = document.getElementById('manageList');
    const allDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    list.innerHTML = '';

    for (const [key, info] of Object.entries(routines)) {
        const item = document.createElement('div');
        item.className = 'manage-item';
        item.dataset.key = key;

        const dayBtns = allDays.map(day => {
            const checked = info.days?.includes(day) ? 'checked' : '';
            return `<label class="day-btn"><input type="checkbox" value="${day}" ${checked}><span>${getDayKR(day)}</span></label>`;
        }).join('');

        item.innerHTML = `
            <div class="manage-header">
                <span class="type-badge ${info.type}">${getTypeKR(info.type)}</span>
                <div class="exercise-info">
                    <div class="exercise-name">${info.name}</div>
                    <div class="exercise-detail">${info.reps}${info.unit} · 강도 ${info.intensity}</div>
                </div>
                <button class="btn-delete" data-key="${key}">×</button>
            </div>
            <div class="manage-days">${dayBtns}</div>
        `;
        list.appendChild(item);
    }

    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            if (confirm('삭제하시겠습니까?')) {
                const r = loadRoutines();
                delete r[btn.dataset.key];
                saveRoutines(r);
                renderManageList();
            }
        });
    });

    document.querySelectorAll('.manage-item').forEach(item => {
        item.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                const r = loadRoutines();
                const days = [...item.querySelectorAll('input:checked')].map(c => c.value);
                r[item.dataset.key].days = days;
                saveRoutines(r);
            });
        });
    });
}

function renderChart() {
    const stats = getWeeklyStats();
    const ctx = document.getElementById('weeklyChart').getContext('2d');
    if (chart) chart.destroy();

    chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['월', '화', '수', '목', '금', '토', '일'],
            datasets: [{ data: stats, backgroundColor: '#6B8E7B', borderRadius: 6 }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

function renderReport() {
    const year = reportMonth.getFullYear();
    const month = reportMonth.getMonth();
    const stats = getMonthlyStats(year, month);

    document.getElementById('reportMonthLabel').textContent = `${year}년 ${month + 1}월`;

    // 요약 카드
    document.getElementById('reportSummary').innerHTML = `
        <div class="summary-card"><div class="summary-value">${stats.totalDays}</div><div class="summary-label">운동한 날</div></div>
        <div class="summary-card"><div class="summary-value">${stats.totalExercises}</div><div class="summary-label">총 운동 횟수</div></div>
        <div class="summary-card"><div class="summary-value">${stats.avgRpe}</div><div class="summary-label">평균 RPE</div></div>
        <div class="summary-card"><div class="summary-value">${stats.completionRate}%</div><div class="summary-label">수행률</div></div>
    `;

    // 차트
    const ctx = document.getElementById('monthlyChart').getContext('2d');
    if (monthlyChart) monthlyChart.destroy();

    monthlyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['1주', '2주', '3주', '4주', '5주'],
            datasets: [{ data: stats.weeklyData, backgroundColor: '#6B8E7B', borderRadius: 6 }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });

    // 운동별 상세
    const details = Object.entries(stats.exerciseStats)
        .sort((a, b) => b[1] - a[1])
        .map(([ex, count]) => {
            const name = stats.routines[ex]?.name || ex;
            return `<div class="report-row"><span class="report-exercise">${name}</span><span class="report-count">${count}회</span></div>`;
        }).join('');

    document.getElementById('reportDetails').innerHTML = details || '<p style="text-align:center;color:#636E72;padding:20px;">기록이 없습니다</p>';
}

// ===== 모달 =====
function openRecordModal(key, info) {
    selectedExercise = key;
    document.getElementById('modalTitle').textContent = info.name;
    document.getElementById('modalExerciseInfo').textContent = `${info.reps}${info.unit} · ${getTypeKR(info.type)}`;
    document.getElementById('recordModal').classList.add('show');

    const record = getRecordsForDate(selectedDate).find(r => r.exercise === key);
    setDoneState(record ? record.done === 'Y' : true);
    document.getElementById('rpeSlider').value = record?.RPE || 5;
    document.getElementById('rpeValue').textContent = record?.RPE || 5;
}

function closeRecordModal() {
    document.getElementById('recordModal').classList.remove('show');
    selectedExercise = null;
}

function setDoneState(done) {
    document.getElementById('btnDone').classList.toggle('active', done);
    document.getElementById('btnNotDone').classList.toggle('active', !done);
}

function saveCurrentRecord() {
    if (!selectedExercise) return;
    const info = loadRoutines()[selectedExercise];
    saveRecord({
        date: formatDateISO(selectedDate),
        exercise: selectedExercise,
        target: info.reps,
        unit: info.unit,
        intensity: info.intensity,
        done: document.getElementById('btnDone').classList.contains('active') ? 'Y' : 'N',
        RPE: parseInt(document.getElementById('rpeSlider').value),
        hour: new Date().getHours()
    });
    closeRecordModal();
    renderAll();
}

function openManageModal() {
    renderManageList();
    document.getElementById('manageModal').classList.add('show');
}

function closeManageModal() {
    document.getElementById('manageModal').classList.remove('show');
    renderAll();
}

function openReportModal() {
    reportMonth = new Date();
    renderReport();
    document.getElementById('reportModal').classList.add('show');
}

function closeReportModal() {
    document.getElementById('reportModal').classList.remove('show');
}

function openAddModal() {
    document.getElementById('addModal').classList.add('show');
    document.getElementById('newExName').value = '';
    document.getElementById('newExReps').value = '15';
    document.querySelectorAll('#newDaySelector input').forEach(cb => cb.checked = false);
}

function closeAddModal() {
    document.getElementById('addModal').classList.remove('show');
}

function saveNewExercise() {
    const name = document.getElementById('newExName').value.trim();
    if (!name) { alert('운동 이름을 입력하세요'); return; }

    const days = [...document.querySelectorAll('#newDaySelector input:checked')].map(c => c.value);
    if (days.length === 0) { alert('요일을 선택하세요'); return; }

    const r = loadRoutines();
    r[name.toLowerCase().replace(/\s/g, '_') + '_' + Date.now()] = {
        name,
        days,
        reps: parseInt(document.getElementById('newExReps').value) || 15,
        unit: document.getElementById('newExUnit').value,
        type: document.getElementById('newExType').value,
        intensity: parseInt(document.getElementById('newExIntensity').value)
    };
    saveRoutines(r);
    closeAddModal();
    renderManageList();
}

// ===== 이벤트 =====
function initEvents() {
    document.getElementById('dateInput').addEventListener('change', e => {
        selectedDate = new Date(e.target.value + 'T00:00:00');
        renderAll();
    });
    document.getElementById('prevDate').addEventListener('click', () => { selectedDate.setDate(selectedDate.getDate() - 1); renderAll(); });
    document.getElementById('nextDate').addEventListener('click', () => { selectedDate.setDate(selectedDate.getDate() + 1); renderAll(); });

    document.getElementById('btnDone').addEventListener('click', () => setDoneState(true));
    document.getElementById('btnNotDone').addEventListener('click', () => setDoneState(false));
    document.getElementById('btnCancel').addEventListener('click', closeRecordModal);
    document.getElementById('btnSave').addEventListener('click', saveCurrentRecord);
    document.getElementById('rpeSlider').addEventListener('input', e => document.getElementById('rpeValue').textContent = e.target.value);
    document.getElementById('recordModal').addEventListener('click', e => { if (e.target.id === 'recordModal') closeRecordModal(); });

    document.getElementById('btnManage').addEventListener('click', openManageModal);
    document.getElementById('btnManageClose').addEventListener('click', closeManageModal);
    document.getElementById('manageModal').addEventListener('click', e => { if (e.target.id === 'manageModal') closeManageModal(); });

    document.getElementById('btnReport').addEventListener('click', openReportModal);
    document.getElementById('btnReportClose').addEventListener('click', closeReportModal);
    document.getElementById('prevMonth').addEventListener('click', () => { reportMonth.setMonth(reportMonth.getMonth() - 1); renderReport(); });
    document.getElementById('nextMonth').addEventListener('click', () => { reportMonth.setMonth(reportMonth.getMonth() + 1); renderReport(); });
    document.getElementById('reportModal').addEventListener('click', e => { if (e.target.id === 'reportModal') closeReportModal(); });

    document.getElementById('btnAddExercise').addEventListener('click', openAddModal);
    document.getElementById('btnAddCancel').addEventListener('click', closeAddModal);
    document.getElementById('btnAddSave').addEventListener('click', saveNewExercise);
    document.getElementById('newExIntensity').addEventListener('input', e => document.getElementById('newExIntensityValue').textContent = e.target.value);
    document.getElementById('addModal').addEventListener('click', e => { if (e.target.id === 'addModal') closeAddModal(); });
}

function renderAll() {
    renderDate();
    renderRecovery();
    renderProgress();
    renderExercises();
    renderRecommendations();
    renderChart();
}

document.addEventListener('DOMContentLoaded', () => { initEvents(); renderAll(); });
