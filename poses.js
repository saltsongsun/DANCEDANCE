// MediaPipe Pose Landmark 인덱스
// 0: nose, 11/12: 어깨(left/right), 13/14: 팔꿈치
// 15/16: 손목, 23/24: 엉덩이, 25/26: 무릎, 27/28: 발목

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

function isUpperBodyVisible(lm) {
  const required = [0, 11, 12, 15, 16];
  return required.every((i) => lm[i] && (lm[i].visibility ?? 1) > 0.3);
}

export const POSES = [
  {
    id: "hands_up",
    name: "양손 머리 위로",
    emoji: "🙌",
    instruction: "양손을 머리 위로 번쩍!",
    check: (lm) => {
      if (!isUpperBodyVisible(lm)) {
        return { pass: false, hint: "상체가 보이도록 서주세요", debug: "상체 가시성 부족" };
      }
      const nose = lm[0];
      const lw = lm[15];
      const rw = lm[16];
      const margin = 0.05;
      const leftUp = lw.y < nose.y + margin;
      const rightUp = rw.y < nose.y + margin;

      const debug = `코y=${nose.y.toFixed(2)} L=${lw.y.toFixed(2)} R=${rw.y.toFixed(2)}`;

      if (leftUp && rightUp) return { pass: true, hint: "좋아요! 유지!", debug };
      if (!leftUp && !rightUp) return { pass: false, hint: "양손을 머리 위로!", debug };
      return { pass: false, hint: "한 손 더 올려주세요", debug };
    }
  },
  {
    id: "t_pose",
    name: "T 포즈",
    emoji: "🤸",
    instruction: "양팔을 좌우로 쭉! T자 모양",
    check: (lm) => {
      if (!isUpperBodyVisible(lm)) {
        return { pass: false, hint: "상체가 보이도록 서주세요", debug: "상체 가시성 부족" };
      }
      const ls = lm[11], rs = lm[12];
      const le = lm[13], re = lm[14];
      const lw = lm[15], rw = lm[16];

      const shoulderY = (ls.y + rs.y) / 2;
      const leftLevel = Math.abs(lw.y - shoulderY) < 0.15;
      const rightLevel = Math.abs(rw.y - shoulderY) < 0.15;

      const leftArm = angle(ls, le, lw);
      const rightArm = angle(rs, re, rw);
      const leftStraight = leftArm > 140;
      const rightStraight = rightArm > 140;

      const debug = `Larm=${leftArm.toFixed(0)}° Rarm=${rightArm.toFixed(0)}° 어깨y=${shoulderY.toFixed(2)}`;

      if (leftLevel && rightLevel && leftStraight && rightStraight) {
        return { pass: true, hint: "완벽한 T!", debug };
      }
      if (!leftStraight || !rightStraight) {
        return { pass: false, hint: "팔을 더 쭉 펴주세요", debug };
      }
      return { pass: false, hint: "팔을 어깨 높이로", debug };
    }
  },
  {
    id: "one_hand_up",
    name: "한 손만 올리기",
    emoji: "✋",
    instruction: "아무 손이나 하나만 머리 위로",
    check: (lm) => {
      if (!isUpperBodyVisible(lm)) {
        return { pass: false, hint: "상체가 보이도록 서주세요", debug: "상체 가시성 부족" };
      }
      const nose = lm[0];
      const lw = lm[15];
      const rw = lm[16];
      const ls = lm[11];
      const rs = lm[12];

      const margin = 0.05;
      const leftUp = lw.y < nose.y + margin;
      const rightUp = rw.y < nose.y + margin;
      const leftDown = lw.y > ls.y + 0.05;
      const rightDown = rw.y > rs.y + 0.05;

      const debug = `코y=${nose.y.toFixed(2)} L=${lw.y.toFixed(2)} R=${rw.y.toFixed(2)}`;

      if ((leftUp && rightDown) || (rightUp && leftDown)) {
        return { pass: true, hint: "좋아요!", debug };
      }
      if (leftUp && rightUp) {
        return { pass: false, hint: "한 손만! 다른 손은 내려요", debug };
      }
      if (!leftUp && !rightUp) {
        return { pass: false, hint: "한 손을 머리 위로!", debug };
      }
      return { pass: false, hint: "다른 손은 아래로", debug };
    }
  },
  {
    id: "arms_cross",
    name: "팔짱 끼기",
    emoji: "🫂",
    instruction: "가슴 앞에서 양팔을 교차해 팔짱",
    check: (lm) => {
      if (!isUpperBodyVisible(lm)) {
        return { pass: false, hint: "상체가 보이도록 서주세요", debug: "상체 가시성 부족" };
      }
      const ls = lm[11], rs = lm[12];
      const lw = lm[15], rw = lm[16];

      const wristsDist = Math.hypot(lw.x - rw.x, lw.y - rw.y);
      const wristsClose = wristsDist < 0.35;

      const chestY = (ls.y + rs.y) / 2 + 0.1;
      const leftAtChest = Math.abs(lw.y - chestY) < 0.25;
      const rightAtChest = Math.abs(rw.y - chestY) < 0.25;

      const debug = `손목거리=${wristsDist.toFixed(2)} 가슴y=${chestY.toFixed(2)}`;

      if (wristsClose && leftAtChest && rightAtChest) {
        return { pass: true, hint: "좋아요!", debug };
      }
      if (!leftAtChest || !rightAtChest) {
        return { pass: false, hint: "손을 가슴 높이로", debug };
      }
      return { pass: false, hint: "양손을 가슴 앞에서 모아주세요", debug };
    }
  }
];
