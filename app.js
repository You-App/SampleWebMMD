// app.js — обновлённый с поддержкой камер

const iconSvgs = {
  play: '<svg xmlns="http://www.w3.org/2000/svg" height="24" width="24" fill="white"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg xmlns="http://www.w3.org/2000/svg" height="24" width="24" fill="white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>',
  reset: '<svg xmlns="http://www.w3.org/2000/svg" height="24" width="24" fill="white"><path d="M13 3a9 9 0 1 0 6.364 15.364l1.414-1.414A11 11 0 1 1 13 1v2z"/></svg>',
  backward: '<svg xmlns="http://www.w3.org/2000/svg" height="24" width="24" fill="white"><path d="M20 11V7l-8 5 8 5v-4zM4 6h2v12H4z"/></svg>',
  forward: '<svg xmlns="http://www.w3.org/2000/svg" height="24" width="24" fill="white"><path d="M4 11v4l8-5-8-5v4zM18 6h-2v12h2z"/></svg>',
  user: '<svg xmlns="http://www.w3.org/2000/svg" height="24" width="24" fill="white"><circle cx="12" cy="8" r="4"/><path d="M12 14c-5 0-8 2.5-8 5v3h16v-3c0-2.5-3-5-8-5z"/></svg>',
  film: '<svg xmlns="http://www.w3.org/2000/svg" height="24" width="24" fill="white"><rect x="3" y="6" width="18" height="12" rx="2" ry="2"/><path d="M3 6v12M21 6v12M7 6v12M17 6v12"/></svg>',
  check: '<svg xmlns="http://www.w3.org/2000/svg" height="24" width="24" fill="white"><path d="M9 16.2l-3.5-3.5 1.41-1.41L9 13.38l7.09-7.09 1.41 1.41z"/></svg>'
};

function setIcon(id, svg) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = svg;
}
setIcon('play-btn', iconSvgs.pause);
setIcon('reset-btn', iconSvgs.reset);
setIcon('speed-down', iconSvgs.backward);
setIcon('speed-up', iconSvgs.forward);
setIcon('model-select-btn', iconSvgs.user);
setIcon('animation-select-btn', iconSvgs.film);

const BASE_URL = "https://you-app.github.io/SampleWebMMD/";
const defaultModels = [
  { name: 'AoiZaizen', url: BASE_URL + "pmx/pronama/AoiZaizen/AoiZaizen.pmx" },
  { name: 'Tda Miku', url: BASE_URL + "pmx/Tda/Tda Miku.pmx" }
];
const animations = {
  'bts-bestofme': BASE_URL + 'vmd/bts-bestofme.vmd',
  'idle': BASE_URL + 'vmd/idle.vmd'
};
const cameraAnimations = {
  'bts-bestofme-camera': BASE_URL + 'vmd/bts-bestofme_camera.vmd',
  'idle-camera': BASE_URL + 'vmd/idle_camera.vmd'
};

let scene, renderer, camera, mesh, helper, controls;
let mixer, currentAction;
let ready = false;
let currentSpeed = 1.0;
const clock = new THREE.Clock();

let audioContext, audioSource, analyser;
let audioDataArray;
let audioPlaying = false;

let mouthMorphs = [];
let mouthSettings = { sensitivity: 0.5, strength: 0.7 };

let ambientLight, directionalLight, backLight;

const playBtn = document.getElementById('play-btn');
const resetBtn = document.getElementById('reset-btn');
const speedDownBtn = document.getElementById('speed-down');
const speedUpBtn = document.getElementById('speed-up');
const modelSelectBtn = document.getElementById('model-select-btn');
const animSelectBtn = document.getElementById('animation-select-btn');
const danceToggleBtn = document.getElementById('dance-toggle-btn');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');
const progressFill = document.getElementById('progress-fill');
const errorMessage = document.getElementById('error-message');
const successMessage = document.getElementById('success-message');
const statusText = document.getElementById('status-text');
const statusIndicator = document.getElementById('status-indicator');
const readyIndicator = document.getElementById('ready-indicator');

const audioUploadBtn = document.getElementById('audio-upload-btn');
const mouthSettingsBtn = document.getElementById('mouth-settings-btn');
const lightingBtn = document.getElementById('lighting-btn');
const mouthSettingsPanel = document.getElementById('mouth-settings');
const lightingSettingsPanel = document.getElementById('lighting-settings');
const sensitivitySlider = document.getElementById('sensitivity');
const strengthSlider = document.getElementById('strength');
const visualizerCanvas = document.getElementById('visualizer');
const ambientLightRange = document.getElementById('ambient-light-range');
const directionalLightRange = document.getElementById('directional-light-range');

const modelSelectPanel = document.getElementById('model-select-panel');
const modelList = document.getElementById('model-list');
const modelUploadBtn = document.getElementById('model-upload-btn');
const modelFileInput = document.getElementById('model-file-input');

const debugPanel = document.getElementById('debug-panel');
const debugControls = document.getElementById('debug-controls');

let danceAnimationEnabled = true;
let localModels = [...defaultModels];

function debugLog(msg) {
  const now = new Date().toLocaleTimeString();
  debugPanel.textContent += `[${now}] ${msg}\n`;
  debugPanel.scrollTop = debugPanel.scrollHeight;
}

debugPanel.addEventListener('click', () => {
  if (debugPanel.classList.contains('collapsed')) {
    debugPanel.classList.remove('collapsed');
    debugControls.style.display = 'block';
  } else {
    debugPanel.classList.add('collapsed');
    debugControls.style.display = 'none';
  }
});

document.getElementById('copy-logs-btn').addEventListener('click', () => {
  navigator.clipboard.writeText(debugPanel.textContent).then(() => {
    alert('Logs copied to clipboard');
  });
});

document.getElementById('close-logs-btn').addEventListener('click', () => {
  debugPanel.classList.add('collapsed');
  debugControls.style.display = 'none';
});

function showError(message) {
  errorMessage.textContent = message;
  loadingOverlay.style.display = 'flex';
  setTimeout(() => { loadingOverlay.style.display = 'none'; }, 5000);
  debugLog("Error: " + message);
}

function showSuccess(message) {
  successMessage.textContent = message;
  setTimeout(() => { successMessage.textContent = ''; }, 3000);
  debugLog("Success: " + message);
}

function updateStatus(text, status) {
  statusText.textContent = text;
  statusIndicator.className = "status-indicator";
  if (status === "loading") statusIndicator.classList.add("status-loading");
  else if (status === "success") statusIndicator.classList.add("status-success");
  else if (status === "error") statusIndicator.classList.add("status-error");
}

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x222222);

  ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(-5, 10, 5);
  backLight = new THREE.DirectionalLight(0xffffff, 0.4);
  backLight.position.set(5, 5, -10);

  scene.add(ambientLight, directionalLight, backLight);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('canvas-container').appendChild(renderer.domElement);

  camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 1000);
  camera.position.set(0, 19, 50);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.screenSpacePanning = true;
  controls.minDistance = 10;
  controls.maxDistance = 100;

  window.addEventListener('resize', onWindowResize);

  updateStatus("Scene initialized", "success");
  debugLog("Scene initialized");
}

function centerModel() {
  if (!mesh) return;
  mesh.position.set(0, 0, 0);
  mesh.rotation.set(0, 0, 0);
  const box = new THREE.Box3().setFromObject(mesh);
  const center = box.getCenter(new THREE.Vector3());
  mesh.position.sub(center);
  mesh.position.y += 10;
  camera.lookAt(0, 10, 0);
  controls.target.set(0, 10, 0);
  controls.update();
  debugLog("Model centered");
}

function disposeModel(model) {
  if (!model) return;
  model.traverse(child => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
      else child.material.dispose();
    }
  });
  debugLog("Model resources disposed");
}

async function loadPMXFromBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const loader = new THREE.MMDLoader();
    loader.parse(buffer, '', object => {
      if (mesh) {
        scene.remove(mesh);
        if (helper) helper.remove(mesh);
        disposeModel(mesh);
        mesh = null;
      }
      mesh = object;
      scene.add(mesh);
      centerModel();
      initMouthMorphs();
      showSuccess("Model loaded from file!");
      updateStatus("Model loaded", "success");
      loadingOverlay.style.display = 'none';
      debugLog("Model loaded from buffer");
      resolve();
    }, error => {
      showError("Model loading error: " + error.message);
      updateStatus("Model loading error", "error");
      loadingOverlay.style.display = 'none';
      debugLog("Model loading error: " + error.message);
      reject(error);
    });
  });
}

async function loadModel(modelKeyOrFile) {
  loadingText.textContent = "Loading model...";
  progressFill.style.width = '0%';
  errorMessage.textContent = '';
  successMessage.textContent = '';
  loadingOverlay.style.display = 'flex';
  updateStatus("Loading model...", "loading");
  debugLog("Start loading model");

  if (modelKeyOrFile instanceof File) {
    try {
      if (modelKeyOrFile.name.endsWith('.zip')) {
        debugLog("Unzipping archive...");
        const zip = await JSZip.loadAsync(modelKeyOrFile);
        let pmxFileName = Object.keys(zip.files).find(f => f.toLowerCase().endsWith('.pmx'));
        if (!pmxFileName) throw new Error("No .pmx file in archive");
        debugLog(`Found PMX file: ${pmxFileName}`);
        const pmxData = await zip.files[pmxFileName].async("arraybuffer");
        return loadPMXFromBuffer(pmxData);
      } else if (modelKeyOrFile.name.endsWith('.pmx')) {
        debugLog("Loading PMX file...");
        const arrayBuffer = await modelKeyOrFile.arrayBuffer();
        return loadPMXFromBuffer(arrayBuffer);
      } else {
        throw new Error("Only .pmx and .zip with .pmx supported");
      }
    } catch (e) {
      showError("Model loading error: " + e.message);
      updateStatus("Model loading error", "error");
      loadingOverlay.style.display = 'none';
      debugLog("Model loading error: " + e.message);
      throw e;
    }
  } else {
    return new Promise((resolve, reject) => {
      const loader = new THREE.MMDLoader();
      loader.load(
        modelKeyOrFile,
        object => {
          if (mesh) {
            scene.remove(mesh);
            if (helper) helper.remove(mesh);
            disposeModel(mesh);
            mesh = null;
          }
          mesh = object;
          scene.add(mesh);
          centerModel();
          initMouthMorphs();
          showSuccess("Model loaded!");
          updateStatus("Model loaded", "success");
          loadingOverlay.style.display = 'none';
          debugLog("Model loaded from URL");
          resolve();
        },
        xhr => {
          if (xhr.total) {
            const percent = (xhr.loaded / xhr.total) * 100;
            progressFill.style.width = `${percent}%`;
            debugLog(`Model loading: ${percent.toFixed(1)}%`);
          }
        },
        error => {
          showError("Model loading error: " + error.message);
          updateStatus("Model loading error", "error");
          loadingOverlay.style.display = 'none';
          debugLog("Model loading error: " + error.message);
          reject(error);
        }
      );
    });
  }
}

async function loadAnimationVMD(file) {
  loadingText.textContent = "Loading animation...";
  loadingOverlay.style.display = 'flex';
  updateStatus("Loading animation...", "loading");
  debugLog("Start loading animation from file");

  const arrayBuffer = await file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const loader = new THREE.MMDLoader();
    loader.loadAnimation(
      arrayBuffer,
      mesh,
      (vmdClip) => {
        if (helper) {
          helper.remove(mesh);
          helper = null;
        }
        helper = new THREE.MMDAnimationHelper({ afterglow: 2.0, resetPhysicsOnLoop: true });
        vmdClip.tracks = vmdClip.tracks.filter(track => !track.name.includes('口') && !track.name.toLowerCase().includes('open'));
        helper.add(mesh, { animation: vmdClip, physics: false });
        mixer = helper.objects.get(mesh).mixer;
        currentAction = mixer.clipAction(vmdClip);
        currentAction.play();
        mixer.timeScale = currentSpeed;
        ready = true;
        loadingOverlay.style.display = 'none';
        showSuccess("Animation loaded!");
        updateStatus("Animation loaded", "success");
        debugLog("Animation loaded from file");
        resolve();
      },
      undefined,
      (error) => {
        showError("Animation loading error: " + error.message);
        updateStatus("Animation loading error", "error");
        loadingOverlay.style.display = 'none';
        debugLog("Animation loading error: " + error.message);
        reject(error);
      }
    );
  });
}

// Загрузка камеры VMD
async function loadCameraVMD(file) {
  loadingText.textContent = "Loading camera animation...";
  loadingOverlay.style.display = 'flex';
  updateStatus("Loading camera animation...", "loading");
  debugLog("Start loading camera animation from file");

  const arrayBuffer = await file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const loader = new THREE.MMDLoader();
    loader.loadAnimation(
      arrayBuffer,
      camera,
      (vmdClip) => {
        if (!helper) {
          helper = new THREE.MMDAnimationHelper({ afterglow: 2.0, resetPhysicsOnLoop: true });
          helper.add(camera);
        }
        helper.add(camera, { animation: vmdClip });
        ready = true;
        loadingOverlay.style.display = 'none';
        showSuccess("Camera animation loaded!");
        updateStatus("Camera animation loaded", "success");
        debugLog("Camera animation loaded from file");
        resolve();
      },
      undefined,
      (error) => {
        showError("Camera animation loading error: " + error.message);
        updateStatus("Camera animation loading error", "error");
        loadingOverlay.style.display = 'none';
        debugLog("Camera animation loading error: " + error.message);
        reject(error);
      }
    );
  });
}

function onWindowResize() {
  if (camera && renderer) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

function togglePlayPause() {
  if (!mixer) return;
  if (mixer.timeScale === 0) {
    mixer.timeScale = currentSpeed;
    setIcon('play-btn', iconSvgs.pause);
    updateStatus("Animation playing", "success");
  } else {
    mixer.timeScale = 0;
    setIcon('play-btn', iconSvgs.play);
    updateStatus("Animation paused", "loading");
  }
}

function resetAnimation() {
  if (!currentAction || !mixer) return;
  currentAction.stop();
  currentAction.play();
  mixer.timeScale = currentSpeed;
  setIcon('play-btn', iconSvgs.pause);
  updateStatus("Animation reset", "success");
}

function changeSpeed(delta) {
  if (!mixer) return;
  currentSpeed = Math.min(Math.max(0.1, currentSpeed + delta), 2.0);
  mixer.timeScale = currentSpeed;
  if (currentSpeed > 0) setIcon('play-btn', iconSvgs.pause);
  else setIcon('play-btn', iconSvgs.play);
}

function initMouthMorphs() {
  mouthMorphs = [];
  if (!mesh || !mesh.morphTargetDictionary) return;
  const mouthMorphNames = ['あ', 'い', 'う', 'え', 'お', '口開'];
  mouthMorphs = mouthMorphNames.map(name => {
    const index = mesh.morphTargetDictionary[name];
    return index !== undefined ? { name, index, strength: name === 'あ' ? 1.0 : 0.3 } : null;
  }).filter(Boolean);
  debugLog("Mouth morphs initialized: " + mouthMorphs.map(m => m.name).join(", "));
}

function resetMouthMorphs() {
  if (!mesh) return;
  mouthMorphs.forEach(morph => { mesh.morphTargetInfluences[morph.index] = 0; });
}

function initAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    audioDataArray = new Uint8Array(analyser.frequencyBinCount);
  }
}

async function loadMP3(file) {
  try {
    initAudio();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    if (audioSource) {
      audioSource.disconnect();
      try { audioSource.stop(); } catch {}
    }
    audioSource = audioContext.createBufferSource();
    audioSource.buffer = audioBuffer;
    audioSource.loop = true;
    audioSource.connect(analyser);
    analyser.connect(audioContext.destination);
    audioSource.start();
    audioPlaying = true;
    enableMouthAnimation(true);
    audioSource.onended = () => {
      audioPlaying = false;
      enableMouthAnimation(false);
      resetMouthMorphs();
    };
    updateStatus("MP3 playing and looped", "success");
    debugLog("MP3 loaded and looped");
  } catch (e) {
    showError("MP3 loading error: " + e.message);
    debugLog("MP3 loading error: " + e.message);
  }
}

let mouthAnimationEnabled = false;
function enableMouthAnimation(enable) {
  mouthAnimationEnabled = enable;
  if (!enable) resetMouthMorphs();
}

function updateMouthAnimation() {
  if (!mouthAnimationEnabled || !mesh || !analyser) return;
  analyser.getByteFrequencyData(audioDataArray);
  let sum = 0;
  for (let i = 0; i < audioDataArray.length; i++) sum += audioDataArray[i];
  let average = sum / audioDataArray.length / 255;
  let volume = average - mouthSettings.sensitivity;
  if (volume < 0) volume = 0;
  volume = Math.min(volume * 5 * mouthSettings.strength, 1);
  mouthMorphs.forEach(morph => {
    mesh.morphTargetInfluences[morph.index] = volume * morph.strength;
  });
}

const visualizerCtx = visualizerCanvas.getContext('2d');
function drawVisualizer() {
  if (!mouthAnimationEnabled) {
    visualizerCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
    return;
  }
  analyser.getByteFrequencyData(audioDataArray);
  visualizerCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
  const barWidth = visualizerCanvas.width / audioDataArray.length;
  for (let i = 0; i < audioDataArray.length; i++) {
    const barHeight = (audioDataArray[i] / 255) * visualizerCanvas.height;
    visualizerCtx.fillStyle = 'rgba(74, 108, 247, 0.8)';
    visualizerCtx.fillRect(i * barWidth, visualizerCanvas.height - barHeight, barWidth * 0.8, barHeight);
  }
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  if (ready && helper) helper.update(clock.getDelta());
  updateMouthAnimation();
  drawVisualizer();
  renderer.render(scene, camera);
}

function toggleDanceAnimation() {
  danceAnimationEnabled = !danceAnimationEnabled;
  if (mixer) {
    mixer.timeScale = danceAnimationEnabled ? currentSpeed : 0;
    setIcon('play-btn', danceAnimationEnabled ? iconSvgs.pause : iconSvgs.play);
    updateStatus(danceAnimationEnabled ? "Dance animation enabled" : "Dance animation disabled", "success");
  }
  if (!danceAnimationEnabled) resetMouthMorphs();
}

function openModelSelector() {
  modelSelectPanel.style.display = 'block';
  modelSelectBtn.setAttribute('aria-expanded', 'true');
  refreshModelList();
}
function closeModelSelector() {
  modelSelectPanel.style.display = 'none';
  modelSelectBtn.setAttribute('aria-expanded', 'false');
}

function refreshModelList() {
  modelList.innerHTML = '';
  localModels.forEach((model, i) => {
    const btn = document.createElement('button');
    btn.textContent = model.name;
    btn.onclick = async () => {
      closeModelSelector();
      await loadModel(model.url);
      await loadAnimation('idle');
    };
    modelList.appendChild(btn);
  });
}

modelSelectBtn.addEventListener('click', () => {
  if (modelSelectPanel.style.display === 'block') closeModelSelector();
  else openModelSelector();
});

modelUploadBtn.addEventListener('click', () => modelFileInput.click());
modelFileInput.addEventListener('change', async e => {
  if (!e.target.files.length) return;
  try {
    await loadModel(e.target.files[0]);
    localModels.push({ name: e.target.files[0].name, url: e.target.files[0] });
    refreshModelList();
    closeModelSelector();
    await loadAnimation('idle');
  } catch (err) {
    debugLog("Model loading error: " + err.message);
  }
});

playBtn.addEventListener('click', togglePlayPause);
resetBtn.addEventListener('click', resetAnimation);
speedDownBtn.addEventListener('click', () => changeSpeed(-0.1));
speedUpBtn.addEventListener('click', () => changeSpeed(0.1));

const animUploadInput = document.createElement('input');
animUploadInput.type = 'file';
animUploadInput.accept = '.vmd';
animUploadInput.style.display = 'none';
document.body.appendChild(animUploadInput);

animSelectBtn.addEventListener('click', () => animUploadInput.click());

animUploadInput.addEventListener('change', async e => {
  if (e.target.files.length) {
    await loadAnimationVMD(e.target.files[0]);
  }
});

const cameraUploadInput = document.createElement('input');
cameraUploadInput.type = 'file';
cameraUploadInput.accept = '.vmd';
cameraUploadInput.style.display = 'none';
document.body.appendChild(cameraUploadInput);

document.getElementById('lighting-btn').addEventListener('click', () => {
  // Для примера — загружаем камеру из файла
  cameraUploadInput.click();
});

cameraUploadInput.addEventListener('change', async e => {
  if (e.target.files.length) {
    await loadCameraVMD(e.target.files[0]);
  }
});

danceToggleBtn.addEventListener('click', toggleDanceAnimation);

audioUploadBtn.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'audio/mpeg, audio/mp3';
  input.onchange = async e => {
    if (e.target.files.length) await loadMP3(e.target.files[0]);
  };
  input.click();
});

mouthSettingsBtn.addEventListener('click', () => {
  mouthSettingsPanel.style.display = mouthSettingsPanel.style.display === 'block' ? 'none' : 'block';
  lightingSettingsPanel.style.display = 'none';
});

sensitivitySlider.addEventListener('input', e => mouthSettings.sensitivity = parseFloat(e.target.value));
strengthSlider.addEventListener('input', e => mouthSettings.strength = parseFloat(e.target.value));

ambientLightRange.addEventListener('input', e => ambientLight.intensity = parseFloat(e.target.value));
directionalLightRange.addEventListener('input', e => directionalLight.intensity = parseFloat(e.target.value));

function startApp() {
  debugLog("Starting app");
  init();
  loadModel(defaultModels[0].url)
    .then(() => loadAnimation('bts-bestofme'))
    .then(() => animate())
    .catch(e => {
      showError('Initialization error: ' + e.message);
      updateStatus("Initialization error", "error");
      debugLog("Initialization error: " + e.message);
    });
}
startApp();
    
