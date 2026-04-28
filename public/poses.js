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
  // 코나 어깨만 보여도 OK (매우 관대)
  const noseOrShoulder = vis(lm, 0) > 0.3 || vis(lm, 11) > 0.3 || vis(lm, 12) > 0.3;
  return noseOrShoulder;
}

function shoulderWidth(lm) {
  return dist2D(lm[11], lm[12]);
}

// ============ 정규화 ============
export function normalizePose(lm) {
  if (!lm || !lm[11] || !lm[12]) return null;
  const sw = shoulderWidth(lm);
  if (sw < 0.05) return null;
  const cx = (lm[11].x + lm[12].x) / 2;
  const cy = (lm[11].y + lm[12].y) / 2;
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

// ============ 거리 비교 ============
export function poseDistance(normA, normB) {
  if (!normA || !normB) return Infinity;
  const KEY_INDICES = [0, 11, 12, 13, 14, 15, 16];
  // 손목/팔꿈치 가중치 더 낮춤 - 좌우 펼침 자세에서도 관대하게
  const WEIGHTS = {
    0: 0.5,    // 코
    11: 0.5,   // 어깨
    12: 0.5,
    13: 0.5,   // 팔꿈치 (이전 0.8 → 0.5)
    14: 0.5,
    15: 0.7,   // 손목 (이전 1.2 → 0.7)
    16: 0.7
  };
  let totalWeighted = 0;
  let totalWeight = 0;
  for (const i of KEY_INDICES) {
    const a = normA[i], b = normB[i];
    if (!a || !b) continue;
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
export function createCustomPose(customData) {
  return {
    id: customData.id,
    name: customData.name,
    emoji: customData.emoji,
    instruction: customData.instruction,
    isCustom: customData.isCustom !== false,
    isSample: customData.isSample === true,
    referencePose: customData.referencePose,
    check: (lm, worldLm, isHolding) => {
      if (!upperVisible(lm)) {
        return { pass: false, hint: "상체가 보이도록 서주세요", debug: "vis 부족" };
      }
      const currentNorm = normalizePose(lm);
      if (!currentNorm) {
        return { pass: false, hint: "자세를 인식 중...", debug: "정규화 실패" };
      }
      const d = poseDistance(currentNorm, customData.referencePose);
      const isSampleData = customData.isSample === true;
      // 진입 1.7, 유지 2.1
      const enterThreshold = 1.7;
      const exitThreshold = 2.1;
      const threshold = isHolding ? exitThreshold : enterThreshold;
      const debug = `유사도=${d.toFixed(3)} 필요<${threshold} ${isSampleData ? '(sample)' : '(user)'}`;
      if (d < threshold) {
        const quality = d < 0.5 ? "완벽!" : d < 0.9 ? "좋아요!" : "OK!";
        return { pass: true, hint: quality, debug };
      }
      const hint = getDiffHint(currentNorm, customData.referencePose);
      return { pass: false, hint, debug };
    }
  };
}

function getDiffHint(current, reference) {
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

// ============ 좌표 헬퍼 ============
// MediaPipe 정규화 좌표계 기준 (x: 왼쪽=음수, 오른쪽=양수, y: 위쪽=음수, 아래=양수)
// 어깨 중점을 원점, 어깨폭=1로 정규화한 좌표
//
// 표준 위치:
// - 코: x=0, y=-1.0 (어깨 위)
// - 왼어깨(11): x=-0.5, y=0
// - 오른어깨(12): x=0.5, y=0
// - 보통 팔길이 = 어깨폭 정도
//
// MediaPipe는 "사람 몸 기준"으로 left/right 표시:
// - lm[11]=사람의 왼쪽 어깨 (화면 거울모드면 화면 오른쪽에 보임)
// - lm[15]=사람의 왼손목

// 포즈 빌더 헬퍼: 간단히 자세 정의
function makePose(coords) {
  // coords: { 0: [x,y], 11: [x,y], ... }
  const pose = {};
  for (const [idx, xy] of Object.entries(coords)) {
    pose[idx] = { x: xy[0], y: xy[1], visibility: 1.0 };
  }
  return pose;
}

// ============ 20개 샘플 포즈 정의 ============
// 각 포즈의 reference는 정규화된 좌표 (어깨 중점 원점, 어깨폭 단위)
// 코는 보통 (0, -1.2), 어깨는 (-0.5, 0) (0.5, 0)
// 아래로 떨어진 손은 보통 (-0.5, 1.5) (0.5, 1.5)
// 머리 위 손은 (-0.4, -2.2) (0.4, -2.2)

const SAMPLE_POSES_RAW = [
  // ============ 손 올리기 계열 ============
  {
    id: "sample_both_up",
    name: "양손 번쩍",
    emoji: "🙌",
    instruction: "양손을 머리 위로 번쩍!",
    coords: {
      0:  [0, -1.5],     // 코
      11: [-0.5, 0],     // 왼어깨
      12: [0.5, 0],      // 오른어깨
      13: [-0.7, -1.2],  // 왼팔꿈치 (위로 굽힘)
      14: [0.7, -1.2],   // 오른팔꿈치
      15: [-0.5, -2.5],  // 왼손목 (머리 위)
      16: [0.5, -2.5]    // 오른손목
    }
  },
  {
    id: "sample_left_up",
    name: "왼손 번쩍",
    emoji: "👈",
    instruction: "왼손만 머리 위로!",
    coords: {
      0:  [0, -1.5],
      11: [-0.5, 0],
      12: [0.5, 0],
      13: [-0.7, -1.2],
      14: [0.7, 1.0],    // 오른팔 내림
      15: [-0.5, -2.5],
      16: [0.6, 1.8]
    }
  },
  {
    id: "sample_right_up",
    name: "오른손 번쩍",
    emoji: "👉",
    instruction: "오른손만 머리 위로!",
    coords: {
      0:  [0, -1.5],
      11: [-0.5, 0],
      12: [0.5, 0],
      13: [-0.7, 1.0],
      14: [0.7, -1.2],
      15: [-0.6, 1.8],
      16: [0.5, -2.5]
    }
  },
  {
    id: "sample_y_pose",
    name: "Y 포즈",
    emoji: "🙆",
    instruction: "Y자로 양팔 활짝!",
    coords: {
      0:  [0, -1.5],
      11: [-0.5, 0],
      12: [0.5, 0],
      13: [-1.0, -1.0],   // 팔꿈치 더 위로
      14: [1.0, -1.0],
      15: [-1.4, -1.9],   // 손목 더 위로 (머리보다 위)
      16: [1.4, -1.9]
    }
  },
  {
    id: "sample_v_pose",
    name: "V 포즈",
    emoji: "✌️",
    instruction: "양손 V자로 위로!",
    coords: {
      0:  [0, -1.5],
      11: [-0.5, 0],
      12: [0.5, 0],
      13: [-0.8, -1.0],
      14: [0.8, -1.0],
      15: [-1.0, -2.2],
      16: [1.0, -2.2]
    }
  },

  // ============ 팔 벌리기 계열 ============
  {
    id: "sample_t_pose",
    name: "T 포즈",
    emoji: "🤸",
    instruction: "양팔 좌우로 쭉! T자",
    coords: {
      0:  [0, -1.5],
      11: [-0.5, 0],
      12: [0.5, 0],
      13: [-1.1, 0],     // 팔꿈치 안쪽
      14: [1.1, 0],
      15: [-1.7, 0],     // 손목 - 평범한 펼침
      16: [1.7, 0]
    }
  },
  {
    id: "sample_left_arm_side",
    name: "왼팔 옆으로",
    emoji: "⬅️",
    instruction: "왼팔만 옆으로 쭉!",
    coords: {
      0:  [0, -1.5],
      11: [-0.5, 0],
      12: [0.5, 0],
      13: [-1.5, 0],
      14: [0.7, 1.0],
      15: [-2.5, 0],
      16: [0.6, 1.8]
    }
  },
  {
    id: "sample_right_arm_side",
    name: "오른팔 옆으로",
    emoji: "➡️",
    instruction: "오른팔만 옆으로 쭉!",
    coords: {
      0:  [0, -1.5],
      11: [-0.5, 0],
      12: [0.5, 0],
      13: [-0.7, 1.0],
      14: [1.5, 0],
      15: [-0.6, 1.8],
      16: [2.5, 0]
    }
  },
  {
    id: "sample_wing",
    name: "날개 포즈",
    emoji: "🦋",
    instruction: "양팔 V자로 아래쪽 벌리기",
    coords: {
      0:  [0, -1.5],
      11: [-0.5, 0],
      12: [0.5, 0],
      13: [-0.7, 0.6],   // 팔꿈치 더 안쪽
      14: [0.7, 0.6],
      15: [-1.1, 1.1],   // 손목 더 안쪽
      16: [1.1, 1.1]
    }
  },

  // ============ 가슴 동작 ============
  {
    id: "sample_arms_cross",
    name: "팔짱 끼기",
    emoji: "🫂",
    instruction: "가슴 앞에서 양팔 교차",
    coords: {
      0:  [0, -1.5],
      11: [-0.5, 0],
      12: [0.5, 0],
      13: [-0.7, 0.5],
      14: [0.7, 0.5],
      15: [0.4, 0.6],
      16: [-0.4, 0.6]
    }
  },
  {
    id: "sample_heart",
    name: "하트 만들기",
    emoji: "❤️",
    instruction: "양손으로 가슴에 하트 모양",
    coords: {
      0:  [0, -1.5],
      11: [-0.5, 0],
      12: [0.5, 0],
      13: [-0.5, 0.5],
      14: [0.5, 0.5],
      15: [-0.15, 0.6],
      16: [0.15, 0.6]
    }
  },
  {
    id: "sample_clap",
    name: "박수",
    emoji: "👏",
    instruction: "가슴 앞에서 양손 모으기",
    coords: {
      0:  [0, -1.5],
      11: [-0.5, 0],
      12: [0.5, 0],
      13: [-0.4, 0.4],
      14: [0.4, 0.4],
      15: [0.0, 0.4],
      16: [0.0, 0.4]
    }
  },

  // ============ 머리/얼굴 근처 ============
  {
    id: "sample_hands_on_head",
    name: "머리 위 양손",
    emoji: "💁",
    instruction: "양손을 머리 위에 올려놓기",
    coords: {
      0:  [0, -1.5],
      11: [-0.5, 0],
      12: [0.5, 0],
      13: [-0.7, -0.7],
      14: [0.7, -0.7],
      15: [-0.4, -1.8],
      16: [0.4, -1.8]
    }
  },
  {
    id: "sample_hands_on_ears",
    name: "양손 귀 옆",
    emoji: "🙉",
    instruction: "양손을 귀 옆에",
    coords: {
      0:  [0, -1.5],
      11: [-0.5, 0],
      12: [0.5, 0],
      13: [-0.7, -0.6],
      14: [0.7, -0.6],
      15: [-0.5, -1.4],
      16: [0.5, -1.4]
    }
  },
  {
    id: "sample_thinker",
    name: "생각하는 자세",
    emoji: "🤔",
    instruction: "한 손을 턱에 (왼손 턱)",
    coords: {
      0:  [0, -1.5],
      11: [-0.5, 0],
      12: [0.5, 0],
      13: [-0.4, -0.3],
      14: [0.7, 1.0],
      15: [-0.1, -1.2],
      16: [0.6, 1.8]
    }
  },

  // ============ 어깨/대각선 동작 ============
  {
    id: "sample_self_hug",
    name: "셀프 허그",
    emoji: "🤗",
    instruction: "양손으로 반대편 어깨 잡기",
    coords: {
      0:  [0, -1.5],
      11: [-0.5, 0],
      12: [0.5, 0],
      13: [-0.3, 0.3],
      14: [0.3, 0.3],
      15: [0.5, 0.0],
      16: [-0.5, 0.0]
    }
  },
  {
    id: "sample_left_to_right_shoulder",
    name: "왼손→오른어깨",
    emoji: "💆",
    instruction: "왼손을 오른쪽 어깨에",
    coords: {
      0:  [0, -1.5],
      11: [-0.5, 0],
      12: [0.5, 0],
      13: [-0.2, 0.2],
      14: [0.7, 1.0],
      15: [0.5, 0.0],
      16: [0.6, 1.8]
    }
  },

  // ============ 댄스 자세 ============
  {
    id: "sample_disco",
    name: "디스코 포인트",
    emoji: "🕺",
    instruction: "오른손 위, 왼손 아래 (디스코)",
    coords: {
      0:  [0, -1.5],
      11: [-0.5, 0],
      12: [0.5, 0],
      13: [-0.6, 0.9],
      14: [0.8, -0.8],
      15: [-0.7, 1.6],
      16: [1.2, -1.8]
    }
  },
  {
    id: "sample_workout",
    name: "양팔 L자 (알통)",
    emoji: "💪",
    instruction: "양팔 직각으로 굽혀 위로!",
    coords: {
      0:  [0, -1.5],
      11: [-0.5, 0],
      12: [0.5, 0],
      13: [-1.0, 0],
      14: [1.0, 0],
      15: [-1.0, -1.2],
      16: [1.0, -1.2]
    }
  },
  {
    id: "sample_finale",
    name: "피날레",
    emoji: "🎉",
    instruction: "양손 활짝 위로!",
    coords: {
      0:  [0, -1.5],
      11: [-0.5, 0],
      12: [0.5, 0],
      13: [-0.9, -0.9],
      14: [0.9, -0.9],
      15: [-1.3, -1.9],
      16: [1.3, -1.9]
    }
  }
];

// 변환: 좌표 → reference pose 객체
export const SAMPLE_POSES = SAMPLE_POSES_RAW.map(raw => ({
  id: raw.id,
  name: raw.name,
  emoji: raw.emoji,
  instruction: raw.instruction,
  isSample: true,
  referencePose: makePose(raw.coords),
  createdAt: "sample"
}));

// ============ 하위 호환성: POSE_LIBRARY (id로 접근) ============
export const POSE_LIBRARY = {};
SAMPLE_POSES.forEach(p => {
  POSE_LIBRARY[p.id] = createCustomPose(p);
});

// ============ 싱글 모드용 ============
export const POSES = SAMPLE_POSES.slice(0, 15).map(p => createCustomPose(p));

// ============ 기본 시퀀스 ============
export const SEQUENCES = [
  {
    id: "demo",
    name: "기본 데모 ✨",
    description: "샘플 동작 4개",
    difficulty: "easy",
    stepHoldMs: 300,
    stepWindowMs: 10000,
    steps: ["sample_both_up", "sample_t_pose", "sample_left_up", "sample_right_up"]
  }
];
