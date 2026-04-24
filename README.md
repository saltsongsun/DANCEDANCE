# 🕺 Dance Pose App

카메라로 춤 동작을 배우는 웹 앱. 싱글 모드(15개 포즈) + 연속동작 모드(시퀀스)를 제공합니다.

## ✨ 기능

### 🎯 싱글 모드
15개 포즈를 하나씩 1초 유지하며 통과

### 💃 연속동작 모드
짧은 루틴을 박자에 맞춰 연속으로 따라하기
- **초보 웨이브** 🌊 — 4동작, 3초/스텝
- **댄서 콤보** 💃 — 6동작, 2.5초/스텝
- **프로 루틴** 🔥 — 8동작, 2초/스텝
- 연속 성공 시 **콤보 시스템** (점수 보너스)
- 제한시간 내 못 맞추면 Miss

### 기타
- 🙌 **준비 단계** — 양손을 머리 위로 올리면 게임 시작
- 📱 **큰 미션 카드** — 화면 상단에 이모지 + 설명 크게 표시
- 🎬 **시퀀스 미리보기** — 전체 루틴을 점으로 표시 (현재 스텝 강조)
- 🐛 **디버그 패널** (우측 하단 토글 버튼)
- 📱 모바일/데스크탑 모두 지원

## 🚀 GitHub + Vercel 배포

### 1. GitHub
```bash
git init
git add .
git commit -m "Dance app with sequence mode"
git remote add origin https://github.com/YOUR_USERNAME/dance-pose-app.git
git branch -M main
git push -u origin main
```

### 2. Vercel
1. [vercel.com](https://vercel.com) → GitHub 로그인
2. **Add New → Project** → 저장소 선택 → Import
3. 설정 그대로 **Deploy** 클릭
4. 1분 내 `https://your-project.vercel.app` 발급

## 🔧 로컬 테스트

```bash
cd public
python3 -m http.server 3000
```

`http://localhost:3000` 접속.

## 📁 구조

```
dance-app/
├── public/
│   ├── index.html      # 4개 화면 (시작/시퀀스선택/게임/완료)
│   ├── app.js          # 싱글 + 시퀀스 모드 통합 로직
│   ├── poses.js        # POSE_LIBRARY + SEQUENCES 정의
│   └── styles.css
├── vercel.json
├── package.json
└── README.md
```

## 🎨 나만의 시퀀스 추가

`public/poses.js`의 `SEQUENCES`에 추가:

```javascript
{
  id: "my_routine",
  name: "내 루틴 ⭐",
  description: "5동작 · 커스텀",
  difficulty: "Medium",
  stepHoldMs: 350,      // 포즈 유지 시간 (ms)
  stepWindowMs: 2500,   // 스텝당 제한시간 (ms)
  steps: [              // POSE_LIBRARY의 id 배열
    "both_hands_up",
    "t_pose",
    "left_hand_up",
    "right_hand_up",
    "finale"
  ]
}
```

## 🎨 새로운 포즈 추가

`POSE_LIBRARY`에 추가 후 `POSES` 배열이나 시퀀스 `steps`에서 id로 참조:

```javascript
POSE_LIBRARY.my_pose = {
  id: "my_pose",
  name: "내 포즈",
  emoji: "💃",
  instruction: "이런 자세를 취하세요",
  check: (lm) => {
    // 조건 검사
    return { pass: true/false, hint: "피드백", debug: "디버그 정보" };
  }
};
```

랜드마크: `0` 코, `11/12` 어깨, `13/14` 팔꿈치, `15/16` 손목, `23/24` 엉덩이, `25/26` 무릎

## 🛠 기술 스택

- **MediaPipe Tasks Vision** @0.10.9
- **바닐라 JS** (프레임워크 없음)
- **Vercel** 정적 호스팅

## 📄 라이선스

MIT
