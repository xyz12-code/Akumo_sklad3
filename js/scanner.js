(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AkumoScanner = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const NATIVE_FORMATS = ['ean_13', 'ean_8', 'code_128', 'upc_a', 'code_39', 'qr_code'];
  const REQUIRED_1D = ['ean_13', 'ean_8', 'code_128'];

  const CAMERA_CONSTRAINTS = {
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  };

  function resolveGetUserMedia(override) {
    if (typeof override === 'function') return override;
    if (typeof navigator === 'undefined') return null;
    if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
      return navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    }
    const legacy =
      navigator.getUserMedia ||
      navigator.webkitGetUserMedia ||
      navigator.mozGetUserMedia ||
      null;
    if (!legacy) return null;
    return function legacyGum(constraints) {
      return new Promise(function (resolve, reject) {
        legacy.call(navigator, constraints, resolve, reject);
      });
    };
  }

  function resolveSecureContext(override) {
    if (typeof override === 'boolean') return override;
    if (typeof window !== 'undefined') return !!window.isSecureContext;
    return false;
  }

  function createScannerController(options) {
    const opts = options || {};
    const video = opts.video;
    const statusEl = opts.statusEl;
    const modal = opts.modal;
    const loadZXing = opts.loadZXing;
    const getUserMediaOverride = opts.getUserMedia;
    const BarcodeDetectorCtor =
      opts.BarcodeDetector ||
      (typeof globalThis !== 'undefined' ? globalThis.BarcodeDetector : undefined);
    const onDetected = opts.onDetected || function () {};
    const duplicateWindowMs = opts.duplicateWindowMs || 1600;

    let generation = 0;
    let active = false;
    let stream = null;
    let nativeTimer = null;
    let zxingControls = null;
    let zxingReader = null;
    let lastRaw = '';
    let lastAt = 0;
    let detectLoopToken = 0;

    function setStatus(text, isError) {
      if (!statusEl) return;
      statusEl.textContent = text;
      statusEl.classList.toggle('is-error', !!isError);
    }

    function bumpGeneration() {
      generation += 1;
      detectLoopToken += 1;
      return generation;
    }

    function stopTracks() {
      if (nativeTimer) {
        clearTimeout(nativeTimer);
        nativeTimer = null;
      }
      detectLoopToken += 1;
      try {
        if (zxingControls && typeof zxingControls.stop === 'function') zxingControls.stop();
      } catch (_) {}
      zxingControls = null;
      try {
        if (zxingReader && typeof zxingReader.reset === 'function') zxingReader.reset();
      } catch (_) {}
      zxingReader = null;
      const current = stream || (video && video.srcObject);
      if (current && current.getTracks) {
        current.getTracks().forEach(function (track) {
          try {
            track.stop();
          } catch (_) {}
        });
      }
      stream = null;
      if (video) {
        try {
          video.pause();
        } catch (_) {}
        try {
          video.srcObject = null;
        } catch (_) {}
      }
    }

    function stop() {
      active = false;
      bumpGeneration();
      stopTracks();
    }

    function hideModal() {
      if (!modal) return;
      try {
        if (typeof modal.close === 'function' && modal.open) modal.close();
      } catch (_) {}
      modal.hidden = true;
      try {
        modal.removeAttribute('open');
      } catch (_) {}
    }

    function showModalSafe() {
      if (!modal) return;
      modal.hidden = false;
      // Optional <dialog>: never throw before getUserMedia.
      try {
        if (typeof modal.showModal === 'function') {
          if (!modal.open) modal.showModal();
        } else if (typeof modal.show === 'function' && !modal.open) {
          modal.show();
        } else {
          modal.setAttribute('open', '');
        }
      } catch (_) {
        modal.hidden = false;
      }
    }

    function close() {
      stop();
      hideModal();
      if (typeof document !== 'undefined') document.body.classList.remove('scan-open');
    }

    function acceptRaw(raw, gen) {
      if (!active || gen !== generation) return false;
      const code = String(raw == null ? '' : raw);
      const trimmed = code.replace(/^\s+|\s+$/g, '');
      if (!trimmed) return false;
      const now = Date.now();
      if (trimmed === lastRaw && now - lastAt < duplicateWindowMs) return false;
      lastRaw = trimmed;
      lastAt = now;
      active = false;
      const closedGen = bumpGeneration();
      stopTracks();
      hideModal();
      if (typeof document !== 'undefined') document.body.classList.remove('scan-open');
      onDetected(trimmed, { generation: closedGen });
      return true;
    }

    async function nativeSupports1D() {
      if (typeof BarcodeDetectorCtor !== 'function') return false;
      if (typeof BarcodeDetectorCtor.getSupportedFormats !== 'function') return false;
      try {
        const formats = await BarcodeDetectorCtor.getSupportedFormats();
        const set = new Set((formats || []).map(function (f) {
          return String(f).toLowerCase();
        }));
        return REQUIRED_1D.every(function (f) {
          return set.has(f);
        });
      } catch (_) {
        return false;
      }
    }

    async function startNative(gen) {
      const detector = new BarcodeDetectorCtor({ formats: NATIVE_FORMATS });
      setStatus('Namiř na čárový kód…');
      const loopId = detectLoopToken;
      const tick = async function () {
        if (!active || gen !== generation || loopId !== detectLoopToken) return;
        try {
          if (video && video.readyState >= 2) {
            const codes = await detector.detect(video);
            if (!active || gen !== generation) return;
            if (codes && codes.length) {
              if (acceptRaw(codes[0].rawValue, gen)) return;
            }
          }
        } catch (_) {}
        if (!active || gen !== generation || loopId !== detectLoopToken) return;
        nativeTimer = setTimeout(tick, 180);
      };
      nativeTimer = setTimeout(tick, 120);
    }

    async function startZXing(gen) {
      setStatus('Načítám čtečku…');
      const api = await loadZXing();
      if (!active || gen !== generation) return;
      if (!api || !api.BrowserMultiFormatReader) {
        throw new Error('Čtečka není dostupná');
      }
      zxingReader = new api.BrowserMultiFormatReader();
      setStatus('Namiř na čárový kód…');
      const callback = function (result) {
        if (!active || gen !== generation) return;
        if (result && typeof result.getText === 'function') {
          acceptRaw(result.getText(), gen);
        }
      };
      let controls;
      if (stream && typeof zxingReader.decodeFromStream === 'function') {
        controls = await zxingReader.decodeFromStream(stream, video, callback);
      } else {
        controls = await zxingReader.decodeFromConstraints(CAMERA_CONSTRAINTS, video, callback);
        stream = (video && video.srcObject) || stream;
      }
      if (!active || gen !== generation) {
        try {
          if (controls && controls.stop) controls.stop();
        } catch (_) {}
        stopTracks();
        return;
      }
      zxingControls = controls;
    }

    async function attachAndDecode(gen, mediaStream) {
      stream = mediaStream;
      if (video) {
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.setAttribute('muted', 'true');
        video.muted = true;
        video.defaultMuted = true;
        video.playsInline = true;
        video.srcObject = mediaStream;
        try {
          const playResult = video.play();
          if (playResult && typeof playResult.then === 'function') {
            await playResult.catch(function () {});
          }
        } catch (_) {}
      }

      // Engine choice ONLY after camera is already running (Safari has no BarcodeDetector).
      const useNative = await nativeSupports1D();
      if (!active || gen !== generation) {
        stopTracks();
        return { ok: false, reason: 'cancelled' };
      }
      if (useNative) {
        await startNative(gen);
        return { ok: true, engine: 'native' };
      }
      await startZXing(gen);
      if (!active || gen !== generation) return { ok: false, reason: 'cancelled' };
      return { ok: true, engine: 'zxing' };
    }

    function permissionMessage(err) {
      const name = (err && err.name) || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        return {
          reason: 'permission',
          message:
            'Kamera je blokovaná v prohlížeči. V nastavení Safari/stránky povol kameru pro tento web, nebo kód napiš ručně.',
        };
      }
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        return {
          reason: 'no-camera',
          message: 'Fotoaparát nebyl nalezen. Zadej kód ručně nebo použij klávesnicovou čtečku.',
        };
      }
      if (name === 'NotReadableError' || name === 'TrackStartError') {
        return {
          reason: 'busy',
          message: 'Kamera je obsazená jinou aplikací. Zavři ji a zkus znovu.',
        };
      }
      if (name === 'SecurityError') {
        return {
          reason: 'insecure-or-unsupported',
          message: 'Kamera vyžaduje zabezpečený web (HTTPS). Zadej kód ručně.',
        };
      }
      return {
        reason: 'error',
        message:
          'Kameru se nepodařilo spustit' +
          (name ? ' (' + name + ')' : '') +
          '. Zkus Znovu, nebo kód napiš ručně.',
      };
    }

    /**
     * MUST run synchronously inside a click/tap handler.
     * Invokes getUserMedia immediately — no await before this call —
     * so Safari keeps transient user activation for the permission prompt.
     */
    function primeFromGesture() {
      showModalSafe();
      if (typeof document !== 'undefined') document.body.classList.add('scan-open');

      // Cancel any prior session without awaiting.
      active = false;
      bumpGeneration();
      stopTracks();

      const gen = generation;
      active = true;
      setStatus('Žádám o přístup ke kameře…');

      const secure = resolveSecureContext(opts.isSecureContext);
      const gum = resolveGetUserMedia(getUserMediaOverride);

      if (!secure || !gum) {
        setStatus('Kamera vyžaduje HTTPS a podporu fotoaparátu. Zadej kód ručně.', true);
        active = false;
        return {
          ok: false,
          reason: 'insecure-or-unsupported',
          generation: gen,
          streamPromise: null,
        };
      }

      // CRITICAL: invoke getUserMedia in this synchronous turn (user gesture).
      let streamPromise;
      try {
        streamPromise = gum(CAMERA_CONSTRAINTS);
      } catch (err) {
        const info = permissionMessage(err);
        setStatus(info.message, true);
        active = false;
        stopTracks();
        return { ok: false, reason: info.reason, generation: gen, streamPromise: null, error: err };
      }

      if (!streamPromise || typeof streamPromise.then !== 'function') {
        setStatus('Tento prohlížeč nepodporuje kameru. Zadej kód ručně.', true);
        active = false;
        return { ok: false, reason: 'insecure-or-unsupported', generation: gen, streamPromise: null };
      }

      return { ok: true, generation: gen, streamPromise: streamPromise };
    }

    async function continueAfterPrime(prime) {
      if (!prime || !prime.ok || !prime.streamPromise) {
        return { ok: false, reason: (prime && prime.reason) || 'error' };
      }
      const gen = prime.generation;
      try {
        const mediaStream = await prime.streamPromise;
        if (!active || gen !== generation) {
          if (mediaStream && mediaStream.getTracks) {
            mediaStream.getTracks().forEach(function (t) {
              try {
                t.stop();
              } catch (_) {}
            });
          }
          return { ok: false, reason: 'cancelled' };
        }
        setStatus('Připojuji kameru…');
        return await attachAndDecode(gen, mediaStream);
      } catch (err) {
        if (!active || gen !== generation) return { ok: false, reason: 'cancelled' };
        const info = permissionMessage(err);
        setStatus(info.message, true);
        active = false;
        stopTracks();
        return { ok: false, reason: info.reason, error: err };
      }
    }

    /** Convenience used by tests / retry: prime sync then continue. */
    function openAndStart() {
      const prime = primeFromGesture();
      return continueAfterPrime(prime);
    }

    return {
      primeFromGesture,
      continueAfterPrime,
      openAndStart,
      stop,
      close,
      acceptRawForTest: acceptRaw,
      isActive: function () {
        return active;
      },
      getGeneration: function () {
        return generation;
      },
      _test: {
        nativeSupports1D: nativeSupports1D,
        stopTracks: stopTracks,
        resolveGetUserMedia: resolveGetUserMedia,
        CAMERA_CONSTRAINTS: CAMERA_CONSTRAINTS,
        setLast: function (raw, at) {
          lastRaw = raw;
          lastAt = at;
        },
      },
    };
  }

  function createZXingLoader(scriptUrl, doc) {
    let promise = null;
    return function loadZXing() {
      if (
        typeof globalThis !== 'undefined' &&
        globalThis.ZXingBrowser &&
        globalThis.ZXingBrowser.BrowserMultiFormatReader
      ) {
        return Promise.resolve(globalThis.ZXingBrowser);
      }
      if (promise) return promise;
      const documentRef = doc || (typeof document !== 'undefined' ? document : null);
      promise = new Promise(function (resolve, reject) {
        if (!documentRef) {
          reject(new Error('Document unavailable'));
          return;
        }
        const script = documentRef.createElement('script');
        script.src = scriptUrl;
        script.async = true;
        script.onload = function () {
          if (globalThis.ZXingBrowser && globalThis.ZXingBrowser.BrowserMultiFormatReader) {
            resolve(globalThis.ZXingBrowser);
          } else {
            promise = null;
            reject(new Error('ZXing se nenačetl'));
          }
        };
        script.onerror = function () {
          promise = null;
          script.remove();
          reject(new Error('ZXing soubor se nepodařilo načíst'));
        };
        documentRef.head.appendChild(script);
      });
      return promise;
    };
  }

  return {
    createScannerController: createScannerController,
    createZXingLoader: createZXingLoader,
    resolveGetUserMedia: resolveGetUserMedia,
    NATIVE_FORMATS: NATIVE_FORMATS,
    REQUIRED_1D: REQUIRED_1D,
    CAMERA_CONSTRAINTS: CAMERA_CONSTRAINTS,
  };
});
