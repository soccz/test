
import yfinance as yf    # 금융 데이터 수집 라이브러리 (Yahoo Finance API)
import pandas as pd      # 데이터 조작 및 분석을 위한 라이브러리 (DataFrame 구조 활용)
import numpy as np       # 고성능 수치 계산 및 배열 처리를 위한 라이브러리
import matplotlib.pyplot as plt  # 데이터 시각화(그래프) 라이브러리
import os                # 파일 경로 처리를 위한 라이브러리
import matplotlib.dates as mdates  # 날짜 포맷팅을 위한 라이브러리
from datetime import datetime  # 실행 시점 날짜 표시용
from sklearn.linear_model import LinearRegression # 머신러닝: 선형 회귀 모델

# 스크립트 위치를 기준으로 저장 경로 설정 (어디서 실행해도 같은 위치에 저장)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# =============================================================================
# [Step 1] 데이터 수집 (Data Collection)
# 목표: 비트코인(BTC-USD)의 최근 1개월치 시간봉(Hourly) 데이터를 수집하여, 
# 가장 최근 200시간의 추세를 분석 대상으로 설정함.
# =============================================================================
print("Downloading Bitcoin Data (Hourly)...")
try:
    # 1시간 단위 데이터는 최대 730일(2년)까지 가능하지만, 여기선 최근 1~3개월이면 충분
    df = yf.download('BTC-USD', interval='1h', period='3mo', progress=False)
except Exception as e:
    print(f"Error downloading data: {e}")
    exit()

# DataFrame의 컬럼이 MultiIndex(이중 구조)인 경우, 단일 인덱스로 평탄화(Flatten) 처리
if isinstance(df.columns, pd.MultiIndex):
    df.columns = df.columns.get_level_values(0)

# 데이터 유효성 검사: 분석에 필요한 최소 200시간의 데이터가 확보되었는지 확인
if len(df) < 200:
    print("Error: Not enough data retrieved.")
    exit()

# 최신 200시간 데이터 슬라이싱 (분석 범위 설정)
data = df.tail(200).copy()
dates = data.index                # X축: 날짜시간 (DatetimeIndex)
prices = data['Close'].values.flatten()  # Y축: 종가 (Close Price), 1차원 배열로 변환

# =============================================================================
# [Step 2] 데이터 전처리 (Data Preprocessing)
# 목표: 시간 데이터를 머신러닝 모델이 이해할 수 있는 수치형 시퀀스(0, 1, 2...)로 변환
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
model.fit(X, y) # 학습 수행

# 성능 지표 확인 (R-squared: 결정 계수)
# 1에 가까울수록 모델이 데이터를 잘 설명함
r_squared = model.score(X, y)

# =============================================================================
# [Step 4] 미래 예측 (Prediction)
# 목표: 학습된 추세선을 연장하여 향후 24시간의 가격을 예측
# =============================================================================
# 예측할 시점: 현재 마지막(199) 이후 24개 스텝 (200 ~ 223)
future_steps = 24
X_future = np.arange(len(prices), len(prices) + future_steps).reshape(-1, 1)
y_future = model.predict(X_future).flatten()

# 미래 날짜 생성 (1시간 단위)
last_date = dates[-1]
future_dates = [last_date + pd.Timedelta(hours=i) for i in range(1, future_steps + 1)]

# =============================================================================
# [Step 5] 결과 시각화 (Visualization)
# 목표: 과거 실제 가격, 모델 추세선, 미래 24시간 예측선 및 R2 점수 표시
# =============================================================================
fig, ax = plt.subplots(figsize=(12, 6))

# 1. 과거 데이터: 실제 가격 흐름 (History)
ax.plot(dates, prices, label='History (Past 200 Hours)', color='blue', alpha=0.6)

# 2. 모델 추세선 (과거 구간)
ax.plot(dates, model.predict(X), label='Linear Low-Best Fit', color='green', linestyle='--', alpha=0.7)

# 3. 미래 예측: 향후 24시간 예상 가격
ax.plot(future_dates, y_future, label='Future Prediction (Next 24h)', color='red', linewidth=2)
# 끝점에 마커 표시
ax.scatter([future_dates[-1]], [y_future[-1]], color='red', s=80, zorder=5)

# 성능 지표 텍스트 추가 (그래프 내부)
# 위치: 왼쪽 상단
text_str = f'Model Accuracy ($R^2$): {r_squared:.4f}\n(Linear Trend Reliability)'
props = dict(boxstyle='round', facecolor='wheat', alpha=0.5)
ax.text(0.02, 0.95, text_str, transform=ax.transAxes, fontsize=11,
        verticalalignment='top', bbox=props)

# X축 날짜 포맷 설정 (일-시간 표기)
ax.xaxis.set_major_locator(mdates.HourLocator(interval=24)) # 24시간 간격으로 메인 눈금
ax.xaxis.set_major_formatter(mdates.DateFormatter('%m-%d %Hh')) 
plt.xticks(rotation=45)

ax.set_title(f"Bitcoin Prediction - Basic Linear (Next 24 Hours) | {datetime.now().strftime('%Y-%m-%d %H:%M')}")
ax.set_xlabel("Date & Time")
ax.set_ylabel("Price (USD)")
ax.legend()
ax.grid(True, alpha=0.3)
plt.tight_layout()

# 그래프 이미지 저장
output_path = os.path.join(SCRIPT_DIR, 'bitcoin_basic_result.png')
plt.savefig(output_path)
print(f"Basic prediction logic complete. Image saved to {output_path}")

# =============================================================================
# [Step 6] 분석 결과 출력 (Report)
# =============================================================================
print("\n[Basic Model Prediction - Hourly]")
print(f"Model Reliability (R^2): {r_squared:.4f}")
print(f"Current Price:     ${prices[-1]:.2f}")
print(f"Price in 24 Hours: ${y_future[-1]:.2f}")

diff = y_future[-1] - prices[-1]
change_pct = (diff / prices[-1]) * 100
print(f"Expected Change:   {diff:+.2f} ({change_pct:+.2f}%)")
