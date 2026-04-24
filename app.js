import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/vision_bundle.mjs";

import { POSES } from "/poses.js";

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

// ============ 상태 ============
let poseLandmarker = null;
let running = false;
let lastVideoTime = -1;
let currentPoseIndex = 0;
let holdStartTime = null;
const HOLD_DURATION_MS = 1000; // 1.0초로 단축
let sessionStartTime = null;
let stream = null;
let debugVisible = true; // 디버그 기본 ON (문제 확인용)
let frameCount = 0;
let lastFpsTime = performance.now();
let fps = 0;

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
  const pose = POSES[currentPoseIndex];
  stepLabel.textContent = `${currentPoseIndex + 1} / ${POSES.length}`;
  poseName.textContent = pose.name;
  poseEmoji.textContent = pose.emoji;
  poseInstruction.textContent = pose.instruction;
  progressFill.style.width = `${(currentPoseIndex / POSES.length) * 100}%`;
}

function updateTimerUI(elapsedMs) {
  const ratio = Math.min(elapsedMs / HOLD_DURATION_MS, 1);
  const circumference = 283;
  timerCircle.style.strokeDashoffset = circumference * (1 - ratio);
  const remaining = Math.max((HOLD_DURATION_MS - elapsedMs) / 1000, 0);
  timerText.textContent = remaining.toFixed(1);
}

function showTimer() { holdTimer.classList.remove("hidden"); }
function hideTimer() {
  holdTimer.classList.add("hidden");
  timerCircle.style.strokeDashoffset = 283;
}

function showSuccessFlash() {
  successOverlay.classList.remove("hidden");
  setTimeout(() => successOverlay.classList.add("hidden"), 800);
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
      setFeedback("다음 포즈를 준비하세요", "");
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

  let html = `<div class="debug-row"><b>FPS:</b> ${fps}</div>`;
  html += `<div class="debug-row"><b>현재 포즈:</b> ${POSES[currentPoseIndex]?.name || "-"}</div>`;

  if (!result.landmarks || result.landmarks.length === 0) {
    html += `<div class="debug-row debug-warn">❌ 사람 감지 안됨</div>`;
  } else {
    const lm = result.landmarks[0];
    const nose = lm[0];
    const ls = lm[11], rs = lm[12];
    const lw = lm[15], rw = lm[16];

    html += `<div class="debug-row debug-ok">✓ 랜드마크 33개 감지</div>`;
    html += `<div class="debug-row"><b>주요 가시성(vis):</b></div>`;
    html += `<div class="debug-row">코:${(nose.visibility ?? 1).toFixed(2)} L어깨:${(ls.visibility ?? 1).toFixed(2)} R어깨:${(rs.visibility ?? 1).toFixed(2)}</div>`;
    html += `<div class="debug-row">L손목:${(lw.visibility ?? 1).toFixed(2)} R손목:${(rw.visibility ?? 1).toFixed(2)}</div>`;

    if (poseResult) {
      const statusClass = poseResult.pass ? "debug-ok" : "debug-warn";
      html += `<div class="debug-row ${statusClass}"><b>판정:</b> ${poseResult.pass ? "✅ PASS" : "❌ FAIL"}</div>`;
      html += `<div class="debug-row"><b>힌트:</b> ${poseResult.hint}</div>`;
      if (poseResult.debug) {
        html += `<div class="debug-row debug-data">${poseResult.debug}</div>`;
      }
    }

    if (holdStartTime) {
      const elapsed = performance.now() - holdStartTime;
      html += `<div class="debug-row debug-ok"><b>홀드:</b> ${(elapsed / 1000).toFixed(2)}s / ${HOLD_DURATION_MS / 1000}s</div>`;
    }
  }

  debugPanel.innerHTML = html;
}

// ============ 메인 루프 ============
function predictLoop() {
  if (!running) return;

  // FPS 계산
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
  if (!result.landmarks || result.landmarks.length === 0) {
    setFeedback("사람이 감지되지 않아요", "warn");
    holdStartTime = null;
    hideTimer();
    return null;
  }

  const landmarks = result.landmarks[0];
  const pose = POSES[currentPoseIndex];
  const poseResult = pose.check(landmarks);

  if (poseResult.pass) {
    setFeedback(poseResult.hint, "ok");
    if (holdStartTime === null) {
      holdStartTime = performance.now();
      showTimer();
    }
    const elapsed = performance.now() - holdStartTime;
    updateTimerUI(elapsed);
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

    currentPoseIndex = 0;
    holdStartTime = null;
    sessionStartTime = performance.now();
    updatePoseUI();
    setFeedback("카메라 앞에 서주세요", "");
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

// 디버그 토글
if (debugToggle) {
  debugToggle.addEventListener("click", () => {
    debugVisible = !debugVisible;
    debugToggle.textContent = debugVisible ? "🐛 Debug: ON" : "🐛 Debug: OFF";
  });
}

// 건너뛰기 버튼 (디버깅용)
if (skipBtn) {
  skipBtn.addEventListener("click", () => {
    if (running) advancePose();
  });
}
