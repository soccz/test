# 🪙 Bitcoin Price Prediction

비트코인 가격 예측 프로젝트입니다. **머신러닝(선형 회귀)**과 **딥러닝(MLP)**을 사용하여 내일의 비트코인 가격을 예측합니다.

---

## 📁 프로젝트 구조

```
bitcoin/
├── bitcoin_basic.py          # 선형 회귀 기반 예측 (입문용)
├── bitcoin_deep.py           # 딥러닝(MLP) 기반 예측 (심화)
├── bitcoin_basic_result.png  # 기본 모델 결과 그래프
├── bitcoin_deep_result.png   # 딥러닝 모델 결과 그래프
├── index.html                # 웹 프레젠테이션 페이지
└── README.md                 # 이 문서
```

---

## 🚀 사용 방법

### 필수 라이브러리 설치

```bash
pip install yfinance pandas numpy matplotlib scikit-learn tensorflow
```

### 실행

```bash
# 기본 모델 실행
python bitcoin_basic.py

# 딥러닝 모델 실행
python bitcoin_deep.py
```

---

## 📊 모델 1: 선형 회귀 (bitcoin_basic.py)

### 🎯 목표
- 가장 단순한 머신러닝 방법으로 비트코인 가격 추세를 예측
- 초보자도 이해할 수 있는 수준의 코드

### 📐 알고리즘 설명

**선형 회귀(Linear Regression)**는 데이터 사이의 직선 관계를 찾는 알고리즘입니다.

```
y = w * x + b

y: 예측하고 싶은 값 (비트코인 가격)
x: 입력 값 (시간, 날짜 순서)
w: 기울기 (가격이 하루에 얼마나 변하는가)
b: 절편 (기준 가격)
```

### 🔄 코드 흐름 (Step by Step)

#### Step 1: 데이터 수집
```python
df = yf.download('BTC-USD', interval='1d', period='1y')
data = df.tail(200).copy()  # 최근 200일만 사용
```
- **Yahoo Finance API**를 통해 비트코인(BTC-USD) 1년치 일봉 데이터를 가져옴
- 분석 대상: 가장 최근 **200일**

#### Step 2: 데이터 전처리
```python
X = np.arange(len(prices)).reshape(-1, 1)  # [0, 1, 2, ..., 199]
y = prices.reshape(-1, 1)                   # 각 날의 종가
```
- 날짜를 숫자로 변환 (1일차=0, 2일차=1, ...)
- 머신러닝 모델은 날짜 문자열을 이해하지 못하기 때문

#### Step 3: 모델 학습
```python
model = LinearRegression()
model.fit(X, y)
```
- 200일치 (시간, 가격) 데이터를 학습
- 모델이 최적의 기울기(w)와 절편(b)을 자동으로 찾음

#### Step 4: 미래 예측
```python
X_future = np.array([[len(prices)]])  # 201일차
predicted_price = model.predict(X_future)[0][0]
```
- 학습된 직선을 연장하여 다음 날 가격을 예측

#### Step 5: 시각화
- 파란선: 과거 200일 실제 가격
- 녹색 점선: 모델이 찾은 추세선
- 빨간 점: 내일 예상 가격

### ⚠️ 한계점
- 단순히 "상승/하락 추세"만 반영
- 급격한 시장 변화(뉴스, 규제 등)를 반영하지 못함
- 실제 투자에 사용하기엔 너무 단순함

---

## 🧠 모델 2: 딥러닝 MLP (bitcoin_deep.py)

### 🎯 목표
- 여러 변수(가격, 거래량, 이동평균)를 동시에 고려
- 비선형적 패턴까지 학습 가능한 신경망 사용

### 📐 알고리즘 설명

**MLP(Multi-Layer Perceptron)**는 여러 층의 뉴런으로 구성된 인공 신경망입니다.

```
입력층 → 은닉층1(64) → 은닉층2(32) → 은닉층3(16) → 출력층(1)
                ↓             ↓             ↓
             Dropout       ReLU활성화     선형출력
```

### 🔄 코드 흐름 (Step by Step)

#### Step 1: 데이터 수집 + 피처 엔지니어링
```python
df['MA5'] = df['Close'].rolling(window=5).mean()   # 5일 이동평균
df['MA20'] = df['Close'].rolling(window=20).mean() # 20일 이동평균
features = ['Close', 'Volume', 'MA5', 'MA20']
```
- 단순 가격뿐만 아니라 **거래량**, **이동평균선**도 입력으로 사용
- **이동평균선**: 최근 N일간 가격의 평균 (추세 파악용)

#### Step 2: 데이터 정규화 (Normalization)
```python
scaler = MinMaxScaler()
scaled_data = scaler.fit_transform(data[features])
```
- 모든 값을 **0~1 사이**로 변환
- **왜 필요한가?**: 가격(50,000)과 거래량(1,000,000)처럼 스케일이 다르면 학습이 불안정해짐

#### Step 3: 슬라이딩 윈도우 데이터셋 구성
```python
window_size = 10
for i in range(len(scaled_data) - window_size):
    X.append(scaled_data[i : i + window_size])    # 1~10일차 데이터
    y.append(scaled_data[i + window_size, 0])     # 11일차 가격
```
- **슬라이딩 윈도우**: 과거 10일을 보고 다음 날을 예측하는 구조
- 예시:
  - 입력: 1~10일 데이터 → 출력: 11일 가격
  - 입력: 2~11일 데이터 → 출력: 12일 가격
  - ...

#### Step 4: 신경망 모델 설계
```python
model = Sequential([
    Dense(64, activation='relu', input_shape=(40,)),  # 10일 x 4개 피처 = 40
    Dropout(0.2),   # 과적합 방지
    Dense(32, activation='relu'),
    Dense(16, activation='relu'),
    Dense(1)        # 출력: 1개 (내일 가격)
])
```

| 레이어 | 역할 |
|--------|------|
| `Dense(64, relu)` | 첫 번째 은닉층, 64개 뉴런으로 패턴 추출 |
| `Dropout(0.2)` | 학습 중 20% 뉴런을 비활성화하여 과적합 방지 |
| `Dense(32, relu)` | 두 번째 은닉층, 특징 압축 |
| `Dense(16, relu)` | 세 번째 은닉층 |
| `Dense(1)` | 출력층, 예측 가격 1개 출력 |

#### Step 5: 모델 학습
```python
model.compile(optimizer='adam', loss='mse')
model.fit(X_flat, y, epochs=100, batch_size=8)
```
- **Adam**: 가장 널리 쓰이는 최적화 알고리즘
- **MSE(Mean Squared Error)**: 예측값과 실제값 차이의 제곱 평균 (손실 함수)
- **100 Epochs**: 전체 데이터를 100번 반복 학습

#### Step 6: 예측 및 역변환
```python
last_window = scaled_data[-window_size:]  # 최근 10일
pred_scaled = model.predict(input_vector)
predicted_price = target_scaler.inverse_transform(pred_scaled)  # 0~1 → 달러
```
- 정규화된 예측값을 실제 달러 가격으로 복원

### ✅ 기본 모델 대비 장점
| 항목 | 기본 모델 | 딥러닝 모델 |
|------|----------|------------|
| 입력 변수 | 시간 1개 | 가격, 거래량, MA5, MA20 (4개) |
| 패턴 학습 | 직선만 | 비선형 패턴 가능 |
| 과거 참조 | 전체 평균 | 최근 10일 중점 |

### ⚠️ 주의사항
- 딥러닝이라고 항상 더 정확하지는 않음
- 학습 데이터가 부족하면 과적합(Overfitting) 위험
- 실제 투자 시에는 여러 모델을 조합해서 사용해야 함

---

## 📈 결과 해석 방법

실행 후 콘솔에 다음과 같은 결과가 출력됩니다:

```
[Advanced Model Prediction]
Current Price:   $97,500.00
Tomorrow Pred:   $98,200.00
Expected Change: +700.00 (+0.72%)
```

| 항목 | 의미 |
|------|------|
| Current Price | 오늘(마지막 데이터)의 종가 |
| Tomorrow Pred | 모델이 예측한 내일 가격 |
| Expected Change | 예상 변동폭 (절대값 + 퍼센트) |

---

## 🔧 코드 커스터마이징 가이드

### 예측 기간 변경
```python
# bitcoin_basic.py
data = df.tail(200).copy()  # 200 → 다른 숫자로 변경
```

### 윈도우 크기 변경 (딥러닝)
```python
# bitcoin_deep.py
window_size = 10  # 10 → 5, 20, 30 등으로 변경
```

### 다른 암호화폐 예측
```python
df = yf.download('ETH-USD', ...)  # 이더리움
df = yf.download('XRP-USD', ...)  # 리플
```

---

## 📚 핵심 개념 정리

| 용어 | 설명 |
|------|------|
| **yfinance** | Yahoo Finance에서 주식/암호화폐 데이터를 가져오는 라이브러리 |
| **선형 회귀** | 데이터의 직선 관계를 찾는 가장 기본적인 머신러닝 알고리즘 |
| **이동평균(MA)** | 최근 N일간 가격의 평균, 추세 파악에 사용 |
| **MinMaxScaler** | 모든 데이터를 0~1 사이로 정규화 |
| **슬라이딩 윈도우** | 시계열 데이터를 (과거 N일 → 다음 1일) 형태로 변환 |
| **Dropout** | 신경망 학습 시 일부 뉴런을 비활성화하여 과적합 방지 |
| **MSE** | 예측 오차를 측정하는 손실 함수 (Mean Squared Error) |
