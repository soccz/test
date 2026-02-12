"""
exercise_app: 운동 기록 관리 + 점진적 과부하 + 회복 감지 + 추천 + 스케줄 최적화 + 시각화
사용: python main.py
필요한 패키지: pandas, matplotlib, numpy
"""

import json
import csv
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
import matplotlib.pyplot as plt
import numpy as np


# ===============================
# 경로 설정
# ===============================
BASE = Path(".").resolve() / "exercise_app"
BASE.mkdir(parents=True, exist_ok=True)

ROUTINES_FILE = BASE / "routines.json"
RECORDS_FILE = BASE / "records.csv"


# ===============================
# 파일 입출력
# ===============================
def load_routines():
    if not ROUTINES_FILE.exists():
        sample = {
            "squat": {"days": ["Mon", "Wed", "Fri"], "reps": 20, "intensity": 3, "type": "lower"},
            "pushup": {"days": ["Tue", "Thu"], "reps": 15, "intensity": 2, "type": "upper"},
            "plank": {"days": ["Mon", "Thu"], "reps": 60, "intensity": 2, "type": "core", "unit": "sec"},
            "lunge": {"days": ["Wed", "Sat"], "reps": 12, "intensity": 3, "type": "lower"},
            "stretch": {"days": ["Sun"], "reps": 10, "intensity": 1, "type": "mobility"}
        }
        with open(ROUTINES_FILE, "w", encoding="utf-8") as f:
            json.dump(sample, f, ensure_ascii=False, indent=2)

    with open(ROUTINES_FILE, encoding="utf-8") as f:
        return json.load(f)


def load_records():
    if not RECORDS_FILE.exists():
        return pd.DataFrame(
            columns=["date", "exercise", "target", "unit", "intensity", "done", "RPE", "hour"]
        )
    return pd.read_csv(RECORDS_FILE, parse_dates=["date"])


def save_record_row(row: dict):
    write_header = not RECORDS_FILE.exists()
    with open(RECORDS_FILE, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["date", "exercise", "target", "unit", "intensity", "done", "RPE", "hour"]
        )
        if write_header:
            writer.writeheader()
        writer.writerow(row)


# ===============================
# 오늘 루틴 생성
# ===============================
def get_today_routine(routines, date=None):
    if date is None:
        date = datetime.now()
    weekday = date.strftime("%a")  # Mon, Tue ...
    return {ex: v for ex, v in routines.items() if weekday in v["days"]}


# ===============================
# 회복 필요 판단
# ===============================
def need_recovery(df: pd.DataFrame):
    reasons = []
    if df.empty:
        return False, reasons

    recent = df.tail(14)

    # Condition A: 최근 RPE 평균
    rpe_vals = recent["RPE"].dropna()
    if len(rpe_vals) >= 3 and rpe_vals.mean() >= 8:
        reasons.append("최근 RPE 평균이 높아 과부하 가능성이 있습니다.")

    # Condition B: 3일 연속 운동
    done_dates = (
        pd.to_datetime(df[df["done"] == "Y"]["date"])
        .drop_duplicates()
        .sort_values()
    )

    if len(done_dates) >= 3:
        streak = 1
        for i in range(1, len(done_dates)):
            if (done_dates.iloc[i] - done_dates.iloc[i - 1]).days == 1:
                streak += 1
                if streak >= 3:
                    reasons.append("3일 이상 연속 운동하여 회복이 필요할 수 있습니다.")
                    break
            else:
                streak = 1

    # Condition C: 최근 수행 실패
    last5 = df.tail(5)
    if (last5["done"] == "N").sum() >= 3:
        reasons.append("최근 수행률이 하락하여 회복이 필요할 수 있습니다.")

    return len(reasons) > 0, reasons


# ===============================
# 추천 시스템 (rule-based)
# ===============================
def recommend_exercise(df: pd.DataFrame, routines: dict):
    recs = []

    if df.empty or df[df["done"] == "Y"].empty:
        recs.append("초기 추천: 스트레치, 푸시업, 플랭크 (균형 루틴)")
        return recs

    counts = df[df["done"] == "Y"]["exercise"].value_counts()

    lower = sum(counts.get(ex, 0) for ex, info in routines.items() if info.get("type") == "lower")
    upper = sum(counts.get(ex, 0) for ex, info in routines.items() if info.get("type") == "upper")

    if upper < lower * 0.6:
        recs.append("상체 운동 비중이 낮습니다. 푸시업/풀업 추가 권장.")

    if not counts.empty and counts.max() > max(3, int(counts.mean() * 2)):
        most = counts.idxmax()
        recs.append(f"{most} 비중이 높음 → 유사 대체 운동 추가 권장.")

    recent_rpe = df["RPE"].dropna().tail(5)
    if len(recent_rpe) > 0 and recent_rpe.mean() >= 8:
        recs.append("최근 RPE가 높습니다. 저강도(스트레치/가벼운 코어) 권장.")

    return recs


# ===============================
# 스케줄 최적화
# ===============================
def optimize_schedule(df: pd.DataFrame, routines: dict):
    if df.empty:
        return ["데이터 부족: 스케줄 최적화 불가"]

    df = df.copy()
    df["weekday"] = df["date"].dt.weekday

    perf = df.groupby("weekday")["done"].apply(lambda x: (x == "Y").mean())
    day_names = ["월", "화", "수", "목", "금", "토", "일"]

    suggestions = []
    low_days = perf[perf < 0.5]
    for d in low_days.index:
        suggestions.append(f"{day_names[d]}요일 수행률 낮음 → 루틴 강도 완화 권장.")

    if "hour" in df.columns:
        time_perf = df.groupby("hour")["done"].apply(lambda x: (x == "Y").mean())
        if not time_perf.empty:
            best = int(time_perf.idxmax())
            suggestions.append(f"가장 효율적 시간대: {best}시 → 해당 시간에 루틴 배치 권장.")
    else:
        suggestions.append("시간(hour) 데이터 없음 → 시간 최적화 제한.")

    return suggestions


# ===============================
# 시각화
# ===============================
def plot_weekday_heatmap(df, save_path):
    if df.empty:
        return

    df2 = df.copy()
    df2["weekday"] = df2["date"].dt.weekday
    pivot = (
        df2.groupby(["exercise", "weekday"])["done"]
        .apply(lambda x: (x == "Y").mean())
        .unstack(fill_value=0)
    )

    plt.figure(figsize=(8, max(2, 0.4 * len(pivot))))
    plt.imshow(pivot.values, aspect="auto", interpolation="nearest")
    plt.yticks(range(len(pivot.index)), pivot.index)
    plt.xticks(range(7), ["월", "화", "수", "목", "금", "토", "일"])
    plt.title("요일별 수행률 Heatmap")
    plt.colorbar()
    plt.tight_layout()
    plt.savefig(save_path)
    plt.close()


def plot_intensity_trend(df, save_path):
    if df.empty:
        return

    df2 = df.copy()
    df2["month"] = df2["date"].dt.to_period("M")
    monthly = df2.groupby("month")["intensity"].mean()

    plt.figure(figsize=(8, 3))
    plt.plot(monthly.index.astype(str), monthly.values, marker="o")
    plt.xlabel("Month")
    plt.ylabel("평균 강도")
    plt.title("월별 평균 강도 변화")
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.savefig(save_path)
    plt.close()


def plot_stacked_volume(df, save_path):
    if df.empty:
        return

    df2 = df.copy()
    df2["month"] = df2["date"].dt.to_period("M")
    agg = (
        df2[df2["done"] == "Y"]
        .groupby(["month", "exercise"])
        .size()
        .unstack(fill_value=0)
    )

    months = agg.index.astype(str)
    bottom = np.zeros(len(agg))

    plt.figure(figsize=(10, 4))
    for ex in agg.columns:
        vals = agg[ex].values
        plt.bar(months, vals, bottom=bottom, label=ex)
        bottom += vals

    plt.legend(bbox_to_anchor=(1.01, 1), loc="upper left")
    plt.xlabel("Month")
    plt.ylabel("완료 횟수 (누적)")
    plt.title("월별 운동별 누적 완료 횟수")
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.savefig(save_path)
    plt.close()


def plot_monthly_adherence(df, save_path):
    if df.empty:
        return

    df2 = df.copy()
    df2["month"] = df2["date"].dt.to_period("M")
    adherence = df2.groupby("month")["done"].apply(lambda x: (x == "Y").mean())

    plt.figure(figsize=(8, 3))
    plt.plot(adherence.index.astype(str), adherence.values, marker="o")
    plt.xlabel("Month")
    plt.ylabel("수행률")
    plt.ylim(0, 1)
    plt.title("월간 수행률 추이")
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.savefig(save_path)
    plt.close()


# ===============================
# 데모 실행
# ===============================
def demo():
    routines = load_routines()
    df = load_records()

    if not df.empty:
        df["date"] = pd.to_datetime(df["date"])

    print("=== 오늘 루틴 ===")
    today = get_today_routine(routines)
    for i, (ex, info) in enumerate(today.items(), 1):
        unit = info.get("unit", "회")
        print(f"{i}. {ex}: {info.get('reps')} {unit} (강도 {info.get('intensity')})")

    need, reasons = need_recovery(df)
    print("\n=== 회복 판단 ===")
    if need:
        for r in reasons:
            print("- " + r)
    else:
        print("현재 회복 필요성 낮음.")

    print("\n=== 추천 ===")
    for r in recommend_exercise(df, routines):
        print("- " + r)

    print("\n=== 스케줄 최적화 제안 ===")
    for s in optimize_schedule(df, routines):
        print("- " + s)

    plot_weekday_heatmap(df, BASE / "weekday_heatmap.png")
    plot_intensity_trend(df, BASE / "intensity_trend.png")
    plot_stacked_volume(df, BASE / "stacked_volume.png")
    plot_monthly_adherence(df, BASE / "monthly_adherence.png")

    print("\n그래프가 exercise_app/ 폴더에 생성되었습니다.")


if __name__ == "__main__":
    demo()