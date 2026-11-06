(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AkumoScanner = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const NATIVE_FORMATS = ['ean_13', 'ean_8', 'code_128', 'upc_a', 'code_39', 'qr_code'];
  const REQUIRED_1D = ['ean_13', 'ean_8', 'code_128'];

  function createScannerController(options) {
    const opts = options || {};
    const video = opts.video;
    const statusEl = opts.statusEl;
    const modal = opts.modal;
    const loadZXing = opts.loadZXing;
    const getUserMedia =
      opts.getUserMedia ||
      (typeof navigator !== 'undefined' && navigator.mediaDevices
        ? navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
        : null);
    const BarcodeDetectorCtor =
      opts.BarcodeDetector ||
      (typeof globalThis !== 'undefined' ? globalThis.BarcodeDetector : undefined);
    const isSecureContext =
      typeof opts.isSecureContext === 'boolean'
        ? opts.isSecureContext
        : typeof window !== 'undefined'
          ? window.isSecureContext
          : false;
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
        current.getTracks().forEach((track) => {
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
        video.srcObject = null;
      }
    }

    function stop() {
      active = false;
      bumpGeneration();
      stopTracks();
    }

    function close() {
      stop();
      if (modal) modal.hidden = true;
      if (typeof document !== 'undefined') document.body.classList.remove('scan-open');
    }

    function acceptRaw(raw, gen) {
      if (!active || gen !== generation) return false;
      const code = String(raw == null ? '' : raw);
      // Keep leading zeros; only trim whitespace edges.
      const trimmed = code.replace(/^\s+|\s+$/g, '');
      if (!trimmed) return false;
      const now = Date.now();
      if (trimmed === lastRaw && now - lastAt < duplicateWindowMs) return false;
      lastRaw = trimmed;
      lastAt = now;
      active = false;
      const closedGen = bumpGeneration();
      stopTracks();
      if (modal) modal.hidden = true;
      if (typeof document !== 'undefined') document.body.classList.remove('scan-open');
      onDetected(trimmed, { generation: closedGen });
      return true;
    }

    async function nativeSupports1D() {
      if (typeof BarcodeDetectorCtor !== 'function') return false;
      if (typeof BarcodeDetectorCtor.getSupportedFormats !== 'function') {
        // Without format introspection, do not trust native alone for warehouse 1D codes.
        return false;
      }
      try {
        const formats = await BarcodeDetectorCtor.getSupportedFormats();
        const set = new Set((formats || []).map((f) => String(f).toLowerCase()));
        return REQUIRED_1D.every((f) => set.has(f));
      } catch (_) {
        return false;
      }
    }

    async function startNative(gen) {
      const detector = new BarcodeDetectorCtor({ formats: NATIVE_FORMATS });
      setStatus('Namiř na čárový kód…');
      const loopId = detectLoopToken;
      const tick = async () => {
        if (!active || gen !== generation || loopId !== detectLoopToken) return;
        try {
          if (video && video.readyState >= 2) {
            const codes = await detector.detect(video);
            if (!active || gen !== generation) return;
            if (codes && codes.length) {
              const raw = codes[0].rawValue;
              if (acceptRaw(raw, gen)) return;
            }
          }
        } catch (_) {
          /* transient detect errors */
        }
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
      const callback = (result) => {
        if (!active || gen !== generation) return;
        if (result && typeof result.getText === 'function') {
          acceptRaw(result.getText(), gen);
        }
      };
      let controls;
      if (stream && typeof zxingReader.decodeFromStream === 'function') {
        controls = await zxingReader.decodeFromStream(stream, video, callback);
      } else {
        controls = await zxingReader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          video,
          callback
        );
        stream = (video && video.srcObject) || stream;
      }
      if (!active || gen !== generation) {
        try {
          controls && controls.stop && controls.stop();
        } catch (_) {}
        stopTracks();
        return;
      }
      zxingControls = controls;
    }

    async function openAndStart() {
      if (modal) modal.hidden = false;
      if (typeof document !== 'undefined') document.body.classList.add('scan-open');
      stop();
      const gen = generation;
      active = true;
      setStatus('Připravuji fotoaparát…');

      if (!isSecureContext || !getUserMedia) {
        setStatus('Kamera vyžaduje HTTPS a podporu fotoaparátu. Zadej kód ručně.', true);
        active = false;
        return { ok: false, reason: 'insecure-or-unsupported' };
      }

      try {
        // Request camera only after explicit user gesture (this function).
        stream = await getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (!active || gen !== generation) {
          stopTracks();
          return { ok: false, reason: 'cancelled' };
        }
        if (video) {
          video.setAttribute('playsinline', 'true');
          video.setAttribute('muted', 'true');
          video.muted = true;
          video.playsInline = true;
          video.srcObject = stream;
          try {
            const playResult = video.play();
            if (playResult && typeof playResult.then === 'function') await playResult;
          } catch (_) {}
        }

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
      } catch (err) {
        if (!active || gen !== generation) return { ok: false, reason: 'cancelled' };
        const name = (err && err.name) || '';
        let message = 'Kameru se nepodařilo spustit. Zkus to znovu nebo zadej kód ručně.';
        let reason = 'error';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          message = 'Přístup ke kameře byl zamítnut. Povol kameru v nastavení prohlížeče, nebo kód napiš.';
          reason = 'permission';
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          message = 'Fotoaparát nebyl nalezen. Zadej kód ručně nebo použij klávesnicovou čtečku.';
          reason = 'no-camera';
        } else if (name === 'NotReadableError' || name === 'TrackStartError') {
          message = 'Kamera je obsazená jinou aplikací. Zavři ji a zkus znovu.';
          reason = 'busy';
        }
        setStatus(message, true);
        active = false;
        stopTracks();
        return { ok: false, reason, error: err };
      }
    }

    return {
      openAndStart,
      stop,
      close,
      acceptRawForTest: acceptRaw,
      isActive: () => active,
      getGeneration: () => generation,
      _test: {
        nativeSupports1D,
        stopTracks,
        setLast: (raw, at) => {
          lastRaw = raw;
          lastAt = at;
        },
      },
    };
  }

  function createZXingLoader(scriptUrl, doc) {
    let promise = null;
    return function loadZXing() {
      if (typeof globalThis !== 'undefined' && globalThis.ZXingBrowser && globalThis.ZXingBrowser.BrowserMultiFormatReader) {
        return Promise.resolve(globalThis.ZXingBrowser);
      }
      if (promise) return promise;
      const documentRef = doc || (typeof document !== 'undefined' ? document : null);
      promise = new Promise((resolve, reject) => {
        if (!documentRef) {
          reject(new Error('Document unavailable'));
          return;
        }
        const script = documentRef.createElement('script');
        script.src = scriptUrl;
        script.async = true;
        script.onload = () => {
          if (globalThis.ZXingBrowser && globalThis.ZXingBrowser.BrowserMultiFormatReader) {
            resolve(globalThis.ZXingBrowser);
          } else {
            promise = null;
            reject(new Error('ZXing se nenačetl'));
          }
        };
        script.onerror = () => {
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
    createScannerController,
    createZXingLoader,
    NATIVE_FORMATS,
    REQUIRED_1D,
  };
});
