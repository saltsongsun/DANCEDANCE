// MediaPipe Pose Landmark 인덱스
// 0: nose, 7/8: 귀(좌/우)
// 11/12: 어깨, 13/14: 팔꿈치, 15/16: 손목
// 23/24: 엉덩이, 25/26: 무릎, 27/28: 발목

function angle(a, b, c) {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAB = Math.hypot(ab.x, ab.y);
  const magCB = Math.hypot(cb.x, cb.y);
  if (magAB === 0 || magCB === 0) return 0;
  const cos = dot / (magAB * magCB);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function vis(lm, i) {
  return lm[i] ? (lm[i].visibility ?? 1) : 0;
}

// 상체 기본 가시성 체크
function upperVisible(lm) {
  return [0, 11, 12, 15, 16].every((i) => vis(lm, i) > 0.3);
}

// ============ 준비 포즈 (시작 트리거) ============
export const READY_POSE = {
  id: "ready",
  name: "준비 포즈",
  emoji: "🙌",
  instruction: "양손을 머리 위로 올려 시작!",
  check: (lm) => {
    if (!upperVisible(lm)) {
      return { pass: false, hint: "카메라 앞에 서주세요", debug: "상체 가시성 부족" };
    }
    const nose = lm[0];
    const lw = lm[15];
    const rw = lm[16];
    const margin = 0.05;
    const leftUp = lw.y < nose.y + margin;
    const rightUp = rw.y < nose.y + margin;
    const debug = `코y=${nose.y.toFixed(2)} L=${lw.y.toFixed(2)} R=${rw.y.toFixed(2)}`;
    if (leftUp && rightUp) return { pass: true, hint: "좋아요! 시작합니다", debug };
    return { pass: false, hint: "양손을 머리 위로 올리면 시작!", debug };
  }
};

// ============ 본게임 15개 포즈 ============
export const POSES = [
  // --- 1단계: 쉬운 상체 동작 ---
  {
    id: "both_hands_up",
    name: "양손 번쩍",
    emoji: "🙌",
    instruction: "양손을 머리 위로 번쩍!",
    check: (lm) => {
      if (!upperVisible(lm)) return { pass: false, hint: "상체가 보이도록", debug: "" };
      const nose = lm[0], lw = lm[15], rw = lm[16];
      const leftUp = lw.y < nose.y + 0.05;
      const rightUp = rw.y < nose.y + 0.05;
      const debug = `코=${nose.y.toFixed(2)} L=${lw.y.toFixed(2)} R=${rw.y.toFixed(2)}`;
      if (leftUp && rightUp) return { pass: true, hint: "완벽!", debug };
      return { pass: false, hint: "양손 더 높이!", debug };
    }
  },
  {
    id: "t_pose",
    name: "T 포즈",
    emoji: "🤸",
    instruction: "양팔을 좌우로 쭉! T자",
    check: (lm) => {
      if (!upperVisible(lm)) return { pass: false, hint: "상체가 보이도록", debug: "" };
      const ls = lm[11], rs = lm[12], le = lm[13], re = lm[14], lw = lm[15], rw = lm[16];
      const shoulderY = (ls.y + rs.y) / 2;
      const leftLevel = Math.abs(lw.y - shoulderY) < 0.15;
      const rightLevel = Math.abs(rw.y - shoulderY) < 0.15;
      const leftArm = angle(ls, le, lw);
      const rightArm = angle(rs, re, rw);
      const debug = `Larm=${leftArm.toFixed(0)}° Rarm=${rightArm.toFixed(0)}°`;
      if (leftLevel && rightLevel && leftArm > 140 && rightArm > 140) {
        return { pass: true, hint: "완벽한 T!", debug };
      }
      if (leftArm < 140 || rightArm < 140) return { pass: false, hint: "팔을 쭉 펴주세요", debug };
      return { pass: false, hint: "어깨 높이로 수평", debug };
    }
  },
  {
    id: "left_hand_up",
    name: "왼손 번쩍",
    emoji: "👈",
    instruction: "왼손만 머리 위로! (오른손은 내리고)",
    check: (lm) => {
      if (!upperVisible(lm)) return { pass: false, hint: "상체가 보이도록", debug: "" };
      const nose = lm[0], lw = lm[15], rw = lm[16], ls = lm[11], rs = lm[12];
      // MediaPipe는 사람 몸 기준 - lm[15]=사람의 왼손목
      const leftUp = lw.y < nose.y + 0.05;
      const rightDown = rw.y > rs.y + 0.05;
      const debug = `L손목=${lw.y.toFixed(2)} R손목=${rw.y.toFixed(2)}`;
      if (leftUp && rightDown) return { pass: true, hint: "좋아요!", debug };
      if (!leftUp) return { pass: false, hint: "왼손을 올려주세요", debug };
      return { pass: false, hint: "오른손은 내려주세요", debug };
    }
  },
  {
    id: "right_hand_up",
    name: "오른손 번쩍",
    emoji: "👉",
    instruction: "오른손만 머리 위로! (왼손은 내리고)",
    check: (lm) => {
      if (!upperVisible(lm)) return { pass: false, hint: "상체가 보이도록", debug: "" };
      const nose = lm[0], lw = lm[15], rw = lm[16], ls = lm[11];
      const rightUp = rw.y < nose.y + 0.05;
      const leftDown = lw.y > ls.y + 0.05;
      const debug = `L손목=${lw.y.toFixed(2)} R손목=${rw.y.toFixed(2)}`;
      if (rightUp && leftDown) return { pass: true, hint: "좋아요!", debug };
      if (!rightUp) return { pass: false, hint: "오른손을 올려주세요", debug };
      return { pass: false, hint: "왼손은 내려주세요", debug };
    }
  },
  {
    id: "arms_cross",
    name: "팔짱 끼기",
    emoji: "🫂",
    instruction: "가슴 앞에서 양손을 모아주세요",
    check: (lm) => {
      if (!upperVisible(lm)) return { pass: false, hint: "상체가 보이도록", debug: "" };
      const ls = lm[11], rs = lm[12], lw = lm[15], rw = lm[16];
      const wristsDist = dist(lw, rw);
      const chestY = (ls.y + rs.y) / 2 + 0.1;
      const atChest = Math.abs(lw.y - chestY) < 0.25 && Math.abs(rw.y - chestY) < 0.25;
      const debug = `손목거리=${wristsDist.toFixed(2)} 가슴y=${chestY.toFixed(2)}`;
      if (wristsDist < 0.35 && atChest) return { pass: true, hint: "좋아요!", debug };
      if (!atChest) return { pass: false, hint: "가슴 높이로", debug };
      return { pass: false, hint: "양손을 가까이", debug };
    }
  },

  // --- 2단계: 한쪽 팔 응용 ---
  {
    id: "left_arm_side",
    name: "왼팔 옆으로",
    emoji: "⬅️",
    instruction: "왼팔만 옆으로 쭉! (오른팔은 내리고)",
    check: (lm) => {
      if (!upperVisible(lm)) return { pass: false, hint: "상체가 보이도록", debug: "" };
      const ls = lm[11], le = lm[13], lw = lm[15], rs = lm[12], rw = lm[16];
      const leftArm = angle(ls, le, lw);
      const leftLevel = Math.abs(lw.y - ls.y) < 0.15;
      const rightDown = rw.y > rs.y + 0.1;
      const debug = `Larm=${leftArm.toFixed(0)}° L높이차=${(lw.y - ls.y).toFixed(2)}`;
      if (leftArm > 140 && leftLevel && rightDown) {
        return { pass: true, hint: "좋아요!", debug };
      }
      if (leftArm < 140) return { pass: false, hint: "왼팔을 쭉 펴주세요", debug };
      if (!leftLevel) return { pass: false, hint: "왼팔을 어깨 높이로", debug };
      return { pass: false, hint: "오른팔은 내려주세요", debug };
    }
  },
  {
    id: "right_arm_side",
    name: "오른팔 옆으로",
    emoji: "➡️",
    instruction: "오른팔만 옆으로 쭉! (왼팔은 내리고)",
    check: (lm) => {
      if (!upperVisible(lm)) return { pass: false, hint: "상체가 보이도록", debug: "" };
      const ls = lm[11], rs = lm[12], re = lm[14], rw = lm[16], lw = lm[15];
      const rightArm = angle(rs, re, rw);
      const rightLevel = Math.abs(rw.y - rs.y) < 0.15;
      const leftDown = lw.y > ls.y + 0.1;
      const debug = `Rarm=${rightArm.toFixed(0)}° R높이차=${(rw.y - rs.y).toFixed(2)}`;
      if (rightArm > 140 && rightLevel && leftDown) {
        return { pass: true, hint: "좋아요!", debug };
      }
      if (rightArm < 140) return { pass: false, hint: "오른팔을 쭉 펴주세요", debug };
      if (!rightLevel) return { pass: false, hint: "오른팔을 어깨 높이로", debug };
      return { pass: false, hint: "왼팔은 내려주세요", debug };
    }
  },

  // --- 3단계: 한쪽 위 + 한쪽 아래 ---
  {
    id: "left_up_right_side",
    name: "왼손 위 + 오른손 옆",
    emoji: "🙋",
    instruction: "왼손은 위로, 오른팔은 옆으로",
    check: (lm) => {
      if (!upperVisible(lm)) return { pass: false, hint: "상체가 보이도록", debug: "" };
      const nose = lm[0], lw = lm[15], rw = lm[16], rs = lm[12], re = lm[14];
      const leftUp = lw.y < nose.y + 0.05;
      const rightArm = angle(rs, re, rw);
      const rightLevel = Math.abs(rw.y - rs.y) < 0.2;
      const debug = `L=${lw.y.toFixed(2)} Rarm=${rightArm.toFixed(0)}°`;
      if (leftUp && rightArm > 140 && rightLevel) {
        return { pass: true, hint: "좋아요!", debug };
      }
      if (!leftUp) return { pass: false, hint: "왼손을 더 위로", debug };
      if (rightArm < 140) return { pass: false, hint: "오른팔을 펴서 옆으로", debug };
      return { pass: false, hint: "오른팔을 어깨 높이로", debug };
    }
  },
  {
    id: "right_up_left_side",
    name: "오른손 위 + 왼손 옆",
    emoji: "🙋‍♂️",
    instruction: "오른손은 위로, 왼팔은 옆으로",
    check: (lm) => {
      if (!upperVisible(lm)) return { pass: false, hint: "상체가 보이도록", debug: "" };
      const nose = lm[0], lw = lm[15], rw = lm[16], ls = lm[11], le = lm[13];
      const rightUp = rw.y < nose.y + 0.05;
      const leftArm = angle(ls, le, lw);
      const leftLevel = Math.abs(lw.y - ls.y) < 0.2;
      const debug = `R=${rw.y.toFixed(2)} Larm=${leftArm.toFixed(0)}°`;
      if (rightUp && leftArm > 140 && leftLevel) {
        return { pass: true, hint: "좋아요!", debug };
      }
      if (!rightUp) return { pass: false, hint: "오른손을 더 위로", debug };
      if (leftArm < 140) return { pass: false, hint: "왼팔을 펴서 옆으로", debug };
      return { pass: false, hint: "왼팔을 어깨 높이로", debug };
    }
  },

  // --- 4단계: 머리/몸쪽 동작 ---
  {
    id: "hands_on_head",
    name: "머리 위 손",
    emoji: "💁",
    instruction: "양손을 머리 위에 살짝 올려놓기",
    check: (lm) => {
      if (!upperVisible(lm)) return { pass: false, hint: "상체가 보이도록", debug: "" };
      const nose = lm[0], lw = lm[15], rw = lm[16];
      // 귀보다 위, 그리고 서로 가까운 위치
      const leftUp = lw.y < nose.y;
      const rightUp = rw.y < nose.y;
      const closeToHead = Math.abs(lw.x - nose.x) < 0.2 && Math.abs(rw.x - nose.x) < 0.2;
      const debug = `L=${lw.y.toFixed(2)} R=${rw.y.toFixed(2)} 머리근처=${closeToHead}`;
      if (leftUp && rightUp && closeToHead) {
        return { pass: true, hint: "좋아요!", debug };
      }
      if (!leftUp || !rightUp) return { pass: false, hint: "양손을 머리 위로", debug };
      return { pass: false, hint: "손을 머리 쪽으로 모아주세요", debug };
    }
  },
  {
    id: "right_hand_on_left_shoulder",
    name: "반대편 어깨 터치 (오른손)",
    emoji: "🤳",
    instruction: "오른손을 왼쪽 어깨에!",
    check: (lm) => {
      if (!upperVisible(lm)) return { pass: false, hint: "상체가 보이도록", debug: "" };
      const ls = lm[11], rw = lm[16];
      const distToLeftShoulder = dist(rw, ls);
      const debug = `R손목→L어깨=${distToLeftShoulder.toFixed(2)}`;
      if (distToLeftShoulder < 0.15) {
        return { pass: true, hint: "좋아요!", debug };
      }
      return { pass: false, hint: "오른손을 왼쪽 어깨에 가까이", debug };
    }
  },
  {
    id: "left_hand_on_right_shoulder",
    name: "반대편 어깨 터치 (왼손)",
    emoji: "💆",
    instruction: "왼손을 오른쪽 어깨에!",
    check: (lm) => {
      if (!upperVisible(lm)) return { pass: false, hint: "상체가 보이도록", debug: "" };
      const rs = lm[12], lw = lm[15];
      const distToRightShoulder = dist(lw, rs);
      const debug = `L손목→R어깨=${distToRightShoulder.toFixed(2)}`;
      if (distToRightShoulder < 0.15) {
        return { pass: true, hint: "좋아요!", debug };
      }
      return { pass: false, hint: "왼손을 오른쪽 어깨에 가까이", debug };
    }
  },

  // --- 5단계: 응용 ---
  {
    id: "hands_up_wide",
    name: "Y 포즈",
    emoji: "🙆",
    instruction: "양손을 비스듬히 위로! Y자",
    check: (lm) => {
      if (!upperVisible(lm)) return { pass: false, hint: "상체가 보이도록", debug: "" };
      const nose = lm[0], ls = lm[11], rs = lm[12], lw = lm[15], rw = lm[16];
      // 양손이 머리 위 + 어깨보다 바깥쪽으로 벌어짐
      const leftUp = lw.y < nose.y;
      const rightUp = rw.y < nose.y;
      const shoulderWidth = Math.abs(ls.x - rs.x);
      const wristWidth = Math.abs(lw.x - rw.x);
      const spread = wristWidth > shoulderWidth * 1.2;
      const debug = `어깨폭=${shoulderWidth.toFixed(2)} 손목폭=${wristWidth.toFixed(2)}`;
      if (leftUp && rightUp && spread) {
        return { pass: true, hint: "완벽한 Y!", debug };
      }
      if (!leftUp || !rightUp) return { pass: false, hint: "양손을 머리 위로", debug };
      return { pass: false, hint: "손을 더 넓게 벌려주세요", debug };
    }
  },
  {
    id: "left_elbow_bent_up",
    name: "왼팔 L자",
    emoji: "💪",
    instruction: "왼팔을 직각으로 굽혀 위로! (알통 자세)",
    check: (lm) => {
      if (!upperVisible(lm)) return { pass: false, hint: "상체가 보이도록", debug: "" };
      const ls = lm[11], le = lm[13], lw = lm[15];
      const elbowAngle = angle(ls, le, lw);
      const elbowAtShoulder = Math.abs(le.y - ls.y) < 0.15;
      const wristAboveElbow = lw.y < le.y - 0.05;
      const debug = `팔꿈치각=${elbowAngle.toFixed(0)}° 손목위=${wristAboveElbow}`;
      if (elbowAngle > 60 && elbowAngle < 120 && elbowAtShoulder && wristAboveElbow) {
        return { pass: true, hint: "좋아요!", debug };
      }
      if (!wristAboveElbow) return { pass: false, hint: "손목을 팔꿈치 위로", debug };
      if (elbowAngle > 120) return { pass: false, hint: "팔꿈치를 더 굽혀주세요", debug };
      if (elbowAngle < 60) return { pass: false, hint: "팔꿈치를 조금 펴주세요", debug };
      return { pass: false, hint: "팔꿈치를 어깨 높이로", debug };
    }
  },
  {
    id: "finale_hands_up",
    name: "피날레!",
    emoji: "🎉",
    instruction: "마지막! 양손 번쩍 Y 자세로 피날레",
    check: (lm) => {
      if (!upperVisible(lm)) return { pass: false, hint: "상체가 보이도록", debug: "" };
      const nose = lm[0], ls = lm[11], rs = lm[12], lw = lm[15], rw = lm[16];
      const leftUp = lw.y < nose.y - 0.05;
      const rightUp = rw.y < nose.y - 0.05;
      const shoulderWidth = Math.abs(ls.x - rs.x);
      const wristWidth = Math.abs(lw.x - rw.x);
      const spread = wristWidth > shoulderWidth;
      const debug = `L=${lw.y.toFixed(2)} R=${rw.y.toFixed(2)} 손목폭=${wristWidth.toFixed(2)}`;
      if (leftUp && rightUp && spread) {
        return { pass: true, hint: "🎉 축하합니다!", debug };
      }
      return { pass: false, hint: "양손을 머리 위로 활짝!", debug };
    }
  }
];
