// ============ 유틸리티 ============

// 2D 각도 (도)
function angle2D(a, b, c) {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAB = Math.hypot(ab.x, ab.y);
  const magCB = Math.hypot(cb.x, cb.y);
  if (magAB === 0 || magCB === 0) return 0;
  const cos = dot / (magAB * magCB);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

// 3D 각도 (더 정확 - worldLandmarks 용)
function angle3D(a, b, c) {
  const ab = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const cb = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const dot = ab.x * cb.x + ab.y * cb.y + ab.z * cb.z;
  const magAB = Math.hypot(ab.x, ab.y, ab.z);
  const magCB = Math.hypot(cb.x, cb.y, cb.z);
  if (magAB === 0 || magCB === 0) return 0;
  const cos = dot / (magAB * magCB);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

function dist2D(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function vis(lm, i) {
  return lm[i] ? (lm[i].visibility ?? 1) : 0;
}

function upperVisible(lm) {
  return [0, 11, 12, 15, 16].every((i) => vis(lm, i) > 0.4);
}

// 어깨 폭 (정규화 단위) - 카메라 거리에 무관한 기준
function shoulderWidth(lm) {
  return dist2D(lm[11], lm[12]);
}

// 어깨 높이 (중점 y)
function shoulderY(lm) {
  return (lm[11].y + lm[12].y) / 2;
}

// 몸 중심 x (어깨 중점)
function bodyCenterX(lm) {
  return (lm[11].x + lm[12].x) / 2;
}

/**
 * 3D 팔 각도 (worldLandmarks 사용, 있으면)
 * fallback으로 2D 사용
 */
function armAngle(lm, worldLm, shoulderIdx, elbowIdx, wristIdx) {
  if (worldLm && worldLm[shoulderIdx] && worldLm[elbowIdx] && worldLm[wristIdx]) {
    return angle3D(worldLm[shoulderIdx], worldLm[elbowIdx], worldLm[wristIdx]);
  }
  return angle2D(lm[shoulderIdx], lm[elbowIdx], lm[wristIdx]);
}

// ============ 준비 포즈 ============
export const READY_POSE = {
  id: "ready",
  name: "준비 포즈",
  emoji: "🙌",
  instruction: "양손을 머리 위로 올리면 시작!",
  check: (lm, worldLm) => {
    if (!upperVisible(lm)) {
      return { pass: false, hint: "카메라 앞에 서주세요", debug: "상체 가시성 부족" };
    }
    const nose = lm[0], lw = lm[15], rw = lm[16];
    const sw = shoulderWidth(lm);
    // 손목이 코보다 약간 위에 있어야 (어깨폭의 15% 여유)
    const margin = sw * 0.15;
    const leftUp = lw.y < nose.y + margin * 0.5;
    const rightUp = rw.y < nose.y + margin * 0.5;
    const debug = `코=${nose.y.toFixed(2)} L=${lw.y.toFixed(2)} R=${rw.y.toFixed(2)}`;
    if (leftUp && rightUp) return { pass: true, hint: "좋아요!", debug };
    return { pass: false, hint: "양손을 머리 위로!", debug };
  }
};

// ============ 포즈 라이브러리 ============
export const POSE_LIBRARY = {
  both_hands_up: {
    id: "both_hands_up",
    name: "양손 번쩍",
    emoji: "🙌",
    instruction: "양손을 머리 위로 번쩍!",
    check: (lm, worldLm) => {
      if (!upperVisible(lm)) return { pass: false, hint: "상체가 보이도록", debug: "" };
      const nose = lm[0], lw = lm[15], rw = lm[16];
      const sw = shoulderWidth(lm);
      const margin = sw * 0.1;
      const leftUp = lw.y < nose.y - margin;
      const rightUp = rw.y < nose.y - margin;
      const debug = `코=${nose.y.toFixed(2)} L=${lw.y.toFixed(2)} R=${rw.y.toFixed(2)} sw=${sw.toFixed(2)}`;
      if (leftUp && rightUp) return { pass: true, hint: "완벽!", debug };
      return { pass: false, hint: "양손 더 높이!", debug };
    }
  },

  t_pose: {
    id: "t_pose",
    name: "T 포즈",
    emoji: "🤸",
    instruction: "양팔을 좌우로 쭉! T자",
    check: (lm, worldLm) => {
      if (!upperVisible(lm)) return { pass: false, hint: "상체가 보이도록", debug: "" };
      const ls = lm[11], rs = lm[12], lw = lm[15], rw = lm[16];
      const sw = shoulderWidth(lm);
      const shY = shoulderY(lm);
      // 손목이 어깨 높이 (어깨폭의 40% 이내)
      const tolerance = sw * 0.4;
      const leftLevel = Math.abs(lw.y - shY) < tolerance;
      const rightLevel = Math.abs(rw.y - shY) < tolerance;
      // 팔이 펴짐 (3D 각도)
      const leftArm = armAngle(lm, worldLm, 11, 13, 15);
      const rightArm = armAngle(lm, worldLm, 12, 14, 16);
      // 손목이 어깨보다 바깥쪽으로 나와야 (양쪽 손목이 어깨보다 넓게 벌어짐)
      const wristSpread = dist2D(lw, rw);
      const spread = wristSpread > sw * 2.0; // 어깨폭의 2배 이상 벌어져야
      const debug = `Larm=${leftArm.toFixed(0)}° Rarm=${rightArm.toFixed(0)}° spread=${(wristSpread/sw).toFixed(1)}x`;
      if (leftLevel && rightLevel && leftArm > 150 && rightArm > 150 && spread) {
        return { pass: true, hint: "완벽한 T!", debug };
      }
      if (leftArm < 150 || rightArm < 150) return { pass: false, hint: "팔을 더 쭉 펴주세요", debug };
      if (!spread) return { pass: false, hint: "팔을 더 벌려주세요", debug };
      return { pass: false, hint: "팔을 어깨 높이로", debug };
    }
  },

  left_hand_up: {
    id: "left_hand_up",
    name: "왼손 번쩍",
    emoji: "👈",
    instruction: "왼손만 머리 위로!",
    check: (lm, worldLm) => {
      if (!upperVisible(lm)) return { pass: false, hint: "상체가 보이도록", debug: "" };
      const nose = lm[0], lw = lm[15], rw = lm[16], rs = lm[12];
      const sw = shoulderWidth(lm);
      const leftUp = lw.y < nose.y - sw * 0.1;
      const rightDown = rw.y > rs.y + sw * 0.3;
      const debug = `L=${lw.y.toFixed(2)} R=${rw.y.toFixed(2)}`;
      if (leftUp && rightDown) return { pass: true, hint: "좋아요!", debug };
      if (!leftUp) return { pass: false, hint: "왼손을 더 올려주세요", debug };
      return { pass: false, hint: "오른손은 내려주세요", debug };
    }
  },

  right_hand_up: {
    id: "right_hand_up",
    name: "오른손 번쩍",
    emoji: "👉",
    instruction: "오른손만 머리 위로!",
    check: (lm, worldLm) => {
      if (!upperVisible(lm)) return { pass: false, hint: "상체가 보이도록", debug: "" };
      const nose = lm[0], lw = lm[15], rw = lm[16], ls = lm[11];
      const sw = shoulderWidth(lm);
      const rightUp = rw.y < nose.y - sw * 0.1;
      const leftDown = lw.y > ls.y + sw * 0.3;
      const debug = `L=${lw.y.toFixed(2)} R=${rw.y.toFixed(2)}`;
      if (rightUp && leftDown) return { pass: true, hint: "좋아요!", debug };
      if (!rightUp) return { pass: false, hint: "오른손을 더 올려주세요", debug };
      return { pass: false, hint: "왼손은 내려주세요", debug };
    }
  },

  arms_cross: {
    id: "arms_cross",
    name: "팔짱 끼기",
    emoji: "🫂",
    instruction: "가슴 앞에서 양손을 모아",
    check: (lm, worldLm) => {
      if (!upperVisible(lm)) return { pass: false, hint: "상체가 보이도록", debug: "" };
      const ls = lm[11], rs = lm[12], lw = lm[15], rw = lm[16];
      const sw = shoulderWidth(lm);
      const wristsDist = dist2D(lw, rw);
      // 가슴 위치: 어깨 약간 아래
      const chestY = shoulderY(lm) + sw * 0.3;
      // 어깨폭 단위로 판정
      const atChest = Math.abs(lw.y - chestY) < sw * 0.6 && Math.abs(rw.y - chestY) < sw * 0.6;
      const close = wristsDist < sw * 0.8;
      const debug = `거리=${(wristsDist/sw).toFixed(1)}x 가슴y=${chestY.toFixed(2)}`;
      if (close && atChest) return { pass: true, hint: "좋아요!", debug };
      if (!atChest) return { pass: false, hint: "가슴 높이로", debug };
      return { pass: false, hint: "양손을 더 가까이", debug };
    }
  },

  left_arm_side: {
    id: "left_arm_side",
    name: "왼팔 옆으로",
    emoji: "⬅️",
    instruction: "왼팔만 옆으로 쭉!",
    check: (lm, worldLm) => {
      if (!upperVisible(lm)) return { pass: false, hint: "상체가 보이도록", debug: "" };
      const ls = lm[11], lw = lm[15], rs = lm[12], rw = lm[16];
      const sw = shoulderWidth(lm);
      const leftArm = armAngle(lm, worldLm, 11, 13, 15);
      const leftLevel = Math.abs(lw.y - ls.y) < sw * 0.4;
      const rightDown = rw.y > rs.y + sw * 0.3;
      const debug = `Larm=${leftArm.toFixed(0)}°`;
      if (leftArm > 150 && leftLevel && rightDown) return { pass: true, hint: "좋아요!", debug };
      if (leftArm < 150) return { pass: false, hint: "왼팔을 쭉 펴주세요", debug };
      if (!leftLevel) return { pass: false, hint: "왼팔을 어깨 높이로", debug };
      return { pass: false, hint: "오른팔은 내려주세요", debug };
    }
  },

  right_arm_side: {
    id: "right_arm_side",
    name: "오른팔 옆으로",
    emoji: "➡️",
    instruction: "오른팔만 옆으로 쭉!",
    check: (lm, worldLm) => {
      if (!upperVisible(lm)) return { pass: false, hint: "상체가 보이도록", debug: "" };
      const ls = lm[11], rs = lm[12], rw = lm[16], lw = lm[15];
      const sw = shoulderWidth(lm);
      const rightArm = armAngle(lm, worldLm, 12, 14, 16);
      const rightLevel = Math.abs(rw.y - rs.y) < sw * 0.4;
      const leftDown = lw.y > ls.y + sw * 0.3;
      const debug = `Rarm=${rightArm.toFixed(0)}°`;
      if (rightArm > 150 && rightLevel && leftDown) return { pass: true, hint: "좋아요!", debug };
      if (rightArm < 150) return { pass: false, hint: "오른팔을 쭉 펴주세요", debug };
      if (!rightLevel) return { pass: false, hint: "오른팔을 어깨 높이로", debug };
      return { pass: false, hint: "왼팔은 내려주세요", debug };
    }
  },

  left_up_right_side: {
    id: "left_up_right_side",
    name: "왼손 위 + 오른손 옆",
    emoji: "🙋",
    instruction: "왼손은 위로, 오른팔은 옆으로",
    check: (lm, worldLm) => {
      if (!upperVisible(lm)) return { pass: false, hint: "상체가 보이도록", debug: "" };
      const nose = lm[0], lw = lm[15], rw = lm[16], rs = lm[12];
      const sw = shoulderWidth(lm);
      const leftUp = lw.y < nose.y - sw * 0.1;
      const rightArm = armAngle(lm, worldLm, 12, 14, 16);
      const rightLevel = Math.abs(rw.y - rs.y) < sw * 0.5;
      const debug = `L=${lw.y.toFixed(2)} Rarm=${rightArm.toFixed(0)}°`;
      if (leftUp && rightArm > 150 && rightLevel) return { pass: true, hint: "좋아요!", debug };
      if (!leftUp) return { pass: false, hint: "왼손을 더 위로", debug };
      if (rightArm < 150) return { pass: false, hint: "오른팔을 펴주세요", debug };
      return { pass: false, hint: "오른팔 어깨 높이로", debug };
    }
  },

  right_up_left_side: {
    id: "right_up_left_side",
    name: "오른손 위 + 왼손 옆",
    emoji: "🙋‍♂️",
    instruction: "오른손은 위로, 왼팔은 옆으로",
    check: (lm, worldLm) => {
      if (!upperVisible(lm)) return { pass: false, hint: "상체가 보이도록", debug: "" };
      const nose = lm[0], lw = lm[15], rw = lm[16], ls = lm[11];
      const sw = shoulderWidth(lm);
      const rightUp = rw.y < nose.y - sw * 0.1;
      const leftArm = armAngle(lm, worldLm, 11, 13, 15);
      const leftLevel = Math.abs(lw.y - ls.y) < sw * 0.5;
      const debug = `R=${rw.y.toFixed(2)} Larm=${leftArm.toFixed(0)}°`;
      if (rightUp && leftArm > 150 && leftLevel) return { pass: true, hint: "좋아요!", debug };
      if (!rightUp) return { pass: false, hint: "오른손을 더 위로", debug };
      if (leftArm < 150) return { pass: false, hint: "왼팔을 펴주세요", debug };
      return { pass: false, hint: "왼팔 어깨 높이로", debug };
    }
  },

  hands_on_head: {
    id: "hands_on_head",
    name: "머리 위 손",
    emoji: "💁",
    instruction: "양손을 머리 위에!",
    check: (lm, worldLm) => {
      if (!upperVisible(lm)) return { pass: false, hint: "상체가 보이도록", debug: "" };
      const nose = lm[0], lw = lm[15], rw = lm[16];
      const sw = shoulderWidth(lm);
      const leftUp = lw.y < nose.y;
      const rightUp = rw.y < nose.y;
      // 양 손목이 코 기준 가로로 어깨폭 이내
      const closeToHead = Math.abs(lw.x - nose.x) < sw * 0.9 && Math.abs(rw.x - nose.x) < sw * 0.9;
      const debug = `L=${Math.abs(lw.x-nose.x).toFixed(2)} R=${Math.abs(rw.x-nose.x).toFixed(2)}`;
      if (leftUp && rightUp && closeToHead) return { pass: true, hint: "좋아요!", debug };
      if (!leftUp || !rightUp) return { pass: false, hint: "양손을 머리 위로", debug };
      return { pass: false, hint: "손을 머리 쪽으로", debug };
    }
  },

  right_to_left_shoulder: {
    id: "right_to_left_shoulder",
    name: "오른손 → 왼어깨",
    emoji: "🤳",
    instruction: "오른손을 왼쪽 어깨에!",
    check: (lm, worldLm) => {
      if (!upperVisible(lm)) return { pass: false, hint: "상체가 보이도록", debug: "" };
      const ls = lm[11], rw = lm[16];
      const sw = shoulderWidth(lm);
      const d = dist2D(rw, ls);
      // 어깨폭의 50% 이내면 어깨에 닿은 것
      const debug = `거리=${(d/sw).toFixed(2)}x`;
      if (d < sw * 0.6) return { pass: true, hint: "좋아요!", debug };
      return { pass: false, hint: "오른손을 왼어깨에 가까이", debug };
    }
  },

  left_to_right_shoulder: {
    id: "left_to_right_shoulder",
    name: "왼손 → 오른어깨",
    emoji: "💆",
    instruction: "왼손을 오른쪽 어깨에!",
    check: (lm, worldLm) => {
      if (!upperVisible(lm)) return { pass: false, hint: "상체가 보이도록", debug: "" };
      const rs = lm[12], lw = lm[15];
      const sw = shoulderWidth(lm);
      const d = dist2D(lw, rs);
      const debug = `거리=${(d/sw).toFixed(2)}x`;
      if (d < sw * 0.6) return { pass: true, hint: "좋아요!", debug };
      return { pass: false, hint: "왼손을 오른어깨에 가까이", debug };
    }
  },

  y_pose: {
    id: "y_pose",
    name: "Y 포즈",
    emoji: "🙆",
    instruction: "양손을 비스듬히 위로! Y자",
    check: (lm, worldLm) => {
      if (!upperVisible(lm)) return { pass: false, hint: "상체가 보이도록", debug: "" };
      const nose = lm[0], lw = lm[15], rw = lm[16];
      const sw = shoulderWidth(lm);
      const leftUp = lw.y < nose.y;
      const rightUp = rw.y < nose.y;
      const wristWidth = Math.abs(lw.x - rw.x);
      // 양 손목이 어깨폭의 1.5배 이상 벌어져야
      const spread = wristWidth > sw * 1.5;
      const debug = `손목폭=${(wristWidth/sw).toFixed(1)}x (필요:1.5)`;
      if (leftUp && rightUp && spread) return { pass: true, hint: "완벽한 Y!", debug };
      if (!leftUp || !rightUp) return { pass: false, hint: "양손을 머리 위로", debug };
      return { pass: false, hint: "손을 더 넓게!", debug };
    }
  },

  left_bicep: {
    id: "left_bicep",
    name: "왼팔 L자",
    emoji: "💪",
    instruction: "왼팔 직각으로 굽혀 위로!",
    check: (lm, worldLm) => {
      if (!upperVisible(lm)) return { pass: false, hint: "상체가 보이도록", debug: "" };
      const ls = lm[11], le = lm[13], lw = lm[15];
      const sw = shoulderWidth(lm);
      const elbowAngle = armAngle(lm, worldLm, 11, 13, 15);
      const elbowAtShoulder = Math.abs(le.y - ls.y) < sw * 0.4;
      const wristAboveElbow = lw.y < le.y - sw * 0.2;
      const debug = `팔꿈치=${elbowAngle.toFixed(0)}°`;
      if (elbowAngle > 60 && elbowAngle < 120 && elbowAtShoulder && wristAboveElbow) {
        return { pass: true, hint: "좋아요!", debug };
      }
      if (!wristAboveElbow) return { pass: false, hint: "손목을 팔꿈치 위로", debug };
      if (elbowAngle > 120) return { pass: false, hint: "더 굽혀주세요", debug };
      if (elbowAngle < 60) return { pass: false, hint: "조금 펴주세요", debug };
      return { pass: false, hint: "팔꿈치 어깨 높이로", debug };
    }
  },

  finale: {
    id: "finale",
    name: "피날레!",
    emoji: "🎉",
    instruction: "양손 번쩍 Y자로 피날레!",
    check: (lm, worldLm) => {
      if (!upperVisible(lm)) return { pass: false, hint: "상체가 보이도록", debug: "" };
      const nose = lm[0], lw = lm[15], rw = lm[16];
      const sw = shoulderWidth(lm);
      const leftUp = lw.y < nose.y - sw * 0.1;
      const rightUp = rw.y < nose.y - sw * 0.1;
      const wristWidth = Math.abs(lw.x - rw.x);
      const spread = wristWidth > sw * 1.2;
      const debug = `L=${lw.y.toFixed(2)} 손목폭=${(wristWidth/sw).toFixed(1)}x`;
      if (leftUp && rightUp && spread) return { pass: true, hint: "🎉 축하!", debug };
      return { pass: false, hint: "양손 활짝 위로!", debug };
    }
  }
};

// ============ 싱글 모드용 15개 포즈 ============
export const POSES = [
  POSE_LIBRARY.both_hands_up,
  POSE_LIBRARY.t_pose,
  POSE_LIBRARY.left_hand_up,
  POSE_LIBRARY.right_hand_up,
  POSE_LIBRARY.arms_cross,
  POSE_LIBRARY.left_arm_side,
  POSE_LIBRARY.right_arm_side,
  POSE_LIBRARY.left_up_right_side,
  POSE_LIBRARY.right_up_left_side,
  POSE_LIBRARY.hands_on_head,
  POSE_LIBRARY.right_to_left_shoulder,
  POSE_LIBRARY.left_to_right_shoulder,
  POSE_LIBRARY.y_pose,
  POSE_LIBRARY.left_bicep,
  POSE_LIBRARY.finale
];

// ============ 연속동작 시퀀스 ============
export const SEQUENCES = [
  {
    id: "easy",
    name: "초보 웨이브 🌊",
    description: "4동작 · 천천히",
    difficulty: "Easy",
    stepHoldMs: 400,
    stepWindowMs: 3000,
    steps: ["both_hands_up", "t_pose", "left_hand_up", "right_hand_up"]
  },
  {
    id: "medium",
    name: "댄서 콤보 💃",
    description: "6동작 · 적당한 속도",
    difficulty: "Medium",
    stepHoldMs: 350,
    stepWindowMs: 2500,
    steps: ["both_hands_up", "left_arm_side", "right_arm_side", "arms_cross", "y_pose", "finale"]
  },
  {
    id: "hard",
    name: "프로 루틴 🔥",
    description: "8동작 · 빠른 전환",
    difficulty: "Hard",
    stepHoldMs: 300,
    stepWindowMs: 2000,
    steps: [
      "both_hands_up",
      "left_hand_up",
      "right_hand_up",
      "t_pose",
      "left_up_right_side",
      "right_up_left_side",
      "y_pose",
      "finale"
    ]
  }
];
