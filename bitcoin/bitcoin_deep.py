
import yfinance as yf    # 금융 데이터 수집
import pandas as pd      # 데이터 분석 및 전처리
import numpy as np       # 수치 연산 및 배열 처리
import matplotlib.pyplot as plt  # 시각화
import os
import matplotlib.dates as mdates  # 날짜 포맷팅을 위한 라이브러리
from datetime import datetime  # 실행 시점 날짜 표시용

# 스크립트 위치를 기준으로 저장 경로 설정 (어디서 실행해도 같은 위치에 저장)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# GPU/TensorFlow 관련 설정 제거 및 Scikit-learn MLPRegressor 사용
from sklearn.preprocessing import MinMaxScaler
from sklearn.neural_network import MLPRegressor  # Scikit-learn의 딥러닝 모델

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
# Scikit-learn implementation
# =============================================================================
# hidden_layer_sizes=(64, 32, 16): 3개의 은닉층
# max_iter=500: 최대 학습 반복 횟수
# random_state=42: 재현성을 위한 시드값
model = MLPRegressor(hidden_layer_sizes=(64, 32, 16),
                     activation='relu',
                     solver='adam',
                     max_iter=500,
                     random_state=42)

# =============================================================================
# [Step 5] 모델 학습 (Training)
# =============================================================================
print("Training Deep Learning Model (sklearn MLP)...")
model.fit(X_flat, y)
print("Training Complete.")

# =============================================================================
# [Step 6] 미래 예측 (Prediction)
# 목표: 데이터의 가장 마지막 10일치 패턴을 입력하여 '내일'의 가격 예측
# =============================================================================
last_window = scaled_data[-window_size:] 
input_vector = last_window.reshape(1, -1)

# 모델 예측 (0~1 사이의 정규화된 값 반환)
pred_scaled = model.predict(input_vector).reshape(-1, 1)

# 실제 가격 단위($)로 역변환 (Inverse Transform)
predicted_price = target_scaler.inverse_transform(pred_scaled)[0][0]

# =============================================================================
# [Step 7] 결과 시각화 (Visualization)
# =============================================================================
fig, ax = plt.subplots(figsize=(12, 6))

# 시각화 편의를 위해 최근 200일 데이터 표시 (basic과 동일하게)
display_days = 200
past_prices = data['Close'].values[-display_days:]
past_dates = data.index[-display_days:]  # 실제 날짜 사용

# 미래 예측 날짜 (마지막 날짜 + 1일)
next_date = past_dates[-1] + pd.Timedelta(days=1)

ax.plot(past_dates, past_prices, label=f'History (Last {display_days} Days)', color='#1f77b4')

# 내일 예측값 표시
ax.scatter([next_date], [predicted_price], color='#ff7f0e', s=100, label='AI Prediction (Tomorrow)', zorder=5)

# X축 날짜 포맷 설정
ax.xaxis.set_major_locator(mdates.MonthLocator())  # 월별로 주요 눈금
ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d'))  # 날짜 형식
plt.xticks(rotation=45)  # 날짜 레이블 회전

ax.set_title(f"Bitcoin Prediction - Deep Learning (Based on 200 Days) | {datetime.now().strftime('%Y-%m-%d')}")
ax.set_xlabel("Date")
ax.set_ylabel("Price (USD)")
ax.legend()
ax.grid(True)
plt.tight_layout()  # 레이블이 잘리지 않도록 레이아웃 조정

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
