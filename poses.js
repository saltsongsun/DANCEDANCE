// ============ 유틸리티 ============
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

function dist2D(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function vis(lm, i) {
  return lm[i] ? (lm[i].visibility ?? 1) : 0;
}

function upperVisible(lm) {
  const core = [0, 11, 12].every((i) => vis(lm, i) > 0.4);
  const wrists = vis(lm, 15) > 0.2 || vis(lm, 16) > 0.2;
  return core && wrists;
}

function shoulderWidth(lm) {
  return dist2D(lm[11], lm[12]);
}

// ============ 정규화 ============
// 포즈를 어깨 중심을 원점으로, 어깨폭으로 스케일링
// 이렇게 하면 사람의 위치/거리에 무관한 좌표가 됨
export function normalizePose(lm) {
  if (!lm || !lm[11] || !lm[12]) return null;
  const sw = shoulderWidth(lm);
  if (sw < 0.05) return null;

  const cx = (lm[11].x + lm[12].x) / 2;
  const cy = (lm[11].y + lm[12].y) / 2;

  // 상체에서 핵심 관절들만 정규화 (얼굴은 노이즈 많음)
  const KEY_INDICES = [0, 11, 12, 13, 14, 15, 16];
  const normalized = {};
  for (const i of KEY_INDICES) {
    if (!lm[i]) continue;
    normalized[i] = {
      x: (lm[i].x - cx) / sw,
      y: (lm[i].y - cy) / sw,
      visibility: lm[i].visibility ?? 1
    };
  }
  return normalized;
}

// ============ 두 정규화된 포즈 간 거리 ============
// 작을수록 유사. 0이면 완전 동일
// 일반적으로 0.3 이하면 매우 비슷, 0.5 이하면 비슷, 0.8 이상이면 다름
export function poseDistance(normA, normB) {
  if (!normA || !normB) return Infinity;
  const KEY_INDICES = [0, 11, 12, 13, 14, 15, 16];
  // 가중치: 손목/팔꿈치 동작이 가장 중요
  const WEIGHTS = {
    0: 0.5,   // 코 (위치 보정용)
    11: 0.3,  // 어깨 (이미 정규화 기준)
    12: 0.3,
    13: 1.5,  // 팔꿈치
    14: 1.5,
    15: 2.0,  // 손목 (가장 중요)
    16: 2.0
  };

  let totalWeighted = 0;
  let totalWeight = 0;
  for (const i of KEY_INDICES) {
    const a = normA[i];
    const b = normB[i];
    if (!a || !b) continue;
    // 둘 다 visibility 너무 낮으면 무시
    if ((a.visibility ?? 1) < 0.3 && (b.visibility ?? 1) < 0.3) continue;
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    const w = WEIGHTS[i] ?? 1;
    totalWeighted += d * w;
    totalWeight += w;
  }
  if (totalWeight === 0) return Infinity;
  return totalWeighted / totalWeight;
}

// ============ 커스텀 포즈 매처 생성 ============
// 사용자가 녹화한 정규화 포즈를 받아 check 함수를 가진 객체 반환
export function createCustomPose(customData) {
  return {
    id: customData.id,
    name: customData.name,
    emoji: customData.emoji,
    instruction: customData.instruction,
    isCustom: true,
    referencePose: customData.referencePose, // 정규화된 좌표
    check: (lm, worldLm, isHolding) => {
      if (!upperVisible(lm)) {
        return { pass: false, hint: "상체가 보이도록 서주세요", debug: "vis 부족" };
      }
      const currentNorm = normalizePose(lm);
      if (!currentNorm) {
        return { pass: false, hint: "자세를 인식 중...", debug: "정규화 실패" };
      }
      const d = poseDistance(currentNorm, customData.referencePose);
      // 임계값: 진입 0.45, 유지 0.6 (히스테리시스)
      const threshold = isHolding ? 0.65 : 0.45;
      const debug = `유사도 거리=${d.toFixed(3)} (필요<${threshold})`;
      if (d < threshold) {
        const quality = d < 0.25 ? "완벽!" : d < 0.4 ? "좋아요!" : "OK!";
        return { pass: true, hint: quality, debug };
      }
      // 자세 차이가 크면 어떤 부분이 다른지 힌트
      const hint = getDiffHint(currentNorm, customData.referencePose);
      return { pass: false, hint, debug };
    }
  };
}

function getDiffHint(current, reference) {
  // 손목 위치 차이가 가장 클 때 힌트
  const lwDiff = current[15] && reference[15]
    ? Math.hypot(current[15].x - reference[15].x, current[15].y - reference[15].y) : 0;
  const rwDiff = current[16] && reference[16]
    ? Math.hypot(current[16].x - reference[16].x, current[16].y - reference[16].y) : 0;

  if (lwDiff < 0.2 && rwDiff < 0.2) return "조금만 더!";

  if (lwDiff > rwDiff) {
    if (current[15] && reference[15]) {
      if (current[15].y > reference[15].y + 0.2) return "왼손을 더 올려주세요";
      if (current[15].y < reference[15].y - 0.2) return "왼손을 내려주세요";
      if (current[15].x < reference[15].x - 0.2) return "왼손을 오른쪽으로";
      if (current[15].x > reference[15].x + 0.2) return "왼손을 왼쪽으로";
    }
    return "왼손 위치 조정";
  } else {
    if (current[16] && reference[16]) {
      if (current[16].y > reference[16].y + 0.2) return "오른손을 더 올려주세요";
      if (current[16].y < reference[16].y - 0.2) return "오른손을 내려주세요";
      if (current[16].x < reference[16].x - 0.2) return "오른손을 오른쪽으로";
      if (current[16].x > reference[16].x + 0.2) return "오른손을 왼쪽으로";
    }
    return "오른손 위치 조정";
  }
}

// ============ 준비 포즈 ============
export const READY_POSE = {
  id: "ready",
  name: "준비 포즈",
  emoji: "🙌",
  instruction: "양손을 머리 위로 올리면 시작!",
  check: (lm, worldLm, isHolding) => {
    if (!upperVisible(lm)) {
      return { pass: false, hint: "카메라 앞에 서주세요", debug: "" };
    }
    const nose = lm[0], lw = lm[15], rw = lm[16];
    const margin = isHolding ? 0.08 : 0.0;
    const leftUp = lw.y < nose.y + margin;
    const rightUp = rw.y < nose.y + margin;
    const debug = `코=${nose.y.toFixed(2)} L=${lw.y.toFixed(2)} R=${rw.y.toFixed(2)}`;
    if (leftUp && rightUp) return { pass: true, hint: "좋아요!", debug };
    return { pass: false, hint: "양손을 머리 위로!", debug };
  }
};

// ============ 기본 포즈 라이브러리 (커스텀이 없을 때 fallback) ============
// 단순화 - 기본 몇 개만 둠. 사용자가 직접 녹화한 게 메인이 됨
export const POSE_LIBRARY = {
  both_hands_up: {
    id: "both_hands_up",
    name: "양손 번쩍",
    emoji: "🙌",
    instruction: "양손을 머리 위로!",
    check: (lm, worldLm, isHolding) => {
      if (!upperVisible(lm)) return { pass: false, hint: "상체가 보이도록", debug: "" };
      const nose = lm[0], lw = lm[15], rw = lm[16];
      const margin = isHolding ? 0.1 : 0.0;
      const leftUp = lw.y < nose.y + margin;
      const rightUp = rw.y < nose.y + margin;
      const debug = `L=${lw.y.toFixed(2)} R=${rw.y.toFixed(2)}`;
      if (leftUp && rightUp) return { pass: true, hint: "완벽!", debug };
      return { pass: false, hint: "양손 더 위로!", debug };
    }
  },
  t_pose: {
    id: "t_pose",
    name: "T 포즈",
    emoji: "🤸",
    instruction: "양팔을 좌우로 쭉!",
    check: (lm, worldLm, isHolding) => {
      if (!upperVisible(lm)) return { pass: false, hint: "상체가 보이도록", debug: "" };
      const ls = lm[11], rs = lm[12], lw = lm[15], rw = lm[16];
      const sw = shoulderWidth(lm);
      const shY = (ls.y + rs.y) / 2;
      const tol = isHolding ? sw * 0.75 : sw * 0.55;
      const leftLevel = Math.abs(lw.y - shY) < tol;
      const rightLevel = Math.abs(rw.y - shY) < tol;
      const wristSpread = dist2D(lw, rw);
      const spread = wristSpread > sw * (isHolding ? 1.5 : 1.7);
      const debug = `폭=${(wristSpread/sw).toFixed(1)}x`;
      if (leftLevel && rightLevel && spread) return { pass: true, hint: "T!", debug };
      if (!spread) return { pass: false, hint: "팔 더 벌려요", debug };
      return { pass: false, hint: "어깨 높이로", debug };
    }
  }
};

// ============ 싱글 모드용 기본 포즈 (간략화) ============
export const POSES = [
  POSE_LIBRARY.both_hands_up,
  POSE_LIBRARY.t_pose
];

// ============ 기본 시퀀스 (예시용) ============
export const SEQUENCES = [
  {
    id: "demo",
    name: "기본 데모 ✨",
    description: "양손올리기 → T포즈",
    difficulty: "easy",
    stepHoldMs: 400,
    stepWindowMs: 4000,
    steps: ["both_hands_up", "t_pose"]
  }
];
