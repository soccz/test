
import yfinance as yf    # 금융 데이터 수집
import pandas as pd      # 데이터 분석 및 전처리
import numpy as np       # 수치 연산 및 배열 처리
import matplotlib.pyplot as plt  # 시각화
import os

# 스크립트 위치를 기준으로 저장 경로 설정 (어디서 실행해도 같은 위치에 저장)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# GPU 사용을 끄고 CPU만 사용하도록 설정 (호환성 문제 방지 및 안정성 확보)
os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
import tensorflow as tf
from sklearn.preprocessing import MinMaxScaler  # 데이터 정규화 (Normalization)
from tensorflow.keras.models import Sequential  # 딥러닝 모델 구조 (Sequential API)
from tensorflow.keras.layers import Dense, Dropout # 신경망 레이어 및 과적합 방지

# =============================================================================
# [Step 1] 데이터 수집 및 피처 엔지니어링 (Data Collection & Feature Engineering)
# 목표: 단순 가격뿐만 아니라 이동평균선(MA)을 추가하여 '추세 정보'를 함께 학습시킴
# =============================================================================
print("Downloading Bitcoin Data for Deep Learning (Daily)...")
# 학습 데이터 확보: 최근 2년치 일봉 데이터 호출
df = yf.download('BTC-USD', interval='1d', period='2y', progress=False)

if isinstance(df.columns, pd.MultiIndex):
    df.columns = df.columns.get_level_values(0)

# 파생 변수 생성: 이동평균선 (Moving Average)
# - MA5: 주간(5일) 단기 추세
# - MA20: 월간(20일) 중기 추세
df['MA5'] = df['Close'].rolling(window=5).mean()    
df['MA20'] = df['Close'].rolling(window=20).mean()  
df = df.dropna() # 이동평균 계산으로 발생한 결측치(NaN) 제거

# 최종 데이터셋: 가장 최근 200일 치 데이터만 사용 (입력 기간 제한)
data = df.tail(200).copy()

# 입력(Features) 및 타겟(Target) 정의
# 다변량 시계열 분석: 종가, 거래량, 5일평균, 20일평균을 모두 고려하여 미래를 예측
features = ['Close', 'Volume', 'MA5', 'MA20']
target = 'Close'

# =============================================================================
# [Step 2] 데이터 정규화 (Normalization)
# 이유: 서로 다른 스케일(가격: 1억, 거래량: 수천 개)을 0~1 사이로 맞춰 학습 효율 증대
# =============================================================================
scaler = MinMaxScaler()
scaled_data = scaler.fit_transform(data[features])

# 예측 결과(0~1)를 다시 실제 가격($)으로 복원하기 위한 타겟 전용 Scaler
target_scaler = MinMaxScaler()
target_scaler.fit(data[[target]])

# =============================================================================
# [Step 3] 데이터셋 구성: 슬라이딩 윈도우 (Sliding Window)
# 방식: 과거 10일치 데이터(X)를 보고, 그 다음 날(y)을 예측하도록 데이터셋 구성
# =============================================================================
window_size = 10  # 학습 단위 (Look-back period)
X = []
y = []

# 시계열 데이터셋 생성 (과거 패턴 학습용)
for i in range(len(scaled_data) - window_size):
    X.append(scaled_data[i : i + window_size])     # 예를 들어 1일~10일 데이터
    y.append(scaled_data[i + window_size, 0])      # 11일째의 종가 (Target)

X = np.array(X)
y = np.array(y)

# 딥러닝 모델(MLP/Dense) 입력을 위해 2차원 데이터를 1차원 벡터로 변환 (Flatten)
# (Samples, TimeSteps, Features) -> (Samples, TimeSteps * Features)
X_flat = X.reshape(X.shape[0], -1)

# =============================================================================
# [Step 4] 딥러닝 모델 설계 (Model Architecture)
# 구조: 심층 신경망 (DNN / Multi-Layer Perceptron)
# =============================================================================
model = Sequential([
    # Input Layer & Hidden Layer 1: 64개 뉴런, ReLU 활성화 함수
    Dense(64, activation='relu', input_shape=(X_flat.shape[1],)),
    
    # Dropout Layer: 학습 중 뉴런 20%를 무작위로 비활성화하여 과적합(Overfitting) 방지
    Dropout(0.2), 
    
    # Hidden Layer 2 & 3: 점진적으로 뉴런 수를 줄여가며 특징 압축
    Dense(32, activation='relu'),
    Dense(16, activation='relu'),
    
    # Output Layer: 다음 날 가격 1개를 예측 (Linear output)
    Dense(1) 
])

# 모델 컴파일: 손실함수(MSE)와 최적화 알고리즘(Adam) 설정
model.compile(optimizer='adam', loss='mse')

# =============================================================================
# [Step 5] 모델 학습 (Training)
# =============================================================================
print("Training Deep Learning Model...")
# Epochs: 전체 데이터를 100번 반복 학습하여 패턴 습득
history = model.fit(X_flat, y, epochs=100, batch_size=8, verbose=0)
print("Training Complete.")

# =============================================================================
# [Step 6] 미래 예측 (Prediction)
# 목표: 데이터의 가장 마지막 10일치 패턴을 입력하여 '내일'의 가격 예측
# =============================================================================
last_window = scaled_data[-window_size:] 
input_vector = last_window.reshape(1, -1)

# 모델 예측 (0~1 사이의 정규화된 값 반환)
pred_scaled = model.predict(input_vector, verbose=0)

# 실제 가격 단위($)로 역변환 (Inverse Transform)
predicted_price = target_scaler.inverse_transform(pred_scaled)[0][0]

# =============================================================================
# [Step 7] 결과 시각화 (Visualization)
# =============================================================================
plt.figure(figsize=(12, 6))

# 시각화 편의를 위해 최근 60일 데이터만 확대하여 표시
display_days = 60
past_prices = data['Close'].values[-display_days:]
dates_idx = np.arange(len(past_prices))

plt.plot(dates_idx, past_prices, label=f'History (Last {display_days} Days)', color='#1f77b4')

# 내일 예측값 표시 (마지막 날짜 인덱스 + 1 위치)
plt.scatter([len(past_prices)], [predicted_price], color='#ff7f0e', s=100, label='AI Prediction (Tomorrow)', zorder=5)

plt.title("Bitcoin Prediction - Deep Learning (Based on 200 Days)")
plt.xlabel("Time (Days)")
plt.ylabel("Price (USD)")
plt.legend()
plt.grid(True)

# 그래프 이미지 저장 (스크립트 위치에 저장)
output_path = os.path.join(SCRIPT_DIR, 'bitcoin_deep_result.png')
plt.savefig(output_path)
print(f"Deep Learning prediction complete. Image saved to {output_path}")

# =============================================================================
# [Step 8] 최종 리포트 (Final Report)
# =============================================================================
print("\n[Advanced Model Prediction]")
current_price = past_prices[-1]
diff = predicted_price - current_price
change_pct = (diff / current_price) * 100

print(f"Current Price:   ${current_price:.2f}")
print(f"Tomorrow Pred:   ${predicted_price:.2f}")
print(f"Expected Change: {diff:+.2f} ({change_pct:+.2f}%)")
