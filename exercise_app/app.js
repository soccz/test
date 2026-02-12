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

    // 1. RPE 평균 체크 (최근 14개 데이터 중)
    // plan.py: rpe_vals = recent["RPE"].dropna() (where recent is tail(14))
    //          if len(rpe_vals) >= 3 and rpe_vals.mean() >= 8
    const last14 = records.slice(-14);
    const rpeValues = last14.filter(r => r.RPE).map(r => r.RPE);

    if (rpeValues.length >= 3) {
        const avgRpe = rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length;
        if (avgRpe >= 8) reasons.push("최근 RPE 평균이 높아 과부하 가능성이 있습니다.");
    }

    // 2. 연속 운동일 체크 (3일 이상)
    // plan.py: 3일 연속 운동 시 경고
    const doneDates = [...new Set(records.filter(r => r.done === 'Y').map(r => r.date))].sort();
    let streak = 0;
    if (doneDates.length >= 3) {
        streak = 1;
        for (let i = doneDates.length - 1; i > 0; i--) {
            const curr = new Date(doneDates[i]);
            const prev = new Date(doneDates[i - 1]);
            const diff = (curr - prev) / (1000 * 60 * 60 * 24);

            if (diff === 1) streak++;
            else break;
        }
    }

    if (streak >= 3) reasons.push("3일 이상 연속 운동하여 회복이 필요할 수 있습니다.");

    // 3. 최근 수행 실패 (Condition C)
    // plan.py: 최근 5개 중 3개 이상 실패(N)
    const last5 = records.slice(-5);
    const failCount = last5.filter(r => r.done === 'N').length;
    if (last5.length >= 3 && failCount >= 3) {
        reasons.push("최근 수행률이 하락하여 회복이 필요할 수 있습니다.");
    }

    return { need: reasons.length > 0, reasons };
}

function getRecommendations() {
    const records = loadRecords();
    const routines = loadRoutines();
    const recs = [];

    // 기록 없으면 초기 추천
    if (records.length === 0 || records.filter(r => r.done === 'Y').length === 0) {
        return ["초기 추천: 스트레칭, 푸시업, 플랭크 (전신 균형 루틴)"];
    }

    const doneRecords = records.filter(r => r.done === 'Y');

    // 1. 상체/하체 균형 분석
    const counts = {};
    doneRecords.forEach(r => counts[r.exercise] = (counts[r.exercise] || 0) + 1);

    let lower = 0, upper = 0;
    for (const [ex, info] of Object.entries(routines)) {
        if (info.type === 'lower') lower += counts[ex] || 0;
        if (info.type === 'upper') upper += counts[ex] || 0;
    }

    if (upper < lower * 0.6) recs.push("상체 운동 비중이 낮습니다. 푸시업/풀업을 추가해보세요.");
    // plan.py에는 없지만 app.js 기존 로직 유지 (양방향 체크가 더 좋음)
    if (lower < upper * 0.6) recs.push("하체 운동 비중이 낮습니다. 스쿼트/런지를 추가해보세요.");

    // 2. 특정 운동 편식 (Variety)
    // plan.py: counts.max() > max(3, int(counts.mean() * 2))
    const usageValues = Object.values(counts);
    if (usageValues.length > 0) {
        const maxUsage = Math.max(...usageValues);
        const meanUsage = usageValues.reduce((a, b) => a + b, 0) / usageValues.length;
        if (maxUsage > Math.max(3, meanUsage * 2)) {
            const mostUsed = Object.keys(counts).find(key => counts[key] === maxUsage);
            const info = routines[mostUsed];
            recs.push(`${info.name} 비중이 너무 높습니다. 다른 ${getTypeKR(info.type)} 운동도 섞어주세요.`);
        }
    }

    // 3. RPE 피드백
    const recentRpes = records.filter(r => r.RPE).slice(-5).map(r => r.RPE);
    if (recentRpes.length > 0) {
        const avg = recentRpes.reduce((a, b) => a + b, 0) / recentRpes.length;
        if (avg >= 8) recs.push("최근 운동 강도가 높습니다. 오늘은 가벼운 유산소나 스트레칭 어떠세요?");
    }

    return recs;
}

function optimizeSchedule() {
    const records = loadRecords();
    const suggestions = [];

    if (records.length < 5) return ["데이터가 부족하여 스케줄 분석이 어렵습니다."];

    // 1. 요일별 수행률 (Weekday Performance)
    const dayStats = {}; // { 0(Mon): {total: 0, done: 0}, ... }
    records.forEach(r => {
        const day = new Date(r.date).getDay(); // 0:Sun, 1:Mon...
        // JS getDay는 Sun=0, plan.py는 Mon=0. 맞게 변환 필요 없지만 index로 관리
        if (!dayStats[day]) dayStats[day] = { total: 0, done: 0 };
        dayStats[day].total++;
        if (r.done === 'Y') dayStats[day].done++;
    });

    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    for (let d = 0; d < 7; d++) {
        const stat = dayStats[d];
        if (stat && stat.total >= 3) {
            const rate = stat.done / stat.total;
            if (rate < 0.5) {
                suggestions.push(`${dayNames[d]}요일 수행률(${Math.round(rate * 100)}%)이 낮습니다. 루틴 강도를 낮춰보세요.`);
            }
        }
    }

    // 2. 시간대 분석 (Best Hour)
    const hourStats = {};
    records.forEach(r => {
        if (r.done === 'Y' && r.hour !== undefined) {
            if (!hourStats[r.hour]) hourStats[r.hour] = 0;
            hourStats[r.hour]++;
        }
    });

    if (Object.keys(hourStats).length > 0) {
        const bestHour = Object.keys(hourStats).reduce((a, b) => hourStats[a] > hourStats[b] ? a : b);
        suggestions.push(`가장 효율적인 시간대는 ${bestHour}시 입니다. 스케줄에 참고하세요!`);
    }

    return suggestions;
}

function getWeeklyStats() {
    const records = loadRecords();
    const stats = [0, 0, 0, 0, 0, 0, 0];
    const today = new Date();
    // Monday based index: Mon=0 ... Sun=6
    const day = today.getDay();
    const diff = today.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(today.setDate(diff));
    monday.setHours(0, 0, 0, 0);

    records.forEach(r => {
        const d = new Date(r.date);
        if (d >= monday && r.done === 'Y') {
            // JS getDay: Sun=0, Mon=1...Sat=6
            // We want Mon=0...Sun=6
            let idx = d.getDay() - 1;
            if (idx === -1) idx = 6;
            stats[idx]++;
        }
    });
    return stats;
}

// ===== 월간 보고서 (데이터 고도화) =====
function getMonthlyStats(year, month) {
    const records = loadRecords();
    const routines = loadRoutines();

    // 해당 월의 기록만 필터
    const monthRecords = records.filter(r => {
        const d = new Date(r.date);
        return d.getFullYear() === year && d.getMonth() === month;
    });

    // 1. 기본 통계
    const doneRecords = monthRecords.filter(r => r.done === 'Y');
    const totalDays = new Set(doneRecords.map(r => r.date)).size;
    const totalExercises = doneRecords.length;

    const rpeRecords = monthRecords.filter(r => r.RPE != null);
    const avgRpe = rpeRecords.length > 0
        ? (rpeRecords.reduce((a, b) => a + b.RPE, 0) / rpeRecords.length).toFixed(1)
        : '-';

    const completionRate = monthRecords.length > 0
        ? Math.round(doneRecords.length / monthRecords.length * 100)
        : 0;

    // 2. 차트용 데이터

    // A. Heatmap Data (Weekday x Exercise)
    // { "스쿼트": [월,화,수,목,금,토,일 (count)], ... }
    const heatmapData = {};
    const exercisesList = Object.keys(routines);
    exercisesList.forEach(ex => {
        heatmapData[ex] = [0, 0, 0, 0, 0, 0, 0]; // Mon..Sun
    });

    doneRecords.forEach(r => {
        let d = new Date(r.date).getDay() - 1; // Mon=0
        if (d === -1) d = 6;

        if (heatmapData[r.exercise]) {
            heatmapData[r.exercise][d]++;
        } else {
            // 루틴에 없는 운동일 경우
            heatmapData[r.exercise] = [0, 0, 0, 0, 0, 0, 0];
            heatmapData[r.exercise][d]++;
        }
    });

    // B. Intensity & Adherence Trend (By Date)
    // 날짜별로 평균 RPE와 수행률 계산
    const trendData = { labels: [], rpe: [], adherence: [] };
    const dateGroups = {};

    // 월의 모든 날짜 생성
    const lastDay = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= lastDay; i++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        // 해당 날짜 기록 찾기
        const daysRecs = monthRecords.filter(r => r.date === dateStr);

        if (daysRecs.length > 0) {
            const dayRpe = daysRecs.filter(r => r.RPE).reduce((a, b) => a + b.RPE, 0) / (daysRecs.filter(r => r.RPE).length || 1);
            const dayAdh = daysRecs.filter(r => r.done === 'Y').length / daysRecs.length;

            trendData.labels.push(i + '일');
            trendData.rpe.push(dayRpe || null); // null for gap
            trendData.adherence.push(dayAdh * 100);
        }
    }

    // C. Volume Stack (Exercise Count Accumulated)
    const volumeData = {};
    doneRecords.forEach(r => {
        if (!volumeData[r.exercise]) volumeData[r.exercise] = 0;
        volumeData[r.exercise]++;
    });
    // 정렬
    const sortedVolume = Object.entries(volumeData).sort((a, b) => b[1] - a[1]);

    return {
        totalDays, totalExercises, avgRpe, completionRate,
        heatmapData, trendData, sortedVolume,
        routines
    };
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

let trendChart = null;
let volumeChart = null;

function renderReport() {
    const year = reportMonth.getFullYear();
    const month = reportMonth.getMonth();
    const stats = getMonthlyStats(year, month);
    const optimization = optimizeSchedule();

    document.getElementById('reportMonthLabel').textContent = `${year}년 ${month + 1}월`;

    // 1. 요약 카드
    document.getElementById('reportSummary').innerHTML = `
        <div class="summary-card"><div class="summary-value">${stats.totalDays}</div><div class="summary-label">운동 일수</div></div>
        <div class="summary-card"><div class="summary-value">${stats.totalExercises}</div><div class="summary-label">총 세트/회</div></div>
        <div class="summary-card"><div class="summary-value">${stats.avgRpe}</div><div class="summary-label">평균 강도</div></div>
        <div class="summary-card"><div class="summary-value">${stats.completionRate}%</div><div class="summary-label">수행률</div></div>
    `;

    // 2. 히트맵 렌더링
    renderHeatmap(stats.heatmapData, stats.routines);

    // 3. 추세 차트 (Trend)
    const ctxTrend = document.getElementById('trendChart').getContext('2d');
    if (trendChart) trendChart.destroy();

    trendChart = new Chart(ctxTrend, {
        type: 'line',
        data: {
            labels: stats.trendData.labels,
            datasets: [
                {
                    label: '평균 강도 (RPE)',
                    data: stats.trendData.rpe,
                    borderColor: '#ff7675',
                    backgroundColor: '#ff7675',
                    yAxisID: 'y',
                    tension: 0.4
                },
                {
                    label: '수행률 (%)',
                    data: stats.trendData.adherence,
                    borderColor: '#00b894',
                    backgroundColor: 'rgba(0, 184, 148, 0.1)',
                    fill: true,
                    yAxisID: 'y1',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                y: { type: 'linear', display: true, position: 'left', min: 0, max: 10, title: { display: true, text: 'RPE' } },
                y1: { type: 'linear', display: true, position: 'right', min: 0, max: 100, grid: { drawOnChartArea: false }, title: { display: true, text: '수행률%' } }
            }
        }
    });

    // 4. 볼륨 차트 (Volume)
    const ctxVol = document.getElementById('volumeChart').getContext('2d');
    if (volumeChart) volumeChart.destroy();

    const volLabels = stats.sortedVolume.map(([ex]) => stats.routines[ex]?.name || ex);
    const volData = stats.sortedVolume.map(([, count]) => count);

    volumeChart = new Chart(ctxVol, {
        type: 'bar',
        data: {
            labels: volLabels,
            datasets: [{
                label: '누적 횟수',
                data: volData,
                backgroundColor: '#6c5ce7',
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });

    // 5. 인사이트 (Optimization)
    const insightHtml = optimization.map(txt => `<div class="insight-item">${txt}</div>`).join('');
    document.getElementById('optimizationList').innerHTML = insightHtml || '<div class="insight-item">데이터가 더 쌓이면 분석해드릴게요!</div>';
}

function renderHeatmap(data, routines) {
    const container = document.getElementById('heatmapContainer');
    container.innerHTML = '';

    // Header (Mon...Sun)
    const days = ['월', '화', '수', '목', '금', '토', '일'];
    container.appendChild(document.createElement('div')); // Empty corner
    days.forEach(d => {
        const el = document.createElement('div');
        el.className = 'heatmap-day-header';
        el.textContent = d;
        container.appendChild(el);
    });

    // Body
    Object.entries(data).forEach(([ex, counts]) => {
        // Label
        const label = document.createElement('div');
        label.className = 'heatmap-label';
        label.textContent = routines[ex]?.name || ex;
        container.appendChild(label);

        // Cells
        counts.forEach(count => {
            const cell = document.createElement('div');
            cell.className = 'heatmap-cell';
            if (count > 0) cell.classList.add('level-1');
            if (count > 2) cell.className = 'heatmap-cell level-2';
            if (count > 4) cell.className = 'heatmap-cell level-3';
            if (count > 6) cell.className = 'heatmap-cell level-4';
            cell.title = `${count}회`;
            container.appendChild(cell);
        });
    });
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
    document.getElementById('btnReportCloseIcon').addEventListener('click', closeReportModal);
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
