# 🚗 Traffic Analysis (교통 혼잡 분석)

한국도로공사 VDS(차량검지시스템) 데이터를 분석하여 **교통류 이론(Greenshields Model)**을 검증하고, **경로 배분 시뮬레이션(BPR 함수)**을 구현한 프로젝트입니다.

---

## 📁 프로젝트 구조

```
traffic/
├── src/                          # Python 분석 코드
│   ├── 01_data_loader.py         # 데이터 전처리
│   └── 02_analysis.py            # 통계 분석 및 시각화
├── js/                           # 웹 인터랙션 코드
│   ├── main.js                   # 공통 UI 로직
│   └── simulation.js             # 경로 배분 시뮬레이션
├── data/                         # 처리된 데이터 저장
├── css/                          # 스타일시트
├── index.html                    # 메인 프레젠테이션 페이지
├── lab.html                      # 시뮬레이션 실험 페이지
└── *.png                         # 분석 결과 그래프
```

---

## 🚀 사용 방법

### Python 분석 실행

```bash
# 필수 라이브러리 설치
pip install pandas numpy matplotlib

# 1단계: 데이터 전처리
python src/01_data_loader.py

# 2단계: 분석 및 시각화
python src/02_analysis.py
```

### 웹 시뮬레이션 실행
- `lab.html` 파일을 브라우저에서 열기
- 슬라이더로 교통량과 배분 비율 조정

---

## 📊 Part 1: 데이터 전처리 (01_data_loader.py)

### 🎯 목표
한국도로공사 VDS 원본 데이터를 분석 가능한 형태로 정제

### 📐 처리 과정

#### Step 1: 데이터 병합
```python
all_files = glob.glob(os.path.join(RAW_DATA_DIR, "*"))
for file in all_files:
    df = pd.read_csv(file, encoding='euc-kr', thousands=',')
    merged_df = pd.concat([merged_df, df])
```
- 여러 날짜의 CSV 파일을 하나로 합침
- `thousands=','`: "1,200" 같은 숫자의 쉼표 처리

#### Step 2: 분석 대상 필터링
```python
TARGET_NODES = ['안현JC', '일직JC', '조남JC', '도리JC']
df_filtered = merged_df[merged_df['노드명'].isin(TARGET_NODES)]
```
- 4개 분기점(JC)만 추출
- 전국 데이터 중 분석 대상 구간만 선별

#### Step 3: 이상치 제거
```python
df_filtered = df_filtered[
    (df_filtered['교통량'] > 0) & 
    (df_filtered['평균속도'] > 0)
]
```
- 교통량 0 이하: 센서 오류
- 속도 0 이하: 측정 불가 상태

#### Step 4: 파생 변수 생성
```python
df_filtered['밀도'] = df_filtered['교통량'] / df_filtered['평균속도']
```
- **밀도(k)** = 교통량(Q) / 속도(V)
- 의미: 1km 구간에 몇 대의 차가 있는가 (대/km)

### 📤 출력
- `data/processed/jc_filtered_data.csv`: 정제된 데이터

---

## 📈 Part 2: 통계 분석 (02_analysis.py)

### 🎯 목표
**Greenshields 모델**을 적용하여 도로의 교통류 특성을 분석

### 📐 Greenshields 모델이란?

1930년대 Bruce Greenshields가 제안한 교통류 이론으로, **속도와 밀도 사이에 선형 관계**가 있다고 가정합니다.

```
V = Vf × (1 - k/kj)

V  : 현재 속도
Vf : 자유속도 (차가 없을 때 속도)
k  : 현재 밀도
kj : 혼잡밀도 (속도가 0이 되는 밀도)
```

**핵심 개념**:
| 용어 | 영문 | 의미 |
|------|------|------|
| 자유속도 | Free Flow Speed (uf) | 교통량이 0일 때 이론적 최대 속도 |
| 혼잡밀도 | Jam Density (kj) | 완전 정체 시 밀도 (속도 = 0) |
| 도로용량 | Capacity (C) | 단위시간당 통과 가능한 최대 차량 수 |

### 🔄 분석 과정

#### Step 1: 기초 통계
```python
daily_stats = df.groupby('요일명')['평균속도'].mean().sort_values()
print(f"🐢 가장 느린 요일: {daily_stats.index[0]}")
```
- 요일별 평균 속도 계산
- 혼잡 패턴 파악

#### Step 2: 속도-밀도 관계 분석
```python
# 선형 회귀 (y = ax + b)
z = np.polyfit(clean_df['밀도'], clean_df['평균속도'], 1)
slope, intercept = z

# Greenshields 파라미터 추출
uf = intercept              # y절편 = 자유속도
kj = -intercept / slope     # x절편 = 혼잡밀도
q_max = (uf * kj) / 4       # 도로용량 (포물선 꼭짓점)
```

**그래프 해석**:
```
속도(V)
  ↑
  │     Vf ●─────────●  ← 자유속도 (y절편)
  │         ╲
  │          ╲  ← 추세선 (Greenshields Model)
  │           ╲
  │            ●
  └─────────────────→ 밀도(k)
                 kj  ← 혼잡밀도 (x절편)
```

#### Step 3: 요일별 패턴 시각화
```python
fig, ax1 = plt.subplots()
ax1.bar(week_order, daily_vol, color='skyblue')  # 교통량 (막대)
ax2 = ax1.twinx()
ax2.plot(week_order, daily_spd, color='red')     # 속도 (선)
```
- 이중 Y축 그래프
- 교통량과 속도의 역관계 시각화

### 📤 출력
- `speed_density.png`: 속도-밀도 산점도 + 회귀선
- `weekly_pattern.png`: 요일별 교통량/속도 패턴
- `data/analysis_result.json`: 분석 결과 (uf, kj, C)

---

## 🎮 Part 3: 웹 시뮬레이션 (simulation.js)

### 🎯 목표
**BPR 함수(Bureau of Public Roads)**를 사용하여 경로 선택 시뮬레이션

### 📐 BPR 함수란?

도로의 **혼잡도에 따른 통행시간 증가**를 모델링하는 함수입니다.

```
T = T₀ × [1 + α × (Q/C)^β]

T  : 실제 통행시간
T₀ : 자유통행시간 (혼잡 없을 때)
Q  : 현재 교통량
C  : 도로용량
α  : 계수 (표준값 0.15)
β  : 지수 (표준값 4.0)
```

**해석**:
- Q/C = 0.5 (50% 혼잡): 시간 1.02배 증가
- Q/C = 1.0 (100% 혼잡): 시간 1.15배 증가
- Q/C = 1.5 (150% 과포화): 시간 1.91배 증가

### 🔄 시뮬레이션 로직

#### 설정값
```javascript
const PARAMS = {
    uf: 103.7,      // 분석에서 도출한 자유속도
    capacity: 1301, // 분석에서 도출한 도로용량
    alpha: 0.15,    // BPR 표준 계수
    beta: 4.0       // BPR 표준 지수
};

const ROUTES = {
    A: { distance: 5.0, capacity_scale: 1.0 },  // 단거리
    B: { distance: 8.0, capacity_scale: 1.2 }   // 우회로 (용량 1.2배)
};
```

#### 통행시간 계산
```javascript
function calculateTime(traffic, routeConfig) {
    // 기본 통행시간 (분 단위)
    const t0 = (routeConfig.distance / PARAMS.uf) * 60;
    
    // 용량
    const cap = PARAMS.capacity * routeConfig.capacity_scale;
    
    // BPR 공식 적용
    const congestionFactor = 1 + PARAMS.alpha * Math.pow((traffic / cap), PARAMS.beta);
    
    return t0 * congestionFactor;
}
```

#### 균형 상태 판별
```javascript
const diff = Math.abs(tA - tB);

if (diff < 1.0) {
    // ⚖️ 균형 상태: 두 경로 시간 차이 1분 미만
    // → 운전자들이 경로를 바꿀 이유 없음
} else if (tA < tB) {
    // ⚠️ 불균형: A가 더 빠름 → 사람들이 A로 몰림
} else {
    // ⚠️ 불균형: B가 더 빠름 → 사람들이 B로 몰림
}
```

### 🎛️ UI 인터랙션

```javascript
// 슬라이더 이벤트 리스너
document.getElementById('totalDemand').addEventListener('input', updateSimulation);
document.getElementById('splitRatio').addEventListener('input', updateSimulation);
```

| 슬라이더 | 조절 항목 | 범위 |
|----------|----------|------|
| Total Demand | 총 교통량 (대/시) | 0 ~ 2600 |
| Split Ratio | A경로 배분 비율 | 0% ~ 100% |

### 📊 결과 표시
- **경로별 교통량**: 배분된 차량 수
- **경로별 소요시간**: BPR 계산 결과
- **총 시스템 통행시간**: Σ(차량수 × 시간)
- **균형 상태**: Wardrop 균형 충족 여부

---

## 🧮 교통공학 핵심 수식 정리

### 1. 기본 관계식
```
Q = k × V

Q: 교통량 (대/시간)
k: 밀도 (대/km)
V: 속도 (km/시간)
```

### 2. Greenshields 속도-밀도 모델
```
V = Vf × (1 - k/kj)
```

### 3. Greenshields 교통량-밀도 모델
```
Q = Vf × k × (1 - k/kj)
```
- 이는 **포물선** 형태
- 최대값(용량)은 k = kj/2 에서 발생

### 4. 도로용량 공식
```
C = (Vf × kj) / 4
```

### 5. BPR 통행시간 함수
```
T = T₀ × [1 + 0.15 × (Q/C)^4]
```

---

## 📚 핵심 개념 정리

| 용어 | 영문 | 설명 |
|------|------|------|
| **VDS** | Vehicle Detection System | 도로에 설치된 차량 감지 센서 |
| **JC** | Junction | 고속도로 분기점 |
| **교통량(Q)** | Flow | 단위시간당 통과 차량 수 (대/시) |
| **밀도(k)** | Density | 단위거리당 차량 수 (대/km) |
| **속도(V)** | Speed | 평균 주행 속도 (km/h) |
| **자유속도(Vf)** | Free Flow Speed | 혼잡 없을 때 속도 |
| **혼잡밀도(kj)** | Jam Density | 완전 정체 시 밀도 |
| **도로용량(C)** | Capacity | 최대 통행 가능 교통량 |
| **BPR 함수** | - | 혼잡도 기반 통행시간 산정 함수 |
| **Wardrop 균형** | User Equilibrium | 모든 경로의 통행시간이 같은 상태 |

---

## ⚠️ 분석 시 주의사항

1. **데이터 품질**: VDS 센서 오류로 인한 이상치 존재 가능
2. **모델 한계**: Greenshields는 단순화된 모델로 실제와 차이 있음
3. **시뮬레이션 가정**: 모든 운전자가 합리적으로 행동한다고 가정
4. **시간대 변동**: 출퇴근 시간대에 패턴이 크게 달라짐
