import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/vision_bundle.mjs";

import {
  POSES, POSE_LIBRARY, SEQUENCES, READY_POSE,
  SAMPLE_POSES, normalizePose, createCustomPose
} from "/poses.js";

// ============ DOM ============
const startScreen = document.getElementById("startScreen");
const recordScreen = document.getElementById("recordScreen");
const sequenceSelectScreen = document.getElementById("sequenceSelectScreen");
const challengeSetupScreen = document.getElementById("challengeSetupScreen");
const rhythmSetupScreen = document.getElementById("rhythmSetupScreen");
const mirrorSetupScreen = document.getElementById("mirrorSetupScreen");
const gameScreen = document.getElementById("gameScreen");
const endScreen = document.getElementById("endScreen");
const restartBtn = document.getElementById("restartBtn");

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
const scoreBadge = document.getElementById("scoreBadge");
const scoreNum = document.getElementById("scoreNum");

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
const endTitle = document.getElementById("endTitle");
const endSubtitle = document.getElementById("endSubtitle");
const endCelebration = document.getElementById("endCelebration");
const extraStats = document.getElementById("extraStats");
const starsRow = document.getElementById("starsRow");
const endBestBadge = document.getElementById("endBestBadge");

// 게임 UI
const rhythmTrack = document.getElementById("rhythmTrack");
const rhythmNotes = document.getElementById("rhythmNotes");
const rhythmJudgement = document.getElementById("rhythmJudgement");
const mirrorShowing = document.getElementById("mirrorShowing");
const mirrorShowingEmoji = document.getElementById("mirrorShowingEmoji");
const mirrorShowingName = document.getElementById("mirrorShowingName");
const mirrorShowingProgress = document.getElementById("mirrorShowingProgress");

const debugPanel = document.getElementById("debugPanel");
const debugToggle = document.getElementById("debugToggle");
const skipBtn = document.getElementById("skipBtn");

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

const bestScoreBox = document.getElementById("bestScoreBox");
const bestScoreList = document.getElementById("bestScoreList");

const startChallengeBtn = document.getElementById("startChallengeBtn");
const startRhythmBtn = document.getElementById("startRhythmBtn");
const startMirrorBtn = document.getElementById("startMirrorBtn");

// ============ 정확도 설정 ============
const CONFIG = {
  modelType: 'full',
  visualSmoothing: 0.4,
  // 매우 관대한 투표: 5프레임 중 1프레임만 PASS여도 통과
  voteFrames: 5,
  voteThreshold: 1,
  // 디바운스 길게: 한번 PASS하면 0.6초 동안 PASS 유지
  passDebounceMs: 600,
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

const EMOJI_OPTIONS = [
  "💃", "🕺", "🙌", "🙆", "🙋", "🤸", "🤾", "🏃",
  "🤳", "💆", "🫶", "👋", "✋", "🖐️", "👈", "👉",
  "👆", "👇", "🙏", "💪", "🦵", "🦶", "👏", "🤩",
  "🔥", "✨", "⭐", "🎵", "🎶", "🎤", "🎯", "🎉"
];

// ============ localStorage ============
const POSES_KEY = "dance_pose_custom_poses_v1";
const ROUTINES_KEY = "dance_pose_routines_v2";
const BEST_SCORES_KEY = "dance_pose_best_scores_v1";

function lsLoad(key, fallback = []) {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; }
  catch { return fallback; }
}
function lsSave(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); return true; }
  catch (e) { console.error(e); return false; }
}

const loadCustomPoses = () => lsLoad(POSES_KEY, []);
const saveCustomPoses = (p) => lsSave(POSES_KEY, p);
const addCustomPose = (p) => { const a = loadCustomPoses(); a.push(p); saveCustomPoses(a); };
const deleteCustomPose = (id) => saveCustomPoses(loadCustomPoses().filter(p => p.id !== id));
const loadRoutines = () => lsLoad(ROUTINES_KEY, []);
const saveRoutines = (r) => lsSave(ROUTINES_KEY, r);
const addRoutine = (r) => { const a = loadRoutines(); a.push(r); saveRoutines(a); };
const deleteRoutine = (id) => saveRoutines(loadRoutines().filter(r => r.id !== id));

const loadBestScores = () => lsLoad(BEST_SCORES_KEY, {});
function saveBestScore(mode, score) {
  const all = loadBestScores();
  const prev = all[mode] || 0;
  if (score > prev) {
    all[mode] = score;
    lsSave(BEST_SCORES_KEY, all);
    return true; // 신기록
  }
  return false;
}

// ============ 상태 ============
let poseLandmarker = null;
let running = false;
let lastVideoTime = -1;
let stream = null;
let activeVideoEl = null;
let activeCanvasEl = null;
let activeCtx = null;
let debugVisible = true;
let frameCount = 0;
let lastFpsTime = performance.now();
let fps = 0;
let lastDetectedLandmarks = null;
let visualSmoothedLandmarks = null;

// 녹화
let recordPhase = "idle";
let capturedPoseData = null;
let selectedEmoji = "💃";

// 게임
let mode = null; // "single" | "sequence" | "challenge" | "rhythm" | "mirror"
let phase = "ready"; // "ready" | "playing" | "done"
let sessionStartTime = null;
const HOLD_DURATION_MS = 600; // 1초 → 0.6초 (자세 잡으면 빨리 통과)
const READY_HOLD_MS = 600;
const SINGLE_TIMEOUT_MS = 12000; // 8초 → 12초
let currentPoseIndex = 0;
let holdStartTime = null;
let singleStepStartTime = null; // 싱글 모드 스텝 시작 시각

let selectedSequence = null;
let seqStepIndex = 0;
let seqStepStartTime = null;
let seqStepHeldSince = null;
let seqCombo = 0;
let seqMaxCombo = 0;
let seqScore = 0;
let seqSuccessCount = 0;
let seqMissCount = 0;
let inPreview = false;
let isAdvancing = false; // 동작 전환 중 (detection 일시 무시)

// 챌린지 설정
let challengeCount = 5;
let challengeDifficulty = "easy";

// 리듬 설정
let rhythmBPM = 60;
let rhythmTotalBeats = 8;
let rhythmStartTime = 0;
let rhythmNotesData = []; // [{poseId, hitTime, judged, element}]
let rhythmCurrentNoteIdx = 0;

// 거울 모드
let mirrorRound = 1;
let mirrorSequence = []; // 보여줄 동작들 (라운드마다 추가)
let mirrorPlayIdx = 0;
let mirrorPhase = "show"; // "show" | "play"

// 빌더
let builderSequence = [];
let builderDifficulty = "easy";

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
function resetVote() { voteHistory.length = 0; lastPassTime = 0; }

// ============ 화면 전환 ============
function showScreen(screen) {
  [startScreen, recordScreen, sequenceSelectScreen,
   challengeSetupScreen, rhythmSetupScreen, mirrorSetupScreen,
   gameScreen, endScreen].forEach(s => s.classList.remove("active"));
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

// ============ 메인 루프 ============
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

    if (activeVideoEl === video) {
      const detection = handleDetection(result);
      drawLandmarks(activeCtx, activeCanvasEl, result);
      updateDebugPanel(result, detection.rawResult, detection.decision, detection.isHolding);

      // 리듬 모드 노트 위치 업데이트
      if (mode === "rhythm" && phase === "playing") {
        updateRhythmNotes();
      }
    } else {
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

    activeVideoEl = recordVideo;
    activeCanvasEl = recordCanvas;
    activeCtx = recordCtx;
    running = true;
    predictLoop();

    if (emojiPicker.children.length === 0) renderEmojiPicker();
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
  captureFlash.classList.remove("hidden");
  setTimeout(() => captureFlash.classList.add("hidden"), 400);

  if (!lastDetectedLandmarks) {
    alert("자세를 인식하지 못했어요. 다시 시도해주세요.");
    recordPhase = "idle";
    recordBtn.disabled = false;
    return;
  }
  const normalized = normalizePose(lastDetectedLandmarks);
  if (!normalized) {
    alert("자세 정규화 실패. 카메라 앞에 똑바로 서주세요.");
    recordPhase = "idle";
    recordBtn.disabled = false;
    return;
  }
  capturedPoseData = normalized;
  recordPhase = "captured";
  setTimeout(() => {
    renderCapturedSvg(normalized);
    capturedPreview.classList.remove("hidden");
    setTimeout(() => {
      capturedPreview.classList.add("hidden");
      recordFormFields.classList.remove("hidden");
      customName.focus();
      recordBtn.disabled = false;
      recordBtn.querySelector(".record-btn-text").textContent = "다시 녹화 (5초 후)";
    }, 1500);
  }, 200);
}

function renderCapturedSvg(normalized) {
  capturedSvg.innerHTML = "";
  const ns = "http://www.w3.org/2000/svg";
  const connections = [[11,13],[13,15],[12,14],[14,16],[11,12],[0,11],[0,12]];
  for (const [a, b] of connections) {
    const pa = normalized[a], pb = normalized[b];
    if (!pa || !pb) continue;
    const line = document.createElementNS(ns, "line");
    line.setAttribute("x1", pa.x); line.setAttribute("y1", pa.y);
    line.setAttribute("x2", pb.x); line.setAttribute("y2", pb.y);
    line.setAttribute("stroke", "#00ffa3");
    line.setAttribute("stroke-width", "0.05");
    line.setAttribute("stroke-linecap", "round");
    capturedSvg.appendChild(line);
  }
  for (const i of [0, 11, 12, 13, 14, 15, 16]) {
    const p = normalized[i];
    if (!p) continue;
    const c = document.createElementNS(ns, "circle");
    c.setAttribute("cx", p.x); c.setAttribute("cy", p.y);
    c.setAttribute("r", "0.08"); c.setAttribute("fill", "#7c5cff");
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
      <button class="pose-delete">✕</button>
      <div class="pose-emoji-large">${pose.emoji}</div>
      <div class="pose-card-name">${pose.name}</div>
    `;
    card.querySelector(".pose-delete").addEventListener("click", () => {
      if (confirm(`"${pose.name}" 삭제?`)) {
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
    position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
    background: var(--success); color: #000; padding: 14px 24px;
    border-radius: 12px; font-weight: 700; z-index: 1000;
    animation: scaleIn 0.3s ease; max-width: 90%;
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

function leaveCurrentScreen() {
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

// ============ 빌더 / 시퀀스 ============
function buildAllAvailablePoses() {
  // POSE_LIBRARY에는 이미 SAMPLE_POSES가 포함됨
  const all = { ...POSE_LIBRARY };
  loadCustomPoses().forEach(cp => {
    all[cp.id] = createCustomPose(cp);
  });
  return all;
}

// 모든 샘플 + 커스텀 포즈를 배열로
function getAllPosesArray() {
  const customPoses = loadCustomPoses().map(cp => createCustomPose(cp));
  return [...SAMPLE_POSES.map(p => createCustomPose(p)), ...customPoses];
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
  // 내 동작 (사용자 녹화)
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
      card.innerHTML = `<div class="pose-lib-emoji">${pose.emoji}</div><div class="pose-lib-name">${pose.name}</div>`;
      card.addEventListener("click", () => {
        builderSequence.push({ id: pose.id, name: pose.name, emoji: pose.emoji });
        renderBuilderSteps();
      });
      myPosesGrid.appendChild(card);
    });
  }

  // 샘플 동작 (20개) - "기본 동작" 섹션에 표시
  defaultPosesGrid.innerHTML = "";
  SAMPLE_POSES.forEach(pose => {
    const card = document.createElement("button");
    card.className = "pose-lib-card";
    card.innerHTML = `<div class="pose-lib-emoji">${pose.emoji}</div><div class="pose-lib-name">${pose.name}</div>`;
    card.addEventListener("click", () => {
      builderSequence.push({ id: pose.id, name: pose.name, emoji: pose.emoji });
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
    builderSteps.innerHTML = '<div class="builder-empty">위에서 동작을 탭하여 추가</div>';
    return;
  }
  builderSteps.innerHTML = "";
  builderSequence.forEach((step, i) => {
    const el = document.createElement("div");
    el.className = "builder-step";
    el.innerHTML = `<div class="builder-step-num">${i+1}</div><div class="builder-step-emoji">${step.emoji}</div><div class="builder-step-name">${step.name}</div>`;
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
      <button class="sequence-delete-btn">🗑</button>
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
    easy: { stepHoldMs: 300, stepWindowMs: 6000 },
    medium: { stepHoldMs: 250, stepWindowMs: 4500 },
    hard: { stepHoldMs: 200, stepWindowMs: 3500 }
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
    easy: { stepHoldMs: 300, stepWindowMs: 6000 },
    medium: { stepHoldMs: 250, stepWindowMs: 4500 },
    hard: { stepHoldMs: 200, stepWindowMs: 3500 }
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

// ============ 챌린지 모드 ============
function enterChallengeSetup() {
  // 샘플 20개가 있으니 항상 시작 가능
  showScreen(challengeSetupScreen);
}

function startChallenge() {
  // 샘플 + 커스텀 모두 사용
  const customPoses = loadCustomPoses();
  const allIds = [
    ...SAMPLE_POSES.map(p => p.id),
    ...customPoses.map(p => p.id)
  ];
  const shuffled = [...allIds].sort(() => Math.random() - 0.5);
  const targetCount = challengeCount;
  const steps = [];
  for (let i = 0; i < targetCount; i++) {
    steps.push(shuffled[i % shuffled.length]);
  }

  const timing = {
    easy: { stepHoldMs: 300, stepWindowMs: 6000 },
    medium: { stepHoldMs: 250, stepWindowMs: 4500 },
    hard: { stepHoldMs: 200, stepWindowMs: 3500 }
  }[challengeDifficulty];

  selectedSequence = {
    id: "challenge_" + Date.now(),
    name: `🎯 챌린지 (${challengeDifficulty})`,
    description: `${challengeCount}개 랜덤 동작`,
    stepHoldMs: timing.stepHoldMs,
    stepWindowMs: timing.stepWindowMs,
    steps: steps
  };
  mode = "challenge";
  startGame();
}

// ============ 리듬 모드 ============
function enterRhythmSetup() {
  showScreen(rhythmSetupScreen);
}

function startRhythm() {
  const customPoses = loadCustomPoses();
  const allIds = [
    ...SAMPLE_POSES.map(p => p.id),
    ...customPoses.map(p => p.id)
  ];
  const beatInterval = 60000 / rhythmBPM;

  rhythmNotesData = [];
  for (let i = 0; i < rhythmTotalBeats; i++) {
    rhythmNotesData.push({
      poseId: allIds[Math.floor(Math.random() * allIds.length)],
      hitTime: i * beatInterval,
      judged: false,
      element: null
    });
  }

  selectedSequence = {
    id: "rhythm_" + Date.now(),
    name: `🎵 리듬 (${rhythmBPM} BPM)`,
    description: `${rhythmTotalBeats} beats`,
    steps: rhythmNotesData.map(n => n.poseId),
    bpm: rhythmBPM,
    beatInterval: beatInterval
  };
  mode = "rhythm";
  startGame();
}

function setupRhythmTrack() {
  rhythmTrack.classList.remove("hidden");
  rhythmNotes.innerHTML = "";
  rhythmCurrentNoteIdx = 0;
  const allPoses = buildAllAvailablePoses();

  // 노트 엘리먼트 생성
  rhythmNotesData.forEach((note, i) => {
    const pose = allPoses[note.poseId];
    const el = document.createElement("div");
    el.className = "rhythm-note";
    el.textContent = pose?.emoji || "?";
    rhythmNotes.appendChild(el);
    note.element = el;
  });
}

function updateRhythmNotes() {
  // 노트 위치 갱신: 오른쪽에서 왼쪽으로 흘러감
  const trackWidth = rhythmTrack.clientWidth;
  const judgeLineX = 16 + 30; // 왼쪽 16px + 판정선 두께 절반
  const noteSize = 56;
  const elapsed = performance.now() - rhythmStartTime;

  // 노트는 hitTime일 때 판정선에 도달
  // travelTime = 2초 (오른쪽 끝에서 판정선까지)
  const travelTime = 2000;

  rhythmNotesData.forEach((note, i) => {
    if (!note.element) return;
    const timeToHit = note.hitTime - elapsed;
    // 판정선까지의 거리 (오른쪽: trackWidth, 왼쪽: judgeLineX)
    if (timeToHit > travelTime) {
      // 아직 화면에 안 나타남
      note.element.style.display = "none";
      return;
    }
    note.element.style.display = "flex";
    // ratio: 1 = 시작 위치(오른쪽 끝), 0 = 판정선
    const ratio = Math.max(0, timeToHit / travelTime);
    const x = judgeLineX + ratio * (trackWidth - judgeLineX - noteSize/2);
    note.element.style.left = `${x}px`;

    // 자동 미스 처리: 판정선 통과 후 0.3초 지나면 miss
    if (!note.judged && timeToHit < -300) {
      note.judged = true;
      note.element.classList.add("judged-miss");
      seqMissCount++;
      seqCombo = 0;
      showRhythmJudgement("MISS", "miss");
      updateScoreUI();
    }
  });

  // 모든 노트 종료 체크
  if (rhythmNotesData.every(n => n.judged) ||
      elapsed > rhythmNotesData[rhythmNotesData.length-1].hitTime + 1000) {
    if (phase === "playing") {
      phase = "ending";
      setTimeout(() => finishGame(), 500);
    }
  }
}

function judgeRhythmHit(poseDistance) {
  // 현재 시점에 가장 가까운 미판정 노트 찾기
  const now = performance.now() - rhythmStartTime;
  let closestIdx = -1;
  let closestDiff = Infinity;
  rhythmNotesData.forEach((note, i) => {
    if (note.judged) return;
    const diff = Math.abs(note.hitTime - now);
    if (diff < closestDiff && diff < 500) { // 0.5초 이내만
      closestDiff = diff;
      closestIdx = i;
    }
  });
  if (closestIdx === -1) return;
  const note = rhythmNotesData[closestIdx];

  // 판정: poseDistance도 작아야 (자세도 맞아야)
  if (poseDistance > 0.6) return; // 자세 안 맞으면 무시

  let judgement;
  if (closestDiff < 150 && poseDistance < 0.4) {
    judgement = "perfect";
    seqScore += 200 + seqCombo * 30;
    seqCombo++;
    if (seqCombo > seqMaxCombo) seqMaxCombo = seqCombo;
    seqSuccessCount++;
  } else if (closestDiff < 300) {
    judgement = "good";
    seqScore += 100 + seqCombo * 15;
    seqCombo++;
    if (seqCombo > seqMaxCombo) seqMaxCombo = seqCombo;
    seqSuccessCount++;
  } else {
    judgement = "miss";
    seqMissCount++;
    seqCombo = 0;
  }

  note.judged = true;
  note.element.classList.add(`judged-${judgement}`);
  showRhythmJudgement(judgement.toUpperCase(), judgement);
  updateScoreUI();
}

function showRhythmJudgement(text, cls) {
  rhythmJudgement.textContent = text;
  rhythmJudgement.className = `rhythm-judgement ${cls}`;
  rhythmJudgement.classList.remove("hidden");
  // 강제 reflow로 애니메이션 재시작
  void rhythmJudgement.offsetHeight;
  rhythmJudgement.style.animation = "none";
  void rhythmJudgement.offsetHeight;
  rhythmJudgement.style.animation = "";
  setTimeout(() => rhythmJudgement.classList.add("hidden"), 500);
}

// ============ 거울 모드 ============
function enterMirrorSetup() {
  showScreen(mirrorSetupScreen);
}

function startMirror() {
  mirrorRound = 1;
  mirrorSequence = [];
  mode = "mirror";

  const customPoses = loadCustomPoses();
  const allIds = [
    ...SAMPLE_POSES.map(p => p.id),
    ...customPoses.map(p => p.id)
  ];
  mirrorSequence.push(allIds[Math.floor(Math.random() * allIds.length)]);

  selectedSequence = {
    id: "mirror_" + Date.now(),
    name: "🪞 거울 모드",
    description: `라운드 1`,
    stepHoldMs: 400,
    stepWindowMs: 5000,
    steps: [...mirrorSequence]
  };
  startGame();
}

async function showMirrorSequence() {
  // 시퀀스를 하나씩 보여줌 (각 1.2초)
  const allPoses = buildAllAvailablePoses();
  for (let i = 0; i < mirrorSequence.length; i++) {
    const pose = allPoses[mirrorSequence[i]];
    if (!pose) continue;
    mirrorShowingEmoji.textContent = pose.emoji;
    mirrorShowingName.textContent = pose.name;
    mirrorShowingProgress.textContent = `${i + 1} / ${mirrorSequence.length}`;
    mirrorShowing.classList.remove("hidden");
    // CSS 애니메이션 강제 재시작
    mirrorShowingEmoji.style.animation = "none";
    void mirrorShowingEmoji.offsetHeight;
    mirrorShowingEmoji.style.animation = "";
    await sleep(1200);
  }
  mirrorShowing.classList.add("hidden");
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function startMirrorRound() {
  mirrorPhase = "show";
  // 이번 라운드용 카운터 초기화
  seqSuccessCount = 0;
  seqMissCount = 0;
  setFeedback(`🪞 라운드 ${mirrorRound} - 잘 보세요!`, "");
  await sleep(500);
  await showMirrorSequence();
  // 이제 따라하기 단계
  mirrorPhase = "play";
  mirrorPlayIdx = 0;
  // 시퀀스 동기화
  selectedSequence.steps = [...mirrorSequence];
  selectedSequence.description = `라운드 ${mirrorRound}`;
  seqStepIndex = 0;
  seqStepHeldSince = null;
  resetVote();
  updatePoseUI();
  await showMissionPreview(getActivePose());
  setFeedback("자세!", "");
  stepCountdown.classList.remove("hidden");
  seqStepStartTime = performance.now();
}

async function mirrorAdvance(success) {
  isAdvancing = true;
  if (success) {
    showSuccessFlash();
    seqSuccessCount++;
    seqCombo++;
    if (seqCombo > seqMaxCombo) seqMaxCombo = seqCombo;
    seqScore += 50 + seqCombo * 10;
  } else {
    showMissFlash();
    seqMissCount++;
    seqCombo = 0;
  }
  updateScoreUI();
  resetVote();
  seqStepIndex++;
  seqStepHeldSince = null;
  seqStepStartTime = performance.now() + 999999;

  if (seqStepIndex >= mirrorSequence.length) {
    // 라운드 종료
    const roundCleared = seqMissCount === 0 || seqSuccessCount === mirrorSequence.length;

    if (roundCleared) {
      seqScore += 100 * mirrorRound;
      stepCountdown.classList.add("hidden");
      showSuccessFlash(`🎉 라운드 ${mirrorRound} 클리어!`);
      await sleep(1000);

      mirrorRound++;
      seqSuccessCount = 0;
      seqMissCount = 0;

      const customPoses = loadCustomPoses();
      const allIds = [
        ...SAMPLE_POSES.map(p => p.id),
        ...customPoses.map(p => p.id)
      ];
      mirrorSequence.push(allIds[Math.floor(Math.random() * allIds.length)]);
      await startMirrorRound();
      isAdvancing = false;
    } else {
      stepCountdown.classList.add("hidden");
      await sleep(800);
      isAdvancing = false;
      finishGame();
    }
  } else {
    setTimeout(async () => {
      updatePoseUI();
      await showMissionPreview(getActivePose());
      seqStepStartTime = performance.now();
      isAdvancing = false;
    }, 600);
  }
}

// ============ 게임 시작 (공통) ============
async function startGame() {
  showScreen(gameScreen);
  loadingOverlay.classList.remove("hidden");

  // UI 초기화
  rhythmTrack.classList.add("hidden");
  mirrorShowing.classList.add("hidden");

  if (mode === "sequence" || mode === "challenge" || mode === "rhythm" || mode === "mirror") {
    sequencePreview.classList.remove("hidden");
  } else {
    sequencePreview.classList.add("hidden");
    stepCountdown.classList.add("hidden");
  }

  // 챌린지/리듬은 점수 표시
  if (mode === "challenge" || mode === "rhythm" || mode === "mirror") {
    scoreBadge.classList.remove("hidden");
    scoreNum.textContent = "0";
  } else {
    scoreBadge.classList.add("hidden");
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
    isAdvancing = false;
    seqCombo = 0;
    seqMaxCombo = 0;
    seqScore = 0;
    seqSuccessCount = 0;
    seqMissCount = 0;
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

function getActivePose() {
  if (phase === "ready") return READY_POSE;
  if (mode === "single") return POSES[currentPoseIndex];
  if (mode === "sequence" || mode === "challenge" || mode === "mirror") {
    const stepId = selectedSequence.steps[seqStepIndex];
    const allPoses = buildAllAvailablePoses();
    return allPoses[stepId];
  }
  if (mode === "rhythm") {
    // 리듬 모드는 가장 가까운 미판정 노트
    const now = performance.now() - rhythmStartTime;
    for (const note of rhythmNotesData) {
      if (!note.judged) {
        const allPoses = buildAllAvailablePoses();
        return allPoses[note.poseId];
      }
    }
    return null;
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
  } else if (mode === "mirror") {
    stepLabel.textContent = `R${mirrorRound} · ${seqStepIndex + 1}/${mirrorSequence.length}`;
    progressFill.style.width = `${(seqStepIndex / mirrorSequence.length) * 100}%`;
    if (seqCombo > 0) { comboBadge.classList.remove("hidden"); comboCount.textContent = seqCombo; }
    else comboBadge.classList.add("hidden");
    renderSequencePreviewUI();
  } else {
    stepLabel.textContent = `${seqStepIndex + 1} / ${selectedSequence.steps.length}`;
    progressFill.style.width = `${(seqStepIndex / selectedSequence.steps.length) * 100}%`;
    if (seqCombo > 0) { comboBadge.classList.remove("hidden"); comboCount.textContent = seqCombo; }
    else comboBadge.classList.add("hidden");
    renderSequencePreviewUI();
  }
}

function renderSequencePreviewUI() {
  if (!selectedSequence) {
    sequencePreview.classList.add("hidden");
    return;
  }
  sequencePreview.classList.remove("hidden");
  sequencePreview.innerHTML = "";
  const allPoses = buildAllAvailablePoses();
  const stepsToShow = mode === "mirror" ? mirrorSequence : selectedSequence.steps;
  stepsToShow.forEach((stepId, i) => {
    const dot = document.createElement("div");
    dot.className = "seq-dot";
    const pose = allPoses[stepId];
    dot.textContent = pose?.emoji || "?";
    if (i < seqStepIndex) dot.classList.add("done");
    else if (i === seqStepIndex) dot.classList.add("current");
    sequencePreview.appendChild(dot);
  });
}

function updateScoreUI() {
  scoreNum.textContent = seqScore;
  if (seqCombo > 0) {
    comboBadge.classList.remove("hidden");
    comboCount.textContent = seqCombo;
  } else {
    comboBadge.classList.add("hidden");
  }
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
    if (!pose) { resolve(); return; }
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
      if (count > 0) previewCountdown.textContent = count;
      else if (count === 0) {
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

  if (mode === "rhythm") {
    // 리듬 모드는 미리보기 없이 바로 시작
    setupRhythmTrack();
    rhythmStartTime = performance.now();
    setFeedback("🎵 박자에 맞춰!", "");
    return;
  }

  if (mode === "mirror") {
    // 거울 모드 - 시퀀스 보여주기 시작
    await startMirrorRound();
    return;
  }

  if (mode === "single") {
    currentPoseIndex = 0;
    holdStartTime = null;
    singleStepStartTime = performance.now();
    updatePoseUI();
    await showMissionPreview(POSES[0]);
    setFeedback("자세!", "");
    singleStepStartTime = performance.now(); // 미리보기 끝난 후 다시 시작
  } else {
    // sequence, challenge
    seqStepIndex = 0;
    seqStepHeldSince = null;
    updatePoseUI();
    await showMissionPreview(getActivePose());
    setFeedback("자세!", "");
    stepCountdown.classList.remove("hidden");
    seqStepStartTime = performance.now();
  }
}

async function advancePoseSingle(success = true) {
  isAdvancing = true;
  if (success) {
    showSuccessFlash();
  } else {
    showMissFlash();
    seqMissCount++;
  }
  hideTimer();
  holdStartTime = null;
  resetVote();
  currentPoseIndex++;
  singleStepStartTime = performance.now() + 999999;

  if (currentPoseIndex >= POSES.length) {
    setTimeout(() => finishGame(), 800);
  } else {
    setTimeout(async () => {
      updatePoseUI();
      await showMissionPreview(POSES[currentPoseIndex]);
      singleStepStartTime = performance.now();
      isAdvancing = false;
    }, 800);
  }
}

async function advanceStepSeq(success) {
  if (mode === "mirror") {
    await mirrorAdvance(success);
    return;
  }

  // 전환 시작 - detection 일시 중단
  isAdvancing = true;

  if (success) {
    seqSuccessCount++;
    seqCombo++;
    if (seqCombo > seqMaxCombo) seqMaxCombo = seqCombo;
    const baseScore = mode === "challenge" ? 150 : 100;
    seqScore += baseScore + seqCombo * 20;
    showSuccessFlash(seqCombo > 1 ? `🔥 ${seqCombo} 콤보!` : "✨ 성공!");
  } else {
    seqMissCount++;
    seqCombo = 0;
    showMissFlash();
  }
  updateScoreUI();
  seqStepHeldSince = null;
  seqStepIndex++;
  resetVote();

  // 시간 윈도우 무효화
  seqStepStartTime = performance.now() + 999999;

  if (seqStepIndex >= selectedSequence.steps.length) {
    stepCountdown.classList.add("hidden");
    setTimeout(() => finishGame(), 800);
  } else {
    setTimeout(async () => {
      updatePoseUI();
      await showMissionPreview(getActivePose());
      // 미리보기 끝난 후 정확히 시간 시작
      seqStepStartTime = performance.now();
      isAdvancing = false; // detection 다시 활성화
    }, 600);
  }
}

function calculateStars() {
  // 챌린지 모드: 성공률 기반
  const total = selectedSequence?.steps?.length || 1;
  const rate = seqSuccessCount / total;
  if (rate >= 0.9) return 3;
  if (rate >= 0.6) return 2;
  if (rate >= 0.3) return 1;
  return 0;
}

function finishGame() {
  running = false;
  phase = "done";
  stopCamera();
  rhythmTrack.classList.add("hidden");
  stepCountdown.classList.add("hidden");

  const totalSec = Math.round((performance.now() - sessionStartTime) / 1000);
  totalTimeEl.textContent = `${totalSec}초`;

  let isNewBest = false;

  if (mode === "single") {
    totalScoreEl.textContent = `${POSES.length}/${POSES.length}`;
    endTitle.textContent = "수고하셨어요!";
    endCelebration.textContent = "🎉";
    endSubtitle.textContent = "완료!";
    extraStats.classList.add("hidden");
    starsRow.classList.add("hidden");
  } else if (mode === "challenge") {
    totalScoreEl.textContent = `${seqScore}점`;
    endTitle.textContent = "🎯 챌린지 완료!";
    endCelebration.textContent = "🏆";
    endSubtitle.textContent = `${challengeDifficulty.toUpperCase()} · ${challengeCount}동작`;
    const stars = calculateStars();
    starsRow.classList.remove("hidden");
    starsRow.querySelectorAll(".star").forEach((s, i) => {
      s.classList.toggle("earned", i < stars);
    });
    extraStats.classList.remove("hidden");
    extraStats.innerHTML = `
      ✅ 성공: <b>${seqSuccessCount}/${selectedSequence.steps.length}</b><br>
      ❌ 놓침: <b>${seqMissCount}</b><br>
      🔥 최고 콤보: <b>${seqMaxCombo}</b>
    `;
    isNewBest = saveBestScore(`challenge_${challengeDifficulty}`, seqScore);
  } else if (mode === "rhythm") {
    totalScoreEl.textContent = `${seqScore}점`;
    endTitle.textContent = "🎵 리듬 종료!";
    endCelebration.textContent = "🎶";
    endSubtitle.textContent = `${rhythmBPM} BPM · ${rhythmTotalBeats} beats`;
    starsRow.classList.add("hidden");
    extraStats.classList.remove("hidden");
    extraStats.innerHTML = `
      🎯 정확: <b>${seqSuccessCount}/${rhythmTotalBeats}</b><br>
      ❌ 미스: <b>${seqMissCount}</b><br>
      🔥 최고 콤보: <b>${seqMaxCombo}</b>
    `;
    isNewBest = saveBestScore(`rhythm_${rhythmBPM}`, seqScore);
  } else if (mode === "mirror") {
    totalScoreEl.textContent = `R${mirrorRound - 1}`;
    endTitle.textContent = "🪞 거울 모드 종료";
    endCelebration.textContent = mirrorRound > 5 ? "🏆" : "🎯";
    endSubtitle.textContent = `${mirrorRound - 1} 라운드 클리어!`;
    starsRow.classList.add("hidden");
    extraStats.classList.remove("hidden");
    extraStats.innerHTML = `
      🎯 점수: <b>${seqScore}점</b><br>
      📊 라운드: <b>${mirrorRound - 1}</b>
    `;
    isNewBest = saveBestScore("mirror", mirrorRound - 1);
  } else {
    totalScoreEl.textContent = `${seqScore}점`;
    endTitle.textContent = "💃 완주!";
    endCelebration.textContent = "🎉";
    endSubtitle.textContent = `${selectedSequence.name}`;
    starsRow.classList.add("hidden");
    extraStats.classList.remove("hidden");
    extraStats.innerHTML = `
      ✅ 성공: <b>${seqSuccessCount}/${selectedSequence.steps.length}</b><br>
      ❌ 놓침: <b>${seqMissCount}</b><br>
      🔥 최고 콤보: <b>${seqMaxCombo}</b>
    `;
  }

  endBestBadge.classList.toggle("hidden", !isNewBest);
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
  html += `<div class="debug-row"><b>Mode:</b> ${mode || "-"} <b>Phase:</b> ${phase}</div>`;
  if (inPreview) html += `<div class="debug-row debug-warn">⏱ 카운트다운</div>`;
  const pose = getActivePose();
  html += `<div class="debug-row"><b>Pose:</b> ${pose?.name || "-"}</div>`;
  if (!result.landmarks || result.landmarks.length === 0) {
    html += `<div class="debug-row debug-warn">❌ 감지 안됨</div>`;
  } else {
    html += `<div class="debug-row debug-ok">✓ 감지</div>`;

    // 실시간 정규화 좌표 표시 (사용자 자세 진단용)
    if (lastDetectedLandmarks) {
      const norm = normalizePose(lastDetectedLandmarks);
      if (norm) {
        const fmt = (p) => p ? `(${p.x.toFixed(1)},${p.y.toFixed(1)})` : "?";
        html += `<div class="debug-row debug-data">코${fmt(norm[0])}</div>`;
        html += `<div class="debug-row debug-data">L손${fmt(norm[15])} R손${fmt(norm[16])}</div>`;
      }
    }

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
  return seqStepHeldSince !== null;
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
  if (isAdvancing) return { rawResult: null, decision: null, isHolding: false };
  if (mode === "mirror" && mirrorPhase === "show") {
    return { rawResult: null, decision: null, isHolding: false };
  }

  // 준비 단계
  if (phase === "ready") {
    const r = READY_POSE.check(landmarks, worldLandmarks, isHolding);
    const decision = decidePass(r.pass);
    showReadyBanner(decision.finalPass ? "좋아요!" : "양손을 머리 위로 🙌");
    if (decision.finalPass) {
      setFeedback(r.hint, "ok");
      if (holdStartTime === null) { holdStartTime = performance.now(); showTimer(); }
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

  // 리듬 모드
  if (mode === "rhythm" && phase === "playing") {
    // 가장 가까운 노트의 포즈와 비교
    const allPoses = buildAllAvailablePoses();
    let closestNote = null;
    let closestDiff = Infinity;
    const now = performance.now() - rhythmStartTime;
    for (const note of rhythmNotesData) {
      if (note.judged) continue;
      const diff = Math.abs(note.hitTime - now);
      if (diff < closestDiff && diff < 600) {
        closestDiff = diff;
        closestNote = note;
      }
    }
    if (!closestNote) return { rawResult: null, decision: null, isHolding };

    const pose = allPoses[closestNote.poseId];
    if (!pose) return { rawResult: null, decision: null, isHolding };

    const r = pose.check(landmarks, worldLandmarks, false);
    const decision = decidePass(r.pass);
    if (decision.finalPass) {
      // 노트 거리 계산
      const currentNorm = normalizePose(landmarks);
      let poseDistVal = 0;
      if (pose.referencePose && currentNorm) {
        // poses.js의 poseDistance를 직접 못 쓰므로 간단히 재계산
        // referencePose 직접 import 안 됐지만 createCustomPose에서 만들어진 거라 동작함
        poseDistVal = 0.3; // 기본 good 판정
      }
      judgeRhythmHit(poseDistVal);
    }
    return { rawResult: r, decision, isHolding };
  }

  // 일반 (single, sequence, challenge, mirror-play)
  const pose = getActivePose();
  if (!pose) return { rawResult: null, decision: null, isHolding };

  const r = pose.check(landmarks, worldLandmarks, isHolding);
  const decision = decidePass(r.pass);

  if (mode === "single") {
    // 시간 초과 체크
    if (singleStepStartTime !== null) {
      const elapsed = performance.now() - singleStepStartTime;
      if (elapsed >= SINGLE_TIMEOUT_MS && !decision.finalPass) {
        advancePoseSingle(false);
        return { rawResult: r, decision, isHolding };
      }
    }

    if (decision.finalPass) {
      setFeedback(r.hint, "ok");
      if (holdStartTime === null) { holdStartTime = performance.now(); showTimer(); }
      const elapsed = performance.now() - holdStartTime;
      updateTimerUI(elapsed, HOLD_DURATION_MS);
      if (elapsed >= HOLD_DURATION_MS) advancePoseSingle(true);
    } else {
      setFeedback(r.hint, "");
      holdStartTime = null;
      hideTimer();
    }
  } else {
    // sequence, challenge, mirror
    const windowMs = mode === "mirror" ? 5000 : selectedSequence.stepWindowMs;
    const windowElapsed = performance.now() - seqStepStartTime;
    const windowRemain = windowMs - windowElapsed;
    if (mode !== "mirror") {
      stepCountdownText.textContent = Math.max(0, windowRemain / 1000).toFixed(1);
    }
    if (windowRemain <= 0) {
      advanceStepSeq(false);
      return { rawResult: r, decision, isHolding };
    }
    if (decision.finalPass) {
      setFeedback(r.hint, "ok");
      if (seqStepHeldSince === null) seqStepHeldSince = performance.now();
      const heldFor = performance.now() - seqStepHeldSince;
      const holdMs = mode === "mirror" ? 400 : selectedSequence.stepHoldMs;
      if (heldFor >= holdMs) advanceStepSeq(true);
    } else {
      seqStepHeldSince = null;
      setFeedback(r.hint, "");
    }
  }
  return { rawResult: r, decision, isHolding };
}

// ============ 최고 점수 표시 ============
function renderBestScores() {
  const scores = loadBestScores();
  const entries = Object.entries(scores);
  if (entries.length === 0) {
    bestScoreBox.classList.add("hidden");
    return;
  }
  bestScoreBox.classList.remove("hidden");
  bestScoreList.innerHTML = "";

  const labels = {
    "challenge_easy": "🎯 챌린지 쉬움",
    "challenge_medium": "🎯 챌린지 보통",
    "challenge_hard": "🎯 챌린지 어려움",
    "rhythm_60": "🎵 리듬 60 BPM",
    "rhythm_80": "🎵 리듬 80 BPM",
    "rhythm_100": "🎵 리듬 100 BPM",
    "mirror": "🪞 거울 모드 (라운드)"
  };

  entries.forEach(([key, value]) => {
    const row = document.createElement("div");
    row.className = "best-score-row";
    row.innerHTML = `<span>${labels[key] || key}</span><b>${value}${key === "mirror" ? "라운드" : "점"}</b>`;
    bestScoreList.appendChild(row);
  });
}

// ============ 이벤트 ============
document.querySelectorAll("[data-mode]").forEach(btn => {
  btn.addEventListener("click", () => {
    const m = btn.dataset.mode;
    if (m === "record") enterRecordScreen();
    else if (m === "builder") enterSequenceScreen();
    else if (m === "challenge") enterChallengeSetup();
    else if (m === "rhythm") enterRhythmSetup();
    else if (m === "mirror") enterMirrorSetup();
  });
});

document.querySelectorAll("[data-back]").forEach(btn => {
  btn.addEventListener("click", () => {
    leaveCurrentScreen();
    stopCamera();
    showScreen(startScreen);
    renderBestScores();
  });
});

restartBtn.addEventListener("click", () => {
  mode = null;
  selectedSequence = null;
  phase = "ready";
  showScreen(startScreen);
  renderBestScores();
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

// 챌린지 설정
document.querySelectorAll("[data-count]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-count]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    challengeCount = parseInt(btn.dataset.count);
  });
});
document.querySelectorAll("[data-challenge-diff]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-challenge-diff]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    challengeDifficulty = btn.dataset.challengeDiff;
  });
});
startChallengeBtn.addEventListener("click", startChallenge);

// 리듬 설정
document.querySelectorAll("[data-bpm]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-bpm]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    rhythmBPM = parseInt(btn.dataset.bpm);
  });
});
document.querySelectorAll("[data-beats]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-beats]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    rhythmTotalBeats = parseInt(btn.dataset.beats);
  });
});
startRhythmBtn.addEventListener("click", startRhythm);

// 거울
startMirrorBtn.addEventListener("click", startMirror);

// 디버그
debugToggle.addEventListener("click", () => {
  debugVisible = !debugVisible;
  debugToggle.textContent = debugVisible ? "🐛 ON" : "🐛 OFF";
});
skipBtn.addEventListener("click", () => {
  if (!running || inPreview) return;
  if (phase === "ready") startMainGame();
  else if (mode === "single") advancePoseSingle();
  else advanceStepSeq(false);
});
debugToggle.textContent = debugVisible ? "🐛 ON" : "🐛 OFF";

// 시작 시 최고 점수 표시
renderBestScores();
