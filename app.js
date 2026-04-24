import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/vision_bundle.mjs";

import { POSES, READY_POSE } from "/poses.js";

// ============ DOM ============
const startScreen = document.getElementById("startScreen");
const gameScreen = document.getElementById("gameScreen");
const endScreen = document.getElementById("endScreen");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const stepLabel = document.getElementById("stepLabel");
const poseName = document.getElementById("poseName");
const poseEmoji = document.getElementById("poseEmoji");
const poseInstruction = document.getElementById("poseInstruction");
const progressFill = document.getElementById("progressFill");
const feedback = document.getElementById("feedback");
const holdTimer = document.getElementById("holdTimer");
const timerCircle = document.getElementById("timerCircle");
const timerText = document.getElementById("timerText");
const successOverlay = document.getElementById("successOverlay");
const loadingOverlay = document.getElementById("loadingOverlay");
const loadingText = document.getElementById("loadingText");
const totalTimeEl = document.getElementById("totalTime");
const totalPosesEl = document.getElementById("totalPoses");
const debugPanel = document.getElementById("debugPanel");
const debugToggle = document.getElementById("debugToggle");
const skipBtn = document.getElementById("skipBtn");
const readyBanner = document.getElementById("readyBanner");
const readyBannerText = document.getElementById("readyBannerText");

// ============ 상태 ============
let poseLandmarker = null;
let running = false;
let lastVideoTime = -1;
let currentPoseIndex = 0;
let holdStartTime = null;
const HOLD_DURATION_MS = 1000;
const READY_HOLD_MS = 800; // 준비포즈는 조금 짧게
let sessionStartTime = null;
let stream = null;
let debugVisible = true;
let frameCount = 0;
let lastFpsTime = performance.now();
let fps = 0;

// 단계: "ready" | "playing"
let phase = "ready";

// ============ 화면 전환 ============
function showScreen(screen) {
  [startScreen, gameScreen, endScreen].forEach((s) => s.classList.remove("active"));
  screen.classList.add("active");
}

// ============ MediaPipe ============
async function initPoseLandmarker() {
  loadingText.textContent = "AI 모델 다운로드 중...";
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm"
  );
  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
      delegate: "GPU"
    },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.4,
    minPosePresenceConfidence: 0.4,
    minTrackingConfidence: 0.4
  });
}

// ============ 카메라 ============
async function initCamera() {
  loadingText.textContent = "카메라 준비 중...";
  stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: "user"
    },
    audio: false
  });
  video.srcObject = stream;
  await new Promise((resolve) => {
    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      resolve();
    };
  });
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
}

// ============ UI ============
function updatePoseUI() {
  if (phase === "ready") {
    stepLabel.textContent = "준비";
    poseName.textContent = READY_POSE.name;
    poseEmoji.textContent = READY_POSE.emoji;
    poseInstruction.textContent = READY_POSE.instruction;
    progressFill.style.width = "0%";
  } else {
    const pose = POSES[currentPoseIndex];
    stepLabel.textContent = `${currentPoseIndex + 1} / ${POSES.length}`;
    poseName.textContent = pose.name;
    poseEmoji.textContent = pose.emoji;
    poseInstruction.textContent = pose.instruction;
    progressFill.style.width = `${(currentPoseIndex / POSES.length) * 100}%`;
  }
}

function updateTimerUI(elapsedMs, totalMs) {
  const ratio = Math.min(elapsedMs / totalMs, 1);
  const circumference = 283;
  timerCircle.style.strokeDashoffset = circumference * (1 - ratio);
  const remaining = Math.max((totalMs - elapsedMs) / 1000, 0);
  timerText.textContent = remaining.toFixed(1);
}

function showTimer() { holdTimer.classList.remove("hidden"); }
function hideTimer() {
  holdTimer.classList.add("hidden");
  timerCircle.style.strokeDashoffset = 283;
}

function showSuccessFlash(message = "✨ 성공! ✨") {
  const successText = successOverlay.querySelector(".success-text");
  successText.textContent = message;
  successOverlay.classList.remove("hidden");
  setTimeout(() => successOverlay.classList.add("hidden"), 800);
}

function showReadyBanner(text) {
  if (readyBanner && readyBannerText) {
    readyBannerText.textContent = text;
    readyBanner.classList.remove("hidden");
  }
}

function hideReadyBanner() {
  if (readyBanner) readyBanner.classList.add("hidden");
}

// ============ 단계 전환 ============
function startMainGame() {
  phase = "playing";
  currentPoseIndex = 0;
  holdStartTime = null;
  sessionStartTime = performance.now();
  hideReadyBanner();
  showSuccessFlash("🎬 시작!");
  setTimeout(() => {
    updatePoseUI();
    setFeedback("첫 포즈를 취해보세요", "");
  }, 900);
}

function advancePose() {
  showSuccessFlash();
  hideTimer();
  holdStartTime = null;
  currentPoseIndex++;

  if (currentPoseIndex >= POSES.length) {
    setTimeout(() => finishGame(), 900);
  } else {
    setTimeout(() => {
      updatePoseUI();
      setFeedback("다음 포즈 준비!", "");
    }, 900);
  }
}

function finishGame() {
  running = false;
  stopCamera();
  const totalSec = Math.round((performance.now() - sessionStartTime) / 1000);
  totalTimeEl.textContent = `${totalSec}초`;
  totalPosesEl.textContent = `${POSES.length}개`;
  progressFill.style.width = "100%";
  showScreen(endScreen);
}

function setFeedback(text, type = "") {
  feedback.textContent = text;
  feedback.className = "feedback" + (type ? " " + type : "");
}

// ============ 디버그 패널 ============
function updateDebugPanel(result, poseResult) {
  if (!debugVisible) {
    debugPanel.classList.add("hidden");
    return;
  }
  debugPanel.classList.remove("hidden");

  let html = `<div class="debug-row"><b>FPS:</b> ${fps} <b>Phase:</b> ${phase}</div>`;

  const currentPose = phase === "ready" ? READY_POSE : POSES[currentPoseIndex];
  html += `<div class="debug-row"><b>포즈:</b> ${currentPose?.name || "-"}</div>`;

  if (!result.landmarks || result.landmarks.length === 0) {
    html += `<div class="debug-row debug-warn">❌ 사람 감지 안됨</div>`;
  } else {
    const lm = result.landmarks[0];
    const nose = lm[0], ls = lm[11], rs = lm[12], lw = lm[15], rw = lm[16];
    html += `<div class="debug-row debug-ok">✓ 감지됨</div>`;
    html += `<div class="debug-row">vis 코:${(nose.visibility ?? 1).toFixed(2)} L어깨:${(ls.visibility ?? 1).toFixed(2)} R어깨:${(rs.visibility ?? 1).toFixed(2)}</div>`;
    html += `<div class="debug-row">L손목:${(lw.visibility ?? 1).toFixed(2)} R손목:${(rw.visibility ?? 1).toFixed(2)}</div>`;

    if (poseResult) {
      const cls = poseResult.pass ? "debug-ok" : "debug-warn";
      html += `<div class="debug-row ${cls}"><b>판정:</b> ${poseResult.pass ? "✅ PASS" : "❌ FAIL"}</div>`;
      html += `<div class="debug-row"><b>힌트:</b> ${poseResult.hint}</div>`;
      if (poseResult.debug) {
        html += `<div class="debug-row debug-data">${poseResult.debug}</div>`;
      }
    }

    if (holdStartTime) {
      const elapsed = performance.now() - holdStartTime;
      const total = phase === "ready" ? READY_HOLD_MS : HOLD_DURATION_MS;
      html += `<div class="debug-row debug-ok"><b>홀드:</b> ${(elapsed / 1000).toFixed(2)}s / ${(total / 1000).toFixed(1)}s</div>`;
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
    const poseResult = handleDetection(result);
    drawLandmarks(result);
    updateDebugPanel(result, poseResult);
  }
  requestAnimationFrame(predictLoop);
}

function handleDetection(result) {
  // 사람 감지 안됨
  if (!result.landmarks || result.landmarks.length === 0) {
    if (phase === "ready") {
      showReadyBanner("카메라 앞에 서주세요 👀");
    }
    setFeedback("사람이 감지되지 않아요", "warn");
    holdStartTime = null;
    hideTimer();
    return null;
  }

  const landmarks = result.landmarks[0];

  // === 준비 단계 ===
  if (phase === "ready") {
    const readyResult = READY_POSE.check(landmarks);

    // 사람은 감지됐으니 배너 업데이트
    if (!readyResult.pass) {
      showReadyBanner("양손을 머리 위로 올리면 시작합니다 🙌");
    } else {
      showReadyBanner("좋아요! 조금만 더 유지하세요 ✨");
    }

    if (readyResult.pass) {
      setFeedback(readyResult.hint, "ok");
      if (holdStartTime === null) {
        holdStartTime = performance.now();
        showTimer();
      }
      const elapsed = performance.now() - holdStartTime;
      updateTimerUI(elapsed, READY_HOLD_MS);
      if (elapsed >= READY_HOLD_MS) {
        // 게임 시작!
        hideTimer();
        startMainGame();
      }
    } else {
      setFeedback(readyResult.hint, "");
      holdStartTime = null;
      hideTimer();
    }
    return readyResult;
  }

  // === 본게임 단계 ===
  const pose = POSES[currentPoseIndex];
  const poseResult = pose.check(landmarks);

  if (poseResult.pass) {
    setFeedback(poseResult.hint, "ok");
    if (holdStartTime === null) {
      holdStartTime = performance.now();
      showTimer();
    }
    const elapsed = performance.now() - holdStartTime;
    updateTimerUI(elapsed, HOLD_DURATION_MS);
    if (elapsed >= HOLD_DURATION_MS) {
      advancePose();
    }
  } else {
    setFeedback(poseResult.hint, "");
    holdStartTime = null;
    hideTimer();
  }
  return poseResult;
}

function drawLandmarks(result) {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (result.landmarks && result.landmarks.length > 0) {
    const drawingUtils = new DrawingUtils(ctx);
    for (const landmarks of result.landmarks) {
      drawingUtils.drawLandmarks(landmarks, {
        radius: 5,
        color: "#7c5cff",
        lineWidth: 2
      });
      drawingUtils.drawConnectors(
        landmarks,
        PoseLandmarker.POSE_CONNECTIONS,
        { color: "#00ffa3", lineWidth: 3 }
      );
    }
  }
  ctx.restore();
}

// ============ 시작/재시작 ============
async function startGame() {
  startBtn.disabled = true;
  showScreen(gameScreen);
  loadingOverlay.classList.remove("hidden");

  try {
    if (!poseLandmarker) await initPoseLandmarker();
    await initCamera();
    loadingOverlay.classList.add("hidden");

    phase = "ready";
    currentPoseIndex = 0;
    holdStartTime = null;
    updatePoseUI();
    showReadyBanner("카메라 앞에 서주세요 👀");
    setFeedback("준비 단계 - 양손을 머리 위로!", "");
    running = true;
    predictLoop();
  } catch (err) {
    console.error(err);
    loadingOverlay.classList.add("hidden");
    alert("오류: " + err.message + "\n\n카메라 권한을 허용했는지 확인해주세요.");
    showScreen(startScreen);
    startBtn.disabled = false;
  }
}

startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", () => {
  showScreen(startScreen);
  startBtn.disabled = false;
});

if (debugToggle) {
  debugToggle.addEventListener("click", () => {
    debugVisible = !debugVisible;
    debugToggle.textContent = debugVisible ? "🐛 Debug: ON" : "🐛 Debug: OFF";
  });
}

if (skipBtn) {
  skipBtn.addEventListener("click", () => {
    if (!running) return;
    if (phase === "ready") startMainGame();
    else advancePose();
  });
}
