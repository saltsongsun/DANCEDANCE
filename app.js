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

const totalTimeEl = document.getElementById("totalTime");
const totalScoreEl = document.getElementById("totalScore");
const endSubtitle = document.getElementById("endSubtitle");
const extraStats = document.getElementById("extraStats");

const debugPanel = document.getElementById("debugPanel");
const debugToggle = document.getElementById("debugToggle");
const skipBtn = document.getElementById("skipBtn");

// ============ 정확도 설정 (깜빡임 제거 최적화) ============
const CONFIG = {
  modelType: 'full',
  visualSmoothing: 0.4,

  // 투표: 최근 5프레임 중 2개만 PASS여도 통과 (매우 관대)
  voteFrames: 5,
  voteThreshold: 2,

  // 디바운스: 한번 PASS 판정되면 N ms간 PASS 유지 강제 (깜빡임 원천 차단)
  passDebounceMs: 350,

  minDetectionConfidence: 0.5,
  minPresenceConfidence: 0.5,
  minTrackingConfidence: 0.5
};

const MODEL_URLS = {
  lite: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  full: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
  heavy: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task"
};

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
let lastPassTime = 0; // 마지막으로 PASS 판정된 시각

function decidePass(currentRawPass) {
  // 1. 투표 추가
  voteHistory.push(currentRawPass);
  if (voteHistory.length > CONFIG.voteFrames) voteHistory.shift();
  const passCount = voteHistory.filter(v => v).length;
  const voteSaysPass = passCount >= CONFIG.voteThreshold;

  // 2. 디바운스: 최근에 PASS였으면 잠깐 PASS 유지
  const now = performance.now();
  const recentlyPassed = (now - lastPassTime) < CONFIG.passDebounceMs;

  // 3. 최종 판정: 투표가 PASS거나 최근 PASS였으면 PASS
  const finalPass = voteSaysPass || recentlyPassed;

  // 4. PASS면 시각 갱신
  if (currentRawPass) lastPassTime = now;

  return { finalPass, voteSaysPass, recentlyPassed, passCount };
}

function resetVote() {
  voteHistory.length = 0;
  lastPassTime = 0;
}

// ============ 화면 전환 ============
function showScreen(screen) {
  [startScreen, sequenceSelectScreen, gameScreen, endScreen].forEach(s => s.classList.remove("active"));
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

  // 디바이스가 세로폰인지 감지하여 적절한 비율 요청
  const isPortrait = window.innerHeight > window.innerWidth;

  // 세로 모드: 높이가 큰 영상 요청 (9:16)
  // 가로 모드: 가로가 큰 영상 (16:9)
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
    // fallback - 기본 설정
    console.warn("optimal constraints failed, fallback", e);
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false
    });
  }

  video.srcObject = stream;
  await new Promise(resolve => {
    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      console.log("Video resolution:", video.videoWidth, "x", video.videoHeight);
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

// ============ UI ============
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

function showMissFlash(msg = "❌ Miss!") {
  missOverlay.querySelector(".miss-text").textContent = msg;
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
  resetVote();

  if (mode === "single") {
    currentPoseIndex = 0;
    holdStartTime = null;
  } else {
    seqStepIndex = 0;
    seqStepStartTime = performance.now();
    seqStepHeldSince = null;
    seqCombo = 0;
    seqMaxCombo = 0;
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

function advancePoseSingle() {
  showSuccessFlash();
  hideTimer();
  holdStartTime = null;
  resetVote();
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

function advanceStepSeq(success) {
  if (success) {
    seqSuccessCount++;
    seqCombo++;
    if (seqCombo > seqMaxCombo) seqMaxCombo = seqCombo;
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
  resetVote();

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
  html += `<div class="debug-row debug-data">${video.videoWidth}x${video.videoHeight}</div>`;

  let currentPose = null;
  if (phase === "ready") currentPose = READY_POSE;
  else if (mode === "single") currentPose = POSES[currentPoseIndex];
  else if (mode === "sequence") currentPose = POSE_LIBRARY[selectedSequence.steps[seqStepIndex]];
  html += `<div class="debug-row"><b>Pose:</b> ${currentPose?.name || "-"}</div>`;

  if (!result.landmarks || result.landmarks.length === 0) {
    html += `<div class="debug-row debug-warn">❌ 사람 감지 안됨</div>`;
  } else {
    const lm = result.landmarks[0];
    html += `<div class="debug-row debug-ok">✓ 감지</div>`;
    html += `<div class="debug-row debug-data">vis 코${vis(lm,0).toFixed(1)} L어깨${vis(lm,11).toFixed(1)} L손${vis(lm,15).toFixed(1)} R손${vis(lm,16).toFixed(1)}</div>`;
    if (rawResult && decision) {
      const rawCls = rawResult.pass ? "debug-ok" : "debug-warn";
      const finalCls = decision.finalPass ? "debug-ok" : "debug-warn";
      html += `<div class="debug-row ${rawCls}">Raw: ${rawResult.pass ? "✅" : "❌"} ${rawResult.hint}</div>`;
      html += `<div class="debug-row ${finalCls}">Final: ${decision.finalPass ? "✅" : "❌"} (vote ${decision.passCount}/${voteHistory.length}${decision.recentlyPassed ? ' +debounce' : ''})</div>`;
      if (rawResult.debug) {
        html += `<div class="debug-row debug-data">${rawResult.debug}</div>`;
      }
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

    const { rawResult, decision, isHolding } = handleDetection(result);
    drawLandmarks(result);
    updateDebugPanel(result, rawResult, decision, isHolding);
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
    setFeedback("사람이 감지되지 않아요", "warn");
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

// ============ 시퀀스 목록 ============
function renderSequenceList() {
  sequenceList.innerHTML = "";
  SEQUENCES.forEach(seq => {
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
    }
  });
});

backBtn1.addEventListener("click", () => showScreen(startScreen));

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
  if (phase === "ready") startMainGame();
  else if (mode === "single") advancePoseSingle();
  else if (mode === "sequence") advanceStepSeq(false);
});

debugToggle.textContent = debugVisible ? "🐛 Debug: ON" : "🐛 Debug: OFF";
