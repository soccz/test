# -*- coding: utf-8 -*-
"""
01_data_loader.py
=================
[기능]
한국도로공사 VDS(차량검지시스템) 원본 데이터를 불러와서 우리가 필요한 형태로 정리하는 코드입니다.

[수행 과정]
1. 여러 개의 csv 파일을 하나로 합칩니다. (7일치 데이터)
2. 분석 대상인 4개 JC(안현, 일직, 조남, 도리)만 남기고 나머지는 지웁니다.
3. 오류 데이터(속도 0 이하 등)를 제거합니다.
4. 분석하기 좋게 '밀도(Density)' 같은 값을 미리 계산해둡니다.
"""

import pandas as pd
import glob
import os

# -----------------------------------------------------------------------------
# 1. 설정 (Settings)
# -----------------------------------------------------------------------------
# 데이터가 있는 폴더 위치
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DATA_DIR = os.path.join(BASE_DIR, 'VDS_*')  # VDS_로 시작하는 모든 폴더
OUTPUT_PATH = os.path.join(BASE_DIR, 'data', 'processed', 'jc_filtered_data.csv')

# 분석하고 싶은 고속도로 분기점(JC) 목록
TARGET_NODES = ['안현JC', '일직JC', '조남JC', '도리JC']

def load_and_process():
    """
    데이터를 로드하고 전처리하는 메인 함수
    """
    print("🚀 데이터 전처리를 시작합니다...")

    # 1. 파일 찾기
    all_files = glob.glob(os.path.join(RAW_DATA_DIR, "*"))
    print(f"📄 발견된 데이터 파일 개수: {len(all_files)}개")

    merged_df = pd.DataFrame() # 빈 데이터프레임 생성

    for file in all_files:
        try:
            # CSV 파일 읽기 (인코딩: euc-kr)
            # thousands=',' : "1,200" 같은 숫자의 쉼표를 제거하고 숫자로 인식
            df = pd.read_csv(file, encoding='euc-kr', sep=',', thousands=',')
            
            # 필요한 컬럼만 선택 (메모리 절약)
            # 기준시간, 날짜, 요일, JC이름, 교통량, 속도
            cols = ['기준시간', '기준일', '요일명', '노드명', '교통량', '평균속도']
            # 실제 파일에 '평균속도'라는 컬럼이 있는지 확인 후 선택
            available_cols = [c for c in cols if c in df.columns]
            df = df[available_cols]
            
            merged_df = pd.concat([merged_df, df])
        
        except Exception as e:
            print(f"⚠️ 파일 읽기 오류 ({os.path.basename(file)}): {e}")

    print(f"📥 1차 병합 완료: 총 {len(merged_df):,}개 행")

    # 2. 데이터 필터링 (청소하기)
    # (1) 우리가 원하는 JC만 남기기
    df_filtered = merged_df[merged_df['노드명'].isin(TARGET_NODES)].copy()
    
    # (2) 이상한 데이터 지우기
    # 교통량이 0 이하이거나, 속도가 0 이하인 데이터는 측정 오류일 가능성이 높음
    df_filtered = df_filtered[
        (df_filtered['교통량'] > 0) & 
        (df_filtered['평균속도'] > 0)
    ]
    
    # (3) 데이터 타입 정리 (숫자로 변환)
    df_filtered['교통량'] = pd.to_numeric(df_filtered['교통량'])
    df_filtered['평균속도'] = pd.to_numeric(df_filtered['평균속도'])

    # 3. 추가 변수 만들기
    # 밀도(Density) = 교통량(Q) / 속도(V)
    # 의미: 1km 구간 안에 차가 몇 대나 있는가? (단위: 대/km)
    df_filtered['밀도'] = df_filtered['교통량'] / df_filtered['평균속도']

    # 4. 저장하기
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    df_filtered.to_csv(OUTPUT_PATH, index=False, encoding='utf-8-sig')
    
    print("-" * 50)
    print(f"✅ 전처리 완료!")
    print(f"💾 저장 위치: {OUTPUT_PATH}")
    print(f"📊 최종 데이터 개수: {len(df_filtered):,}개")
    print("-" * 50)

if __name__ == "__main__":
    load_and_process()
