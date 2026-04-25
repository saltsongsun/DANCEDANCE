import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/vision_bundle.mjs";

import {
  POSES, POSE_LIBRARY, SEQUENCES, READY_POSE,
  normalizePose, createCustomPose
} from "/poses.js";

// ============ DOM ============
const startScreen = document.getElementById("startScreen");
const recordScreen = document.getElementById("recordScreen");
const sequenceSelectScreen = document.getElementById("sequenceSelectScreen");
const gameScreen = document.getElementById("gameScreen");
const endScreen = document.getElementById("endScreen");
const restartBtn = document.getElementById("restartBtn");

// 녹화 관련
const recordVideo = document.getElementById("recordVideo");
const recordCanvas = document.getElementById("recordCanvas");
const recordCtx = recordCanvas.getContext("2d");
const recordCountdown = document.getElementById("recordCountdown");
const recordCountdownNumber = document.getElementById("recordCountdownNumber");
const captureFlash = document.getElementById("captureFlash");
const recordLoadingOverlay = document.getElementById("recordLoadingOverlay");
const recordLoadingText = document.getElementById("recordLoadingText");
const capturedPreview = document.getElementById("capturedPreview");
const capturedSvg = document.getElementById("capturedSvg");
const recordBtn = document.getElementById("recordBtn");
const recordFormFields = document.getElementById("recordFormFields");
const customName = document.getElementById("customName");
const customInstruction = document.getElementById("customInstruction");
const emojiPicker = document.getElementById("emojiPicker");
const recordRetryBtn = document.getElementById("recordRetryBtn");
const recordSaveBtn = document.getElementById("recordSaveBtn");
const savedPosesList = document.getElementById("savedPosesList");
const savedPoseCount = document.getElementById("savedPoseCount");

// 게임 관련
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const stepLabel = document.getElementById("stepLabel");
const poseName = document.getElementById("poseName");
const poseEmoji = document.getElementById("poseEmoji");
const poseInstruction = document.getElementById("poseInstruction");
const progressFill = document.getElementById("progressFill");
const comboBadge = document.getElementById("comboBadge");
const comboCount = document.getElementById("comboCount");

const feedback = document.getElementById("feedback");
const holdTimer = document.getElementById("holdTimer");
const timerCircle = document.getElementById("timerCircle");
const timerText = document.getElementById("timerText");
const successOverlay = document.getElementById("successOverlay");
const missOverlay = document.getElementById("missOverlay");
const loadingOverlay = document.getElementById("loadingOverlay");
const loadingText = document.getElementById("loadingText");
const readyBanner = document.getElementById("readyBanner");
const readyBannerText = document.getElementById("readyBannerText");

const sequencePreview = document.getElementById("sequencePreview");
const stepCountdown = document.getElementById("stepCountdown");
const stepCountdownText = document.getElementById("stepCountdownText");

const missionPreview = document.getElementById("missionPreview");
const previewEmoji = document.getElementById("previewEmoji");
const previewName = document.getElementById("previewName");
const previewInstruction = document.getElementById("previewInstruction");
const previewCountdown = document.getElementById("previewCountdown");

const totalTimeEl = document.getElementById("totalTime");
const totalScoreEl = document.getElementById("totalScore");
const endSubtitle = document.getElementById("endSubtitle");
const extraStats = document.getElementById("extraStats");

const debugPanel = document.getElementById("debugPanel");
const debugToggle = document.getElementById("debugToggle");
const skipBtn = document.getElementById("skipBtn");

// 빌더
const myPosesGrid = document.getElementById("myPosesGrid");
const myPosesEmpty = document.getElementById("myPosesEmpty");
const defaultPosesGrid = document.getElementById("defaultPosesGrid");
const builderSteps = document.getElementById("builderSteps");
const builderStepCount = document.getElementById("builderStepCount");
const routineName = document.getElementById("routineName");
const builderClearBtn = document.getElementById("builderClearBtn");
const builderPlayBtn = document.getElementById("builderPlayBtn");
const builderSaveBtn = document.getElementById("builderSaveBtn");
const savedRoutinesSection = document.getElementById("savedRoutinesSection");
const savedRoutinesList = document.getElementById("savedRoutinesList");

// ============ 설정 ============
const CONFIG = {
  modelType: 'full',
  visualSmoothing: 0.4,
  voteFrames: 5,
  voteThreshold: 2,
  passDebounceMs: 350,
  minDetectionConfidence: 0.5,
  minPresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
  countdownSeconds: 3,
  recordCountdownSeconds: 5
};

const MODEL_URLS = {
  lite: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  full: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
  heavy: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task"
};

// 이모지 픽커 옵션
const EMOJI_OPTIONS = [
  "💃", "🕺", "🙌", "🙆", "🙋", "🤸", "🤾", "🏃",
  "🤳", "💆", "🫶", "👋", "✋", "🖐️", "👈", "👉",
  "👆", "👇", "🙏", "💪", "🦵", "🦶", "👏", "🤩",
  "🔥", "✨", "⭐", "🎵", "🎶", "🎤", "🎯", "🎉"
];

// ============ localStorage ============
const POSES_KEY = "dance_pose_custom_poses_v1";
const ROUTINES_KEY = "dance_pose_routines_v2";

function loadCustomPoses() {
  try {
    const data = localStorage.getItem(POSES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error(e);
    return [];
  }
}

function saveCustomPoses(poses) {
  localStorage.setItem(POSES_KEY, JSON.stringify(poses));
}

function addCustomPose(pose) {
  const all = loadCustomPoses();
  all.push(pose);
  saveCustomPoses(all);
}

function deleteCustomPose(id) {
  const all = loadCustomPoses().filter(p => p.id !== id);
  saveCustomPoses(all);
}

function loadRoutines() {
  try {
    const data = localStorage.getItem(ROUTINES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) { return []; }
}

function saveRoutines(routines) {
  localStorage.setItem(ROUTINES_KEY, JSON.stringify(routines));
}

function addRoutine(routine) {
  const all = loadRoutines();
  all.push(routine);
  saveRoutines(all);
}

function deleteRoutine(id) {
  saveRoutines(loadRoutines().filter(r => r.id !== id));
}

// ============ 상태 ============
let poseLandmarker = null;
let running = false;
let lastVideoTime = -1;
let stream = null;
let activeVideoEl = null; // recordVideo 또는 video
let activeCanvasEl = null;
let activeCtx = null;
let debugVisible = true;
let frameCount = 0;
let lastFpsTime = performance.now();
let fps = 0;

// 녹화 상태
let recordPhase = "idle"; // idle | countdown | captured
let capturedPoseData = null; // 캡쳐된 정규화 포즈
let selectedEmoji = "💃";

// 게임 상태
let mode = null;
let phase = "ready";
let sessionStartTime = null;
const HOLD_DURATION_MS = 1000;
const READY_HOLD_MS = 800;
let currentPoseIndex = 0;
let holdStartTime = null;

let selectedSequence = null;
let seqStepIndex = 0;
let seqStepStartTime = null;
let seqStepHeldSince = null;
let seqCombo = 0;
let seqMaxCombo = 0;
let seqScore = 0;
let seqSuccessCount = 0;
let seqMissCount = 0;
let visualSmoothedLandmarks = null;
let inPreview = false;

// 빌더 상태
let builderSequence = []; // pose 객체 배열 (id, name, emoji, ...)
let builderDifficulty = "easy";

// 최근 감지된 좌표 (녹화 캡쳐용)
let lastDetectedLandmarks = null;

// ============ 시각 스무딩 ============
function smoothForVisual(current, prev, factor) {
  if (!prev || prev.length !== current.length) return current.map(p => ({ ...p }));
  return current.map((p, i) => {
    const pp = prev[i];
    return {
      x: pp.x * factor + p.x * (1 - factor),
      y: pp.y * factor + p.y * (1 - factor),
      z: (pp.z ?? 0) * factor + (p.z ?? 0) * (1 - factor),
      visibility: p.visibility ?? 1
    };
  });
}

// ============ 투표 + 디바운스 ============
const voteHistory = [];
let lastPassTime = 0;

function decidePass(currentRawPass) {
  voteHistory.push(currentRawPass);
  if (voteHistory.length > CONFIG.voteFrames) voteHistory.shift();
  const passCount = voteHistory.filter(v => v).length;
  const voteSaysPass = passCount >= CONFIG.voteThreshold;
  const now = performance.now();
  const recentlyPassed = (now - lastPassTime) < CONFIG.passDebounceMs;
  const finalPass = voteSaysPass || recentlyPassed;
  if (currentRawPass) lastPassTime = now;
  return { finalPass, voteSaysPass, recentlyPassed, passCount };
}

function resetVote() {
  voteHistory.length = 0;
  lastPassTime = 0;
}

// ============ 화면 전환 ============
function showScreen(screen) {
  [startScreen, recordScreen, sequenceSelectScreen, gameScreen, endScreen].forEach(s => s.classList.remove("active"));
  screen.classList.add("active");
}

// ============ MediaPipe ============
async function initPoseLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm"
  );
  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_URLS[CONFIG.modelType],
      delegate: "GPU"
    },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: CONFIG.minDetectionConfidence,
    minPosePresenceConfidence: CONFIG.minPresenceConfidence,
    minTrackingConfidence: CONFIG.minTrackingConfidence
  });
}

async function initCameraStream(videoEl) {
  const isPortrait = window.innerHeight > window.innerWidth;
  const constraints = isPortrait
    ? {
        video: {
          width: { ideal: 720, min: 480 },
          height: { ideal: 1280, min: 854 },
          facingMode: "user",
          aspectRatio: { ideal: 9/16 }
        },
        audio: false
      }
    : {
        video: {
          width: { ideal: 1280, min: 854 },
          height: { ideal: 720, min: 480 },
          facingMode: "user"
        },
        audio: false
      };
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (e) {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
  }
  videoEl.srcObject = stream;
  await new Promise(resolve => {
    videoEl.onloadedmetadata = () => resolve();
  });
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
}

// ============ 통합 메인 루프 (녹화 화면 / 게임 화면 모두) ============
function predictLoop() {
  if (!running) return;
  frameCount++;
  const now = performance.now();
  if (now - lastFpsTime >= 1000) {
    fps = frameCount;
    frameCount = 0;
    lastFpsTime = now;
  }

  if (activeVideoEl && activeVideoEl.readyState >= 2 && activeVideoEl.currentTime !== lastVideoTime) {
    lastVideoTime = activeVideoEl.currentTime;

    // 캔버스 사이즈 동기화
    if (activeCanvasEl.width !== activeVideoEl.videoWidth) {
      activeCanvasEl.width = activeVideoEl.videoWidth;
      activeCanvasEl.height = activeVideoEl.videoHeight;
    }

    const result = poseLandmarker.detectForVideo(activeVideoEl, now);

    if (result.landmarks && result.landmarks.length > 0) {
      lastDetectedLandmarks = result.landmarks[0];
      visualSmoothedLandmarks = smoothForVisual(
        result.landmarks[0],
        visualSmoothedLandmarks,
        CONFIG.visualSmoothing
      );
    } else {
      lastDetectedLandmarks = null;
      visualSmoothedLandmarks = null;
    }

    // 게임 화면일 때만 판정
    if (activeVideoEl === video) {
      const detection = handleDetection(result);
      drawLandmarks(activeCtx, activeCanvasEl, result);
      updateDebugPanel(result, detection.rawResult, detection.decision, detection.isHolding);
    } else {
      // 녹화 화면 - 시각화만
      drawLandmarks(activeCtx, activeCanvasEl, result);
    }
  }
  requestAnimationFrame(predictLoop);
}

function drawLandmarks(targetCtx, targetCanvas, result) {
  targetCtx.save();
  targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
  if (result.landmarks && result.landmarks.length > 0) {
    const drawingUtils = new DrawingUtils(targetCtx);
    const toDraw = visualSmoothedLandmarks || result.landmarks[0];
    drawingUtils.drawLandmarks(toDraw, { radius: 5, color: "#7c5cff", lineWidth: 2 });
    drawingUtils.drawConnectors(toDraw, PoseLandmarker.POSE_CONNECTIONS, {
      color: "#00ffa3",
      lineWidth: 3
    });
  }
  targetCtx.restore();
}

// ============ 녹화 화면 ============
async function enterRecordScreen() {
  showScreen(recordScreen);
  recordLoadingOverlay.classList.remove("hidden");
  recordPhase = "idle";
  capturedPoseData = null;
  recordFormFields.classList.add("hidden");
  capturedPreview.classList.add("hidden");
  recordCountdown.classList.add("hidden");

  try {
    if (!poseLandmarker) {
      recordLoadingText.textContent = "AI 모델 다운로드 중...";
      await initPoseLandmarker();
    }
    recordLoadingText.textContent = "카메라 준비 중...";
    await initCameraStream(recordVideo);
    recordLoadingOverlay.classList.add("hidden");

    // 활성 비디오 = recordVideo
    activeVideoEl = recordVideo;
    activeCanvasEl = recordCanvas;
    activeCtx = recordCtx;
    running = true;
    predictLoop();

    // 이모지 픽커 렌더링 (한번만)
    if (emojiPicker.children.length === 0) {
      renderEmojiPicker();
    }
    renderSavedPosesList();
  } catch (err) {
    recordLoadingOverlay.classList.add("hidden");
    alert("오류: " + err.message);
    showScreen(startScreen);
  }
}

function startRecordCountdown() {
  if (recordPhase !== "idle") return;
  recordPhase = "countdown";
  recordBtn.disabled = true;
  recordCountdown.classList.remove("hidden");

  let count = CONFIG.recordCountdownSeconds;
  recordCountdownNumber.textContent = count;
  // CSS 애니메이션 강제 재시작
  recordCountdownNumber.style.animation = "none";
  void recordCountdownNumber.offsetHeight;
  recordCountdownNumber.style.animation = "";

  const interval = setInterval(() => {
    count--;
    if (count > 0) {
      recordCountdownNumber.textContent = count;
      recordCountdownNumber.style.animation = "none";
      void recordCountdownNumber.offsetHeight;
      recordCountdownNumber.style.animation = "";
    } else {
      clearInterval(interval);
      capturePose();
    }
  }, 1000);
}

function capturePose() {
  recordCountdown.classList.add("hidden");

  // 플래시 애니메이션
  captureFlash.classList.remove("hidden");
  setTimeout(() => captureFlash.classList.add("hidden"), 400);

  // 현재 포즈 캡쳐
  if (!lastDetectedLandmarks) {
    alert("자세를 인식하지 못했어요. 다시 시도해주세요.");
    recordPhase = "idle";
    recordBtn.disabled = false;
    return;
  }

  const normalized = normalizePose(lastDetectedLandmarks);
  if (!normalized) {
    alert("자세를 정규화하지 못했어요. 카메라 앞에 똑바로 서주세요.");
    recordPhase = "idle";
    recordBtn.disabled = false;
    return;
  }

  capturedPoseData = normalized;
  recordPhase = "captured";

  // 캡쳐된 포즈를 SVG로 시각화
  setTimeout(() => {
    renderCapturedSvg(normalized);
    capturedPreview.classList.remove("hidden");
    setTimeout(() => {
      capturedPreview.classList.add("hidden");
      // 폼 표시
      recordFormFields.classList.remove("hidden");
      customName.focus();
      recordBtn.disabled = false;
      recordBtn.querySelector(".record-btn-text").textContent = "다시 녹화 (5초 후)";
    }, 1500);
  }, 200);
}

function renderCapturedSvg(normalized) {
  // SVG에 정규화된 포즈를 그림
  capturedSvg.innerHTML = "";
  const ns = "http://www.w3.org/2000/svg";

  // 연결선 (어깨-팔꿈치-손목)
  const connections = [
    [11, 13], [13, 15], // 왼팔
    [12, 14], [14, 16], // 오른팔
    [11, 12], // 어깨선
    [0, 11], [0, 12]    // 코-어깨
  ];

  for (const [a, b] of connections) {
    const pa = normalized[a];
    const pb = normalized[b];
    if (!pa || !pb) continue;
    const line = document.createElementNS(ns, "line");
    line.setAttribute("x1", pa.x);
    line.setAttribute("y1", pa.y);
    line.setAttribute("x2", pb.x);
    line.setAttribute("y2", pb.y);
    line.setAttribute("stroke", "#00ffa3");
    line.setAttribute("stroke-width", "0.05");
    line.setAttribute("stroke-linecap", "round");
    capturedSvg.appendChild(line);
  }

  // 점
  for (const i of [0, 11, 12, 13, 14, 15, 16]) {
    const p = normalized[i];
    if (!p) continue;
    const c = document.createElementNS(ns, "circle");
    c.setAttribute("cx", p.x);
    c.setAttribute("cy", p.y);
    c.setAttribute("r", "0.08");
    c.setAttribute("fill", "#7c5cff");
    capturedSvg.appendChild(c);
  }
}

function renderEmojiPicker() {
  emojiPicker.innerHTML = "";
  EMOJI_OPTIONS.forEach((emoji, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "emoji-option";
    btn.textContent = emoji;
    if (idx === 0) btn.classList.add("selected");
    btn.addEventListener("click", () => {
      document.querySelectorAll(".emoji-option").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedEmoji = emoji;
    });
    emojiPicker.appendChild(btn);
  });
  selectedEmoji = EMOJI_OPTIONS[0];
}

function checkSaveButtonState() {
  const hasName = customName.value.trim().length > 0;
  const hasInstruction = customInstruction.value.trim().length > 0;
  const hasPose = capturedPoseData !== null;
  recordSaveBtn.disabled = !(hasName && hasPose);
}

function saveCurrentRecord() {
  if (!capturedPoseData) return;
  const name = customName.value.trim();
  if (!name) return;

  const newPose = {
    id: `custom_${Date.now()}`,
    name: name,
    emoji: selectedEmoji,
    instruction: customInstruction.value.trim() || `${name} 자세`,
    referencePose: capturedPoseData,
    createdAt: new Date().toISOString()
  };

  addCustomPose(newPose);
  showToast(`✅ "${name}" 저장됨!`);

  // 폼 초기화
  customName.value = "";
  customInstruction.value = "";
  capturedPoseData = null;
  recordPhase = "idle";
  recordFormFields.classList.add("hidden");
  recordBtn.querySelector(".record-btn-text").textContent = "5초 후 녹화";

  renderSavedPosesList();
}

function renderSavedPosesList() {
  const poses = loadCustomPoses();
  savedPoseCount.textContent = poses.length;

  if (poses.length === 0) {
    savedPosesList.innerHTML = `<div class="saved-poses-empty">아직 저장된 동작이 없어요<br>위 버튼을 눌러 첫 동작을 녹화해보세요!</div>`;
    return;
  }

  savedPosesList.innerHTML = "";
  poses.forEach(pose => {
    const card = document.createElement("div");
    card.className = "saved-pose-card";
    card.innerHTML = `
      <button class="pose-delete" title="삭제">✕</button>
      <div class="pose-emoji-large">${pose.emoji}</div>
      <div class="pose-card-name">${pose.name}</div>
    `;
    card.querySelector(".pose-delete").addEventListener("click", () => {
      if (confirm(`"${pose.name}"을(를) 삭제할까요?`)) {
        deleteCustomPose(pose.id);
        renderSavedPosesList();
      }
    });
    savedPosesList.appendChild(card);
  });
}

function showToast(msg) {
  const toast = document.createElement("div");
  toast.style.cssText = `
    position: fixed;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--success);
    color: #000;
    padding: 14px 24px;
    border-radius: 12px;
    font-weight: 700;
    z-index: 1000;
    animation: scaleIn 0.3s ease;
    max-width: 90%;
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

function leaveRecordScreen() {
  running = false;
  stopCamera();
  recordPhase = "idle";
  capturedPoseData = null;
  customName.value = "";
  customInstruction.value = "";
  recordFormFields.classList.add("hidden");
  capturedPreview.classList.add("hidden");
  recordCountdown.classList.add("hidden");
}

// ============ 시퀀스 선택 / 빌더 ============
function buildAllAvailablePoses() {
  // 모든 사용 가능한 포즈 (id로 접근)
  const all = { ...POSE_LIBRARY };
  loadCustomPoses().forEach(cp => {
    all[cp.id] = createCustomPose(cp);
  });
  return all;
}

function enterSequenceScreen() {
  showScreen(sequenceSelectScreen);
  builderSequence = [];
  routineName.value = "";
  builderDifficulty = "easy";
  document.querySelectorAll(".diff-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.diff === "easy");
  });
  renderBuilderSteps();
  renderPoseLibraries();
  renderSavedRoutines();
}

function renderPoseLibraries() {
  // 내 동작
  const customPoses = loadCustomPoses();
  myPosesGrid.innerHTML = "";
  if (customPoses.length === 0) {
    myPosesGrid.classList.add("hidden");
    myPosesEmpty.classList.remove("hidden");
  } else {
    myPosesGrid.classList.remove("hidden");
    myPosesEmpty.classList.add("hidden");
    customPoses.forEach(pose => {
      const card = document.createElement("button");
      card.className = "pose-lib-card is-custom";
      card.innerHTML = `
        <div class="pose-lib-emoji">${pose.emoji}</div>
        <div class="pose-lib-name">${pose.name}</div>
      `;
      card.addEventListener("click", () => {
        builderSequence.push({ id: pose.id, name: pose.name, emoji: pose.emoji, isCustom: true });
        renderBuilderSteps();
      });
      myPosesGrid.appendChild(card);
    });
  }

  // 기본 동작
  defaultPosesGrid.innerHTML = "";
  Object.values(POSE_LIBRARY).forEach(pose => {
    const card = document.createElement("button");
    card.className = "pose-lib-card";
    card.innerHTML = `
      <div class="pose-lib-emoji">${pose.emoji}</div>
      <div class="pose-lib-name">${pose.name}</div>
    `;
    card.addEventListener("click", () => {
      builderSequence.push({ id: pose.id, name: pose.name, emoji: pose.emoji, isCustom: false });
      renderBuilderSteps();
    });
    defaultPosesGrid.appendChild(card);
  });
}

function renderBuilderSteps() {
  builderStepCount.textContent = `(${builderSequence.length}개)`;
  builderPlayBtn.disabled = builderSequence.length === 0;
  builderSaveBtn.disabled = !routineName.value.trim() || builderSequence.length === 0;

  if (builderSequence.length === 0) {
    builderSteps.innerHTML = '<div class="builder-empty">위에서 동작을 탭하여 추가하세요</div>';
    return;
  }
  builderSteps.innerHTML = "";
  builderSequence.forEach((step, i) => {
    const el = document.createElement("div");
    el.className = "builder-step";
    el.innerHTML = `
      <div class="builder-step-num">${i + 1}</div>
      <div class="builder-step-emoji">${step.emoji}</div>
      <div class="builder-step-name">${step.name}</div>
    `;
    el.addEventListener("click", () => {
      builderSequence.splice(i, 1);
      renderBuilderSteps();
    });
    builderSteps.appendChild(el);
  });
}

function renderSavedRoutines() {
  const routines = loadRoutines();
  if (routines.length === 0) {
    savedRoutinesSection.classList.add("hidden");
    return;
  }
  savedRoutinesSection.classList.remove("hidden");
  savedRoutinesList.innerHTML = "";
  routines.forEach(routine => {
    const card = document.createElement("div");
    card.className = "sequence-card";
    card.innerHTML = `
      <div class="sequence-info">
        <div class="sequence-name">${routine.name}</div>
        <div class="sequence-desc">${routine.description}</div>
      </div>
      <button class="sequence-delete-btn" title="삭제">🗑</button>
      <div style="font-size:1.3rem;color:var(--primary);">▶</div>
    `;
    card.addEventListener("click", (e) => {
      if (e.target.classList.contains("sequence-delete-btn")) return;
      playRoutine(routine);
    });
    card.querySelector(".sequence-delete-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm(`"${routine.name}" 삭제?`)) {
        deleteRoutine(routine.id);
        renderSavedRoutines();
      }
    });
    savedRoutinesList.appendChild(card);
  });
}

function clearBuilder() {
  builderSequence = [];
  routineName.value = "";
  renderBuilderSteps();
}

function saveCurrentRoutine() {
  const name = routineName.value.trim();
  if (!name || builderSequence.length === 0) return;

  const timing = {
    easy:   { stepHoldMs: 400, stepWindowMs: 4000 },
    medium: { stepHoldMs: 350, stepWindowMs: 3000 },
    hard:   { stepHoldMs: 300, stepWindowMs: 2500 }
  }[builderDifficulty];

  const routine = {
    id: `routine_${Date.now()}`,
    name: name,
    description: `${builderSequence.length}동작 · 내 루틴`,
    difficulty: builderDifficulty,
    stepHoldMs: timing.stepHoldMs,
    stepWindowMs: timing.stepWindowMs,
    steps: builderSequence.map(s => s.id),
    createdAt: new Date().toISOString()
  };
  addRoutine(routine);
  showToast(`✅ "${name}" 루틴 저장!`);
  renderSavedRoutines();
}

function playCurrentBuilder() {
  if (builderSequence.length === 0) return;
  const timing = {
    easy:   { stepHoldMs: 400, stepWindowMs: 4000 },
    medium: { stepHoldMs: 350, stepWindowMs: 3000 },
    hard:   { stepHoldMs: 300, stepWindowMs: 2500 }
  }[builderDifficulty];
  const tempRoutine = {
    id: "temp_" + Date.now(),
    name: routineName.value.trim() || "내 시퀀스",
    description: `${builderSequence.length}동작`,
    difficulty: builderDifficulty,
    stepHoldMs: timing.stepHoldMs,
    stepWindowMs: timing.stepWindowMs,
    steps: builderSequence.map(s => s.id)
  };
  playRoutine(tempRoutine);
}

function playRoutine(routine) {
  selectedSequence = routine;
  mode = "sequence";
  startGame();
}

// ============ 게임 시작 ============
async function startGame() {
  showScreen(gameScreen);
  loadingOverlay.classList.remove("hidden");

  if (mode === "sequence") {
    sequencePreview.classList.remove("hidden");
  } else {
    sequencePreview.classList.add("hidden");
    stepCountdown.classList.add("hidden");
  }

  try {
    if (!poseLandmarker) await initPoseLandmarker();
    await initCameraStream(video);
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    loadingOverlay.classList.add("hidden");

    activeVideoEl = video;
    activeCanvasEl = canvas;
    activeCtx = ctx;

    phase = "ready";
    currentPoseIndex = 0;
    seqStepIndex = 0;
    holdStartTime = null;
    visualSmoothedLandmarks = null;
    inPreview = false;
    resetVote();
    updatePoseUI();
    showReadyBanner("카메라 앞에 서주세요 👀");
    setFeedback("양손을 머리 위로 올려 시작!", "");
    running = true;
    predictLoop();
  } catch (err) {
    console.error(err);
    loadingOverlay.classList.add("hidden");
    alert("오류: " + err.message);
    showScreen(startScreen);
  }
}

// 현재 활성 포즈 객체 가져오기
function getActivePose() {
  if (phase === "ready") return READY_POSE;
  if (mode === "single") return POSES[currentPoseIndex];
  if (mode === "sequence") {
    const stepId = selectedSequence.steps[seqStepIndex];
    const allPoses = buildAllAvailablePoses();
    return allPoses[stepId];
  }
  return null;
}

function updatePoseUI() {
  const pose = getActivePose();
  if (phase === "ready") {
    poseName.textContent = READY_POSE.name;
    poseEmoji.textContent = READY_POSE.emoji;
    poseInstruction.textContent = READY_POSE.instruction;
    stepLabel.textContent = "준비";
    progressFill.style.width = "0%";
    comboBadge.classList.add("hidden");
    return;
  }

  if (!pose) return;

  poseName.textContent = pose.name;
  poseEmoji.textContent = pose.emoji;
  poseInstruction.textContent = pose.instruction;

  if (mode === "single") {
    stepLabel.textContent = `${currentPoseIndex + 1} / ${POSES.length}`;
    progressFill.style.width = `${(currentPoseIndex / POSES.length) * 100}%`;
    comboBadge.classList.add("hidden");
  } else if (mode === "sequence") {
    stepLabel.textContent = `${seqStepIndex + 1} / ${selectedSequence.steps.length}`;
    progressFill.style.width = `${(seqStepIndex / selectedSequence.steps.length) * 100}%`;
    if (seqCombo > 0) {
      comboBadge.classList.remove("hidden");
      comboCount.textContent = seqCombo;
    } else {
      comboBadge.classList.add("hidden");
    }
    renderSequencePreviewUI();
  }
}

function renderSequencePreviewUI() {
  if (mode !== "sequence" || !selectedSequence) {
    sequencePreview.classList.add("hidden");
    return;
  }
  sequencePreview.classList.remove("hidden");
  sequencePreview.innerHTML = "";
  const allPoses = buildAllAvailablePoses();
  selectedSequence.steps.forEach((stepId, i) => {
    const dot = document.createElement("div");
    dot.className = "seq-dot";
    const pose = allPoses[stepId];
    dot.textContent = pose?.emoji || "?";
    if (i < seqStepIndex) dot.classList.add("done");
    else if (i === seqStepIndex) dot.classList.add("current");
    sequencePreview.appendChild(dot);
  });
}

function updateTimerUI(elapsedMs, totalMs) {
  const ratio = Math.min(elapsedMs / totalMs, 1);
  timerCircle.style.strokeDashoffset = 283 * (1 - ratio);
  const remaining = Math.max((totalMs - elapsedMs) / 1000, 0);
  timerText.textContent = remaining.toFixed(1);
}

function showTimer() { holdTimer.classList.remove("hidden"); }
function hideTimer() {
  holdTimer.classList.add("hidden");
  timerCircle.style.strokeDashoffset = 283;
}

function showSuccessFlash(msg = "✨ 성공! ✨") {
  successOverlay.querySelector(".success-text").textContent = msg;
  successOverlay.classList.remove("hidden");
  setTimeout(() => successOverlay.classList.add("hidden"), 700);
}
function showMissFlash() {
  missOverlay.classList.remove("hidden");
  setTimeout(() => missOverlay.classList.add("hidden"), 600);
}
function showReadyBanner(text) {
  readyBannerText.textContent = text;
  readyBanner.classList.remove("hidden");
}
function hideReadyBanner() { readyBanner.classList.add("hidden"); }
function setFeedback(text, type = "") {
  feedback.textContent = text;
  feedback.className = "feedback" + (type ? " " + type : "");
}

function showMissionPreview(pose) {
  return new Promise(resolve => {
    inPreview = true;
    previewEmoji.textContent = pose.emoji;
    previewName.textContent = pose.name;
    previewInstruction.textContent = pose.instruction;
    previewCountdown.classList.remove("go");
    previewCountdown.textContent = CONFIG.countdownSeconds;
    missionPreview.classList.remove("hidden");

    let count = CONFIG.countdownSeconds;
    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        previewCountdown.textContent = count;
      } else if (count === 0) {
        previewCountdown.textContent = "GO!";
        previewCountdown.classList.add("go");
      } else {
        clearInterval(interval);
        missionPreview.classList.add("hidden");
        inPreview = false;
        resolve();
      }
    }, 1000);
  });
}

async function startMainGame() {
  phase = "playing";
  sessionStartTime = performance.now();
  hideReadyBanner();
  resetVote();

  if (mode === "single") {
    currentPoseIndex = 0;
    holdStartTime = null;
    updatePoseUI();
    await showMissionPreview(POSES[0]);
    setFeedback("자세!", "");
  } else {
    seqStepIndex = 0;
    seqStepHeldSince = null;
    seqCombo = 0;
    seqMaxCombo = 0;
    seqScore = 0;
    seqSuccessCount = 0;
    seqMissCount = 0;
    updatePoseUI();
    await showMissionPreview(getActivePose());
    setFeedback("자세!", "");
    stepCountdown.classList.remove("hidden");
    seqStepStartTime = performance.now();
  }
}

async function advancePoseSingle() {
  showSuccessFlash();
  hideTimer();
  holdStartTime = null;
  resetVote();
  currentPoseIndex++;
  if (currentPoseIndex >= POSES.length) {
    setTimeout(() => finishGame(), 800);
  } else {
    setTimeout(async () => {
      updatePoseUI();
      await showMissionPreview(POSES[currentPoseIndex]);
      setFeedback("자세!", "");
    }, 800);
  }
}

async function advanceStepSeq(success) {
  if (success) {
    seqSuccessCount++;
    seqCombo++;
    if (seqCombo > seqMaxCombo) seqMaxCombo = seqCombo;
    seqScore += 100 + seqCombo * 20;
    showSuccessFlash(seqCombo > 1 ? `🔥 ${seqCombo} 콤보!` : "✨ 성공!");
  } else {
    seqMissCount++;
    seqCombo = 0;
    showMissFlash();
  }
  seqStepHeldSince = null;
  seqStepIndex++;
  resetVote();

  if (seqStepIndex >= selectedSequence.steps.length) {
    stepCountdown.classList.add("hidden");
    setTimeout(() => finishGame(), 800);
  } else {
    setTimeout(async () => {
      updatePoseUI();
      await showMissionPreview(getActivePose());
      setFeedback(seqCombo > 0 ? `🔥 ${seqCombo} 콤보!` : "다음!", seqCombo > 0 ? "ok" : "");
      seqStepStartTime = performance.now();
    }, 600);
  }
}

function finishGame() {
  running = false;
  phase = "done";
  stopCamera();
  const totalSec = Math.round((performance.now() - sessionStartTime) / 1000);
  totalTimeEl.textContent = `${totalSec}초`;
  if (mode === "single") {
    totalScoreEl.textContent = `${POSES.length} / ${POSES.length}`;
    endSubtitle.textContent = `완료!`;
    extraStats.classList.add("hidden");
  } else {
    totalScoreEl.textContent = `${seqScore}점`;
    endSubtitle.textContent = `${selectedSequence.name} 완주!`;
    extraStats.classList.remove("hidden");
    extraStats.innerHTML = `
      ✅ 성공: <b>${seqSuccessCount} / ${selectedSequence.steps.length}</b><br>
      ❌ 놓침: <b>${seqMissCount}</b><br>
      🔥 최고 콤보: <b>${seqMaxCombo}</b>
    `;
  }
  progressFill.style.width = "100%";
  showScreen(endScreen);
}

function vis(lm, i) { return lm[i] ? (lm[i].visibility ?? 1) : 0; }

function updateDebugPanel(result, rawResult, decision, isHolding) {
  if (!debugVisible) {
    debugPanel.classList.add("hidden");
    return;
  }
  debugPanel.classList.remove("hidden");
  let html = `<div class="debug-row"><b>FPS:</b> ${fps}</div>`;
  html += `<div class="debug-row"><b>Phase:</b> ${phase} <b>Hold:</b> ${isHolding ? "ON" : "off"}</div>`;
  if (inPreview) html += `<div class="debug-row debug-warn">⏱ 카운트다운</div>`;
  const pose = getActivePose();
  html += `<div class="debug-row"><b>Pose:</b> ${pose?.name || "-"}${pose?.isCustom ? ' (custom)' : ''}</div>`;

  if (!result.landmarks || result.landmarks.length === 0) {
    html += `<div class="debug-row debug-warn">❌ 감지 안됨</div>`;
  } else {
    html += `<div class="debug-row debug-ok">✓ 감지</div>`;
    if (rawResult && decision) {
      const rc = rawResult.pass ? "debug-ok" : "debug-warn";
      const fc = decision.finalPass ? "debug-ok" : "debug-warn";
      html += `<div class="debug-row ${rc}">Raw: ${rawResult.pass ? "✅" : "❌"} ${rawResult.hint}</div>`;
      html += `<div class="debug-row ${fc}">Final: ${decision.finalPass ? "✅" : "❌"}</div>`;
      if (rawResult.debug) html += `<div class="debug-row debug-data">${rawResult.debug}</div>`;
    }
  }
  debugPanel.innerHTML = html;
}

function isCurrentlyHolding() {
  if (phase === "ready") return holdStartTime !== null;
  if (mode === "single") return holdStartTime !== null;
  if (mode === "sequence") return seqStepHeldSince !== null;
  return false;
}

function handleDetection(result) {
  if (!result.landmarks || result.landmarks.length === 0) {
    if (phase === "ready") showReadyBanner("카메라 앞에 서주세요 👀");
    if (!inPreview) setFeedback("사람이 감지되지 않아요", "warn");
    holdStartTime = null;
    hideTimer();
    resetVote();
    return { rawResult: null, decision: null, isHolding: false };
  }

  const landmarks = result.landmarks[0];
  const worldLandmarks = result.worldLandmarks?.[0] || null;
  const isHolding = isCurrentlyHolding();

  if (inPreview) return { rawResult: null, decision: null, isHolding: false };

  const pose = getActivePose();
  if (!pose) return { rawResult: null, decision: null, isHolding };

  if (phase === "ready") {
    const r = pose.check(landmarks, worldLandmarks, isHolding);
    const decision = decidePass(r.pass);
    showReadyBanner(decision.finalPass ? "좋아요!" : "양손을 머리 위로 🙌");
    if (decision.finalPass) {
      setFeedback(r.hint, "ok");
      if (holdStartTime === null) {
        holdStartTime = performance.now();
        showTimer();
      }
      const elapsed = performance.now() - holdStartTime;
      updateTimerUI(elapsed, READY_HOLD_MS);
      if (elapsed >= READY_HOLD_MS) {
        hideTimer();
        startMainGame();
      }
    } else {
      setFeedback(r.hint, "");
      holdStartTime = null;
      hideTimer();
    }
    return { rawResult: r, decision, isHolding };
  }

  if (mode === "single") {
    const r = pose.check(landmarks, worldLandmarks, isHolding);
    const decision = decidePass(r.pass);
    if (decision.finalPass) {
      setFeedback(r.hint, "ok");
      if (holdStartTime === null) { holdStartTime = performance.now(); showTimer(); }
      const elapsed = performance.now() - holdStartTime;
      updateTimerUI(elapsed, HOLD_DURATION_MS);
      if (elapsed >= HOLD_DURATION_MS) advancePoseSingle();
    } else {
      setFeedback(r.hint, "");
      holdStartTime = null;
      hideTimer();
    }
    return { rawResult: r, decision, isHolding };
  }

  if (mode === "sequence") {
    const r = pose.check(landmarks, worldLandmarks, isHolding);
    const decision = decidePass(r.pass);
    const windowElapsed = performance.now() - seqStepStartTime;
    const windowRemain = selectedSequence.stepWindowMs - windowElapsed;
    stepCountdownText.textContent = Math.max(0, windowRemain / 1000).toFixed(1);
    if (windowRemain <= 0) {
      advanceStepSeq(false);
      return { rawResult: r, decision, isHolding };
    }
    if (decision.finalPass) {
      setFeedback(r.hint, "ok");
      if (seqStepHeldSince === null) seqStepHeldSince = performance.now();
      const heldFor = performance.now() - seqStepHeldSince;
      if (heldFor >= selectedSequence.stepHoldMs) advanceStepSeq(true);
    } else {
      seqStepHeldSince = null;
      setFeedback(r.hint, "");
    }
    return { rawResult: r, decision, isHolding };
  }
  return { rawResult: null, decision: null, isHolding };
}

// ============ 이벤트 ============
document.querySelectorAll("[data-mode]").forEach(btn => {
  btn.addEventListener("click", () => {
    const m = btn.dataset.mode;
    if (m === "record") enterRecordScreen();
    else if (m === "sequence") enterSequenceScreen();
  });
});

document.querySelectorAll("[data-back]").forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.back;
    if (target === "start") {
      leaveRecordScreen();
      stopCamera();
      showScreen(startScreen);
    }
  });
});

restartBtn.addEventListener("click", () => {
  mode = null;
  selectedSequence = null;
  phase = "ready";
  showScreen(startScreen);
});

// 녹화
recordBtn.addEventListener("click", startRecordCountdown);
recordRetryBtn.addEventListener("click", () => {
  capturedPoseData = null;
  recordPhase = "idle";
  recordFormFields.classList.add("hidden");
  recordBtn.querySelector(".record-btn-text").textContent = "5초 후 녹화";
});
recordSaveBtn.addEventListener("click", saveCurrentRecord);
customName.addEventListener("input", checkSaveButtonState);
customInstruction.addEventListener("input", checkSaveButtonState);

// 빌더
builderClearBtn.addEventListener("click", () => {
  if (builderSequence.length > 0 && !confirm("초기화할까요?")) return;
  clearBuilder();
});
builderPlayBtn.addEventListener("click", playCurrentBuilder);
builderSaveBtn.addEventListener("click", saveCurrentRoutine);
routineName.addEventListener("input", () => {
  builderSaveBtn.disabled = !routineName.value.trim() || builderSequence.length === 0;
});
document.querySelectorAll(".diff-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".diff-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    builderDifficulty = btn.dataset.diff;
  });
});

// 디버그
debugToggle.addEventListener("click", () => {
  debugVisible = !debugVisible;
  debugToggle.textContent = debugVisible ? "🐛 ON" : "🐛 OFF";
});
skipBtn.addEventListener("click", () => {
  if (!running || inPreview) return;
  if (phase === "ready") startMainGame();
  else if (mode === "single") advancePoseSingle();
  else if (mode === "sequence") advanceStepSeq(false);
});

debugToggle.textContent = debugVisible ? "🐛 ON" : "🐛 OFF";
