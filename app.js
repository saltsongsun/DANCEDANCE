import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/vision_bundle.mjs";

import { POSES, POSE_LIBRARY, SEQUENCES, READY_POSE } from "/poses.js";

// ============ DOM ============
const startScreen = document.getElementById("startScreen");
const sequenceSelectScreen = document.getElementById("sequenceSelectScreen");
const builderScreen = document.getElementById("builderScreen");
const gameScreen = document.getElementById("gameScreen");
const endScreen = document.getElementById("endScreen");
const restartBtn = document.getElementById("restartBtn");
const sequenceList = document.getElementById("sequenceList");
const myRoutinesSection = document.getElementById("myRoutinesSection");
const myRoutinesList = document.getElementById("myRoutinesList");
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

// 미션 미리보기 (3..2..1)
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
const builderSteps = document.getElementById("builderSteps");
const builderStepCount = document.getElementById("builderStepCount");
const routineName = document.getElementById("routineName");
const builderClearBtn = document.getElementById("builderClearBtn");
const builderSaveBtn = document.getElementById("builderSaveBtn");
const poseLibraryGrid = document.getElementById("poseLibraryGrid");
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
  countdownSeconds: 3 // 미션 미리보기 카운트다운
};

const MODEL_URLS = {
  lite: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  full: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
  heavy: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task"
};

// ============ localStorage 헬퍼 ============
const STORAGE_KEY = "dance_pose_routines_v1";

function loadSavedRoutines() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("load failed", e);
    return [];
  }
}

function saveRoutines(routines) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(routines));
    return true;
  } catch (e) {
    console.error("save failed", e);
    alert("저장 실패: " + e.message);
    return false;
  }
}

function addRoutine(routine) {
  const all = loadSavedRoutines();
  all.push(routine);
  return saveRoutines(all);
}

function deleteRoutine(id) {
  const all = loadSavedRoutines().filter(r => r.id !== id);
  return saveRoutines(all);
}

// ============ 상태 ============
let poseLandmarker = null;
let running = false;
let lastVideoTime = -1;
let stream = null;
let debugVisible = true;
let frameCount = 0;
let lastFpsTime = performance.now();
let fps = 0;

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

// 빌더 상태
let builderSequence = []; // 추가된 pose id 배열
let builderDifficulty = "easy";

// 미션 미리보기 상태
let inPreview = false; // 카운트다운 중에는 판정 안 함

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
  [startScreen, sequenceSelectScreen, builderScreen, gameScreen, endScreen].forEach(s => s.classList.remove("active"));
  screen.classList.add("active");
}

// ============ MediaPipe ============
async function initPoseLandmarker() {
  loadingText.textContent = `AI 모델(${CONFIG.modelType}) 다운로드 중...`;
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

async function initCamera() {
  loadingText.textContent = "카메라 준비 중...";
  const isPortrait = window.innerHeight > window.innerWidth;
  const constraints = isPortrait
    ? {
        video: {
          width: { ideal: 720, min: 480 },
          height: { ideal: 1280, min: 854 },
          facingMode: "user",
          frameRate: { ideal: 30 },
          aspectRatio: { ideal: 9/16 }
        },
        audio: false
      }
    : {
        video: {
          width: { ideal: 1280, min: 854 },
          height: { ideal: 720, min: 480 },
          facingMode: "user",
          frameRate: { ideal: 30 }
        },
        audio: false
      };
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (e) {
    console.warn("fallback", e);
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" }, audio: false
    });
  }
  video.srcObject = stream;
  await new Promise(resolve => {
    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      resolve();
    };
  });
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
}

// ============ UI 헬퍼 ============
function updateMissionCard(pose, stepText) {
  poseName.textContent = pose.name;
  poseEmoji.textContent = pose.emoji;
  poseInstruction.textContent = pose.instruction;
  stepLabel.textContent = stepText;
}

function updatePoseUI() {
  if (phase === "ready") {
    updateMissionCard(READY_POSE, "준비");
    progressFill.style.width = "0%";
    comboBadge.classList.add("hidden");
    return;
  }
  if (mode === "single") {
    const pose = POSES[currentPoseIndex];
    updateMissionCard(pose, `${currentPoseIndex + 1} / ${POSES.length}`);
    progressFill.style.width = `${(currentPoseIndex / POSES.length) * 100}%`;
    comboBadge.classList.add("hidden");
  } else if (mode === "sequence") {
    const stepId = selectedSequence.steps[seqStepIndex];
    const pose = POSE_LIBRARY[stepId];
    updateMissionCard(pose, `${seqStepIndex + 1} / ${selectedSequence.steps.length}`);
    progressFill.style.width = `${(seqStepIndex / selectedSequence.steps.length) * 100}%`;
    if (seqCombo > 0) {
      comboBadge.classList.remove("hidden");
      comboCount.textContent = seqCombo;
    } else {
      comboBadge.classList.add("hidden");
    }
    renderSequencePreview();
  }
}

function renderSequencePreview() {
  if (mode !== "sequence" || !selectedSequence) {
    sequencePreview.classList.add("hidden");
    return;
  }
  sequencePreview.classList.remove("hidden");
  sequencePreview.innerHTML = "";
  selectedSequence.steps.forEach((stepId, i) => {
    const dot = document.createElement("div");
    dot.className = "seq-dot";
    const pose = POSE_LIBRARY[stepId];
    dot.textContent = pose.emoji;
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

// ============ 미션 미리보기 (3..2..1) ============
function showMissionPreview(pose) {
  return new Promise((resolve) => {
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

// ============ 단계 전환 ============
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
    setFeedback("자세를 잡아보세요!", "");
  } else {
    seqStepIndex = 0;
    seqStepHeldSince = null;
    seqCombo = 0;
    seqMaxCombo = 0;
    seqScore = 0;
    seqSuccessCount = 0;
    seqMissCount = 0;
    updatePoseUI();
    const firstPose = POSE_LIBRARY[selectedSequence.steps[0]];
    await showMissionPreview(firstPose);
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
      const nextPose = POSE_LIBRARY[selectedSequence.steps[seqStepIndex]];
      await showMissionPreview(nextPose);
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
    endSubtitle.textContent = `15개 포즈를 모두 완료했습니다`;
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

// ============ 디버그 ============
function vis(lm, i) { return lm[i] ? (lm[i].visibility ?? 1) : 0; }

function updateDebugPanel(result, rawResult, decision, isHolding) {
  if (!debugVisible) {
    debugPanel.classList.add("hidden");
    return;
  }
  debugPanel.classList.remove("hidden");
  let html = `<div class="debug-row"><b>FPS:</b> ${fps} <b>${CONFIG.modelType}</b></div>`;
  html += `<div class="debug-row"><b>Phase:</b> ${phase} <b>Hold:</b> ${isHolding ? "ON" : "off"}</div>`;
  if (inPreview) html += `<div class="debug-row debug-warn">⏱ 카운트다운 중</div>`;

  let currentPose = null;
  if (phase === "ready") currentPose = READY_POSE;
  else if (mode === "single") currentPose = POSES[currentPoseIndex];
  else if (mode === "sequence") currentPose = POSE_LIBRARY[selectedSequence.steps[seqStepIndex]];
  html += `<div class="debug-row"><b>Pose:</b> ${currentPose?.name || "-"}</div>`;

  if (!result.landmarks || result.landmarks.length === 0) {
    html += `<div class="debug-row debug-warn">❌ 감지 안됨</div>`;
  } else {
    const lm = result.landmarks[0];
    html += `<div class="debug-row debug-ok">✓ 감지</div>`;
    html += `<div class="debug-row debug-data">vis 코${vis(lm,0).toFixed(1)} L어깨${vis(lm,11).toFixed(1)} L손${vis(lm,15).toFixed(1)} R손${vis(lm,16).toFixed(1)}</div>`;
    if (rawResult && decision) {
      const rc = rawResult.pass ? "debug-ok" : "debug-warn";
      const fc = decision.finalPass ? "debug-ok" : "debug-warn";
      html += `<div class="debug-row ${rc}">Raw: ${rawResult.pass ? "✅" : "❌"} ${rawResult.hint}</div>`;
      html += `<div class="debug-row ${fc}">Final: ${decision.finalPass ? "✅" : "❌"} (${decision.passCount}/${voteHistory.length}${decision.recentlyPassed ? '+db' : ''})</div>`;
      if (rawResult.debug) html += `<div class="debug-row debug-data">${rawResult.debug}</div>`;
    }
  }
  debugPanel.innerHTML = html;
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

  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const result = poseLandmarker.detectForVideo(video, performance.now());

    if (result.landmarks && result.landmarks.length > 0) {
      visualSmoothedLandmarks = smoothForVisual(
        result.landmarks[0],
        visualSmoothedLandmarks,
        CONFIG.visualSmoothing
      );
    } else {
      visualSmoothedLandmarks = null;
    }

    const detection = handleDetection(result);
    drawLandmarks(result);
    updateDebugPanel(result, detection.rawResult, detection.decision, detection.isHolding);
  }
  requestAnimationFrame(predictLoop);
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
    if (phase === "ready") {
      holdStartTime = null;
      hideTimer();
    }
    resetVote();
    return { rawResult: null, decision: null, isHolding: false };
  }

  const landmarks = result.landmarks[0];
  const worldLandmarks = result.worldLandmarks?.[0] || null;
  const isHolding = isCurrentlyHolding();

  // 카운트다운 중에는 좌표 분석은 하되 판정 처리는 보류
  if (inPreview) {
    return { rawResult: null, decision: null, isHolding: false };
  }

  // 준비 단계
  if (phase === "ready") {
    const rawResult = READY_POSE.check(landmarks, worldLandmarks, isHolding);
    const decision = decidePass(rawResult.pass);
    showReadyBanner(decision.finalPass ? "좋아요! 유지하세요 ✨" : "양손을 머리 위로 🙌");
    if (decision.finalPass) {
      setFeedback(rawResult.hint, "ok");
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
      setFeedback(rawResult.hint, "");
      holdStartTime = null;
      hideTimer();
    }
    return { rawResult, decision, isHolding };
  }

  // 싱글
  if (mode === "single") {
    const pose = POSES[currentPoseIndex];
    const rawResult = pose.check(landmarks, worldLandmarks, isHolding);
    const decision = decidePass(rawResult.pass);
    if (decision.finalPass) {
      setFeedback(rawResult.hint, "ok");
      if (holdStartTime === null) {
        holdStartTime = performance.now();
        showTimer();
      }
      const elapsed = performance.now() - holdStartTime;
      updateTimerUI(elapsed, HOLD_DURATION_MS);
      if (elapsed >= HOLD_DURATION_MS) advancePoseSingle();
    } else {
      setFeedback(rawResult.hint, "");
      holdStartTime = null;
      hideTimer();
    }
    return { rawResult, decision, isHolding };
  }

  // 시퀀스
  if (mode === "sequence") {
    const stepId = selectedSequence.steps[seqStepIndex];
    const pose = POSE_LIBRARY[stepId];
    const rawResult = pose.check(landmarks, worldLandmarks, isHolding);
    const decision = decidePass(rawResult.pass);

    const windowElapsed = performance.now() - seqStepStartTime;
    const windowRemain = selectedSequence.stepWindowMs - windowElapsed;
    stepCountdownText.textContent = Math.max(0, windowRemain / 1000).toFixed(1);

    if (windowRemain <= 0) {
      advanceStepSeq(false);
      return { rawResult, decision, isHolding };
    }
    if (decision.finalPass) {
      setFeedback(rawResult.hint, "ok");
      if (seqStepHeldSince === null) seqStepHeldSince = performance.now();
      const heldFor = performance.now() - seqStepHeldSince;
      if (heldFor >= selectedSequence.stepHoldMs) advanceStepSeq(true);
    } else {
      seqStepHeldSince = null;
      setFeedback(rawResult.hint, "");
    }
    return { rawResult, decision, isHolding };
  }

  return { rawResult: null, decision: null, isHolding: false };
}

function drawLandmarks(result) {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (result.landmarks && result.landmarks.length > 0) {
    const drawingUtils = new DrawingUtils(ctx);
    const toDraw = visualSmoothedLandmarks || result.landmarks[0];
    drawingUtils.drawLandmarks(toDraw, { radius: 5, color: "#7c5cff", lineWidth: 2 });
    drawingUtils.drawConnectors(toDraw, PoseLandmarker.POSE_CONNECTIONS, {
      color: "#00ffa3",
      lineWidth: 3
    });
  }
  ctx.restore();
}

// ============ 시퀀스 선택 화면 ============
function renderSequenceList() {
  // 기본 루틴
  sequenceList.innerHTML = "";
  SEQUENCES.forEach(seq => {
    sequenceList.appendChild(makeSequenceCard(seq, false));
  });

  // 내 루틴
  const saved = loadSavedRoutines();
  if (saved.length > 0) {
    myRoutinesSection.classList.remove("hidden");
    myRoutinesList.innerHTML = "";
    saved.forEach(seq => {
      myRoutinesList.appendChild(makeSequenceCard(seq, true));
    });
  } else {
    myRoutinesSection.classList.add("hidden");
  }
}

function makeSequenceCard(seq, isCustom) {
  const card = document.createElement("div");
  card.className = "sequence-card";

  const diffName = { easy: "Easy", medium: "Medium", hard: "Hard" }[seq.difficulty] || seq.difficulty;

  card.innerHTML = `
    <div class="sequence-diff ${seq.difficulty.toLowerCase()}">${diffName}</div>
    <div class="sequence-info">
      <div class="sequence-name">${seq.name}</div>
      <div class="sequence-desc">${seq.description}</div>
    </div>
    ${isCustom ? `<button class="sequence-delete-btn" title="삭제">🗑</button>` : ''}
    <div style="font-size:1.3rem;color:var(--primary);">▶</div>
  `;

  card.addEventListener("click", (e) => {
    if (e.target.classList.contains("sequence-delete-btn")) return;
    selectedSequence = seq;
    mode = "sequence";
    startGame();
  });

  if (isCustom) {
    const delBtn = card.querySelector(".sequence-delete-btn");
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm(`"${seq.name}" 루틴을 삭제할까요?`)) {
        deleteRoutine(seq.id);
        renderSequenceList();
      }
    });
  }
  return card;
}

// ============ 빌더 ============
function renderPoseLibrary() {
  poseLibraryGrid.innerHTML = "";
  Object.values(POSE_LIBRARY).forEach(pose => {
    const card = document.createElement("button");
    card.className = "pose-lib-card";
    card.innerHTML = `
      <div class="pose-lib-emoji">${pose.emoji}</div>
      <div class="pose-lib-name">${pose.name}</div>
    `;
    card.addEventListener("click", () => {
      builderSequence.push(pose.id);
      renderBuilderSteps();
    });
    poseLibraryGrid.appendChild(card);
  });
}

function renderBuilderSteps() {
  builderStepCount.textContent = `(${builderSequence.length}개)`;

  if (builderSequence.length === 0) {
    builderSteps.innerHTML = '<div class="builder-empty">아래에서 동작을 추가하세요</div>';
    builderSaveBtn.disabled = true;
    return;
  }

  builderSteps.innerHTML = "";
  builderSequence.forEach((poseId, i) => {
    const pose = POSE_LIBRARY[poseId];
    const step = document.createElement("div");
    step.className = "builder-step";
    step.innerHTML = `
      <div class="builder-step-num">${i + 1}</div>
      <div class="builder-step-emoji">${pose.emoji}</div>
      <div class="builder-step-name">${pose.name}</div>
    `;
    step.addEventListener("click", () => {
      builderSequence.splice(i, 1);
      renderBuilderSteps();
    });
    builderSteps.appendChild(step);
  });

  // 이름 입력 + 동작 1개 이상이면 저장 가능
  builderSaveBtn.disabled = !routineName.value.trim() || builderSequence.length === 0;
}

function clearBuilder() {
  builderSequence = [];
  routineName.value = "";
  builderDifficulty = "easy";
  document.querySelectorAll(".diff-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.diff === "easy");
  });
  renderBuilderSteps();
}

function saveCurrentBuilder() {
  const name = routineName.value.trim();
  if (!name || builderSequence.length === 0) return;

  // 난이도별 시간 설정
  const timing = {
    easy:   { stepHoldMs: 400, stepWindowMs: 3500 },
    medium: { stepHoldMs: 350, stepWindowMs: 3000 },
    hard:   { stepHoldMs: 300, stepWindowMs: 2500 }
  }[builderDifficulty];

  const routine = {
    id: `custom_${Date.now()}`,
    name: name,
    description: `${builderSequence.length}동작 · 내가 만든 루틴`,
    difficulty: builderDifficulty,
    stepHoldMs: timing.stepHoldMs,
    stepWindowMs: timing.stepWindowMs,
    steps: [...builderSequence],
    createdAt: new Date().toISOString()
  };

  if (addRoutine(routine)) {
    showToast(`✅ "${name}" 저장 완료!`);
    clearBuilder();
    renderSavedRoutinesInBuilder();
  }
}

function showToast(msg) {
  // 간단한 토스트
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
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

function renderSavedRoutinesInBuilder() {
  const saved = loadSavedRoutines();
  if (saved.length === 0) {
    savedRoutinesSection.classList.add("hidden");
    return;
  }
  savedRoutinesSection.classList.remove("hidden");
  savedRoutinesList.innerHTML = "";
  saved.forEach(seq => {
    savedRoutinesList.appendChild(makeSequenceCard(seq, true));
  });
}

// ============ 시작 ============
async function startGame() {
  showScreen(gameScreen);
  loadingOverlay.classList.remove("hidden");

  if (mode === "sequence") {
    sequencePreview.classList.remove("hidden");
    renderSequencePreview();
  } else {
    sequencePreview.classList.add("hidden");
    stepCountdown.classList.add("hidden");
  }

  try {
    if (!poseLandmarker) await initPoseLandmarker();
    await initCamera();
    loadingOverlay.classList.add("hidden");

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

// ============ 이벤트 ============
document.querySelectorAll(".mode-card").forEach(btn => {
  btn.addEventListener("click", () => {
    const m = btn.dataset.mode;
    if (m === "single") {
      mode = "single";
      selectedSequence = null;
      startGame();
    } else if (m === "sequence") {
      renderSequenceList();
      showScreen(sequenceSelectScreen);
    } else if (m === "builder") {
      clearBuilder();
      renderPoseLibrary();
      renderSavedRoutinesInBuilder();
      showScreen(builderScreen);
    }
  });
});

document.querySelectorAll("[data-back]").forEach(btn => {
  btn.addEventListener("click", () => showScreen(startScreen));
});

restartBtn.addEventListener("click", () => {
  mode = null;
  selectedSequence = null;
  phase = "ready";
  showScreen(startScreen);
});

debugToggle.addEventListener("click", () => {
  debugVisible = !debugVisible;
  debugToggle.textContent = debugVisible ? "🐛 Debug: ON" : "🐛 Debug: OFF";
});

skipBtn.addEventListener("click", () => {
  if (!running) return;
  if (inPreview) return;
  if (phase === "ready") startMainGame();
  else if (mode === "single") advancePoseSingle();
  else if (mode === "sequence") advanceStepSeq(false);
});

// 빌더
builderClearBtn.addEventListener("click", () => {
  if (builderSequence.length > 0 && !confirm("초기화할까요?")) return;
  clearBuilder();
});

builderSaveBtn.addEventListener("click", saveCurrentBuilder);

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

debugToggle.textContent = debugVisible ? "🐛 Debug: ON" : "🐛 Debug: OFF";
