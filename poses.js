// MediaPipe Pose Landmark 인덱스 참조
// 0: nose, 11: left_shoulder, 12: right_shoulder
// 13: left_elbow, 14: right_elbow
// 15: left_wrist, 16: right_wrist
// 23: left_hip, 24: right_hip
// 25: left_knee, 26: right_knee
// 27: left_ankle, 28: right_ankle

/**
 * 각 포즈는 check(landmarks) 함수를 가짐
 * - landmarks: MediaPipe에서 반환하는 33개 관절 좌표 (정규화된 0~1)
 * - 반환: { pass: boolean, hint: string }
 */

// 두 점 사이의 거리 (2D)
function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// 세 점으로 이루는 각도 (b가 꼭지점, 단위: 도)
function angle(a, b, c) {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAB = Math.hypot(ab.x, ab.y);
  const magCB = Math.hypot(cb.x, cb.y);
  const cos = dot / (magAB * magCB);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

// 전신이 화면에 보이는지 확인
function isBodyVisible(lm) {
  const required = [0, 11, 12, 23, 24]; // 코, 양 어깨, 양 엉덩이
  return required.every((i) => lm[i] && lm[i].visibility > 0.5);
}

export const POSES = [
  {
    id: "hands_up",
    name: "양손 머리 위로",
    emoji: "🙌",
    instruction: "양손을 머리 위로 번쩍 들어올리세요",
    check: (lm) => {
      if (!isBodyVisible(lm)) {
        return { pass: false, hint: "전신이 보이도록 뒤로 물러나세요" };
      }
      const nose = lm[0];
      const leftWrist = lm[15];
      const rightWrist = lm[16];

      // 양 손목이 코보다 위에 있어야 함 (y 값이 작을수록 위)
      const leftUp = leftWrist.y < nose.y;
      const rightUp = rightWrist.y < nose.y;

      if (leftUp && rightUp) {
        return { pass: true, hint: "좋아요! 유지하세요" };
      }
      if (!leftUp && !rightUp) {
        return { pass: false, hint: "양손을 머리 위로 올려주세요" };
      }
      return {
        pass: false,
        hint: leftUp ? "오른손도 올려주세요" : "왼손도 올려주세요"
      };
    }
  },
  {
    id: "t_pose",
    name: "T 포즈",
    emoji: "🤸",
    instruction: "양팔을 좌우로 쭉 뻗어 T자를 만드세요",
    check: (lm) => {
      if (!isBodyVisible(lm)) {
        return { pass: false, hint: "전신이 보이도록 뒤로 물러나세요" };
      }
      const ls = lm[11], rs = lm[12];
      const le = lm[13], re = lm[14];
      const lw = lm[15], rw = lm[16];

      // 손목이 어깨와 비슷한 높이 (y 차이가 작음)
      const shoulderY = (ls.y + rs.y) / 2;
      const leftLevel = Math.abs(lw.y - shoulderY) < 0.08;
      const rightLevel = Math.abs(rw.y - shoulderY) < 0.08;

      // 팔이 쭉 펴져 있어야 함 (어깨-팔꿈치-손목 각도가 160도 이상)
      const leftArmStraight = angle(ls, le, lw) > 155;
      const rightArmStraight = angle(rs, re, rw) > 155;

      if (leftLevel && rightLevel && leftArmStraight && rightArmStraight) {
        return { pass: true, hint: "완벽해요!" };
      }
      if (!leftArmStraight || !rightArmStraight) {
        return { pass: false, hint: "팔을 쭉 펴주세요" };
      }
      return { pass: false, hint: "양팔을 어깨 높이로 수평하게" };
    }
  },
  {
    id: "right_hand_up",
    name: "오른손 번쩍",
    emoji: "✋",
    instruction: "오른손만 머리 위로 올리세요 (왼손은 내리고)",
    check: (lm) => {
      if (!isBodyVisible(lm)) {
        return { pass: false, hint: "전신이 보이도록 뒤로 물러나세요" };
      }
      const nose = lm[0];
      const leftWrist = lm[15];
      const rightWrist = lm[16];
      const leftHip = lm[23];
      const rightHip = lm[24];

      // 주의: 사용자 입장에서 "오른손" = 화면에 보이는 왼쪽 = landmark 16(right_wrist)
      // MediaPipe는 사람 몸 기준이므로 카메라가 거울모드라도 landmark는 사람 기준
      const userRightWristUp = rightWrist.y < nose.y;
      const userLeftWristDown = leftWrist.y > leftHip.y - 0.1;

      if (userRightWristUp && userLeftWristDown) {
        return { pass: true, hint: "좋아요!" };
      }
      if (!userRightWristUp) {
        return { pass: false, hint: "오른손을 더 높이 올려주세요" };
      }
      return { pass: false, hint: "왼손은 내려주세요" };
    }
  },
  {
    id: "squat",
    name: "스쿼트 자세",
    emoji: "🦵",
    instruction: "무릎을 굽혀 살짝 앉으세요",
    check: (lm) => {
      if (!isBodyVisible(lm)) {
        return { pass: false, hint: "전신이 보이도록 뒤로 물러나세요" };
      }
      const lh = lm[23], rh = lm[24];
      const lk = lm[25], rk = lm[26];
      const la = lm[27], ra = lm[28];

      if (!la || !ra || la.visibility < 0.4 || ra.visibility < 0.4) {
        return { pass: false, hint: "발목까지 전부 화면에 나오게 해주세요" };
      }

      // 무릎 각도가 굽혀져야 함 (170도 -> 서있음, 90도 -> 완전 앉음)
      const leftKneeAngle = angle(lh, lk, la);
      const rightKneeAngle = angle(rh, rk, ra);
      const avgKneeAngle = (leftKneeAngle + rightKneeAngle) / 2;

      if (avgKneeAngle < 150 && avgKneeAngle > 70) {
        return { pass: true, hint: "좋은 자세예요!" };
      }
      if (avgKneeAngle >= 150) {
        return { pass: false, hint: "무릎을 더 굽혀주세요" };
      }
      return { pass: false, hint: "조금만 일어서주세요" };
    }
  }
];
