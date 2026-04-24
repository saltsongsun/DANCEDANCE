# 🕺 Dance Pose App

카메라로 춤 동작을 배우는 웹 앱. MediaPipe Pose로 실시간 동작 인식을 하고, 정해진 포즈를 취하면 다음 단계로 넘어갑니다.

## ✨ 기능

- 📷 브라우저 카메라로 실시간 포즈 감지
- 🎯 4가지 기본 포즈 (양손 올리기, T포즈, 오른손 들기, 스쿼트)
- ⏱️ 1.5초 유지 시 자동 통과
- 📱 모바일/데스크탑 모두 지원

## 🚀 GitHub + Vercel 배포

### 1. GitHub 저장소 만들기

```bash
# 이 폴더에서
git init
git add .
git commit -m "Initial commit"

# GitHub에서 새 저장소 생성 후
git remote add origin https://github.com/YOUR_USERNAME/dance-pose-app.git
git branch -M main
git push -u origin main
```

### 2. Vercel에 배포

**방법 A - Vercel 웹사이트 (가장 쉬움)**

1. [vercel.com](https://vercel.com) 접속 → GitHub로 로그인
2. "Add New" → "Project" 클릭
3. 방금 만든 GitHub 저장소 선택 → "Import"
4. **설정은 아무것도 바꾸지 말고** 바로 "Deploy" 클릭
5. 1분 내 배포 완료 → `https://your-project.vercel.app` URL 제공

**방법 B - Vercel CLI**

```bash
npm install -g vercel
vercel
```

## 🔧 로컬 테스트

카메라 API는 HTTPS 또는 localhost에서만 동작합니다.

```bash
# Python이 있으면
cd public
python3 -m http.server 3000

# 또는 npx로
npx serve public -p 3000
```

브라우저에서 `http://localhost:3000` 접속.

## 📁 프로젝트 구조

```
dance-app/
├── public/
│   ├── index.html      # 메인 HTML
│   ├── app.js          # 앱 로직 (MediaPipe + 포즈 매칭)
│   ├── poses.js        # 포즈 정의
│   └── styles.css      # 스타일
├── vercel.json         # Vercel 배포 설정
├── package.json
└── README.md
```

## 🎨 포즈 추가 방법

`public/poses.js`의 `POSES` 배열에 객체를 추가하면 됩니다:

```javascript
{
  id: "my_pose",
  name: "내 포즈",
  emoji: "💃",
  instruction: "이런 자세를 취하세요",
  check: (lm) => {
    // lm[N].x, lm[N].y 로 좌표 접근
    // 조건 검사 후
    return { pass: true/false, hint: "피드백 메시지" };
  }
}
```

MediaPipe Pose 랜드마크 인덱스:
- `0` 코, `11/12` 왼/오른 어깨, `13/14` 팔꿈치
- `15/16` 손목, `23/24` 엉덩이, `25/26` 무릎, `27/28` 발목

## 🛠 기술 스택

- **MediaPipe Tasks Vision** - 브라우저 포즈 감지
- **바닐라 JS/HTML/CSS** - 프레임워크 없이 가볍게
- **Vercel** - 정적 사이트 호스팅

## 📄 라이선스

MIT
