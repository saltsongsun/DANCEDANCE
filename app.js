import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/vision_bundle.mjs";

import { POSES, POSE_LIBRARY, SEQUENCES, READY_POSE } from "/poses.js";

// ============ DOM ============
const startScreen = document.getElementById("startScreen");
const sequenceSelectScreen = document.getElementById("sequenceSelectScreen");
const gameScreen = document.getElementById("gameScreen");
const endScreen = document.getElementById("endScreen");
const restartBtn = document.getElementById("restartBtn");
const backBtn1 = document.getElementById("backBtn1");
const sequenceList = document.getElementById("sequenceList");
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// 미션 카드
const stepLabel = document.getElementById("stepLabel");
const poseName = document.getElementById("poseName");
const poseEmoji = document.getElementById("poseEmoji");
const poseInstruction = document.getElementById("poseInstruction");
const progressFill = document.getElementById("progressFill");
const comboBadge = document.getElementById("comboBadge");
const comboCount = document.getElementById("comboCount");

// 오버레이
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

// 시퀀스 UI
const sequencePreview = document.getElementById("sequencePreview");
const stepCountdown = document.getElementById("stepCountdown");
const stepCountdownText = document.getElementById("stepCountdownText");

// 완료
const totalTimeEl = document.getElementById("totalTime");
const totalScoreEl = document.getElementById("totalScore");
const endSubtitle = document.getElementById("endSubtitle");
const extraStats = document.getElementById("extraStats");

// 디버그
const debugPanel = document.getElementById("debugPanel");
const debugToggle = document.getElementById("debugToggle");
const skipBtn = document.getElementById("skipBtn");

// ============ 상태 ============
let poseLandmarker = null;
let running = false;
let lastVideoTime = -1;
let stream = null;
let debugVisible = false;
let frameCount = 0;
let lastFpsTime = performance.now();
let fps = 0;

// 모드 & 단계
let mode = null; // "single" | "sequence"
let phase = "ready"; // "ready" | "playing" | "done"
let sessionStartTime = null;

// 싱글 모드
const HOLD_DURATION_MS = 1000;
const READY_HOLD_MS = 800;
let currentPoseIndex = 0;
let holdStartTime = null;

// 시퀀스 모드
let selectedSequence = null;
let seqStepIndex = 0;
let seqStepStartTime = null; // 현재 스텝 시작 시각
let seqStepHeldSince = null; // 이 스텝의 포즈가 통과되기 시작한 시각
let seqCombo = 0;
let seqScore = 0;
let seqSuccessCount = 0;
let seqMissCount = 0;

// ============ 화면 전환 ============
function showScreen(screen) {
  [startScreen, sequenceSelectScreen, gameScreen, endScreen].forEach((s) => s.classList.remove("active"));
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

// ============ UI 업데이트 ============
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
    if (i < seqStepIndex) {
      // 이전 스텝 - done 또는 miss 표시는 나중에 세분화 가능
      dot.classList.add("done");
    } else if (i === seqStepIndex) {
      dot.classList.add("current");
    }
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
  const t = successOverlay.querySelector(".success-text");
  t.textContent = msg;
  successOverlay.classList.remove("hidden");
  setTimeout(() => successOverlay.classList.add("hidden"), 700);
}

function showMissFlash(msg = "❌ Miss!") {
  const t = missOverlay.querySelector(".miss-text");
  t.textContent = msg;
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

// ============ 단계 전환 ============
function startMainGame() {
  phase = "playing";
  sessionStartTime = performance.now();
  hideReadyBanner();
  showSuccessFlash("🎬 시작!");

  if (mode === "single") {
    currentPoseIndex = 0;
    holdStartTime = null;
  } else {
    seqStepIndex = 0;
    seqStepStartTime = performance.now();
    seqStepHeldSince = null;
    seqCombo = 0;
    seqScore = 0;
    seqSuccessCount = 0;
    seqMissCount = 0;
  }

  setTimeout(() => {
    updatePoseUI();
    setFeedback("첫 포즈!", "");
    if (mode === "sequence") {
      stepCountdown.classList.remove("hidden");
      seqStepStartTime = performance.now();
    }
  }, 900);
}

// 싱글 모드: 다음 포즈로
function advancePoseSingle() {
  showSuccessFlash();
  hideTimer();
  holdStartTime = null;
  currentPoseIndex++;
  if (currentPoseIndex >= POSES.length) {
    setTimeout(() => finishGame(), 800);
  } else {
    setTimeout(() => {
      updatePoseUI();
      setFeedback("다음 포즈!", "");
    }, 800);
  }
}

// 시퀀스 모드: 한 스텝 성공
function advanceStepSeq(success) {
  if (success) {
    seqSuccessCount++;
    seqCombo++;
    // 점수: 기본 + 콤보 보너스
    const basePoint = 100;
    const comboBonus = seqCombo * 20;
    seqScore += basePoint + comboBonus;
    showSuccessFlash(seqCombo > 1 ? `🔥 ${seqCombo} 콤보!` : "✨ 성공!");
  } else {
    seqMissCount++;
    seqCombo = 0;
    showMissFlash();
  }

  seqStepHeldSince = null;
  seqStepIndex++;

  if (seqStepIndex >= selectedSequence.steps.length) {
    stepCountdown.classList.add("hidden");
    setTimeout(() => finishGame(), 800);
  } else {
    setTimeout(() => {
      seqStepStartTime = performance.now();
      updatePoseUI();
      setFeedback(seqCombo > 0 ? `🔥 ${seqCombo} 콤보!` : "다음!", seqCombo > 0 ? "ok" : "");
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
    progressFill.style.width = "100%";
  } else {
    totalScoreEl.textContent = `${seqScore}점`;
    const total = selectedSequence.steps.length;
    endSubtitle.textContent = `${selectedSequence.name} 완주!`;
    extraStats.classList.remove("hidden");
    extraStats.innerHTML = `
      ✅ 성공: <b>${seqSuccessCount} / ${total}</b><br>
      ❌ 놓침: <b>${seqMissCount}</b><br>
      🔥 최고 콤보: <b>${seqCombo}</b>
    `;
    progressFill.style.width = "100%";
  }

  showScreen(endScreen);
}

// ============ 디버그 ============
function updateDebugPanel(result, poseResult) {
  if (!debugVisible) {
    debugPanel.classList.add("hidden");
    return;
  }
  debugPanel.classList.remove("hidden");

  let html = `<div class="debug-row"><b>FPS:</b> ${fps} <b>Mode:</b> ${mode || "-"}</div>`;
  html += `<div class="debug-row"><b>Phase:</b> ${phase}</div>`;

  let currentPose = null;
  if (phase === "ready") currentPose = READY_POSE;
  else if (mode === "single") currentPose = POSES[currentPoseIndex];
  else if (mode === "sequence") currentPose = POSE_LIBRARY[selectedSequence.steps[seqStepIndex]];
  html += `<div class="debug-row"><b>Pose:</b> ${currentPose?.name || "-"}</div>`;

  if (!result.landmarks || result.landmarks.length === 0) {
    html += `<div class="debug-row debug-warn">❌ 사람 감지 안됨</div>`;
  } else {
    const lm = result.landmarks[0];
    html += `<div class="debug-row debug-ok">✓ 감지됨</div>`;
    if (poseResult) {
      const cls = poseResult.pass ? "debug-ok" : "debug-warn";
      html += `<div class="debug-row ${cls}">${poseResult.pass ? "✅ PASS" : "❌ FAIL"} - ${poseResult.hint}</div>`;
      if (poseResult.debug) {
        html += `<div class="debug-row debug-data">${poseResult.debug}</div>`;
      }
    }
    if (mode === "sequence" && phase === "playing" && seqStepStartTime) {
      const elapsed = performance.now() - seqStepStartTime;
      const window = selectedSequence.stepWindowMs;
      html += `<div class="debug-row"><b>Window:</b> ${(elapsed / 1000).toFixed(1)}s / ${(window / 1000).toFixed(1)}s</div>`;
      html += `<div class="debug-row"><b>Combo:</b> ${seqCombo} <b>Score:</b> ${seqScore}</div>`;
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
    if (phase === "ready") showReadyBanner("카메라 앞에 서주세요 👀");
    setFeedback("사람이 감지되지 않아요", "warn");
    if (phase === "ready") {
      holdStartTime = null;
      hideTimer();
    }
    return null;
  }

  const landmarks = result.landmarks[0];

  // 준비 단계
  if (phase === "ready") {
    const readyResult = READY_POSE.check(landmarks);
    if (!readyResult.pass) {
      showReadyBanner("양손을 머리 위로 올리면 시작 🙌");
    } else {
      showReadyBanner("좋아요! 유지하세요 ✨");
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

  // 본게임 - 싱글 모드
  if (mode === "single") {
    const pose = POSES[currentPoseIndex];
    const r = pose.check(landmarks);
    if (r.pass) {
      setFeedback(r.hint, "ok");
      if (holdStartTime === null) {
        holdStartTime = performance.now();
        showTimer();
      }
      const elapsed = performance.now() - holdStartTime;
      updateTimerUI(elapsed, HOLD_DURATION_MS);
      if (elapsed >= HOLD_DURATION_MS) advancePoseSingle();
    } else {
      setFeedback(r.hint, "");
      holdStartTime = null;
      hideTimer();
    }
    return r;
  }

  // 본게임 - 시퀀스 모드
  if (mode === "sequence") {
    const stepId = selectedSequence.steps[seqStepIndex];
    const pose = POSE_LIBRARY[stepId];
    const r = pose.check(landmarks);

    // 시간 체크
    const windowElapsed = performance.now() - seqStepStartTime;
    const windowRemain = selectedSequence.stepWindowMs - windowElapsed;

    // 카운트다운 표시
    stepCountdownText.textContent = Math.max(0, windowRemain / 1000).toFixed(1);

    if (windowRemain <= 0) {
      // 시간 초과 → 미스
      advanceStepSeq(false);
      return r;
    }

    if (r.pass) {
      setFeedback(r.hint, "ok");
      if (seqStepHeldSince === null) {
        seqStepHeldSince = performance.now();
      }
      const heldFor = performance.now() - seqStepHeldSince;
      if (heldFor >= selectedSequence.stepHoldMs) {
        // 스텝 성공
        advanceStepSeq(true);
      }
    } else {
      seqStepHeldSince = null;
      setFeedback(r.hint, "");
    }
    return r;
  }

  return null;
}

function drawLandmarks(result) {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (result.landmarks && result.landmarks.length > 0) {
    const drawingUtils = new DrawingUtils(ctx);
    for (const landmarks of result.landmarks) {
      drawingUtils.drawLandmarks(landmarks, { radius: 5, color: "#7c5cff", lineWidth: 2 });
      drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, {
        color: "#00ffa3",
        lineWidth: 3
      });
    }
  }
  ctx.restore();
}

// ============ 시퀀스 목록 렌더 ============
function renderSequenceList() {
  sequenceList.innerHTML = "";
  SEQUENCES.forEach((seq) => {
    const card = document.createElement("button");
    card.className = "sequence-card";
    card.innerHTML = `
      <div class="sequence-diff ${seq.difficulty.toLowerCase()}">${seq.difficulty}</div>
      <div class="sequence-info">
        <div class="sequence-name">${seq.name}</div>
        <div class="sequence-desc">${seq.description}</div>
      </div>
      <div style="font-size:1.5rem;">▶</div>
    `;
    card.addEventListener("click", () => {
      selectedSequence = seq;
      mode = "sequence";
      startGame();
    });
    sequenceList.appendChild(card);
  });
}

// ============ 시작 ============
async function startGame() {
  showScreen(gameScreen);
  loadingOverlay.classList.remove("hidden");

  // 시퀀스 모드라면 미리보기 표시
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
document.querySelectorAll(".mode-card").forEach((btn) => {
  btn.addEventListener("click", () => {
    const m = btn.dataset.mode;
    if (m === "single") {
      mode = "single";
      selectedSequence = null;
      startGame();
    } else if (m === "sequence") {
      renderSequenceList();
      showScreen(sequenceSelectScreen);
    }
  });
});

backBtn1.addEventListener("click", () => showScreen(startScreen));

restartBtn.addEventListener("click", () => {
  // 상태 초기화
  mode = null;
  selectedSequence = null;
  phase = "ready";
  showScreen(startScreen);
});

debugToggle.addEventListener("click", () => {
  debugVisible = !debugVisible;
  debugToggle.textContent = debugVisible ? "🐛 Debug: ON" : "🐛 Debug";
});

skipBtn.addEventListener("click", () => {
  if (!running) return;
  if (phase === "ready") startMainGame();
  else if (mode === "single") advancePoseSingle();
  else if (mode === "sequence") advanceStepSeq(false);
});
