
import yfinance as yf    # 금융 데이터 수집 라이브러리 (Yahoo Finance API)
import pandas as pd      # 데이터 조작 및 분석을 위한 라이브러리 (DataFrame 구조 활용)
import numpy as np       # 고성능 수치 계산 및 배열 처리를 위한 라이브러리
import matplotlib.pyplot as plt  # 데이터 시각화(그래프) 라이브러리
import os                # 파일 경로 처리를 위한 라이브러리
from sklearn.linear_model import LinearRegression # 머신러닝: 선형 회귀 모델

# 스크립트 위치를 기준으로 저장 경로 설정 (어디서 실행해도 같은 위치에 저장)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# =============================================================================
# [Step 1] 데이터 수집 (Data Collection)
# 목표: 비트코인(BTC-USD)의 최근 1년치 일봉(Daily) 데이터를 수집하여, 
# 가장 최근 200일간의 추세를 분석 대상으로 설정함.
# =============================================================================
print("Downloading Bitcoin Data (Daily)...")
df = yf.download('BTC-USD', interval='1d', period='1y', progress=False)

# DataFrame의 컬럼이 MultiIndex(이중 구조)인 경우, 단일 인덱스로 평탄화(Flatten) 처리
if isinstance(df.columns, pd.MultiIndex):
    df.columns = df.columns.get_level_values(0)

# 데이터 유효성 검사: 분석에 필요한 최소 200일의 데이터가 확보되었는지 확인
if len(df) < 200:
    print("Error: Not enough data retrieved.")
    exit()

# 최신 200일 데이터 슬라이싱 (분석 범위 설정)
data = df.tail(200).copy()
dates = data.index                # X축: 날짜 (DatetimeIndex)
prices = data['Close'].values.flatten()  # Y축: 종가 (Close Price), 1차원 배열로 변환

# =============================================================================
# [Step 2] 데이터 전처리 (Data Preprocessing)
# 목표: 날짜 데이터를 머신러닝 모델이 이해할 수 있는 수치형 시퀀스(0, 1, 2...)로 변환
# =============================================================================
# X (Feature): 시간의 흐름을 0부터 199까지의 정수로 표현
X = np.arange(len(prices)).reshape(-1, 1)  
# y (Target): 각 시점의 비트코인 종가
y = prices.reshape(-1, 1)

# =============================================================================
# [Step 3] 모델 학습 (Model Training)
# 알고리즘: 선형 회귀 (Linear Regression)
# 설명: 시간(X)과 가격(y) 사이의 선형적 관계(y = wx + b)를 학습하여 전체적인 '추세선'을 도출
# =============================================================================
model = LinearRegression()
model.fit(X, y) # 학습 수행 (최적의 기울기 w와 절편 b를 찾음)

# =============================================================================
# [Step 4] 미래 예측 (Prediction)
# 목표: 학습된 추세선을 연장하여 바로 다음 날(201번째 날)의 가격을 예측
# =============================================================================
# 예측할 시점: 현재 마지막 날(199)의 바로 다음 인덱스인 200 (실제로는 201일차)
X_future = np.array([[len(prices)]]) 
predicted_price = model.predict(X_future)[0][0]

# =============================================================================
# [Step 5] 결과 시각화 (Visualization)
# 목표: 과거 실제 가격과 모델이 예측한 추세선, 그리고 미래 예측점을 그래프로 표현
# =============================================================================
plt.figure(figsize=(12, 6))

# 1. 과거 데이터: 실제 가격 흐름 (History)
plt.plot(np.arange(len(prices)), prices, label='History (Past 200 Days)', color='blue')

# 2. 모델 예측선: 전체적인 상승/하락 추세 (Trend Line)
plt.plot(X, model.predict(X), label='Linear Trend Line', color='green', linestyle='--', alpha=0.7)

# 3. 미래 예측: 다음 날 예상 가격 (Prediction Point)
plt.scatter([len(prices)], [predicted_price], color='red', s=100, label='Next Day Prediction', zorder=5)

plt.title("Bitcoin Prediction - Basic (200 Days -> Next Day)")
plt.xlabel("Time (Days)")
plt.ylabel("Price (USD)")
plt.legend()
plt.grid(True)

# 그래프 이미지 저장 (스크립트 위치에 저장)
output_path = os.path.join(SCRIPT_DIR, 'bitcoin_basic_result.png')
plt.savefig(output_path)
print(f"Basic prediction logic complete. Image saved to {output_path}")

# =============================================================================
# [Step 6] 분석 결과 출력 (Report)
# =============================================================================
print("\n[Basic Model Prediction]")
print(f"Current Price (Day 200): ${prices[-1]:.2f}")
print(f"Predicted Price (Next Day): ${predicted_price:.2f}")

diff = predicted_price - prices[-1]
change_pct = (diff / prices[-1]) * 100
print(f"Expected Change: {diff:+.2f} ({change_pct:+.2f}%)")
