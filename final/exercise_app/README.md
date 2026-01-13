# 💪 Exercise Manager

개인 맞춤형 운동 기록 및 루틴 추천 서비스입니다. **브라우저만 있으면 동작**하며, 모든 데이터는 **localStorage**에 저장됩니다.

---

## 📁 프로젝트 구조

```
exercise_app/
├── index.html    # 메인 HTML (UI 구조)
├── style.css     # 스타일시트 (디자인)
├── app.js        # 핵심 로직 (이 문서에서 설명)
└── README.md     # 이 문서
```

---

## 🚀 사용 방법

### 실행
1. `index.html` 파일을 브라우저에서 열기
2. 또는 Live Server 등으로 로컬 서버 실행

### 주요 기능
- 📅 **날짜별 운동 체크**: 오늘 해야 할 운동 목록 표시 및 완료 체크
- 📊 **주간/월간 리포트**: 운동 통계 및 차트
- 🤖 **AI 추천**: 운동 패턴 분석 기반 맞춤 추천
- ⚠️ **회복 알림**: 과도한 운동 시 휴식 권장
- ➕ **커스텀 루틴**: 새 운동 추가 및 요일 설정

---

## 🗄️ 데이터 저장 구조

모든 데이터는 **localStorage**에 JSON 형태로 저장됩니다.

### 1. 루틴 데이터 (`exercise_routines`)
```javascript
{
    "squat": {
        "name": "스쿼트",
        "days": ["Mon", "Wed", "Fri"],  // 수행 요일
        "reps": 20,                      // 목표 횟수
        "intensity": 3,                  // 강도 (1~3)
        "type": "lower",                 // 부위 (upper, lower, core, cardio, mobility)
        "unit": "회"                     // 단위 (회, 초, 분)
    },
    "pushup": { ... },
    ...
}
```

### 2. 운동 기록 (`exercise_records`)
```javascript
[
    {
        "date": "2026-01-13",     // 날짜
        "exercise": "squat",       // 운동 ID
        "target": 20,              // 목표
        "unit": "회",
        "intensity": 3,
        "done": "Y",               // 완료 여부 (Y/N)
        "RPE": 7,                  // 체감 난이도 (1~10)
        "hour": 19                 // 수행 시간대
    },
    ...
]
```

---

## 🧠 핵심 알고리즘 상세 설명

### 1. 오늘의 운동 목록 생성 (`getTodayExercises`)

```javascript
function getTodayExercises(date) {
    const routines = loadRoutines();
    const weekday = getWeekday(date);  // "Mon", "Tue", ...
    const result = {};
    
    for (const [key, info] of Object.entries(routines)) {
        // 오늘 요일이 운동 요일 목록에 포함되어 있는지 확인
        if (info.days && info.days.includes(weekday)) {
            result[key] = info;
        }
    }
    return result;
}
```

**동작 원리**:
1. 모든 루틴을 순회
2. 각 루틴의 `days` 배열에 오늘 요일이 포함되어 있는지 확인
3. 포함된 운동만 반환

---

### 2. 회복 필요성 판단 (`needRecovery`)

과도한 운동을 감지하여 휴식을 권장하는 알고리즘입니다.

```javascript
function needRecovery() {
    const records = loadRecords();
    const reasons = [];

    // 조건 1: 최근 14일 평균 RPE가 8 이상
    const rpeValues = records.slice(-14).filter(r => r.RPE).map(r => r.RPE);
    if (rpeValues.length >= 3) {
        const avgRpe = rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length;
        if (avgRpe >= 8) {
            reasons.push("최근 RPE 평균이 높습니다. 휴식을 권장합니다.");
        }
    }

    // 조건 2: 4일 이상 연속 운동
    const doneDates = [...new Set(records.filter(r => r.done === 'Y').map(r => r.date))].sort();
    let streak = 1;
    for (let i = doneDates.length - 1; i > 0; i--) {
        const diff = (new Date(doneDates[i]) - new Date(doneDates[i - 1])) / (1000 * 60 * 60 * 24);
        if (diff === 1) streak++;
        else break;
    }
    if (streak >= 4) {
        reasons.push(`${streak}일 연속 운동 중! 오늘은 가벼운 운동을 권장합니다.`);
    }

    return { need: reasons.length > 0, reasons };
}
```

**회복 알림 조건**:
| 조건 | 트리거 기준 | 의미 |
|------|-----------|------|
| 높은 RPE | 최근 14일 평균 RPE ≥ 8 | 강도가 너무 높음 |
| 연속 운동 | 4일 이상 연속 | 휴식 없이 너무 오래 운동 |

**RPE (Rate of Perceived Exertion)란?**
- 1~10 스케일의 주관적 운동 강도
- 1: 매우 쉬움 → 10: 극도로 힘듦

---

### 3. 맞춤 추천 시스템 (`getRecommendations`)

운동 기록을 분석하여 개인화된 조언을 제공합니다.

```javascript
function getRecommendations() {
    const records = loadRecords();
    const routines = loadRoutines();
    const recs = [];

    // 1. 상체/하체 균형 분석
    let lower = 0, upper = 0, core = 0;
    for (const [ex, info] of Object.entries(routines)) {
        if (info.type === 'lower') lower += counts[ex] || 0;
        if (info.type === 'upper') upper += counts[ex] || 0;
        if (info.type === 'core') core += counts[ex] || 0;
    }

    if (upper < lower * 0.6 && lower > 3) {
        recs.push("💪 상체 운동 비중이 낮습니다.");
    }
    if (lower < upper * 0.6 && upper > 3) {
        recs.push("🦵 하체 운동 비중이 낮습니다.");
    }

    // 2. RPE 기반 강도 조절 추천
    const avgRpe = /* 최근 5개 기록 평균 */;
    if (avgRpe >= 8) {
        recs.push("😓 강도가 높았습니다. 가벼운 운동을 권장합니다.");
    } else if (avgRpe <= 4) {
        recs.push("⚡ 강도를 조금 높여보세요.");
    }

    // 3. 수행률 분석
    const completionRate = /* 최근 7일 완료율 */;
    if (completionRate >= 0.8) {
        recs.push("🔥 최근 수행률이 우수합니다!");
    } else if (completionRate < 0.5) {
        recs.push("📉 수행률이 낮습니다. 루틴 강도를 조정해보세요.");
    }

    return recs;
}
```

**추천 로직 요약**:
| 분석 항목 | 트리거 | 추천 내용 |
|----------|-------|----------|
| 상체 부족 | 상체 < 하체 × 0.6 | 푸시업 추가 권장 |
| 하체 부족 | 하체 < 상체 × 0.6 | 스쿼트/런지 추가 권장 |
| 코어 부족 | 코어 운동 < 3회 | 플랭크 추가 권장 |
| 고강도 | 평균 RPE ≥ 8 | 스트레칭/가벼운 운동 권장 |
| 저강도 | 평균 RPE ≤ 4 | 강도 상향 권장 |
| 높은 수행률 | 완료율 ≥ 80% | 칭찬 메시지 |
| 낮은 수행률 | 완료율 < 50% | 루틴 조정 권장 |

---

### 4. 주간 통계 계산 (`getWeeklyStats`)

이번 주 월~일 각 요일별 운동 완료 횟수를 계산합니다.

```javascript
function getWeeklyStats() {
    const records = loadRecords();
    const stats = [0, 0, 0, 0, 0, 0, 0];  // 월, 화, 수, 목, 금, 토, 일
    
    // 이번 주 월요일 찾기
    const today = new Date();
    const mondayOffset = today.getDay() === 0 ? -6 : 1 - today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);

    // 이번 주 기록만 카운트
    records.forEach(r => {
        const d = new Date(r.date);
        if (d >= monday && r.done === 'Y') {
            stats[(d.getDay() + 6) % 7]++;  // 월=0, 화=1, ... 일=6
        }
    });
    
    return stats;
}
```

**결과 예시**: `[3, 2, 0, 1, 2, 0, 0]`
→ 월요일 3회, 화요일 2회, 수요일 0회, ...

---

### 5. 월간 보고서 (`getMonthlyStats`)

특정 월의 종합 통계를 계산합니다.

```javascript
function getMonthlyStats(year, month) {
    // 해당 월 기록만 필터
    const monthRecords = records.filter(r => {
        const d = new Date(r.date);
        return d.getFullYear() === year && d.getMonth() === month;
    });

    return {
        totalDays: /* 운동한 날 수 */,
        totalExercises: /* 총 운동 횟수 */,
        avgRpe: /* 평균 RPE */,
        completionRate: /* 수행률 (%) */,
        exerciseStats: /* 운동별 횟수 */,
        weeklyData: /* 주차별 횟수 (차트용) */
    };
}
```

**보고서 항목**:
| 항목 | 계산 방식 |
|------|----------|
| 운동한 날 | 완료 기록이 1개 이상인 날짜 수 (중복 제거) |
| 총 운동 횟수 | done='Y'인 기록 개수 |
| 평균 RPE | RPE 값들의 산술평균 |
| 수행률 | 완료 / 전체 기록 × 100 |

---

## 📱 UI 구성 요소

### 메인 화면
- **날짜 선택기**: 이전/다음 날짜로 이동
- **진행률 바**: 오늘 운동 완료율
- **운동 카드 목록**: 클릭하면 기록 모달 열림
- **주간 차트**: 이번 주 요일별 운동 횟수
- **추천 섹션**: AI 분석 기반 조언

### 모달 종류
1. **기록 모달**: 완료 여부 + RPE 입력
2. **관리 모달**: 루틴 요일 변경 + 삭제
3. **새 운동 모달**: 커스텀 운동 추가
4. **리포트 모달**: 월간 상세 통계

---

## 🔧 커스터마이징 가이드

### 기본 루틴 변경
```javascript
const DEFAULT_ROUTINES = {
    squat: { name: "스쿼트", days: ["Mon", "Wed", "Fri"], reps: 20, ... },
    // 여기에 추가/수정
};
```

### 회복 알림 기준 조정
```javascript
// needRecovery 함수 내
if (avgRpe >= 8) ...  // 8 → 다른 값으로 변경
if (streak >= 4) ...  // 4 → 다른 값으로 변경
```

### 부위 분류 추가
```javascript
function getTypeKR(type) {
    return { 
        upper: '상체', 
        lower: '하체', 
        core: '코어', 
        cardio: '유산소', 
        mobility: '유연성',
        // 새 부위 추가
        arms: '팔'
    }[type] || type;
}
```

---

## 📚 핵심 개념 정리

| 용어 | 설명 |
|------|------|
| **localStorage** | 브라우저에 데이터를 영구 저장하는 Web API (5MB 제한) |
| **RPE** | Rate of Perceived Exertion, 주관적 운동 강도 (1~10) |
| **루틴** | 요일별로 반복되는 운동 계획 |
| **수행률** | 계획 대비 실제 완료 비율 |
| **Chart.js** | 차트 시각화 라이브러리 |

---

## ⚠️ 주의사항

1. **데이터 백업**: localStorage는 브라우저 데이터 삭제 시 함께 삭제됨
2. **브라우저 호환성**: 최신 Chrome, Firefox, Safari에서 테스트됨
3. **모바일 지원**: 반응형 디자인으로 모바일에서도 사용 가능
