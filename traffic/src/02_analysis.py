# -*- coding: utf-8 -*-
"""
02_analysis.py
=============
[기능]
전처리된 데이터를 불러와서 수학적으로 분석하고 그래프를 그리는 코드입니다.

[분석 내용]
1. 기초 통계: 평균 속도, 가장 막히는 요일 등
2. 그래프 그리기: 산점도, 요일별 패턴 등
3. 심화 분석 (Greenshields Model):
   - 속도와 밀도의 관계를 선형 회귀로 분석
   - 자유속도, 도로용량 계산
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import os
import json

# -----------------------------------------------------------------------------
# 1. 설정 (Settings)
# -----------------------------------------------------------------------------
# 한글 폰트 설정 (그래프에 한글 깨짐 방지)
plt.rcParams['font.family'] = 'DejaVu Sans' # 기본 폰트
plt.rcParams['axes.unicode_minus'] = False  # 마이너스 기호 깨짐 방지

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(BASE_DIR, 'data', 'processed', 'jc_filtered_data.csv')
WEB_DATA_DIR = os.path.join(BASE_DIR, 'web', 'data')     # JSON 결과 저장
WEB_IMG_DIR = os.path.join(BASE_DIR, 'web')              # 그래프 이미지 저장 (웹사이트용)

def run_analysis():
    print("🚀 데이터 분석을 시작합니다...")
    
    # 데이터 불러오기
    if not os.path.exists(DATA_PATH):
        print("❌ 처리된 데이터 파일이 없습니다. 01_data_loader.py를 먼저 실행하세요.")
        return

    df = pd.read_csv(DATA_PATH)
    print(f"📊 분석 대상 데이터: {len(df):,}개\n")

    # -------------------------------------------------------
    # 2. 기초 통계 분석 (Basic Statistics)
    # -------------------------------------------------------
    print("[1] 요일별 평균 속도 분석")
    # 요일별로 그룹을 묶어서 속도 평균 구하기
    daily_stats = df.groupby('요일명')['평균속도'].mean().sort_values()
    print(daily_stats)
    print(f"🐢 가장 느린 요일: {daily_stats.index[0]} ({daily_stats.iloc[0]:.1f} km/h)")
    print(f"🐇 가장 빠른 요일: {daily_stats.index[-1]} ({daily_stats.iloc[-1]:.1f} km/h)\n")

    # -------------------------------------------------------
    # 3. 그래프 그리기 (Visualizations)
    # -------------------------------------------------------
    os.makedirs(WEB_IMG_DIR, exist_ok=True)

    # (A) 속도-밀도 관계 (Greenshields Model 검증용)
    # 이론: 차가 많아지면(밀도 증가), 속도는 직선으로 떨어진다.
    plt.figure(figsize=(10, 6))
    
    # 1. 실제 데이터 점 찍기
    # 밀도가 너무 크거나 작은 이상치는 제외하고 그림
    clean_df = df[(df['밀도'] > 0) & (df['밀도'] < 200)]
    plt.scatter(clean_df['밀도'], clean_df['평균속도'], alpha=0.1, s=5, color='blue', label='실제 데이터')
    
    # 2. 추세선 그리기 (선형 회귀: y = ax + b)
    # polyfit(x, y, 1): 1차 함수(직선)를 찾아라
    z = np.polyfit(clean_df['밀도'], clean_df['평균속도'], 1)
    p = np.poly1d(z) # 함수 만들기
    
    # x축(밀도) 범위: 0부터 최대값까지
    x_range = np.linspace(0, clean_df['밀도'].max(), 100)
    plt.plot(x_range, p(x_range), "r-", linewidth=2, label='Greenshields Model (추세선)')
    
    plt.title('Speed vs Density (Greenshields Model)')
    plt.xlabel('Density (veh/km)')
    plt.ylabel('Speed (km/h)')
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.savefig(os.path.join(WEB_IMG_DIR, 'speed_density.png'), dpi=100)
    plt.close()
    print("✅ 그래프 저장 완료: speed_density.png")

    # (B) 요일별 패턴 (막대 + 꺾은선)
    # 요일 순서 정렬 (월화수목금토일)
    week_order = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일']
    daily_vol = df.groupby('요일명')['교통량'].mean().reindex(week_order)
    daily_spd = df.groupby('요일명')['평균속도'].mean().reindex(week_order)

    fig, ax1 = plt.subplots(figsize=(10, 6))
    
    # 막대그래프: 교통량
    ax1.bar(week_order, daily_vol, color='skyblue', alpha=0.6, label='교통량')
    ax1.set_ylabel('Traffic Volume (veh/h)', color='blue')
    
    # 꺾은선그래프: 속도 (축을 하나 더 만듦)
    ax2 = ax1.twinx()
    ax2.plot(week_order, daily_spd, color='red', marker='o', linewidth=2, label='속도')
    ax2.set_ylabel('Speed (km/h)', color='red')
    
    plt.title('Weekly Pattern (Traffic vs Speed)')
    plt.savefig(os.path.join(WEB_IMG_DIR, 'weekly_pattern.png'), dpi=100)
    plt.close()
    print("✅ 그래프 저장 완료: weekly_pattern.png")

    # -------------------------------------------------------
    # 4. 교통류 파라미터 계산 (심화 분석용)
    # -------------------------------------------------------
    # 추세선(y = ax + b)에서 파라미터 추출
    # b (y절편) = 자유속도 (차가 없을 때 속도)
    # -b/a (x절편) = 혼잡밀도 (속도가 0이 되는 밀도)
    slope, intercept = z
    
    uf = intercept          # 자유속도 (Free Flow Speed)
    kj = -intercept / slope # 혼잡밀도 (Jam Density)
    q_max = (uf * kj) / 4   # 도로용량 (Capacity, 포물선의 꼭짓점)

    print("\n[🚦 Greenshields 모델 분석 결과]")
    print(f"1. 자유속도(uf): {uf:.1f} km/h (차가 없을 때 예상 속도)")
    print(f"2. 혼잡밀도(kj): {kj:.1f} 대/km (이만큼 차면 멈춤)")
    print(f"3. 도로용량(C) : {q_max:.0f} 대/시 (최대 통행 가능량)")

    # 결과를 파일로 저장 (웹사이트 연동은 안하지만 기록용)
    results = {
        'free_flow_speed': uf,
        'jam_density': kj,
        'capacity': q_max
    }
    with open(os.path.join(WEB_DATA_DIR, 'analysis_result.json'), 'w') as f:
        json.dump(results, f, indent=4)
        print("💾 분석 결과 JSON 저장 완료.")

if __name__ == "__main__":
    run_analysis()
