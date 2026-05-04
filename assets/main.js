'use strict';

// ════════════════════════════════════════════════════════
//  SETUP
// ════════════════════════════════════════════════════════
const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');
const wfill  = document.getElementById('wfill');
const hintEl = document.getElementById('hint');
let W, H;
const resize = () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; };
resize();
window.addEventListener('resize', () => { resize(); resizeScene(); });

const lerp  = (a,b,t) => a + (b-a)*t;
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const PI = Math.PI;
const {sin, cos, atan2, abs, sign} = Math;

// fade hint after a few seconds
setTimeout(()=>hintEl.classList.add('fade'), 300);

// ════════════════════════════════════════════════════════
//  LIVE PARAMETERS
// ════════════════════════════════════════════════════════
const P = {
  windForce:   1.95,
  windSpeed:   1.0,
  turbulence:  0.5,
  stiffness:   1.9,
  damping:     1.6,
  swing:       0.70,
  depth:       3.5,
  leaves:      2,
  armReach:    2.0,
  grabChance:  1.00,
  fallGravity: 1.0,
  reachTime:   2.0,
  pixelSize:   3,
  detail:      1.00,
  time:        0.40,
  month:       3,    // 0..12 (Jan..Dec); 3.0 = April (game start)
  appleCount:  0.10,
  branchLen:   0.8,
  grass:       1.0,
  dayPace:     1.0,
  hungerPace:  2.0,
  weightMult:  1.0,
  endMonths:   30,
  musicVol:    0.50,
  fxVol:       0.80,
};

// ════════════════════════════════════════════════════════
//  SLIDER WIRING
// ════════════════════════════════════════════════════════
const sliderDefs = [
  { id:'windForce',   fmt: v => v.toFixed(2) },
  { id:'windSpeed',   fmt: v => v.toFixed(2) },
  { id:'turbulence',  fmt: v => v.toFixed(2) },
  { id:'stiffness',   fmt: v => v.toFixed(2) },
  { id:'damping',     fmt: v => v.toFixed(2) },
  { id:'swing',       fmt: v => v.toFixed(2) },
  { id:'depth',       fmt: v => v.toFixed(1), rebuild: true },
  { id:'leaves',      fmt: v => v.toFixed(0) },
  { id:'armReach',    fmt: v => v.toFixed(2) },
  { id:'fallGravity', fmt: v => v.toFixed(2) },
  { id:'reachTime',   fmt: v => v.toFixed(1) },
  { id:'pixelSize',   fmt: v => v.toFixed(0) },
  { id:'detail',      fmt: v => v.toFixed(2), rebuild: true },
  { id:'branchLen',   fmt: v => v.toFixed(2) + 'x', rebuild: true },
  { id:'time',        fmt: v => v.toFixed(2), onChange: 'time' },
  { id:'month',       fmt: monthFmt, onChange: 'month' },
  { id:'appleCount',  fmt: v => v.toFixed(2), respawnFruits: true },
  { id:'dayPace',     fmt: v => v.toFixed(1) + 'x' },
  { id:'hungerPace',  fmt: v => v.toFixed(1) + 'x' },
  { id:'weightMult',  fmt: v => v.toFixed(1) + 'x' },
  { id:'endMonths',   fmt: v => v.toFixed(0) },
  { id:'grass',       fmt: v => v.toFixed(2) + 'x', onChange: 'grass' },
  { id:'musicVol',    fmt: v => Math.round(v * 100) + '%', onChange: 'musicVol' },
  { id:'fxVol',       fmt: v => Math.round(v * 100) + '%', onChange: 'fxVol' }
];
sliderDefs.forEach(({id,fmt,rebuild,respawnFruits,onChange})=>{
  const el  = document.getElementById('s-'+id);
  const val = document.getElementById('v-'+id);
  el.addEventListener('input', ()=>{
    P[id] = parseFloat(el.value);
    val.textContent = fmt(P[id]);
    if(rebuild) buildTree();
    if(respawnFruits && fruitsMode) spawnFruits();
    if(onChange === 'time') dayTime = P.time;
    if(onChange === 'month'){ seasonTime = P.month / 12; }
    if(onChange === 'grass'){ makeGrassBlades(); }
    if(onChange === 'musicVol'){ Audio.applyVolumes(); }
    if(onChange === 'fxVol'){ Audio.applyVolumes(); }
  });
});

// ════════════════════════════════════════════════════════
//  PANEL TOGGLE  (button at bottom; panel slides in/out)
// ════════════════════════════════════════════════════════
const panel  = document.getElementById('panel');
const toggle = document.getElementById('toggle');
let panelOpen = false;   // start collapsed
function applyPanelState(){
  panel.classList.toggle('hidden', !panelOpen);
  toggle.textContent = panelOpen ? 'CLOSE' : 'PARAMS';
}
toggle.addEventListener('click', ()=>{ panelOpen = !panelOpen; applyPanelState(); });
applyPanelState();

// ════════════════════════════════════════════════════════
//  FEATURE TOGGLES (Pixelize, Sloth)
// ════════════════════════════════════════════════════════
const tPixel   = document.getElementById('t-pixel');
const lPixel   = document.getElementById('l-pixel');
const tSloth   = document.getElementById('t-sloth');
const lSloth   = document.getElementById('l-sloth');
const tBlurBg     = document.getElementById('t-blurbg');
const lBlurBg     = document.getElementById('l-blurbg');
const tBlurClouds = document.getElementById('t-blurclouds');
const lBlurClouds = document.getElementById('l-blurclouds');
const tWeight     = document.getElementById('t-weight');
const lWeight     = document.getElementById('l-weight');
const scanlines   = document.getElementById('scanlines');

let pixelMode = false;
let slothMode = true;
let blurBgMode = true;
let blurCloudsMode = false;
let weightMode = true;

function applyPixel(){
  tPixel.classList.toggle('on', pixelMode);
  lPixel.textContent = pixelMode ? 'ON' : 'OFF';
  scanlines.style.display = pixelMode ? 'block' : 'none';
  if(!pixelMode) colorCache.clear();
}
function applySloth(){
  tSloth.classList.toggle('on', slothMode);
  lSloth.textContent = slothMode ? 'ON' : 'OFF';
  if(slothMode && !sloth) slothPending = true;
  if(!slothMode) sloth = null;
}
function applyBlurBg(){
  tBlurBg.classList.toggle('on', blurBgMode);
  lBlurBg.textContent = blurBgMode ? 'ON' : 'OFF';
}
function applyBlurClouds(){
  tBlurClouds.classList.toggle('on', blurCloudsMode);
  lBlurClouds.textContent = blurCloudsMode ? 'ON' : 'OFF';
}
function applyWeight(){
  tWeight.classList.toggle('on', weightMode);
  lWeight.textContent = weightMode ? 'ON' : 'OFF';
}
tPixel.addEventListener('click', ()=>{ pixelMode = !pixelMode; applyPixel(); });
tSloth.addEventListener('click', ()=>{ slothMode = !slothMode; applySloth(); });
tBlurBg.addEventListener('click', ()=>{ blurBgMode = !blurBgMode; applyBlurBg(); });
tBlurClouds.addEventListener('click', ()=>{ blurCloudsMode = !blurCloudsMode; applyBlurClouds(); });
tWeight.addEventListener('click', ()=>{ weightMode = !weightMode; applyWeight(); });

// ════════════════════════════════════════════════════════
//  AUDIO  (Web Audio API, fully procedural)
//
//  Everything is synthesized at runtime — no asset files.
//
//  • Wind: continuous looped pink-noise → low-pass filter → gain.
//    Both the gain (volume) and the filter cutoff (brightness)
//    are modulated each frame by Wind.str, so the audio
//    perfectly tracks the visual wind strength.
//
//  • Turbulence: when Wind.tick picks a new targetMag that
//    is significantly higher than the current target, a short
//    band-passed noise burst with a downward-sweeping centre
//    frequency plays — a sudden "whoosh".
//
//  • Grab: Sloth._grab() triggers a 200 ms low sine "thunk"
//    layered with a brief high-pass leaf-rustle.
//
//  AudioContext is created lazily on the first toggle-ON because
//  browsers require a user gesture before audio can start.
// ════════════════════════════════════════════════════════
const Audio = {
  ctx: null, noiseSrc: null, filter: null, gain: null,
  enabled: false,

  // Master bus gain nodes. Every sound effect connects to _fxBus
  // (which then connects to ctx.destination); music connects to
  // _musicBus. The MUSIC VOL and SFX VOL sliders adjust these.
  _fxBus: null,
  _musicBus: null,
  applyVolumes(){
    if(!this.ctx) return;
    if(this._fxBus){
      this._fxBus.gain.cancelScheduledValues(this.ctx.currentTime);
      this._fxBus.gain.setValueAtTime(typeof P !== 'undefined' ? P.fxVol : 0.8, this.ctx.currentTime);
    }
    if(this._musicBus){
      this._musicBus.gain.cancelScheduledValues(this.ctx.currentTime);
      this._musicBus.gain.setValueAtTime(typeof P !== 'undefined' ? P.musicVol : 0.5, this.ctx.currentTime);
    }
  },
  ensureCtx(){
    if(this.ctx) return;
    try { this.ctx = new (window.AudioContext||window.webkitAudioContext)(); }
    catch(e){ return; }

    // Master bus gain nodes — created before any sound nodes so they
    // can be used as the connection target everywhere.
    this._fxBus    = this.ctx.createGain();
    this._musicBus = this.ctx.createGain();
    this._fxBus.gain.value    = (typeof P !== 'undefined' ? P.fxVol    : 0.8);
    this._musicBus.gain.value = (typeof P !== 'undefined' ? P.musicVol : 0.5);
    this._fxBus.connect(this.ctx.destination);
    this._musicBus.connect(this.ctx.destination);

    // Generate 2-second pink-noise loop (Voss-McCartney filter on white noise)
    const sr  = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, sr*2, sr);
    const d   = buf.getChannelData(0);
    let b0=0,b1=0,b2=0;
    for(let i=0;i<d.length;i++){
      const w = Math.random()*2-1;
      b0 = 0.99765*b0 + w*0.0990460;
      b1 = 0.96300*b1 + w*0.2965164;
      b2 = 0.57000*b2 + w*1.0526913;
      d[i] = (b0+b1+b2 + w*0.1848) * 0.18;
    }

    this.noiseSrc = this.ctx.createBufferSource();
    this.noiseSrc.buffer = buf; this.noiseSrc.loop = true;

    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 400;
    this.filter.Q.value = 0.6;

    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0;

    this.noiseSrc.connect(this.filter);
    this.filter.connect(this.gain);
    this.gain.connect(this._fxBus);
    this.noiseSrc.start();
  },

  // ── BACKGROUND MUSIC — Mossy Perch, fetched from assets/audio/ as mp3.
  // Played through its own gain node so it can be enabled/disabled
  // independently of sound effects.
  _musicBuffer: null,
  _musicSource: null,
  _musicGain: null,
  _musicLoading: false,
  _musicWanted: false,        // most-recent intent: should music be playing?
  _musicSampleUrl: 'assets/audio/mossy-perch.mp3',
  _ensureMusicBuffer(cb){
    if(!this.ctx) return;
    if(this._musicBuffer){ cb && cb(); return; }
    if(this._musicLoading) return;        // fetch/decode already in flight
    this._musicLoading = true;
    const ctx = this.ctx;
    fetch(this._musicSampleUrl)
      .then(r => {
        if(!r.ok) throw new Error('HTTP ' + r.status);
        return r.arrayBuffer();
      })
      .then(buf => ctx.decodeAudioData(buf))
      .then(buffer => {
        this._musicBuffer = buffer;
        this._musicLoading = false;
        // If music was requested while we were loading, kick it off now.
        if(this._musicWanted) this.startMusic();
        cb && cb();
      })
      .catch(err => {
        console.warn('Music sample load failed:', err);
        this._musicLoading = false;
      });
  },
  startMusic(){
    this._musicWanted = true;
    if(!this.enabled || !this.ctx) return;
    this._ensureMusicBuffer();
    if(!this._musicBuffer) return;        // still decoding — will retry
    if(this._musicSource) return;         // already playing
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._musicBuffer;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(g);
    g.connect(this._musicBus);
    src.start();
    this._musicSource = src;
    this._musicGain = g;
    // Smooth fade-in
    const t = ctx.currentTime;
    g.gain.linearRampToValueAtTime(0.22, t + 1.6);
  },
  stopMusic(){
    this._musicWanted = false;
    if(!this._musicSource || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = this._musicSource;
    const g = this._musicGain;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + 0.6);
    // Stop the source after the fade so it can be restarted cleanly
    setTimeout(() => {
      try { src.stop(); } catch(e){}
      try { src.disconnect(); } catch(e){}
      try { g.disconnect();   } catch(e){}
    }, 700);
    this._musicSource = null;
    this._musicGain = null;
  },

  setEnabled(on){
    this.enabled = on;
    if(on){
      this.ensureCtx();
      if(this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    } else if(this.gain && this.ctx){
      const t = this.ctx.currentTime;
      this.gain.gain.cancelScheduledValues(t);
      this.gain.gain.linearRampToValueAtTime(0, t + 0.1);
      // Mute the continuous snore + rain loops too
      if(this._snoreNodes){
        this._snoreNodes.master.gain.cancelScheduledValues(t);
        this._snoreNodes.master.gain.linearRampToValueAtTime(0, t + 0.1);
      }
      if(this._rainNodes){
        this._rainNodes.master.gain.cancelScheduledValues(t);
        this._rainNodes.master.gain.linearRampToValueAtTime(0, t + 0.1);
      }
      // Stop the background music too
      this.stopMusic();
    }
  },

  // Called every frame from the main loop
  updateWind(strength){
    if(!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    // Volume scales quadratically — quiet breeze, loud gusts
    const targetGain = strength * strength * 0.30;
    this.gain.gain.linearRampToValueAtTime(targetGain, t + 0.15);
    // Filter opens up with stronger wind (sounds brighter / more whoosh)
    const cutoff = 180 + strength * 2200;
    this.filter.frequency.linearRampToValueAtTime(cutoff, t + 0.15);
  },

  // Triggered by Wind.tick on a sudden targetMag jump
  playGust(intensity){
    if(!this.enabled || !this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const dur = 0.45 + Math.random() * 0.45;
    const buf = ctx.createBuffer(1, ctx.sampleRate*dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i] = (Math.random()*2-1) * 0.5;

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    const cFreq = 380 + Math.random()*700;
    f.frequency.setValueAtTime(cFreq*1.6, now);
    f.frequency.exponentialRampToValueAtTime(cFreq*0.45, now + dur);
    f.Q.value = 1.2;

    const g = ctx.createGain();
    const peak = Math.min(0.30, intensity * 0.35);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(peak, now + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(f); f.connect(g); g.connect(this._fxBus);
    src.start(now); src.stop(now + dur);
  },

  // Triggered by Sloth._grab on a successful branch grab
  playGrab(){
    if(!this.enabled || !this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime;

    // Layer 1 — low "thunk" (sine descending in pitch, fast decay)
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.13);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.32, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.20);
    osc.connect(og); og.connect(this._fxBus);
    osc.start(now); osc.stop(now + 0.22);

    // Layer 2 — high-pass noise rustle (leaves)
    const dur = 0.16;
    const buf = ctx.createBuffer(1, ctx.sampleRate*dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i] = (Math.random()*2-1) * 0.3;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 1800; hp.Q.value = 0.7;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.18, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(hp); hp.connect(ng); ng.connect(this._fxBus);
    src.start(now); src.stop(now + dur);
  },

  // ── CONTINUOUS SNORE LOOP ─────────────────────────────
  // Snore audio: real recorded sample looped through a master gain.
  // The gain is driven by setSnoreLevel(v) from the Sloth class so the
  // cyclic fade-in / steady / fade-out / silence-gap behavior keeps
  // working unchanged. Sample is decoded once on first need; before
  // it's ready, level changes are stashed and applied on completion.
  _snoreNodes: null,
  _snoreBuffer: null,
  _snoreLoading: false,
  _snorePending: null,    // last requested level while decode is in-flight
  _snoreSampleUrl: 'assets/audio/snore.mp3',
  _ensureSnore(){
    if(!this.ctx || this._snoreNodes || this._snoreLoading) return;
    const ctx = this.ctx;

    const finalize = (buffer) => {
      this._snoreBuffer = buffer;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const master = ctx.createGain();
      master.gain.value = 0;
      src.connect(master);
      master.connect(this._fxBus);
      src.start();
      this._snoreNodes = { master, source: src };
      this._snoreLoading = false;
      // If a level was requested while we were decoding, apply it now.
      if(this._snorePending !== null){
        const v = this._snorePending;
        this._snorePending = null;
        this.setSnoreLevel(v);
      }
    };

    this._snoreLoading = true;
    // Fetch the snore sample → ArrayBuffer → AudioBuffer.
    fetch(this._snoreSampleUrl)
      .then(r => {
        if(!r.ok) throw new Error('HTTP ' + r.status);
        return r.arrayBuffer();
      })
      .then(buf => ctx.decodeAudioData(buf))
      .then(finalize)
      .catch(err => {
        console.warn('Snore sample load failed:', err);
        this._snoreLoading = false;
      });
  },
  setSnoreLevel(v){
    if(!this.enabled){ v = 0; }
    this._ensureSnore();
    if(!this._snoreNodes){
      // Decode in flight — remember the latest requested level so we can
      // apply it as soon as the buffer is ready.
      this._snorePending = v;
      return;
    }
    const t = this.ctx.currentTime;
    const g = this._snoreNodes.master.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(v * 0.85, t + 0.10);
  },

  // ── CONTINUOUS RAIN LOOP ──────────────────────────────
  // Filtered white noise with a slow modulating low-pass for natural
  // variation — sounds like ambient downpour. Master gain follows
  // the visual rainIntensity from setRainLevel.
  _rainNodes: null,
  _ensureRain(){
    if(!this.ctx || this._rainNodes) return;
    const ctx = this.ctx;
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, sr * 4, sr);
    const d = buf.getChannelData(0);
    for(let i = 0; i < d.length; i++) d[i] = Math.random()*2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf; noise.loop = true;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 280;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 5500;

    // Slow LFO sweeping the low-pass for wind-shifting rain texture
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.12;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 1500;
    lfo.connect(lfoGain);
    lfoGain.connect(lp.frequency);

    const master = ctx.createGain();
    master.gain.value = 0;

    noise.connect(hp);
    hp.connect(lp);
    lp.connect(master);
    master.connect(this._fxBus);

    noise.start();
    lfo.start();
    this._rainNodes = { master };
  },
  setRainLevel(v){
    if(!this.enabled){ v = 0; }
    this._ensureRain();
    if(!this._rainNodes) return;
    const t = this.ctx.currentTime;
    const g = this._rainNodes.master.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(v * 0.22, t + 0.20);
  },

  // ── UI feedback: TARGET VALID — quick rising chirp (positive)
  playTargetValid(){
    if(!this.enabled || !this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(620, now);
    o.frequency.exponentialRampToValueAtTime(1180, now + 0.10);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.20, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    o.connect(g); g.connect(this._fxBus);
    o.start(now); o.stop(now + 0.18);
    // Layer a softer triangle harmonic for a fuller sound
    const o2 = ctx.createOscillator();
    o2.type = 'triangle';
    o2.frequency.setValueAtTime(310, now);
    o2.frequency.exponentialRampToValueAtTime(590, now + 0.10);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.08, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    o2.connect(g2); g2.connect(this._fxBus);
    o2.start(now); o2.stop(now + 0.18);
  },

  // ── THUNDER — real recorded thunder strike sample, fetched as mp3.
  // Decoded lazily on first need; subsequent calls reuse the cached
  // AudioBuffer and play a fresh BufferSource with distance-scaled gain.
  // A small distance-scaled lowpass filter softens far strikes so they
  // sound muffled like real distant thunder.
  _thunderBuffer: null,
  _thunderLoading: false,
  _thunderSampleUrl: 'assets/audio/thunder.mp3',
  _ensureThunder(){
    if(!this.ctx || this._thunderBuffer || this._thunderLoading) return;
    const ctx = this.ctx;
    this._thunderLoading = true;
    fetch(this._thunderSampleUrl)
      .then(r => {
        if(!r.ok) throw new Error('HTTP ' + r.status);
        return r.arrayBuffer();
      })
      .then(buf => ctx.decodeAudioData(buf))
      .then(buffer => {
        this._thunderBuffer = buffer;
        this._thunderLoading = false;
      })
      .catch(err => {
        console.warn('Thunder sample load failed:', err);
        this._thunderLoading = false;
      });
  },
  playThunder(distance){
    if(!this.enabled || !this.ctx) return;
    this._ensureThunder();
    if(!this._thunderBuffer) return;     // still decoding — skip this strike
    const ctx = this.ctx, now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._thunderBuffer;
    // Distance: 0 = right above us (loud, full-range), 1 = far away
    // (quieter, more muffled). Cap distance to [0, 1].
    const d = Math.max(0, Math.min(1, distance));
    const peak = Math.max(0.18, 0.95 - d * 0.55);
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, now);
    // Gentle late-tail fade so the sample's natural decay still ends silent
    g.gain.setValueAtTime(peak, now + this._thunderBuffer.duration - 0.30);
    g.gain.linearRampToValueAtTime(0.0001, now + this._thunderBuffer.duration);
    // Distance-driven lowpass: closer strikes are bright, far ones dull.
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 18000 - d * 14000;   // 18 kHz close → 4 kHz far
    lp.Q.value = 0.7;
    src.connect(lp); lp.connect(g); g.connect(this._fxBus);
    src.start(now);
  },

  // ── EAT LEAF — soft crunchy noise burst
  playEatLeaf(){
    if(!this.enabled || !this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const dur = 0.32;
    const buf = ctx.createBuffer(1, ctx.sampleRate*dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0; i<d.length; i++) d[i] = (Math.random()*2 - 1) * 0.7;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2200, now);
    bp.frequency.exponentialRampToValueAtTime(900, now + dur);
    bp.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.20, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(bp); bp.connect(g); g.connect(this._fxBus);
    src.start(now); src.stop(now + dur + 0.05);
  },

  // ── EAT APPLE — juicy bite + chime
  playEatApple(){
    if(!this.enabled || !this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime;
    // Crunch layer
    const dur = 0.20;
    const buf = ctx.createBuffer(1, ctx.sampleRate*dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0; i<d.length; i++) d[i] = (Math.random()*2 - 1);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1500, now);
    lp.frequency.exponentialRampToValueAtTime(400, now + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.28, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(lp); lp.connect(g); g.connect(this._fxBus);
    src.start(now); src.stop(now + dur + 0.05);
    // Chime — triangle tone, rising third
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(660, now + 0.06);
    o.frequency.exponentialRampToValueAtTime(990, now + 0.30);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0, now);
    og.gain.linearRampToValueAtTime(0.18, now + 0.10);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    o.connect(og); og.connect(this._fxBus);
    o.start(now); o.stop(now + 0.45);
  },

  // ── STARVE — sad descending whimper
  playStarve(){
    if(!this.enabled || !this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const dur = 1.4;
    // Three falling notes
    const notes = [{f1:520, f2:380, t:0.00}, {f1:400, f2:280, t:0.40}, {f1:300, f2:160, t:0.85}];
    for(const n of notes){
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(n.f1, now + n.t);
      o.frequency.exponentialRampToValueAtTime(n.f2, now + n.t + 0.45);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 900;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now + n.t);
      g.gain.linearRampToValueAtTime(0.18, now + n.t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, now + n.t + 0.50);
      o.connect(lp); lp.connect(g); g.connect(this._fxBus);
      o.start(now + n.t); o.stop(now + n.t + 0.55);
    }
  },

  // ── UI feedback: TARGET INVALID — two-note "nono" (descending)
  playTargetInvalid(){
    if(!this.enabled || !this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime;
    // Repeated falling square notes — very 8-bit "nope"
    const note = (startT) => {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(300, startT);
      o.frequency.exponentialRampToValueAtTime(220, startT + 0.09);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.11, startT);
      g.gain.exponentialRampToValueAtTime(0.001, startT + 0.12);
      o.connect(g); g.connect(this._fxBus);
      o.start(startT); o.stop(startT + 0.14);
    };
    note(now);
    note(now + 0.16);
  },
};

// SOUND toggle wiring
const tSound = document.getElementById('t-sound');
const lSound = document.getElementById('l-sound');
// Three audio modes: 'full' (music + fx), 'fx' (no music, fx only), 'off' (silent).
// soundMode is kept as a derived boolean for any legacy code paths that
// expect it; it's true unless audioMode is 'off'.
const AUDIO_MODES = ['full', 'fx', 'off'];
let audioMode = 'full';
let soundMode = true;
function applySound(){
  // Derived flag: any sound at all?
  soundMode = (audioMode !== 'off');
  // Panel toggle reflects the on/off side of things
  tSound.classList.toggle('on', soundMode);
  lSound.textContent = soundMode ? 'ON' : 'OFF';
  Audio.setEnabled(soundMode);
  // Music on only in the 'full' mode. setEnabled(true) above ensured the
  // audio context is live; now drive the music start/stop accordingly.
  if(audioMode === 'full'){
    Audio.startMusic();
  } else {
    Audio.stopMusic();
  }
  // Update the bottom-right cycle icon
  const icSoundBtn = document.getElementById('ic-sound');
  if(icSoundBtn){
    icSoundBtn.classList.remove('mode-full', 'mode-fx', 'mode-off');
    icSoundBtn.classList.add('mode-' + audioMode);
    icSoundBtn.title = audioMode === 'full' ? 'BG music + FX (click to cycle)'
                    : audioMode === 'fx'    ? 'Just FX (click to cycle)'
                    :                         'No sound (click to cycle)';
  }
}
// Panel sound toggle now cycles through the three modes too.
// Space toggles pause while playing. Block default scroll behavior.
window.addEventListener('keydown', e => {
  if(e.code === 'Space' || e.key === ' '){
    if(gameState === 'PLAYING' && !gameOver){
      e.preventDefault();
      togglePause();
    }
  }
});
tSound.addEventListener('click', () => {
  const idx = AUDIO_MODES.indexOf(audioMode);
  audioMode = AUDIO_MODES[(idx + 1) % AUDIO_MODES.length];
  applySound();
});

// Bottom-right icon buttons: sound on/off + fullscreen on/off.
const icSound = document.getElementById('ic-sound');
const icFull  = document.getElementById('ic-full');

// Sound: cycle through the three audio modes on each click. Same logic
// as the panel toggle — share state via the audioMode global.
icSound.addEventListener('click', () => {
  const idx = AUDIO_MODES.indexOf(audioMode);
  audioMode = AUDIO_MODES[(idx + 1) % AUDIO_MODES.length];
  applySound();
});

// Fullscreen using the standard Fullscreen API. Webkit prefix as a
// fallback for older Safari versions.
function isFullscreen(){
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}
function enterFullscreen(){
  const el = document.documentElement;
  if(el.requestFullscreen)         return el.requestFullscreen();
  if(el.webkitRequestFullscreen)   return el.webkitRequestFullscreen();
}
function exitFullscreen(){
  if(document.exitFullscreen)         return document.exitFullscreen();
  if(document.webkitExitFullscreen)   return document.webkitExitFullscreen();
}
function applyFullscreen(){
  // The .off class flips the on/off SVGs. When fullscreen, show the
  // exit-fullscreen icon; when not, show the enter-fullscreen icon.
  icFull.classList.toggle('off', isFullscreen());
}
icFull.addEventListener('click', () => {
  if(isFullscreen()) exitFullscreen(); else enterFullscreen();
});
// Track external fullscreen exits (e.g. Esc key, browser UI).
document.addEventListener('fullscreenchange', applyFullscreen);
document.addEventListener('webkitfullscreenchange', applyFullscreen);

const tFruits = document.getElementById('t-fruits');
const lFruits = document.getElementById('l-fruits');
let fruitsMode = true;
function applyFruits(){
  tFruits.classList.toggle('on', fruitsMode);
  lFruits.textContent = fruitsMode ? 'ON' : 'OFF';
  if(!fruitsMode){ fruits = []; fallingLeaves = []; }
  else if(fruits.length === 0 && roots.length) spawnFruits();
}
tFruits.addEventListener('click', ()=>{ fruitsMode = !fruitsMode; applyFruits(); });

// DAY-CYCLE auto toggle
const tDayauto = document.getElementById('t-dayauto');
const lDayauto = document.getElementById('l-dayauto');
let dayAuto = true;
function applyDayauto(){
  tDayauto.classList.toggle('on', dayAuto);
  lDayauto.textContent = dayAuto ? 'ON' : 'OFF';
}
tDayauto.addEventListener('click', ()=>{ dayAuto = !dayAuto; applyDayauto(); });

// RAIN toggle
const tRain = document.getElementById('t-rain');
const lRain = document.getElementById('l-rain');
let rainMode = true;
function applyRain(){
  tRain.classList.toggle('on', rainMode);
  lRain.textContent = rainMode ? 'ON' : 'OFF';
}
tRain.addEventListener('click', ()=>{ rainMode = !rainMode; applyRain(); });

// SEASONS toggle
const tSeasons = document.getElementById('t-seasons');
const lSeasons = document.getElementById('l-seasons');
let seasonsMode = true;
function applySeasons(){
  tSeasons.classList.toggle('on', seasonsMode);
  lSeasons.textContent = seasonsMode ? 'ON' : 'OFF';
}
tSeasons.addEventListener('click', ()=>{ seasonsMode = !seasonsMode; applySeasons(); });

// SHUFFLE button → randomise background theme
const bRandomize = document.getElementById('b-randomize');
bRandomize.addEventListener('click', ()=>{ randomizeBg(); });

// 11.5 MO SLEEP calibration button.
// Sets HUNGER PACE so the sleeping sloth would starve in ~5.75 in-game
// months (twice as fast as the original 11.5-month "real sloth" baseline).
// Players reported 11.5 months felt sluggish; 2× gives the survival loop
// real bite while still feeling sloth-like.
//   While sleeping, hunger drops at (1/240) × hungerPace per real second.
//   At dayPace=D, one in-game month = DAY_CYCLE_S/|D| real seconds.
//   Setting empty-time = 11.5 in-game months yields a base of
//       (240 × |D|) / (11.5 × DAY_CYCLE_S)
//   We then double it.
const bCalibHunger = document.getElementById('b-calibHunger');
function calibrateHungerFor11_5Months(){
  const D = Math.max(0.0001, Math.abs(P.dayPace || 1));
  const required = (240 * D) / (11.5 * DAY_CYCLE_S) * 2.5;
  const sliderEl = document.getElementById('s-hungerPace');
  const labelEl  = document.getElementById('v-hungerPace');
  // Clamp to slider range so the visible slider matches the active value.
  const lo = parseFloat(sliderEl.min);
  const hi = parseFloat(sliderEl.max);
  const clamped = Math.max(lo, Math.min(hi, required));
  P.hungerPace = clamped;
  sliderEl.value = clamped.toFixed(2);
  labelEl.textContent = clamped.toFixed(2) + 'x';
}
bCalibHunger.addEventListener('click', calibrateHungerFor11_5Months);

// ════════════════════════════════════════════════════════
//  PERLIN NOISE  (1-D, gradient, fractal octaves)
// ════════════════════════════════════════════════════════
const PERM = new Uint8Array(512);
(function(){
  for(let i=0;i<256;i++) PERM[i]=i;
  for(let i=255;i>0;i--){const j=(Math.random()*(i+1))|0;[PERM[i],PERM[j]]=[PERM[j],PERM[i]];}
  for(let i=0;i<256;i++) PERM[i+256]=PERM[i];
})();
const fade = t => t*t*t*(t*(t*6-15)+10);
function perlin1(x){
  const X=Math.floor(x)&255, xf=x-Math.floor(x), u=fade(xf);
  return lerp(PERM[X]&1?xf:-xf, PERM[X+1]&1?xf-1:-(xf-1), u);
}
function fBm(x,oct=5){
  let v=0,amp=1,fr=1,max=0;
  for(let i=0;i<oct;i++){v+=perlin1(x*fr)*amp;max+=amp;amp*=.5;fr*=2.09;}
  return v/max;
}

// ════════════════════════════════════════════════════════
//  WIND  (bidirectional fBm)
// ════════════════════════════════════════════════════════
const Wind = {
  t:0, mag:0.7, targetMag:0.9, timer:0, period:2.0,
  tick(dt){
    this.t+=dt; this.timer+=dt;
    if(this.timer>=this.period){
      this.timer=0; this.period=0.8+Math.random()*4.0;
      const newTarget=(0.35+Math.random()*1.55)*P.windForce;
      // Sudden upward jump → audible turbulence "whoosh"
      const jump = newTarget - this.targetMag;
      if(jump > 0.30) Audio.playGust(jump);
      this.targetMag = newTarget;
    }
    this.mag      += (this.targetMag-this.mag)*Math.min(dt*2.6,1);
    this.targetMag = Math.max(0.28*P.windForce, this.targetMag-dt*0.22);
  },
  sample(m=1){
    const sp=P.windSpeed, tb=P.turbulence;
    const sweep=fBm(this.t*0.09*sp,3);
    const gust =fBm(this.t*0.60*sp+44,3)*0.48;
    const trb  =fBm(this.t*2.40*sp+88,2)*0.18*tb*2;
    return (sweep+gust+trb)*this.mag*m;
  },
  get str(){ return clamp(abs(fBm(this.t*0.09*P.windSpeed,2))*this.mag/1.6, 0, 1); }
};

// ════════════════════════════════════════════════════════
//  SPRING  ẍ = −k·x − c·ẋ + F
// ════════════════════════════════════════════════════════
class Spring {
  constructor(k,c){this.k=k;this.c=c;this.x=0;this.v=0;}
  step(F,dt){
    const k=this.k*P.stiffness, c=this.c*P.damping;
    const a=-k*this.x-c*this.v+F;
    this.v+=a*dt; this.x+=this.v*dt;
  }
}

// ════════════════════════════════════════════════════════
//  CUBIC BÉZIER HELPERS
// ════════════════════════════════════════════════════════
function cbPt(t,x0,y0,x1,y1,x2,y2,x3,y3){
  const m=1-t;
  return{x:m*m*m*x0+3*m*m*t*x1+3*m*t*t*x2+t*t*t*x3,
         y:m*m*m*y0+3*m*m*t*y1+3*m*t*t*y2+t*t*t*y3};
}
function cbTang(t,x0,y0,x1,y1,x2,y2,x3,y3){
  const m=1-t;
  const dx=3*(m*m*(x1-x0)+2*m*t*(x2-x1)+t*t*(x3-x2));
  const dy=3*(m*m*(y1-y0)+2*m*t*(y2-y1)+t*t*(y3-y2));
  return atan2(dx,-dy);
}

// ════════════════════════════════════════════════════════
//  BRANCH
// ════════════════════════════════════════════════════════
const SK    = [4.2, 2.8, 1.6, 0.9, 0.5, 0.3];
const SC    = [1.7, 1.3, 0.85,0.6, 0.42,0.30];
const WM    = [0.60,0.92,1.30,1.80,2.40,3.00];
const RIGID = [0.58,0.42,0.26,0.14,0.08,0.04];
const BR=[55,70,88,102,116,126], BG=[28,38,50,60,70,78], BB=[10,16,22,28,32,36];

class Branch {
  constructor(relAngle,natCurve,length,thick,depth,tOnParent=1){
    this.relAngle=relAngle; this.natCurve=natCurve;
    this.length=length; this.thick=thick; this.depth=depth;
    this.tOnParent=tOnParent; this.children=[];
    const d=Math.min(depth,SK.length-1);
    this.spring=new Spring(SK[d],SC[d]);
    this.wMult=WM[d]??3.0;
    this.baseRigid=RIGID[d]??0.04;
    this.sx=0;this.sy=0;this.p1x=0;this.p1y=0;
    this.p2x=0;this.p2y=0;this.ex=0;this.ey=0;
    this.leafSeed=[];
    if(depth>=4){
      for(let i=0;i<6;i++){
        const g=82+(Math.random()*80|0);
        // Pick a stable autumn palette per leaf so groups vary nicely.
        const v = Math.random();
        const autR = v<0.4 ? 200 + (Math.random()*40|0)   // golden yellow
                    : v<0.75 ? 215 + (Math.random()*30|0)  // orange-red
                    : 145 + (Math.random()*50|0);          // brown
        const autG = v<0.4 ? 165 + (Math.random()*35|0)
                    : v<0.75 ? 90  + (Math.random()*40|0)
                    : 80  + (Math.random()*30|0);
        const autB = v<0.4 ? 30  + (Math.random()*20|0)
                    : v<0.75 ? 25  + (Math.random()*15|0)
                    : 25  + (Math.random()*15|0);
        // Original simple ellipse leaves — slightly smaller than before
        // for a finer, lighter canopy.
        this.leafSeed.push({
          ox:(Math.random()-.5)*28, oy:(Math.random()-.5)*24-4,
          rx:6+Math.random()*7,     ry:4+Math.random()*5,
          r0:Math.random()*PI,
          r:18+(Math.random()*20|0), g, b:8+(Math.random()*14|0),
          a:.50+Math.random()*.38,
          autR, autG, autB,
        });
      }
      this.fullLeafCount = this.leafSeed.length;
    } else {
      this.fullLeafCount = 0;
    }
    // Season bookkeeping — see _updateSeasonLeaves
    this.permanentLost  = 0;        // leaves eaten or torn by heavy wind
    this.autumnSnapCount = -1;      // snapshot at autumn start, -1 = not snapped
    this.autumnShedDone = false;
    this.springGrewDone = false;
  }
  update(sx,sy,parentTang,inheritedSway,dt){
    // Sloth's weight bends the branch it's gripping (proportional to position
    // along the branch and to the branch's world tilt — horizontal branches
    // sag most under load, vertical ones barely)
    let extForce = Wind.sample(this.wMult);
    if(weightMode && typeof sloth !== 'undefined' && sloth && sloth.state !== 'FALLING' && sloth.limbs){
      const approxWA = parentTang + this.relAngle;
      // weightShare = base × user multiplier × belly factor. A fatter
      // belly weighs more, a starving thin belly weighs less. Square the
      // belly scale so the change is more pronounced (a 1.30× wide
      // silhouette has ~1.69× area / mass).
      const bellyFactor = bellyScale * bellyScale;
      const weightShare = SLOTH_WEIGHT * 0.25 * P.weightMult * bellyFactor;
      for(const limb of sloth.limbs){
        if(limb.gripped && limb.branch === this){
          extForce += weightShare * Math.sin(approxWA) * limb.t;
        }
      }
    }
    this.spring.step(extForce,dt);
    const sway=this.spring.x+inheritedSway*0.50;
    const rigidFrac=clamp(this.baseRigid*P.swing,0,1);
    const rigidSway=sway*rigidFrac;
    const bendCurve=sway*(1-rigidFrac);
    const tangStart=parentTang+this.relAngle+rigidSway;
    const totalCurv=this.natCurve+bendCurve;
    const tangEnd=tangStart+totalCurv;
    const L=this.length;
    const midTang=tangStart+totalCurv*0.5;
    const dθ=totalCurv;
    const sinc=abs(dθ)>1e-4?abs(sin(dθ*0.5)/(dθ*0.5)):1;
    const chord=L*sinc;
    this.sx=sx;this.sy=sy;
    this.ex=sx+sin(midTang)*chord;
    this.ey=sy-cos(midTang)*chord;
    const α=0.46;
    this.p1x=sx     +sin(tangStart)*L*α;
    this.p1y=sy     -cos(tangStart)*L*α;
    this.p2x=this.ex-sin(tangEnd)  *L*α;
    this.p2y=this.ey+cos(tangEnd)  *L*α;
    for(const c of this.children){
      const tp=c.tOnParent;
      const pt=cbPt(tp,this.sx,this.sy,this.p1x,this.p1y,this.p2x,this.p2y,this.ex,this.ey);
      const tg=cbTang(tp,this.sx,this.sy,this.p1x,this.p1y,this.p2x,this.p2y,this.ex,this.ey);
      c.update(pt.x,pt.y,tg,sway*tp,dt);
    }
  }
  draw(){
    const d=Math.min(this.depth,BR.length-1);
    let r = BR[d], g = BG[d], b = BB[d];
    // Winter: branches turn near-black
    if(seasonsMode){
      const wn = getSeasonInfo(seasonTime).winterness;
      if(wn > 0){
        r = Math.round(r + (12 - r) * wn);
        g = Math.round(g + (10 - g) * wn);
        b = Math.round(b + (14 - b) * wn);
      }
    }
    ctx.beginPath();
    ctx.moveTo(this.sx,this.sy);
    ctx.bezierCurveTo(this.p1x,this.p1y,this.p2x,this.p2y,this.ex,this.ey);
    ctx.strokeStyle=`rgb(${r},${g},${b})`;
    ctx.lineWidth=Math.max(this.thick,0.5);
    ctx.lineCap='round';
    ctx.stroke();
    for(const c of this.children) c.draw();
    if(this.depth>=4 && this.leafSeed.length) this._drawLeaves();
  }
  _drawLeaves(){
    const sw = this.spring.x;
    const n = Math.min(P.leaves|0, this.leafSeed.length);
    const flash = leafFlashes.get(this) || 0;
    let autumnTint = 0;
    if(seasonsMode) autumnTint = getSeasonInfo(seasonTime).autumnTint;
    for(let i = 0; i < n; i++){
      const l = this.leafSeed[i];
      ctx.save();
      ctx.translate(this.ex + l.ox, this.ey + l.oy);
      ctx.rotate(l.r0 + sw * 2.8);
      ctx.beginPath();
      ctx.ellipse(0, 0, l.rx, l.ry, 0, 0, PI * 2);
      let r = l.r, g = l.g, b = l.b;
      if(autumnTint > 0 && l.autR !== undefined){
        r = Math.round(l.r + (l.autR - l.r) * autumnTint);
        g = Math.round(l.g + (l.autG - l.g) * autumnTint);
        b = Math.round(l.b + (l.autB - l.b) * autumnTint);
      }
      ctx.fillStyle = `rgba(${r},${g},${b},${l.a})`;
      ctx.fill();
      if(flash > 0){
        ctx.beginPath();
        ctx.ellipse(0, 0, l.rx, l.ry, 0, 0, PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${flash * 0.9})`;
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

// ════════════════════════════════════════════════════════
//  FRACTAL TREE BUILDER
// ════════════════════════════════════════════════════════
const SPLIT_ANGLE=[0.54,0.42,0.32,0.25,0.20];
const LEN_RATIO=0.68, THICK_RATIO=0.63;
function fractalBranch(relAngle,natCurve,length,thick,depth,maxDepth){
  const b=new Branch(relAngle,natCurve,length,thick,depth);
  // Fractional maxDepth: at the integer floor, recurse with probability
  // equal to the fractional part. So depth=4.5 means half the depth-4
  // branches keep going to depth 5.
  const intMax = Math.floor(maxDepth);
  const frac   = maxDepth - intMax;
  if(depth >= Math.ceil(maxDepth)) return b;
  if(depth >= intMax && Math.random() >= frac) return b;
  const splitAng=SPLIT_ANGLE[Math.min(depth,SPLIT_ANGLE.length-1)];
  for(const side of [-1,1]){
    const jitter=(Math.random()-.5)*0.09;
    const asym=side*(Math.random()*0.06);
    const childAng=side*splitAng+jitter+asym;
    const childLenR=LEN_RATIO*(0.92+Math.random()*0.14);
    const childNC=sign(childAng)*(0.10+Math.random()*0.28);
    const child=fractalBranch(childAng,childNC,length*childLenR,
                               thick*THICK_RATIO,depth+1,maxDepth);
    child.tOnParent=1.0;
    b.children.push(child);
  }
  // Mid-branches — DETAIL slider controls how often they appear and
  // how deep into the tree they keep being added.
  const maxMidDepth = (P.detail > 0.6) ? 3 : 2;
  if(depth <= maxMidDepth && Math.random() < P.detail){
    const side=Math.random()<0.5?1:-1;
    const midAng=side*(splitAng*0.55+Math.random()*0.18);
    const midLenR=LEN_RATIO*0.80;
    const midNC=sign(midAng)*(0.08+Math.random()*0.22);
    const mid=fractalBranch(midAng,midNC,length*midLenR,
                             thick*THICK_RATIO*0.82,depth+1,maxDepth);
    mid.tOnParent=0.46+Math.random()*0.18;
    b.children.push(mid);
  }
  // Bonus second mid-branch at very high detail (P.detail > 0.75)
  if(depth <= 1 && P.detail > 0.75 && Math.random() < (P.detail-0.75)*3.5){
    const side=Math.random()<0.5?1:-1;
    const midAng=side*(splitAng*0.45+Math.random()*0.20);
    const midLenR=LEN_RATIO*0.72;
    const midNC=sign(midAng)*(0.08+Math.random()*0.22);
    const mid=fractalBranch(midAng,midNC,length*midLenR,
                             thick*THICK_RATIO*0.76,depth+1,maxDepth);
    mid.tOnParent=0.28+Math.random()*0.18;
    b.children.push(mid);
  }
  return b;
}

// ════════════════════════════════════════════════════════
//  SCENE STATE
// ════════════════════════════════════════════════════════
let roots=[], trunkBX,trunkBY,trunkTX,trunkTY,trunkLen;
let clouds=[], particles=[], grassBlades=[];
// Time since the user last interacted with the canvas (used for sleep mode)
let userIdleT = 0;
// Smoothed belly scale. The hunger-driven "target" snaps to whatever
// the current hunger calls for, but bellyScale eases toward it over
// roughly one in-game day-night cycle (DAY_CYCLE_S real seconds at
// dayPace=1). Used by Sloth._drawBody for visuals AND by Branch.update
// to add the belly's mass to the per-limb weight load.
let bellyScale = 1.0;
function _bellyTarget(){
  if(typeof hunger !== 'number') return 1.0;
  if(hunger >= 0.80){
    const t = Math.min(1, (hunger - 0.80) / 0.20);
    return 1.0 + 0.40 * t;
  }
  if(hunger <= 0.30){
    const t = Math.max(0, Math.min(1, (0.30 - hunger) / 0.30));
    return 1.0 - 0.40 * t;
  }
  return 1.0;
}
// Sleep timer only ticks once the sloth has actually moved at least once.
// Stops the sloth from immediately dozing off on a fresh game where the
// player hasn't interacted yet.
let slothHasMoved = false;

// ── SCENE PAN ───────────────────────────────────────
// Horizontal scroll offset. Positive values shift world content right
// (i.e. we look further "left"). Driven by swipes in the grass area.
let sceneOffsetX = 0;
let panVelX = 0;            // momentum after release
const PAN_RANGE = 600;      // how far left/right the camera can travel
const PAN_FRICTION = 0.92;


// ── HUNGER ────────────────────────────────────────────
// 0 = starving, 1 = full. Decays slowly while awake (1/120 per sec
// → ~2 minutes from full to empty), half as fast while asleep.
// Eating leaves restores ~0.18, eating apples restores ~0.35.
let hunger = 0.80;
// Visually-displayed hunger value, used by drawHungerBar. Lags slightly
// behind the actual `hunger` so additions from eating animate over ~400ms
// instead of snapping. Decreasing changes (decay) also smooth, but the
// time-constant is short enough they look continuous either way.
let displayedHunger = 0.80;
// Eased opacity for the SLEEPING label inside the hunger bar. Ramps from
// 0 to 1 over ~600ms when the sloth falls asleep, fades back to 0 when
// it wakes. While sleeping, a slower breath-rate pulse modulates the
// final opacity (drawn separately from this base envelope).
let _sleepLabelAlpha = 0;
let score = 0;
let highScore = 0;
let lives = 3;
const MAX_LIVES = 3;
// Global HUD size multiplier — scales hearts, bars, icons, fonts, paddings.
const HUD_SCALE = 1.20;
let gameOver = false;
let gameOverAt = 0;
let didWin = false;
let livesBonusGiven = 0;     // recorded for the end-of-game banner
// Each real day-night cycle (DAY_CYCLE_S sec) counts as one in-game day.
// The game ends after 12 days regardless of apple count. seasonsMode
// accelerates "month feel" but the 12-day clock is in real day-cycles.
// 12 in-game days = one year. Seasons cycle every 12 days. The game
// itself is endless — it ends only when the player runs out of lives.
const GAME_DAYS_TOTAL = 12;
let gameDaysElapsed = 0;
let _lastYearMark = 0;        // tracks year boundaries for season-flag resets

// ── HIGHSCORES + GAME STATE MACHINE ─────────────────────
// Pause flag — set via Space key or tap on the clock-area HUD slot.
// While paused, simulation dt is zeroed (physics/hunger/time freeze)
// and the audio context is suspended for total silence.
let paused = false;
function togglePause(){
  // Only meaningful while actually playing — pre-game and game-over
  // overlays handle their own input.
  if(gameState !== 'PLAYING') return;
  if(gameOver) return;
  paused = !paused;
  if(paused){
    if(Audio.ctx && Audio.ctx.state === 'running'){
      try { Audio.ctx.suspend(); } catch(e){}
    }
  } else {
    if(Audio.ctx && Audio.ctx.state === 'suspended' && soundMode){
      try { Audio.ctx.resume(); } catch(e){}
    }
  }
}
// gameState: 'START' | 'PLAYING' | 'NAME' | 'END'
//   START  — title screen with rules + leaderboard, before first game
//   PLAYING— normal simulation
//   NAME   — game just ended AND score qualifies for top 5: prompt for name
//   END    — game just ended, name handled (or didn't qualify): show board
let gameState = 'START';
const HS_KEY = 'sloth-safari-hs-v1';
const HS_MAX = 8;
let highscores = [];
function loadHighscores(){
  try{
    const raw = localStorage.getItem(HS_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      if(Array.isArray(parsed)) highscores = parsed.slice(0, HS_MAX);
    }
  } catch(e){ highscores = []; }
}
function saveHighscores(){
  try{ localStorage.setItem(HS_KEY, JSON.stringify(highscores)); } catch(e){}
}
function qualifiesForLeaderboard(s){
  if(s <= 0) return false;
  if(highscores.length < HS_MAX) return true;
  return s > highscores[highscores.length - 1].score;
}
function insertHighscore(name, s){
  highscores.push({ name: (name||'???').slice(0,8).toUpperCase(), score: s, date: Date.now() });
  highscores.sort((a, b) => b.score - a.score);
  highscores = highscores.slice(0, HS_MAX);
  saveHighscores();
}
loadHighscores();
let scorePopups = [];   // {x, y, vy, age, life, text, color}
let leafFlashes = new Map();  // branch → countdown (1→0)
const HUNGER_DECAY_AWAKE  = 1 / 120;
const HUNGER_DECAY_ASLEEP = HUNGER_DECAY_AWAKE * 0.70;
const HUNGER_LEAF_GAIN    = 0.01;
const HUNGER_APPLE_GAIN   = 0.10;
// Trunk has its own (very stiff) spring — bends gently under heavy gusts.
// The trunk top's swayed position becomes the parent anchor for primary
// branches, and its angle propagates as inheritedSway so the entire tree
// shifts coherently.
const trunkSpring = new Spring(9, 2.4);
const TRUNK_WIND_MULT = 0.14;
let trunkTopXSway = 0, trunkTopYSway = 0, trunkAngle = 0;
// How hard a sloth weighs on its branch (per gripT, scaled by sin(worldAngle))
const SLOTH_WEIGHT = 0.20;
const PRIM_DEFS=[
  {ang:-1.22,lenM:1.22},{ang:-0.70,lenM:1.06},{ang: 0.05,lenM:0.88},
  {ang: 0.72,lenM:1.08},{ang: 1.22,lenM:1.24},
];
function buildTree(){
  roots=PRIM_DEFS.map(({ang,lenM})=>{
    const a=ang+(Math.random()-.5)*0.11;
    const len=H*(0.15+Math.random()*0.04)*lenM * P.branchLen;
    const nc=sign(ang)*(0.06+Math.random()*0.18);
    return fractalBranch(a,nc,len,12,0,P.depth);
  });
  // any existing sloth must be re-anchored / respawned
  if(slothMode){ sloth=null; slothPending=true; }
  // refresh fruits on the new tree
  if(fruitsMode) spawnFruits();
}
// Recompute everything that depends on canvas dimensions but DON'T
// reshuffle the random background theme. Called both on initial load
// and on every window resize. The current bgTheme is preserved.
function resizeScene(){
  trunkBX=W*0.50; trunkBY=H*0.77; trunkLen=H*0.22;
  trunkTX=trunkBX; trunkTY=trunkBY-trunkLen;
  buildTree();
  clouds=Array.from({length:7},()=>({
    x:Math.random()*W, y:H*(0.03+Math.random()*0.20),
    rx:55+Math.random()*120, ry:22+Math.random()*36,
    a:0.46+Math.random()*0.34,
    // Slow background drift; bigger clouds move slightly slower (depth illusion)
    vx: 6 + Math.random()*16,
  }));
  particles=Array.from({length:80},()=>mkParticle(true));
  makeGrassBlades();
  makeStars();
  // Re-fit the existing background theme to the new canvas size. setBgTheme
  // re-runs the corresponding makeX() generator with the new W/H, so peaks
  // / trees / etc are spread across the resized canvas. The theme NAME
  // stays the same.
  if(bgTheme){
    setBgTheme(bgTheme);
  }
}

function init(){
  // Pick the initial theme once at startup; preserve it across resizes.
  const initialOptions = ['MOUNTAINS', 'FOREST', 'RAINFOREST'];
  bgTheme = initialOptions[Math.floor(Math.random() * initialOptions.length)];
  resizeScene();
}
function mkParticle(init=false){
  return{x:init?Math.random()*W:-100,
         y:H*(0.02+Math.random()*0.78),
         len:25+Math.random()*85,
         spd:160+Math.random()*360,
         a:0.05+Math.random()*0.13};
}

// ── GRASS ─────────────────────────────────────────────
// Generated once. Blades have varying y (depth into ground),
// height, lean, color tint, and stiffness. Drawn after the trunk
// so foreground blades cover its base — gives the tree the look
// of being rooted in the ground.
// ── GRASS (perf-optimized) ───────────────────────────
//   Blades are bucketed into a small number of (color × width) groups
//   so the hot draw loop issues just N stroke calls instead of one
//   per blade. Wind sampling is cached at a few "flex tiers" instead
//   of being called per blade.

const GRASS_FLEX_TIERS = 6;       // wind cache resolution
const GRASS_WIDTH_BUCKETS = 4;    // distinct line widths
const GRASS_COLOR_BUCKETS = 8;    // distinct colors

let grassBuckets = null;          // [{stroke, width, blades:[...]}]
let _grassWindCache = new Float32Array(GRASS_FLEX_TIERS);

function makeGrassBlades(){
  grassBlades = [];
  const groundDepth = H - trunkBY;
  // Baseline density: ~1 blade per 4 px of screen width. Then scale by
  // the GRASS slider (defaults 1.0). Clamp to keep performance sane.
  const grassMult = (typeof P !== 'undefined' && typeof P.grass === 'number') ? P.grass : 1.0;
  const baseline  = Math.max(80, Math.round(W / 4));
  const count     = Math.max(0, Math.round(baseline * grassMult));
  for(let i = 0; i < count; i++){
    const yOff = Math.pow(Math.random(), 0.7) * groundDepth * 0.55;
    const depth01 = yOff / (groundDepth * 0.55);
    const tilt   = (Math.random() - 0.5) * 0.55;
    const flex   = 0.35 + Math.random() * 0.85;
    const tint   = Math.random();
    const h      = (5 + Math.random()*14) * (0.55 + depth01 * 0.95);
    const width  = 1.2 + depth01 * 1.2;
    const x      = Math.random() * W;
    const y      = trunkBY + 1 + yOff;

    // Pre-bake colour
    const r = (34 + tint * 38 + depth01 * 30) | 0;
    const g = (80 + tint * 70 + depth01 * 35) | 0;
    const b = (28 + tint * 18 + (1 - depth01) * 20) | 0;

    // Quantize colour + width into bucket keys so blades collapse into
    // shared stroke groups.
    const cR = (r / 32) | 0;
    const cG = (g / 32) | 0;
    const cB = (b / 32) | 0;
    const wIdx = Math.min(GRASS_WIDTH_BUCKETS - 1,
                          ((width - 1.2) / 1.2 * GRASS_WIDTH_BUCKETS) | 0);
    // Quantize flex into a tier so we can use the precomputed wind cache.
    const flexTier = Math.min(GRASS_FLEX_TIERS - 1,
                              ((flex - 0.35) / 0.85 * GRASS_FLEX_TIERS) | 0);

    grassBlades.push({
      x, y, h, width,
      ax:    x + tilt * h,                 // base tip x (no wind, no osc)
      cx:    x + (tilt * h) * 0.45,        // half-bake of control x
      cy:    y - h * 0.55,                 // control y
      ty:    y - h,                         // tip y (constant)
      bend:  12 + h * 0.6,                  // wind multiplier
      flex,
      flexTier,
      // Local oscillation params — skip entirely for tiny blades
      oscAmp: h < 7 ? 0 : 1.3 * flex,
      oscPhase: Math.random() * PI * 2,
      bucketKey: cR * 256 + cG * 32 + cB + wIdx * 4096,
      colorStr: `rgb(${r},${g},${b})`,
      depth01,
    });
  }
  grassBlades.sort((a, b) => a.y - b.y);

  // Group into buckets so each draw call strokes many blades at once.
  const map = new Map();
  for(const blade of grassBlades){
    let bucket = map.get(blade.bucketKey);
    if(!bucket){
      bucket = { stroke: blade.colorStr, width: blade.width, blades: [] };
      map.set(blade.bucketKey, bucket);
    }
    bucket.blades.push(blade);
  }
  grassBuckets = Array.from(map.values());
}

function drawGrass(){
  if(!grassBuckets) return;
  // Hide grass blades under snow during winter.
  let grassAlpha = 1;
  if(seasonsMode){
    const wn = getSeasonInfo(seasonTime).winterness;
    grassAlpha = 1 - wn;
    if(grassAlpha <= 0.02) return;
  }
  const t = performance.now() * 0.001;

  // Pre-sample wind once per flex tier (6 calls instead of 320).
  for(let i = 0; i < GRASS_FLEX_TIERS; i++){
    const flex = 0.35 + (i + 0.5) / GRASS_FLEX_TIERS * 0.85;
    _grassWindCache[i] = Wind.sample(flex * 0.7);
  }

  ctx.lineCap = 'round';
  ctx.save();
  ctx.globalAlpha *= grassAlpha;
  // Render grass three times (offset by -W, 0, +W) so the field tiles
  // continuously while the camera pans.
  for(const tileX of [-W, 0, W]){
    for(const bucket of grassBuckets){
      ctx.strokeStyle = bucket.stroke;
      ctx.lineWidth = bucket.width;
      ctx.beginPath();
      for(const g of bucket.blades){
        const wind = _grassWindCache[g.flexTier] * g.bend;
        const osc = g.oscAmp ? Math.sin(t * 1.8 + g.oscPhase) * g.oscAmp : 0;
        const tipX = g.ax + wind + osc + tileX;
        const cxx = g.cx + (wind + osc) * 0.45 + tileX;
        ctx.moveTo(g.x + tileX, g.y);
        ctx.quadraticCurveTo(cxx, g.cy, tipX, g.ty);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ════════════════════════════════════════════════════════
//  SLOTH UTILITIES
// ════════════════════════════════════════════════════════
/** World position on Branch's cubic Bézier at parameter t */
function getBranchPt(b,t){
  return cbPt(t,b.sx,b.sy,b.p1x,b.p1y,b.p2x,b.p2y,b.ex,b.ey);
}
/** Tangent angle (radians) of Branch's cubic Bézier at parameter t */
function getBranchTangent(b,t){
  const dt = 0.02;
  const t1 = Math.max(0, t-dt);
  const t2 = Math.min(1, t+dt);
  const p1 = cbPt(t1,b.sx,b.sy,b.p1x,b.p1y,b.p2x,b.p2y,b.ex,b.ey);
  const p2 = cbPt(t2,b.sx,b.sy,b.p1x,b.p1y,b.p2x,b.p2y,b.ex,b.ey);
  return Math.atan2(p2.y-p1.y, p2.x-p1.x);
}
/** 2-bone IK: returns {e: elbow, h: hand} given root + target + lengths.
 *  bend ∈ {-1,+1} chooses which way the joint folds. */
function solve2IK(rx,ry,tx,ty,upper,lower,bend){
  const dx=tx-rx, dy=ty-ry;
  const dist=Math.sqrt(dx*dx+dy*dy);
  const d=Math.min(dist,(upper+lower)*0.999);
  const aim=atan2(dy,dx);
  const cosA=clamp((upper*upper+d*d-lower*lower)/(2*upper*Math.max(d,0.001)),-1,1);
  const ea=aim+Math.acos(cosA)*bend;
  const sc=dist<0.001?0:d/dist;
  return {e:{x:rx+upper*cos(ea), y:ry+upper*sin(ea)},
          h:{x:rx+dx*sc,         y:ry+dy*sc}};
}
/** Find the branch + t value nearest to canvas point (px,py). */
// Find nearest interactive food target near a tap.
// Returns {kind:'apple'|'leaf', dist, fruit?, branch?, t?} or null.
function nearestFood(px, py){
  let best = null;
  let bestDist = Infinity;
  // 1) Apples — both on tree and on the ground.
  if(typeof fruits !== 'undefined'){
    for(const f of fruits){
      if(!f.alive || (f.alive === false)) continue;
      const d = Math.hypot(f.x - px, f.y - py);
      if(d < bestDist){
        bestDist = d;
        best = { kind: 'apple', dist: d, fruit: f };
      }
    }
  }
  // 2) Leaves — sample each branch's leafSeed array. We treat any
  //    branch with leaves and a tap close to its tip as a leaf hit.
  if(P.leaves > 0){
    for(const b of allBranches()){
      const n = Math.min(P.leaves|0, b.leafSeed ? b.leafSeed.length : 0);
      if(n <= 0) continue;
      // Check the cluster around the branch tip — track which leaf was hit
      for(let i = 0; i < n; i++){
        const l = b.leafSeed[i];
        const lx = b.ex + l.ox;
        const ly = b.ey + l.oy;
        const d = Math.hypot(lx - px, ly - py);
        if(d < bestDist){
          bestDist = d;
          best = { kind: 'leaf', dist: d, branch: b, t: 1.0, leafIdx: i };
        }
      }
    }
  }
  return best;
}

function nearestBranch(px,py){
  let best=null, bestD=Infinity, bestT=0.5;
  const scan=(b)=>{
    if(b.depth>=1){
      for(let t=0.06;t<=1;t+=0.07){
        const p=getBranchPt(b,t);
        const d=Math.hypot(px-p.x,py-p.y);
        if(d<bestD){bestD=d;best=b;bestT=t;}
      }
    }
    b.children.forEach(scan);
  };
  roots.forEach(scan);
  return {branch:best,t:bestT,dist:bestD};
}
/** Flatten the branch tree into a list. */
function allBranches(){
  const list=[];
  const collect=(b)=>{list.push(b);b.children.forEach(collect);};
  roots.forEach(collect);
  return list;
}

// ════════════════════════════════════════════════════════
//  SLOTH
//  State machine:
//    HANGING  → user holds within reach of a branch → REACHING
//    REACHING → arm advances over P.reachTime seconds
//             → if user still holds && distance ≤ maxReach (≥ 0.80 progress)
//                  → grab (HANGING on new branch)
//             → if user releases OR arm fully extended but still out of range
//                  → FALLING
//    FALLING  → for each branch within 50 px while falling down:
//                  with probability P.grabChance → grab (HANGING)
//             → off screen → spawn fresh sloth
//
//  The body hangs as a damped pendulum from the grip point and inherits
//  branch motion: the wind makes the sloth swing realistically.
//  When falling, all four limbs flail with sin/cos noise.
//  Two-bone IK (law of cosines) drives every limb each frame.
// ════════════════════════════════════════════════════════
class Sloth{
  /*
   * 4-LIMB SLOTH
   *  - Four independent limbs (FL/FR arms, BL/BR legs), each with its own
   *    grip state, branch reference, and IK chain. Body position is computed
   *    from constraint-based physics (each gripped limb acts as a rope).
   *  - Reach is multi-phase: WINDUP (pre-swing) → REACH (front limbs extend)
   *    → TRANSITION (back limbs follow). The body swings naturally throughout.
   *  - Wind force on the body can pop a stretched limb during reach — too
   *    many lost grips → fall.
   */
  constructor(branch, t){
    // ── Visual proportions ──
    this.BW = 22; this.BH = 28; this.HR = 14;
    this.ARM_UP = 22; this.ARM_LOW = 19;   // arm: shoulder→elbow→hand
    this.LEG_UP = 22; this.LEG_LOW = 19;   // leg: hip→knee→foot

    // ── Limbs: spread out along the spawn branch ──
    const tFL = clamp(t - 0.05, 0.05, 0.95);
    const tFR = clamp(t + 0.05, 0.05, 0.95);
    const tBL = clamp(t - 0.10, 0.05, 0.95);
    const tBR = clamp(t + 0.10, 0.05, 0.95);
    this.limbs = [
      { name:'FL', isArm:true,  side:-1, gripped:true, branch, t:tFL, state:'GRIPPED', reachStart:null, reachProgress:0 },
      { name:'FR', isArm:true,  side:+1, gripped:true, branch, t:tFR, state:'GRIPPED', reachStart:null, reachProgress:0 },
      { name:'BL', isArm:false, side:-1, gripped:true, branch, t:tBL, state:'GRIPPED', reachStart:null, reachProgress:0 },
      { name:'BR', isArm:false, side:+1, gripped:true, branch, t:tBR, state:'GRIPPED', reachStart:null, reachProgress:0 },
    ];

    // ── Body physics state ──
    const gp = getBranchPt(branch, t);
    this.bodyX = gp.x;
    this.bodyY = gp.y + 38;
    this.bodyVx = 0;
    this.bodyVy = 0;
    // displayX/Y are the smoothed positions used for rendering. They
    // chase the physical bodyX/Y with a short time-constant so that
    // sudden positional snaps (typical at branch-to-branch transitions)
    // ease into the new position rather than teleporting.
    this.displayX = this.bodyX;
    this.displayY = this.bodyY;

    // ── State machine ──
    this.state = 'HANGING';
    this.stateT = 0;
    this.reachTarget = null;       // {branch, t, x, y}
    this.activeLimbs = [];         // limbs currently mid-reach
    this.isHeld = false;
    this.groundGrab = null;        // active ground-apple grab anim, if any

    // ── Idle / blink ──
    this.idleT = 0;
    this.idlePhase = Math.random() * PI * 2;
    this.blinkCd = 2 + Math.random() * 4;
    this.blink = 0;

    // ── Sleep / snore ──
    this.breathPhase = 0;
    this.snoreCycleT = 0;
    this.lastSnoreVol = 0;

    // ── Fall state ──
    this.fx = 0; this.fy = 0;
    this.fvx = 0; this.fvy = 0;
    this.frot = 0; this.frotv = 0;

    this.alpha = 0;
    this.alive = true;
    this.charred = false;
    this.charredAt = 0;

    // Eating state (drives hunger gain + chew animation)
    this.eatTarget = null;        // {kind:'leaf'|'apple', branch?, fruit?, x, y}
    this.eatProgress = 0;         // 0..1 chew animation
  }

  // Backwards-compat accessors (used by Branch.update for sloth-weight calc)
  get gripBranch(){
    const g = this.limbs.find(l => l.gripped);
    return g ? g.branch : null;
  }
  get gripT(){
    const g = this.limbs.find(l => l.gripped);
    return g ? g.t : 0.5;
  }

  _grippedCount(){
    let n = 0;
    for(const l of this.limbs) if(l.gripped) n++;
    return n;
  }

  _limbAttachment(limb){
    // All 4 limbs cluster around the upper body so they can hook over a
    // branch above. Arms slightly outboard, legs tucked just inside.
    // Matches the cartoon look where 4 paws line up on top of the branch.
    if(limb.isArm){
      return { x: limb.side * (this.BW * 0.62), y: -this.BH * 0.55 };
    }
    return   { x: limb.side * (this.BW * 0.34), y: -this.BH * 0.42 };
  }
  _limbMaxReach(limb){
    return limb.isArm ? (this.ARM_UP + this.ARM_LOW) : (this.LEG_UP + this.LEG_LOW);
  }

  update(dt){
    this.alpha = Math.min(1, this.alpha + dt * 2.5);
    this.stateT += dt;
    this.idleT += dt;

    // Blink
    this.blinkCd -= dt;
    if(this.blinkCd <= 0){ this.blink = 1; this.blinkCd = 3 + Math.random() * 5; }
    if(this.blink > 0) this.blink = Math.max(0, this.blink - dt * 6);

    // State dispatch
    switch(this.state){
      case 'HANGING':    /* physics-only */ break;
      case 'WINDUP':     this._windup(dt); break;
      case 'REACHING':   this._reach(dt); break;
      case 'TRANSITION': this._transition(dt); break;
      case 'FALLING':    this._fall(dt); break;
      case 'SLEEPING':   this._sleep(dt); break;
      case 'EATING':     this._eat(dt); break;
      case 'STARVING':   this._starve(dt); break;
    }

    // Body physics — skip while falling or starving (use fx/fy)
    if(this.state !== 'FALLING' && this.state !== 'STARVING') this._updateBodyPhysics(dt);

    // Render-position smoothing. The body's "true" position can snap
    // around (especially at branch-to-branch transitions when the new
    // grip points constrain the body), so the displayed position lags
    // slightly behind via exponential easing. Limbs use the smoothed
    // shoulder origin too (their hand targets remain branch-anchored)
    // so the IK adjusts gracefully during the lag window.
    if(this.state === 'FALLING' || this.state === 'STARVING'){
      // Snap during fall paths since fx/fy is used directly.
      this.displayX = this.bodyX;
      this.displayY = this.bodyY;
    } else {
      const tau = 0.18;                            // seconds to settle ~63%
      const k = 1 - Math.exp(-dt / tau);
      this.displayX += (this.bodyX - this.displayX) * k;
      this.displayY += (this.bodyY - this.displayY) * k;
    }
  }

  // ─────────────────────────────────────────────────────
  //  CONSTRAINT-BASED BODY PHYSICS
  //   Body is acted on by gravity + wind, then projected
  //   back inside each gripped limb's reach radius.
  //   Stretched limbs in heavy wind can pop loose.
  // ─────────────────────────────────────────────────────
  _updateBodyPhysics(dt){
    const nGrip = this._grippedCount();
    if(nGrip === 0){ this._beginFall(); return; }

    // Gravity (sloth has weight!) — heavier than a hanging blob.
    this.bodyVy += 320 * dt;
    // Wind force on body
    const windF = Wind.sample(0.65) * P.windForce * 110;
    this.bodyVx += windF * dt;
    // Damping — fewer grips = less stable, more swing
    const damp = nGrip >= 4 ? 0.88 : (nGrip === 3 ? 0.91 : 0.93);
    this.bodyVx *= Math.pow(damp, dt * 60);
    this.bodyVy *= Math.pow(damp, dt * 60);
    // Integrate
    this.bodyX += this.bodyVx * dt;
    this.bodyY += this.bodyVy * dt;

    // Apply limb constraints — multiple iterations for stability
    for(let iter = 0; iter < 4; iter++){
      for(const limb of this.limbs){
        if(!limb.gripped) continue;
        const gp = getBranchPt(limb.branch, limb.t);
        const att = this._limbAttachment(limb);
        const ax = this.bodyX + att.x;
        const ay = this.bodyY + att.y;
        const dx = ax - gp.x;
        const dy = ay - gp.y;
        const dist = Math.hypot(dx, dy);
        const maxDist = this._limbMaxReach(limb) * 0.95;
        if(dist > maxDist){
          const overshoot = dist - maxDist;
          const nx = dx / dist;
          const ny = dy / dist;
          // Project body back, sharing across all gripped limbs so we
          // don't yank too hard.
          this.bodyX -= nx * overshoot / nGrip;
          this.bodyY -= ny * overshoot / nGrip;
          // Cancel outward velocity component
          const vDotN = this.bodyVx * nx + this.bodyVy * ny;
          if(vDotN > 0){
            this.bodyVx -= vDotN * nx;
            this.bodyVy -= vDotN * ny;
          }
        }
      }
    }

    // Grip loss during a reach: strong wind can pop a stretched limb
    // off the branch. Rain or snow makes this much more likely:
    //   • the wind threshold drops (wet branches slip even in calm),
    //   • the per-tick slip probability gets multiplied by wetness.
    if(this.state === 'REACHING' || this.state === 'TRANSITION'){
      const stretched = [];
      for(const l of this.limbs){
        if(!l.gripped) continue;
        const gp = getBranchPt(l.branch, l.t);
        const att = this._limbAttachment(l);
        const ax = this.bodyX + att.x;
        const ay = this.bodyY + att.y;
        const dist = Math.hypot(ax - gp.x, ay - gp.y);
        if(dist > this._limbMaxReach(l) * 0.85) stretched.push(l);
      }
      if(stretched.length > 0){
        // Precipitation = rain (when not snowing) OR snow (winter).
        // rainIntensity drives both rain drops and snow flakes — the
        // _isSnowing() helper just changes which renders. So the same
        // 0..1 value works as a "wet/icy branches" factor here.
        const wet = clamp(rainIntensity, 0, 1);
        // Threshold: 1.5 normally, drops to 0.4 in heavy precip
        const threshold = 1.5 - wet * 1.1;
        // Probability multiplier: 1x normally, up to ~3.5x in heavy precip
        const wetFactor = 1 + wet * 2.5;
        if(Wind.str > threshold){
          const p = (Wind.str - threshold) * dt * 0.9 * wetFactor;
          if(Math.random() < p){
            const unlucky = stretched[Math.floor(Math.random() * stretched.length)];
            unlucky.gripped = false;
            unlucky.state = 'FREE';
            if(this._grippedCount() === 0) this._beginFall();
          }
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────
  //  REACH SEQUENCE: WINDUP → REACH → TRANSITION
  // ─────────────────────────────────────────────────────
  startReach(branch, t){
    if(this.state !== 'HANGING') return;
    slothHasMoved = true;
    const tp = getBranchPt(branch, t);
    this.reachTarget = { branch, t, x: tp.x, y: tp.y };
    // Pick the 2 limbs whose attachment points are nearest to target
    const limbsByDist = [...this.limbs].sort((a, b) => {
      const aa = this._limbAttachment(a);
      const ab = this._limbAttachment(b);
      const da = Math.hypot(this.bodyX + aa.x - tp.x, this.bodyY + aa.y - tp.y);
      const db = Math.hypot(this.bodyX + ab.x - tp.x, this.bodyY + ab.y - tp.y);
      return da - db;
    });
    this.activeLimbs = [limbsByDist[0], limbsByDist[1]];
    this.state = 'WINDUP';
    this.stateT = 0;
    this.isHeld = true;
  }

  release(){ this.isHeld = false; }

  // ─────────────────────────────────────────────────────
  //  EATING (slow — happens during reach/swing animation)
  // ─────────────────────────────────────────────────────
  // Called when the player taps a leaf or apple. We pick a branch near
  // the food, swing/reach there, then on arrival the sloth grabs the
  // food and gains hunger. For ground apples the sloth must already be
  // hanging from a low branch within reach.
  startEatLeaf(branch, t, leafIdx){
    if(this.state !== 'HANGING') return false;
    this.eatTarget = { kind: 'leaf', branch, t, leafIdx };
    // Reach to that branch — we eat on arrival
    this.startReach(branch, t);
    return true;
  }
  startEatApple(fruit){
    if(this.state !== 'HANGING') return false;
    this.eatTarget = { kind: 'apple', fruit };
    if(fruit.onGround){
      // Ground apple: animated reach with the front arm closest to the
      // apple. The arm releases its grip (so the sloth still hangs from
      // 3 limbs), extends down to the apple, holds briefly, then snaps
      // back. _consumeEatTarget fires when the reach completes.
      const arms = this.limbs.filter(l => l.isArm);
      // Pick the arm whose shoulder is closest to the apple horizontally.
      arms.sort((a, b) => {
        const ax = this.bodyX + this._limbAttachment(a).x;
        const bx = this.bodyX + this._limbAttachment(b).x;
        return Math.abs(ax - fruit.x) - Math.abs(bx - fruit.x);
      });
      const arm = arms[0];
      const wasGripped = arm.gripped;
      arm.gripped = false;     // free the arm so it can swing down
      this.groundGrab = {
        fruit,
        arm,
        t0: this.stateT,
        // Phases: 0..reachT  = arm extends down to apple
        //         reachT..endReachHold = paw holds on apple
        //         endReachHold..end    = arm returns to attachment, then we consume
        reachT: 0.45,
        holdT:  0.20,
        retractT: 0.30,
        wasGripped,
      };
      this.eatProgress = 0;
      this.state = 'EATING';
      this.stateT = 0;
      return true;
    }
    // Tree apple: swing toward its branch
    this.startReach(fruit.branch, fruit.t);
    return true;
  }

  _consumeEatTarget(){
    if(!this.eatTarget) return;
    if(this.eatTarget.kind === 'leaf'){
      hunger = Math.min(1, hunger + HUNGER_LEAF_GAIN);
      Audio.playEatLeaf();
      const lb = this.eatTarget.branch;
      // Remove the actual leaf from the branch's seed array so the
      // foliage visibly thins out. If we know which leaf, splice it;
      // otherwise drop the first entry as a fallback.
      let popupX = this.bodyX, popupY = this.bodyY - 30;
      if(lb && lb.leafSeed && lb.leafSeed.length){
        let idx = this.eatTarget.leafIdx;
        if(typeof idx !== 'number' || idx < 0 || idx >= lb.leafSeed.length){
          idx = 0;
        }
        const l = lb.leafSeed[idx];
        popupX = lb.ex + l.ox;
        popupY = lb.ey + l.oy;
        lb.leafSeed.splice(idx, 1);
        if(typeof lb.permanentLost === 'number') lb.permanentLost++;
      } else if(lb){
        popupX = lb.ex; popupY = lb.ey - 8;
      }
      spawnScorePopup(popupX, popupY, 1, '#9CE85B');
    } else if(this.eatTarget.kind === 'apple'){
      const f = this.eatTarget.fruit;
      if(f && f.alive !== false){
        // Convert the apple itself into a popup: mark it consumed and
        // spawn the floating "+25" at its current world position.
        spawnScorePopup(f.x, f.y, 10, '#FFD230');
        f.alive = false;
        hunger = Math.min(1, hunger + HUNGER_APPLE_GAIN);
        Audio.playEatApple();
      }
    }
    this.eatTarget = null;
  }


  // WINDUP: body swings back-and-forth toward the target to build momentum.
  // Limbs are still gripping during this phase.
  _windup(dt){
    if(!this.reachTarget){ this.state='HANGING'; return; }
    // Longer wind-up = more visible pre-swing. Two oscillations:
    //   * a slow back-and-forth (pumping the body like a swing)
    //   * a steady drift toward the target
    const windupDur = 1.3;
    if(this.stateT < windupDur){
      const dx = this.reachTarget.x - this.bodyX;
      const dy = this.reachTarget.y - this.bodyY;
      // Pump force — alternates direction, gradually biased toward target
      const pump = Math.sin(this.stateT * 5.2);
      const bias = clamp(this.stateT / windupDur, 0, 1);
      this.bodyVx += (Math.sign(dx) * 60 + pump * 110) * dt;
      // Slight upward bias for branches above
      if(dy < -10) this.bodyVy -= 35 * dt;
    } else {
      this._beginActiveReach();
    }
  }

  _beginActiveReach(){
    for(const limb of this.activeLimbs){
      const gp = getBranchPt(limb.branch, limb.t);
      limb.reachStart = { x: gp.x, y: gp.y };
      limb.reachProgress = 0;
      limb.gripped = false;
      limb.state = 'REACHING';
    }
    this.state = 'REACHING';
    this.stateT = 0;
  }

  _reach(dt){
    if(!this.reachTarget){ this._beginFall(); return; }
    const reachDur = P.reachTime * 0.7;
    for(const limb of this.activeLimbs) limb.reachProgress = Math.min(1, limb.reachProgress + dt / reachDur);

    // All reaching limbs done?
    if(this.activeLimbs.every(l => l.reachProgress >= 1)){
      const target = this.reachTarget;
      const tp = getBranchPt(target.branch, target.t);
      let allInRange = true;
      for(const limb of this.activeLimbs){
        const att = this._limbAttachment(limb);
        const dist = Math.hypot(this.bodyX + att.x - tp.x, this.bodyY + att.y - tp.y);
        if(dist > this._limbMaxReach(limb) * P.armReach){ allInRange = false; break; }
      }
      if(allInRange){
        for(const limb of this.activeLimbs){
          limb.branch = target.branch;
          limb.t = clamp(target.t + limb.side * 0.04, 0.05, 0.95);
          limb.gripped = true;
          limb.state = 'GRIPPED';
          limb.reachProgress = 0;
        }
        this._impactNewBranch(target.branch);
        this._beginTransition();
      } else {
        this._beginFall();
      }
    }
  }

  _abortReach(){
    for(const limb of this.activeLimbs){
      limb.gripped = true;
      limb.state = 'GRIPPED';
      limb.reachProgress = 0;
    }
    this.state = 'HANGING';
    this.activeLimbs = [];
    this.reachTarget = null;
    this.eatTarget = null;
    this.isHeld = false;
  }

  _impactNewBranch(branch){
    // If we were swinging here to eat — consume the food now.
    if(this.eatTarget){
      this._consumeEatTarget();
    }
    // Knock fruits off, kick the branch
    const swingMag = Math.hypot(this.bodyVx, this.bodyVy);
    const impactMag = 0.6 + swingMag * 0.008;
    const impactSign = Math.sign(branch.relAngle) || 1;
    branch.spring.v += impactMag * impactSign * 0.9;
    if(typeof fruits !== 'undefined'){
      for(const f of fruits){
        if(f.fallen) continue;
        const sameBranch = f.branch === branch;
        const knockP = sameBranch
          ? Math.min(0.92, 0.55 + impactMag * 0.25)
          : Math.min(0.25, impactMag * 0.07);
        if(Math.random() < knockP) f.detach(impactMag * 0.5);
      }
    }
    Audio.playGrab();
  }

  _beginTransition(){
    this.state = 'TRANSITION';
    this.stateT = 0;
    // The OTHER 2 limbs now move to the new branch
    const remaining = this.limbs.filter(l => !this.activeLimbs.includes(l));
    for(const limb of remaining){
      const gp = getBranchPt(limb.branch, limb.t);
      limb.reachStart = { x: gp.x, y: gp.y };
      limb.reachProgress = 0;
      limb.gripped = false;
      limb.state = 'REACHING';
    }
    this.activeLimbs = remaining;
  }

  _transition(dt){
    if(!this.reachTarget){ this._beginFall(); return; }
    const transDur = P.reachTime * 0.55;
    for(const limb of this.activeLimbs) limb.reachProgress = Math.min(1, limb.reachProgress + dt / transDur);
    if(this.activeLimbs.every(l => l.reachProgress >= 1)){
      const target = this.reachTarget;
      const tp = getBranchPt(target.branch, target.t);
      let allInRange = true;
      for(const limb of this.activeLimbs){
        const att = this._limbAttachment(limb);
        const dist = Math.hypot(this.bodyX + att.x - tp.x, this.bodyY + att.y - tp.y);
        if(dist > this._limbMaxReach(limb) * P.armReach){ allInRange = false; break; }
      }
      if(allInRange){
        for(const limb of this.activeLimbs){
          limb.branch = target.branch;
          limb.t = clamp(target.t + limb.side * 0.04, 0.05, 0.95);
          limb.gripped = true;
          limb.state = 'GRIPPED';
          limb.reachProgress = 0;
        }
      } else {
        // Fall back to original — don't fall, just stay
        for(const limb of this.activeLimbs){
          limb.gripped = true;
          limb.state = 'GRIPPED';
          limb.reachProgress = 0;
        }
      }
      this.state = 'HANGING';
      this.activeLimbs = [];
      this.reachTarget = null;
    }
  }

  // ─────────────────────────────────────────────────────
  //  STARVATION — hunger hit zero. Sloth weakens, lets go,
  //  falls limp; on hitting the ground it lies still and a
  //  fresh sloth respawns after a short pause.
  // ─────────────────────────────────────────────────────
  startStarve(){
    if(this.state === 'STARVING' || this.state === 'FALLING') return;
    Audio.playStarve();
    Audio.setSnoreLevel(0);
    this.state = 'STARVING';
    this.stateT = 0;
    this.starveLetGo = false;
    this.starveDeadOnGround = false;
    this.eatTarget = null;
    this.activeLimbs = [];
    this.reachTarget = null;
  }
  _starve(dt){
    this.stateT += dt;
    // Phase 1: weak — eyes droop, body sags. After 0.9s let go entirely.
    if(!this.starveLetGo && this.stateT > 0.9){
      this.starveLetGo = true;
      for(const l of this.limbs){ l.gripped = false; l.state = 'FREE'; }
      this.fx = this.bodyX; this.fy = this.bodyY;
      this.fvx = this.bodyVx * 0.3;
      this.fvy = 0;
      this.frot = 0;
      this.frotv = (Math.random() - 0.5) * 1.5;
    }
    if(this.starveLetGo && !this.starveDeadOnGround){
      // Limp fall — no flailing, no grab attempts
      this.fvy += 480 * dt;
      this.fvx *= 0.992;
      this.fx += this.fvx * dt;
      this.fy += this.fvy * dt;
      this.frot += this.frotv * dt;
      const groundY = trunkBY + 8;
      if(this.fy >= groundY){
        this.fy = groundY;
        this.fvx = this.fvy = 0;
        this.frotv = 0;
        this.frot = PI / 2 * (this.frot >= 0 ? 1 : -1) * 0.6;  // belly-up-ish
        this.starveDeadOnGround = true;
        this.deadAt = performance.now() / 1000;
      }
    }
    if(this.starveDeadOnGround){
      // Wait, then either respawn (lives left) or trigger game-over.
      const elapsed = performance.now() / 1000 - this.deadAt;
      if(elapsed > 2.5) this._die();
    }
  }

  // ─────────────────────────────────────────────────────
  //  FALL & RECOVERY
  // ─────────────────────────────────────────────────────
  // LIGHTNING STRIKE — char the sloth and drop it limp from the tree.
  //   Sets a "charred" flag that the renderer picks up to draw the
  //   sloth in pure black, then triggers a fall (which costs a life
  //   on landing or off-screen, just like any other fall).
  // ─────────────────────────────────────────────────────
  charByLightning(){
    if(!this.alive || this.charred) return;
    this.charred = true;
    this.charredAt = performance.now() / 1000;
    // Drop limp — release all limbs and start falling
    for(const l of this.limbs){ l.gripped = false; l.state = 'FREE'; }
    this.state = 'FALLING';
    this.stateT = 0;
    this.eatTarget = null;
    this.deadOnGround = false;
    this.fx = this.bodyX; this.fy = this.bodyY;
    this.fvx = this.bodyVx * 0.2;
    this.fvy = -20;                 // tiny upward kick from the strike
    this.frot = 0;
    this.frotv = (Math.random() - 0.5) * 2.0;
    this.activeLimbs = [];
    this.reachTarget = null;
  }

  // ─────────────────────────────────────────────────────
  // Convenience: end the game (win or loss). Awards the lives bonus
  // and freezes the simulation until restart.
  // ─────────────────────────────────────────────────────
  // Centralized "the sloth died" handler. Called from any terminal
  // state (off-screen fall, hard ground impact, starvation). Decrements
  // lives, triggers game-over at 0, otherwise respawns a new sloth.
  _die(){
    if(!this.alive) return;
    this.alive = false;
    lives -= 1;
    if(lives <= 0){
      _endGame(false);
    } else {
      hunger = 0.80;
      displayedHunger = 0.80;
      spawnSloth();
    }
  }

  _beginFall(){
    for(const l of this.limbs){ l.gripped = false; l.state = 'FREE'; }
    this.state = 'FALLING';
    this.stateT = 0;
    this.eatTarget = null;
    this.deadOnGround = false;
    this.fx = this.bodyX; this.fy = this.bodyY;
    this.fvx = this.bodyVx + (Math.random() - 0.5) * 30;
    this.fvy = this.bodyVy - 10;
    this.frot = 0;
    this.frotv = (Math.random() - 0.5) * 5;
    this.activeLimbs = [];
    this.reachTarget = null;
  }
  _fall(dt){
    this.fvy += 520 * P.fallGravity * dt;
    this.fvx *= Math.pow(0.996, dt * 60);
    this.fx  += this.fvx * dt;
    this.fy  += this.fvy * dt;
    this.frot+= this.frotv * dt;
    this.frotv*= Math.pow(0.93, dt * 60);
    if(this.fvy > 60){
      for(const b of allBranches()){
        if(b.depth < 1) continue;
        for(let t = 0.1; t <= 1; t += 0.12){
          const p = getBranchPt(b, t);
          if(Math.hypot(this.fx - p.x, this.fy - p.y) < 50 && Math.random() < P.grabChance){
            // Grab! All 4 limbs grip the new branch
            this.bodyX = this.fx;
            this.bodyY = this.fy;
            this.bodyVx = this.fvx * 0.4;
            this.bodyVy = 0;
            this.frot = 0; this.frotv = 0;
            for(const limb of this.limbs){
              limb.branch = b;
              limb.t = clamp(t + limb.side * 0.04 + (limb.isArm ? -0.02 : 0.02), 0.05, 0.95);
              limb.gripped = true;
              limb.state = 'GRIPPED';
              limb.reachProgress = 0;
            }
            this.state = 'HANGING';
            this._impactNewBranch(b);
            return;
          }
        }
      }
    }
    // Hit the ground? Land sprawled and start the death timer.
    const groundY = trunkBY + 8;
    if(!this.deadOnGround && this.fy >= groundY){
      this.fy = groundY;
      this.fvx = this.fvy = 0;
      this.frotv = 0;
      this.frot = PI / 2 * (this.frot >= 0 ? 1 : -1) * 0.6;  // belly-up-ish
      this.deadOnGround = true;
      this.deadAt = performance.now() / 1000;
    }
    if(this.deadOnGround){
      const elapsed = performance.now() / 1000 - this.deadAt;
      if(elapsed > 1.6) this._die();
      return;
    }
    // Or — fall off the bottom of the canvas (still possible if branches
    // hung over the edge somehow): die immediately.
    if(this.fy > H + 140) this._die();
  }

  // ─────────────────────────────────────────────────────
  //  SLEEP & WAKE (preserved from previous version)
  // ─────────────────────────────────────────────────────
_eat(dt){
    if(this.groundGrab){
      // Ground-grab animation: extend, hold, retract, consume.
      const g = this.groundGrab;
      const total = g.reachT + g.holdT + g.retractT;
      if(this.stateT >= total){
        // Restore the arm grip state and consume.
        if(g.wasGripped) g.arm.gripped = true;
        this._consumeEatTarget();
        this.groundGrab = null;
        this.eatProgress = 0;
        this.state = 'HANGING';
      }
      // Otherwise: _drawLimb does the per-frame interpolation using
      // groundGrab.t0 + this.stateT to derive arm hand position.
      return;
    }
    // Regular tree-apple / leaf chew (post-reach).
    this.eatProgress += dt / 1.4;   // ~1.4s chew
    if(this.eatProgress >= 1){
      this._consumeEatTarget();
      this.eatProgress = 0;
      this.state = 'HANGING';
    }
  }
  _sleep(dt){
    this.blink = 1;
    this.breathPhase += dt * 1.2;
    this.snoreCycleT += dt;
    let vol = 0;
    if(this.snoreCycleT >= 3){
      const tc = (this.snoreCycleT - 3) % 8;
      if(tc < 0.25)   vol = tc / 0.25;
      else if(tc < 5) vol = 1 - (tc - 0.25) / 4.75;
    }
    this.lastSnoreVol = vol;
    Audio.setSnoreLevel(vol);
  }
  wake(){
    if(this.state === 'SLEEPING'){
      this.state = 'HANGING';
      this.blink = 0;
      this.blinkCd = 1.5;
      this.snoreCycleT = 0;
      this.lastSnoreVol = 0;
      Audio.setSnoreLevel(0);
      return true;
    }
    return false;
  }

  // ─────────────────────────────────────────────────────
  //  RENDERING
  // ─────────────────────────────────────────────────────
  draw(){
    if(!this.alive) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    // Track region for charring overlay
    const charStart = this.charred;

    if(this.state === 'FALLING' || (this.state === 'STARVING' && this.starveLetGo)){
      ctx.save();
      ctx.translate(this.fx, this.fy);
      ctx.rotate(this.frot);
      this._drawLimbsFlailing();
      this._drawBody(0, 0);
      ctx.restore();
    } else {
      // Use the smoothed display position, NOT the physics bodyX/Y,
      // so branch-to-branch snaps ease in. Limbs share the same origin
      // and their hand IK solves toward the (still-physical) grip points,
      // which gives a natural-looking elastic catch-up during the lag.
      const drawX = this.displayX;
      let drawY = this.displayY;
      if(this.state === 'SLEEPING') drawY += Math.sin(this.breathPhase) * 1.4;
      // Back limbs first (behind body), then body, then front limbs (in front)
      // (reach overlay drawn separately AFTER pixel mode for crispness)
      for(const l of this.limbs) if(!l.isArm) this._drawLimb(l, drawX, drawY);
      this._drawBody(drawX, drawY);
      for(const l of this.limbs) if(l.isArm)  this._drawLimb(l, drawX, drawY);
      if(this.state === 'SLEEPING') this._drawSleepZs(drawX, drawY);
    }
    // Charred overlay — paint everything we just drew (within this save/restore
    // alpha layer) as solid black using source-atop. Sparkly hot edges fade.
    if(charStart){
      const sinceChar = performance.now()/1000 - this.charredAt;
      const sparkA = Math.max(0, 1 - sinceChar / 0.6);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = '#0a0806';
      ctx.fillRect(-2000, -2000, 4000, 4000);
      // Crackling orange highlights on the body for the first 0.6s
      if(sparkA > 0){
        const cx = (this.state === 'FALLING') ? this.fx : this.bodyX;
        const cy = (this.state === 'FALLING') ? this.fy : this.bodyY;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `rgba(255, 140, 30, ${sparkA * 0.85})`;
        for(let i = 0; i < 5; i++){
          const a = Math.random() * Math.PI * 2;
          const r = 6 + Math.random() * 14;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a)*r, cy + Math.sin(a)*r, 1.5 + Math.random()*1.5, 0, Math.PI*2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  // Public: draw the reach marker. Called from main loop AFTER pixel
  // post-process so the dashed line + circle stay crisp.
  drawReachOverlay(){
    if(!this.reachTarget) return;
    if(this.state !== 'REACHING' && this.state !== 'WINDUP') return;
    if(!this.activeLimbs || this.activeLimbs.length === 0) return;
    this._drawReachFX();
  }

  _drawReachFX(){
    const tp   = getBranchPt(this.reachTarget.branch, this.reachTarget.t);
    const dist = Math.hypot(tp.x - this.bodyX, tp.y - this.bodyY);
    const maxR = this._limbMaxReach(this.activeLimbs[0]) * P.armReach + this.BW;
    const ok   = dist <= maxR;
    const pulse = 0.5 + 0.5 * sin(this.idleT * 7);
    const colBase = ok ? '80,220,80'  : '220,120,55';
    // Dashed line from body shoulder to target
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(this.bodyX, this.bodyY - this.BH * 0.5);
    ctx.lineTo(tp.x, tp.y);
    ctx.strokeStyle = `rgba(${colBase},0.55)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    // Outer pulsing ring
    ctx.beginPath(); ctx.arc(tp.x, tp.y, 7 + pulse * 6, 0, PI*2);
    ctx.strokeStyle = `rgba(${colBase},${0.5 + pulse*0.4})`;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    // Inner solid dot for clarity
    ctx.beginPath(); ctx.arc(tp.x, tp.y, 2.5, 0, PI*2);
    ctx.fillStyle = `rgba(${colBase},0.9)`;
    ctx.fill();
  }

  _drawLimb(limb, bx, by){
    const att = this._limbAttachment(limb);
    const sx = bx + att.x;
    const sy = by + att.y;
    let tx, ty;
    // Ground-grab: the chosen arm extends to the apple, holds, then retracts.
    if(this.groundGrab && this.groundGrab.arm === limb){
      const g = this.groundGrab;
      const t = this.stateT;
      const f = g.fruit;
      // Rest position (the natural "free hang" the arm would otherwise sit at)
      const restX = sx + limb.side * (8 + Math.sin(this.idleT * 1.4 + limb.side) * 4);
      const restY = sy + 24;
      const apX = f.x;
      const apY = f.y - 4;          // slightly above apple center so the paw rests on top
      const easeOut = u => 1 - Math.pow(1 - u, 3);
      const easeIn  = u => u * u * u;
      if(t < g.reachT){
        const u = easeOut(t / g.reachT);
        tx = lerp(restX, apX, u);
        ty = lerp(restY, apY, u);
      } else if(t < g.reachT + g.holdT){
        tx = apX; ty = apY;
      } else {
        const u = easeIn(Math.min(1, (t - g.reachT - g.holdT) / g.retractT));
        tx = lerp(apX, restX, u);
        ty = lerp(apY, restY, u);
      }
    } else if(limb.gripped){
      const gp = getBranchPt(limb.branch, limb.t);
      tx = gp.x; ty = gp.y;
    } else if(limb.state === 'REACHING' && this.reachTarget){
      const tp = getBranchPt(this.reachTarget.branch, this.reachTarget.t);
      const e = limb.reachProgress;
      const ease = e * e * (3 - 2 * e);
      tx = lerp(limb.reachStart.x, tp.x, ease);
      ty = lerp(limb.reachStart.y, tp.y, ease);
    } else {
      // Free hanging
      tx = sx + limb.side * (8 + Math.sin(this.idleT * 1.4 + limb.side) * 4);
      ty = sy + (limb.isArm ? 24 : 28);
    }
    const upper = limb.isArm ? this.ARM_UP : this.LEG_UP;
    const lower = limb.isArm ? this.ARM_LOW : this.LEG_LOW;
    const reachMul = (limb.state === 'REACHING') ? P.armReach : 1.0;
    const ik = solve2IK(sx, sy, tx, ty, upper * reachMul, lower * reachMul, limb.side);
    const w = limb.isArm ? 4.5 : 5.0;
    const col = limb.isArm ? '#735A38' : '#7A6342';
    this._seg(sx, sy, ik.e, ik.h, w, col);
    if(limb.gripped){
      const tan = getBranchTangent(limb.branch, limb.t);
      this._drawHookedPaw(ik.h.x, ik.h.y, tan, limb.isArm);
    } else if(limb.state === 'REACHING' && limb.reachProgress > 0.6 && this.reachTarget){
      // Reaching paw: draw the hooked-paw shape preview on the target branch
      const tan = getBranchTangent(this.reachTarget.branch, this.reachTarget.t);
      this._drawHookedPaw(ik.h.x, ik.h.y, tan, limb.isArm);
    }
  }

  _drawLimbsFlailing(){
    const t = this.idleT, fl = 32;
    for(const limb of this.limbs){
      const att = this._limbAttachment(limb);
      const sx = att.x, sy = att.y;
      const tx = sx + limb.side * fl + Math.sin(t * 3 + limb.side) * 22;
      const ty = sy + 28 + Math.cos(t * 2.5 + limb.side * 1.3) * 22;
      const upper = limb.isArm ? this.ARM_UP : this.LEG_UP;
      const lower = limb.isArm ? this.ARM_LOW : this.LEG_LOW;
      const ik = solve2IK(sx, sy, tx, ty, upper, lower, limb.side);
      const w = limb.isArm ? 4.5 : 5.0;
      const col = limb.isArm ? '#735A38' : '#7A6342';
      this._seg(sx, sy, ik.e, ik.h, w, col);
    }
  }

  _seg(x1, y1, e, h, w, col){
    ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(e.x, e.y, h.x, h.y);
    ctx.stroke();
  }

  // Old generic claws (used for flailing while falling)
  _claws(x, y){
    ctx.strokeStyle = '#3A2010'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    for(let s = -1; s <= 1; s += 2){
      for(let i = -1; i <= 1; i++){
        const a = (s > 0 ? -PI/3 : -PI*2/3) + i * 0.32;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(
          x + cos(a) * 4,                y + sin(a) * 4,
          x + cos(a + s * 0.25) * 8,     y + sin(a + s * 0.25) * 9
        );
        ctx.stroke();
      }
    }
  }

  // Hooked paw — used when a limb is gripping a branch.
  // Draws a small rounded knuckle on TOP of the branch with three curved
  // claws hooking down OVER it. The whole drawing is rotated to align
  // with the branch's tangent so paws sit naturally on angled branches.
  _drawHookedPaw(x, y, branchAngle, isArm){
    ctx.save();
    ctx.translate(x, y);
    // Rotate so +y is "above the branch", -y is below
    ctx.rotate(branchAngle - PI/2);

    // Knuckle/paw — small darker oval ON TOP of the branch
    ctx.fillStyle = isArm ? '#6B5230' : '#735A38';
    ctx.beginPath();
    ctx.ellipse(0, -3.2, 5.5, 3.0, 0, 0, PI*2);
    ctx.fill();
    // Tiny highlight on the knuckle
    ctx.fillStyle = 'rgba(195,158,108,0.55)';
    ctx.beginPath();
    ctx.ellipse(-1.2, -4.0, 2.6, 1.0, 0, 0, PI*2);
    ctx.fill();

    // Three curved claws curling DOWN over the front of the branch.
    // Cream/pale colour matches reference cartoons.
    ctx.strokeStyle = '#F0E0C0';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    for(let i = -1; i <= 1; i++){
      const cx = i * 2.3;
      ctx.beginPath();
      ctx.moveTo(cx, -3.2);
      // Curl down past the top of the branch
      ctx.quadraticCurveTo(cx + 0.4, -0.5, cx + 0.7, 3.5);
      ctx.stroke();
    }
    // Subtle dark outline below the claws (claw tips against the branch)
    ctx.strokeStyle = 'rgba(60,40,20,0.5)';
    ctx.lineWidth = 0.8;
    for(let i = -1; i <= 1; i++){
      const cx = i * 2.3;
      ctx.beginPath();
      ctx.moveTo(cx + 0.5, 1.5);
      ctx.lineTo(cx + 0.7, 3.5);
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawSleepZs(bx, by){
    const t = performance.now() * 0.001;
    // Visual pulse follows the audio:
    //   1) base size scales with the cyclic snore volume
    //   2) a fast breath-flutter LFO adds a smaller wobble on top
    const breathOsc = (Math.sin(t * 2 * PI * 0.32) + 1) * 0.5;  // 0..1
    const audioVol  = this.lastSnoreVol;                         // 0..1
    const sizeBoost = 1.0 + audioVol * (0.55 + breathOsc * 0.55);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for(let i = 0; i < 3; i++){
      const phase = ((t * 0.45) + i * 0.55) % 2;
      if(phase > 1.7) continue;
      let alpha = 1;
      if(phase < 0.18)      alpha = phase / 0.18;
      else if(phase > 1.4)  alpha = (1.7 - phase) / 0.30;
      const x = bx + 14 + Math.sin(phase * PI * 1.2) * 7;
      const y = by - 14 - phase * 32;
      // Slightly smaller base size 14-22, still swells with snore audio
      const size = (14 + phase * 8) * sizeBoost;
      ctx.font = `bold italic ${size}px "Helvetica Neue", "Arial", sans-serif`;
      ctx.fillStyle = `rgba(255, 250, 220, ${alpha * 0.92})`;
      ctx.strokeStyle = `rgba(40, 30, 18, ${alpha * 0.7})`;
      ctx.lineWidth = 2.4;
      ctx.strokeText('Z', x, y);
      ctx.fillText('Z', x, y);
    }
  }

  _drawBody(bx,by){
    const {BW,BH,HR}=this;

    // Hunger-driven belly scale comes from the global `bellyScale`,
    // which smooths toward _bellyTarget() over ~1 in-game day. See the
    // tick logic in frame() near the idle timer.
    const BWs = BW * bellyScale;

    // ── BODY with 3D radial shading (light from upper-right) ──
    ctx.beginPath(); ctx.ellipse(bx,by,BWs,BH,0,0,PI*2);
    ctx.fillStyle='#8B6C42'; ctx.fill();
    const bodyGrad = ctx.createRadialGradient(bx+BWs*0.30, by-BH*0.30, BWs*0.10, bx, by, BWs*1.15);
    bodyGrad.addColorStop(0,    'rgba(195,158,108,0.75)');
    bodyGrad.addColorStop(0.30, 'rgba(140,108,68,0)');
    bodyGrad.addColorStop(0.85, 'rgba(50,32,16,0)');
    bodyGrad.addColorStop(1,    'rgba(30,18,8,0.65)');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath(); ctx.ellipse(bx,by,BWs,BH,0,0,PI*2); ctx.fill();
    // Belly cream (with its own subtle gradient) — tracks the scaled body width
    const bellyGrad = ctx.createRadialGradient(bx, by+3, 1, bx, by+3, BWs*0.7);
    bellyGrad.addColorStop(0, '#E5C290');
    bellyGrad.addColorStop(1, '#C9A16E');
    ctx.fillStyle = bellyGrad;
    ctx.beginPath(); ctx.ellipse(bx,by+3,BWs*.62,BH*.55,0,0,PI*2); ctx.fill();

    // ── HEAD: warm chestnut brown, big rounded silhouette ──
    const hy = by + BH - 2;
    ctx.beginPath(); ctx.ellipse(bx, hy, HR*1.08, HR*.98, 0, 0, PI*2);
    ctx.fillStyle='#7A4A28'; ctx.fill();
    // 3D shading
    const headGrad = ctx.createRadialGradient(bx+HR*0.30, hy-HR*0.30, HR*0.10, bx, hy, HR*1.15);
    headGrad.addColorStop(0,    'rgba(205,150,95,0.75)');
    headGrad.addColorStop(0.40, 'rgba(140,90,50,0)');
    headGrad.addColorStop(1,    'rgba(28,14,6,0.70)');
    ctx.fillStyle = headGrad;
    ctx.beginPath(); ctx.ellipse(bx, hy, HR*1.08, HR*.98, 0, 0, PI*2); ctx.fill();

    // ── EARS (small, tucked into head) ──
    const earY = hy - HR*0.50;
    ctx.fillStyle='#5A3618';
    ctx.beginPath(); ctx.ellipse(bx-HR*0.82, earY, HR*0.26, HR*0.30, -0.20, 0, PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(bx+HR*0.82, earY, HR*0.26, HR*0.30,  0.20, 0, PI*2); ctx.fill();

    // ── CREAM FACE MASK — large, warm, slightly heart-shaped ──
    // Forms the bright lower-face panel that the eyes and nose sit on.
    ctx.beginPath();
    ctx.ellipse(bx, hy+2, HR*0.92, HR*0.86, 0, 0, PI*2);
    ctx.fillStyle='#EDC990'; ctx.fill();
    // Warm rim shading
    const maskGrad = ctx.createRadialGradient(bx, hy-1, HR*0.20, bx, hy+2, HR*0.95);
    maskGrad.addColorStop(0,   'rgba(252,228,188,0.55)');
    maskGrad.addColorStop(0.7, 'rgba(237,201,144,0)');
    maskGrad.addColorStop(1,   'rgba(150,95,55,0.55)');
    ctx.fillStyle = maskGrad;
    ctx.beginPath(); ctx.ellipse(bx, hy+2, HR*0.92, HR*0.86, 0, 0, PI*2); ctx.fill();

    // ── ICONIC SLOTH EYE STRIPES ──
    // Each eye sits inside a comma/teardrop-shaped dark patch: a round
    // mask around the eye plus a tail that sweeps DOWN AND OUTWARD past
    // the cheek toward the jawline. This is the signature sloth marking
    // (the dark "racing stripes") visible in the reference image.
    const eyeOffX = 4.7;
    const eyeOffY = -0.4;
    ctx.fillStyle = '#2A1408';
    // LEFT eye round mask
    ctx.beginPath();
    ctx.ellipse(bx-eyeOffX, hy+eyeOffY, 4.4, 3.6, -0.10, 0, PI*2);
    ctx.fill();
    // LEFT stripe tail — angled long ellipse going down-outward
    ctx.beginPath();
    ctx.ellipse(bx-eyeOffX-2.6, hy+eyeOffY+3.6, 2.0, 4.6, -0.55, 0, PI*2);
    ctx.fill();
    // RIGHT eye round mask
    ctx.beginPath();
    ctx.ellipse(bx+eyeOffX, hy+eyeOffY, 4.4, 3.6, 0.10, 0, PI*2);
    ctx.fill();
    // RIGHT stripe tail — mirror
    ctx.beginPath();
    ctx.ellipse(bx+eyeOffX+2.6, hy+eyeOffY+3.6, 2.0, 4.6, 0.55, 0, PI*2);
    ctx.fill();
    // Soft fade where stripes meet the cheek fur (blends into head outline)
    ctx.fillStyle = 'rgba(42,20,8,0.40)';
    ctx.beginPath();
    ctx.ellipse(bx-eyeOffX-3.0, hy+eyeOffY+5.5, 2.6, 3.0, -0.55, 0, PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(bx+eyeOffX+3.0, hy+eyeOffY+5.5, 2.6, 3.0, 0.55, 0, PI*2);
    ctx.fill();

    // ── EYES (big, almost-black, glossy with strong white catchlight) ──
    const eyeH = Math.max(0.08, 1 - this.blink*1.9);
    // Inner round eye — almost-black with a hint of warm brown
    ctx.fillStyle = '#1B0E06';
    ctx.beginPath();
    ctx.ellipse(bx-eyeOffX, hy+eyeOffY+0.2, 2.6, 2.6*eyeH, 0, 0, PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(bx+eyeOffX, hy+eyeOffY+0.2, 2.6, 2.6*eyeH, 0, 0, PI*2);
    ctx.fill();
    // Warm brown iris ring (subtle inner glow)
    if(eyeH > 0.4){
      const irisG_L = ctx.createRadialGradient(bx-eyeOffX-0.5, hy+eyeOffY-0.2, 0.3, bx-eyeOffX, hy+eyeOffY+0.2, 2.6);
      irisG_L.addColorStop(0,   'rgba(140,80,30,0.85)');
      irisG_L.addColorStop(0.55,'rgba(60,28,10,0.0)');
      ctx.fillStyle = irisG_L;
      ctx.beginPath();
      ctx.ellipse(bx-eyeOffX, hy+eyeOffY+0.2, 2.6, 2.6*eyeH, 0, 0, PI*2);
      ctx.fill();
      const irisG_R = ctx.createRadialGradient(bx+eyeOffX-0.5, hy+eyeOffY-0.2, 0.3, bx+eyeOffX, hy+eyeOffY+0.2, 2.6);
      irisG_R.addColorStop(0,   'rgba(140,80,30,0.85)');
      irisG_R.addColorStop(0.55,'rgba(60,28,10,0.0)');
      ctx.fillStyle = irisG_R;
      ctx.beginPath();
      ctx.ellipse(bx+eyeOffX, hy+eyeOffY+0.2, 2.6, 2.6*eyeH, 0, 0, PI*2);
      ctx.fill();
    }
    // Strong white catchlight (the bright spark that gives the eye life)
    if(eyeH > 0.5){
      ctx.fillStyle = 'rgba(255,255,255,0.98)';
      ctx.beginPath();
      ctx.ellipse(bx-eyeOffX-0.6, hy+eyeOffY-0.5, 1.0, 0.9, 0, 0, PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(bx+eyeOffX-0.6, hy+eyeOffY-0.5, 1.0, 0.9, 0, 0, PI*2);
      ctx.fill();
      // Tiny secondary highlight underneath (wet-eye effect)
      ctx.fillStyle = 'rgba(220,210,200,0.55)';
      ctx.beginPath();
      ctx.arc(bx-eyeOffX+0.7, hy+eyeOffY+1.1, 0.35, 0, PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bx+eyeOffX+0.7, hy+eyeOffY+1.1, 0.35, 0, PI*2);
      ctx.fill();
    }

    // ── SNOUT / MUZZLE (subtle bump under the nose) ──
    const snoutGrad = ctx.createRadialGradient(bx, hy+2.8, 0.5, bx, hy+3.5, 5);
    snoutGrad.addColorStop(0, 'rgba(252,225,180,0.85)');
    snoutGrad.addColorStop(1, 'rgba(160,110,70,0.30)');
    ctx.fillStyle = snoutGrad;
    ctx.beginPath(); ctx.ellipse(bx, hy+3.6, 4.2, 3.0, 0, 0, PI*2); ctx.fill();

    // ── NOSE — small, warm pinkish-brown button ──
    // Replaces the old large dark nose with the softer warm-toned one
    // visible in the reference.
    ctx.fillStyle = '#7A4828';
    ctx.beginPath();
    // Heart/triangle-ish: round on top, narrower at bottom
    ctx.ellipse(bx, hy+2.7, 1.8, 1.4, 0, 0, PI*2);
    ctx.fill();
    // Soft pink highlight on top-left of nose
    ctx.fillStyle = 'rgba(225,170,140,0.75)';
    ctx.beginPath();
    ctx.ellipse(bx-0.5, hy+2.3, 0.9, 0.55, 0, 0, PI*2);
    ctx.fill();
    // Tiny dark nostrils
    ctx.fillStyle = '#1A0A04';
    ctx.beginPath(); ctx.arc(bx-0.55, hy+3.0, 0.30, 0, PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(bx+0.55, hy+3.0, 0.30, 0, PI*2); ctx.fill();

    // ── GENTLE SMILE (soft curve, slight upturned corners) ──
    ctx.strokeStyle = '#1A0A04'; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx-2.8, hy+4.6);
    ctx.quadraticCurveTo(bx, hy+5.5, bx+2.8, hy+4.6);
    ctx.stroke();
    // Subtle upward curl at each corner
    ctx.beginPath();
    ctx.moveTo(bx-2.8, hy+4.6);
    ctx.quadraticCurveTo(bx-3.2, hy+4.2, bx-3.0, hy+3.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx+2.8, hy+4.6);
    ctx.quadraticCurveTo(bx+3.2, hy+4.2, bx+3.0, hy+3.9);
    ctx.stroke();
  }
}

// ════════════════════════════════════════════════════════
//  FRUIT (apple)  — hangs from terminal branches.
//  When wind exceeds the fruit's per-instance hold strength,
//  detach probability rises with the square of the overage.
//  Falling fruit follows ballistic gravity + air drag + spin.
// ════════════════════════════════════════════════════════
class Fruit{
  constructor(branch,t,dropOffsetY){
    this.branch=branch; this.t=t;
    this.dropOff=dropOffsetY;
    this.fallen=false;
    this.onGround=false;
    this.flashT=0;  // counts down from 1 → 0 to draw a white pulse
    this.lifeOnGround=0;             // seconds since landing on grass
    this.rotLifetime=22+Math.random()*8;  // total seconds before vanishing
    this.x=0; this.y=0;
    this.vx=0; this.vy=0;
    this.rot=0; this.rotV=0;
    this.r=5.5+Math.random()*2.2;
    this.holdStrength=0.40+Math.random()*0.40;
    this.alive=true;
    const v=Math.random();
    this.color = v<0.55 ? '#C8392E' : (v<0.85 ? '#D54F38' : '#A93026');
    this.swayPhase=Math.random()*PI*2;
  }
  detach(extraImpulse=0){
    this.fallen=true;
    this.vx=Wind.sample(2.5)*80+(Math.random()-0.5)*40 + extraImpulse*(Math.random()-0.5)*40;
    this.vy=-12 - extraImpulse*40;
    this.rotV=(Math.random()-0.5)*(5 + extraImpulse*4);
  }
  // Returns a 0..1 "browning" amount used by the renderer.
  // - Autumn (months 9-11): ramps from green to fully brown across Oct.
  // - Winter (months 0-2): stays fully brown, never reverts.
  // - Other times: 0 (apples are fresh).
  // Once an apple has reached full brown, it never goes back; it'll
  // fall off naturally in autumn or be force-dropped in February.
  autumnBrowning(){
    if(!seasonsMode) return 0;
    const m = (seasonTime * 12) % 12;
    if(m >= 9 && m < 12){
      // Autumn: linear ramp from 0 at start of October to 1 by mid-October.
      return Math.min(1, (m - 9) / 1.0);
    } else if(m < 3){
      // Winter (Jan-Feb-early Mar): apples are fully brown.
      return 1;
    }
    return 0;
  }
  update(dt){
    if(this.flashT > 0) this.flashT = Math.max(0, this.flashT - dt * 2.5);
    if(!this.fallen){
      const pt=getBranchPt(this.branch,this.t);
      const sway=sin(performance.now()*0.0008+this.swayPhase)*0.8;
      this.x=pt.x+sway;
      this.y=pt.y+this.dropOff;
      // Wind detach — easier than before (mult 8 vs 5)
      if(Wind.str > this.holdStrength){
        const overage=Wind.str-this.holdStrength;
        const detachP=overage*overage*8*dt;
        if(Math.random()<detachP) this.detach();
      }
      // Ambient drop — every apple has a tiny per-frame chance of letting
      // go on its own. Average lifespan on the tree is ~3 minutes.
      if(Math.random() < 0.0055 * dt) this.detach();
    } else if(!this.onGround){
      this.vy += 380*dt;
      this.vx *= 0.99;
      this.x  += this.vx*dt;
      this.y  += this.vy*dt;
      this.rot+= this.rotV*dt;
      this.rotV*=0.97;
      // Land on the ground — apples stop here so the sloth can grab them
      const groundY = trunkBY + 6 + (this.r * 0.4);
      if(this.y >= groundY){
        this.y = groundY;
        this.onGround = true;
        // Snap rotation to a stable resting angle
        this.rot = (Math.random() - 0.5) * 0.6;
        this.vx = this.vy = this.rotV = 0;
      }
    } else {
      // On the ground — rot away and fade out over time.
      this.lifeOnGround += dt;
      if(this.lifeOnGround >= this.rotLifetime){
        this.alive = false;
      }
    }
  }
  // Useful 0..1 progress: 0 = fresh, 1 = fully rotted/about to vanish.
  rotProgress(){
    if(!this.onGround) return 0;
    return clamp(this.lifeOnGround / this.rotLifetime, 0, 1);
  }
  // Alpha used while drawing — fades out over the last 5s.
  fadeAlpha(){
    if(!this.onGround) return 1;
    const remaining = this.rotLifetime - this.lifeOnGround;
    if(remaining > 5) return 1;
    return Math.max(0, remaining / 5);
  }
  draw(){
    ctx.save();
    ctx.translate(this.x,this.y);
    if(this.fallen) ctx.rotate(this.rot);
    ctx.globalAlpha = this.fadeAlpha();
    // Rot progress shifts the body color toward dark brown
    const rotK = this.rotProgress();
    const fresh = this.color;
    // Lerp the gradient toward a rotted brown look
    const rottedHi  = '#7d4a18';
    const rottedMid = '#3a2410';
    const rottedLo  = '#1a0e06';
    const lerpHex = (a, b, t) => {
      const ah = parseInt(a.slice(1),16), bh = parseInt(b.slice(1),16);
      const ar=(ah>>16)&255, ag2=(ah>>8)&255, ab=ah&255;
      const br=(bh>>16)&255, bg=(bh>>8)&255, bb=bh&255;
      const r=Math.round(ar+(br-ar)*t), g=Math.round(ag2+(bg-ag2)*t), bl=Math.round(ab+(bb-ab)*t);
      return `rgb(${r},${g},${bl})`;
    };
    const c0 = lerpHex('#ffd0a8', rottedHi,  rotK);
    const c1 = lerpHex(fresh,     rottedMid, rotK);
    const c2 = lerpHex('#5a1810', rottedLo,  rotK);

    // Body — radial gradient for fake-3D sphere
    const ag = ctx.createRadialGradient(-this.r*0.35, -this.r*0.40, this.r*0.05, 0, 0, this.r*1.1);
    ag.addColorStop(0,   c0);
    ag.addColorStop(0.20, c1);
    ag.addColorStop(0.85, c1);
    ag.addColorStop(1,   c2);
    ctx.fillStyle = ag;
    ctx.beginPath(); ctx.arc(0,0,this.r,0,PI*2); ctx.fill();
    // Top indent (where the stem meets the body)
    ctx.beginPath(); ctx.ellipse(0,-this.r*0.85,this.r*0.30,this.r*0.18,0,0,PI*2);
    ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fill();
    // Specular highlight — fades as it rots (rotted apples are matte)
    if(rotK < 0.8){
      ctx.beginPath(); ctx.ellipse(-this.r*0.36,-this.r*0.34,this.r*0.32,this.r*0.20,0.4,0,PI*2);
      ctx.fillStyle=`rgba(255,255,230,${0.75 * (1 - rotK / 0.8)})`; ctx.fill();
      ctx.beginPath(); ctx.arc(-this.r*0.42, -this.r*0.42, this.r*0.10, 0, PI*2);
      ctx.fillStyle=`rgba(255,255,255,${0.95 * (1 - rotK / 0.8)})`; ctx.fill();
    }
    // Stem
    ctx.strokeStyle='#4A2A10'; ctx.lineWidth=1.4; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(0,-this.r); ctx.lineTo(1.5,-this.r-4); ctx.stroke();
    // Leaf — wilts (turns brown) as rot progresses
    const leafR = Math.round(90 + rotK * 40);
    const leafG = Math.round(138 - rotK * 80);
    const leafB = Math.round(48 - rotK * 30);
    ctx.beginPath(); ctx.ellipse(2.8,-this.r-3,2.5,1.2,0.5,0,PI*2);
    ctx.fillStyle=`rgb(${leafR},${leafG},${leafB})`; ctx.fill();
    // Brown rot speckles appear as the apple ages
    if(rotK > 0.3){
      ctx.fillStyle = `rgba(40,20,8,${(rotK - 0.3) * 0.8})`;
      const speckles = 4;
      for(let i = 0; i < speckles; i++){
        const a = (i / speckles) * PI*2 + this.swayPhase;
        const rr = this.r * 0.55;
        ctx.beginPath();
        ctx.arc(cos(a) * rr, sin(a) * rr * 0.85, 1.3 + rotK * 1.2, 0, PI*2);
        ctx.fill();
      }
    }
    // White flash on tap
    if(this.flashT > 0){
      ctx.beginPath(); ctx.arc(0, 0, this.r + 1, 0, PI*2);
      ctx.fillStyle = `rgba(255, 255, 255, ${this.flashT * 0.85})`;
      ctx.fill();
    }
    ctx.restore();
  }
}

// ════════════════════════════════════════════════════════
//  FALLING LEAF  — emitted spontaneously while wind is high.
//  Flutters with sinusoidal lateral force, light gravity,
//  bounded terminal velocity.
// ════════════════════════════════════════════════════════
class FallingLeaf{
  constructor(x,y){
    this.x=x; this.y=y;
    this.vx=(Math.random()-0.5)*40 + Wind.sample(1.5)*30;
    this.vy=-5;
    this.rot=Math.random()*PI*2;
    this.rotV=(Math.random()-0.5)*3;
    this.size=6+Math.random()*4;
    const g=80+(Math.random()*70|0);
    const r=30+(Math.random()*30|0);
    const b=20+(Math.random()*30|0);
    this.color=`rgba(${r},${g},${b},0.9)`;
    this.flutterPhase=Math.random()*PI*2;
    this.alive=true;
  }
  update(dt){
    const t=performance.now()*0.003;
    this.vx += sin(t+this.flutterPhase)*50*dt;
    this.vx *= 0.97;
    this.vy += 80*dt;
    this.vy = Math.min(this.vy,200);
    this.x  += this.vx*dt;
    this.y  += this.vy*dt;
    this.rot+= this.rotV*dt;
    this.rotV*=0.99;
    if(this.y>H+20) this.alive=false;
  }
  draw(){
    ctx.save();
    ctx.translate(this.x,this.y);
    ctx.rotate(this.rot);
    ctx.beginPath();
    ctx.ellipse(0,0,this.size*1.3,this.size*0.7,0,0,PI*2);
    ctx.fillStyle=this.color; ctx.fill();
    ctx.restore();
  }
}

// Sloth lifecycle
let sloth=null, slothPending=true;
let fruits=[], fallingLeaves=[];

function spawnFruits(){
  fruits = [];
  if(!fruitsMode) return;
  allBranches().forEach(b=>{
    if(b.depth>=3 && Math.random()<P.appleCount){
      const t = 0.7 + Math.random()*0.3;
      const drop = 8 + Math.random()*5;
      fruits.push(new Fruit(b, t, drop));
    }
  });
}

// ── SEASON APPLES ───────────────────────────────────
// Autumn: every in-tree apple gets a 50% chance per second of falling
// once seasonTime crosses its randomly-assigned drop day. Each apple is
// stamped with a drop day at construction (between 3.5 and 5.8).
// Spring: between days 10..12, new apples grow on eligible branches up
// to the regular appleCount density.
function _updateSeasonApples(dt){
  const info = getSeasonInfo(seasonTime);
  // Autumn (Oct-Nov) — apples in the tree drop on their own once the
  // current calendar month passes their personal "drop month". 2-day window;
  // December is stably bare before winter visuals.
  if(info.day >= 9 && info.day < 11){
    for(const f of fruits){
      if(f.fallen || f.onGround || !f.alive) continue;
      if(f.autumnDropDay === undefined){
        f.autumnDropDay = 9.2 + Math.random() * 1.5;   // somewhere in Oct or early Nov
      }
      if(info.day >= f.autumnDropDay && Math.random() < 0.6 * dt){
        f.detach();
      }
    }
  }
  // February — any apple still hanging on the tree by now (a survivor
  // from autumn) finally lets go. Each apple is stamped with a personal
  // drop-day inside February so they don't all fall at the same instant.
  if(info.day >= 1 && info.day < 2){
    for(const f of fruits){
      if(f.fallen || f.onGround || !f.alive) continue;
      if(f.febDropDay === undefined){
        f.febDropDay = 1.05 + Math.random() * 0.85;   // anywhere in February
      }
      if(info.day >= f.febDropDay && Math.random() < 0.8 * dt){
        f.detach();
      }
    }
  }
  // Summer (Jul-Aug) — apples grow on the tree. This is the only season
  // new fruits appear during play (initial spawn at game start aside).
  // Growth takes 2 in-game days; September is stable ripening time.
  if(info.day >= 6 && info.day < 8 && fruitsMode){
    const targetGrowth = (info.day - 6) / 2;            // 0..1 across the 2 days
    let countAlive = 0;
    for(const f of fruits) if(f.alive !== false) countAlive++;
    const growable = [];
    for(const b of allBranches()){
      if(b.depth >= 3) growable.push(b);
    }
    const targetCount = Math.round(growable.length * P.appleCount * targetGrowth);
    if(countAlive < targetCount && Math.random() < 1.6 * dt * P.dayPace){
      const usedBranches = new Set(fruits.map(f => f.branch));
      const candidates = growable.filter(b => !usedBranches.has(b));
      if(candidates.length){
        const b = candidates[Math.floor(Math.random() * candidates.length)];
        const t = 0.7 + Math.random() * 0.3;
        const drop = 8 + Math.random() * 5;
        fruits.push(new Fruit(b, t, drop));
      }
    }
  }
}

// Helper — grow a fresh leaf seed onto a branch.
function _growOneLeafOn(b){
  const v = Math.random();
  const autR = v<0.4 ? 200 + (Math.random()*40|0)
              : v<0.75 ? 215 + (Math.random()*30|0)
              : 145 + (Math.random()*50|0);
  const autG = v<0.4 ? 165 + (Math.random()*35|0)
              : v<0.75 ? 90  + (Math.random()*40|0)
              : 80  + (Math.random()*30|0);
  const autB = v<0.4 ? 30  + (Math.random()*20|0)
              : v<0.75 ? 25  + (Math.random()*15|0)
              : 25  + (Math.random()*15|0);
  const g = 82 + (Math.random()*80|0);
  b.leafSeed.push({
    ox:(Math.random()-.5)*28, oy:(Math.random()-.5)*24-4,
    rx:6+Math.random()*7,     ry:4+Math.random()*5,
    r0:Math.random()*PI,
    r:18+(Math.random()*20|0), g, b:8+(Math.random()*14|0),
    a:.50+Math.random()*.38,
    autR, autG, autB,
  });
}

// Reset all season bookkeeping AND restore each branch's leaves back to
// its original count. Called when starting a new game.
// Called once at the start of every new in-game year. Resets the
// per-branch season flags so the tree can shed leaves again next
// autumn and grow them again next spring. Also clears any per-fruit
// autumn-drop stamp so apples that survived participate next time.
function _onNewYear(){
  for(const b of allBranches()){
    if(!b.fullLeafCount) continue;
    b.autumnShedDone = false;
    b.springGrewDone = false;
    b.autumnSnapCount = -1;
  }
  for(const f of fruits){
    if(f.autumnDropDay !== undefined) f.autumnDropDay = undefined;
    if(f.febDropDay !== undefined) f.febDropDay = undefined;
  }
}

function _resetTreeForNewGame(){
  for(const b of allBranches()){
    if(!b.fullLeafCount) continue;
    b.permanentLost = 0;
    b.autumnSnapCount = -1;
    b.autumnShedDone = false;
    // The tree starts year 1 already in full April leaf, so spring growth
    // is effectively a no-op (no slots to grow into). After autumn shed
    // and a winter, year 2's spring will refill anything that fell.
    b.springGrewDone = false;
    // Top up leafSeed back to fullLeafCount
    while(b.leafSeed.length < b.fullLeafCount) _growOneLeafOn(b);
    while(b.leafSeed.length > b.fullLeafCount) b.leafSeed.pop();
  }
}

// ── SEASON LEAF POPULATION ──────────────────────────
// Grows/sheds leaves to match the current seasonTime. Targets each
// branch's leaf count to seasonInfo.leafiness * fullLeafCount, with
// autumn shedding spawning a FallingLeaf flutter at the leaf's old
// position (so it visibly drifts away). Spring growth is silent.
let _lastSeasonLeafiness = -1;
function _updateSeasonLeaves(dt){
  const info = getSeasonInfo(seasonTime);
  const day = info.day;

  // Calendar season bands:
  //   SPRING = months 3-5 (Apr/May/Jun) — only time leaves grow.
  //   AUTUMN = months 9-11 (Oct/Nov/Dec) — only time leaves shed.
  // Summer and winter are stable: full canopy and bare respectively.
  const inSpring = (day >= 3 && day < 5);
  const inAutumn = (day >= 9 && day < 11);
  if(!inSpring && !inAutumn) return;

  for(const b of allBranches()){
    if(!b.fullLeafCount) continue;

    if(inAutumn){
      if(b.autumnShedDone) continue;
      // Snapshot leaf count when autumn first touches this branch
      if(b.autumnSnapCount < 0) b.autumnSnapCount = b.leafSeed.length;
      // Smoothly converge toward zero across 2 in-game days (Oct-Nov).
      // December is then stably bare before winter visuals kick in.
      const progress = Math.min(1, (day - 9) / 2);
      const target = Math.round(b.autumnSnapCount * (1 - progress));
      if(b.leafSeed.length > target){
        const rate = 0.8 * dt * P.dayPace;
        if(Math.random() < rate){
          const idx = Math.floor(Math.random() * b.leafSeed.length);
          const l = b.leafSeed[idx];
          const lx = b.ex + l.ox, ly = b.ey + l.oy;
          b.leafSeed.splice(idx, 1);
          const fl = new FallingLeaf(lx, ly);
          if(l.autR !== undefined && info.autumnTint > 0){
            const k = info.autumnTint;
            const rr = Math.round(l.r + (l.autR - l.r) * k);
            const gg = Math.round(l.g + (l.autG - l.g) * k);
            const bb = Math.round(l.b + (l.autB - l.b) * k);
            fl.color = `rgba(${rr},${gg},${bb},0.9)`;
          }
          fallingLeaves.push(fl);
        }
      }
      // Lock the shed at end of November.
      if(day >= 10.95 || b.leafSeed.length === 0){
        while(b.leafSeed.length > 0){
          const l = b.leafSeed.pop();
          const fl = new FallingLeaf(b.ex + l.ox, b.ey + l.oy);
          if(l.autR !== undefined){
            fl.color = `rgba(${l.autR},${l.autG},${l.autB},0.9)`;
          }
          fallingLeaves.push(fl);
        }
        b.autumnShedDone = true;
      }
    } else if(inSpring){
      if(b.springGrewDone) continue;
      // Available budget: original capacity minus permanent losses.
      const budget = Math.max(0, b.fullLeafCount - b.permanentLost);
      // Spring grow takes 2 in-game days (Apr-May). June is stable full canopy.
      const progress = Math.min(1, (day - 3) / 2);
      const target = Math.round(budget * progress);
      if(b.leafSeed.length < target){
        const rate = 0.8 * dt * P.dayPace;
        if(Math.random() < rate) _growOneLeafOn(b);
      }
      if(day >= 4.95){
        // Top up to the budget at end of May and lock.
        while(b.leafSeed.length < budget) _growOneLeafOn(b);
        b.springGrewDone = true;
      }
    }
  }
}

function spawnFallingLeavesIfWindy(dt){
  if(Wind.str < 0.55) return;
  const overage = Wind.str - 0.55;
  // Cosmetic flutter — small generic leaves blowing off the canopy
  const chance = overage*overage*7*dt;
  if(Math.random() < chance){
    const terminals = allBranches().filter(b=>b.depth>=3);
    if(!terminals.length) return;
    const b = terminals[Math.floor(Math.random()*terminals.length)];
    const pt = getBranchPt(b, 0.85+Math.random()*0.15);
    fallingLeaves.push(new FallingLeaf(pt.x, pt.y));
  }

  // Rare: a REAL leaf (one of the branch's leafSeed entries) gets torn
  // off and removed from the canopy. Only happens at heavy wind, and far
  // less often than the cosmetic flutter — about once every ~5 seconds
  // at peak. Removing real leaves shrinks the food supply, so it stings.
  if(Wind.str > 0.85){
    const heavy = Wind.str - 0.85;
    const realChance = heavy * heavy * 1.4 * dt;
    if(Math.random() < realChance){
      const leafy = allBranches().filter(b => b.leafSeed && b.leafSeed.length > 0);
      if(leafy.length){
        const b = leafy[Math.floor(Math.random() * leafy.length)];
        const idx = Math.floor(Math.random() * b.leafSeed.length);
        const l = b.leafSeed[idx];
        const lx = b.ex + l.ox;
        const ly = b.ey + l.oy;
        b.leafSeed.splice(idx, 1);
        if(typeof b.permanentLost === 'number') b.permanentLost++;
        fallingLeaves.push(new FallingLeaf(lx, ly));
      }
    }
  }
}

function spawnSloth(){
  if(!slothMode){ sloth=null; return; }
  // Aim for the canopy's center: just above the trunk top, near the trunk axis.
  const cx = trunkBX;
  const cy = trunkTY - trunkLen*0.20;
  const cands = [];
  allBranches().forEach(b=>{
    if(b.depth>=1 && b.depth<=3) cands.push(b);
  });
  if(!cands.length) return;
  // Score by midpoint distance to canopy center; pick from the top 5.
  cands.sort((a,b)=>{
    const ap = getBranchPt(a, 0.5);
    const bp = getBranchPt(b, 0.5);
    return Math.hypot(ap.x-cx, ap.y-cy) - Math.hypot(bp.x-cx, bp.y-cy);
  });
  const b = cands[Math.floor(Math.random() * Math.min(5, cands.length))];
  sloth = new Sloth(b, 0.4 + Math.random()*0.25);
}

// Pointer input
function getCanvasXY(e){
  const r=canvas.getBoundingClientRect();
  return { x:(e.clientX-r.left)*(W/r.width), y:(e.clientY-r.top)*(H/r.height) };
}
// Convert a canvas-space x to world-space x by removing the camera offset.
function canvasToWorldX(canvasX){ return canvasX - sceneOffsetX; }

// ── PAN STATE / HANDLERS ────────────────────────────
let isPanning = false;
let panStartX = 0;            // canvas-space starting x
let panStartY = 0;
let panStartOffset = 0;       // sceneOffsetX at swipe start
let panLastX = 0;
let panLastT = 0;
const PAN_DRAG_THRESHOLD = 6; // px before we commit to "panning"
let pendingTap = null;        // {x, y} stored on pointerdown; played on click

canvas.addEventListener('pointerdown', e=>{
  // Ignore canvas input while a UI overlay is up (start, name, end)
  if(gameState !== 'PLAYING') return;
  const {x: cx, y: cy} = getCanvasXY(e);
  // Pause-toggle: tap on the clock face in the top HUD. Use a generous
  // hit radius (1.8× clock radius) so it's easy to hit with a fingertip.
  if(!gameOver){
    const r = _hudBarsRect();
    const dx = cx - r.clockX, dy = cy - r.clockY;
    if(dx*dx + dy*dy <= (r.clockR * 1.8) * (r.clockR * 1.8)){
      togglePause();
      return;
    }
  }
  // Don't process other taps while paused — keep the world frozen.
  if(paused) return;
  // Any tap on the canvas counts as activity → reset idle timer
  userIdleT = 0;
  // Always remember where the touch started so we can decide whether
  // it was a drag or a tap on pointerup.
  panStartX = cx;  panStartY = cy;
  panStartOffset = sceneOffsetX;
  panLastX = cx;   panLastT = performance.now();
  // Grass area = below trunkBY. Swipes there scroll the scene.
  if(cy >= trunkBY){
    isPanning = true;
    panVelX = 0;
    pendingTap = null;
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    return;
  }
  // Above the grass: queue a possible tap on the world.
  pendingTap = { wx: canvasToWorldX(cx), wy: cy };
  isPanning = false;
});

canvas.addEventListener('pointermove', e=>{
  const {x: cx, y: cy} = getCanvasXY(e);
  const dx = cx - panStartX;
  const dy = cy - panStartY;
  // If the pointer moves far horizontally before lifting, treat it as a
  // pan even if the touch began above the grass.
  if(!isPanning && pendingTap && Math.hypot(dx, dy) > PAN_DRAG_THRESHOLD
     && Math.abs(dx) > Math.abs(dy)){
    isPanning = true;
    pendingTap = null;
  }
  if(isPanning){
    sceneOffsetX = panStartOffset + dx;
    // Clamp to range with rubber-band feel handled in the frame loop.
    const now = performance.now();
    const dt2 = Math.max(1, now - panLastT) / 1000;
    panVelX = (cx - panLastX) / dt2;
    panLastX = cx; panLastT = now;
  }
});

function _endPan(e){
  if(isPanning){
    isPanning = false;
    return;   // no tap after a drag
  }
  // Was a tap — fire the world-space target search now.
  if(!pendingTap) return;
  const tap = pendingTap;
  pendingTap = null;
  if(!sloth || !slothMode || sloth.state==='FALLING') return;
  if(sloth.wake()) return;
  if(sloth.state !== 'HANGING') return;
  // Use tap coords (world-space) as the resolution input.
  const x = tap.wx;
  const y = tap.wy;
  __runTapLogic(x, y);
}
canvas.addEventListener('pointerup',     _endPan);
canvas.addEventListener('pointercancel', e=>{ isPanning=false; pendingTap=null; });

// Original tap resolution logic, factored out so swipe vs tap can both call it.
function __runTapLogic(x, y){
  if(gameOver){
    // Overlays handle restart now — ignore canvas taps during game-over.
    return;
  }

  // Tap-redirect: if a new tap arrives while the sloth is still winding
  // up or mid-reach toward the previous target, abort the old attempt
  // and re-route to the new target. Other states (TRANSITION already
  // committed to the new branch, EATING chewing in place, SLEEPING,
  // STARVING, FALLING) are NOT interruptible — they need to finish.
  // The displayX/Y smoothing already eases the visual handover so the
  // body doesn't appear to teleport.
  if(sloth && sloth.alive &&
     (sloth.state === 'WINDUP' || sloth.state === 'REACHING')){
    sloth._abortReach();
  }

  // Food check first — but only commits if the food can actually be
  // reached. If anything blocks (no candidate, out of reach, etc.) we
  // fall through to the normal branch tap so the sloth can still swing.
  const food = nearestFood(x, y);
  // Apples are clearly defined targets — generous tap radius.
  // Leaves overlap heavily with branch tips, so tighten their radius
  // and only treat them as food when the tap is unmistakably on the
  // leaf cluster, not just near a leafy branch.
  const APPLE_TAP_RADIUS = 30;
  const LEAF_TAP_RADIUS  = 14;
  let ate = false;
  if(food && food.kind === 'apple' && food.dist < APPLE_TAP_RADIUS){
    const f = food.fruit;
    f.flashT = 1;          // flash white briefly when tapped (visual feedback)
    const armR = sloth._limbMaxReach(sloth.limbs[0]) * P.armReach + sloth.BW;
    if(f.onGround){
      // Ground apple — try a DIRECT reach first. If the apple is within
      // the sloth's arm-reach radius from its current body position, the
      // sloth can simply lean down (or sideways) and grab it without
      // moving branches. The IK + arm-length constraints already enforce
      // realism, so any visually-reachable apple should be grabbable.
      const directDist = Math.hypot(f.x - sloth.bodyX, f.y - sloth.bodyY);
      if(directDist <= armR + 20 && sloth.state === 'HANGING'){
        Audio.playTargetValid();
        // Keep the sloth on its current branch and chew in place.
        // startEatApple already handles fruit.onGround = true correctly.
        sloth.startEatApple(f);
        ate = true;
      } else {
        // Out of direct reach — fall back to the original "via low branch"
        // path: try to find a low branch within mutual reach of both
        // sloth and apple, then swing there first.
        const cands = [];
        for(const b of allBranches()){
          if(b.depth < 1) continue;
          for(let tt = 0.2; tt <= 1; tt += 0.15){
            const bp = getBranchPt(b, tt);
            const distFromSloth = Math.hypot(bp.x - sloth.bodyX, bp.y - sloth.bodyY);
            const distFromApple = Math.hypot(bp.x - f.x, bp.y - f.y);
            if(distFromSloth <= armR && distFromApple <= armR + 30){
              cands.push({b, tt, score: distFromSloth + distFromApple});
            }
          }
        }
        if(cands.length > 0){
          cands.sort((a, b) => a.score - b.score);
          Audio.playTargetValid();
          sloth.eatTarget = { kind: 'apple', fruit: f };
          sloth.startReach(cands[0].b, cands[0].tt);
          ate = true;
        }
      }
    } else {
      // Tree apple — swing to its branch.
      const tp = getBranchPt(f.branch, f.t);
      if(Math.hypot(tp.x - sloth.bodyX, tp.y - sloth.bodyY) <= armR){
        Audio.playTargetValid();
        sloth.startEatApple(f);
        ate = true;
      }
    }
  } else if(food && food.kind === 'leaf' && food.dist < LEAF_TAP_RADIUS){
    leafFlashes.set(food.branch, 1);   // flash the leaf cluster white
    const tp = getBranchPt(food.branch, food.t);
    const armR = sloth._limbMaxReach(sloth.limbs[0]) * P.armReach + sloth.BW;
    if(Math.hypot(tp.x - sloth.bodyX, tp.y - sloth.bodyY) <= armR){
      Audio.playTargetValid();
      sloth.startEatLeaf(food.branch, food.t, food.leafIdx);
      ate = true;
    }
  }
  if(ate) return;

  // No food committed — normal branch tap.
  const res = nearestBranch(x,y);
  if(!res || !res.branch){
    Audio.playTargetInvalid();
    return;
  }
  const tp = getBranchPt(res.branch, res.t);
  const maxLimbReach   = sloth._limbMaxReach(sloth.limbs[0]) * P.armReach;
  const distToBody     = Math.hypot(tp.x - sloth.bodyX, tp.y - sloth.bodyY);
  const effectiveReach = maxLimbReach + sloth.BW;
  if(distToBody > effectiveReach){
    Audio.playTargetInvalid();
    return;
  }
  Audio.playTargetValid();
  sloth.startReach(res.branch, res.t);
}


// ════════════════════════════════════════════════════════
//  PIXEL / RETRO MODE
// ════════════════════════════════════════════════════════
let offCanvas=null, offCtx=null;
const PAL=[
  // Sky blues
  [15,32,68],[38,78,138],[82,138,192],[165,210,235],[225,242,252],
  // Dark greens
  [12,28,10],[52,92,32],
  // Foliage greens
  [18,58,18],[38,100,28],[78,148,42],[128,185,58],
  // Bark browns
  [18,8,2],[48,24,8],[82,44,16],[125,72,32],
  // Sloth cream / belly
  [195,155,88],
  // Apple reds — keep apples saturated in pixel mode
  [200,55,40],[155,30,22],[225,90,65],
];
const colorCache=new Map();
function nearestPal(r,g,b){
  const key=((r>>3)<<10)|((g>>3)<<5)|(b>>3);
  let hit=colorCache.get(key);
  if(hit) return hit;
  let best=0,bestD=1e9;
  for(let i=0;i<PAL.length;i++){
    const d=(r-PAL[i][0])**2+(g-PAL[i][1])**2+(b-PAL[i][2])**2;
    if(d<bestD){bestD=d;best=i;}
  }
  colorCache.set(key,PAL[best]);
  return PAL[best];
}
function ensureOffCanvas(){
  const sw=(W/P.pixelSize)|0, sh=(H/P.pixelSize)|0;
  if(!offCanvas || offCanvas.width!==sw || offCanvas.height!==sh){
    offCanvas=document.createElement('canvas');
    offCanvas.width=sw; offCanvas.height=sh;
    offCtx=offCanvas.getContext('2d');
    colorCache.clear();
  }
}
function applyPixelMode(){
  // Pixelate via downsample/upsample only — full colour preserved.
  ensureOffCanvas();
  const sw=offCanvas.width, sh=offCanvas.height;
  offCtx.imageSmoothingEnabled=true;
  offCtx.drawImage(canvas,0,0,sw,sh);
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(offCanvas,0,0,W,H);
  ctx.imageSmoothingEnabled=true;
}

// ════════════════════════════════════════════════════════
//  DAY / NIGHT CYCLE
// ════════════════════════════════════════════════════════
let dayTime = 0.40;            // 0=midnight, 0.5=noon, 1=midnight again
const DAY_CYCLE_S = 90;        // seconds for a full day-night cycle

// ── SEASONS ─────────────────────────────────────────
// seasonTime: 0..1 cycles through the year. 0/1 = Jan 1, 0.5 = early July.
// One real day-night cycle = one in-game month (90s/month, 1080s = 18min/year).
// A "year" inside the game = 12 in-game days = the full game length.
// Season bands within those 12 days:
//   Days 0-2  : SUMMER   (lush green, full apples)
//   Days 3-5  : AUTUMN   (leaves turn warm hues, then fall; apples brown + fall)
//   Days 6-8  : WINTER   (bare, white/blue palette, snow, black branches)
//   Days 9-11 : SPRING   (warming, leaves regrow; new apples grow last 2 days)
// seasonTime is still 0..1 across the year so MONTH slider works.
let seasonTime = 3 / 12;   // start at April (mid-spring on the calendar)
const MONTH_NAMES = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const MONTH_NAMES_FULL = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE',
                          'JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
function monthFmt(v){
  // Show season instead of month when seasonsMode is on.
  return MONTH_NAMES[Math.min(11, Math.floor(v))];
}

// All season info derived from a single 0..1 cycle. Matches the 4-bands-of-3
// layout above when each "month" = one game day.
function getSeasonInfo(t){
  // Use calendar months. seasonTime ∈ [0,1] → month ∈ [0,12).
  // Calendar bands:
  //   WINTER  — Jan/Feb/Mar (m 0-2)
  //   SPRING  — Apr/May/Jun (m 3-5)
  //   SUMMER  — Jul/Aug/Sep (m 6-8)
  //   AUTUMN  — Oct/Nov/Dec (m 9-11)
  // Game starts in April (m 3) and runs 12 in-game months → ends back at April.
  // Visiting order: SPRING → SUMMER → AUTUMN → WINTER (then game ends).
  const m = (t * 12) % 12;
  let name = 'SPRING';
  if(m < 3)        name = 'WINTER';
  else if(m < 6)   name = 'SPRING';
  else if(m < 9)   name = 'SUMMER';
  else             name = 'AUTUMN';

  // leafiness: tree is full in spring/summer (we DON'T grow new leaves
  // during the game — they start full), drops in autumn, gone in winter.
  let leafiness = 1;
  if(m < 3)        leafiness = 0;                  // winter — bare
  else if(m < 6)   leafiness = 1;                  // spring — already in leaf
  else if(m < 9)   leafiness = 1;                  // summer — full canopy
  else             leafiness = 1 - (m - 9) / 3;    // autumn — leaves fall

  // autumnTint: warm hues build up across October, peak Nov, hold into Dec.
  let autumnTint = 0;
  if(m >= 9 && m < 12){
    autumnTint = Math.min(1, (m - 9) / 0.8);
  } else if(m < 3){
    autumnTint = 1;   // any stragglers stay autumn-colored in early winter
  }

  // winterness: 0 outside winter, 1 deep winter. Fades in late Dec, out late Mar.
  let winterness = 0;
  if(m >= 11.5 && m < 12) winterness = (m - 11.5) / 0.5;
  else if(m < 2.5)        winterness = 1;
  else if(m < 3)          winterness = 1 - (m - 2.5) / 0.5;

  // appleGrowth: apples present from start (we DON'T grow them on the
  // tree mid-game). They drop in autumn. Used only by the apple drop logic;
  // there's no apple-regrowth path during a game now.
  let appleGrowth = 1;
  if(m < 3)        appleGrowth = 0;                       // winter — bare
  else if(m < 6)   appleGrowth = 1;                       // spring
  else if(m < 9)   appleGrowth = 1;                       // summer
  else             appleGrowth = 1 - (m - 9) / 3;         // autumn — fall off

  // summerTint: 0 outside summer, peaks at mid-August (m≈7.5). Used as a
  // warm yellow/golden wash that suggests bright summer sunlight.
  // Smooth raised cosine curve across Jul..Sep so the change reads as a
  // gradual seasonal warming instead of a switch.
  let summerTint = 0;
  if(m >= 6 && m < 9){
    const u = (m - 6) / 3;             // 0..1 across summer
    summerTint = 0.5 - 0.5 * Math.cos(u * 2 * Math.PI);   // 0 → 1 → 0
  }

  return { day: m, name, leafiness, autumnTint, winterness, appleGrowth, summerTint };
}
let stars = [];

// Sky color keyframes — top → mid1 → mid2 → bottom (horizon).
// Times: 0=midnight, 0.5=noon. Sun rises ~0.25, sets ~0.78.
const SKY_KEYS = [
  { t: 0.00, c: [[8,6,28],     [16,14,42],   [24,22,56],   [30,28,72]] },
  { t: 0.20, c: [[14,12,40],   [28,22,58],   [44,34,78],   [55,42,90]] },
  { t: 0.25, c: [[40,30,70],   [110,60,90],  [180,100,90], [225,140,100]] },
  { t: 0.32, c: [[100,135,180],[170,180,200],[225,200,180],[250,205,170]] },
  { t: 0.45, c: [[34,82,148],  [60,128,178], [115,175,205],[170,210,228]] },
  { t: 0.55, c: [[34,82,148],  [60,128,178], [115,175,205],[170,210,228]] },
  { t: 0.68, c: [[44,98,160],  [90,150,190], [160,190,205],[210,205,205]] },
  { t: 0.76, c: [[60,40,90],   [150,75,90],  [215,115,80], [245,140,85]] },
  { t: 0.84, c: [[26,16,55],   [55,30,75],   [82,45,90],   [98,60,98]] },
  { t: 0.93, c: [[10,8,32],    [18,16,44],   [26,22,55],   [32,28,68]] },
];
function lerpRGB(c1,c2,k){
  return [Math.round(c1[0]+(c2[0]-c1[0])*k),
          Math.round(c1[1]+(c2[1]-c1[1])*k),
          Math.round(c1[2]+(c2[2]-c1[2])*k)];
}
function getSkyAtTime(t){
  let i = 0;
  for(; i < SKY_KEYS.length-1; i++) if(SKY_KEYS[i+1].t > t) break;
  const k1 = SKY_KEYS[i];
  const k2 = SKY_KEYS[(i+1) % SKY_KEYS.length];
  const nextT = k2.t > k1.t ? k2.t : 1.0;
  const k = (t - k1.t) / (nextT - k1.t);
  return [lerpRGB(k1.c[0],k2.c[0],k),
          lerpRGB(k1.c[1],k2.c[1],k),
          lerpRGB(k1.c[2],k2.c[2],k),
          lerpRGB(k1.c[3],k2.c[3],k)];
}
function getSunPos(t){
  if(t < 0.20 || t > 0.80) return { x:0, y:0, opacity:0 };
  const dayProg = (t - 0.22) / 0.56;
  const ang = clamp(dayProg, 0, 1) * PI;
  const cx = W*0.5;
  const horizonY = trunkBY*0.85;
  const arcR = trunkBY*0.72;
  let opacity = 1;
  if(t < 0.25) opacity = (t-0.20)/0.05;
  else if(t > 0.75) opacity = (0.80-t)/0.05;
  return { x: cx - Math.cos(ang)*arcR, y: horizonY - Math.sin(ang)*arcR, opacity:clamp(opacity,0,1) };
}
function getMoonPos(t){
  let nightT;
  if(t > 0.78) nightT = (t - 0.78) / 0.44;
  else if(t < 0.22) nightT = (t + 0.22) / 0.44;
  else return { x:0, y:0, opacity:0 };
  const ang = clamp(nightT, 0, 1) * PI;
  const cx = W*0.5;
  const horizonY = trunkBY*0.85;
  const arcR = trunkBY*0.72;
  let opacity = 1;
  if(nightT < 0.10) opacity = nightT/0.10;
  else if(nightT > 0.90) opacity = (1.0-nightT)/0.10;
  return { x: cx - Math.cos(ang)*arcR, y: horizonY - Math.sin(ang)*arcR, opacity:clamp(opacity,0,1) };
}
function getStarOpacity(t){
  if(t < 0.18 || t > 0.88) return 1;
  if(t < 0.26) return 1 - (t-0.18)/0.08;
  if(t > 0.80) return (t-0.80)/0.08;
  return 0;
}
function getSceneBrightness(t){
  if(t < 0.20) return 0.32;
  if(t < 0.34) return 0.32 + (t-0.20)/0.14 * 0.68;
  if(t < 0.70) return 1.0;
  if(t < 0.84) return 1.0 - (t-0.70)/0.14 * 0.68;
  return 0.32;
}
function makeStars(){
  stars = [];
  for(let i=0; i<90; i++){
    stars.push({
      x: Math.random()*W,
      y: Math.random()*trunkBY*0.78,
      r: 0.4 + Math.random()*1.4,
      twinkle: Math.random()*PI*2,
      bright:  0.55 + Math.random()*0.45,
    });
  }
}
function drawStars(opacity){
  if(opacity <= 0.01) return;
  const t = performance.now()*0.001;
  for(const s of stars){
    const tw = 0.6 + 0.4*Math.sin(t*1.6 + s.twinkle);
    ctx.fillStyle = `rgba(255,250,225,${opacity*s.bright*tw})`;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, PI*2); ctx.fill();
  }
}
function drawSunMoon(){
  const sun = getSunPos(dayTime);
  if(sun.opacity > 0){
    const sR = 32;
    // Halo
    const halo = ctx.createRadialGradient(sun.x, sun.y, sR*0.4, sun.x, sun.y, sR*5);
    halo.addColorStop(0,    `rgba(255,240,180,${0.55*sun.opacity})`);
    halo.addColorStop(0.18, `rgba(255,225,140,${0.28*sun.opacity})`);
    halo.addColorStop(0.50, `rgba(255,210,120,${0.08*sun.opacity})`);
    halo.addColorStop(1,    'rgba(255,210,120,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(-PAN_RANGE-50, 0, W + 2*PAN_RANGE + 100, trunkBY+2);
    // Disc
    const disc = ctx.createRadialGradient(sun.x-sR*0.25, sun.y-sR*0.25, 0, sun.x, sun.y, sR);
    disc.addColorStop(0,    `rgba(255,253,225,${sun.opacity})`);
    disc.addColorStop(0.55, `rgba(255,235,160,${sun.opacity})`);
    disc.addColorStop(1,    `rgba(255,200,100,${0.85*sun.opacity})`);
    ctx.fillStyle = disc;
    ctx.beginPath(); ctx.arc(sun.x, sun.y, sR, 0, PI*2); ctx.fill();
  }
  const moon = getMoonPos(dayTime);
  if(moon.opacity > 0){
    const mR = 24;
    // Soft glow
    const glow = ctx.createRadialGradient(moon.x, moon.y, mR*0.3, moon.x, moon.y, mR*3.5);
    glow.addColorStop(0,    `rgba(220,225,240,${0.35*moon.opacity})`);
    glow.addColorStop(0.45, `rgba(180,195,220,${0.10*moon.opacity})`);
    glow.addColorStop(1,    'rgba(180,195,220,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-PAN_RANGE-50, 0, W + 2*PAN_RANGE + 100, trunkBY+2);
    // Disc with crescent shadow
    ctx.fillStyle = `rgba(245,245,225,${moon.opacity})`;
    ctx.beginPath(); ctx.arc(moon.x, moon.y, mR, 0, PI*2); ctx.fill();
    // Subtle craters
    ctx.fillStyle = `rgba(190,190,170,${0.4*moon.opacity})`;
    ctx.beginPath(); ctx.arc(moon.x-6, moon.y-4, 3.5, 0, PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(moon.x+5, moon.y+3, 2.5, 0, PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(moon.x-2, moon.y+6, 2.0, 0, PI*2); ctx.fill();
  }
}

// ════════════════════════════════════════════════════════
//  RAIN
// ════════════════════════════════════════════════════════
let rainDrops = [];
let rainIntensity = 0;
let rainTargetIntensity = 0;
let rainTimer = 25;             // start dry for 25s
let rainHasThunder = false;     // randomly chosen at the start of each storm
let snowFlakes = [];            // {x, y, vx, vy, r, sway, swayPhase, near}

// Use the active "winterness" amount to decide whether precipitation
// should render as snow instead of rain.
function _isSnowing(){
  if(!seasonsMode) return 0;
  return getSeasonInfo(seasonTime).winterness;
}

function updateRain(dt){
  if(!rainMode){
    rainIntensity = Math.max(0, rainIntensity - dt*0.4);
    rainTargetIntensity = 0;
  } else {
    rainTimer -= dt;
    if(rainTimer <= 0){
      if(rainTargetIntensity > 0){
        // Rain ending
        rainTargetIntensity = 0;
        rainTimer = 35 + Math.random()*70;
        rainHasThunder = false;
      } else {
        // Rain starting — heavier rain has a higher thunder chance
        rainTargetIntensity = 0.45 + Math.random()*0.55;
        rainTimer = 14 + Math.random()*22;
        rainHasThunder = (rainTargetIntensity > 0.65) && (Math.random() < 0.55);
      }
    }
    rainIntensity += (rainTargetIntensity - rainIntensity) * dt * 0.5;
  }

  const snowing = _isSnowing();
  // Spawn rain drops only when we're not in winter. Existing drops keep
  // falling out so a winter onset doesn't leave drops frozen mid-air.
  if(rainIntensity > 0.02 && snowing < 0.5){
    const windPush = Wind.sample(0.6);                  // ±~1
    const spawnRate = rainIntensity * 280;              // was 90
    let toSpawn = spawnRate * dt;
    const baseVx = windPush * 360 + 20;                  // wind drives slant
    while(toSpawn > 0){
      if(toSpawn >= 1 || Math.random() < toSpawn){
        rainDrops.push({
          x: Math.random()*(W*1.6) - W*0.3,
          y: -20,
          vx: baseVx + (Math.random() - 0.5) * 60,
          vy: 720 + Math.random()*260,
          near: Math.random() < 0.35,
        });
      }
      toSpawn -= 1;
    }
  }
  // Snow: when winter is active we substitute snowflakes for raindrops.
  // Lower spawn rate (snow visually accumulates more), gentle gravity,
  // strong wind drift, slow fall.
  if(snowing > 0.2){
    const windPush = Wind.sample(0.4);
    const spawnRate = (rainIntensity * 0.4 + 0.35) * snowing * 110;
    let toSpawn = spawnRate * dt;
    const baseVx = windPush * 90 + 8;
    while(toSpawn > 0){
      if(toSpawn >= 1 || Math.random() < toSpawn){
        snowFlakes.push({
          x: Math.random()*(W*1.6) - W*0.3,
          y: -10,
          vx: baseVx + (Math.random() - 0.5) * 40,
          vy: 90 + Math.random()*120,             // ~1/6 of rain speed
          r: 1.2 + Math.random() * 1.8,
          swayPhase: Math.random() * PI * 2,
          near: Math.random() < 0.35,
        });
      }
      toSpawn -= 1;
    }
  }

  // Update raindrop positions
  const windDrift = Wind.sample(0.3) * 320;
  for(const d of rainDrops){
    d.vx += (windDrift - d.vx*0.4) * dt;
    d.x += d.vx*dt;
    d.y += d.vy*dt;
  }
  rainDrops = rainDrops.filter(d => d.y < H+20 && d.x > -120 && d.x < W+120);

  // Update snowflake positions — gentler wind drift + horizontal sway
  const snowDrift = Wind.sample(0.25) * 90;
  const tNow = performance.now() * 0.001;
  for(const f of snowFlakes){
    f.vx += (snowDrift - f.vx*0.5) * dt;
    const sway = Math.sin(tNow * 1.6 + f.swayPhase) * 18;
    f.x += (f.vx + sway) * dt;
    f.y += f.vy * dt;
  }
  snowFlakes = snowFlakes.filter(f => f.y < H+20 && f.x > -120 && f.x < W+120);

  // Snow shouldn't trigger the "rain on roof" loop — mute rain audio when
  // snowing is dominant. Otherwise drive it normally.
  Audio.setRainLevel(snowing > 0.5 ? 0 : rainIntensity);
}

function drawRain(){
  // We may have either rain OR snow active (or both during transitions).
  const haveRain = rainIntensity >= 0.04 && rainDrops.length > 0;
  const haveSnow = snowFlakes.length > 0;
  if(!haveRain && !haveSnow) return;
  if(!haveRain){ drawSnow(); return; }
  const baseAlpha = 0.35 + rainIntensity*0.45;
  ctx.lineCap = 'round';
  // Two passes — far drops (thinner, dimmer) and near drops (longer, brighter)
  ctx.strokeStyle = `rgba(170,195,225,${baseAlpha*0.75})`;
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  for(const d of rainDrops){
    if(d.near) continue;
    const dirL = Math.hypot(d.vx, d.vy);
    const len = 12;
    const dxN = (d.vx/dirL)*len, dyN = (d.vy/dirL)*len;
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.x - dxN, d.y - dyN);
  }
  ctx.stroke();

  ctx.strokeStyle = `rgba(210,225,245,${baseAlpha})`;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for(const d of rainDrops){
    if(!d.near) continue;
    const dirL = Math.hypot(d.vx, d.vy);
    const len = 22;
    const dxN = (d.vx/dirL)*len, dyN = (d.vy/dirL)*len;
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.x - dxN, d.y - dyN);
  }
  ctx.stroke();
  drawSnow();
}

function drawSnow(){
  if(snowFlakes.length === 0) return;
  // Two passes: far flakes (small, dim), near flakes (larger, bright).
  ctx.fillStyle = 'rgba(225, 232, 245, 0.55)';
  for(const f of snowFlakes){
    if(f.near) continue;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r * 0.85, 0, PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(248, 252, 255, 0.92)';
  for(const f of snowFlakes){
    if(!f.near) continue;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, PI * 2);
    ctx.fill();
  }
}

// ════════════════════════════════════════════════════════
//  LIGHTNING & THUNDER
//   Active only during stormy rain (rainHasThunder=true). A
//   strike has a flash phase (whole-screen white burst), an
//   optional bolt drawn from sky → impact point, and a delayed
//   thunder rumble. Very rarely (~3% of strikes), the bolt
//   targets the sloth and chars it.
// ════════════════════════════════════════════════════════
let lightningFlash = 0;          // 0..1, scene whiteout intensity
let lightningTimer = 6;          // seconds until next strike attempt
let lightningBolt = null;        // {points:[{x,y}], age, life}

function updateLightning(dt){
  if(lightningFlash > 0) lightningFlash = Math.max(0, lightningFlash - dt*4.0);
  if(lightningBolt){
    lightningBolt.age += dt;
    if(lightningBolt.age >= lightningBolt.life) lightningBolt = null;
  }
  // Only consider strikes during a thunderstorm at near-peak intensity.
  if(!rainHasThunder || rainIntensity < 0.55) return;
  lightningTimer -= dt;
  if(lightningTimer <= 0){
    lightningTimer = 6 + Math.random()*14;
    _spawnLightning();
  }
}

function _spawnLightning(){
  // Decide if THIS strike hits the sloth — very rare.
  // Roughly 3% of strikes; needs the sloth to actually exist + be vulnerable.
  const slothHittable = sloth && sloth.alive && (
    sloth.state === 'HANGING' || sloth.state === 'WINDUP' ||
    sloth.state === 'REACHING' || sloth.state === 'TRANSITION' ||
    sloth.state === 'EATING' || sloth.state === 'SLEEPING'
  );
  const hitSloth = slothHittable && (Math.random() < 0.05);

  // Strike point
  const tx = hitSloth ? sloth.bodyX : (Math.random() * W * 1.3 - W * 0.15);
  const ty = hitSloth ? (sloth.bodyY - sloth.BH * 0.3) : (trunkBY - Math.random() * trunkLen * 0.6);
  // Build a jagged polyline from off-screen-top down to (tx,ty).
  const points = [];
  let x = tx + (Math.random() - 0.5) * 60;
  let y = -20;
  points.push({x, y});
  while(y < ty){
    const step = 18 + Math.random() * 22;
    y += step;
    // Pull horizontally toward target with some jitter
    const pull = (tx - x) * 0.18;
    x += pull + (Math.random() - 0.5) * 28;
    points.push({x, y});
  }
  points[points.length - 1] = { x: tx, y: ty };

  lightningBolt = { points, age: 0, life: 0.18, hitSloth, tx, ty };
  lightningFlash = hitSloth ? 1.0 : 0.7 + Math.random() * 0.3;
  // Schedule thunder — distance varies for hitSloth (always close).
  const distance = hitSloth ? 0.05 : Math.random() * 1.2;
  setTimeout(() => Audio.playThunder(distance), Math.round(distance * 1000) + 80);
  if(hitSloth && sloth) sloth.charByLightning();
}

function drawLightning(){
  // Bolt itself
  if(lightningBolt){
    const t01 = lightningBolt.age / lightningBolt.life;
    const a = Math.max(0, 1 - t01);
    ctx.save();
    // Glow halo
    ctx.strokeStyle = `rgba(190,210,255,${a * 0.55})`;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    for(let i = 0; i < lightningBolt.points.length; i++){
      const p = lightningBolt.points[i];
      if(i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    // Core
    ctx.strokeStyle = `rgba(255,255,255,${a})`;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for(let i = 0; i < lightningBolt.points.length; i++){
      const p = lightningBolt.points[i];
      if(i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

function drawLightningFlash(){
  // Full-screen white flash overlay (screen-space; called outside camera transform)
  if(lightningFlash > 0.005){
    ctx.fillStyle = `rgba(245, 250, 255, ${lightningFlash * 0.55})`;
    ctx.fillRect(0, 0, W, H);
  }
}

// ════════════════════════════════════════════════════════
//  BACKGROUND THEMES
//   Each theme has a generator (creates layout data) and a renderer.
//   On init we pick one at random; the SHUFFLE button picks another.
// ════════════════════════════════════════════════════════
const BG_THEMES = ['PLAINS', 'MOUNTAINS', 'JUNGLE', 'FOREST', 'RAINFOREST'];
let bgTheme = 'PLAINS';
let bgData = null;

function setBgTheme(name){
  bgTheme = name;
  if(name === 'MOUNTAINS')        bgData = makeMountains();
  else if(name === 'JUNGLE')      bgData = makeJungle();
  else if(name === 'FOREST')      bgData = makeForest();
  else if(name === 'RAINFOREST')  bgData = makeRainforest();
  else bgData = null;
  const el = document.getElementById('v-bg');
  if(el) el.textContent = name;
}

function randomizeBg(){
  // pick a different theme than the current one
  const opts = BG_THEMES.filter(n => n !== bgTheme);
  setBgTheme(opts[Math.floor(Math.random() * opts.length)]);
}

// ── MOUNTAINS — three jagged silhouette layers ──
function makeMountains(){
  const layers = [];
  for(let li = 0; li < 3; li++){
    const peakMax = 50 + li * 50;     // 50, 100, 150 px
    const baseY   = trunkBY + li * 4; // each layer slightly lower (parallax)
    const points  = [];
    let x = -60;
    while(x < W + 60){
      const ph = peakMax * (0.30 + Math.random() * 0.70);
      points.push({ x, y: baseY - ph });
      x += 28 + Math.random() * 50;
    }
    layers.push({ li, points, baseY });
  }
  return { layers };
}
function drawMountains(){
  if(!bgData) return;
  // Layer colors: far → near (cool blue-grey to dark slate)
  const cols = [
    'rgba(125,140,160,0.55)',
    'rgba(80, 95,120,0.75)',
    'rgba(45, 58, 80,0.92)',
  ];
  // Snow caps for the back layer's tallest peaks
  const snowThreshold = trunkBY - 70;
  for(const layer of bgData.layers){
    ctx.fillStyle = cols[layer.li];
    ctx.beginPath();
    const pts = layer.points;
    ctx.moveTo(pts[0].x, layer.baseY + 8);
    ctx.lineTo(pts[0].x, pts[0].y);
    // Smooth-curve interpolation: each raw point becomes a control
    // point, the segment endpoints sit at midpoints between adjacent
    // raw points. Yields a continuously curving silhouette.
    for(let i = 0; i < pts.length - 1; i++){
      const p   = pts[i];
      const nx  = pts[i+1];
      const mx  = (p.x + nx.x) * 0.5;
      const my  = (p.y + nx.y) * 0.5;
      ctx.quadraticCurveTo(p.x, p.y, mx, my);
    }
    // Final segment to the last raw point
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.lineTo(W + 60, layer.baseY + 8);
    ctx.closePath();
    ctx.fill();
    // Snow caps on near peaks (back layer only for distance) — also
    // drawn as smooth curves now.
    if(layer.li === 0){
      ctx.fillStyle = 'rgba(245,250,255,0.65)';
      for(let i = 1; i < pts.length-1; i++){
        const p = pts[i];
        if(p.y < snowThreshold){
          const prev = pts[i-1], next = pts[i+1];
          const lx = (p.x + prev.x) * 0.5;
          const ly = (p.y + prev.y) * 0.5 + 6;
          const rx = (p.x + next.x) * 0.5;
          const ry = (p.y + next.y) * 0.5 + 6;
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.quadraticCurveTo(p.x, p.y, rx, ry);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }
}

// ── JUNGLE — clusters of dark canopy silhouettes ──
function makeJungle(){
  const trees = [];
  for(let i = 0; i < 38; i++){
    const layer = Math.random() < 0.35 ? 0 : (Math.random() < 0.7 ? 1 : 2);
    trees.push({
      x: Math.random() * (W + 80) - 40,
      baseY: trunkBY + 2 + layer * 4,
      h: 60 - layer * 12 + Math.random() * 50,
      w: 28 - layer * 4 + Math.random() * 24,
      layer,
      jitter: Math.random() * PI * 2,
    });
  }
  trees.sort((a,b) => a.layer - b.layer); // back to front
  return { trees };
}
function drawJungle(){
  if(!bgData) return;
  const canopy = ['rgba(55,80,55,0.55)', 'rgba(35,62,40,0.78)', 'rgba(18,42,28,0.95)'];
  const trunks = ['rgba(40,50,32,0.55)', 'rgba(28,38,22,0.78)', 'rgba(15,25,15,0.95)'];
  for(const t of bgData.trees){
    // Trunk
    ctx.fillStyle = trunks[t.layer];
    ctx.fillRect(t.x - 2.5, t.baseY - t.h * 0.55, 5, t.h * 0.55);
    // Canopy — three overlapping ellipses for the lush look
    ctx.fillStyle = canopy[t.layer];
    ctx.beginPath();
    ctx.ellipse(t.x, t.baseY - t.h * 0.55, t.w, t.h * 0.42, 0, 0, PI*2); ctx.fill();
    ctx.beginPath();
    ctx.ellipse(t.x - t.w*0.5, t.baseY - t.h*0.42, t.w*0.7, t.h*0.36, 0, 0, PI*2); ctx.fill();
    ctx.beginPath();
    ctx.ellipse(t.x + t.w*0.5, t.baseY - t.h*0.50, t.w*0.65, t.h*0.34, 0, 0, PI*2); ctx.fill();
  }
}

// ── FOREST — pine-tree triangular silhouettes ──
function makeForest(){
  const trees = [];
  for(let i = 0; i < 55; i++){
    const layer = Math.random() < 0.30 ? 0 : (Math.random() < 0.7 ? 1 : 2);
    trees.push({
      x: Math.random() * (W + 80) - 40,
      baseY: trunkBY + 4 + layer * 5,
      h: 75 - layer * 18 + Math.random() * 60,
      w: 16 - layer * 3 + Math.random() * 14,
      layer,
    });
  }
  trees.sort((a,b) => a.layer - b.layer);
  return { trees };
}
function drawForest(){
  if(!bgData) return;
  const cols = ['rgba(60,90,65,0.55)', 'rgba(38,68,46,0.78)', 'rgba(18,42,28,0.95)'];
  const trunkCol = 'rgba(35,25,15,0.85)';
  for(const t of bgData.trees){
    ctx.fillStyle = cols[t.layer];
    // Stacked triangle pine
    ctx.beginPath();
    ctx.moveTo(t.x, t.baseY - t.h);
    ctx.lineTo(t.x - t.w*0.55, t.baseY - t.h*0.62);
    ctx.lineTo(t.x - t.w*0.30, t.baseY - t.h*0.68);
    ctx.lineTo(t.x - t.w*0.95, t.baseY - t.h*0.32);
    ctx.lineTo(t.x - t.w*0.55, t.baseY - t.h*0.38);
    ctx.lineTo(t.x - t.w*1.10, t.baseY - t.h*0.05);
    ctx.lineTo(t.x + t.w*1.10, t.baseY - t.h*0.05);
    ctx.lineTo(t.x + t.w*0.55, t.baseY - t.h*0.38);
    ctx.lineTo(t.x + t.w*0.95, t.baseY - t.h*0.32);
    ctx.lineTo(t.x + t.w*0.30, t.baseY - t.h*0.68);
    ctx.lineTo(t.x + t.w*0.55, t.baseY - t.h*0.62);
    ctx.closePath();
    ctx.fill();
    // Tiny trunk
    ctx.fillStyle = trunkCol;
    ctx.fillRect(t.x - 1.5, t.baseY - t.h*0.05, 3, t.h*0.06);
  }
}

// ── RAINFOREST — towering emergent trees, hazy mist, fallen logs.
// Tropical look: tall slim straight trunks with broad crown canopies
// that emerge above an understory layer. Some trees lie fallen across
// the forest floor (weathered, moss-tinted). Hanging vines and a
// strong horizon mist band sell the humid jungle feel.
function makeRainforest(){
  const trees = [];
  // Three depth layers, with more density toward the back
  for(let i = 0; i < 90; i++){
    const layer = Math.random() < 0.50 ? 0 : (Math.random() < 0.7 ? 1 : 2);
    // Substantially taller than v64, with high height variance — the
    // very tallest are the "emergent" canopy trees that tower over the rest.
    const isEmergent = Math.random() < 0.18;
    const baseH = isEmergent ? 180 : 90;
    trees.push({
      x: Math.random() * (W + 80) - 40,
      baseY: trunkBY + 2 + layer * 4,
      h: baseH - layer * 28 + Math.random() * 90,
      w: 12 - layer * 2 + Math.random() * 14,
      layer,
      isEmergent,
      // Crown shape variation — wider crown for emergents (umbrella canopy)
      crownW: isEmergent ? 1.6 : 1.0,
    });
  }
  trees.sort((a, b) => a.layer - b.layer);

  // Hanging vines on foreground trees (more than v64)
  const vines = [];
  for(const t of trees){
    if(t.layer >= 1 && Math.random() < 0.55){
      const count = 1 + Math.floor(Math.random() * 3);
      for(let i = 0; i < count; i++){
        vines.push({
          x: t.x + (Math.random()-0.5) * t.w * 1.2,
          y: t.baseY - t.h * (0.55 + Math.random() * 0.15),
          len: 22 + Math.random() * 50,
        });
      }
    }
  }

  // Fallen logs lying on the forest floor — "umgefallene Bäume".
  // Laid mostly horizontally with slight tilt, sized like a real log.
  const logs = [];
  for(let i = 0; i < 6; i++){
    const layer = Math.random() < 0.6 ? 1 : 2;
    logs.push({
      x: Math.random() * (W + 80) - 40,
      baseY: trunkBY + 4 + layer * 5,    // sits on the ground per layer
      len: 60 + Math.random() * 90,
      thick: 8 + Math.random() * 6,
      tilt: (Math.random() - 0.5) * 0.30,   // slight rotation
      layer,
      mossy: Math.random() < 0.55,
    });
  }
  return { trees, vines, logs };
}
function drawRainforest(){
  if(!bgData) return;
  // Hazy mist band — stronger than before so distant emergents feel
  // truly far away.
  const haze = ctx.createLinearGradient(0, trunkBY - 130, 0, trunkBY);
  haze.addColorStop(0, 'rgba(180, 200, 195, 0)');
  haze.addColorStop(1, 'rgba(140, 175, 165, 0.40)');
  ctx.fillStyle = haze;
  ctx.fillRect(-PAN_RANGE - 50, trunkBY - 130, W + 2*PAN_RANGE + 100, 130);

  const canopy = [
    'rgba(110, 145, 95, 0.55)',
    'rgba(55, 100, 60, 0.80)',
    'rgba(20, 60, 35, 0.95)',
  ];
  const trunks = ['rgba(50,62,38,0.55)', 'rgba(32,42,26,0.78)', 'rgba(18,24,16,0.95)'];

  for(const t of bgData.trees){
    // Tall straight trunk (full height of tree)
    const tw = t.isEmergent ? 5 : 3.5;
    ctx.fillStyle = trunks[t.layer];
    ctx.fillRect(t.x - tw / 2, t.baseY - t.h * 0.98, tw, t.h * 0.98);

    // Crown — for emergents, a broad umbrella canopy at the top.
    // For normal trees, narrower canopy stacked at the upper portion.
    ctx.fillStyle = canopy[t.layer];
    if(t.isEmergent){
      // Umbrella canopy: wide flat oval + smaller lobes underneath
      const cw = t.w * t.crownW * 1.6;
      const ch = t.h * 0.18;
      ctx.beginPath();
      ctx.ellipse(t.x, t.baseY - t.h * 0.92, cw, ch, 0, 0, PI*2); ctx.fill();
      ctx.beginPath();
      ctx.ellipse(t.x - cw*0.45, t.baseY - t.h*0.85, cw*0.55, ch*0.85, 0, 0, PI*2); ctx.fill();
      ctx.beginPath();
      ctx.ellipse(t.x + cw*0.45, t.baseY - t.h*0.85, cw*0.55, ch*0.85, 0, 0, PI*2); ctx.fill();
      ctx.beginPath();
      ctx.ellipse(t.x, t.baseY - t.h*0.78, cw*0.4, ch*0.65, 0, 0, PI*2); ctx.fill();
    } else {
      // Standard tall narrow canopy
      ctx.beginPath();
      ctx.ellipse(t.x, t.baseY - t.h * 0.80, t.w * 1.0, t.h * 0.30, 0, 0, PI*2); ctx.fill();
      ctx.beginPath();
      ctx.ellipse(t.x - t.w*0.40, t.baseY - t.h*0.65, t.w*0.7, t.h*0.22, 0, 0, PI*2); ctx.fill();
      ctx.beginPath();
      ctx.ellipse(t.x + t.w*0.40, t.baseY - t.h*0.68, t.w*0.7, t.h*0.22, 0, 0, PI*2); ctx.fill();
    }
  }

  // Fallen logs — drawn after standing trees so they overlay the
  // ground correctly. Each log is a rotated rounded rectangle with
  // simple shading. Mossy logs get a green speckle pass.
  for(const log of bgData.logs){
    ctx.save();
    ctx.translate(log.x, log.baseY);
    ctx.rotate(log.tilt);
    // Shadow under the log
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, log.thick * 0.6, log.len * 0.5, log.thick * 0.4, 0, 0, PI*2);
    ctx.fill();
    // Log body — capsule shape
    const baseHex = log.layer === 1 ? '#3a2a18' : '#221710';
    ctx.fillStyle = baseHex;
    ctx.beginPath();
    ctx.ellipse(0, 0, log.len * 0.5, log.thick * 0.55, 0, 0, PI*2);
    ctx.fill();
    // End-cap rings (suggest cut wood)
    ctx.strokeStyle = 'rgba(80, 55, 30, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(-log.len * 0.5, 0, log.thick * 0.18, log.thick * 0.5, 0, 0, PI*2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse( log.len * 0.5, 0, log.thick * 0.18, log.thick * 0.5, 0, 0, PI*2);
    ctx.stroke();
    // Mossy speckle on top
    if(log.mossy){
      ctx.fillStyle = 'rgba(70, 110, 60, 0.85)';
      const mossCount = Math.floor(log.len * 0.12);
      for(let i = 0; i < mossCount; i++){
        const px = (Math.random() - 0.5) * log.len * 0.85;
        const py = -log.thick * 0.35 + (Math.random() - 0.5) * log.thick * 0.4;
        ctx.beginPath();
        ctx.arc(px, py, 1.0 + Math.random() * 1.5, 0, PI*2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // Hanging vines, drawn last so they sit in front of trunks
  ctx.strokeStyle = 'rgba(40, 70, 38, 0.75)';
  ctx.lineWidth = 1.4;
  for(const v of bgData.vines){
    ctx.beginPath();
    ctx.moveTo(v.x, v.y);
    ctx.quadraticCurveTo(v.x + 3, v.y + v.len*0.55, v.x - 2, v.y + v.len);
    ctx.stroke();
    // Tiny leaf at the tip
    ctx.fillStyle = 'rgba(60, 100, 55, 0.85)';
    ctx.beginPath();
    ctx.ellipse(v.x - 2, v.y + v.len, 2.5, 1.2, 0.8, 0, PI*2);
    ctx.fill();
  }
}


function drawBackground(){
  // Tile the scenery left + right so panning never reveals an empty
  // background. We translate, draw, then translate back.
  const drawOnce = () => {
    if(bgTheme === 'MOUNTAINS')        drawMountains();
    else if(bgTheme === 'JUNGLE')      drawJungle();
    else if(bgTheme === 'FOREST')      drawForest();
    else if(bgTheme === 'RAINFOREST')  drawRainforest();
  };
  ctx.save(); ctx.translate(-W, 0); drawOnce(); ctx.restore();
  drawOnce();
  ctx.save(); ctx.translate( W, 0); drawOnce(); ctx.restore();
}

// ════════════════════════════════════════════════════════
//  HUNGER HUD
// ════════════════════════════════════════════════════════
// Spawn a +N score popup that floats up and fades out at world coords.
function spawnScorePopup(x, y, points, color){
  scorePopups.push({
    x, y,
    vy: -55,
    age: 0,
    life: 1.2,
    text: '+' + points,
    color: color || '#FFE678',
  });
  score += points;
  if(score > highScore) highScore = score;
}

// Update + draw score popups (drawn in WORLD coords inside the camera)
function updateScorePopups(dt){
  for(const p of scorePopups){
    p.age += dt;
    p.y += p.vy * dt;
    p.vy *= Math.pow(0.94, dt * 60);
  }
  scorePopups = scorePopups.filter(p => p.age < p.life);
}
function drawScorePopups(){
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for(const p of scorePopups){
    const k = p.age / p.life;
    const a = k < 0.7 ? 1 : (1 - (k - 0.7) / 0.3);
    const size = 18 + Math.sin(k * Math.PI) * 8;
    ctx.font = `bold ${size}px "Courier New", monospace`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(20, 12, 4, ${a * 0.85})`;
    ctx.strokeText(p.text, p.x, p.y);
    ctx.fillStyle = `${p.color.slice(0,7)}${Math.round(a*255).toString(16).padStart(2,'0')}`;
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.restore();
}

// Lives HUD — top-left, hearts
// Reusable heart icon (centered at x,y)
function _drawHeart(x, y, filled){
  ctx.fillStyle = filled ? '#E62832' : 'rgba(60,30,30,0.55)';
  ctx.strokeStyle = '#3a0408';
  ctx.lineWidth = 2 * HUD_SCALE;
  const s = HUD_SCALE;
  ctx.beginPath();
  ctx.moveTo(x, y + 4*s);
  ctx.bezierCurveTo(x, y - 2*s, x - 8*s, y - 2*s, x - 8*s, y + 4*s);
  ctx.bezierCurveTo(x - 8*s, y + 8*s, x, y + 14*s, x, y + 16*s);
  ctx.bezierCurveTo(x, y + 14*s, x + 8*s, y + 8*s, x + 8*s, y + 4*s);
  ctx.bezierCurveTo(x + 8*s, y - 2*s, x, y - 2*s, x, y + 4*s);
  ctx.fill();
  ctx.stroke();
}

function drawLivesHUD(){
  ctx.save();
  // Hearts row, top-left, vertically centered with the hunger bar
  const startX = 18;
  const spacing = 22 * HUD_SCALE;
  const y = 12 * HUD_SCALE;     // scaled to match the larger bar row
  for(let i = 0; i < MAX_LIVES; i++){
    _drawHeart(startX + i * spacing, y, i < lives);
  }
  ctx.restore();
}

function drawGameOverHUD(){
  // Disabled — replaced by HTML overlays (start/name/end screens)
  return;
  if(!gameOver) return;
  // Dim overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, 0, W, H);
  const cx = W * 0.5, cy = H * 0.40;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Banner: green/celebratory for a win, red/sombre for a loss
  const bannerText = didWin ? 'YOU SURVIVE!' : 'GAME OVER';
  const bannerFill = didWin ? '#9CE85B' : '#FFE678';
  ctx.font = 'bold 36px "Courier New", monospace';
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#1a0408';
  ctx.strokeText(bannerText, cx, cy);
  ctx.fillStyle = bannerFill;
  ctx.fillText(bannerText, cx, cy);

  // Lives bonus line (only if any was actually awarded)
  ctx.font = 'bold 14px "Courier New", monospace';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#000';
  let yLine = cy + 36;
  if(livesBonusGiven > 0){
    const bonusText = 'Lives bonus: +' + livesBonusGiven;
    ctx.strokeText(bonusText, cx, yLine);
    ctx.fillStyle = '#FFC2A8';
    ctx.fillText(bonusText, cx, yLine);
    yLine += 22;
  }

  // Final score
  ctx.font = 'bold 16px "Courier New", monospace';
  ctx.strokeText('Final score: ' + score, cx, yLine);
  ctx.fillStyle = '#fff';
  ctx.fillText('Final score: ' + score, cx, yLine);
  yLine += 22;

  // Tap to restart (after a 1s delay so the user doesn't restart accidentally)
  const elapsed = performance.now() / 1000 - gameOverAt;
  if(elapsed > 1){
    const pulse = 0.55 + 0.45 * Math.sin(performance.now() * 0.005);
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillStyle = `rgba(180, 230, 255, ${pulse})`;
    ctx.fillText('TAP TO RESTART', cx, yLine + 32);
  }
}

// End the run (win or loss). Awards the lives-remaining bonus once.
function _endGame(win){
  if(gameOver) return;
  didWin = win;
  livesBonusGiven = Math.max(0, lives) * 100;
  score += livesBonusGiven;
  if(score > highScore) highScore = score;
  gameOver = true;
  gameOverAt = performance.now() / 1000;
  sloth = null;
}

// Render the leaderboard inside an existing element id, optionally
// highlighting the most recently inserted row.
function renderHighscoreTable(targetId, highlightTopOf){
  const el = document.getElementById(targetId);
  if(!el) return;
  if(highscores.length === 0){
    el.innerHTML = '<div class="hs-empty">No scores yet — be the first!</div>';
    return;
  }
  let html = '<table class="hs-table"><tr><th>#</th><th>NAME</th><th class="pts">SCORE</th></tr>';
  for(let i = 0; i < highscores.length; i++){
    const h = highscores[i];
    const me = (highlightTopOf && h.score === highlightTopOf && h.name === lastInsertedName) ? ' me' : '';
    html += `<tr class="${me}"><td class="rank">${i+1}</td><td class="name">${escapeHtml(h.name)}</td><td class="pts">${h.score}</td></tr>`;
  }
  html += '</table>';
  el.innerHTML = html;
}
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]
  ));
}
let lastInsertedName = null;

// Show / hide overlays + drive the game-state transitions
const ovStart = document.getElementById('ov-start');
const ovName  = document.getElementById('ov-name');
const ovEnd   = document.getElementById('ov-end');

function showStart(){
  gameState = 'START';
  renderHighscoreTable('ov-start-hs');
  ovStart.classList.remove('hidden');
  ovName.classList.add('hidden');
  ovEnd.classList.add('hidden');
}
function showNameEntry(){
  gameState = 'NAME';
  document.getElementById('ov-name-banner').textContent = didWin ? 'YOU SURVIVE!' : 'GAME OVER';
  document.getElementById('ov-name-banner').style.color = didWin ? '#9CE85B' : '#FFE678';
  document.getElementById('ov-name-score').textContent = 'SCORE ' + score;
  const bonusEl = document.getElementById('ov-name-bonus');
  bonusEl.textContent = livesBonusGiven > 0 ? ('Includes lives bonus +' + livesBonusGiven) : '';
  ovName.classList.remove('hidden');
  ovStart.classList.add('hidden');
  ovEnd.classList.add('hidden');
  const inp = document.getElementById('ov-name-input');
  inp.value = '';
  setTimeout(() => inp.focus(), 50);
}
function showEndScreen(){
  gameState = 'END';
  document.getElementById('ov-end-banner').textContent = didWin ? 'YOU SURVIVE!' : 'GAME OVER';
  document.getElementById('ov-end-banner').style.color = didWin ? '#9CE85B' : '#FFE678';
  document.getElementById('ov-end-score').textContent = 'SCORE ' + score;
  const bonusEl = document.getElementById('ov-end-bonus');
  bonusEl.textContent = livesBonusGiven > 0 ? ('Includes lives bonus +' + livesBonusGiven) : '';
  renderHighscoreTable('ov-end-hs', score);
  ovEnd.classList.remove('hidden');
  ovStart.classList.add('hidden');
  ovName.classList.add('hidden');
}
function beginPlaying(){
  gameState = 'PLAYING';
  ovStart.classList.add('hidden');
  ovName.classList.add('hidden');
  ovEnd.classList.add('hidden');
  // Fresh game state
  lives = MAX_LIVES;
  score = 0;
  hunger = 0.80;
  displayedHunger = 0.80;
  _sleepLabelAlpha = 0;
  gameOver = false;
  didWin = false;
  livesBonusGiven = 0;
  gameDaysElapsed = 0;
  _lastYearMark = 0;
  if(seasonsMode){ seasonTime = 3/12; P.month = 3; }
  _resetTreeForNewGame();
  if(fruitsMode) spawnFruits();
  spawnSloth();
  userIdleT = 0;
  slothHasMoved = false;
  bellyScale = 1.0;
}

document.getElementById('ov-start-btn').addEventListener('click', beginPlaying);
document.getElementById('ov-end-btn').addEventListener('click', () => {
  showStart();   // return to start screen between runs
});
document.getElementById('ov-name-btn').addEventListener('click', () => {
  const inp = document.getElementById('ov-name-input');
  const name = (inp.value || '').trim().toUpperCase().slice(0,8) || 'ANON';
  insertHighscore(name, score);
  lastInsertedName = name;
  showEndScreen();
});
document.getElementById('ov-name-input').addEventListener('keydown', e => {
  if(e.key === 'Enter'){ document.getElementById('ov-name-btn').click(); }
});

// Hook into game-over: once gameOver flips true, show name entry or end.
function _checkPostGameTransition(){
  if(gameState === 'PLAYING' && gameOver){
    if(qualifiesForLeaderboard(score)) showNameEntry();
    else showEndScreen();
  }
}

function restartGame(){
  lives = MAX_LIVES;
  score = 0;
  hunger = 0.80;
  displayedHunger = 0.80;
  _sleepLabelAlpha = 0;
  gameOver = false;
  didWin = false;
  livesBonusGiven = 0;
  gameDaysElapsed = 0;
  _lastYearMark = 0;
  // Reset season clock so a fresh game starts in April.
  if(seasonsMode){ seasonTime = 3/12; P.month = 3; }
  _resetTreeForNewGame();
  if(fruitsMode) spawnFruits();
  spawnSloth();
  slothHasMoved = false;
  bellyScale = 1.0;
}

// Score HUD — top-right, screen space (no panel, no BEST line)
function drawScoreHUD(){
  ctx.save();
  const s = HUD_SCALE;
  ctx.font = `bold ${Math.round(16 * s)}px "Courier New", monospace`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  // Score line
  const text = 'SCORE ' + score;
  const x = W - 16 * s;
  const y = 21 * s;
  ctx.lineWidth = 3.5 * s;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = '#FFE678';
  ctx.fillText(text, x, y);
  // Month info now lives entirely inside the SURVIVAL progress bar to
  // the left of the score, so nothing else is drawn here.
  ctx.restore();
}

// Shared layout for the two top-HUD progress bars.
// Returns { y, h, hungerX, hungerW, survivalX, survivalW, clockX, clockY, clockR }.
// HUD top row: [food icon] [hunger bar] [clock] [survival bar].
// Both icons are circles with the same diameter (~2× bar height); the
// food icon doesn't render its own ring background — the SVG-style glyph
// just draws over the canvas — but the layout reserves the slot.
function _hudBarsRect(){
  const s            = HUD_SCALE;
  const heartsRight  = 18 + MAX_LIVES * 22 * s;     // right edge of hearts
  const scoreLeft    = W - 130 * s;                 // approx left edge of score text
  const totalW       = Math.max(160 * s, scoreLeft - heartsRight - 24 * s);
  // Cap the combined width on very wide screens so bars stay reasonable.
  const cappedW      = Math.min(totalW, 384 * s);
  const h            = 12 * s;
  const gap          = 6 * s;
  const iconD        = h * 2;                       // ≈24 × s diameter (food icon + clock)
  // Bar widths after subtracting two icons (food, clock) and three gaps.
  const barsW        = cappedW - iconD * 2 - gap * 3;
  const hungerW      = Math.round(barsW * 0.60);
  const survivalW    = Math.max(40 * s, barsW - hungerW);
  // Center the whole composite in the middle slot.
  const startX       = heartsRight + 12 * s + (scoreLeft - heartsRight - 12 * s - cappedW) * 0.5;
  const y            = 14 * s;
  // Food icon center sits at startX + iconD/2; hunger bar follows the icon + gap.
  const foodCx      = startX + iconD * 0.5;
  const hungerX     = startX + iconD + gap;
  const clockCx     = hungerX + hungerW + gap + iconD * 0.5;
  const survivalX   = hungerX + hungerW + gap + iconD + gap;
  return {
    y, h,
    foodX:     foodCx,
    foodY:     y + h * 0.5,
    foodR:     iconD * 0.5,
    hungerX,
    hungerW,
    clockX:    clockCx,
    clockY:    y + h * 0.5,
    clockR:    iconD * 0.5,
    survivalX,
    survivalW,
  };
}

// Food icon — fork + spoon crossed silhouette. Drawn as a single dark
// shape vertically centered on the bar row. Mirrors the reference image:
// fork on the lower-left, spoon on the upper-right, slightly rotated.
function drawFoodIcon(){
  const r = _hudBarsRect();
  const cx = r.foodX, cy = r.foodY, R = r.foodR;
  ctx.save();
  // Subtle glow so the icon reads against busy backgrounds
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur  = 3;
  ctx.fillStyle   = 'rgba(245, 230, 200, 0.95)';
  ctx.translate(cx, cy);

  // FORK — runs from upper-left to lower-right, slightly tilted.
  ctx.save();
  ctx.rotate(-0.50);                   // tilt
  // Handle (lower portion of the rotated shape)
  ctx.fillRect(-1.0, 0, 2.0, R * 0.95);
  // Head (oval body where the tines attach)
  ctx.beginPath();
  ctx.ellipse(0, -R * 0.20, 3.6, R * 0.30, 0, 0, PI*2);
  ctx.fill();
  // Three tines on top of the head
  for(let i = -1; i <= 1; i++){
    ctx.fillRect(i * 2.4 - 0.5, -R * 0.85, 1.0, R * 0.55);
  }
  ctx.restore();

  // SPOON — runs from upper-right to lower-left, opposite tilt.
  ctx.save();
  ctx.rotate(0.50);
  // Handle
  ctx.fillRect(-1.0, 0, 2.0, R * 0.95);
  // Bowl: a fat ellipse at the top
  ctx.beginPath();
  ctx.ellipse(0, -R * 0.55, R * 0.40, R * 0.55, 0, 0, PI*2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

// Mini analog clock between hunger + survival bars. The hour hand sweeps
// once per real-world day cycle (dayTime 0..1 = 24h: midnight → noon →
// midnight). dayTime 0 = midnight, 0.5 = noon. We use a 24-hour analog
// reading where the hand makes one revolution over the whole day, with
// 12 noon at the top and midnight at the bottom — easy to read at a glance.
function drawClock(){
  const r = _hudBarsRect();
  const cx = r.clockX, cy = r.clockY, R = r.clockR;

  ctx.save();
  // Outer ring + face
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, PI*2);
  ctx.fillStyle = 'rgba(8, 14, 24, 0.85)';
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(195, 222, 255, 0.55)';
  ctx.stroke();

  // Tick marks at 6/12/18/24-hour positions (4 cardinal points)
  ctx.strokeStyle = 'rgba(195, 222, 255, 0.45)';
  ctx.lineWidth = 1;
  for(let i = 0; i < 4; i++){
    const a = (i / 4) * PI * 2 - PI / 2;
    const r1 = R - 3, r2 = R - 1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    ctx.stroke();
  }

  // Hour hand. dayTime 0 = midnight. We want midnight DOWN (south,
  // -PI/2 + PI) and noon UP (north, -PI/2). So angle = -PI/2 + dayTime*2*PI.
  // At dayTime = 0   → -PI/2 (top)?  Hmm.
  // Actually: we want noon (dayTime 0.5) at the TOP, so:
  //   angle = -PI/2 + (dayTime - 0.5) * 2*PI
  // At dayTime 0   → -PI/2 - PI  → bottom (midnight) ✓
  // At dayTime 0.5 → -PI/2       → top    (noon)     ✓
  // At dayTime 0.25 → -PI/2 - PI/2 → left  (sunrise) ✓
  // At dayTime 0.75 → -PI/2 + PI/2 → right (sunset)  ✓
  const angle = -PI/2 + (dayTime - 0.5) * 2 * PI;
  const handLen = R - 3;
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = 'rgba(255, 235, 175, 0.95)';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(angle) * handLen, cy + Math.sin(angle) * handLen);
  ctx.stroke();

  // Center pin
  ctx.beginPath(); ctx.arc(cx, cy, 1.3, 0, PI*2);
  ctx.fillStyle = 'rgba(255, 235, 175, 0.95)';
  ctx.fill();

  ctx.restore();
}

// Survival progress bar — sits right of the hunger bar. Fills cool-blue
// from left to right as gameDaysElapsed approaches P.endMonths. When at
// 100% the bar pulses to suggest the win is imminent.
function drawSurvivalBar(){
  const r = _hudBarsRect();
  const x = r.survivalX, y = r.y, w = r.survivalW, h = r.h;

  // Track + outline
  ctx.fillStyle = 'rgba(0,0,0,0.50)';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = 'rgba(22,28,38,0.85)';
  ctx.fillRect(x, y, w, h);

  // Progress 0..1 (months elapsed / target months)
  const monthsDone = Math.max(0, gameDaysElapsed);
  const target     = Math.max(1, P.endMonths);
  const fr = Math.min(1, monthsDone / target);

  // Fill — warm yellow/amber, brightening as it nears the end.
  const k = fr;     // 0 → 1
  const fillR = Math.round(220 + 30  * k);
  const fillG = Math.round(180 + 50  * k);
  const fillB = Math.round(60  + 20  * k);
  ctx.fillStyle = `rgb(${fillR},${fillG},${fillB})`;
  ctx.fillRect(x + 1, y + 1, (w - 2) * fr, h - 2);
  // Subtle gloss
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fillRect(x + 1, y + 1, (w - 2) * fr, (h - 2) * 0.45);

  // Year-end markers — thin grey ticks at every Dec→Jan boundary along
  // the bar. Game starts in April (month index 3), so the first year-end
  // boundary falls at 9 months elapsed (Apr+9 = Jan), and every 12
  // months thereafter.
  ctx.fillStyle = 'rgba(180, 185, 195, 0.85)';
  for(let m = 9; m < target; m += 12){
    const tx = x + 1 + (w - 2) * (m / target);
    ctx.fillRect(tx - 0.5, y + 1, 1, h - 2);
  }

  // Centered label inside the bar — month name only.
  // Hidden when seasons are off (no calendar context to display) or
  // when the bar is too narrow.
  if(seasonsMode && w >= 60){
    ctx.save();
    ctx.font = `bold ${Math.round(9 * HUD_SCALE)}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const monthIdx = Math.floor(seasonTime * 12) % 12;
    const label = MONTH_NAMES_FULL[((monthIdx % 12) + 12) % 12];
    const cx = x + w * 0.5;
    const cy = y + h * 0.5 + 0.5;
    // Half-width outline for legibility against varying bar fill colours.
    ctx.lineWidth = 1.1 * HUD_SCALE;
    ctx.strokeStyle = 'rgba(0,0,0,0.70)';
    ctx.strokeText(label, cx, cy);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillText(label, cx, cy);
    ctx.restore();
  }

  // Pulse on completion — keep the same gentle cyan flash so it stands
  // out against the now-yellow fill.
  if(fr >= 0.999){
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.010);
    ctx.fillStyle = `rgba(255, 245, 170, ${0.20 + pulse * 0.30})`;
    ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  }
}

function drawHungerBar(){
  // The HUD top row is split into THREE sections: hearts (left),
  // hunger + survival bars (middle, side-by-side), score (right).
  // We compute the same x / y / w used by drawSurvivalBar via a shared
  // helper so both bars stay vertically aligned and split the middle
  // space proportionally.
  const rect = _hudBarsRect();
  const w = rect.hungerW;
  const h = rect.h;
  const x = rect.hungerX;
  const y = rect.y;

  // Track + outline
  ctx.fillStyle = 'rgba(0,0,0,0.50)';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = 'rgba(30,28,22,0.85)';
  ctx.fillRect(x, y, w, h);

  // Fill colour: green → yellow → red
  // The displayed value lags slightly behind the real `hunger` so eating
  // animates the bar smoothly over ~400ms instead of snapping.
  const fr = clamp(displayedHunger, 0, 1);
  let r, g, b;
  if(fr > 0.5){
    const k = (fr - 0.5) * 2;
    r = Math.round(220 - 100*k);
    g = 200;
    b = 70;
  } else {
    const k = fr * 2;
    r = 220;
    g = Math.round(60 + 140*k);
    b = 50;
  }
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(x + 1, y + 1, (w - 2) * fr, h - 2);
  // Subtle gloss
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(x + 1, y + 1, (w - 2) * fr, (h - 2) * 0.45);

  // Red HUNGRY flash around the bar — drawn under any overlay text.
  let pulse = 0;
  if(fr <= 0.30){
    pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.012);
    ctx.fillStyle = `rgba(255,80,40,${0.18 + pulse * 0.30})`;
    ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
    // Re-paint bar so the flash stays as a glow behind it
    ctx.fillStyle = 'rgba(30,28,22,0.85)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x + 1, y + 1, (w - 2) * fr, h - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(x + 1, y + 1, (w - 2) * fr, (h - 2) * 0.45);
  }

  // Status overlay text inside the bar. The SLEEPING state intentionally
  // shows NOTHING — the slow breath-of-the-bar speaks for itself.
  // HUNGRY! still shows when the bar drops at or below 30%.
  let overlay = null;
  let overlayAlpha = 0;
  if(fr <= 0.30){
    overlay = 'HUNGRY!';
    overlayAlpha = 0.65 + pulse * 0.35;
  }
  if(overlay && overlayAlpha > 0.005){
    ctx.save();
    ctx.font = `bold ${Math.round(9 * HUD_SCALE)}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cx = x + w * 0.5;
    const cy = y + h * 0.5 + 0.5;
    ctx.lineWidth = 1.2 * HUD_SCALE;
    ctx.strokeStyle = `rgba(0,0,0,${0.80 * Math.min(1, overlayAlpha * 1.5)})`;
    ctx.strokeText(overlay, cx, cy);
    ctx.fillStyle = `rgba(255, 220, 180, ${overlayAlpha})`;
    ctx.fillText(overlay, cx, cy);
    ctx.restore();
  }
}

// ════════════════════════════════════════════════════════
//  RENDERING (background, trunk, particles)
// ════════════════════════════════════════════════════════
// Cached half-resolution offscreen canvases — one for the BLUR BG snapshot
// trick, one for rendering clouds in isolation when BLUR CLOUDS is on.
let _bgBlurOff = null;
let _cloudsBlurOff = null;
function _getBgBlurOffscreen(){
  const targetW = Math.max(1, (W * 0.5) | 0);
  const targetH = Math.max(1, (H * 0.5) | 0);
  if(!_bgBlurOff || _bgBlurOff.w !== targetW || _bgBlurOff.h !== targetH){
    const c = document.createElement('canvas');
    c.width = targetW;
    c.height = targetH;
    _bgBlurOff = { canvas: c, ctx: c.getContext('2d'), w: targetW, h: targetH };
  }
  return _bgBlurOff;
}
function _getCloudsBlurOffscreen(){
  const targetW = Math.max(1, (W * 0.5) | 0);
  const targetH = Math.max(1, (H * 0.5) | 0);
  if(!_cloudsBlurOff || _cloudsBlurOff.w !== targetW || _cloudsBlurOff.h !== targetH){
    const c = document.createElement('canvas');
    c.width = targetW;
    c.height = targetH;
    _cloudsBlurOff = { canvas: c, ctx: c.getContext('2d'), w: targetW, h: targetH };
  }
  return _cloudsBlurOff;
}

// Render the cloud puffs onto an arbitrary 2D context. Extracted so the
// same code can target either the main canvas (ctx) or an offscreen
// canvas when BLUR CLOUDS is enabled.
function drawCloudsTo(targetCtx){
  const sunUp = (dayTime > 0.22 && dayTime < 0.78);
  const lightT = clamp((dayTime > 0.5 ? 1 - dayTime : dayTime) * 4 - 0.5, 0, 1);
  const dayShade = sunUp ? lightT : 0.18;
  const rainShade = 1 - rainIntensity * 0.40;
  const baseR = (60 + 188*dayShade) * rainShade;
  const baseG = (75 + 177*dayShade) * rainShade;
  const baseB = (95 + 160*dayShade) * rainShade;
  for(const c of clouds){
    const puffs=[[0,0,1,1],[-.44,.18,.66,.80],[.42,.22,.60,.74],[-.20,.30,.44,.60]];
    targetCtx.fillStyle = `rgba(${(baseR*0.55)|0},${(baseG*0.62)|0},${(baseB*0.78)|0},${c.a*0.55})`;
    for(const [ox,oy,rx,ry] of puffs){
      targetCtx.beginPath();
      targetCtx.ellipse(c.x+ox*c.rx, c.y+oy*c.ry+c.ry*0.30, c.rx*rx, c.ry*ry*0.95, 0, 0, PI*2);
      targetCtx.fill();
    }
    targetCtx.fillStyle = `rgba(${baseR|0},${baseG|0},${baseB|0},${c.a})`;
    for(const [ox,oy,rx,ry] of puffs){
      targetCtx.beginPath();
      targetCtx.ellipse(c.x+ox*c.rx, c.y+oy*c.ry, c.rx*rx, c.ry*ry, 0, 0, PI*2);
      targetCtx.fill();
    }
    const hR = Math.min(255, baseR*1.10), hG = Math.min(255, baseG*1.08), hB = Math.min(255, baseB*1.02);
    targetCtx.fillStyle = `rgba(${hR|0},${hG|0},${hB|0},${c.a*0.6})`;
    for(const [ox,oy,rx,ry] of puffs){
      targetCtx.beginPath();
      targetCtx.ellipse(c.x+ox*c.rx, c.y+oy*c.ry-c.ry*0.22, c.rx*rx*0.78, c.ry*ry*0.65, 0, 0, PI*2);
      targetCtx.fill();
    }
  }
}

function drawBg(){
  // Time-based sky gradient
  const skyC = getSkyAtTime(dayTime);
  const sky = ctx.createLinearGradient(0,0,0,trunkBY);
  sky.addColorStop(0,    `rgb(${skyC[0].join(',')})`);
  sky.addColorStop(0.45, `rgb(${skyC[1].join(',')})`);
  sky.addColorStop(0.85, `rgb(${skyC[2].join(',')})`);
  sky.addColorStop(1,    `rgb(${skyC[3].join(',')})`);
  ctx.fillStyle = sky; ctx.fillRect(-PAN_RANGE-50, 0, W + 2*PAN_RANGE + 100, trunkBY+2);

  // Sun & Moon arcs across the sky
  drawSunMoon();

  // Rain darkening overlay on the sky (no clouds yet — those come last)
  if(rainIntensity > 0.02){
    ctx.fillStyle = `rgba(50,60,75,${rainIntensity*0.35})`;
    ctx.fillRect(-PAN_RANGE-50, 0, W + 2*PAN_RANGE + 100, trunkBY+2);
  }

  // Distant background scenery (mountains / jungle / forest silhouettes)
  drawBackground();

  // BLUR BG: instead of applying ctx.filter to every individual draw call
  // (which runs the GPU blur convolution dozens of times per frame), we
  // snapshot the freshly-drawn sharp background to a half-resolution
  // offscreen canvas, then blit it back upscaled with a single blur pass.
  // The downscale + upscale chain itself produces a soft bilinear blur,
  // so only a small explicit blur is needed. Net cost: ~1 blur op per
  // frame on a quarter-area canvas, vs ~100+ ops on the full canvas before.
  if(blurBgMode){
    const off = _getBgBlurOffscreen();
    const offCtx = off.ctx;
    // Half-res snapshot: drawImage downsamples from main canvas (W×H)
    // to offscreen (W/2 × H/2) using bilinear filtering, which already
    // softens the image considerably.
    offCtx.clearRect(0, 0, off.w, off.h);
    offCtx.drawImage(canvas, 0, 0, off.w, off.h);
    // Blit back with one blur op + bilinear upscale.
    // Reset the world transform briefly so drawImage maps pixel-for-pixel.
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.filter = 'blur(3px)';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(off.canvas, 0, 0, off.w, off.h, 0, 0, W, H);
    ctx.restore();
  }

  // Stars — drawn AFTER the BG blur pass so they always render as crisp
  // pinpoints, never blurred. They still sit behind clouds (drawn next),
  // so a passing cloud can correctly hide a star behind it.
  drawStars(getStarOpacity(dayTime));

  // ── CLOUDS — drawn after bg-blur so they have independent blur control.
  // When BLUR CLOUDS is on, clouds are rendered to a half-res offscreen
  // canvas and blitted back with one blur op (same single-pass trick as
  // BLUR BG). Otherwise they go straight to main like before.
  if(blurCloudsMode){
    const cOff = _getCloudsBlurOffscreen();
    cOff.ctx.clearRect(0, 0, cOff.w, cOff.h);
    cOff.ctx.save();
    // Match the half-res scale + the world camera pan so cloud positions
    // line up with the main canvas's coordinate system.
    cOff.ctx.scale(0.5, 0.5);
    cOff.ctx.translate(sceneOffsetX, 0);
    drawCloudsTo(cOff.ctx);
    cOff.ctx.restore();
    // Blit back to main with one blur op + bilinear upscale.
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = 'blur(3px)';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cOff.canvas, 0, 0, cOff.w, cOff.h, 0, 0, W, H);
    ctx.restore();
  } else {
    drawCloudsTo(ctx);
  }

  const wnGround = seasonsMode ? getSeasonInfo(seasonTime).winterness : 0;
  // Snow palette destinations for each gradient stop.
  const SNOW_TOP   = [232, 240, 248];   // bright fresh snow at the surface
  const SNOW_DEEP  = [148, 168, 195];   // shadow blue lower down
  const lerpHexToRgb = (hex, dest, t) => {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    const nr = Math.round(r + (dest[0] - r) * t);
    const ng = Math.round(g + (dest[1] - g) * t);
    const nb = Math.round(b + (dest[2] - b) * t);
    return `rgb(${nr},${ng},${nb})`;
  };

  const haze=ctx.createLinearGradient(0,trunkBY-65,0,trunkBY);
  haze.addColorStop(0,'rgba(165,210,232,0)');
  haze.addColorStop(1,'rgba(165,210,232,0.28)');
  ctx.fillStyle=haze; ctx.fillRect(-PAN_RANGE-50,trunkBY-65,W + 2*PAN_RANGE + 100,65);

  const gnd=ctx.createLinearGradient(0,trunkBY,0,H);
  if(wnGround > 0){
    gnd.addColorStop(0,    lerpHexToRgb('#4e7835', SNOW_TOP,  wnGround));
    gnd.addColorStop(.06,  lerpHexToRgb('#3b5f22', SNOW_TOP,  wnGround));
    gnd.addColorStop(.40,  lerpHexToRgb('#2a4818', SNOW_DEEP, wnGround));
    gnd.addColorStop(1,    lerpHexToRgb('#192e0d', SNOW_DEEP, wnGround));
  } else {
    gnd.addColorStop(0,'#4e7835'); gnd.addColorStop(.06,'#3b5f22');
    gnd.addColorStop(.40,'#2a4818'); gnd.addColorStop(1,'#192e0d');
  }
  ctx.fillStyle=gnd; ctx.fillRect(-PAN_RANGE-50,trunkBY,W + 2*PAN_RANGE + 100,H-trunkBY);

  // Trunk-shadow ellipse — softer + lighter color in winter (snow shadow)
  ctx.beginPath();
  ctx.ellipse(trunkBX,trunkBY,W*0.46,14,0,0,PI*2);
  if(wnGround > 0){
    ctx.fillStyle = `rgba(120,140,170,${0.17 * (1 - wnGround*0.5)})`;
  } else {
    ctx.fillStyle = 'rgba(88,152,55,0.17)';
  }
  ctx.fill();
}
function drawTrunk(){
  const bw=25,tw=15;
  // Use swayed top — the trunk bends like a flagpole under wind
  const topX = trunkTopXSway, topY = trunkTopYSway;
  const dxTop = topX - trunkBX;

  ctx.beginPath();
  ctx.moveTo(trunkBX-bw, trunkBY+9);
  ctx.bezierCurveTo(
    trunkBX-bw*.80,           trunkBY-trunkLen*.34,
    topX-tw*1.18,             topY+trunkLen*.28,
    topX-tw,                  topY
  );
  ctx.lineTo(topX+tw, topY);
  ctx.bezierCurveTo(
    topX+tw*1.18,             topY+trunkLen*.28,
    trunkBX+bw*.80,           trunkBY-trunkLen*.34,
    trunkBX+bw,               trunkBY+9
  );
  ctx.closePath();
  const wn = seasonsMode ? getSeasonInfo(seasonTime).winterness : 0;
  const tg=ctx.createLinearGradient(trunkBX-bw,0,trunkBX+bw,0);
  if(wn > 0){
    // Lerp the trunk gradient toward near-black for winter.
    const lerpHex = (a, b, t) => {
      const ar=parseInt(a.slice(1,3),16), ag=parseInt(a.slice(3,5),16), ab=parseInt(a.slice(5,7),16);
      const br=parseInt(b.slice(1,3),16), bg=parseInt(b.slice(3,5),16), bb=parseInt(b.slice(5,7),16);
      const r=Math.round(ar+(br-ar)*t), g=Math.round(ag+(bg-ag)*t), bl=Math.round(ab+(bb-ab)*t);
      return `rgb(${r},${g},${bl})`;
    };
    tg.addColorStop(0,    lerpHex('#1c0e06','#040305',wn));
    tg.addColorStop(.20,  lerpHex('#572e16','#0e0a08',wn));
    tg.addColorStop(.55,  lerpHex('#46240e','#0a0708',wn));
    tg.addColorStop(1,    lerpHex('#150a03','#020203',wn));
  } else {
    tg.addColorStop(0,'#1c0e06'); tg.addColorStop(.20,'#572e16');
    tg.addColorStop(.55,'#46240e'); tg.addColorStop(1,'#150a03');
  }
  ctx.fillStyle=tg; ctx.fill();

  // Bark stripes — also bend with the trunk
  ctx.save(); ctx.clip();
  ctx.strokeStyle='rgba(0,0,0,0.09)'; ctx.lineWidth=1;
  for(let xb = trunkBX-bw+3; xb < trunkBX+bw; xb += 6){
    const xt = xb + dxTop;
    const w  = (Math.random()-.5)*3;
    ctx.beginPath();
    ctx.moveTo(xb + w, trunkBY);
    ctx.bezierCurveTo(
      xb + w*.6 + dxTop*.4,  trunkBY-trunkLen*.5,
      xb - w*.4 + dxTop*.7,  trunkBY-trunkLen*.8,
      xt,                     topY
    );
    ctx.stroke();
  }
  ctx.restore();

  // Root buttresses — anchored at the base, unaffected by sway
  for(let s=-1; s<=1; s+=.5){
    ctx.beginPath();
    ctx.moveTo(trunkBX+s*bw, trunkBY+5);
    ctx.bezierCurveTo(
      trunkBX+s*bw*1.9, trunkBY+9,
      trunkBX+s*bw*3.2, trunkBY+5,
      trunkBX+s*bw*4.3, trunkBY+1
    );
    ctx.strokeStyle='#261205'; ctx.lineWidth=4+abs(s)*2; ctx.lineCap='round'; ctx.stroke();
  }
}
function drawParticles(){
  const ws=Wind.str;
  if(ws<0.03) return;
  for(const p of particles){
    ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x-p.len*ws,p.y);
    ctx.strokeStyle=`rgba(218,236,255,${p.a*ws})`; ctx.lineWidth=0.7; ctx.stroke();
  }
}

// ════════════════════════════════════════════════════════
//  ANIMATION LOOP
// ════════════════════════════════════════════════════════
let last=0;
function frame(ts){
  let dt=clamp((ts-last)/1000,0,0.05); last=ts;
  // While paused, freeze time for simulation but keep redrawing the
  // canvas so the pause overlay + UI stays interactive.
  if(paused) dt = 0;
  Wind.tick(dt);
  Audio.updateWind(Wind.str);

  // Idle timer — sloth dozes off after 3s of no canvas touches.
  // BUT only starts once the sloth has actually moved at least once,
  // so a fresh game won't auto-sleep before the player has interacted.
  if(slothHasMoved) userIdleT += dt;

  // Smooth displayed hunger toward the real value. ~400ms full
  // animation: tau≈0.133s gives ~95% closure after 400ms.
  {
    const tauH = 0.133;
    const kH = 1 - Math.exp(-dt / tauH);
    displayedHunger += (hunger - displayedHunger) * kH;
  }

  // Ease the SLEEPING label opacity toward its target (1 while sleeping,
  // 0 otherwise). tau ≈ 0.20s → reaches ~95% after 600ms.
  {
    const sleepingNow = sloth && sloth.state === 'SLEEPING';
    const targetA = sleepingNow ? 1 : 0;
    const tauA = 0.20;
    const kA = 1 - Math.exp(-dt / tauA);
    _sleepLabelAlpha += (targetA - _sleepLabelAlpha) * kA;
  }

  // Smooth the belly scale toward its hunger-driven target via
  // exponential easing. Time-constant = one in-game day (DAY_CYCLE_S
  // real seconds at dayPace=1). Each real second we close roughly
  // dt/DAY_CYCLE_S of the remaining gap, scaled by |dayPace| so faster
  // game time also speeds the belly. After 1 in-game day the belly is
  // ~63% of the way to whatever the current hunger calls for; full
  // settle takes ~3 in-game days. Eating a fruit therefore manifests
  // gradually, and if hunger keeps falling while the belly is still
  // chasing, the moving target naturally pulls it back too.
  const target = _bellyTarget();
  const tau = DAY_CYCLE_S / Math.max(0.0001, Math.abs(P.dayPace || 1));   // sec to settle ≈ this
  const k   = 1 - Math.exp(-dt / tau);
  bellyScale += (target - bellyScale) * k;

  // Tick leaf flash timers
  for(const [b, t] of leafFlashes){
    const nt = t - dt * 2.5;
    if(nt <= 0) leafFlashes.delete(b);
    else leafFlashes.set(b, nt);
  }

  // Game tick — day counter advances with the day cycle. The run ends
  // either when lives run out OR when END AFTER MONTHS in-game days have
  // elapsed (each in-game day = one calendar month for the season system).
  // Each 12-day cycle wraps to a new in-game year, which resets per-branch
  // season bookkeeping so the tree can shed/grow leaves again next pass.
  if(gameState === 'PLAYING' && !gameOver && sloth && sloth.alive){
    if(dayAuto) gameDaysElapsed += (dt * P.dayPace) / DAY_CYCLE_S;
    const yearMark = Math.floor(gameDaysElapsed / GAME_DAYS_TOTAL);
    if(yearMark > _lastYearMark){
      _lastYearMark = yearMark;
      _onNewYear();
    }
    // Survival win — reach the configured month count.
    if(P.endMonths > 0 && gameDaysElapsed >= P.endMonths){
      _endGame(true);
    }
  }
  // Game-over → either prompt for name or show end screen
  _checkPostGameTransition();

  // Hunger decay (half-rate when sleeping). At 0 → starvation.
  if(sloth && sloth.alive && !gameOver){
    if(sloth.state !== 'STARVING'){
      const baseDecay = sloth.state === 'SLEEPING' ? HUNGER_DECAY_ASLEEP : HUNGER_DECAY_AWAKE;
      const decay = baseDecay * P.hungerPace;
      hunger = Math.max(0, hunger - decay * dt);
      if(hunger <= 0 && sloth.state !== 'FALLING'){
        sloth.startStarve();
      }
    }
  }
  // Sleep gate — summer + low hunger keeps the sloth alert.
  // In summer (months 6-8 = Jul-Sep) the sloth refuses to fall asleep
  // when hunger is at or below 10% so the player isn't trapped into a
  // starvation death by idle timeout. If already sleeping, wake up.
  const isSummerHungry = (() => {
    if(!sloth) return false;
    if(hunger > 0.10) return false;
    if(!seasonsMode) return false;
    return getSeasonInfo(seasonTime).name === 'SUMMER';
  })();
  if(sloth && userIdleT > 3 && sloth.state === 'HANGING' && !isSummerHungry){
    sloth.state = 'SLEEPING';
    sloth.snoreCycleT = 0;
    sloth.lastSnoreVol = 0;
  } else if(sloth && sloth.state === 'SLEEPING' && isSummerHungry){
    sloth.state = 'HANGING';
    Audio.setSnoreLevel(0);
  }

  // Seasons advance only when day cycle is auto. One in-game month
  // per real day-night cycle (so a full year = ~18 minutes real time).
  // The leaf-population update itself runs every frame so that when the
  // user drags the MONTH slider directly, leaves react immediately.
  if(seasonsMode){
    if(dayAuto){
      // Sync seasonTime to the 12-day game clock so seasons line up exactly:
      //   day 0..3   = SUMMER, 3..6 = AUTUMN, 6..9 = WINTER, 9..12 = SPRING.
      // While idle (no game running) it still advances at the natural rate.
      if(gameState === 'PLAYING' && !gameOver){
        seasonTime = ((3/12 + gameDaysElapsed / GAME_DAYS_TOTAL) % 1 + 1) % 1;
      } else {
        seasonTime = ((seasonTime + (dt * P.dayPace) / DAY_CYCLE_S / 12) % 1 + 1) % 1;
      }
      P.month = seasonTime * 12;
      const sM = document.getElementById('s-month');
      const vM = document.getElementById('v-month');
      if(sM){ sM.value = P.month.toFixed(2); }
      if(vM){ vM.textContent = monthFmt(P.month); }
    }
    _updateSeasonLeaves(dt);
    _updateSeasonApples(dt);
  }

  // Day/night cycle — auto-advance, sync slider when in auto mode
  if(dayAuto){
    dayTime = ((dayTime + (dt * P.dayPace)/DAY_CYCLE_S) % 1 + 1) % 1;
    P.time = dayTime;
    const sT = document.getElementById('s-time');
    const vT = document.getElementById('v-time');
    if(sT){ sT.value = dayTime.toFixed(3); }
    if(vT){ vT.textContent = dayTime.toFixed(2); }
  }
  // Rain
  updateRain(dt);
  updateLightning(dt);

  // Animate clouds: constant drift + a gentle wind nudge, wrap around screen.
  for(const c of clouds){
    const windNudge = Wind.sample(0.4) * 18;
    c.x += (c.vx + windNudge) * dt;
    const margin = c.rx * 1.6;
    if(c.x - margin > W) c.x = -margin;
    if(c.x + margin < 0) c.x = W + margin;
  }

  // Trunk bends with wind (very stiff spring). Angle propagates to children.
  trunkSpring.step(Wind.sample(TRUNK_WIND_MULT), dt);
  trunkAngle      = trunkSpring.x;
  trunkTopXSway   = trunkBX + Math.sin(trunkAngle)*trunkLen;
  trunkTopYSway   = trunkBY - Math.cos(trunkAngle)*trunkLen;

  // Update tree physics with swayed trunk top + inherited trunk angle
  for(const r of roots) r.update(trunkTopXSway, trunkTopYSway, trunkAngle, 0, dt);

  // Spawn sloth after first physics tick
  if(slothPending && slothMode && roots.length){
    spawnSloth();
    slothPending=false;
  }
  if(sloth) sloth.update(dt);

  // Fruits + falling-leaves entities
  if(fruitsMode){
    for(const f of fruits) f.update(dt);
    fruits = fruits.filter(f => f.alive !== false);
    fruits = fruits.filter(f=>f.alive);
    spawnFallingLeavesIfWindy(dt);
    for(const l of fallingLeaves) l.update(dt);
    fallingLeaves = fallingLeaves.filter(l=>l.alive);
  }

  // Wind streak particles
  for(const p of particles){
    p.x += p.spd*Wind.str*4.5*dt;
    if(p.x>W+110) Object.assign(p,mkParticle(false));
  }

  // Apply pan friction when not actively dragging
  if(!isPanning){
    sceneOffsetX += panVelX * dt;
    panVelX *= Math.pow(PAN_FRICTION, dt * 60);
    if(Math.abs(panVelX) < 1) panVelX = 0;
    // Soft clamp at the edges of pan range (rubber-band)
    if(sceneOffsetX > PAN_RANGE){
      sceneOffsetX += (PAN_RANGE - sceneOffsetX) * Math.min(dt * 6, 1);
      panVelX = 0;
    } else if(sceneOffsetX < -PAN_RANGE){
      sceneOffsetX += (-PAN_RANGE - sceneOffsetX) * Math.min(dt * 6, 1);
      panVelX = 0;
    }
  }

  // Draw scene
  ctx.clearRect(0,0,W,H);
  ctx.save();
  ctx.translate(sceneOffsetX, 0);
  drawBg();
  drawParticles();
  drawTrunk();
  drawGrass();
  for(const r of roots) r.draw();
  if(fruitsMode){
    for(const f of fruits) f.draw();
    for(const l of fallingLeaves) l.draw();
  }
  if(sloth) sloth.draw();
  // Score popups float above the world, but inside the camera transform
  updateScorePopups(dt);
  drawScorePopups();
  // Rain stays inside the world transform so drops are aligned with it
  drawRain();
  // Lightning bolt is also world-space (struck point on the tree)
  drawLightning();
  ctx.restore();

  // Night + rain darkening overlay (before pixel post-process)
  const brightness = getSceneBrightness(dayTime);
  // Rain dims the scene: light rain ~0.85, heavy rain ~0.55
  const rainDim = 1 - rainIntensity * 0.45;
  const totalDim = brightness * rainDim;
  if(totalDim < 0.999){
    // Tint shifts cooler/bluer when it's raining, more navy at night
    const mix = rainIntensity * 0.6;
    const tintR = Math.round(8 + mix * 30);
    const tintG = Math.round(10 + mix * 40);
    const tintB = Math.round(30 + mix * 30);
    ctx.fillStyle = `rgba(${tintR},${tintG},${tintB},${(1 - totalDim) * 0.85})`;
    ctx.fillRect(0, 0, W, H);
  }
  // Season scene tints (summer golden wash, autumn warm wash, winter
  // white/blue wash).
  if(seasonsMode){
    const sInfo = getSeasonInfo(seasonTime);
    // Summer — instead of a flat overlay (which would flatten contrast),
    // use a soft-light blend with a warm orange color. Soft-light keeps
    // bright pixels bright and dark pixels dark, but pushes the whole
    // image toward the overlay's hue and saturation. So summer scenes
    // look more vivid + warmer without losing contrast or definition.
    if(sInfo.summerTint > 0){
      const blendStrength = sInfo.summerTint * 0.45;
      ctx.save();
      ctx.globalCompositeOperation = 'soft-light';
      // Warm orange-amber. Slightly desaturated so the blend doesn't
      // crush bright colors into solid orange.
      ctx.fillStyle = `rgba(255, 150, 60, ${blendStrength})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      const sun = getSunPos(dayTime);
      if(sun.opacity > 0){
        const rayAlpha = sInfo.summerTint * sun.opacity * 0.55;
        // Fewer rays so each one reads more clearly and the canopy
        // doesn't get washed out.
        const rayCount = 12;
        // Sun disc radius (matches drawSunMoon's sR=32). Rays fade out
        // at ~6× this — long enough to read as a sun-burst.
        const sR = 32;
        const rayLen = sR * 6;
        // Visible rotation: full revolution every ~25 seconds so the
        // shimmer is noticeable without looking spinny.
        const rot = (performance.now() * 0.00025) % (PI * 2);
        // Half-angle of each bright ray wedge (radians).
        const halfAng = (PI * 2 / rayCount) * 0.30;

        ctx.save();
        ctx.translate(sun.x, sun.y);
        ctx.rotate(rot);
        // Per-ray gradient: bright at the sun edge, soft at the tip.
        for(let i = 0; i < rayCount; i++){
          const a = (i / rayCount) * PI * 2;
          const grad = ctx.createRadialGradient(0, 0, sR * 0.7, 0, 0, rayLen);
          grad.addColorStop(0,    `rgba(255, 240, 170, ${rayAlpha})`);
          grad.addColorStop(0.55, `rgba(255, 225, 130, ${rayAlpha * 0.45})`);
          grad.addColorStop(1,    'rgba(255, 220, 110, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a - halfAng) * rayLen, Math.sin(a - halfAng) * rayLen);
          ctx.lineTo(Math.cos(a + halfAng) * rayLen, Math.sin(a + halfAng) * rayLen);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
    }
    if(sInfo.autumnTint > 0 && sInfo.winterness < 1){
      // Warm yellow/orange wash — strongest at autumn peak (day ~4.5).
      // Strength curve: peaks 0.28 alpha at the deepest autumn moment.
      const strength = sInfo.autumnTint * (1 - sInfo.winterness) * 0.28;
      ctx.fillStyle = `rgba(225, 145, 40, ${strength})`;
      ctx.fillRect(0, 0, W, H);
    }
    if(sInfo.winterness > 0){
      // Cool white-blue wash + slight desaturation. Two passes:
      //   1) bluish overlay
      //   2) white-fog overlay near the ground
      const wn = sInfo.winterness;
      ctx.fillStyle = `rgba(190, 215, 240, ${wn * 0.30})`;
      ctx.fillRect(0, 0, W, H);
      // Brighter, foggier band along the lower half so the ground reads
      // snowy rather than just tinted.
      const fogGrad = ctx.createLinearGradient(0, trunkBY*0.4, 0, H);
      fogGrad.addColorStop(0, `rgba(235, 242, 250, 0)`);
      fogGrad.addColorStop(1, `rgba(235, 242, 250, ${wn * 0.42})`);
      ctx.fillStyle = fogGrad;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // Pixel post-process AFTER everything is drawn
  if(pixelMode) applyPixelMode();

  // Lightning whiteout flash — drawn AFTER pixel mode so it stays sharp
  drawLightningFlash();

  // UI overlays drawn AFTER pixel mode so they stay crisp.
  // The reach marker uses world coords (target on a branch), so it
  // needs the camera offset re-applied. The HUD bars stay screen-space.
  if(sloth){
    ctx.save();
    ctx.translate(sceneOffsetX, 0);
    sloth.drawReachOverlay();
    ctx.restore();
  }
  drawFoodIcon();
  drawHungerBar();
  drawClock();
  drawSurvivalBar();
  drawScoreHUD();
  drawLivesHUD();
  drawGameOverHUD();

  wfill.style.width=(Wind.str*100).toFixed(0)+'%';
  // PAUSED overlay — drawn last so it sits over all canvas content.
  if(paused){
    ctx.save();
    // Soft dimming
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, W, H);
    // Centered "PAUSED" + hint
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cx = W * 0.5, cy = H * 0.5;
    ctx.font = 'bold 56px "Courier New", monospace';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.strokeText('PAUSED', cx, cy - 16);
    ctx.fillStyle = '#FFE678';
    ctx.fillText('PAUSED', cx, cy - 16);
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.strokeText('Press Space or tap the clock to resume', cx, cy + 28);
    ctx.fillStyle = 'rgba(220, 235, 255, 0.95)';
    ctx.fillText('Press Space or tap the clock to resume', cx, cy + 28);
    ctx.restore();
  }
  requestAnimationFrame(frame);
}

init();
applyPixel();   // ensure scanline state matches initial pixelMode
applySloth();
applySound();   // sound starts OFF — needs user gesture to enable
applyFruits(); // fruits ON by default
// Apply the 11.5-month sleep-starvation calibration once on load so the
// game starts with the realistic sloth-metabolism setting (≈0.23x at
// default dayPace=1). Done here so all referenced constants (DAY_CYCLE_S
// in particular) and DOM elements are fully initialized.
calibrateHungerFor11_5Months();
requestAnimationFrame(frame);
