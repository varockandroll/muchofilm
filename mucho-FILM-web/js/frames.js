/**
 * mucho FILM — Motor de Bordes Analógicos, Light Leaks, Desgastado y Ruido Sucio Reales (Analog Film Pack)
 * Recursos integrados desde RECURSOS/Analog Film:
 * - 15 Bordes Analógicos Reales (PNG/1.png .. PNG/15.png)
 * - 12 Light Leaks Reales (BONUS TEXTURE/light leaks/light-leak-01.png .. 12.png)
 * - 6 Filtros de Desgastado y Líneas (BONUS TEXTURE/lines texture/noise-line-01..03.png y _black.jpg)
 * - 10 Filtros de Ruido Sucio (BONUS TEXTURE/noise-tex/noise-tex-01.png .. 10.png)
 */

window.FrameRenderer = (function () {
  'use strict';

  // Catálogo descriptivo de los 15 Bordes Analógicos (PNG/1.png .. 15.png)
  const BORDER_CATALOG = {
    border_1:  { id: 'border_1',  num: 1,  name: 'Borde 01 · Fino Clásico',     file: 'assets/analog-film/PNG/1.png',  win: { x: 0.008, y: 0.008, w: 0.984, h: 0.984 }, nativeAspect: 3152 / 4650 },
    border_2:  { id: 'border_2',  num: 2,  name: 'Borde 02 · Cuarto Oscuro',    file: 'assets/analog-film/PNG/2.png',  win: { x: 0.048, y: 0.035, w: 0.900, h: 0.930 }, nativeAspect: 3072 / 5504 },
    border_3:  { id: 'border_3',  num: 3,  name: 'Borde 03 · Papel Crema',      file: 'assets/analog-film/PNG/3.png',  win: { x: 0.045, y: 0.038, w: 0.900, h: 0.915 }, nativeAspect: 3584 / 4800 },
    border_4:  { id: 'border_4',  num: 4,  name: 'Borde 04 · Crema Sombra',     file: 'assets/analog-film/PNG/4.png',  win: { x: 0.032, y: 0.025, w: 0.940, h: 0.955 }, nativeAspect: 3584 / 4800 },
    border_5:  { id: 'border_5',  num: 5,  name: 'Borde 05 · Doble 6×7',        file: 'assets/analog-film/PNG/5.png',  win: { x: 0.095, y: 0.012, w: 0.820, h: 0.976 }, multiWins: [
      { x: 0.095, y: 0.036, w: 0.822, h: 0.448 },
      { x: 0.095, y: 0.533, w: 0.822, h: 0.448 }
    ], nativeAspect: 3584 / 4800 },
    border_6:  { id: 'border_6',  num: 6,  name: 'Borde 06 · Tira 4 Fotos',     file: 'assets/analog-film/PNG/6.png',  win: { x: 0.285, y: 0.110, w: 0.428, h: 0.780 }, multiWins: [
      { x: 0.285, y: 0.111, w: 0.428, h: 0.188 },
      { x: 0.285, y: 0.305, w: 0.428, h: 0.189 },
      { x: 0.285, y: 0.503, w: 0.428, h: 0.189 },
      { x: 0.285, y: 0.701, w: 0.428, h: 0.188 }
    ], nativeAspect: 1538 / 4350 },
    border_7:  { id: 'border_7',  num: 7,  name: 'Borde 07 · Línea Fina',       file: 'assets/analog-film/PNG/7.png',  win: { x: 0.020, y: 0.006, w: 0.955, h: 0.980 }, nativeAspect: 3015 / 4096 },
    border_8:  { id: 'border_8',  num: 8,  name: 'Borde 08 · Vintage Crema',    file: 'assets/analog-film/PNG/8.png',  win: { x: 0.025, y: 0.045, w: 0.946, h: 0.912 }, nativeAspect: 3015 / 4096 },
    border_9:  { id: 'border_9',  num: 9,  name: 'Borde 09 · Borde Quemado',    file: 'assets/analog-film/PNG/9.png',  win: { x: 0.006, y: 0.006, w: 0.982, h: 0.980 }, nativeAspect: 3015 / 4096 },
    border_10: { id: 'border_10', num: 10, name: 'Borde 10 · Horizontal 35mm',  file: 'assets/analog-film/PNG/10.png', win: { x: 0.026, y: 0.036, w: 0.948, h: 0.914 }, nativeAspect: 9906 / 6343 },
    border_11: { id: 'border_11', num: 11, name: 'Borde 11 · Placa 4×5',        file: 'assets/analog-film/PNG/11.png', win: { x: 0.012, y: 0.036, w: 0.974, h: 0.854 }, nativeAspect: 3341 / 4540 },
    border_12: { id: 'border_12', num: 12, name: 'Borde 12 · Marco Plata',      file: 'assets/analog-film/PNG/12.png', win: { x: 0.022, y: 0.010, w: 0.948, h: 0.968 }, nativeAspect: 3015 / 4096 },
    border_13: { id: 'border_13', num: 13, name: 'Borde 13 · Sombra Lateral',   file: 'assets/analog-film/PNG/13.png', win: { x: 0.028, y: 0.022, w: 0.930, h: 0.932 }, nativeAspect: 3015 / 4096 },
    border_14: { id: 'border_14', num: 14, name: 'Borde 14 · Bisel Óptico',     file: 'assets/analog-film/PNG/14.png', win: { x: 0.028, y: 0.018, w: 0.946, h: 0.964 }, nativeAspect: 3015 / 4096 },
    border_15: { id: 'border_15', num: 15, name: 'Borde 15 · Papel Lavado',     file: 'assets/analog-film/PNG/15.png', win: { x: 0.018, y: 0.010, w: 0.956, h: 0.952 }, nativeAspect: 3015 / 4096 }
  };

  // Catálogo de 12 Light Leaks (BONUS TEXTURE/light leaks/light-leak-01.png .. 12.png)
  const LIGHT_LEAK_CATALOG = {};
  for (let i = 1; i <= 12; i++) {
    const code = String(i).padStart(2, '0');
    const id = `leak_${code}`;
    LIGHT_LEAK_CATALOG[id] = {
      id,
      num: i,
      name: `Light Leak ${code}`,
      file: `assets/analog-film/BONUS TEXTURE/light leaks/light-leak-${code}.png`
    };
  }

  // Catálogo de 6 Filtros de Desgastado / Líneas (BONUS TEXTURE/lines texture/)
  const WEAR_CATALOG = {
    wear_01:       { id: 'wear_01',       num: 1, name: 'Desgastado 01 · Líneas Finas',   file: 'assets/analog-film/BONUS TEXTURE/lines texture/noise-line-01.png' },
    wear_02:       { id: 'wear_02',       num: 2, name: 'Desgastado 02 · Trama Escáner',  file: 'assets/analog-film/BONUS TEXTURE/lines texture/noise-line-02.png' },
    wear_03:       { id: 'wear_03',       num: 3, name: 'Desgastado 03 · Rayas Sutiles',  file: 'assets/analog-film/BONUS TEXTURE/lines texture/noise-line-03.png' },
    wear_01_black: { id: 'wear_01_black', num: 4, name: 'Desgastado 04 · Químico 01',     file: 'assets/analog-film/BONUS TEXTURE/lines texture/noise-line-01_black.jpg' },
    wear_02_black: { id: 'wear_02_black', num: 5, name: 'Desgastado 05 · Retícula 02',    file: 'assets/analog-film/BONUS TEXTURE/lines texture/noise-line-02_black.jpg' },
    wear_03_black: { id: 'wear_03_black', num: 6, name: 'Desgastado 06 · Emulsión 03',    file: 'assets/analog-film/BONUS TEXTURE/lines texture/noise-line-03_black.jpg' }
  };

  // Catálogo de 10 Filtros de Ruido Sucio (BONUS TEXTURE/noise-tex/noise-tex-01.png .. 10.png)
  const DIRTY_NOISE_CATALOG = {};
  for (let i = 1; i <= 10; i++) {
    const code = String(i).padStart(2, '0');
    const id = `dirty_${code}`;
    DIRTY_NOISE_CATALOG[id] = {
      id,
      num: i,
      name: `Ruido Sucio ${code}`,
      file: `assets/analog-film/BONUS TEXTURE/noise-tex/noise-tex-${code}.png`
    };
  }

  // Caché de imágenes predecodificadas en memoria (HTMLImageElement + versiones invertidas para modo oscuro)
  const imageCache = {
    borders: {},
    lightLeaks: {},
    wearTextures: {},
    dirtyNoise: {},
    invertedCache: {}
  };

  let onAssetLoadedCallback = null;

  function setOnAssetLoaded(cb) {
    onAssetLoadedCallback = cb;
  }

  function notifyAssetReady() {
    if (typeof onAssetLoadedCallback === 'function') {
      onAssetLoadedCallback();
    }
  }

  let assetsPreloaded = false;

  function preloadAllAssets() {
    if (assetsPreloaded) return;
    assetsPreloaded = true;
    const packed = window.ANALOG_FILM_ASSETS || {};

    // 1. Pre-cargar los 15 Bordes Analógicos
    Object.keys(BORDER_CATALOG).forEach(key => {
      const img = new Image();
      img.onload = notifyAssetReady;
      const dataUri = packed.borders && packed.borders[key];
      img.src = dataUri || BORDER_CATALOG[key].file;
      imageCache.borders[key] = img;
    });

    // 2. Pre-cargar los 12 Light Leaks
    Object.keys(LIGHT_LEAK_CATALOG).forEach(key => {
      const img = new Image();
      img.onload = notifyAssetReady;
      const dataUri = packed.lightLeaks && packed.lightLeaks[key];
      img.src = dataUri || LIGHT_LEAK_CATALOG[key].file;
      imageCache.lightLeaks[key] = img;
    });

    // 3. Pre-cargar los 6 Filtros de Desgastado
    Object.keys(WEAR_CATALOG).forEach(key => {
      const img = new Image();
      img.onload = notifyAssetReady;
      const dataUri = packed.wearTextures && packed.wearTextures[key];
      img.src = dataUri || WEAR_CATALOG[key].file;
      imageCache.wearTextures[key] = img;
    });

    // 4. Pre-cargar los 10 Filtros de Ruido Sucio
    Object.keys(DIRTY_NOISE_CATALOG).forEach(key => {
      const img = new Image();
      img.onload = notifyAssetReady;
      const dataUri = packed.dirtyNoise && packed.dirtyNoise[key];
      img.src = dataUri || DIRTY_NOISE_CATALOG[key].file;
      imageCache.dirtyNoise[key] = img;
    });
  }

  // El paquete de texturas (js/analog-assets.js, ~21 MB) se carga en segundo plano desde app.js
  // para que la interfaz arranque al instante. Si ya estuviera disponible, precargar en seguida.
  if (typeof window !== 'undefined' && window.ANALOG_FILM_ASSETS) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', preloadAllAssets);
    } else {
      preloadAllAssets();
    }
  }

  /**
   * Devuelve la imagen ya decodificada de un recurso (para miniaturas de la interfaz).
   * kind: 'borders' | 'lightLeaks' | 'wearTextures' | 'dirtyNoise'
   */
  function getAssetImage(kind, key) {
    const group = imageCache[kind];
    const img = group ? group[key] : null;
    return isImageReady(img) ? img : null;
  }

  function isImageReady(img) {
    return img && img.complete && (img.naturalWidth > 0 || img.width > 0);
  }

  function getInvertedCanvas(cacheKey, sourceImg) {
    if (imageCache.invertedCache[cacheKey]) {
      return imageCache.invertedCache[cacheKey];
    }
    const w = sourceImg.naturalWidth || sourceImg.width;
    const h = sourceImg.naturalHeight || sourceImg.height;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'difference';
    ctx.drawImage(sourceImg, 0, 0, w, h);
    imageCache.invertedCache[cacheKey] = c;
    return c;
  }

  function isBorderActive(frameType) {
    return Boolean(frameType && frameType !== 'none' && BORDER_CATALOG[frameType]);
  }

  // Compatibilidad con llamadas que pasan frameType (string) o settings (objeto completo)
  function isFrameActive(frameTypeOrSettings) {
    if (!frameTypeOrSettings) return false;
    if (typeof frameTypeOrSettings === 'string') {
      return isBorderActive(frameTypeOrSettings);
    }
    if (typeof frameTypeOrSettings === 'object') {
      return hasActiveOverlays(frameTypeOrSettings);
    }
    return false;
  }

  function hasActiveOverlays(settings) {
    if (!settings) return false;
    const hasBorder = settings.frameEnabled !== false && isBorderActive(settings.frameType);
    const hasLeak = settings.lightLeakEnabled !== false && settings.lightLeakType && settings.lightLeakType !== 'none' && (settings.lightLeakOpacity || 0) > 0;
    const hasWear = settings.wearEnabled !== false && settings.wearType && settings.wearType !== 'none' && (settings.wearOpacity || 0) > 0;
    const hasDirty = settings.dirtyNoiseEnabled !== false && settings.dirtyNoiseType && settings.dirtyNoiseType !== 'none' && (settings.dirtyNoiseOpacity || 0) > 0;
    return Boolean(hasBorder || hasLeak || hasWear || hasDirty);
  }

  function shouldRotateBorder90(imgW, imgH, borderMeta, options = {}) {
    if (!borderMeta) return false;
    const manualRot = Boolean(options.frameRotate);
    // Para bordes multi-ventana especiales (5 y 6), solo rotar si el usuario lo pide explícitamente
    if (borderMeta.multiWins) {
      return manualRot;
    }
    const isPhotoLandscape = imgW > imgH * 1.05;
    const isBorderLandscape = borderMeta.nativeAspect > 1.0;
    const autoMatch = (isPhotoLandscape !== isBorderLandscape);
    return manualRot ? !autoMatch : autoMatch;
  }

  function getFrameGeometry(imgW, imgH, frameType, borderScale = 1.0, options = {}) {
    if (!isBorderActive(frameType)) {
      return {
        width: imgW,
        height: imgH,
        photoX: 0,
        photoY: 0,
        photoW: imgW,
        photoH: imgH
      };
    }

    const meta = BORDER_CATALOG[frameType];
    const fitMode = options.frameFitMode || 'fit';

    if (fitMode === 'overlay') {
      return {
        width: imgW,
        height: imgH,
        photoX: 0,
        photoY: 0,
        photoW: imgW,
        photoH: imgH
      };
    }

    // En modo 'fit' (Encajar foto en el hueco del marco):
    // Si es un marco multi-ventana (ej. Borde 5 Doble 6x7 o Borde 6 Tira de 4 Fotos), respetar la proporción del marco
    const rot90 = shouldRotateBorder90(imgW, imgH, meta, options);
    if (meta.multiWins) {
      const targetAspect = rot90 ? (1.0 / meta.nativeAspect) : meta.nativeAspect;
      const baseLongEdge = Math.max(imgW, imgH);
      let totalW, totalH;
      if (targetAspect >= 1.0) {
        totalW = baseLongEdge;
        totalH = Math.round(baseLongEdge / targetAspect);
      } else {
        totalH = baseLongEdge;
        totalW = Math.round(baseLongEdge * targetAspect);
      }
      return {
        width: Math.max(1, totalW),
        height: Math.max(1, totalH),
        photoX: 0,
        photoY: 0,
        photoW: imgW,
        photoH: imgH,
        isMultiWin: true,
        rot90
      };
    }

    const win = rot90
      ? { x: meta.win.y, y: meta.win.x, w: meta.win.h, h: meta.win.w }
      : meta.win;

    const scale = Math.max(0.5, Math.min(2.0, borderScale || 1.0));
    const bleed = 0.008; // Solapamiento sutil bajo el borde orgánico para evitar cualquier rendija
    const effWinX = Math.max(0, (win.x - bleed) * scale);
    const effWinY = Math.max(0, (win.y - bleed) * scale);
    const effWinW = Math.max(0.2, Math.min(1.0 - effWinX, 1.0 - (1.0 - win.w - bleed * 2) * scale));
    const effWinH = Math.max(0.2, Math.min(1.0 - effWinY, 1.0 - (1.0 - win.h - bleed * 2) * scale));

    const totalW = Math.max(1, Math.round(imgW / effWinW));
    const totalH = Math.max(1, Math.round(imgH / effWinH));
    const photoX = Math.round(totalW * effWinX);
    const photoY = Math.round(totalH * effWinY);
    const photoW = Math.round(totalW * effWinW);
    const photoH = Math.round(totalH * effWinH);

    return {
      width: totalW,
      height: totalH,
      photoX,
      photoY,
      photoW,
      photoH,
      rot90
    };
  }

  function drawTransformedOverlay(ctx, sourceImg, x, y, w, h, flipH, flipV, rotSteps = 0) {
    ctx.save();
    ctx.translate(x + w * 0.5, y + h * 0.5);
    const sx = flipH ? -1 : 1;
    const sy = flipV ? -1 : 1;
    ctx.scale(sx, sy);

    const steps = ((rotSteps % 4) + 4) % 4;
    if (steps === 1) {
      ctx.rotate(Math.PI * 0.5);
      ctx.drawImage(sourceImg, -h * 0.5, -w * 0.5, h, w);
    } else if (steps === 2) {
      ctx.rotate(Math.PI);
      ctx.drawImage(sourceImg, -w * 0.5, -h * 0.5, w, h);
    } else if (steps === 3) {
      ctx.rotate(-Math.PI * 0.5);
      ctx.drawImage(sourceImg, -h * 0.5, -w * 0.5, h, w);
    } else {
      ctx.drawImage(sourceImg, -w * 0.5, -h * 0.5, w, h);
    }
    ctx.restore();
  }

  function drawCoverPhotoInRect(ctx, photoCanvas, rx, ry, rw, rh) {
    const pw = photoCanvas.width;
    const ph = photoCanvas.height;
    const pAspect = pw / Math.max(1, ph);
    const rAspect = rw / Math.max(1, rh);

    let sx = 0, sy = 0, sw = pw, sh = ph;
    if (pAspect > rAspect) {
      sw = ph * rAspect;
      sx = (pw - sw) * 0.5;
    } else {
      sh = pw / rAspect;
      sy = (ph - sh) * 0.5;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(rx, ry, rw, rh);
    ctx.clip();
    ctx.drawImage(photoCanvas, sx, sy, sw, sh, rx, ry, rw, rh);
    ctx.restore();
  }

  // Aplica los filtros de Ruido Sucio, Desgastado y Light Leaks directamente sobre un lienzo fotográfico
  function applySurfaceTextures(ctx, width, height, settings) {
    if (!settings) return;

    // 1. FILTRO DE DESGASTADO Y LÍNEAS (BONUS TEXTURE/lines texture)
    if (settings.wearEnabled !== false && settings.wearType && settings.wearType !== 'none') {
      const wearOpacity = Math.max(0, Math.min(100, settings.wearOpacity !== undefined ? settings.wearOpacity : 65)) / 100.0;
      const wearImg = imageCache.wearTextures[settings.wearType];
      if (wearOpacity > 0.005 && isImageReady(wearImg)) {
        ctx.save();
        const isDarkMode = settings.wearInvert === true;
        if (isDarkMode) {
          const invCanvas = getInvertedCanvas('wear_' + settings.wearType, wearImg);
          ctx.globalCompositeOperation = 'multiply';
          ctx.globalAlpha = Math.min(1.0, wearOpacity);
          drawTransformedOverlay(ctx, invCanvas, 0, 0, width, height, settings.wearFlipH, settings.wearFlipV, settings.wearRotate || 0);
        } else {
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = Math.min(1.0, wearOpacity);
          drawTransformedOverlay(ctx, wearImg, 0, 0, width, height, settings.wearFlipH, settings.wearFlipV, settings.wearRotate || 0);
          if (wearOpacity > 0.65) {
            ctx.globalAlpha = (wearOpacity - 0.65) * 1.4;
            drawTransformedOverlay(ctx, wearImg, 0, 0, width, height, settings.wearFlipH, settings.wearFlipV, settings.wearRotate || 0);
          }
        }
        ctx.restore();
      }
    }

    // 2. FILTRO DE RUIDO SUCIO (BONUS TEXTURE/noise-tex/noise-tex-01..10.png)
    if (settings.dirtyNoiseEnabled !== false && settings.dirtyNoiseType && settings.dirtyNoiseType !== 'none') {
      const dirtyOpacity = Math.max(0, Math.min(100, settings.dirtyNoiseOpacity !== undefined ? settings.dirtyNoiseOpacity : 65)) / 100.0;
      const dirtyImg = imageCache.dirtyNoise[settings.dirtyNoiseType];
      if (dirtyOpacity > 0.005 && isImageReady(dirtyImg)) {
        ctx.save();
        if (settings.dirtyNoiseInvert) {
          // Modo Polvo/Ruido Negro (Negativo invertido con fusión Multiply)
          const invCanvas = getInvertedCanvas('dirty_' + settings.dirtyNoiseType, dirtyImg);
          ctx.globalCompositeOperation = 'multiply';
          ctx.globalAlpha = Math.min(1.0, dirtyOpacity);
          drawTransformedOverlay(ctx, invCanvas, 0, 0, width, height, settings.dirtyNoiseFlipH, settings.dirtyNoiseFlipV, settings.dirtyNoiseRotate || 0);
          if (dirtyOpacity > 0.6) {
            ctx.globalAlpha = (dirtyOpacity - 0.6) * 1.5;
            drawTransformedOverlay(ctx, invCanvas, 0, 0, width, height, settings.dirtyNoiseFlipH, settings.dirtyNoiseFlipV, settings.dirtyNoiseRotate || 0);
          }
        } else {
          // Modo Ruido Sucio Blanco Original de Escáner (Screen)
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = Math.min(1.0, dirtyOpacity);
          drawTransformedOverlay(ctx, dirtyImg, 0, 0, width, height, settings.dirtyNoiseFlipH, settings.dirtyNoiseFlipV, settings.dirtyNoiseRotate || 0);
          if (dirtyOpacity > 0.6) {
            ctx.globalAlpha = (dirtyOpacity - 0.6) * 1.5;
            drawTransformedOverlay(ctx, dirtyImg, 0, 0, width, height, settings.dirtyNoiseFlipH, settings.dirtyNoiseFlipV, settings.dirtyNoiseRotate || 0);
          }
        }
        ctx.restore();
      }
    }

    // 3. LIGHT LEAKS REALES (BONUS TEXTURE/light leaks/light-leak-01..12.png)
    if (settings.lightLeakEnabled !== false && settings.lightLeakType && settings.lightLeakType !== 'none') {
      const leakOpacity = Math.max(0, Math.min(100, settings.lightLeakOpacity !== undefined ? settings.lightLeakOpacity : 75)) / 100.0;
      const leakImg = imageCache.lightLeaks[settings.lightLeakType];
      if (leakOpacity > 0.005 && isImageReady(leakImg)) {
        ctx.save();
        const blendMode = settings.lightLeakBlend || 'screen';
        ctx.globalCompositeOperation = blendMode;
        ctx.globalAlpha = Math.min(1.0, leakOpacity);
        drawTransformedOverlay(
          ctx,
          leakImg,
          0,
          0,
          width,
          height,
          Boolean(settings.lightLeakFlipH),
          Boolean(settings.lightLeakFlipV),
          settings.lightLeakRotate || 0
        );
        if (leakOpacity > 0.75 && blendMode === 'screen') {
          ctx.globalAlpha = (leakOpacity - 0.75) * 1.4;
          drawTransformedOverlay(
            ctx,
            leakImg,
            0,
            0,
            width,
            height,
            Boolean(settings.lightLeakFlipH),
            Boolean(settings.lightLeakFlipV),
            settings.lightLeakRotate || 0
          );
        }
        ctx.restore();
      }
    }
  }

  function compositeFrame(targetCanvas, photoCanvas, frameType, options = {}) {
    const ctx = targetCanvas.getContext('2d');
    const imgW = photoCanvas.width;
    const imgH = photoCanvas.height;
    const settings = options.settings || options || {};
    const effectiveFrameType = (settings.frameEnabled === false) ? 'none' : (frameType || settings.frameType || 'none');
    const borderScale = options.borderScale !== undefined ? options.borderScale : (settings.frameScale || 1.0);
    const frameOpacity = Math.max(0, Math.min(100, settings.frameOpacity !== undefined ? settings.frameOpacity : 100)) / 100.0;

    // Primero preparar la foto con las texturas superficiales (Desgastado, Ruido Sucio y Light Leaks)
    const hasSurfaceFX = (
      (settings.wearEnabled !== false && settings.wearType && settings.wearType !== 'none' && (settings.wearOpacity || 0) > 0) ||
      (settings.dirtyNoiseEnabled !== false && settings.dirtyNoiseType && settings.dirtyNoiseType !== 'none' && (settings.dirtyNoiseOpacity || 0) > 0) ||
      (settings.lightLeakEnabled !== false && settings.lightLeakType && settings.lightLeakType !== 'none' && (settings.lightLeakOpacity || 0) > 0)
    );

    let processedPhoto = photoCanvas;
    if (hasSurfaceFX) {
      const fxCanvas = document.createElement('canvas');
      fxCanvas.width = imgW;
      fxCanvas.height = imgH;
      const fxCtx = fxCanvas.getContext('2d');
      fxCtx.drawImage(photoCanvas, 0, 0);
      applySurfaceTextures(fxCtx, imgW, imgH, settings);
      processedPhoto = fxCanvas;
    }

    if (!isBorderActive(effectiveFrameType)) {
      if (targetCanvas.width !== imgW || targetCanvas.height !== imgH) {
        targetCanvas.width = imgW;
        targetCanvas.height = imgH;
      }
      ctx.clearRect(0, 0, imgW, imgH);
      ctx.drawImage(processedPhoto, 0, 0);
      return;
    }

    const meta = BORDER_CATALOG[effectiveFrameType];
    const borderImg = imageCache.borders[effectiveFrameType];
    const geo = getFrameGeometry(imgW, imgH, effectiveFrameType, borderScale, settings);

    if (targetCanvas.width !== geo.width || targetCanvas.height !== geo.height) {
      targetCanvas.width = geo.width;
      targetCanvas.height = geo.height;
    }

    ctx.clearRect(0, 0, geo.width, geo.height);

    // Fondo oscuro de cuarto oscuro bajo los bordes para evitar transparencias vacías en JPEG
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, geo.width, geo.height);

    if (geo.isMultiWin && meta.multiWins) {
      // Marcos multiventana (Borde 5 Doble 6x7 y Borde 6 Tira de 4 Fotos)
      const extraPhotos = Array.isArray(options.multiPhotos) && options.multiPhotos.length > 0
        ? options.multiPhotos
        : [processedPhoto];

      meta.multiWins.forEach((wRect, idx) => {
        const r = geo.rot90
          ? { x: wRect.y, y: wRect.x, w: wRect.h, h: wRect.w }
          : wRect;
        const pad = 0.008;
        const rx = Math.round((r.x - pad) * geo.width);
        const ry = Math.round((r.y - pad) * geo.height);
        const rw = Math.round((r.w + pad * 2) * geo.width);
        const rh = Math.round((r.h + pad * 2) * geo.height);
        const srcC = extraPhotos[idx % extraPhotos.length] || processedPhoto;
        drawCoverPhotoInRect(ctx, srcC, rx, ry, rw, rh);
      });
    } else {
      // Marco individual: dibujar la fotografía en la ventana
      ctx.drawImage(processedPhoto, geo.photoX, geo.photoY, geo.photoW, geo.photoH);
    }

    // Dibujar el Borde Analógico PNG encima respetando su canal alfa nativo
    if (isImageReady(borderImg) && frameOpacity > 0.005) {
      ctx.save();
      ctx.globalAlpha = frameOpacity;
      drawTransformedOverlay(
        ctx,
        borderImg,
        0,
        0,
        geo.width,
        geo.height,
        Boolean(settings.frameFlipH),
        Boolean(settings.frameFlipV),
        geo.rot90 ? 1 : 0
      );
      ctx.restore();
    }
  }

  return {
    BORDER_CATALOG,
    LIGHT_LEAK_CATALOG,
    WEAR_CATALOG,
    DIRTY_NOISE_CATALOG,
    isFrameActive,
    isBorderActive,
    hasActiveOverlays,
    getFrameGeometry,
    compositeFrame,
    setOnAssetLoaded,
    preloadAllAssets,
    getAssetImage
  };
})();
