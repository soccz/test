
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
# 목표: 딥러닝 학습을 위해 충분한 6개월치 시간 단위 데이터를 수집
# =============================================================================
print("Downloading Bitcoin Data for Deep Learning (Hourly)...")
try:
    # 6개월치 시간 단위 데이터 수집 (약 4300개 샘플)
    df = yf.download('BTC-USD', interval='1h', period='6mo', progress=False)
except Exception as e:
    print(f"Error: {e}")
    exit()

if isinstance(df.columns, pd.MultiIndex):
    df.columns = df.columns.get_level_values(0)

# 파생 변수 생성: 이동평균선 (Moving Average) - 시간 단위
df['MA5'] = df['Close'].rolling(window=5).mean()    
df['MA20'] = df['Close'].rolling(window=20).mean()  
df = df.dropna()

# 학습에는 전체 데이터를 사용하고, 시각화에는 최근 200시간만 사용 예정
data = df.copy()

# 입력(Features) 및 타겟(Target)
features = ['Close', 'Volume', 'MA5', 'MA20']
target = 'Close'

# =============================================================================
# [Step 2] 데이터 정규화 (Normalization)
# =============================================================================
scaler = MinMaxScaler()
# 전체 데이터에 대해 Fit
scaled_data = scaler.fit_transform(data[features])

# 타겟 역변환을 위한 Scaler (Close Price만)
target_scaler = MinMaxScaler()
target_scaler.fit(data[[target]])

# =============================================================================
# [Step 3] 데이터셋 구성: 슬라이딩 윈도우 (Sliding Window)
# =============================================================================
window_size = 10  # 과거 10시간의 패턴을 보고 
future_step = 1   # 다음 1시간을 예측 (Iterative 방식 사용 예정)

X = []
y = []

for i in range(len(scaled_data) - window_size):
    X.append(scaled_data[i : i + window_size])
    y.append(scaled_data[i + window_size, 0])  # Close price index = 0

X = np.array(X)
y = np.array(y)

# 데이터 분할 (Train/Test) - 성능 평가를 위해
# 최근 10%를 테스트 셋으로 사용
split_idx = int(len(X) * 0.9)
X_train, X_test = X[:split_idx], X[split_idx:]
y_train, y_test = y[:split_idx], y[split_idx:]

X_train_flat = X_train.reshape(X_train.shape[0], -1)
X_test_flat = X_test.reshape(X_test.shape[0], -1)

# =============================================================================
# [Step 4] 딥러닝 모델 학습 (Training)
# =============================================================================
# hidden_layer_sizes: 모델 복잡도 증가
model = MLPRegressor(hidden_layer_sizes=(128, 64, 32),
                     activation='relu',
                     solver='adam',
                     max_iter=500,
                     random_state=42,
                     early_stopping=True) # 과적합 방지

print("Training Deep Learning Model (sklearn MLP)...")
model.fit(X_train_flat, y_train)

# 성능 평가 (Test Set)
test_score = model.score(X_test_flat, y_test) # R^2 Score
# MAE 계산
y_pred_test = model.predict(X_test_flat)
y_test_inv = target_scaler.inverse_transform(y_test.reshape(-1, 1))
y_pred_test_inv = target_scaler.inverse_transform(y_pred_test.reshape(-1, 1))
mae = np.mean(np.abs(y_test_inv - y_pred_test_inv))

print(f"Training Complete. Test R2: {test_score:.4f}, MAE: {mae:.2f}")

# =============================================================================
# [Step 5] 미래 예측 (Iterative Prediction for 24 Steps)
# =============================================================================
# 현재 모델은 '과거 10시간 -> 다음 1시간'을 예측함.
# 이를 24번 반복하여 24시간 뒤까지 예측.

# 시작 입력: 데이터의 가장 마지막 10시간
last_window = scaled_data[-window_size:] 
current_input = last_window.copy() # (10, 4)

future_preds_scaled = []

# 피처 인덱스 확인: Close(0), Volume(1), MA5(2), MA20(3)
# 주의: Volume은 예측하기 어려우므로 최근 평균이나 마지막 값 유지 가정.
# MA는 예측된 Close 값을 기반으로 재계산(업데이트)해야 정확함.
# 편의상 Scikit-learn 예제에서는 간단히 Features를 고정하거나(간단버전), 
# 여기서는 'Close'값만 업데이트하고 나머지(Volume, MAs)는 근사치로 처리. 
# (정석대로라면 모든 피처를 예측하거나 재계산해야 함)

# 개선된 Iterative Logic:
# Close값을 예측하고, 이를 바탕으로 MA를 재계산하여 Input을 갱신.
full_price_history = list(data['Close'].values) # 전체 가격 리스트 복사

for _ in range(24):
    # 1. 모델 예측
    input_vec = current_input.reshape(1, -1)
    pred_val_scaled = model.predict(input_vec)[0] # 스칼라 값 (Close Scaled)
    
    # 스케일 역변환하여 실제 가격 구함
    pred_price = target_scaler.inverse_transform([[pred_val_scaled]])[0][0]
    future_preds_scaled.append(pred_price)
    
    # 2. 피처 업데이트를 위한 데이터 준비
    # 새로운 가격을 역사에 추가
    full_price_history.append(pred_price)
    
    # 새로운 MA 계산
    new_ma5 = np.mean(full_price_history[-5:])
    new_ma20 = np.mean(full_price_history[-20:])
    
    # Volume은 직전 값 유지 (단순화)
    last_vol = current_input[-1, 1] 
    
    # 3. 새로운 Row 생성 (Scaled)
    # [Close, Volume, MA5, MA20] 순서. Close는 pred_val_scaled가 이미 Scaled 상태가 아님(Target Scaler vs Feature Scaler).
    # Feature Scaler를 써야 하므로, Raw값을 만들고 다시 Transform 해야 함.
    
    new_row_raw = np.array([[pred_price, 
                             data['Volume'].iloc[-1], # Volume은 마지막 값 고정 (Unscaled)
                             new_ma5, 
                             new_ma20]])
    
    new_row_scaled = scaler.transform(new_row_raw) # (1, 4)
    
    # 4. Input Window 갱신 (슬라이딩: 맨 앞 제거, 뒤에 추가)
    current_input = np.vstack([current_input[1:], new_row_scaled])

# =============================================================================
# [Step 6] 결과 시각화
# =============================================================================
fig, ax = plt.subplots(figsize=(12, 6))

# 시각화 범위: 최근 200시간 + 미래 24시간
display_hours = 200
past_prices = data['Close'].values[-display_hours:]
past_dates = data.index[-display_hours:]

# 미래 날짜
last_date = past_dates[-1]
future_dates = [last_date + pd.Timedelta(hours=i) for i in range(1, 25)]

ax.plot(past_dates, past_prices, label=f'History (Last {display_hours} Hours)', color='#1f77b4')
ax.plot(future_dates, future_preds_scaled, label='Deep Prediction (Next 24h)', color='#ff7f0e', linewidth=2)
ax.scatter([future_dates[-1]], [future_preds_scaled[-1]], color='#ff7f0e', s=80, zorder=5)

# 성능 지표 텍스트
text_str = f'Test Set MAE: ${mae:.2f}\n(Model Error Margin)'
props = dict(boxstyle='round', facecolor='lavender', alpha=0.5)
ax.text(0.02, 0.95, text_str, transform=ax.transAxes, fontsize=11,
        verticalalignment='top', bbox=props)

# 포맷팅
ax.xaxis.set_major_locator(mdates.HourLocator(interval=24))
ax.xaxis.set_major_formatter(mdates.DateFormatter('%m-%d %Hh'))
plt.xticks(rotation=45)

ax.set_title(f"Bitcoin Prediction - Deep Learning MLP (6mo Training) | {datetime.now().strftime('%Y-%m-%d %H:%M')}")
ax.set_xlabel("Date & Time")
ax.set_ylabel("Price (USD)")
ax.legend()
ax.grid(True, alpha=0.3)
plt.tight_layout()

# 저장
output_path = os.path.join(SCRIPT_DIR, 'bitcoin_deep_result.png')
plt.savefig(output_path)
print(f"Deep Learning prediction complete. Image saved to {output_path}")

# =============================================================================
# [Step 7] 최종 리포트
# =============================================================================
print("\n[Deep Model Prediction - Hourly]")
print(f"Model Error (MAE): ${mae:.2f}")
print(f"Current Price:     ${past_prices[-1]:.2f}")
print(f"Price in 24 Hours: ${future_preds_scaled[-1]:.2f}")

diff = future_preds_scaled[-1] - past_prices[-1]
change_pct = (diff / past_prices[-1]) * 100
print(f"Expected Change:   {diff:+.2f} ({change_pct:+.2f}%)")
