# 🕺 Dance Pose App

카메라로 15가지 춤 동작을 배우는 웹 앱. MediaPipe Pose로 실시간 동작을 인식하고, 포즈를 1초간 유지하면 다음 단계로 넘어갑니다.

## ✨ 기능

- 📷 브라우저 카메라로 실시간 포즈 감지
- 🙌 **준비 단계** - 양손을 머리 위로 올리면 게임 시작
- 🎯 **15개 포즈** (점진적 난이도)
  1. 양손 번쩍
  2. T 포즈
  3. 왼손 번쩍
  4. 오른손 번쩍
  5. 팔짱 끼기
  6. 왼팔 옆으로
  7. 오른팔 옆으로
  8. 왼손 위 + 오른손 옆
  9. 오른손 위 + 왼손 옆
  10. 머리 위 손
  11. 오른손 → 왼쪽 어깨
  12. 왼손 → 오른쪽 어깨
  13. Y 포즈
  14. 왼팔 L자 (알통)
  15. 피날레 (Y 자세)
- 🐛 디버그 패널 (실시간 좌표/판정 확인)
- 📱 모바일/데스크탑 모두 지원

## 🚀 GitHub + Vercel 배포

### 1. GitHub 저장소 만들기

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/dance-pose-app.git
git branch -M main
git push -u origin main
```

### 2. Vercel 배포

1. [vercel.com](https://vercel.com) → GitHub 로그인
2. **Add New → Project** → GitHub 저장소 선택 → Import
3. 설정 그대로 두고 **Deploy** 클릭
4. `https://your-project.vercel.app` 주소 발급

## 🔧 로컬 테스트

```bash
cd public
python3 -m http.server 3000
# 또는
npx serve public -p 3000
```

`http://localhost:3000` 접속.

## 📁 프로젝트 구조

```
dance-app/
├── public/
│   ├── index.html      # 메인 HTML (시작/게임/완료 3개 화면)
│   ├── app.js          # 앱 로직 - 준비 단계 + 본게임
│   ├── poses.js        # 포즈 15개 + 준비 포즈 정의
│   └── styles.css      # 스타일
├── vercel.json         # Vercel 배포 설정
├── package.json
└── README.md
```

## 🎨 포즈 추가/수정

`public/poses.js`의 `POSES` 배열을 편집하세요:

```javascript
{
  id: "my_pose",
  name: "내 포즈",
  emoji: "💃",
  instruction: "이런 자세를 취하세요",
  check: (lm) => {
    // lm[N].x, lm[N].y 로 좌표 접근 (0~1 정규화)
    return { 
      pass: true/false, 
      hint: "피드백 메시지",
      debug: "디버그 정보"  // 디버그 패널에 표시됨
    };
  }
}
```

주요 랜드마크 인덱스:
- `0` 코
- `11` 왼어깨, `12` 오른어깨
- `13` 왼팔꿈치, `14` 오른팔꿈치
- `15` 왼손목, `16` 오른손목
- `23/24` 엉덩이, `25/26` 무릎, `27/28` 발목

⚠️ MediaPipe는 **사람 몸 기준**이므로 `lm[15]`(left_wrist)는 사람의 왼손목입니다. 화면 거울모드와는 무관.

## 🛠 기술 스택

- **MediaPipe Tasks Vision** (@0.10.9) - 브라우저 포즈 감지
- **바닐라 JS/HTML/CSS** - 프레임워크 없이 가볍게
- **Vercel** - 정적 사이트 호스팅

## 📄 라이선스

MIT
