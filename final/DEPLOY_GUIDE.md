# 🚀 GitHub Pages 배포 가이드

> 이 폴더를 GitHub에 올려서 웹사이트로 만드는 방법

---

## 📁 final 폴더 구조

```
final/
├── index.html                 # 메인 포트폴리오 페이지
│
├── exercise_app/
│   ├── index.html            # 운동 앱 웹페이지
│   ├── style.css
│   ├── app.js
│   ├── plan.py              # 📄 기록용 (Python 원본)
│   ├── USAGE_GUIDE.md
│   └── README.md
│
├── bitcoin/
│   ├── index.html            # 비트코인 예측 웹페이지
│   ├── bitcoin_basic_result.png
│   ├── bitcoin_deep_result.png
│   ├── bitcoin_basic.py     # 📄 기록용
│   ├── bitcoin_deep.py      # 📄 기록용
│   ├── USAGE_GUIDE.md
│   ├── README.md
│   └── README_for_beginners.md
│
└── traffic/
    ├── index.html            # 교통 분석 기본 페이지
    ├── lab.html              # 시뮬레이션 Lab
    ├── *.png                 # 분석 차트 이미지들
    ├── css/style.css
    ├── js/main.js
    ├── js/simulation.js
    ├── src/                  # 📄 기록용 (Python 원본)
    │   ├── 01_data_loader.py
    │   └── 02_analysis.py
    ├── USAGE_GUIDE.md
    └── README.md
```

---

## 📤 GitHub 업로드 방법

### Step 1️⃣ GitHub 레포지토리 생성

1. https://github.com 접속 → 로그인
2. 우측 상단 **+** 버튼 → **New repository**
3. 설정:
   - **Repository name**: `portfolio` (원하는 이름)
   - **Public** 선택 (GitHub Pages는 Public만 무료)
   - "Add a README file" 체크 ❌ (우리가 직접 올릴 거라 체크 안 함)
4. **Create repository** 클릭

---

### Step 2️⃣ 터미널에서 업로드

```bash
# 1. final 폴더로 이동
cd /Users/hong/main/현주/자기관리/final

# 2. Git 초기화
git init

# 3. 모든 파일 추가
git add .

# 4. 첫 커밋
git commit -m "Initial commit: Portfolio website"

# 5. 메인 브랜치 이름 설정
git branch -M main

# 6. GitHub 원격 저장소 연결 (URL은 본인 것으로 변경!)
git remote add origin https://github.com/YOUR_USERNAME/portfolio.git

# 7. 업로드
git push -u origin main
```

> ⚠️ `YOUR_USERNAME`을 본인 GitHub 아이디로 변경하세요!

---

### Step 3️⃣ GitHub Pages 활성화

1. GitHub에서 해당 레포지토리 접속
2. **Settings** 탭 클릭
3. 좌측 메뉴에서 **Pages** 클릭
4. **Source** 섹션:
   - Branch: `main` 선택
   - Folder: `/ (root)` 선택
5. **Save** 클릭

---

### Step 4️⃣ 웹사이트 접속

몇 분 후 다음 URL로 접속 가능:

```
https://YOUR_USERNAME.github.io/portfolio/
```

| 페이지 | URL |
|--------|-----|
| 메인 포트폴리오 | `https://YOUR_USERNAME.github.io/portfolio/` |
| 운동 앱 | `https://YOUR_USERNAME.github.io/portfolio/exercise_app/` |
| 비트코인 예측 | `https://YOUR_USERNAME.github.io/portfolio/bitcoin/` |
| 교통 분석 | `https://YOUR_USERNAME.github.io/portfolio/traffic/` |
| 교통 시뮬레이션 | `https://YOUR_USERNAME.github.io/portfolio/traffic/lab.html` |

---

## 🔄 업데이트할 때

파일을 수정한 후:

```bash
cd /Users/hong/main/현주/자기관리/final

git add .
git commit -m "Update: 변경 내용 설명"
git push
```

---

## ❓ 자주 묻는 질문

### Q1. 페이지가 안 보여요
- GitHub Pages 활성화 후 **2-5분** 정도 기다려야 합니다
- Settings → Pages에서 URL이 표시되는지 확인

### Q2. 404 에러가 나요
- `index.html` 파일이 root에 있는지 확인
- 파일명 대소문자 확인 (GitHub는 대소문자 구분)

### Q3. 이미지가 안 나와요
- 경로가 상대경로인지 확인 (예: `bitcoin_basic_result.png`)
- 파일이 실제로 push 되었는지 확인

### Q4. Python 파일은 실행되나요?
- ❌ GitHub Pages는 **정적 호스팅**입니다
- Python 파일은 웹에서 실행 ❌, 기록/참고용으로만 보관

---

## 📋 파일 용도 구분

| 용도 | 파일 | 웹에서 동작 |
|------|------|:-----------:|
| **웹페이지** | HTML, CSS, JS | ✅ |
| **이미지** | PNG, JPG | ✅ |
| **기록용** | Python (.py) | ❌ (코드 열람만 가능) |
| **문서** | MD (README, USAGE_GUIDE) | ✅ (GitHub에서 렌더링) |

---

*이 가이드는 GitHub Pages 무료 호스팅을 기준으로 작성되었습니다.*
