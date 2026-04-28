# 🕺 Dance Pose App

카메라로 춤 동작을 배우는 웹 앱. 직접 루틴을 만들어 저장하고 따라출 수 있습니다.

## ✨ 기능

### 🎯 싱글 모드
15개 포즈를 하나씩 1초 유지하며 통과

### 💃 연속동작 모드
미리 만들어진 루틴(초보/댄서/프로) + 내가 저장한 루틴

### 🎬 내 루틴 만들기 (신규!)
- 동작 라이브러리(15개)에서 골라서 시퀀스 빌드
- 이름 + 난이도 설정
- 브라우저에 저장 (localStorage)
- 시퀀스 모드에서 바로 플레이 가능
- 🗑 삭제도 가능

### 🎬 미션 미리보기 카운트다운 (신규!)
각 포즈로 넘어갈 때 큰 미션 카드 + **3..2..1..GO!** 카운트다운
→ 자세를 충분히 인지하고 준비할 시간 제공

### 정확도 시스템
- Full 모델 (9MB)
- 5프레임 투표 + 350ms 디바운스 (깜빡임 제거)
- 히스테리시스 임계값 (한번 PASS하면 살짝 흔들려도 유지)
- 어깨폭 정규화 (카메라 거리 무관)

## 🚀 GitHub + Vercel 배포

```bash
git init
git add .
git commit -m "Routine builder + countdown preview"
git remote add origin https://github.com/YOUR_USERNAME/dance-pose-app.git
git push -u origin main
```

Vercel → Import → Deploy.

## 🔧 로컬 테스트

```bash
cd public
python3 -m http.server 3000
```

## 📁 구조

```
dance-app/
├── public/
│   ├── index.html      # 5개 화면 (시작/시퀀스선택/빌더/게임/완료)
│   ├── app.js          # 게임 + 빌더 + localStorage 저장
│   ├── poses.js        # 15개 포즈 + 기본 시퀀스
│   └── styles.css
├── vercel.json
└── package.json
```

## 🎨 사용 흐름

**기본 루틴 즐기기:**
1. 시작 화면에서 **연속동작 모드** 선택
2. Easy/Medium/Hard 중 골라서 플레이

**내 루틴 만들기:**
1. 시작 화면에서 **내 루틴 만들기** 선택
2. 동작 라이브러리에서 동작 클릭하여 시퀀스에 추가
3. 잘못 추가된 동작은 클릭하면 삭제됨
4. 이름 입력 + 난이도 선택 후 **저장**
5. 저장된 루틴은 시퀀스 모드 화면 + 빌더 하단에 노출됨
6. 클릭하면 바로 플레이!

## 💾 저장 위치

브라우저 **localStorage**에 저장됩니다.
- 같은 브라우저 / 같은 도메인에서 영구 보존
- 브라우저 캐시/데이터 삭제하면 사라짐
- 다른 기기에는 동기화되지 않음 (각 브라우저 별도)

## 🛠 기술 스택

- MediaPipe Tasks Vision @0.10.9 (full 모델)
- localStorage (루틴 저장)
- Vanilla JS/HTML/CSS
- Vercel

## 📄 라이선스

MIT
