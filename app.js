import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/vision_bundle.mjs";

import { POSES } from "/poses.js";

// ============ DOM 요소 ============
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

// ============ 상태 ============
let poseLandmarker = null;
let running = false;
let lastVideoTime = -1;
let currentPoseIndex = 0;
let holdStartTime = null;
const HOLD_DURATION_MS = 1500; // 1.5초 유지
let sessionStartTime = null;
let stream = null;

// ============ 화면 전환 ============
function showScreen(screen) {
  [startScreen, gameScreen, endScreen].forEach((s) => s.classList.remove("active"));
  screen.classList.add("active");
}

// ============ MediaPipe 초기화 ============
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
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5
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

// ============ 포즈 표시 업데이트 ============
function updatePoseUI() {
  const pose = POSES[currentPoseIndex];
  stepLabel.textContent = `${currentPoseIndex + 1} / ${POSES.length}`;
  poseName.textContent = pose.name;
  poseEmoji.textContent = pose.emoji;
  poseInstruction.textContent = pose.instruction;
  progressFill.style.width = `${(currentPoseIndex / POSES.length) * 100}%`;
}

// ============ 홀드 타이머 ============
function updateTimerUI(elapsedMs) {
  const ratio = Math.min(elapsedMs / HOLD_DURATION_MS, 1);
  const circumference = 283;
  timerCircle.style.strokeDashoffset = circumference * (1 - ratio);
  const remaining = Math.max((HOLD_DURATION_MS - elapsedMs) / 1000, 0);
  timerText.textContent = remaining.toFixed(1);
}

function showTimer() {
  holdTimer.classList.remove("hidden");
}

function hideTimer() {
  holdTimer.classList.add("hidden");
  timerCircle.style.strokeDashoffset = 283;
}

// ============ 성공 처리 ============
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

// ============ 피드백 ============
function setFeedback(text, type = "") {
  feedback.textContent = text;
  feedback.className = "feedback" + (type ? " " + type : "");
}

// ============ 메인 루프 ============
function predictLoop() {
  if (!running) return;
  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const result = poseLandmarker.detectForVideo(video, performance.now());
    handleDetection(result);
    drawLandmarks(result);
  }
  requestAnimationFrame(predictLoop);
}

function handleDetection(result) {
  if (!result.landmarks || result.landmarks.length === 0) {
    setFeedback("사람이 감지되지 않아요. 카메라 앞에 서주세요", "warn");
    holdStartTime = null;
    hideTimer();
    return;
  }

  const landmarks = result.landmarks[0];
  const pose = POSES[currentPoseIndex];
  const { pass, hint } = pose.check(landmarks);

  if (pass) {
    setFeedback(hint, "ok");
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
    setFeedback(hint, "");
    holdStartTime = null;
    hideTimer();
  }
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
    if (!poseLandmarker) {
      await initPoseLandmarker();
    }
    await initCamera();
    loadingOverlay.classList.add("hidden");

    currentPoseIndex = 0;
    holdStartTime = null;
    sessionStartTime = performance.now();
    updatePoseUI();
    setFeedback("카메라 앞에 전신이 보이도록 서주세요", "");
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
