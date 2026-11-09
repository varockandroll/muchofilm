/**
 * mucho FILM — Aplicación Principal (Tema Claro · Edición Roja)
 * - Decodificación universal de imágenes mediante TIFFCodec (JPEG, PNG, WebP, TIFF 8/16-bit, RAW, DNG).
 * - Orientación vertical exacta 100% garantizada (top-down fiel al archivo original).
 * - Rotación y enderezado euclídeo isótropo sin deformación.
 * - Atajo 'Z' para centrar la fotografía holgada y completa en el medio ocupando todo el lienzo.
 * - Rueda de zoom con aceleración amortiguada y ultra precisa (calibrada para trackpad de macOS).
 * - Efecto de suciedad y polvo vintage (Dust & Scratches analógico de 35mm).
 * - Marcos de foto analógicos: Polaroid, Negativo 35mm con perforaciones, Escaneo con bordes cortados y Passepartout.
 * - Creador de Carruseles para redes: celdas 1:1, 4:5, 3:4, manipulación individual de fotos (mover, zoom, rotar) y exportación cortada.
 */

(function () {
  'use strict';

  // ESTADO GLOBAL DE LA APLICACIÓN
  const state = {
    imageSource: null,           // Float32Array
    rawWidth: 0,
    rawHeight: 0,
    fileName: 'fotografia.jpg',
    isTIFF: false,

    // Gestión de fotos múltiples del proyecto y galería inferior
    loadedPhotos: [],            // Array de { id, fileName, floatData, width, height, is16Bit, canvas, thumbUrl, settings }
    activePhotoIndex: 0,

    // Visor y transformación de visualización
    zoom: 1.0,
    panX: 0,
    panY: 0,
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    activeTool: 'pan',           // 'pan' | 'crop' | 'anchor'

    // Vista comparativa Antes/Después
    beforeAfter: false,          // Ver original (mientras se mantiene pulsada la tecla \)
    compareSplit: false,         // Vista dividida antes | después
    splitPos: 0.5,

    // Interfaz
    activeTab: 'develop',
    copiedStyle: null,           // Ajustes copiados (⇧⌘C) para pegar en otras fotos
    isAnchorDragging: false,

    // Modo Carrusel
    carouselActive: false,
    isCellPanning: false,
    cellPanStart: { x: 0, y: 0 },
    cellPanStartVal: { x: 0, y: 0 },
    isSeamlessPanning: false,
    seamlessPanStart: { x: 0 },
    seamlessPanStartVal: 0,

    // Manipulación interactiva de fotos en carrusel
    isPhotoDragging: false,
    photoDragOffset: { x: 0, y: 0 },
    isPhotoResizing: null,         // 'tl' | 'tr' | 'bl' | 'br'
    resizeStart: null,
    isPhotoPanningInCrop: false,   // Arrastrar dentro de la foto para reencuadrar
    cropPanStart: null,
    isCropHandleDragging: null,    // Manijas de recorte ('crop-tl', 'crop-tr', etc.)
    cropHandleStart: null,

    // Recorte interactivo
    cropDragging: null,
    cropDragStart: { x: 0, y: 0 },
    cropStartRect: { x: 0, y: 0, w: 1, h: 1 },

    // Ajustes actuales
    settings: getDefaultSettings(),

    // Pila de deshacer / rehacer
    undoStack: [],
    redoStack: []
  };

  const FILM_PROFILES = {
    portra400: {
      name: 'Kodak Portra 400',
      temperature: 7,            // +7 (Warm daylight balance)
      tint: 2,                   // +2 (Subtle magenta shift for organic skin tones)
      contrast: 20,              // +20
      highlights: -25,           // -25 (Gentle highlight roll-off)
      shadows: 20,               // +20 (Open film-like shadows)
      whites: -15,               // -15 (Muted dynamic range)
      blacks: 10,                // +10 (Softened black point)
      clarity: -10,              // -10 (Eliminate harsh digital sharpness)
      saturation: 0,
      vibrance: 0,
      shadowFade: 12.0 / 255.0,  // (Input: 0, Output: 12) - Matte faded blacks (~0.047)
      highlightRollOff: 245.0 / 255.0, // (Input: 255, Output: 245) - Creamy ivory whites (~0.961)
      channelCurve: [0.075, 0.0, 0.045], // Red shadow warmth (35->38) & Blue mid-low lift
      isBlackAndWhite: false,
      bwMixer: [0.0, 0.0, 0.0, 0.0],
      hslReds: [4, -5, 5],        // Hue +4, Sat -5, Lum +5
      hslOranges: [3, -8, 12],    // Hue +3, Sat -8, Lum +12 (Golden, silk-like skin)
      hslYellows: [-12, -15, 4],  // Hue -12, Sat -15, Lum +4
      hslGreens: [-20, -25, -2],  // Hue -20, Sat -25, Lum -2 (Muted olive greens)
      hslAquas: [-8, 5, 0],       // Hue -8, Sat +5, Lum 0
      hslBlues: [-15, -18, 8],    // Hue -15, Sat -18, Lum +8 (Pastel cyan skies)
      calibRed: [5, -5, 0],       // Red Primary: Hue +5, Sat -5
      calibGreen: [-10, 10, 0],   // Green Primary: Hue -10, Sat +10
      calibBlue: [-8, -5, 0],     // Blue Primary: Hue -8, Sat -5
      grainEnabled: true,
      grainAmount: 22,            // 22% (Visible but clean and aesthetic)
      grainSize: 25,              // 25 (Fine T-GRAIN structure)
      grainRoughness: 40          // 40 (Organic, non-uniform film grain)
    },
    gold200: {
      name: 'Kodak Gold 200',
      temperature: 15,
      tint: 2,
      contrast: 15,
      highlights: -10,
      shadows: -5,
      clarity: 0,
      saturation: 8,
      vibrance: 8,
      shadowFade: 0.03,
      channelCurve: [0.03, 0.01, -0.02],
      isBlackAndWhite: false,
      bwMixer: [0.0, 0.0, 0.0, 0.0],
      hslReds: [-5, 12, 0],
      hslOranges: [-3, 8, 5],
      hslYellows: [-10, 15, 0],
      hslGreens: [-15, -10, 0],
      hslBlues: [5, -5, -5],
      grainEnabled: true,
      grainAmount: 45,
      grainSize: 35,
      grainRoughness: 40
    },
    superia400: {
      name: 'Fujifilm Superia X-Tra 400',
      temperature: -6,
      tint: -8,
      contrast: 10,
      highlights: -15,
      shadows: 5,
      clarity: 0,
      saturation: 2,
      vibrance: 4,
      shadowFade: 0.04,
      channelCurve: [-0.02, 0.08, -0.01],
      isBlackAndWhite: false,
      bwMixer: [0.0, 0.0, 0.0, 0.0],
      hslReds: [5, -5, 0],
      hslOranges: [2, -4, 0],
      hslYellows: [8, -12, 0],
      hslGreens: [15, 10, -5],
      hslBlues: [-5, 5, 0],
      grainEnabled: true,
      grainAmount: 50,
      grainSize: 40,
      grainRoughness: 45
    },
    trix400: {
      name: 'Kodak Tri-X 400',
      temperature: 0,
      tint: 0,
      contrast: 25,
      highlights: 10,
      shadows: -15,
      clarity: 15,
      saturation: -100,
      vibrance: -100,
      shadowFade: 0.0,
      channelCurve: [0.0, 0.0, 0.0],
      isBlackAndWhite: true,
      bwMixer: [0.15, -0.15, -0.30, 0.0],
      hslReds: [0, 0, 0],
      hslOranges: [0, 0, 0],
      hslYellows: [0, 0, 0],
      hslGreens: [0, 0, 0],
      hslBlues: [0, 0, 0],
      grainEnabled: true,
      grainAmount: 65,
      grainSize: 45,
      grainRoughness: 50
    },
    acros100: {
      name: 'Fujifilm Neopan Acros 100',
      temperature: 0,
      tint: 0,
      contrast: 5,
      highlights: -5,
      shadows: 5,
      clarity: -5,
      saturation: -100,
      vibrance: -100,
      shadowFade: 0.01,
      channelCurve: [0.0, 0.0, 0.0],
      isBlackAndWhite: true,
      bwMixer: [-0.05, 0.15, -0.10, 0.0],
      hslReds: [0, 0, 0],
      hslOranges: [0, 0, 0],
      hslYellows: [0, 0, 0],
      hslGreens: [0, 0, 0],
      hslBlues: [0, 0, 0],
      grainEnabled: true,
      grainAmount: 15,
      grainSize: 15,
      grainRoughness: 20
    }
  };

  function getDefaultSettings() {
    return {
      // 1. Recorte, proporción y enderezado
      crop: { x: 0.0, y: 0.0, w: 1.0, h: 1.0 },
      cropRatio: 'free',
      straighten: 0.0,
      rotateSteps: 0,
      flipH: false,
      flipV: false,

      // 2. Ajustes Básicos
      basicsEnabled: true,
      exposure: 0.0,             // -3.0 a +3.0 EV
      brightness: 0,             // -100 a +100
      contrast: 0,               // -100 a +100
      highlights: 0,             // -100 a +100
      shadows: 0,                // -100 a +100
      whites: 0,                 // -100 a +100
      blacks: 0,                 // -100 a +100
      saturation: 0,             // -100 a +100
      vibrance: 0,               // -100 a +100
      temperature: 0,            // -100 a +100
      tint: 0,                   // -100 a +100
      clarity: 0,                // -100 a +100
      sharpness: 0,              // 0 a 100

      // 2b. Perfil de Película Analógica
      activeFilmProfile: null,   // null | 'portra400' | 'gold200' | 'superia400' | 'trix400' | 'acros100'
      shadowFade: 0.0,           // 0.0 a 0.25
      highlightRollOff: 1.0,     // 0.70 a 1.0
      channelCurve: [0.0, 0.0, 0.0],
      isBlackAndWhite: false,
      bwMixer: [0.0, 0.0, 0.0, 0.0],
      hslReds: [0, 0, 0],
      hslOranges: [0, 0, 0],
      hslYellows: [0, 0, 0],
      hslGreens: [0, 0, 0],
      hslAquas: [0, 0, 0],
      hslBlues: [0, 0, 0],
      calibRed: [0, 0, 0],
      calibGreen: [0, 0, 0],
      calibBlue: [0, 0, 0],

      // 3. Grano Analógico
      grainEnabled: true,
      grainAmount: 0,            // 0 a 100
      grainSize: 35,             // 0 a 100
      grainRoughness: 50,        // 0 a 100

      // 4. Desenfoque de Movimiento
      motionEnabled: true,
      motionType: 'shake',       // 'pan' | 'shake' | 'zoom'
      motionLength: 0,           // 0 a 100
      motionAngle: 0,            // 0 a 360
      flashFreeze: 0,            // 0 a 100
      highlightTrails: 0,        // 0 a 100
      anchorEnabled: false,
      anchorX: 0.5,
      anchorY: 0.5,
      anchorRadius: 25,
      anchorFeather: 35,

      // 5. Ruido Sucio y Filtros de Desgastado Reales (Analog Film: noise-tex & lines texture)
      dustEnabled: false,
      dirtyNoiseEnabled: false,
      dirtyNoiseType: 'none',    // 'none' | 'dirty_01' .. 'dirty_10'
      dirtyNoiseOpacity: 65,     // 0 a 100
      dirtyNoiseInvert: false,   // false = blanco escáner, true = polvo negro
      dirtyNoiseFlipH: false,
      dirtyNoiseFlipV: false,

      wearEnabled: false,
      wearType: 'none',          // 'none' | 'wear_01' .. 'wear_03_black'
      wearOpacity: 65,           // 0 a 100
      wearInvert: false,         // false = líneas claras, true = desgaste oscuro
      wearFlipH: false,
      wearRotate: 0,             // 0..3

      // 6. Light Leaks Analógicos Reales (Analog Film: light-leak-01 .. 12)
      lightLeakEnabled: false,
      lightLeakType: 'none',     // 'none' | 'leak_01' .. 'leak_12'
      lightLeakOpacity: 75,      // 0 a 100
      lightLeakFlipH: false,
      lightLeakFlipV: false,
      lightLeakRotate: 0,        // 0..3

      // 7. Bordes Analógicos Reales (Analog Film: PNG/1.png .. 15.png)
      frameEnabled: false,
      frameType: 'none',         // 'none' | 'border_1' .. 'border_15'
      frameFitMode: 'fit',       // 'fit' | 'overlay'
      frameRotate: false,        // rotar borde 90°
      frameScale: 1.0,           // 0.5 a 1.5
      frameOpacity: 100          // 10 a 100
    };
  }

  // =========================================================================
  // DEFINICIONES COMPARTIDAS DE CONTROLES
  // =========================================================================
  const fmtSigned = (v) => `${v > 0 ? '+' : ''}${Math.round(v)}`;
  const fmtInt = (v) => `${Math.round(v)}`;

  // Deslizadores ligados directamente a una clave de ajustes
  const SLIDERS = {
    exposure:          { id: 'sliderExposure',          val: 'valExposure',          def: 0,   fmt: (v) => `${v > 0 ? '+' : ''}${Number(v).toFixed(2)} EV` },
    highlights:        { id: 'sliderHighlights',        val: 'valHighlights',        def: 0,   fmt: fmtSigned },
    shadows:           { id: 'sliderShadows',           val: 'valShadows',           def: 0,   fmt: fmtSigned },
    whites:            { id: 'sliderWhites',            val: 'valWhites',            def: 0,   fmt: fmtSigned },
    blacks:            { id: 'sliderBlacks',            val: 'valBlacks',            def: 0,   fmt: fmtSigned },
    brightness:        { id: 'sliderBrightness',        val: 'valBrightness',        def: 0,   fmt: fmtSigned },
    contrast:          { id: 'sliderContrast',          val: 'valContrast',          def: 0,   fmt: fmtSigned },
    saturation:        { id: 'sliderSaturation',        val: 'valSaturation',        def: 0,   fmt: fmtSigned },
    vibrance:          { id: 'sliderVibrance',          val: 'valVibrance',          def: 0,   fmt: fmtSigned },
    temperature:       { id: 'sliderTemperature',       val: 'valTemperature',       def: 0,   fmt: fmtSigned },
    tint:              { id: 'sliderTint',              val: 'valTint',              def: 0,   fmt: fmtSigned },
    clarity:           { id: 'sliderClarity',           val: 'valClarity',           def: 0,   fmt: fmtSigned },
    sharpness:         { id: 'sliderSharpness',         val: 'valSharpness',         def: 0,   fmt: fmtInt },
    grainAmount:       { id: 'sliderGrainAmount',       val: 'valGrainAmount',       def: 0,   fmt: fmtInt },
    grainSize:         { id: 'sliderGrainSize',         val: 'valGrainSize',         def: 35,  fmt: fmtInt },
    grainRoughness:    { id: 'sliderGrainRoughness',    val: 'valGrainRoughness',    def: 50,  fmt: fmtInt },
    motionLength:      { id: 'sliderMotionLength',      val: 'valMotionLength',      def: 0,   fmt: fmtInt },
    motionAngle:       { id: 'sliderMotionAngle',       val: 'valMotionAngle',       def: 0,   fmt: (v) => `${Math.round(v)}°` },
    flashFreeze:       { id: 'sliderFlashFreeze',       val: 'valFlashFreeze',       def: 0,   fmt: fmtInt },
    highlightTrails:   { id: 'sliderHighlightTrails',   val: 'valHighlightTrails',   def: 0,   fmt: fmtInt },
    anchorRadius:      { id: 'sliderAnchorRadius',      val: 'valAnchorRadius',      def: 25,  fmt: fmtInt },
    anchorFeather:     { id: 'sliderAnchorFeather',     val: 'valAnchorFeather',     def: 35,  fmt: fmtInt },
    dirtyNoiseOpacity: { id: 'sliderDirtyNoiseOpacity', val: 'valDirtyNoiseOpacity', def: 65,  fmt: fmtInt },
    wearOpacity:       { id: 'sliderWearOpacity',       val: 'valWearOpacity',       def: 65,  fmt: fmtInt },
    lightLeakOpacity:  { id: 'sliderLightLeakOpacity',  val: 'valLightLeakOpacity',  def: 75,  fmt: fmtInt },
    frameOpacity:      { id: 'sliderFrameOpacity',      val: 'valFrameOpacity',      def: 100, fmt: fmtInt }
  };

  // Claves de ajustes agrupadas por sección (para restablecer por sección e indicar ediciones)
  const SECTION_KEYS = {
    basics: ['exposure', 'brightness', 'contrast', 'highlights', 'shadows', 'whites', 'blacks',
      'saturation', 'vibrance', 'temperature', 'tint', 'clarity', 'sharpness'],
    grain: ['grainAmount', 'grainSize', 'grainRoughness'],
    motion: ['motionType', 'motionLength', 'motionAngle', 'flashFreeze', 'highlightTrails',
      'anchorEnabled', 'anchorX', 'anchorY', 'anchorRadius', 'anchorFeather'],
    dust: ['dustEnabled', 'dirtyNoiseEnabled', 'dirtyNoiseType', 'dirtyNoiseOpacity', 'dirtyNoiseInvert',
      'dirtyNoiseFlipH', 'dirtyNoiseFlipV', 'wearEnabled', 'wearType', 'wearOpacity', 'wearInvert',
      'wearFlipH', 'wearRotate'],
    leak: ['lightLeakEnabled', 'lightLeakType', 'lightLeakOpacity', 'lightLeakFlipH', 'lightLeakFlipV', 'lightLeakRotate'],
    frame: ['frameEnabled', 'frameType', 'frameFitMode', 'frameRotate', 'frameScale', 'frameOpacity'],
    crop: ['crop', 'cropRatio', 'straighten', 'rotateSteps', 'flipH', 'flipV']
  };

  const SECTION_CARDS = {
    basics: 'sectionBasicsCard',
    grain: 'sectionGrainCard',
    motion: 'sectionMotionCard',
    dust: 'sectionDustCard',
    leak: 'sectionLightLeakCard',
    frame: 'sectionFrameCard',
    crop: 'sectionCropCard'
  };

  const TAB_SECTIONS = {
    develop: ['basics'],
    crop: ['crop'],
    film: ['grain', 'dust', 'leak', 'frame'],
    motion: ['motion'],
    carousel: []
  };

  const TAB_ORDER = ['develop', 'crop', 'film', 'motion', 'carousel'];

  // Ajustes que dependen del encuadre de cada foto y no se copian entre fotos
  const GEOMETRY_KEYS = ['crop', 'cropRatio', 'straighten', 'rotateSteps', 'flipH', 'flipV', 'anchorX', 'anchorY'];

  function cloneDeep(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function persistActiveSettings() {
    if (state.loadedPhotos[state.activePhotoIndex]) {
      state.loadedPhotos[state.activePhotoIndex].settings = { ...state.settings };
    }
  }

  function storageGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* almacenamiento no disponible (modo privado): seguir sin guardar */
    }
  }

  // INSTANCIAS Y ELEMENTOS DOM
  let pipeline = null;
  let canvas = null;
  let displayCtx = null;
  let canvasViewport = null;
  let offscreenGLCanvas = null;

  document.addEventListener('DOMContentLoaded', () => {
    initElements();
    initPipeline();
    initDragAndDrop();
    initEventListeners();
    initShortcuts();
    initTheme();
    initTabs();
    initCompare();
    initSliderEnhancements();
    initUserStyles();
    initSettingsClipboard();
    initSectionResets();
    initShortcutsModal();
    initTemplatePreviewCanvases();
    updateUIFromSettings();
    updateProjectUI();
    loadAnalogAssetsInBackground();

    // Reencuadrar al cambiar el tamaño de la ventana (si la vista estaba ajustada a pantalla)
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if ((state.imageSource || state.carouselActive) && state.viewIsFit !== false) fitViewCentered();
        else applyCanvasTransform();
        scheduleHistogram();
      }, 120);
    });

    // Avisar antes de cerrar la pestaña si hay trabajo sin exportar
    window.addEventListener('beforeunload', (e) => {
      if (state.loadedPhotos.length > 0 && state.undoStack.length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  });

  function initTemplatePreviewCanvases() {
    if (!window.CarouselEngine || !window.CarouselEngine.renderTemplatePreviewCanvas) return;
    document.querySelectorAll('.template-mini-canvas').forEach(c => {
      const tmplId = c.dataset.templateCanvas;
      if (tmplId) {
        window.CarouselEngine.renderTemplatePreviewCanvas(c, tmplId);
      }
    });
  }

  function initElements() {
    canvas = document.getElementById('glCanvas');
    displayCtx = canvas.getContext('2d');
    canvasViewport = document.getElementById('canvasViewport');
  }

  function initPipeline() {
    try {
      offscreenGLCanvas = document.createElement('canvas');
      pipeline = new window.WebGLPipeline.PipelineInstance(offscreenGLCanvas);
      if (window.FrameRenderer && window.FrameRenderer.setOnAssetLoaded) {
        window.FrameRenderer.setOnAssetLoaded(() => {
          requestRender();
          scheduleSwatchRefresh();
        });
      }
    } catch (err) {
      console.error('Error inicializando WebGL2 Pipeline:', err);
      showToast('Tu navegador no admite WebGL2: prueba con Safari, Chrome o Edge actualizados.');
    }
  }

  // El paquete de texturas analógicas pesa ~21 MB: se carga después de pintar la interfaz
  // para que la app responda al instante (sobre todo en el iPad por Wi‑Fi).
  function loadAnalogAssetsInBackground() {
    const FR = window.FrameRenderer;
    if (!FR) return;
    if (window.ANALOG_FILM_ASSETS) {
      FR.preloadAllAssets();
      return;
    }
    setTimeout(() => {
      const s = document.createElement('script');
      s.src = 'js/analog-assets.js';
      s.async = true;
      s.onload = () => FR.preloadAllAssets();
      s.onerror = () => {
        console.warn('[mucho FILM] No se pudo cargar js/analog-assets.js; se usarán los archivos de assets/.');
        FR.preloadAllAssets();
      };
      document.body.appendChild(s);
    }, 120);
  }

  // =========================================================================
  // MINIATURAS VISUALES DE TEXTURAS Y BORDES
  // =========================================================================
  let swatchRefreshTimer = null;

  function scheduleSwatchRefresh() {
    clearTimeout(swatchRefreshTimer);
    swatchRefreshTimer = setTimeout(refreshAssetSwatches, 120);
  }

  function refreshAssetSwatches() {
    const FR = window.FrameRenderer;
    if (!FR || !FR.getAssetImage) return;
    const groups = [
      { attr: 'leak', kind: 'lightLeaks' },
      { attr: 'dirty', kind: 'dirtyNoise' },
      { attr: 'wear', kind: 'wearTextures' },
      { attr: 'frame', kind: 'borders' }
    ];
    groups.forEach(({ attr, kind }) => {
      document.querySelectorAll(`.swatch[data-${attr}]`).forEach(btn => {
        const key = btn.dataset[attr];
        if (!key || key === 'none' || btn.dataset.ready) return;
        const img = FR.getAssetImage(kind, key);
        if (!img) return;
        const url = buildSwatchImage(img, kind);
        if (url) {
          btn.querySelector('.swatch-img').style.backgroundImage = `url("${url}")`;
          btn.dataset.ready = '1';
        }
      });
    });
  }

  function buildSwatchImage(img, kind) {
    try {
      const isFrame = kind === 'borders';
      const w = isFrame ? 96 : 112;
      const h = isFrame ? 128 : 112;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;

      if (isFrame) {
        // Fondo tipo "foto" neutra para que se vea la ventana del borde
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, '#8d8a85');
        g.addColorStop(1, '#4d4b48');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        const s = Math.min(w / iw, h / ih);
        const dw = iw * s;
        const dh = ih * s;
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      } else {
        // Texturas sobre fondo oscuro (cover)
        ctx.fillStyle = kind === 'lightLeaks' ? '#2a2724' : '#151517';
        ctx.fillRect(0, 0, w, h);
        const s = Math.max(w / iw, h / ih);
        const dw = iw * s;
        const dh = ih * s;
        ctx.globalCompositeOperation = 'screen';
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        if (kind === 'dirtyNoise') {
          // El polvo es muy fino: reforzarlo para que se aprecie en miniatura
          ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      return c.toDataURL('image/jpeg', 0.82);
    } catch (err) {
      return null;
    }
  }

  // =========================================================================
  // GESTIÓN DE MINIATURAS Y BANDEJA INFERIOR CENTRADA (BOTTOM FILMSTRIP DOCK)
  // =========================================================================
  function createThumbnailDataUrl(sourceCanvas, maxDim = 120) {
    const tw = sourceCanvas.width;
    const th = sourceCanvas.height;
    const scale = Math.min(1.0, maxDim / Math.max(tw, th));
    const tc = document.createElement('canvas');
    tc.width = Math.max(1, Math.round(tw * scale));
    tc.height = Math.max(1, Math.round(th * scale));
    const tctx = tc.getContext('2d');
    tctx.drawImage(sourceCanvas, 0, 0, tc.width, tc.height);
    return tc.toDataURL('image/jpeg', 0.85);
  }

  async function decodeFileToPhotoObject(file, fallbackName = '') {
    const fileName = file.name || fallbackName || 'fotografia.jpg';

    if (window.TIFFCodec && window.TIFFCodec.loadImageFile) {
      try {
        const decoded = await window.TIFFCodec.loadImageFile(file);
        if (decoded && decoded.width && decoded.height && decoded.floatData) {
          const w = decoded.width;
          const h = decoded.height;
          let c = decoded.canvas;
          if (!c) {
            c = document.createElement('canvas');
            c.width = w;
            c.height = h;
            const ctx = c.getContext('2d');
            const imgData = ctx.createImageData(w, h);
            const f = decoded.floatData;
            const d = imgData.data;
            for (let i = 0; i < f.length; i++) {
              d[i] = (f[i] * 255.0 + 0.5) | 0;
            }
            ctx.putImageData(imgData, 0, 0);
          }
          const thumbUrl = createThumbnailDataUrl(c);

          return {
            id: 'photo_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
            fileName: fileName,
            canvas: c,
            floatData: decoded.floatData,
            width: w,
            height: h,
            is16Bit: decoded.bitDepth === 16,
            thumbUrl: thumbUrl,
            settings: getDefaultSettings()
          };
        }
      } catch (err) {
        console.warn('Fallback decodificación a Image 2D:', err);
      }
    }

    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);

        const imgData = ctx.getImageData(0, 0, w, h).data;
        const floatData = new Float32Array(w * h * 4);
        const inv255 = 1.0 / 255.0;
        for (let i = 0; i < imgData.length; i++) {
          floatData[i] = imgData[i] * inv255;
        }

        const thumbUrl = createThumbnailDataUrl(c);

        resolve({
          id: 'photo_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
          fileName: fileName,
          canvas: c,
          floatData: floatData,
          width: w,
          height: h,
          is16Bit: false,
          thumbUrl: thumbUrl,
          settings: getDefaultSettings()
        });
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      };
      img.src = url;
    });
  }

  // Compatibilidad universal con llamadas legacy
  async function decodeImageToCanvas(file) {
    const photo = await decodeFileToPhotoObject(file);
    return photo.canvas;
  }

  async function handleIncomingFiles(fileList) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    showToast(`Cargando ${files.length} foto${files.length > 1 ? 's' : ''}…`, { duration: 60000 });

    let loadedCount = 0;
    const startIndex = state.loadedPhotos.length;

    for (let i = 0; i < files.length; i++) {
      try {
        const photoObj = await decodeFileToPhotoObject(files[i]);
        state.loadedPhotos.push(photoObj);

        // Añadir también al motor de Carrusel de forma inteligente (Estilo Canva)
        if (window.CarouselEngine) {
          if (state.carouselActive && window.CarouselEngine.state.activeTemplateId) {
            const slots = window.CarouselEngine.getTemplateSlots();
            const selSlotId = window.CarouselEngine.state.selectedSlotId;
            let targetSlot = selSlotId ? slots.find(s => s.id === selSlotId) : null;
            if (!targetSlot) {
              targetSlot = slots.find(s => !s.photoId || !window.CarouselEngine.state.photos.some(p => p.id === s.photoId));
            }
            if (targetSlot) {
              window.CarouselEngine.assignPhotoToSlot(targetSlot.id, photoObj.canvas, photoObj.fileName, photoObj.floatData, photoObj.id);
              window.CarouselEngine.state.selectedSlotId = null;
            }
          } else if (!window.CarouselEngine.state.activeTemplateId) {
            const targetCell = (startIndex + i) % window.CarouselEngine.state.slideCount;
            window.CarouselEngine.addPhoto(photoObj.canvas, photoObj.fileName, targetCell, photoObj.floatData, photoObj.id);
          }
        }
        loadedCount++;
      } catch (err) {
        console.error('Error cargando archivo:', files[i].name, err);
      }
    }

    if (loadedCount > 0) {
      if (startIndex === 0 || state.activePhotoIndex >= state.loadedPhotos.length) {
        selectPhotoByIndex(0);
      } else {
        selectPhotoByIndex(startIndex);
      }

      document.getElementById('dropzoneOverlay').style.display = 'none';
      renderBottomFilmstrip();

      if (state.carouselActive && window.CarouselEngine) {
        updateCarouselCellUI();
        updateCarouselLabels();
        updateTemplateUI();
      }

      updateProjectUI();
      const failed = files.length - loadedCount;
      showToast(`${loadedCount} foto${loadedCount > 1 ? 's añadidas' : ' añadida'}` +
        (failed > 0 ? ` · ${failed} no se pudo${failed > 1 ? 'eron' : ''} leer` : ''));
    } else {
      showToast('No se pudieron leer los archivos. Prueba con JPEG, PNG, TIFF o RAW.');
    }
  }

  // Botones que dependen del número de fotos del proyecto
  function updateProjectUI() {
    const count = state.loadedPhotos.length;
    const syncBtn = document.getElementById('btnSyncAll');
    if (syncBtn) syncBtn.hidden = count < 2;
    const pasteBtn = document.getElementById('btnPasteSettings');
    if (pasteBtn) pasteBtn.disabled = !state.copiedStyle || count === 0;
    const copyBtn = document.getElementById('btnCopySettings');
    if (copyBtn) copyBtn.disabled = count === 0;
    const resetBtn = document.getElementById('btnResetAll');
    if (resetBtn) resetBtn.disabled = count === 0;
    document.body.classList.toggle('has-photo', count > 0);
  }

  function bakeActiveWebGLToCarouselPhotos() {
    if (!window.CarouselEngine || !pipeline || !pipeline.canvas || pipeline.canvas.width === 0) return;
    const prevLoaded = state.loadedPhotos[state.activePhotoIndex];
    if (!prevLoaded) return;

    let photoSource = pipeline.canvas;
    if (window.FrameRenderer && window.FrameRenderer.hasActiveOverlays(state.settings)) {
      const framedCanvas = document.createElement('canvas');
      window.FrameRenderer.compositeFrame(framedCanvas, pipeline.canvas, state.settings.frameType, {
        settings: state.settings,
        borderScale: state.settings.frameScale
      });
      photoSource = framedCanvas;
    }

    const copy = document.createElement('canvas');
    copy.width = photoSource.width;
    copy.height = photoSource.height;
    const copyCtx = copy.getContext('2d');
    copyCtx.drawImage(photoSource, 0, 0);

    window.CarouselEngine.state.photos.forEach(cp => {
      if ((cp.sourcePhotoId && cp.sourcePhotoId === prevLoaded.id) || (!cp.sourcePhotoId && cp.fileName === prevLoaded.fileName)) {
        cp.renderedCanvas = copy;
      }
    });
  }

  function selectCarouselPhotoByIndex(cIdx) {
    if (!window.CarouselEngine) return;
    const cPhoto = window.CarouselEngine.state.photos[cIdx];
    if (!cPhoto) return;

    window.CarouselEngine.setSelectedPhoto(cIdx);

    const loadedIdx = state.loadedPhotos.findIndex(lp =>
      (cPhoto.sourcePhotoId && lp.id === cPhoto.sourcePhotoId) || lp.fileName === cPhoto.fileName
    );
    if (loadedIdx >= 0) {
      selectPhotoByIndex(loadedIdx, { preserveView: true, keepCarouselPhotoIndex: cIdx });
    } else {
      updateCarouselCellUI();
      requestRender();
    }
  }

  function selectPhotoByIndex(index, options = {}) {
    if (index < 0 || index >= state.loadedPhotos.length) return;

    const targetLoaded = state.loadedPhotos[index];

    // Si ya es la foto activa y su imagen está cargada en WebGL2, solo asegurar sincronización UI
    if (index === state.activePhotoIndex && state.imageSource === targetLoaded?.floatData) {
      if (window.CarouselEngine) {
        if (options.keepCarouselPhotoIndex !== undefined) {
          window.CarouselEngine.setSelectedPhoto(options.keepCarouselPhotoIndex);
        } else {
          const matchCIdx = window.CarouselEngine.state.photos.findIndex(cp =>
            (cp.sourcePhotoId && cp.sourcePhotoId === targetLoaded.id) || cp.fileName === targetLoaded.fileName
          );
          if (matchCIdx >= 0) window.CarouselEngine.setSelectedPhoto(matchCIdx);
        }
        if (state.carouselActive) {
          updateCarouselCellUI();
        }
      }
      return;
    }

    // Guardar ajustes actuales de la foto activa previa
    if (state.loadedPhotos[state.activePhotoIndex]) {
      state.loadedPhotos[state.activePhotoIndex].settings = { ...state.settings };
    }

    // Guardar renderizado con efectos de la foto previa para todos los marcos que la usen en el carrusel
    bakeActiveWebGLToCarouselPhotos();

    state.activePhotoIndex = index;
    const photo = state.loadedPhotos[index];

    // Cargar en el motor de revelado WebGL2
    state.imageSource = photo.floatData;
    state.rawWidth = photo.width;
    state.rawHeight = photo.height;
    state.fileName = photo.fileName;
    state.isTIFF = photo.is16Bit;

    pipeline.uploadFloatImage(photo.floatData, photo.width, photo.height);

    document.getElementById('dropzoneOverlay').style.display = 'none';
    document.getElementById('docFileName').textContent = photo.fileName;
    const badge = document.getElementById('docBadge');
    if (photo.is16Bit) {
      badge.textContent = '16 bits';
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }

    document.getElementById('infoWidth').textContent = photo.width;
    document.getElementById('infoHeight').textContent = photo.height;
    const mp = ((photo.width * photo.height) / 1000000).toFixed(1);
    document.getElementById('infoResolutionFull').textContent = `${photo.width} × ${photo.height} · ${mp} MP`;

    // Restaurar ajustes de esta foto
    state.settings = { ...(photo.settings || getDefaultSettings()) };
    updateUIFromSettings();

    // Sincronizar foto seleccionada con el motor de Carrusel
    if (window.CarouselEngine) {
      if (options.keepCarouselPhotoIndex !== undefined) {
        window.CarouselEngine.setSelectedPhoto(options.keepCarouselPhotoIndex);
      } else {
        const matchCIdx = window.CarouselEngine.state.photos.findIndex(cp =>
          (cp.sourcePhotoId && cp.sourcePhotoId === photo.id) || cp.fileName === photo.fileName
        );
        if (matchCIdx >= 0) {
          window.CarouselEngine.setSelectedPhoto(matchCIdx);
        }
      }
      if (state.carouselActive) {
        updateCarouselCellUI();
      }
    }

    // Solo reajustar vista completa si no se pide preservar y NO estamos en carrusel
    if (!options.preserveView && !state.carouselActive) {
      fitViewCentered();
    }
    requestRender();
    renderBottomFilmstrip();
    updateProjectUI();
    scheduleProfileThumbnails(60);
  }

  function removeLoadedPhotoByIndex(index) {
    if (index < 0 || index >= state.loadedPhotos.length) return;
    const removedPhoto = state.loadedPhotos[index];
    const removedName = removedPhoto.fileName;

    // Guardar los ajustes de la foto activa en SU objeto antes de mover índices
    const activeObj = state.loadedPhotos[state.activePhotoIndex] || null;
    if (activeObj) activeObj.settings = { ...state.settings };

    state.loadedPhotos.splice(index, 1);
    if (window.CarouselEngine) {
      for (let ci = window.CarouselEngine.state.photos.length - 1; ci >= 0; ci--) {
        const cp = window.CarouselEngine.state.photos[ci];
        if ((cp.sourcePhotoId && cp.sourcePhotoId === removedPhoto.id) || cp.fileName === removedName) {
          window.CarouselEngine.removePhoto(ci);
        }
      }
    }

    const undoAction = { label: 'Deshacer', onAction: () => restoreRemovedPhoto(removedPhoto, index) };

    if (state.loadedPhotos.length > 0) {
      if (activeObj && activeObj !== removedPhoto) {
        // La foto activa sigue ahí: solo corregir su índice
        state.activePhotoIndex = state.loadedPhotos.indexOf(activeObj);
        renderBottomFilmstrip();
      } else {
        // Se borró la foto activa: mostrar la siguiente sin sobrescribir sus ajustes
        state.activePhotoIndex = -1;
        selectPhotoByIndex(Math.min(index, state.loadedPhotos.length - 1));
      }
      showToast(`Foto quitada: ${removedName}`, undoAction);
    } else {
      state.activePhotoIndex = 0;
      state.imageSource = null;
      state.rawWidth = 0;
      state.rawHeight = 0;
      state.fileName = 'mucho FILM';
      document.getElementById('dropzoneOverlay').style.display = 'flex';
      document.getElementById('bottomFilmstripBar').style.display = 'none';
      document.getElementById('docFileName').textContent = 'Sin foto';
      document.getElementById('docBadge').style.display = 'none';
      document.getElementById('infoResolutionFull').textContent = '—';
      if (window.CarouselEngine) {
        window.CarouselEngine.clearAllPhotos();
      }
      if (displayCtx && canvas) displayCtx.clearRect(0, 0, canvas.width, canvas.height);
      clearHistogram();
      requestRender();
      showToast('Proyecto vacío', undoAction);
    }

    renderBottomFilmstrip();
    updateProjectUI();
    if (state.carouselActive) {
      updateCarouselCellUI();
      updateCarouselLabels();
      updateTemplateUI();
    }
  }

  function restoreRemovedPhoto(photo, index) {
    if (state.loadedPhotos.includes(photo)) return;
    const activeObj = state.imageSource ? state.loadedPhotos[state.activePhotoIndex] : null;
    if (activeObj) activeObj.settings = { ...state.settings };
    const idx = Math.max(0, Math.min(index, state.loadedPhotos.length));
    state.loadedPhotos.splice(idx, 0, photo);
    state.activePhotoIndex = activeObj ? state.loadedPhotos.indexOf(activeObj) : -1;
    selectPhotoByIndex(idx);
    if (state.carouselActive && window.CarouselEngine && !window.CarouselEngine.state.activeTemplateId) {
      window.CarouselEngine.addPhoto(photo.canvas, photo.fileName, 0, photo.floatData, photo.id);
      updateCarouselCellUI();
    }
    showToast(`Foto recuperada: ${photo.fileName}`);
  }

  function renderBottomFilmstrip() {
    const bar = document.getElementById('bottomFilmstripBar');
    const wrap = document.getElementById('filmstripScrollWrap');
    const badge = document.getElementById('filmstripCountBadge');
    if (!bar || !wrap) return;

    if (state.loadedPhotos.length === 0) {
      bar.style.display = 'none';
      return;
    }

    bar.style.display = 'flex';
    if (badge) {
      badge.textContent = `${state.loadedPhotos.length} ${state.loadedPhotos.length === 1 ? 'foto' : 'fotos'}`;
    }

    const defaults = getDefaultSettings();
    wrap.innerHTML = '';
    state.loadedPhotos.forEach((p, idx) => {
      const item = document.createElement('div');
      item.className = `filmstrip-thumb-item ${idx === state.activePhotoIndex ? 'active' : ''}`;
      item.title = state.carouselActive
        ? `${p.fileName} · Arrástrala a un marco del carrusel`
        : `${p.fileName} (←/→ para cambiar de foto)`;
      item.setAttribute('draggable', 'true');
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
      item.setAttribute('aria-label', `Foto ${idx + 1}: ${p.fileName}`);
      item.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          item.click();
        }
      });

      // Punto rojo si la foto tiene ajustes aplicados
      const pSettings = idx === state.activePhotoIndex ? state.settings : p.settings;
      if (pSettings && settingsDifferFromDefaults(pSettings, defaults)) {
        const dot = document.createElement('span');
        dot.className = 'filmstrip-edited-dot';
        dot.title = 'Foto editada';
        item.appendChild(dot);
      }

      // Arrastrar foto desde la tira inferior a cualquier hueco del carrusel
      item.addEventListener('dragstart', (ev) => {
        ev.dataTransfer.setData('text/mucho-photo-index', String(idx));
        ev.dataTransfer.effectAllowed = 'copyMove';
      });

      const img = document.createElement('img');
      img.className = 'filmstrip-img';
      img.src = p.thumbUrl;
      img.alt = p.fileName;
      item.appendChild(img);

      const numBadge = document.createElement('span');
      numBadge.className = 'filmstrip-badge';
      numBadge.textContent = `${idx + 1}`;
      item.appendChild(numBadge);

      const delBtn = document.createElement('button');
      delBtn.className = 'filmstrip-del-btn';
      delBtn.textContent = '×';
      delBtn.title = `Quitar ${p.fileName} del proyecto`;
      delBtn.setAttribute('aria-label', `Quitar ${p.fileName}`);
      delBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        removeLoadedPhotoByIndex(idx);
      });
      item.appendChild(delBtn);

      item.addEventListener('click', () => {
        // En modo Carrusel estilo Canva: si hay un hueco vacío seleccionado, clic en la miniatura lo rellena al instante
        if (state.carouselActive && window.CarouselEngine && window.CarouselEngine.state.activeTemplateId) {
          const selSlotId = window.CarouselEngine.state.selectedSlotId;
          if (selSlotId) {
            const slot = window.CarouselEngine.getTemplateSlots().find(s => s.id === selSlotId);
            if (slot) {
              saveSnapshot();
              window.CarouselEngine.assignPhotoToSlot(slot.id, p.canvas, p.fileName, p.floatData, p.id);
              selectPhotoByIndex(idx, { preserveView: true, keepCarouselPhotoIndex: window.CarouselEngine.state.selectedPhotoIndex });
              updateCarouselCellUI();
              updateTemplateUI();
              requestRender();
              showToast(`Foto colocada en: ${slot.label}`);
              return;
            }
          }
        }
        selectPhotoByIndex(idx, { preserveView: state.carouselActive });
      });

      wrap.appendChild(item);
    });

    const activeElem = wrap.querySelector('.filmstrip-thumb-item.active');
    if (activeElem) {
      activeElem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  function initDragAndDrop() {
    const dropzone = document.getElementById('dropzoneOverlay');
    const filePicker = document.getElementById('filePicker');
    const btnFilmAdd = document.getElementById('btnFilmstripAdd');

    dropzone.addEventListener('click', () => filePicker.click());
    document.getElementById('btnOpenNew').addEventListener('click', () => filePicker.click());
    if (btnFilmAdd) btnFilmAdd.addEventListener('click', () => filePicker.click());

    filePicker.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleIncomingFiles(e.target.files);
      }
      filePicker.value = '';
    });

    // Prevenir rigurosamente que el navegador abra la foto en una pestaña al arrastrar archivos
    window.addEventListener('dragenter', (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, false);

    document.addEventListener('dragover', (e) => {
      e.preventDefault();
    }, false);

    document.addEventListener('drop', (e) => {
      e.preventDefault();
    }, false);

    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }

      // Si estamos en modo carrusel, calcular si el cursor está sobre un hueco de plantilla en el lienzo
      if (state.carouselActive && window.CarouselEngine && window.CarouselEngine.state.activeTemplateId && canvas) {
        const canvasRect = canvas.getBoundingClientRect();
        const normX = (e.clientX - canvasRect.left) / canvasRect.width;
        const normY = (e.clientY - canvasRect.top) / canvasRect.height;
        if (normX >= 0 && normX <= 1 && normY >= 0 && normY <= 1) {
          const strip = window.CarouselEngine.getStripDimensions(1200);
          const stripX = normX * strip.totalW;
          const stripY = normY * strip.totalH;
          const slot = window.CarouselEngine.hitTestSlot(stripX, stripY);
          const hoverId = slot ? slot.id : null;
          if (window.CarouselEngine.state.hoveredSlotId !== hoverId) {
            window.CarouselEngine.state.hoveredSlotId = hoverId;
            requestRender();
          }
          return;
        }
      }

      if (window.CarouselEngine && window.CarouselEngine.state.hoveredSlotId) {
        window.CarouselEngine.state.hoveredSlotId = null;
        requestRender();
      }
      dropzone.classList.add('drag-over');
    });

    window.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (window.CarouselEngine && window.CarouselEngine.state.hoveredSlotId) {
        window.CarouselEngine.state.hoveredSlotId = null;
        requestRender();
      }
      dropzone.classList.remove('drag-over');
    });

    window.addEventListener('drop', async (e) => {
      // Bloquear 100% la acción por defecto del navegador (evita que se abra en una nueva pestaña)
      e.preventDefault();
      e.stopPropagation();

      const dt = e.dataTransfer;
      if (!dt) return;

      const filmstripIdxStr = dt.getData('text/mucho-photo-index');
      const files = dt.files;

      // Si soltamos sobre el lienzo en modo carrusel:
      if (state.carouselActive && window.CarouselEngine && canvas) {
        const canvasRect = canvas.getBoundingClientRect();
        const normX = (e.clientX - canvasRect.left) / canvasRect.width;
        const normY = (e.clientY - canvasRect.top) / canvasRect.height;

        if (normX >= 0 && normX <= 1 && normY >= 0 && normY <= 1) {
          const strip = window.CarouselEngine.getStripDimensions(1200);
          const stripX = normX * strip.totalW;
          const stripY = normY * strip.totalH;
          const targetSlot = window.CarouselEngine.hitTestSlot(stripX, stripY);
          window.CarouselEngine.state.hoveredSlotId = null;

          // A) Foto arrastrada desde la tira inferior
          if (filmstripIdxStr !== '') {
            const pIdx = parseInt(filmstripIdxStr, 10);
            if (pIdx >= 0 && pIdx < state.loadedPhotos.length) {
              saveSnapshot();
              const photoObj = state.loadedPhotos[pIdx];
              if (targetSlot) {
                window.CarouselEngine.assignPhotoToSlot(targetSlot.id, photoObj.canvas, photoObj.fileName, photoObj.floatData, photoObj.id);
                selectPhotoByIndex(pIdx, { preserveView: true, keepCarouselPhotoIndex: window.CarouselEngine.state.selectedPhotoIndex });
                showToast(`Foto encajada en: ${targetSlot.label}`);
              } else {
                const cellIdx = Math.max(0, Math.min(strip.slideCount - 1, Math.floor(stripX / strip.cellW)));
                const added = window.CarouselEngine.addPhoto(photoObj.canvas, photoObj.fileName, cellIdx, photoObj.floatData, photoObj.id);
                added.x = stripX;
                added.y = stripY;
                selectPhotoByIndex(pIdx, { preserveView: true, keepCarouselPhotoIndex: window.CarouselEngine.state.selectedPhotoIndex });
                showToast(`Foto añadida al carrusel: ${photoObj.fileName}`);
              }
              updateCarouselCellUI();
              updateTemplateUI();
              requestRender();
            }
            return;
          }

          // B) Archivo(s) arrastrado(s) desde el Finder / Escritorio
          if (files && files.length > 0) {
            saveSnapshot();
            let loadedCount = 0;
            let lastLoadedIdx = state.activePhotoIndex;
            for (let i = 0; i < files.length; i++) {
              try {
                const photoObj = await decodeFileToPhotoObject(files[i]);
                state.loadedPhotos.push(photoObj);
                lastLoadedIdx = state.loadedPhotos.length - 1;
                if (i === 0 && targetSlot) {
                  window.CarouselEngine.assignPhotoToSlot(targetSlot.id, photoObj.canvas, photoObj.fileName, photoObj.floatData, photoObj.id);
                  showToast(`Foto encajada en: ${targetSlot.label}`);
                } else if (window.CarouselEngine.state.activeTemplateId) {
                  const nextEmpty = window.CarouselEngine.getTemplateSlots().find(s => !s.photoId || !window.CarouselEngine.state.photos.some(p => p.id === s.photoId));
                  if (nextEmpty) {
                    window.CarouselEngine.assignPhotoToSlot(nextEmpty.id, photoObj.canvas, photoObj.fileName, photoObj.floatData, photoObj.id);
                  } else {
                    window.CarouselEngine.addPhoto(photoObj.canvas, photoObj.fileName, undefined, photoObj.floatData, photoObj.id);
                  }
                } else {
                  window.CarouselEngine.addPhoto(photoObj.canvas, photoObj.fileName, undefined, photoObj.floatData, photoObj.id);
                }
                loadedCount++;
              } catch (err) {
                console.error('Error al decodificar archivo arrastrado:', err);
              }
            }
            if (loadedCount > 0) {
              document.getElementById('dropzoneOverlay').style.display = 'none';
              selectPhotoByIndex(lastLoadedIdx, { preserveView: true, keepCarouselPhotoIndex: window.CarouselEngine.state.selectedPhotoIndex });
            }
            renderBottomFilmstrip();
            updateCarouselCellUI();
            updateCarouselLabels();
            updateTemplateUI();
            requestRender();
            return;
          }
        }
      }

      if (window.CarouselEngine) {
        window.CarouselEngine.state.hoveredSlotId = null;
      }
      dropzone.classList.remove('drag-over');

      if (!files || files.length === 0) return;
      handleIncomingFiles(files);
    });

    // Pegar desde el portapapeles (Cmd + V)
    window.addEventListener('paste', (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (let item of items) {
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          handleIncomingFiles([blob]);
          break;
        }
      }
    });
  }

  // =========================================================================
  // CONTROL DE VISTA COMPLETA CENTRADA ('Z') Y NAVEGADOR POR DIAPOSITIVA CANVA
  // =========================================================================
  function fitViewCentered() {
    if ((!state.rawWidth || !state.rawHeight) && !state.carouselActive) return;

    const viewportRect = canvasViewport.getBoundingClientRect();
    const margin = viewportRect.width < 600 ? 14 : 32;
    const filmstripBar = document.getElementById('bottomFilmstripBar');
    const bottomBarHeight = (filmstripBar && filmstripBar.style.display !== 'none') ? (filmstripBar.offsetHeight || 72) : 0;
    const topToolbarOffset = state.carouselActive ? 48 : 0;
    const slideNavOffset = state.carouselActive ? 44 : 0;
    const availW = Math.max(100, viewportRect.width - margin * 2);
    const availH = Math.max(100, viewportRect.height - margin * 2 - bottomBarHeight - topToolbarOffset - slideNavOffset);

    let displayW, displayH;
    if (state.carouselActive && window.CarouselEngine) {
      window.CarouselEngine.state.focusedSlideIndex = -1;
      const strip = window.CarouselEngine.getStripDimensions(1200);
      displayW = strip.totalW;
      displayH = strip.totalH;
    } else {
      const cropped = pipeline.getCroppedDimensions(state.rawWidth, state.rawHeight, state.settings);
      displayW = cropped.width;
      displayH = cropped.height;
      if (window.FrameRenderer && state.settings.frameEnabled !== false && window.FrameRenderer.isBorderActive(state.settings.frameType)) {
        const geo = window.FrameRenderer.getFrameGeometry(displayW, displayH, state.settings.frameType, state.settings.frameScale, state.settings);
        displayW = geo.width;
        displayH = geo.height;
      }
    }

    const scaleX = availW / displayW;
    const scaleY = availH / displayH;

    // Llena todo el alto y ancho disponible sin recortar la foto (vista completa siempre visible)
    state.zoom = Math.min(scaleX, scaleY);
    state.panX = 0;
    state.panY = Math.round((topToolbarOffset - bottomBarHeight - slideNavOffset) * 0.5);

    applyCanvasTransform();
    syncZoomControls();
    if (state.carouselActive) updateCanvaSlideNavBar();
    state.viewIsFit = true;
    requestRender();
  }

  function focusOnCarouselSlide(slideIndex) {
    if (!state.carouselActive || !window.CarouselEngine) return;
    const strip = window.CarouselEngine.getStripDimensions(1200);

    if (slideIndex < 0 || slideIndex >= strip.slideCount) {
      window.CarouselEngine.state.focusedSlideIndex = -1;
      fitViewCentered();
      return;
    }

    window.CarouselEngine.state.focusedSlideIndex = slideIndex;
    const viewportRect = canvasViewport.getBoundingClientRect();
    const filmstripBar = document.getElementById('bottomFilmstripBar');
    const bottomBarHeight = (filmstripBar && filmstripBar.style.display !== 'none') ? (filmstripBar.offsetHeight || 72) : 0;
    const topToolbarOffset = 54;
    const slideNavOffset = 46;

    const availH = Math.max(160, viewportRect.height - topToolbarOffset - bottomBarHeight - slideNavOffset - 40);
    const availW = Math.max(200, viewportRect.width - 80);

    // Zoom cómodo para ver la diapositiva grande con contexto lateral de sus vecinas
    const targetZoom = Math.min(availH / strip.totalH, (availW * 0.65) / strip.cellW);
    state.zoom = Math.max(0.15, Math.min(3.5, targetZoom));

    const slideCenterX = (slideIndex + 0.5) * strip.cellW;
    state.panX = -Math.round((slideCenterX - strip.totalW * 0.5) * state.zoom);
    state.panY = Math.round((topToolbarOffset - bottomBarHeight - slideNavOffset) * 0.5);

    applyCanvasTransform();
    syncZoomControls();
    updateCanvaSlideNavBar();
    state.viewIsFit = false;
    requestRender();
  }

  function setZoomPercent(percent) {
    state.viewIsFit = false;
    state.zoom = Math.min(6.0, Math.max(0.08, percent / 100.0));
    applyCanvasTransform();
    syncZoomControls();
    requestRender();
  }

  function syncZoomControls() {
    const pct = Math.round(state.zoom * 100);
    const slider = document.getElementById('topZoomSlider');
    const readout = document.getElementById('zoomReadout');
    if (slider) slider.value = pct;
    if (readout) readout.textContent = `${pct}%`;
  }

  function applyCanvasTransform() {
    if (!canvas) return;
    canvas.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
    updateCropOverlayPosition();
    updateAnchorGizmoPosition();
    updateCompareSplitter();
  }

  // =========================================================================
  // BUCLE DE RENDERIZADO WEBGL2 Y COMPOSICIÓN DE MARCOS/CARRUSEL
  // =========================================================================
  let renderRequested = false;

  function requestRender() {
    if (renderRequested) return;
    renderRequested = true;
    requestAnimationFrame(() => {
      renderRequested = false;
      renderFrame();
    });
  }

  function renderFrame() {
    // Si estamos en modo carrusel pero aún no hay foto cargada, dibujar la plantilla o lienzo del carrusel igualmente
    if (state.carouselActive && window.CarouselEngine && (!state.imageSource || !pipeline)) {
      window.CarouselEngine.renderCarouselStrip(displayCtx, null, { activeSourcePhotoId: null });
      return;
    }

    if (!state.imageSource || !pipeline) return;

    const cropped = pipeline.getCroppedDimensions(state.rawWidth, state.rawHeight, state.settings);
    const maxViewportDim = 2800;
    const scale = Math.min(1.0, maxViewportDim / Math.max(cropped.width, cropped.height));
    const targetW = Math.max(1, Math.round(cropped.width * scale));
    const targetH = Math.max(1, Math.round(cropped.height * scale));

    const effectiveSettings = getEffectiveSettings(state.settings);
    const splitActive = state.compareSplit && !state.beforeAfter && !state.carouselActive;

    // 1. Renderizar foto base con ajustes en WebGL2
    pipeline.render(effectiveSettings, targetW, targetH, {
      bypassAll: state.beforeAfter,
      ignoreCrop: false,
      splitPos: splitActive ? state.splitPos : undefined
    });

    // 2. Si el modo Carrusel está activo: componer tira del carrusel
    if (state.carouselActive && window.CarouselEngine) {
      let photoSource = pipeline.canvas;
      if (!state.beforeAfter && window.FrameRenderer && window.FrameRenderer.hasActiveOverlays(effectiveSettings)) {
        const framedCanvas = document.createElement('canvas');
        window.FrameRenderer.compositeFrame(framedCanvas, pipeline.canvas, effectiveSettings.frameType, {
          settings: effectiveSettings,
          borderScale: effectiveSettings.frameScale
        });
        photoSource = framedCanvas;
      }
      const activeLoaded = state.loadedPhotos[state.activePhotoIndex];
      window.CarouselEngine.renderCarouselStrip(displayCtx, photoSource, {
        activeSourcePhotoId: activeLoaded ? activeLoaded.id : null
      });
    }
    // 3. Si hay borde analógico, light leak, desgastado o ruido sucio activo en modo normal: componer
    else if (!state.beforeAfter && window.FrameRenderer && window.FrameRenderer.hasActiveOverlays(effectiveSettings)) {
      window.FrameRenderer.compositeFrame(canvas, pipeline.canvas, effectiveSettings.frameType, {
        settings: effectiveSettings,
        borderScale: effectiveSettings.frameScale
      });
      // En la vista dividida, el lado "Antes" no debe llevar texturas ni fugas de luz
      if (splitActive) restoreBeforeRegion(effectiveSettings);
    }
    // 4. Modo fotográfico estándar directo
    else {
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      displayCtx.clearRect(0, 0, targetW, targetH);
      displayCtx.drawImage(pipeline.canvas, 0, 0);
    }

    updateCompareSplitter();
    if (!state.carouselActive) scheduleHistogram();
    scheduleSettingsSettled();
  }

  // Vuelve a pintar la parte izquierda (original sin efectos) sobre la composición con texturas
  function restoreBeforeRegion(eff) {
    const src = pipeline.canvas;
    const sw = Math.round(src.width * state.splitPos);
    if (sw <= 0) return;
    let dx = 0, dy = 0, dw = canvas.width, dh = canvas.height;
    const FR = window.FrameRenderer;
    if (eff.frameEnabled !== false && FR.isBorderActive(eff.frameType)) {
      const geo = FR.getFrameGeometry(src.width, src.height, eff.frameType, eff.frameScale, eff);
      if (geo.isMultiWin) return;
      dx = geo.photoX;
      dy = geo.photoY;
      dw = geo.photoW;
      dh = geo.photoH;
    }
    displayCtx.drawImage(src, 0, 0, sw, src.height, dx, dy, dw * (sw / src.width), dh);
  }

  // =========================================================================
  // PILA DE HISTORIAL UNIVERSAL (DESHACER Cmd+Z / REHACER Cmd+Shift+Z)
  // =========================================================================
  function createSnapshotObject() {
    return {
      activePhotoIndex: state.activePhotoIndex,
      carouselActive: state.carouselActive,
      settings: JSON.parse(JSON.stringify(state.settings)),
      perPhotoSettings: state.loadedPhotos.map(lp => ({
        id: lp.id,
        settings: JSON.parse(JSON.stringify(lp.settings || getDefaultSettings()))
      })),
      carouselState: window.CarouselEngine ? window.CarouselEngine.serializeState() : null
    };
  }

  function updateHistoryButtonsUI() {
    const canUndo = state.undoStack.length > 0;
    const canRedo = state.redoStack.length > 0;

    const btnTopUndo = document.getElementById('btnTopUndo');
    const btnTopRedo = document.getElementById('btnTopRedo');
    const btnCanvaUndo = document.getElementById('btnCanvaUndo');
    const btnCanvaRedo = document.getElementById('btnCanvaRedo');

    if (btnTopUndo) btnTopUndo.disabled = !canUndo;
    if (btnTopRedo) btnTopRedo.disabled = !canRedo;
    if (btnCanvaUndo) btnCanvaUndo.disabled = !canUndo;
    if (btnCanvaRedo) btnCanvaRedo.disabled = !canRedo;
  }

  function saveSnapshot(customSnapObj = null) {
    const snap = customSnapObj || createSnapshotObject();
    state.undoStack.push(snap);
    if (state.undoStack.length > 60) state.undoStack.shift();
    state.redoStack = [];
    updateHistoryButtonsUI();
  }

  function applySnapshotObject(snap) {
    if (!snap) return;

    // 1. Restaurar ajustes individuales de cada foto cargada
    if (Array.isArray(snap.perPhotoSettings)) {
      snap.perPhotoSettings.forEach(ps => {
        const match = state.loadedPhotos.find(lp => lp.id === ps.id);
        if (match && ps.settings) {
          match.settings = JSON.parse(JSON.stringify(ps.settings));
        }
      });
    }

    // 2. Restaurar foto activa y sus ajustes WebGL
    if (typeof snap.activePhotoIndex === 'number' && snap.activePhotoIndex >= 0 && snap.activePhotoIndex < state.loadedPhotos.length) {
      if (state.activePhotoIndex !== snap.activePhotoIndex) {
        selectPhotoByIndex(snap.activePhotoIndex, { preserveView: true });
      }
    }
    if (snap.settings) {
      state.settings = JSON.parse(JSON.stringify(snap.settings));
      if (state.loadedPhotos[state.activePhotoIndex]) {
        state.loadedPhotos[state.activePhotoIndex].settings = JSON.parse(JSON.stringify(snap.settings));
      }
    }

    // 3. Restaurar estado completo del carrusel (plantilla, huecos, posiciones, recortes, escalas, capas)
    if (snap.carouselState && window.CarouselEngine) {
      window.CarouselEngine.restoreState(snap.carouselState, state.loadedPhotos);
      document.querySelectorAll('[data-cslides]').forEach(b => {
        b.classList.toggle('active', String(b.dataset.cslides) === String(window.CarouselEngine.state.slideCount));
      });
      document.querySelectorAll('[data-cratio]').forEach(b => {
        b.classList.toggle('active', b.dataset.cratio === window.CarouselEngine.state.ratioKey);
      });
      document.querySelectorAll('[data-cmode]').forEach(b => {
        b.classList.toggle('active', b.dataset.cmode === window.CarouselEngine.state.mode);
      });
    }

    updateUIFromSettings();
    if (state.carouselActive) {
      updateCarouselCellUI();
      updateCarouselLabels();
      updateTemplateUI();
    }
    renderBottomFilmstrip();
    updateHistoryButtonsUI();
    requestRender();
  }

  function undo() {
    if (state.undoStack.length === 0) {
      showToast('No hay nada que deshacer');
      return;
    }
    const curr = createSnapshotObject();
    state.redoStack.push(curr);
    const prev = state.undoStack.pop();
    applySnapshotObject(prev);
    showToast('Deshecho');
  }

  function redo() {
    if (state.redoStack.length === 0) {
      showToast('No hay nada que rehacer');
      return;
    }
    const curr = createSnapshotObject();
    state.undoStack.push(curr);
    const next = state.redoStack.pop();
    applySnapshotObject(next);
    showToast('Rehecho');
  }

  // =========================================================================
  // HERRAMIENTAS Y MODO RECORTE
  // =========================================================================
  function setTool(toolName) {
    state.activeTool = toolName;
    if (canvasViewport) canvasViewport.classList.toggle('anchor-mode', toolName === 'anchor');
    const cropOverlay = document.getElementById('cropOverlay');

    if (toolName === 'crop') {
      cropOverlay.classList.add('visible');
      updateCropOverlayPosition();
    } else {
      cropOverlay.classList.remove('visible');
      requestRender();
    }
  }

  function toggleCropMode(forceState) {
    let shouldEnable = forceState !== undefined ? forceState : state.activeTool !== 'crop';
    if (shouldEnable && (!state.imageSource || state.carouselActive)) shouldEnable = false;
    if (shouldEnable && state.compareSplit) setCompareSplit(false);
    setTool(shouldEnable ? 'crop' : (state.activeTab === 'motion' && state.settings.anchorEnabled ? 'anchor' : 'pan'));
    const sw = document.getElementById('switchCropMode');
    if (sw) sw.checked = shouldEnable;
    if (!shouldEnable) persistActiveSettings();
  }

  function updateCropOverlayPosition() {
    const overlay = document.getElementById('cropOverlay');
    if (!overlay || state.activeTool !== 'crop' || !canvas) return;

    const crop = state.settings.crop || { x: 0, y: 0, w: 1, h: 1 };
    const canvasRect = canvas.getBoundingClientRect();
    const viewportRect = canvasViewport.getBoundingClientRect();

    const left = canvasRect.left - viewportRect.left + (crop.x * canvasRect.width);
    const top = canvasRect.top - viewportRect.top + (crop.y * canvasRect.height);
    const width = crop.w * canvasRect.width;
    const height = crop.h * canvasRect.height;

    overlay.style.left = `${left}px`;
    overlay.style.top = `${top}px`;
    overlay.style.width = `${width}px`;
    overlay.style.height = `${height}px`;
  }

  function applyCropRatio(ratioKey) {
    saveSnapshot();
    state.settings.cropRatio = ratioKey;
    document.querySelectorAll('#sectionCropCard [data-ratio]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.ratio === ratioKey);
    });

    if (ratioKey === 'free') return;

    let targetRatio = 1.0;
    const origRatio = state.rawWidth / Math.max(1, state.rawHeight);

    if (ratioKey === 'orig') targetRatio = origRatio;
    else if (ratioKey === '1:1') targetRatio = 1.0;
    else if (ratioKey === '4:5') targetRatio = 4.0 / 5.0;
    else if (ratioKey === '3:2') targetRatio = 3.0 / 2.0;
    else if (ratioKey === '16:9') targetRatio = 16.0 / 9.0;
    else if (ratioKey === '9:16') targetRatio = 9.0 / 16.0;
    else if (ratioKey === '2:3') targetRatio = 2.0 / 3.0;

    const imgAspect = state.rawWidth / Math.max(1, state.rawHeight);
    let newW = 1.0;
    let newH = 1.0;

    if (targetRatio > imgAspect) {
      newW = 1.0;
      newH = (newW * imgAspect) / targetRatio;
    } else {
      newH = 1.0;
      newW = (newH * targetRatio) / imgAspect;
    }

    newW = Math.min(1.0, Math.max(0.1, newW));
    newH = Math.min(1.0, Math.max(0.1, newH));

    state.settings.crop = {
      x: (1.0 - newW) * 0.5,
      y: (1.0 - newH) * 0.5,
      w: newW,
      h: newH
    };
    if (state.loadedPhotos[state.activePhotoIndex]) {
      state.loadedPhotos[state.activePhotoIndex].settings = { ...state.settings };
    }

    updateCropOverlayPosition();
    requestRender();
  }

  function flipCropRatio() {
    saveSnapshot();
    const crop = state.settings.crop;
    const cx = crop.x + crop.w * 0.5;
    const cy = crop.y + crop.h * 0.5;

    const newW = Math.min(1.0, crop.h);
    const newH = Math.min(1.0, crop.w);

    state.settings.crop = {
      x: Math.max(0.0, Math.min(1.0 - newW, cx - newW * 0.5)),
      y: Math.max(0.0, Math.min(1.0 - newH, cy - newH * 0.5)),
      w: newW,
      h: newH
    };
    if (state.loadedPhotos[state.activePhotoIndex]) {
      state.loadedPhotos[state.activePhotoIndex].settings = { ...state.settings };
    }

    updateCropOverlayPosition();
    requestRender();
    showToast('Proporción invertida');
  }

  // =========================================================================
  // GIZMO DE SUJETO NÍTIDO (ANCLA)
  // =========================================================================
  function updateAnchorGizmoPosition() {
    const gizmo = document.getElementById('anchorGizmo');
    if (!gizmo || !state.settings.anchorEnabled || !canvas) {
      if (gizmo) gizmo.classList.remove('visible');
      return;
    }

    const canvasRect = canvas.getBoundingClientRect();
    const viewportRect = canvasViewport.getBoundingClientRect();

    const u = state.settings.anchorX;
    const v = state.settings.anchorY;

    const px = canvasRect.left - viewportRect.left + u * canvasRect.width;
    const py = canvasRect.top - viewportRect.top + v * canvasRect.height;

    const rPx = Math.max(16, (state.settings.anchorRadius / 100.0) * canvasRect.width * 0.25);

    gizmo.style.left = `${px}px`;
    gizmo.style.top = `${py}px`;
    gizmo.style.width = `${rPx * 2}px`;
    gizmo.style.height = `${rPx * 2}px`;
    gizmo.classList.add('visible');
  }

  // =========================================================================
  // MODO CARRUSEL (CAROUSEL ENGINE TOGGLE Y ACTUALIZACIÓN UI)
  // =========================================================================
  function toggleCarouselMode() {
    state.carouselActive = !state.carouselActive;

    const btnTop = document.getElementById('btnToggleCarousel');
    const card = document.getElementById('sectionCarouselCard');
    const tmplCard = document.getElementById('sectionCarouselTemplatesCard');
    const exportLabel = document.getElementById('labelExportBtn');
    const canvaToolbar = document.getElementById('canvaFloatingToolbar');
    const canvaSlideNav = document.getElementById('canvaSlideNavBar');
    const dropzone = document.getElementById('dropzoneOverlay');

    if (btnTop) btnTop.classList.toggle('active', state.carouselActive);

    if (state.carouselActive) {
      if (dropzone) dropzone.style.display = 'none';
      if (canvaToolbar) canvaToolbar.style.display = 'flex';
      if (canvaSlideNav) canvaSlideNav.style.display = 'flex';
      if (card) card.style.display = 'flex';
      if (tmplCard) tmplCard.style.display = 'flex';
      const cta = document.getElementById('carouselCtaCard');
      if (cta) cta.style.display = 'none';
      if (exportLabel) exportLabel.textContent = 'Exportar carrusel';
      if (state.activeTool === 'crop') toggleCropMode(false);
      if (state.compareSplit) setCompareSplit(false);
      activateTab('carousel');

      initTemplatePreviewCanvases();

      // Si no hay fotos en el carrusel pero sí fotos cargadas y NO hay plantilla activa, sincronizarlas
      if (window.CarouselEngine) {
        if (!window.CarouselEngine.state.activeTemplateId && window.CarouselEngine.state.photos.length === 0 && state.loadedPhotos.length > 0) {
          state.loadedPhotos.forEach((p, idx) => {
            window.CarouselEngine.addPhoto(p.canvas, p.fileName, idx % window.CarouselEngine.state.slideCount, p.floatData, p.id);
          });
        } else if (!window.CarouselEngine.state.activeTemplateId && window.CarouselEngine.state.photos.length === 0 && pipeline && pipeline.canvas && pipeline.canvas.width > 0) {
          window.CarouselEngine.addPhoto(pipeline.canvas, state.fileName || 'Foto 1', 0, state.imageSource, 'initial_photo');
        }
        if (window.CarouselEngine.state.photos.length > 0 && window.CarouselEngine.state.selectedPhotoIndex < 0) {
          window.CarouselEngine.setSelectedPhoto(0);
        }
      }

      updateCarouselCellUI();
      updateCarouselLabels();
      updateTemplateUI();
      updateCanvaSlideNavBar();
      updateCanvaFloatingToolbar();
      showToast('Modo carrusel: elige una plantilla o coloca tus fotos libremente');
    } else {
      if (canvaToolbar) canvaToolbar.style.display = 'none';
      if (canvaSlideNav) canvaSlideNav.style.display = 'none';
      if (card) card.style.display = 'none';
      if (tmplCard) tmplCard.style.display = 'none';
      const cta = document.getElementById('carouselCtaCard');
      if (cta) cta.style.display = '';
      if (exportLabel) exportLabel.textContent = 'Exportar';
      if (!state.imageSource && dropzone) dropzone.style.display = 'flex';
      canvasViewport.style.cursor = '';
      showToast('Modo foto individual');
    }

    document.getElementById('integratedSidebar')?.classList.toggle('carousel-mode', state.carouselActive);
    const histo = document.getElementById('histogramPanel');
    if (histo) histo.style.opacity = state.carouselActive ? '0.35' : '';
    renderBottomFilmstrip();
    refreshEditIndicators();
    fitViewCentered();
    requestRender();
  }

  function updateCanvaFloatingToolbar() {
    const bar = document.getElementById('canvaFloatingToolbar');
    if (!bar || !window.CarouselEngine) return;
    if (!state.carouselActive) {
      bar.style.display = 'none';
      return;
    }
    bar.style.display = 'flex';

    const labelEl = document.getElementById('canvaToolbarActiveLabel');
    const btnCrop = document.getElementById('btnCanvaToolbarCrop');
    const labelCrop = document.getElementById('labelCanvaToolbarCrop');
    const photo = window.CarouselEngine.getSelectedPhoto();
    const selSlotId = window.CarouselEngine.state.selectedSlotId;
    const slots = window.CarouselEngine.getTemplateSlots();

    if (photo) {
      const slot = photo.slotId ? slots.find(s => s.id === photo.slotId) : null;
      if (labelEl) {
        labelEl.textContent = slot ? slot.label : (photo.fileName || 'Foto seleccionada');
      }
      if (btnCrop) {
        btnCrop.style.display = 'inline-flex';
        btnCrop.classList.toggle('active', !!photo.isCropMode);
      }
      if (labelCrop) {
        labelCrop.textContent = photo.isCropMode ? 'Listo' : 'Encuadrar';
      }
    } else if (selSlotId) {
      const slot = slots.find(s => s.id === selSlotId);
      if (labelEl) {
        labelEl.textContent = slot ? `Hueco: ${slot.label}` : 'Hueco seleccionado';
      }
      if (btnCrop) btnCrop.style.display = 'none';
    } else {
      const tmpl = window.CarouselEngine.getActiveTemplate();
      if (labelEl) {
        labelEl.textContent = tmpl ? tmpl.name.split('—')[0].trim() : 'Lienzo del carrusel';
      }
      if (btnCrop) btnCrop.style.display = 'none';
    }
  }

  function updateCanvaSlideNavBar() {
    const navBar = document.getElementById('canvaSlideNavBar');
    const pillsWrap = document.getElementById('canvaSlideNavPills');
    const btnFull = document.getElementById('btnSlideNavFull');
    if (!navBar || !pillsWrap || !window.CarouselEngine) return;

    if (!state.carouselActive) {
      navBar.style.display = 'none';
      return;
    }
    navBar.style.display = 'flex';

    const count = window.CarouselEngine.state.slideCount || 3;
    const focused = window.CarouselEngine.state.focusedSlideIndex;

    if (btnFull) {
      btnFull.classList.toggle('active', focused === -1 || focused === undefined);
    }

    pillsWrap.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const pill = document.createElement('button');
      pill.className = `slide-nav-pill ${focused === i ? 'active' : ''}`;
      pill.textContent = `${i + 1}`;
      pill.title = `Ampliar la diapositiva ${i + 1}`;
      pill.addEventListener('click', () => {
        if (window.CarouselEngine.state.focusedSlideIndex === i) {
          focusOnCarouselSlide(-1);
        } else {
          focusOnCarouselSlide(i);
        }
      });
      pillsWrap.appendChild(pill);
    }
  }

  function updateTemplateUI() {
    if (!window.CarouselEngine) return;
    const activeId = window.CarouselEngine.state.activeTemplateId;
    const cards = document.querySelectorAll('.template-card');
    cards.forEach(card => {
      const id = card.dataset.template;
      if ((!activeId && id === 'free') || (activeId === id)) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });

    const tmpl = window.CarouselEngine.getActiveTemplate();
    const status = document.getElementById('templateSlotsStatus');
    const shortLabel = document.getElementById('labelCurrentTemplateShort');
    const badge = document.getElementById('badgeActiveTemplate');

    if (tmpl) {
      const slots = window.CarouselEngine.getTemplateSlots();
      const filledCount = slots.filter(s => s.photoId && window.CarouselEngine.state.photos.some(p => p.id === s.photoId)).length;
      if (status) status.textContent = `${filledCount} de ${slots.length} marcos con foto`;
      if (shortLabel) shortLabel.textContent = `${tmpl.name.split('—')[0].trim()} · ${filledCount}/${slots.length}`;
      if (badge) badge.textContent = `${tmpl.slideCount} · ${tmpl.ratioKey}`;
    } else {
      if (status) status.textContent = 'Modo libre (elige una plantilla)';
      if (shortLabel) shortLabel.textContent = 'Modo libre';
      if (badge) badge.textContent = '7 estilos';
    }

    updateCanvaFloatingToolbar();
    updateCanvaSlideNavBar();
  }

  function updateCarouselLabels() {
    if (!window.CarouselEngine) return;
    const count = window.CarouselEngine.state.slideCount;
    const rKey = window.CarouselEngine.state.ratioKey;
    const lbl = document.getElementById('btnExportCarouselLabel');
    if (lbl) lbl.textContent = `Exportar ${count} diapositivas · ${rKey}`;
    updateCanvaSlideNavBar();
  }

  function updateCarouselCellUI() {
    if (!window.CarouselEngine) return;
    const mode = window.CarouselEngine.state.mode;
    const boxCell = document.getElementById('boxCellControls');
    const rowPan = document.getElementById('rowCarouselPan');
    const rowZoom = document.getElementById('rowCarouselZoom');

    if (mode === 'seamless') {
      if (boxCell) boxCell.style.display = 'none';
      if (rowPan) rowPan.style.display = 'flex';
      if (rowZoom) rowZoom.style.display = 'flex';
      updateCanvaFloatingToolbar();
      return;
    }

    if (boxCell) boxCell.style.display = 'flex';
    if (rowPan) rowPan.style.display = 'none';
    if (rowZoom) rowZoom.style.display = 'none';

    const photoIdx = window.CarouselEngine.state.selectedPhotoIndex;
    const photo = window.CarouselEngine.getSelectedPhoto();

    const title = document.getElementById('labelActiveCellTitle');
    if (title) {
      if (photo) {
        const slot = photo.slotId ? window.CarouselEngine.getTemplateSlots().find(s => s.id === photo.slotId) : null;
        title.textContent = slot ? `${slot.label} · ${photo.fileName || 'Foto'}` : `Foto ${photoIdx + 1} · ${photo.fileName || 'Sin título'}`;
      } else if (window.CarouselEngine.state.selectedSlotId) {
        const slot = window.CarouselEngine.getTemplateSlots().find(s => s.id === window.CarouselEngine.state.selectedSlotId);
        title.textContent = slot ? `Hueco vacío: ${slot.label}` : 'Hueco vacío seleccionado';
      } else {
        title.textContent = 'Haz clic en un marco o foto';
      }
    }

    // Renderizar chips de fotos: [Foto 1] [Foto 2]...
    const container = document.getElementById('cellSelectorButtons');
    if (container) {
      container.innerHTML = '';
      const photos = window.CarouselEngine.state.photos;
      if (photos.length === 0) {
        container.innerHTML = '<span>Haz clic en un hueco del lienzo o arrastra tus fotos desde el carrete</span>';
      } else {
        photos.forEach((p, i) => {
          const chip = document.createElement('button');
          chip.className = `photo-chip ${i === photoIdx ? 'active' : ''}`;
          chip.textContent = `${i + 1} · ${p.fileName ? p.fileName.replace(/\.[^/.]+$/, '').slice(0, 12) : 'Foto'}`;
          chip.title = `Seleccionar ${p.fileName || `Foto ${i + 1}`}`;
          chip.addEventListener('click', () => {
            selectCarouselPhotoByIndex(i);
          });
          container.appendChild(chip);
        });
      }
    }

    // Actualizar controles de recorte de foto en carrusel
    const btnToggleCrop = document.getElementById('btnTogglePhotoCrop');
    const labelToggleCrop = document.getElementById('labelTogglePhotoCrop');
    const badgeCropStatus = document.getElementById('badgeCropStatus');
    const cropSection = document.getElementById('carouselCropSection');

    if (photo && photo.isCropMode) {
      if (btnToggleCrop) btnToggleCrop.classList.add('active');
      if (labelToggleCrop) labelToggleCrop.textContent = 'Confirmar encuadre';
      if (badgeCropStatus) {
        badgeCropStatus.textContent = 'Activo';
        badgeCropStatus.classList.add('on');
      }
      if (cropSection) cropSection.classList.add('active-mode');
    } else {
      if (btnToggleCrop) btnToggleCrop.classList.remove('active');
      if (labelToggleCrop) labelToggleCrop.textContent = 'Reencuadrar dentro del marco';
      if (badgeCropStatus) {
        badgeCropStatus.textContent = 'Inactivo';
        badgeCropStatus.classList.remove('on');
      }
      if (cropSection) cropSection.classList.remove('active-mode');
    }

    updateCellSlidersFromState();
    updateCanvaFloatingToolbar();
  }

  function updateCellSlidersFromState() {
    const photo = window.CarouselEngine.getSelectedPhoto();
    if (!photo) return;
    const strip = window.CarouselEngine.getStripDimensions(1200);

    const slZoom = document.getElementById('sliderCellZoom');
    const vZoom = document.getElementById('valCellZoom');
    if (slZoom) {
      slZoom.value = Math.round((photo.scale || 1.0) * 100);
      if (vZoom) vZoom.textContent = `${slZoom.value} %`;
    }

    const slPanX = document.getElementById('sliderCellPanX');
    const vPanX = document.getElementById('valCellPanX');
    if (slPanX) {
      slPanX.max = strip.totalW;
      slPanX.value = Math.round(photo.x || 0);
      if (vPanX) vPanX.textContent = `${slPanX.value} px`;
    }

    const slPanY = document.getElementById('sliderCellPanY');
    const vPanY = document.getElementById('valCellPanY');
    if (slPanY) {
      slPanY.max = strip.totalH;
      slPanY.value = Math.round(photo.y || 0);
      if (vPanY) vPanY.textContent = `${slPanY.value} px`;
    }

    updateTemplateUI();
  }

  // =========================================================================
  // GESTIÓN DE PERFILES DE PELÍCULA ANALÓGICA
  // =========================================================================
  // Devuelve una copia de "base" con el perfil aplicado (sin tocar el estado). Se usa tanto
  // para aplicar el perfil como para dibujar sus miniaturas de vista previa.
  function withFilmProfile(base, profileKey) {
    const s = cloneDeep(base);
    s.basicsEnabled = true;

    if (!profileKey || !FILM_PROFILES[profileKey]) {
      s.activeFilmProfile = null;
      s.temperature = 0;
      s.tint = 0;
      s.contrast = 0;
      s.highlights = 0;
      s.shadows = 0;
      s.whites = 0;
      s.blacks = 0;
      s.clarity = 0;
      s.saturation = 0;
      s.vibrance = 0;
      s.shadowFade = 0.0;
      s.highlightRollOff = 1.0;
      s.channelCurve = [0.0, 0.0, 0.0];
      s.isBlackAndWhite = false;
      s.bwMixer = [0.0, 0.0, 0.0, 0.0];
      s.hslReds = [0, 0, 0];
      s.hslOranges = [0, 0, 0];
      s.hslYellows = [0, 0, 0];
      s.hslGreens = [0, 0, 0];
      s.hslAquas = [0, 0, 0];
      s.hslBlues = [0, 0, 0];
      s.calibRed = [0, 0, 0];
      s.calibGreen = [0, 0, 0];
      s.calibBlue = [0, 0, 0];
      s.grainAmount = 0;
      return s;
    }

    const p = FILM_PROFILES[profileKey];
    s.activeFilmProfile = profileKey;
    s.temperature = p.temperature;
    s.tint = p.tint;
    s.contrast = p.contrast;
    s.highlights = p.highlights;
    s.shadows = p.shadows;
    s.whites = p.whites !== undefined ? p.whites : 0;
    s.blacks = p.blacks !== undefined ? p.blacks : 0;
    s.clarity = p.clarity !== undefined ? p.clarity : 0;
    s.saturation = p.saturation;
    s.vibrance = p.vibrance;
    s.shadowFade = p.shadowFade;
    s.highlightRollOff = p.highlightRollOff !== undefined ? p.highlightRollOff : 1.0;
    s.channelCurve = [...p.channelCurve];
    s.isBlackAndWhite = p.isBlackAndWhite;
    s.bwMixer = [...p.bwMixer];
    s.hslReds = [...p.hslReds];
    s.hslOranges = [...p.hslOranges];
    s.hslYellows = [...p.hslYellows];
    s.hslGreens = [...p.hslGreens];
    s.hslAquas = p.hslAquas ? [...p.hslAquas] : [0, 0, 0];
    s.hslBlues = [...p.hslBlues];
    s.calibRed = p.calibRed ? [...p.calibRed] : [0, 0, 0];
    s.calibGreen = p.calibGreen ? [...p.calibGreen] : [0, 0, 0];
    s.calibBlue = p.calibBlue ? [...p.calibBlue] : [0, 0, 0];
    if (p.grainEnabled !== undefined) {
      s.grainEnabled = p.grainEnabled;
      s.grainAmount = p.grainAmount;
      s.grainSize = p.grainSize;
      s.grainRoughness = p.grainRoughness;
    }
    return s;
  }

  function applyFilmProfile(profileKey) {
    if (!state.imageSource) {
      showToast('Abre primero una foto para aplicarle un perfil');
      return;
    }
    saveSnapshot();
    state.settings = withFilmProfile(state.settings, profileKey);
    persistActiveSettings();
    updateUIFromSettings();
    requestRender();
    const p = FILM_PROFILES[profileKey];
    showToast(p ? `Perfil ${p.name}` : 'Perfil quitado: colores originales');
  }

  // =========================================================================
  // MINIATURAS DE PERFILES CON VISTA PREVIA REAL DE LA FOTO
  // Se usa un segundo motor WebGL pequeño con una copia reducida de la foto para no
  // interferir con el visor principal.
  // =========================================================================
  let thumbPipeline = null;
  let thumbPipelinePhotoId = null;
  let profileThumbTimer = null;
  let lastProfileThumbSignature = '';

  function scheduleProfileThumbnails(delay = 400) {
    clearTimeout(profileThumbTimer);
    profileThumbTimer = setTimeout(renderProfileThumbnails, delay);
  }

  function getThumbSourceFloat(photo, maxDim = 320) {
    if (photo.thumbFloat && photo.thumbFloatW) return photo;
    const src = photo.canvas;
    const scale = Math.min(1, maxDim / Math.max(src.width, src.height));
    const w = Math.max(1, Math.round(src.width * scale));
    const h = Math.max(1, Math.round(src.height * scale));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    const f = new Float32Array(w * h * 4);
    const inv = 1 / 255;
    for (let i = 0; i < d.length; i++) f[i] = d[i] * inv;
    photo.thumbFloat = f;
    photo.thumbFloatW = w;
    photo.thumbFloatH = h;
    return photo;
  }

  function renderProfileThumbnails() {
    const photo = state.loadedPhotos[state.activePhotoIndex];
    const cards = document.querySelectorAll('.film-profile-card');
    if (!photo || !photo.canvas || !cards.length) return;
    // Solo cuando la pestaña Revelar está a la vista (se recalcula al volver a ella)
    if (state.activeTab !== 'develop') return;

    const base = { ...state.settings };
    const signature = photo.id + '|' + JSON.stringify(withFilmProfile(base, null)) + '|' + JSON.stringify(GEOMETRY_KEYS.map(k => base[k]));
    if (signature === lastProfileThumbSignature) return;

    try {
      if (!thumbPipeline) {
        thumbPipeline = new window.WebGLPipeline.PipelineInstance(document.createElement('canvas'));
      }
      if (thumbPipelinePhotoId !== photo.id) {
        getThumbSourceFloat(photo);
        thumbPipeline.uploadFloatImage(photo.thumbFloat, photo.thumbFloatW, photo.thumbFloatH);
        thumbPipelinePhotoId = photo.id;
      }
    } catch (err) {
      console.warn('[mucho FILM] Miniaturas de perfiles no disponibles:', err);
      return;
    }

    const effectiveBase = getEffectiveSettings(base);
    cards.forEach(card => {
      const key = card.dataset.profile;
      const thumb = card.querySelector('canvas.profile-thumb');
      if (!thumb) return;
      const s = getEffectiveSettings(withFilmProfile(effectiveBase, key === 'none' ? null : key));
      s.motionLength = 0; // el movimiento a este tamaño solo emborrona la miniatura
      const dims = thumbPipeline.getCroppedDimensions(photo.thumbFloatW, photo.thumbFloatH, s);
      const k = Math.min(1, 256 / Math.max(dims.width, dims.height));
      const tw = Math.max(1, Math.round(dims.width * k));
      const th = Math.max(1, Math.round(dims.height * k));
      thumbPipeline.render(s, tw, th);
      const tctx = thumb.getContext('2d');
      const size = thumb.width;
      // Recorte tipo "cover" centrado
      const sc = Math.max(size / tw, size / th);
      const dw = tw * sc;
      const dh = th * sc;
      tctx.imageSmoothingQuality = 'high';
      tctx.clearRect(0, 0, size, size);
      tctx.drawImage(thumbPipeline.canvas, (size - dw) / 2, (size - dh) / 2, dw, dh);
    });
    lastProfileThumbSignature = signature;
  }

  // Ajustes efectivos teniendo en cuenta los interruptores de cada sección
  function getEffectiveSettings(settings) {
    const eff = { ...settings };
    if (!settings.basicsEnabled) {
      SECTION_KEYS.basics.forEach(k => { eff[k] = 0; });
    }
    if (!settings.grainEnabled) eff.grainAmount = 0;
    if (!settings.motionEnabled) eff.motionLength = 0;
    if (!settings.dustEnabled) {
      eff.dirtyNoiseEnabled = false;
      eff.wearEnabled = false;
    }
    return eff;
  }

  function settingsDifferFromDefaults(s, d = getDefaultSettings()) {
    for (const k of Object.keys(d)) {
      if (k === 'basicsEnabled' || k === 'grainEnabled' || k === 'motionEnabled' || k === 'cropRatio') continue;
      if (JSON.stringify(s[k]) !== JSON.stringify(d[k])) return true;
    }
    return false;
  }

  function sectionHasEdits(section, s = state.settings, d = getDefaultSettings()) {
    if (section === 'basics' && s.activeFilmProfile) return true;
    return (SECTION_KEYS[section] || []).some(k => JSON.stringify(s[k]) !== JSON.stringify(d[k]));
  }

  // Puntos indicadores en pestañas y secciones con ajustes aplicados
  function refreshEditIndicators() {
    const d = getDefaultSettings();
    const hasPhoto = !!state.imageSource;
    Object.keys(SECTION_CARDS).forEach(section => {
      const card = document.getElementById(SECTION_CARDS[section]);
      if (card) card.classList.toggle('has-edits', hasPhoto && sectionHasEdits(section, state.settings, d));
    });
    document.querySelectorAll('.sidebar-tab').forEach(tab => {
      const sections = TAB_SECTIONS[tab.dataset.tab] || [];
      const edited = hasPhoto && sections.some(sec => sectionHasEdits(sec, state.settings, d));
      tab.classList.toggle('has-edits', tab.dataset.tab === 'carousel' ? state.carouselActive : edited);
    });
    // Punto en la miniatura activa del carrete
    const activeItem = document.querySelector('.filmstrip-thumb-item.active');
    if (activeItem) {
      const edited = hasPhoto && settingsDifferFromDefaults(state.settings, d);
      let dot = activeItem.querySelector('.filmstrip-edited-dot');
      if (edited && !dot) {
        dot = document.createElement('span');
        dot.className = 'filmstrip-edited-dot';
        dot.title = 'Foto editada';
        activeItem.appendChild(dot);
      } else if (!edited && dot) {
        dot.remove();
      }
    }
  }

  let settingsSettledTimer = null;
  // Se llama tras cada render: agrupa tareas secundarias cuando el usuario deja de mover controles
  function scheduleSettingsSettled() {
    clearTimeout(settingsSettledTimer);
    settingsSettledTimer = setTimeout(() => {
      refreshEditIndicators();
      scheduleProfileThumbnails(0);
    }, 260);
  }

  // =========================================================================
  // HISTOGRAMA
  // =========================================================================
  let histogramTimer = null;
  const histoSampleCanvas = document.createElement('canvas');

  function scheduleHistogram() {
    if (histogramTimer) return;
    histogramTimer = setTimeout(() => {
      histogramTimer = null;
      drawHistogram();
    }, 140);
  }

  function clearHistogram() {
    const hc = document.getElementById('histogramCanvas');
    if (!hc) return;
    const ctx = hc.getContext('2d');
    ctx.clearRect(0, 0, hc.width, hc.height);
  }

  function drawHistogram() {
    const hc = document.getElementById('histogramCanvas');
    if (!hc || !canvas || !canvas.width || !state.imageSource) return;
    if (hc.offsetParent === null) return; // oculto (móvil)

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = hc.clientWidth || 280;
    const cssH = hc.clientHeight || 74;
    if (hc.width !== Math.round(cssW * dpr) || hc.height !== Math.round(cssH * dpr)) {
      hc.width = Math.round(cssW * dpr);
      hc.height = Math.round(cssH * dpr);
    }

    // Muestrear una versión reducida de lo que se ve
    const sw = 240;
    const sh = Math.max(1, Math.round(sw * canvas.height / canvas.width));
    histoSampleCanvas.width = sw;
    histoSampleCanvas.height = sh;
    const sctx = histoSampleCanvas.getContext('2d', { willReadFrequently: true });
    let data;
    try {
      sctx.drawImage(canvas, 0, 0, sw, sh);
      data = sctx.getImageData(0, 0, sw, sh).data;
    } catch (err) {
      return;
    }

    const r = new Uint32Array(256);
    const g = new Uint32Array(256);
    const b = new Uint32Array(256);
    for (let i = 0; i < data.length; i += 4) {
      r[data[i]]++;
      g[data[i + 1]]++;
      b[data[i + 2]]++;
    }
    // Normalizar ignorando los extremos para que un fondo negro/blanco no aplaste la curva
    let max = 1;
    for (let i = 2; i < 254; i++) max = Math.max(max, r[i], g[i], b[i]);

    const ctx = hc.getContext('2d');
    const W = hc.width;
    const H = hc.height;
    ctx.clearRect(0, 0, W, H);
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    ctx.globalCompositeOperation = isLight ? 'multiply' : 'screen';

    const channels = isLight
      ? [[r, 'rgba(235, 70, 70, 0.55)'], [g, 'rgba(60, 185, 100, 0.55)'], [b, 'rgba(70, 130, 235, 0.55)']]
      : [[r, 'rgba(255, 80, 80, 0.62)'], [g, 'rgba(80, 210, 120, 0.62)'], [b, 'rgba(90, 150, 255, 0.62)']];

    channels.forEach(([hist, color]) => {
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let i = 0; i < 256; i++) {
        const x = (i / 255) * W;
        const v = Math.min(1, Math.sqrt(hist[i] / max));
        ctx.lineTo(x, H - v * (H - 4 * dpr));
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';

    // Avisos de recorte en sombras y luces
    const total = data.length / 4;
    const clipLow = (r[0] + g[0] + b[0]) / (3 * total);
    const clipHigh = (r[255] + g[255] + b[255]) / (3 * total);
    const mark = (x, on) => {
      if (!on) return;
      ctx.fillStyle = '#ff3b4f';
      ctx.beginPath();
      ctx.arc(x, 6 * dpr, 3 * dpr, 0, Math.PI * 2);
      ctx.fill();
    };
    mark(7 * dpr, clipLow > 0.01);
    mark(W - 7 * dpr, clipHigh > 0.01);
    hc.title = `Histograma${clipLow > 0.01 ? ' · sombras recortadas' : ''}${clipHigh > 0.01 ? ' · luces quemadas' : ''}`;
  }

  // =========================================================================
  // VINCULACIÓN DE EVENTOS DE INTERFAZ
  // =========================================================================
  function initEventListeners() {
    // 1. Control de Zoom en barra superior
    const topSlider = document.getElementById('topZoomSlider');
    topSlider.addEventListener('input', () => {
      setZoomPercent(parseInt(topSlider.value, 10));
    });

    document.getElementById('btnZoomMinus').addEventListener('click', () => {
      setZoomPercent(Math.round(state.zoom * 100) - 20);
    });
    document.getElementById('btnZoomPlus').addEventListener('click', () => {
      setZoomPercent(Math.round(state.zoom * 100) + 20);
    });
    document.getElementById('zoomReadout').addEventListener('click', fitViewCentered);

    // 1.1. Botones Fijos de Deshacer (←) y Rehacer (→) en barra superior y barra flotante
    const btnTopUndo = document.getElementById('btnTopUndo');
    const btnTopRedo = document.getElementById('btnTopRedo');
    const btnCanvaUndo = document.getElementById('btnCanvaUndo');
    const btnCanvaRedo = document.getElementById('btnCanvaRedo');
    if (btnTopUndo) btnTopUndo.addEventListener('click', undo);
    if (btnTopRedo) btnTopRedo.addEventListener('click', redo);
    if (btnCanvaUndo) btnCanvaUndo.addEventListener('click', undo);
    if (btnCanvaRedo) btnCanvaRedo.addEventListener('click', redo);
    updateHistoryButtonsUI();

    // 2. Modo carrusel
    const btnTopCar = document.getElementById('btnToggleCarousel');
    if (btnTopCar) btnTopCar.addEventListener('click', toggleCarouselMode);

    const btnCarouselCta = document.getElementById('btnCarouselCta');
    if (btnCarouselCta) {
      btnCarouselCta.addEventListener('click', () => {
        if (!state.carouselActive) toggleCarouselMode();
      });
    }

    const btnScrollTmpl = document.getElementById('btnScrollToTemplates');
    if (btnScrollTmpl) {
      btnScrollTmpl.addEventListener('click', () => scrollToCard('sectionCarouselTemplatesCard'));
    }

    // 3. Vista
    const btnFitView = document.getElementById('btnFitView');
    if (btnFitView) btnFitView.addEventListener('click', fitViewCentered);

    // 4. Mejorar automáticamente (analiza la luminosidad real de la foto)
    document.getElementById('btnAutoEnhance').addEventListener('click', () => {
      const photo = state.loadedPhotos[state.activePhotoIndex];
      if (!photo || !state.imageSource) {
        showToast('Abre primero una foto');
        return;
      }
      saveSnapshot();
      const auto = computeAutoTone(photo);
      Object.assign(state.settings, auto);
      state.settings.basicsEnabled = true;
      persistActiveSettings();
      updateUIFromSettings();
      requestRender();
      showToast(`Ajuste automático: exposición ${SLIDERS.exposure.fmt(auto.exposure)}`, { label: 'Deshacer', onAction: undo });
    });

    // 5. Interruptores (macOS Switches)
    document.getElementById('switchBasics').addEventListener('change', (e) => {
      saveSnapshot();
      state.settings.basicsEnabled = e.target.checked;
      if (state.loadedPhotos[state.activePhotoIndex]) {
        state.loadedPhotos[state.activePhotoIndex].settings = { ...state.settings };
      }
      requestRender();
    });
    document.getElementById('switchCropMode').addEventListener('change', (e) => {
      toggleCropMode(e.target.checked);
    });
    document.getElementById('switchGrain').addEventListener('change', (e) => {
      saveSnapshot();
      state.settings.grainEnabled = e.target.checked;
      if (state.loadedPhotos[state.activePhotoIndex]) {
        state.loadedPhotos[state.activePhotoIndex].settings = { ...state.settings };
      }
      requestRender();
    });
    document.getElementById('switchMotion').addEventListener('change', (e) => {
      saveSnapshot();
      state.settings.motionEnabled = e.target.checked;
      if (state.loadedPhotos[state.activePhotoIndex]) {
        state.loadedPhotos[state.activePhotoIndex].settings = { ...state.settings };
      }
      requestRender();
    });

    const switchDust = document.getElementById('switchDust');
    if (switchDust) {
      switchDust.addEventListener('change', (e) => {
        saveSnapshot();
        state.settings.dustEnabled = e.target.checked;
        if (state.settings.dustEnabled) {
          if ((!state.settings.dirtyNoiseType || state.settings.dirtyNoiseType === 'none') &&
              (!state.settings.wearType || state.settings.wearType === 'none')) {
            state.settings.dirtyNoiseType = 'dirty_01';
            state.settings.dirtyNoiseEnabled = true;
          } else {
            state.settings.dirtyNoiseEnabled = state.settings.dirtyNoiseType !== 'none';
            state.settings.wearEnabled = state.settings.wearType !== 'none';
          }
        } else {
          state.settings.dirtyNoiseEnabled = false;
          state.settings.wearEnabled = false;
        }
        if (state.loadedPhotos[state.activePhotoIndex]) {
          state.loadedPhotos[state.activePhotoIndex].settings = { ...state.settings };
        }
        updateUIFromSettings();
        requestRender();
      });
    }

    const switchLightLeak = document.getElementById('switchLightLeak');
    if (switchLightLeak) {
      switchLightLeak.addEventListener('change', (e) => {
        saveSnapshot();
        state.settings.lightLeakEnabled = e.target.checked;
        if (e.target.checked && (!state.settings.lightLeakType || state.settings.lightLeakType === 'none')) {
          state.settings.lightLeakType = 'leak_01';
        }
        if (state.loadedPhotos[state.activePhotoIndex]) {
          state.loadedPhotos[state.activePhotoIndex].settings = { ...state.settings };
        }
        updateUIFromSettings();
        requestRender();
      });
    }

    const switchFrame = document.getElementById('switchFrame');
    if (switchFrame) {
      switchFrame.addEventListener('change', (e) => {
        saveSnapshot();
        state.settings.frameEnabled = e.target.checked;
        if (e.target.checked) {
          if (!state.settings.frameType || state.settings.frameType === 'none') {
            state.settings.frameType = 'border_1';
          }
        } else {
          state.settings.frameType = 'none';
        }
        if (state.loadedPhotos[state.activePhotoIndex]) {
          state.loadedPhotos[state.activePhotoIndex].settings = { ...state.settings };
        }
        updateUIFromSettings();
        fitViewCentered();
        requestRender();
      });
    }

    // 6. Recorte y Enderezado
    const sStraighten = document.getElementById('sliderStraighten');
    const valStraighten = document.getElementById('valStraighten');
    const straightenGrid = document.getElementById('straightenGrid');
    const infoAngle = document.getElementById('infoAngle');
    let isStraightenDragging = false;

    sStraighten.addEventListener('input', () => {
      if (!isStraightenDragging) {
        saveSnapshot();
        isStraightenDragging = true;
      }
      state.settings.straighten = parseFloat(sStraighten.value);
      if (state.loadedPhotos[state.activePhotoIndex]) {
        state.loadedPhotos[state.activePhotoIndex].settings = { ...state.settings };
      }
      const str = `${state.settings.straighten >= 0 ? '+' : ''}${state.settings.straighten.toFixed(1)}°`;
      valStraighten.textContent = str;
      infoAngle.textContent = str;
      straightenGrid.classList.add('visible');
      requestRender();
    });
    sStraighten.addEventListener('change', () => {
      isStraightenDragging = false;
      if (state.loadedPhotos[state.activePhotoIndex]) {
        state.loadedPhotos[state.activePhotoIndex].settings = { ...state.settings };
      }
      straightenGrid.classList.remove('visible');
    });
    sStraighten.addEventListener('dblclick', () => {
      saveSnapshot();
      sStraighten.value = 0;
      state.settings.straighten = 0;
      if (state.loadedPhotos[state.activePhotoIndex]) {
        state.loadedPhotos[state.activePhotoIndex].settings = { ...state.settings };
      }
      valStraighten.textContent = '0.0°';
      infoAngle.textContent = '0.0°';
      straightenGrid.classList.remove('visible');
      requestRender();
    });

    document.querySelectorAll('#sectionCropCard [data-ratio]').forEach(btn => {
      btn.addEventListener('click', () => applyCropRatio(btn.dataset.ratio));
    });
    document.getElementById('btnFlipRatio').addEventListener('click', flipCropRatio);

    document.getElementById('btnRotateCW').addEventListener('click', () => {
      saveSnapshot();
      state.settings.rotateSteps = (state.settings.rotateSteps + 1) % 4;
      if (state.loadedPhotos[state.activePhotoIndex]) {
        state.loadedPhotos[state.activePhotoIndex].settings = { ...state.settings };
      }
      fitViewCentered();
      requestRender();
    });
    document.getElementById('btnRotateCCW').addEventListener('click', () => {
      saveSnapshot();
      state.settings.rotateSteps = (state.settings.rotateSteps + 3) % 4;
      if (state.loadedPhotos[state.activePhotoIndex]) {
        state.loadedPhotos[state.activePhotoIndex].settings = { ...state.settings };
      }
      fitViewCentered();
      requestRender();
    });
    document.getElementById('btnFlipH').addEventListener('click', () => {
      saveSnapshot();
      state.settings.flipH = !state.settings.flipH;
      if (state.loadedPhotos[state.activePhotoIndex]) {
        state.loadedPhotos[state.activePhotoIndex].settings = { ...state.settings };
      }
      requestRender();
    });
    document.getElementById('btnFlipV').addEventListener('click', () => {
      saveSnapshot();
      state.settings.flipV = !state.settings.flipV;
      if (state.loadedPhotos[state.activePhotoIndex]) {
        state.loadedPhotos[state.activePhotoIndex].settings = { ...state.settings };
      }
      requestRender();
    });

    // 6b. Perfiles de Película Analógica
    document.querySelectorAll('.film-profile-card').forEach(card => {
      card.addEventListener('click', () => {
        const profile = card.dataset.profile;
        if (state.settings.activeFilmProfile === profile) {
          applyFilmProfile(null);
        } else {
          applyFilmProfile(profile);
        }
      });
    });

    const btnResetFilm = document.getElementById('btnResetFilmProfile');
    if (btnResetFilm) {
      btnResetFilm.addEventListener('click', () => {
        applyFilmProfile(null);
      });
    }

    // 7. Deslizadores Básicos
    function autoEnableBasics() {
      state.settings.basicsEnabled = true;
      const sw = document.getElementById('switchBasics');
      if (sw) sw.checked = true;
      if (state.loadedPhotos[state.activePhotoIndex]) {
        state.loadedPhotos[state.activePhotoIndex].settings = { ...state.settings };
      }
    }
    bindSlider('sliderExposure', 'valExposure', 'exposure', SLIDERS.exposure.fmt, SLIDERS.exposure.def, autoEnableBasics);
    bindSlider('sliderHighlights', 'valHighlights', 'highlights', SLIDERS.highlights.fmt, SLIDERS.highlights.def, autoEnableBasics);
    bindSlider('sliderShadows', 'valShadows', 'shadows', SLIDERS.shadows.fmt, SLIDERS.shadows.def, autoEnableBasics);
    bindSlider('sliderWhites', 'valWhites', 'whites', SLIDERS.whites.fmt, SLIDERS.whites.def, autoEnableBasics);
    bindSlider('sliderBlacks', 'valBlacks', 'blacks', SLIDERS.blacks.fmt, SLIDERS.blacks.def, autoEnableBasics);
    bindSlider('sliderBrightness', 'valBrightness', 'brightness', SLIDERS.brightness.fmt, SLIDERS.brightness.def, autoEnableBasics);
    bindSlider('sliderContrast', 'valContrast', 'contrast', SLIDERS.contrast.fmt, SLIDERS.contrast.def, autoEnableBasics);
    bindSlider('sliderSaturation', 'valSaturation', 'saturation', SLIDERS.saturation.fmt, SLIDERS.saturation.def, autoEnableBasics);
    bindSlider('sliderVibrance', 'valVibrance', 'vibrance', SLIDERS.vibrance.fmt, SLIDERS.vibrance.def, autoEnableBasics);
    bindSlider('sliderTemperature', 'valTemperature', 'temperature', SLIDERS.temperature.fmt, SLIDERS.temperature.def, autoEnableBasics);
    bindSlider('sliderTint', 'valTint', 'tint', SLIDERS.tint.fmt, SLIDERS.tint.def, autoEnableBasics);
    bindSlider('sliderClarity', 'valClarity', 'clarity', SLIDERS.clarity.fmt, SLIDERS.clarity.def, autoEnableBasics);
    bindSlider('sliderSharpness', 'valSharpness', 'sharpness', SLIDERS.sharpness.fmt, SLIDERS.sharpness.def, autoEnableBasics);

    // 8. Grano Analógico
    function autoEnableGrain() {
      state.settings.grainEnabled = true;
      const sw = document.getElementById('switchGrain');
      if (sw) sw.checked = true;
      if (state.loadedPhotos[state.activePhotoIndex]) {
        state.loadedPhotos[state.activePhotoIndex].settings = { ...state.settings };
      }
    }
    bindSlider('sliderGrainAmount', 'valGrainAmount', 'grainAmount', SLIDERS.grainAmount.fmt, SLIDERS.grainAmount.def, autoEnableGrain);
    bindSlider('sliderGrainSize', 'valGrainSize', 'grainSize', SLIDERS.grainSize.fmt, SLIDERS.grainSize.def, autoEnableGrain);
    bindSlider('sliderGrainRoughness', 'valGrainRoughness', 'grainRoughness', SLIDERS.grainRoughness.fmt, SLIDERS.grainRoughness.def, autoEnableGrain);

    // 9. Movimiento Editorial
    function autoEnableMotion() {
      state.settings.motionEnabled = true;
      const sw = document.getElementById('switchMotion');
      if (sw) sw.checked = true;
      if (state.loadedPhotos[state.activePhotoIndex]) {
        state.loadedPhotos[state.activePhotoIndex].settings = { ...state.settings };
      }
    }
    document.querySelectorAll('[data-motion]').forEach(btn => {
      btn.addEventListener('click', () => {
        saveSnapshot();
        state.settings.motionType = btn.dataset.motion;
        autoEnableMotion();
        if ((state.settings.motionLength || 0) === 0) {
          state.settings.motionLength = 35;
          const sl = document.getElementById('sliderMotionLength');
          const valM = document.getElementById('valMotionLength');
          if (sl) sl.value = 35;
          if (valM) valM.textContent = '35';
        }
        document.querySelectorAll('[data-motion]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('rowMotionAngle').style.display = (state.settings.motionType === 'zoom') ? 'none' : 'flex';
        if (state.loadedPhotos[state.activePhotoIndex]) {
          state.loadedPhotos[state.activePhotoIndex].settings = { ...state.settings };
        }
        requestRender();
      });
    });

    bindSlider('sliderMotionLength', 'valMotionLength', 'motionLength', SLIDERS.motionLength.fmt, SLIDERS.motionLength.def, autoEnableMotion);
    bindSlider('sliderMotionAngle', 'valMotionAngle', 'motionAngle', SLIDERS.motionAngle.fmt, SLIDERS.motionAngle.def, autoEnableMotion);
    bindSlider('sliderFlashFreeze', 'valFlashFreeze', 'flashFreeze', SLIDERS.flashFreeze.fmt, SLIDERS.flashFreeze.def, autoEnableMotion);
    bindSlider('sliderHighlightTrails', 'valHighlightTrails', 'highlightTrails', SLIDERS.highlightTrails.fmt, SLIDERS.highlightTrails.def, autoEnableMotion);

    const btnAnchor = document.getElementById('btnToggleAnchor');
    const anchorControls = document.getElementById('anchorControls');
    btnAnchor.addEventListener('click', () => {
      saveSnapshot();
      state.settings.anchorEnabled = !state.settings.anchorEnabled;
      btnAnchor.classList.toggle('active', state.settings.anchorEnabled);
      anchorControls.style.display = state.settings.anchorEnabled ? 'flex' : 'none';
      persistActiveSettings();
      if (state.settings.anchorEnabled) {
        if (state.activeTool === 'crop') toggleCropMode(false);
        setTool('anchor');
        showToast('Haz clic o arrastra sobre el sujeto para mantenerlo nítido');
      } else if (state.activeTool === 'anchor') {
        setTool('pan');
      }
      updateAnchorGizmoPosition();
      requestRender();
    });

    bindSlider('sliderAnchorRadius', 'valAnchorRadius', 'anchorRadius', SLIDERS.anchorRadius.fmt, SLIDERS.anchorRadius.def, () => updateAnchorGizmoPosition());
    bindSlider('sliderAnchorFeather', 'valAnchorFeather', 'anchorFeather', SLIDERS.anchorFeather.fmt, SLIDERS.anchorFeather.def);

    // 10. Ruido Sucio (noise-tex-01..10) y Filtros de Desgastado (lines texture)
    function syncDustMasterSwitch() {
      const hasDirty = state.settings.dirtyNoiseEnabled && state.settings.dirtyNoiseType && state.settings.dirtyNoiseType !== 'none';
      const hasWear = state.settings.wearEnabled && state.settings.wearType && state.settings.wearType !== 'none';
      state.settings.dustEnabled = Boolean(hasDirty || hasWear);
      const sw = document.getElementById('switchDust');
      if (sw) sw.checked = state.settings.dustEnabled;
      if (state.loadedPhotos[state.activePhotoIndex]) {
        state.loadedPhotos[state.activePhotoIndex].settings = { ...state.settings };
      }
    }

    document.querySelectorAll('[data-dirty]').forEach(btn => {
      btn.addEventListener('click', () => {
        saveSnapshot();
        const type = btn.dataset.dirty;
        state.settings.dirtyNoiseType = type;
        state.settings.dirtyNoiseEnabled = (type !== 'none');
        if (type !== 'none' && (state.settings.dirtyNoiseOpacity || 0) === 0) {
          state.settings.dirtyNoiseOpacity = 65;
        }
        syncDustMasterSwitch();
        updateUIFromSettings();
        requestRender();
        showToast(type === 'none' ? 'Polvo desactivado' : `Polvo: ${btn.title}`);
      });
    });

    bindSlider('sliderDirtyNoiseOpacity', 'valDirtyNoiseOpacity', 'dirtyNoiseOpacity', SLIDERS.dirtyNoiseOpacity.fmt, SLIDERS.dirtyNoiseOpacity.def, () => {
      if (state.settings.dirtyNoiseOpacity > 0) {
        if (!state.settings.dirtyNoiseType || state.settings.dirtyNoiseType === 'none') {
          state.settings.dirtyNoiseType = 'dirty_01';
        }
        state.settings.dirtyNoiseEnabled = true;
      }
      syncDustMasterSwitch();
      updateUIFromSettings();
    });

    const btnDirtyWhite = document.getElementById('btnDirtyWhite');
    const btnDirtyBlack = document.getElementById('btnDirtyBlack');
    if (btnDirtyWhite && btnDirtyBlack) {
      btnDirtyWhite.addEventListener('click', () => {
        saveSnapshot();
        state.settings.dirtyNoiseInvert = false;
        syncDustMasterSwitch();
        updateUIFromSettings();
        requestRender();
      });
      btnDirtyBlack.addEventListener('click', () => {
        saveSnapshot();
        state.settings.dirtyNoiseInvert = true;
        syncDustMasterSwitch();
        updateUIFromSettings();
        requestRender();
      });
    }

    const btnDirtyFlipH = document.getElementById('btnDirtyFlipH');
    if (btnDirtyFlipH) {
      btnDirtyFlipH.addEventListener('click', () => {
        saveSnapshot();
        state.settings.dirtyNoiseFlipH = !state.settings.dirtyNoiseFlipH;
        syncDustMasterSwitch();
        updateUIFromSettings();
        requestRender();
      });
    }

    const btnDirtyFlipV = document.getElementById('btnDirtyFlipV');
    if (btnDirtyFlipV) {
      btnDirtyFlipV.addEventListener('click', () => {
        saveSnapshot();
        state.settings.dirtyNoiseFlipV = !state.settings.dirtyNoiseFlipV;
        syncDustMasterSwitch();
        updateUIFromSettings();
        requestRender();
      });
    }

    // 10B. Filtros de Desgastado y Líneas (noise-line-01..03 y _black)
    document.querySelectorAll('[data-wear]').forEach(btn => {
      btn.addEventListener('click', () => {
        saveSnapshot();
        const type = btn.dataset.wear;
        state.settings.wearType = type;
        state.settings.wearEnabled = (type !== 'none');
        if (type !== 'none' && (state.settings.wearOpacity || 0) === 0) {
          state.settings.wearOpacity = 65;
        }
        syncDustMasterSwitch();
        updateUIFromSettings();
        requestRender();
        showToast(type === 'none' ? 'Desgaste desactivado' : `Desgaste: ${btn.title}`);
      });
    });

    bindSlider('sliderWearOpacity', 'valWearOpacity', 'wearOpacity', SLIDERS.wearOpacity.fmt, SLIDERS.wearOpacity.def, () => {
      if (state.settings.wearOpacity > 0) {
        if (!state.settings.wearType || state.settings.wearType === 'none') {
          state.settings.wearType = 'wear_01';
        }
        state.settings.wearEnabled = true;
      }
      syncDustMasterSwitch();
      updateUIFromSettings();
    });

    const btnWearLight = document.getElementById('btnWearLight');
    const btnWearDark = document.getElementById('btnWearDark');
    if (btnWearLight && btnWearDark) {
      btnWearLight.addEventListener('click', () => {
        saveSnapshot();
        state.settings.wearInvert = false;
        syncDustMasterSwitch();
        updateUIFromSettings();
        requestRender();
      });
      btnWearDark.addEventListener('click', () => {
        saveSnapshot();
        state.settings.wearInvert = true;
        syncDustMasterSwitch();
        updateUIFromSettings();
        requestRender();
      });
    }

    const btnWearFlipH = document.getElementById('btnWearFlipH');
    if (btnWearFlipH) {
      btnWearFlipH.addEventListener('click', () => {
        saveSnapshot();
        state.settings.wearFlipH = !state.settings.wearFlipH;
        syncDustMasterSwitch();
        updateUIFromSettings();
        requestRender();
      });
    }

    const btnWearRot = document.getElementById('btnWearRot');
    if (btnWearRot) {
      btnWearRot.addEventListener('click', () => {
        saveSnapshot();
        state.settings.wearRotate = ((state.settings.wearRotate || 0) + 1) % 4;
        syncDustMasterSwitch();
        updateUIFromSettings();
        requestRender();
      });
    }

    // 10C. Light Leaks Analógicos Reales (light-leak-01..12)
    document.querySelectorAll('[data-leak]').forEach(btn => {
      btn.addEventListener('click', () => {
        saveSnapshot();
        const type = btn.dataset.leak;
        state.settings.lightLeakType = type;
        state.settings.lightLeakEnabled = (type !== 'none');
        if (type !== 'none' && (state.settings.lightLeakOpacity || 0) === 0) {
          state.settings.lightLeakOpacity = 75;
        }
        if (state.loadedPhotos[state.activePhotoIndex]) {
          state.loadedPhotos[state.activePhotoIndex].settings = { ...state.settings };
        }
        updateUIFromSettings();
        requestRender();
        showToast(type === 'none' ? 'Fuga de luz desactivada' : `${btn.title}`);
      });
    });

    bindSlider('sliderLightLeakOpacity', 'valLightLeakOpacity', 'lightLeakOpacity', SLIDERS.lightLeakOpacity.fmt, SLIDERS.lightLeakOpacity.def, () => {
      if (state.settings.lightLeakOpacity > 0) {
        if (!state.settings.lightLeakType || state.settings.lightLeakType === 'none') {
          state.settings.lightLeakType = 'leak_01';
        }
        state.settings.lightLeakEnabled = true;
      }
      if (state.loadedPhotos[state.activePhotoIndex]) {
        state.loadedPhotos[state.activePhotoIndex].settings = { ...state.settings };
      }
      updateUIFromSettings();
    });

    const btnLeakFlipH = document.getElementById('btnLeakFlipH');
    if (btnLeakFlipH) {
      btnLeakFlipH.addEventListener('click', () => {
        saveSnapshot();
        state.settings.lightLeakFlipH = !state.settings.lightLeakFlipH;
        if (state.loadedPhotos[state.activePhotoIndex]) {
          state.loadedPhotos[state.activePhotoIndex].settings = { ...state.settings };
        }
        updateUIFromSettings();
        requestRender();
      });
    }

    const btnLeakFlipV = document.getElementById('btnLeakFlipV');
    if (btnLeakFlipV) {
      btnLeakFlipV.addEventListener('click', () => {
        saveSnapshot();
        state.settings.lightLeakFlipV = !state.settings.lightLeakFlipV;
        if (state.loadedPhotos[state.activePhotoIndex]) {
          state.loadedPhotos[state.activePhotoIndex].settings = { ...state.settings };
        }
        updateUIFromSettings();
        requestRender();
      });
    }

    const btnLeakRot = document.getElementById('btnLeakRot');
    if (btnLeakRot) {
      btnLeakRot.addEventListener('click', () => {
        saveSnapshot();
        state.settings.lightLeakRotate = ((state.settings.lightLeakRotate || 0) + 1) % 4;
        if (state.loadedPhotos[state.activePhotoIndex]) {
          state.loadedPhotos[state.activePhotoIndex].settings = { ...state.settings };
        }
        updateUIFromSettings();
        requestRender();
      });
    }

    // 11. Bordes Analógicos Reales (PNG/1.png .. 15.png)
    document.querySelectorAll('[data-frame]').forEach(btn => {
      btn.addEventListener('click', () => {
        saveSnapshot();
        const fType = btn.dataset.frame;
        state.settings.frameType = fType;
        state.settings.frameEnabled = (fType !== 'none');
        if (state.loadedPhotos[state.activePhotoIndex]) {
          state.loadedPhotos[state.activePhotoIndex].settings = { ...state.settings };
        }
        updateUIFromSettings();
        if (!state.carouselActive) fitViewCentered();
        requestRender();
        showToast(fType === 'none' ? 'Borde quitado' : `Borde: ${btn.title}`);
      });
    });

    document.querySelectorAll('[data-framefit]').forEach(btn => {
      btn.addEventListener('click', () => {
        saveSnapshot();
        state.settings.frameFitMode = btn.dataset.framefit;
        if (state.loadedPhotos[state.activePhotoIndex]) {
          state.loadedPhotos[state.activePhotoIndex].settings = { ...state.settings };
        }
        updateUIFromSettings();
        if (!state.carouselActive) fitViewCentered();
        requestRender();
      });
    });

    const btnFrameRotate = document.getElementById('btnFrameRotate');
    if (btnFrameRotate) {
      btnFrameRotate.addEventListener('click', () => {
        saveSnapshot();
        state.settings.frameRotate = !state.settings.frameRotate;
        if (state.loadedPhotos[state.activePhotoIndex]) {
          state.loadedPhotos[state.activePhotoIndex].settings = { ...state.settings };
        }
        updateUIFromSettings();
        if (!state.carouselActive) fitViewCentered();
        requestRender();
        showToast('↻ Orientación del borde rotada 90°');
      });
    }

    const slFrameWidth = document.getElementById('sliderFrameWidth');
    const valFrameWidth = document.getElementById('valFrameWidth');
    if (slFrameWidth && valFrameWidth) {
      let dragFW = false;
      slFrameWidth.addEventListener('input', () => {
        if (!dragFW) { saveSnapshot(); dragFW = true; }
        const pct = parseFloat(slFrameWidth.value);
        state.settings.frameScale = pct / 100.0;
        valFrameWidth.textContent = `${Math.round(pct)}`;
        if (state.loadedPhotos[state.activePhotoIndex]) {
          state.loadedPhotos[state.activePhotoIndex].settings = { ...state.settings };
        }
        if (!state.carouselActive) fitViewCentered();
        requestRender();
      });
      slFrameWidth.addEventListener('change', () => { dragFW = false; });
      slFrameWidth.addEventListener('dblclick', () => {
        saveSnapshot();
        slFrameWidth.value = 100;
        state.settings.frameScale = 1.0;
        valFrameWidth.textContent = '100';
        if (state.loadedPhotos[state.activePhotoIndex]) {
          state.loadedPhotos[state.activePhotoIndex].settings = { ...state.settings };
        }
        if (!state.carouselActive) fitViewCentered();
        requestRender();
      });
    }

    bindSlider('sliderFrameOpacity', 'valFrameOpacity', 'frameOpacity', SLIDERS.frameOpacity.fmt, SLIDERS.frameOpacity.def);

    // 12. Controles de Carrusel (1:1, 4:5, 3:4)
    document.querySelectorAll('[data-cratio]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.CarouselEngine) {
          saveSnapshot();
          window.CarouselEngine.setRatio(btn.dataset.cratio);
          document.querySelectorAll('[data-cratio]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          updateCarouselLabels();
          fitViewCentered();
          requestRender();
        }
      });
    });

    document.querySelectorAll('[data-cslides]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.CarouselEngine) {
          saveSnapshot();
          window.CarouselEngine.setSlideCount(btn.dataset.cslides);
          document.querySelectorAll('[data-cslides]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          updateCarouselLabels();
          updateCarouselCellUI();
          fitViewCentered();
          requestRender();
        }
      });
    });

    document.querySelectorAll('[data-cmode]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.CarouselEngine) {
          saveSnapshot();
          window.CarouselEngine.setMode(btn.dataset.cmode);
          document.querySelectorAll('[data-cmode]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          updateCarouselCellUI();
          requestRender();
        }
      });
    });

    const slCarPan = document.getElementById('sliderCarouselPan');
    const valCarPan = document.getElementById('valCarouselPan');
    if (slCarPan) {
      let dragCarPan = false;
      slCarPan.addEventListener('input', () => {
        if (window.CarouselEngine) {
          if (!dragCarPan) { saveSnapshot(); dragCarPan = true; }
          window.CarouselEngine.state.seamlessPanX = parseInt(slCarPan.value, 10) / 100.0;
          valCarPan.textContent = `${slCarPan.value} %`;
          requestRender();
        }
      });
      slCarPan.addEventListener('change', () => { dragCarPan = false; });
    }

    const slCarZoom = document.getElementById('sliderCarouselZoom');
    const valCarZoom = document.getElementById('valCarouselZoom');
    if (slCarZoom) {
      let dragCarZoom = false;
      slCarZoom.addEventListener('input', () => {
        if (window.CarouselEngine) {
          if (!dragCarZoom) { saveSnapshot(); dragCarZoom = true; }
          window.CarouselEngine.state.seamlessZoom = parseInt(slCarZoom.value, 10) / 100.0;
          valCarZoom.textContent = `${slCarZoom.value} %`;
          requestRender();
        }
      });
      slCarZoom.addEventListener('change', () => { dragCarZoom = false; });
    }

    // Switch de Guías Magnéticas Inteligentes
    const swMagnetic = document.getElementById('switchMagneticSnap');
    if (swMagnetic) {
      swMagnetic.addEventListener('change', (e) => {
        if (window.CarouselEngine) {
          window.CarouselEngine.state.magneticSnapEnabled = e.target.checked;
          showToast(e.target.checked ? 'Guías magnéticas de alineado activadas' : 'Guías magnéticas desactivadas');
        }
      });
    }

    // Controles de Manipulación de Foto Libre en Carrusel
    const slCellZoom = document.getElementById('sliderCellZoom');
    const vCellZoom = document.getElementById('valCellZoom');
    if (slCellZoom) {
      let dragCellZoom = false;
      slCellZoom.addEventListener('input', () => {
        const photo = window.CarouselEngine.getSelectedPhoto();
        if (photo) {
          if (!dragCellZoom) { saveSnapshot(); dragCellZoom = true; }
          window.CarouselEngine.scalePhoto(window.CarouselEngine.state.selectedPhotoIndex, parseInt(slCellZoom.value, 10) / 100.0, { snap: false });
          if (vCellZoom) vCellZoom.textContent = `${slCellZoom.value} %`;
          requestRender();
        }
      });
      slCellZoom.addEventListener('change', () => { dragCellZoom = false; });
    }

    const slCellPanX = document.getElementById('sliderCellPanX');
    const vCellPanX = document.getElementById('valCellPanX');
    if (slCellPanX) {
      let dragCellPanX = false;
      slCellPanX.addEventListener('input', () => {
        const photo = window.CarouselEngine.getSelectedPhoto();
        if (photo) {
          if (!dragCellPanX) { saveSnapshot(); dragCellPanX = true; }
          photo.x = parseInt(slCellPanX.value, 10);
          if (vCellPanX) vCellPanX.textContent = `${slCellPanX.value} px`;
          requestRender();
        }
      });
      slCellPanX.addEventListener('change', () => { dragCellPanX = false; });
    }

    const slCellPanY = document.getElementById('sliderCellPanY');
    const vCellPanY = document.getElementById('valCellPanY');
    if (slCellPanY) {
      let dragCellPanY = false;
      slCellPanY.addEventListener('input', () => {
        const photo = window.CarouselEngine.getSelectedPhoto();
        if (photo) {
          if (!dragCellPanY) { saveSnapshot(); dragCellPanY = true; }
          photo.y = parseInt(slCellPanY.value, 10);
          if (vCellPanY) vCellPanY.textContent = `${slCellPanY.value} px`;
          requestRender();
        }
      });
      slCellPanY.addEventListener('change', () => { dragCellPanY = false; });
    }

    // Botones rápidos de alineado inteligente
    const btnBetween = document.getElementById('btnSnapBetweenSlides');
    if (btnBetween) {
      btnBetween.addEventListener('click', () => {
        const photo = window.CarouselEngine.getSelectedPhoto();
        if (photo) {
          saveSnapshot();
          const strip = window.CarouselEngine.getStripDimensions(1200);
          // Buscar la costura divisoria más cercana
          let closestSeam = strip.cellW;
          let bestDist = Math.abs(photo.x - closestSeam);
          let seamIdx = 1;
          for (let i = 1; i < strip.slideCount; i++) {
            const seamX = i * strip.cellW;
            const d = Math.abs(photo.x - seamX);
            if (d < bestDist) {
              bestDist = d;
              closestSeam = seamX;
              seamIdx = i;
            }
          }
          photo.x = closestSeam;
          photo.y = strip.totalH * 0.5;
          updateCellSlidersFromState();
          requestRender();
          showToast(`Centrada entre medias (Diapositivas #${seamIdx} y #${seamIdx + 1})`);
        }
      });
    }

    const btnSnapCenter = document.getElementById('btnSnapToSlideCenter');
    if (btnSnapCenter) {
      btnSnapCenter.addEventListener('click', () => {
        const photo = window.CarouselEngine.getSelectedPhoto();
        if (photo) {
          saveSnapshot();
          const strip = window.CarouselEngine.getStripDimensions(1200);
          const cellIdx = Math.max(0, Math.min(strip.slideCount - 1, Math.floor(photo.x / strip.cellW)));
          photo.x = cellIdx * strip.cellW + strip.cellW * 0.5;
          photo.y = strip.totalH * 0.5;
          updateCellSlidersFromState();
          requestRender();
          showToast(`Centrada en Diapositiva #${cellIdx + 1}`);
        }
      });
    }

    const btnFitWidth = document.getElementById('btnFitSlideWidth');
    if (btnFitWidth) {
      btnFitWidth.addEventListener('click', () => {
        const photo = window.CarouselEngine.getSelectedPhoto();
        if (photo) {
          saveSnapshot();
          const strip = window.CarouselEngine.getStripDimensions(1200);
          photo.scale = strip.cellW / photo.width;
          updateCellSlidersFromState();
          requestRender();
          showToast('Escalada al ancho exacto de 1 casilla');
        }
      });
    }

    const btnCover = document.getElementById('btnCoverSlide');
    if (btnCover) {
      btnCover.addEventListener('click', () => {
        const photo = window.CarouselEngine.getSelectedPhoto();
        if (photo) {
          saveSnapshot();
          const strip = window.CarouselEngine.getStripDimensions(1200);
          photo.scale = Math.max(strip.cellW / photo.width, strip.cellH / photo.height);
          updateCellSlidersFromState();
          requestRender();
          showToast('Escalada para cubrir la casilla completa');
        }
      });
    }

    const btnBringFront = document.getElementById('btnCellBringFront');
    if (btnBringFront) {
      btnBringFront.addEventListener('click', () => {
        if (!window.CarouselEngine) return;
        const idx = window.CarouselEngine.state.selectedPhotoIndex;
        if (idx >= 0) {
          saveSnapshot();
          const p = window.CarouselEngine.state.photos[idx];
          if (p) p.zIndex = (p.zIndex || 2) + 2;
          window.CarouselEngine.bringForward(idx);
          updateCarouselCellUI();
          requestRender();
          showToast('Capa subida al frente');
        }
      });
    }

    const btnSendBack = document.getElementById('btnCellSendBack');
    if (btnSendBack) {
      btnSendBack.addEventListener('click', () => {
        if (!window.CarouselEngine) return;
        const idx = window.CarouselEngine.state.selectedPhotoIndex;
        if (idx >= 0) {
          saveSnapshot();
          const p = window.CarouselEngine.state.photos[idx];
          if (p) p.zIndex = Math.max(0, (p.zIndex || 2) - 2);
          window.CarouselEngine.sendBackward(idx);
          updateCarouselCellUI();
          requestRender();
          showToast('Capa enviada al fondo');
        }
      });
    }

    const btnCellReset = document.getElementById('btnCellReset');
    if (btnCellReset) {
      btnCellReset.addEventListener('click', () => {
        const photo = window.CarouselEngine.getSelectedPhoto();
        if (photo) {
          saveSnapshot();
          if (photo.slotId) {
            const slot = window.CarouselEngine.getTemplateSlots().find(s => s.id === photo.slotId);
            if (slot) {
              const rect = window.CarouselEngine.getSlotPixelRect(slot, 1200);
              photo.rotation = 0;
              photo.x = rect.cx;
              photo.y = rect.cy;
              window.CarouselEngine.fitPhotoToFrameBox(photo, rect.width, rect.height);
              updateCellSlidersFromState();
              requestRender();
              showToast('Encuadre restablecido al marco de plantilla');
              return;
            }
          }
          const strip = window.CarouselEngine.getStripDimensions(1200);
          photo.x = strip.cellW * 0.5;
          photo.y = strip.totalH * 0.5;
          photo.scale = 1.0;
          photo.rotation = 0;
          updateCellSlidersFromState();
          requestRender();
          showToast('Posición y escala restablecidas');
        }
      });
    }

    const btnCellRotCW = document.getElementById('btnCellRotateCW');
    if (btnCellRotCW) {
      btnCellRotCW.addEventListener('click', () => {
        const photo = window.CarouselEngine.getSelectedPhoto();
        if (photo) {
          saveSnapshot();
          const bb = window.CarouselEngine.getPhotoBoundingBox(photo);
          photo.rotation = ((photo.rotation || 0) + 90) % 360;
          if (photo.slotId) {
            window.CarouselEngine.fitPhotoToFrameBox(photo, bb.width, bb.height);
          }
          requestRender();
        }
      });
    }

    const btnCellRotCCW = document.getElementById('btnCellRotateCCW');
    if (btnCellRotCCW) {
      btnCellRotCCW.addEventListener('click', () => {
        const photo = window.CarouselEngine.getSelectedPhoto();
        if (photo) {
          saveSnapshot();
          const bb = window.CarouselEngine.getPhotoBoundingBox(photo);
          photo.rotation = ((photo.rotation || 0) + 270) % 360;
          if (photo.slotId) {
            window.CarouselEngine.fitPhotoToFrameBox(photo, bb.width, bb.height);
          }
          requestRender();
        }
      });
    }

    const btnCellLoad = document.getElementById('btnCellLoadPhoto');
    const cellPicker = document.getElementById('cellFilePicker');
    if (btnCellLoad && cellPicker) {
      btnCellLoad.addEventListener('click', () => {
        if (window.CarouselEngine && window.CarouselEngine.state.selectedSlotId) {
          cellPicker.dataset.targetSlotId = window.CarouselEngine.state.selectedSlotId;
        } else {
          delete cellPicker.dataset.targetSlotId;
        }
        cellPicker.click();
      });
      cellPicker.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files.length > 0) {
          const targetSlotId = cellPicker.dataset.targetSlotId;
          delete cellPicker.dataset.targetSlotId;
          if (targetSlotId && window.CarouselEngine) {
            try {
              saveSnapshot();
              const photoObj = await decodeFileToPhotoObject(e.target.files[0]);
              state.loadedPhotos.push(photoObj);
              const newLoadedIdx = state.loadedPhotos.length - 1;
              window.CarouselEngine.assignPhotoToSlot(targetSlotId, photoObj.canvas, photoObj.fileName, photoObj.floatData, photoObj.id);
              document.getElementById('dropzoneOverlay').style.display = 'none';
              selectPhotoByIndex(newLoadedIdx, { preserveView: true, keepCarouselPhotoIndex: window.CarouselEngine.state.selectedPhotoIndex });
              renderBottomFilmstrip();
              updateCarouselCellUI();
              updateTemplateUI();
              requestRender();
              showToast(`Foto encajada en el marco: ${photoObj.fileName}`);
            } catch (err) {
              console.error('Error al decodificar foto en hueco:', err);
            }
          } else {
            handleIncomingFiles(e.target.files);
          }
        }
        cellPicker.value = '';
      });
    }

    const btnCellClear = document.getElementById('btnCellClearPhoto');
    if (btnCellClear) {
      btnCellClear.addEventListener('click', () => {
        if (!window.CarouselEngine) return;
        const cIdx = window.CarouselEngine.state.selectedPhotoIndex;
        if (cIdx >= 0 && cIdx < window.CarouselEngine.state.photos.length) {
          saveSnapshot();
          const removed = window.CarouselEngine.state.photos[cIdx];
          window.CarouselEngine.removePhoto(cIdx);
          updateCarouselCellUI();
          updateTemplateUI();
          requestRender();
          showToast(removed.slotId ? 'Marco vaciado (listo para otra foto)' : 'Foto quitada del carrusel');
        }
      });
    }

    // 12.0. Botones de la Barra Contextual Flotante Canva (#canvaFloatingToolbar) y Navegador Inferior (#canvaSlideNavBar)
    const btnCanvaReplace = document.getElementById('btnCanvaToolbarReplace');
    if (btnCanvaReplace && cellPicker) {
      btnCanvaReplace.addEventListener('click', () => {
        if (!window.CarouselEngine) return;
        const selPhoto = window.CarouselEngine.getSelectedPhoto();
        if (selPhoto && selPhoto.slotId) {
          cellPicker.dataset.targetSlotId = selPhoto.slotId;
        } else if (window.CarouselEngine.state.selectedSlotId) {
          cellPicker.dataset.targetSlotId = window.CarouselEngine.state.selectedSlotId;
        } else {
          delete cellPicker.dataset.targetSlotId;
        }
        cellPicker.click();
      });
    }

    const btnCanvaCrop = document.getElementById('btnCanvaToolbarCrop');
    if (btnCanvaCrop) {
      btnCanvaCrop.addEventListener('click', () => {
        if (btnToggleCrop) btnToggleCrop.click();
      });
    }

    const btnCanvaFitSlot = document.getElementById('btnCanvaToolbarFitSlot');
    if (btnCanvaFitSlot) {
      btnCanvaFitSlot.addEventListener('click', () => {
        if (!window.CarouselEngine) return;
        const photo = window.CarouselEngine.getSelectedPhoto();
        if (!photo) {
          showToast('Selecciona primero una foto en el carrusel');
          return;
        }
        if (window.CarouselEngine.state.activeTemplateId) {
          const slot = (photo.slotId && window.CarouselEngine.getTemplateSlots().find(s => s.id === photo.slotId)) ||
                       window.CarouselEngine.hitTestSlot(photo.x, photo.y);
          if (slot) {
            saveSnapshot();
            const rect = window.CarouselEngine.getSlotPixelRect(slot, 1200);
            photo.slotId = slot.id;
            slot.photoId = photo.id;
            photo.x = rect.cx;
            photo.y = rect.cy;
            photo.frameBorder = slot.frameBorder || null;
            window.CarouselEngine.fitPhotoToFrameBox(photo, rect.width, rect.height);
            updateCarouselCellUI();
            updateTemplateUI();
            requestRender();
            showToast(`Encajada perfectamente en: ${slot.label}`);
            return;
          }
        }
        if (btnCover) btnCover.click();
      });
    }

    const btnCanvaFront = document.getElementById('btnCanvaToolbarFront');
    if (btnCanvaFront && btnBringFront) {
      btnCanvaFront.addEventListener('click', () => btnBringFront.click());
    }

    const btnCanvaBack = document.getElementById('btnCanvaToolbarBack');
    if (btnCanvaBack && btnSendBack) {
      btnCanvaBack.addEventListener('click', () => btnSendBack.click());
    }

    const btnCanvaRot = document.getElementById('btnCanvaToolbarRot');
    if (btnCanvaRot && btnCellRotCW) {
      btnCanvaRot.addEventListener('click', () => btnCellRotCW.click());
    }

    const btnCanvaDelete = document.getElementById('btnCanvaToolbarDelete');
    if (btnCanvaDelete && btnCellClear) {
      btnCanvaDelete.addEventListener('click', () => btnCellClear.click());
    }

    const btnSlideFull = document.getElementById('btnSlideNavFull');
    if (btnSlideFull) {
      btnSlideFull.addEventListener('click', () => focusOnCarouselSlide(-1));
    }

    const btnSlidePrev = document.getElementById('btnSlideNavPrev');
    if (btnSlidePrev) {
      btnSlidePrev.addEventListener('click', () => {
        if (!window.CarouselEngine) return;
        const cur = window.CarouselEngine.state.focusedSlideIndex;
        const count = window.CarouselEngine.state.slideCount || 3;
        const next = (cur <= 0) ? count - 1 : cur - 1;
        focusOnCarouselSlide(next);
      });
    }

    const btnSlideNext = document.getElementById('btnSlideNavNext');
    if (btnSlideNext) {
      btnSlideNext.addEventListener('click', () => {
        if (!window.CarouselEngine) return;
        const cur = window.CarouselEngine.state.focusedSlideIndex;
        const count = window.CarouselEngine.state.slideCount || 3;
        const next = (cur < 0 || cur >= count - 1) ? 0 : cur + 1;
        focusOnCarouselSlide(next);
      });
    }

    const btnCanvaQuickAutoFill = document.getElementById('btnCanvaQuickAutoFill');
    if (btnCanvaQuickAutoFill) {
      btnCanvaQuickAutoFill.addEventListener('click', () => {
        const autoBtn = document.getElementById('btnAutoFillTemplate');
        if (autoBtn) autoBtn.click();
      });
    }

    // Botón de activación de Modo Recorte en el carrusel
    const btnToggleCrop = document.getElementById('btnTogglePhotoCrop');
    if (btnToggleCrop) {
      btnToggleCrop.addEventListener('click', () => {
        if (!window.CarouselEngine) return;
        const photo = window.CarouselEngine.getSelectedPhoto();
        if (!photo) return;
        const newMode = window.CarouselEngine.togglePhotoCropMode(window.CarouselEngine.state.selectedPhotoIndex);
        updateCarouselCellUI();
        requestRender();
        if (newMode) {
          showToast('Modo Recorte: Arrastra dentro para reencuadrar o esquinas para recortar');
        } else {
          showToast('Recorte confirmado');
        }
      });
    }

    // Botones de relación de aspecto de recorte de foto en carrusel
    document.querySelectorAll('.btn-photo-crop-ratio').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!window.CarouselEngine) return;
        saveSnapshot();
        const ratio = btn.dataset.ratio;
        window.CarouselEngine.setPhotoCropRatio(window.CarouselEngine.state.selectedPhotoIndex, ratio);
        document.querySelectorAll('.btn-photo-crop-ratio').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateCarouselCellUI();
        requestRender();
        showToast(`Proporción de recorte: ${btn.textContent.trim()}`);
      });
    });

    // Botón para restablecer el recorte a tamaño completo original
    const btnResetCrop = document.getElementById('btnResetPhotoCrop');
    if (btnResetCrop) {
      btnResetCrop.addEventListener('click', () => {
        if (!window.CarouselEngine) return;
        saveSnapshot();
        window.CarouselEngine.resetPhotoCrop(window.CarouselEngine.state.selectedPhotoIndex);
        document.querySelectorAll('.btn-photo-crop-ratio').forEach(b => b.classList.remove('active'));
        const freeBtn = document.querySelector('.btn-photo-crop-ratio[data-ratio="free"]');
        if (freeBtn) freeBtn.classList.add('active');
        updateCarouselCellUI();
        requestRender();
        showToast('↺ Recorte restablecido al tamaño original');
      });
    }

    const btnExpCar = document.getElementById('btnExportCarouselSlices');
    if (btnExpCar) {
      btnExpCar.addEventListener('click', exportCarouselAction);
    }

    const btnExitCar = document.getElementById('btnExitCarousel');
    if (btnExitCar) {
      btnExitCar.addEventListener('click', toggleCarouselMode);
    }

    // 12.1. Gestión de Plantillas Editoriales Predefinidas
    function syncCarouselSlideCountUI(count) {
      document.querySelectorAll('[data-cslides]').forEach(b => {
        b.classList.toggle('active', String(b.dataset.cslides) === String(count));
      });
    }

    function syncCarouselRatioUI(ratioKey) {
      document.querySelectorAll('[data-cratio]').forEach(b => {
        b.classList.toggle('active', b.dataset.cratio === ratioKey);
      });
    }

    document.querySelectorAll('.template-card').forEach(card => {
      card.addEventListener('click', () => {
        const tmplId = card.dataset.template;
        document.querySelectorAll('.template-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');

        if (!window.CarouselEngine) return;

        // Guardar renderizado WebGL actual antes de cambiar o auto-encajar plantilla
        bakeActiveWebGLToCarouselPhotos();
        saveSnapshot();

        if (tmplId === 'free') {
          window.CarouselEngine.applyTemplate('free');
          showToast('Modo Libre activado (sin restricciones)');
        } else {
          const tmpl = window.CarouselEngine.applyTemplate(tmplId);
          if (tmpl) {
            syncCarouselSlideCountUI(tmpl.slideCount);
            syncCarouselRatioUI(tmpl.ratioKey);
            // Si aún no había fotos colocadas en el carrusel pero sí en la librería inferior, auto-rellenar los primeros huecos
            if (window.CarouselEngine.state.photos.length === 0 && state.loadedPhotos.length > 0) {
              window.CarouselEngine.autoFillSlots(state.loadedPhotos);
            }
            showToast(`${tmpl.name} activada (${tmpl.slideCount} diapositivas · ${tmpl.slots.length} marcos)`);
          }
        }

        updateCarouselCellUI();
        updateCarouselLabels();
        updateTemplateUI();
        fitViewCentered();
        requestRender();
      });
    });

    const btnAutoFill = document.getElementById('btnAutoFillTemplate');
    if (btnAutoFill) {
      btnAutoFill.addEventListener('click', () => {
        if (!window.CarouselEngine || !window.CarouselEngine.state.activeTemplateId) {
          showToast('Selecciona primero una plantilla de la lista para auto-rellenar');
          return;
        }
        bakeActiveWebGLToCarouselPhotos();
        saveSnapshot();
        const count = window.CarouselEngine.autoFillSlots(state.loadedPhotos);
        if (count > 0) {
          showToast(`${count} foto${count > 1 ? 's encajadas' : ' encajada'} automáticamente en la plantilla`);
          updateCarouselCellUI();
          updateTemplateUI();
          requestRender();
        } else if (state.loadedPhotos.length === 0) {
          showToast('Añade fotos primero o haz clic en cualquier marco del carrusel');
        } else {
          showToast('Todos los marcos ya tienen foto o tus fotos ya están colocadas');
        }
      });
    }

    const btnClearTmpl = document.getElementById('btnClearTemplateSlots');
    if (btnClearTmpl) {
      btnClearTmpl.addEventListener('click', () => {
        if (!window.CarouselEngine) return;
        saveSnapshot();
        window.CarouselEngine.clearTemplateSlots();
        updateCarouselCellUI();
        updateTemplateUI();
        requestRender();
        showToast('↺ Marcos de la plantilla vaciados');
      });
    }

    // 13. Restablecer todo
    document.getElementById('btnResetAll').addEventListener('click', () => {
      if (!state.imageSource) return;
      saveSnapshot();
      state.settings = getDefaultSettings();
      persistActiveSettings();
      if (state.activeTool === 'anchor') setTool('pan');
      updateUIFromSettings();
      fitViewCentered();
      requestRender();
      showToast('Ajustes restablecidos', { label: 'Deshacer', onAction: undo });
    });

    // 14. Modal de Exportación
    initExportModal();

    // 15. Modal de Conexión iPad Pro (QR y Wi-Fi LAN)
    initIpadModal();

    // 16. Eventos del ratón y gestos multitáctiles para iPad Pro sobre el lienzo
    initCanvasPointerEvents();

    // 17. Registro de Service Worker para PWA iPadOS y modo autónomo
    registerServiceWorker();

    // 18. Modo App Móvil para iPhone y pantallas pequeñas
    initMobileLayout();
  }

  // =========================================================================
  // MODO APP MÓVIL (IPHONE Y PANTALLAS TÁCTILES)
  // =========================================================================
  function initMobileLayout() {
    const sidebar = document.getElementById('integratedSidebar');
    const backdrop = document.getElementById('mobileSidebarBackdrop');
    const closeBtn = document.getElementById('btnCloseMobileSidebar');
    const handleWrap = document.getElementById('mobileSheetHandleWrap');

    const btnNavPhotos = document.getElementById('btnMobileNavPhotos');

    function openMobileSidebar() {
      if (sidebar) sidebar.classList.add('open');
      if (backdrop) backdrop.classList.add('open');
    }

    function closeMobileSidebar() {
      if (sidebar) {
        sidebar.classList.remove('open');
        sidebar.style.transition = '';
        sidebar.style.transform = '';
      }
      if (backdrop) backdrop.classList.remove('open');
    }

    if (closeBtn) closeBtn.addEventListener('click', closeMobileSidebar);
    if (backdrop) backdrop.addEventListener('click', closeMobileSidebar);

    // Arrastre hacia abajo sobre el tirador táctil para cerrar la hoja en móvil
    if (handleWrap) {
      let startY = 0;
      let currentY = 0;
      handleWrap.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
        currentY = startY;
      }, { passive: true });

      handleWrap.addEventListener('touchmove', (e) => {
        currentY = e.touches[0].clientY;
        const dy = Math.max(0, currentY - startY);
        if (sidebar) {
          sidebar.style.transition = 'none';
          sidebar.style.transform = `translateY(${dy}px)`;
        }
      }, { passive: true });

      handleWrap.addEventListener('touchend', () => {
        const dy = currentY - startY;
        if (sidebar) {
          sidebar.style.transition = '';
          sidebar.style.transform = '';
          if (dy > 65) {
            closeMobileSidebar();
          }
        }
      });
    }

    // Botones de la barra de navegación móvil inferior
    if (btnNavPhotos) {
      btnNavPhotos.addEventListener('click', () => {
        closeMobileSidebar();
        const filmstrip = document.getElementById('bottomFilmstripBar');
        if (state.loadedPhotos.length === 0) {
          const picker = document.getElementById('filePicker');
          if (picker) picker.click();
        } else if (filmstrip) {
          const isHidden = (filmstrip.style.display === 'none' || !filmstrip.style.display);
          filmstrip.style.display = isHidden ? 'flex' : 'none';
          if (isHidden) renderBottomFilmstrip();
        }
      });
    }

    document.querySelectorAll('.mobile-nav-btn[data-mobile-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.mobileTab;
        const isOpen = sidebar && sidebar.classList.contains('open');
        if (isOpen && state.activeTab === tab) {
          closeMobileSidebar();
          return;
        }
        activateTab(tab);
        openMobileSidebar();
      });
    });

    // Exponer para otras partes (p. ej. atajos)
    state.closeMobileSidebar = closeMobileSidebar;
  }

  // Lleva a la pestaña que contiene la tarjeta, la desplaza a la vista y la resalta
  function scrollToCard(cardId) {
    const card = document.getElementById(cardId);
    if (!card) return;
    const panel = card.closest('.tab-panel');
    if (panel && panel.dataset.panel && state.activeTab !== panel.dataset.panel) {
      activateTab(panel.dataset.panel);
    }
    requestAnimationFrame(() => {
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      card.classList.add('flash');
      setTimeout(() => card.classList.remove('flash'), 700);
    });
  }

  function bindSlider(sliderId, valueReadoutId, settingKey, formatFn, defaultVal, onUpdate) {
    const slider = document.getElementById(sliderId);
    const label = document.getElementById(valueReadoutId);
    if (!slider || !label) return;

    let isDraggingSlider = false;

    slider.addEventListener('input', () => {
      if (!isDraggingSlider) {
        saveSnapshot();
        isDraggingSlider = true;
      }
      const val = parseFloat(slider.value);
      state.settings[settingKey] = val;
      if (state.loadedPhotos[state.activePhotoIndex]) {
        state.loadedPhotos[state.activePhotoIndex].settings = { ...state.settings };
      }
      label.textContent = formatFn(val);
      if (onUpdate) onUpdate();
      requestRender();
    });

    slider.addEventListener('change', () => {
      isDraggingSlider = false;
      if (state.loadedPhotos[state.activePhotoIndex]) {
        state.loadedPhotos[state.activePhotoIndex].settings = { ...state.settings };
      }
    });

    slider.addEventListener('dblclick', () => {
      saveSnapshot();
      slider.value = defaultVal;
      state.settings[settingKey] = defaultVal;
      if (state.loadedPhotos[state.activePhotoIndex]) {
        state.loadedPhotos[state.activePhotoIndex].settings = { ...state.settings };
      }
      label.textContent = formatFn(defaultVal);
      if (onUpdate) onUpdate();
      refreshSliderVisual(slider);
      requestRender();
    });
  }

  function updateUIFromSettings() {
    const s = state.settings;

    document.getElementById('switchBasics').checked = s.basicsEnabled !== false;
    document.getElementById('switchCropMode').checked = state.activeTool === 'crop';
    document.getElementById('switchGrain').checked = s.grainEnabled !== false;
    document.getElementById('switchMotion').checked = s.motionEnabled !== false;

    // Deslizadores ligados a ajustes (valor y texto)
    Object.keys(SLIDERS).forEach(key => {
      const def = SLIDERS[key];
      const el = document.getElementById(def.id);
      const lbl = document.getElementById(def.val);
      const v = (s[key] !== undefined && s[key] !== null) ? s[key] : def.def;
      if (el) el.value = v;
      if (lbl) lbl.textContent = def.fmt(Number(v));
    });

    // Recorte
    document.getElementById('sliderStraighten').value = s.straighten || 0;
    const strAngle = `${(s.straighten || 0) > 0 ? '+' : ''}${(s.straighten || 0).toFixed(1)}°`;
    document.getElementById('valStraighten').textContent = strAngle;
    document.getElementById('infoAngle').textContent = strAngle;

    document.querySelectorAll('#sectionCropCard [data-ratio]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.ratio === (s.cropRatio || 'free'));
    });

    // Perfiles de película
    document.querySelectorAll('.film-profile-card').forEach(card => {
      const isActive = card.dataset.profile === 'none' ? !s.activeFilmProfile : card.dataset.profile === s.activeFilmProfile;
      card.classList.toggle('active', isActive);
    });

    // Movimiento
    document.querySelectorAll('[data-motion]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.motion === (s.motionType || 'shake'));
    });
    document.getElementById('rowMotionAngle').style.display = (s.motionType === 'zoom') ? 'none' : '';

    document.getElementById('btnToggleAnchor').classList.toggle('active', !!s.anchorEnabled);
    document.getElementById('anchorControls').style.display = s.anchorEnabled ? 'flex' : 'none';
    updateAnchorGizmoPosition();

    // Polvo y desgaste
    const hasDirty = s.dirtyNoiseEnabled && s.dirtyNoiseType && s.dirtyNoiseType !== 'none';
    const hasWear = s.wearEnabled && s.wearType && s.wearType !== 'none';
    const swDust = document.getElementById('switchDust');
    if (swDust) swDust.checked = Boolean(s.dustEnabled !== false && (hasDirty || hasWear));

    const activeDirty = (s.dirtyNoiseEnabled && s.dirtyNoiseType) ? s.dirtyNoiseType : 'none';
    document.querySelectorAll('[data-dirty]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.dirty === activeDirty);
    });
    const btnDW = document.getElementById('btnDirtyWhite');
    const btnDB = document.getElementById('btnDirtyBlack');
    if (btnDW && btnDB) {
      btnDW.classList.toggle('active', !s.dirtyNoiseInvert);
      btnDB.classList.toggle('active', !!s.dirtyNoiseInvert);
    }
    document.getElementById('btnDirtyFlipH')?.classList.toggle('active', !!s.dirtyNoiseFlipH);
    document.getElementById('btnDirtyFlipV')?.classList.toggle('active', !!s.dirtyNoiseFlipV);

    const activeWear = (s.wearEnabled && s.wearType) ? s.wearType : 'none';
    document.querySelectorAll('[data-wear]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.wear === activeWear);
    });
    const btnWL = document.getElementById('btnWearLight');
    const btnWD = document.getElementById('btnWearDark');
    if (btnWL && btnWD) {
      btnWL.classList.toggle('active', !s.wearInvert);
      btnWD.classList.toggle('active', !!s.wearInvert);
    }
    document.getElementById('btnWearFlipH')?.classList.toggle('active', !!s.wearFlipH);

    // Fugas de luz
    const activeLeak = (s.lightLeakEnabled && s.lightLeakType) ? s.lightLeakType : 'none';
    const swLeak = document.getElementById('switchLightLeak');
    if (swLeak) swLeak.checked = (activeLeak !== 'none');
    document.querySelectorAll('[data-leak]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.leak === activeLeak);
    });
    document.getElementById('btnLeakFlipH')?.classList.toggle('active', !!s.lightLeakFlipH);
    document.getElementById('btnLeakFlipV')?.classList.toggle('active', !!s.lightLeakFlipV);

    // Bordes
    const activeFrame = (s.frameEnabled !== false && s.frameType) ? s.frameType : 'none';
    const swFrame = document.getElementById('switchFrame');
    if (swFrame) swFrame.checked = Boolean(activeFrame && activeFrame !== 'none');
    document.querySelectorAll('[data-frame]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.frame === activeFrame);
    });
    document.querySelectorAll('[data-framefit]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.framefit === (s.frameFitMode || 'fit'));
    });
    document.getElementById('btnFrameRotate')?.classList.toggle('active', !!s.frameRotate);

    const slFW = document.getElementById('sliderFrameWidth');
    if (slFW) slFW.value = Math.round((s.frameScale || 1.0) * 100);
    const valFW = document.getElementById('valFrameWidth');
    if (valFW) valFW.textContent = `${Math.round((s.frameScale || 1.0) * 100)}`;

    refreshAllSliderVisuals();
    refreshEditIndicators();
  }

  // =========================================================================
  // EVENTOS DEL RATÓN EN EL LIENZO (ZOOM SUAVE, PAN, INTERACCIÓN DE CELDAS)
  // =========================================================================
  function initCanvasPointerEvents() {
    canvasViewport.addEventListener('wheel', (e) => {
      if (!state.imageSource && !state.carouselActive) return;
      e.preventDefault();

      // Si estamos en modo Carrusel con fotos libres:
      // Solo hacer zoom en la foto si el cursor del ratón está DENTRO del carrusel y SOBRE la foto seleccionada.
      // Si el ratón está fuera del carrusel (o fuera de la foto), se hace zoom general del lienzo.
      if (state.carouselActive && window.CarouselEngine && window.CarouselEngine.state.mode === 'multi') {
        const canvasRect = canvas.getBoundingClientRect();
        const normX = (e.clientX - canvasRect.left) / canvasRect.width;
        const normY = (e.clientY - canvasRect.top) / canvasRect.height;
        const isInsideCarousel = (normX >= 0 && normX <= 1 && normY >= 0 && normY <= 1);

        if (isInsideCarousel) {
          const strip = window.CarouselEngine.getStripDimensions(1200);
          const stripX = normX * strip.totalW;
          const stripY = normY * strip.totalH;
          const selectedIdx = window.CarouselEngine.state.selectedPhotoIndex;
          const photo = window.CarouselEngine.getSelectedPhoto();

          const hitHandle = window.CarouselEngine.hitTestPhotoHandle(stripX, stripY, photo, 25);
          const hitIdx = window.CarouselEngine.hitTestPhoto(stripX, stripY);

          if (photo && (hitHandle || hitIdx === selectedIdx)) {
            if (!state.wheelZoomTimer) {
              saveSnapshot();
            }
            clearTimeout(state.wheelZoomTimer);
            state.wheelZoomTimer = setTimeout(() => { state.wheelZoomTimer = null; }, 450);

            const delta = -e.deltaY;
            const newScale = photo.scale * Math.exp(delta * 0.0016);
            window.CarouselEngine.scalePhoto(selectedIdx, newScale, { snap: window.CarouselEngine.state.magneticSnapEnabled });

            const hud = document.getElementById('magneticHudBanner');
            const hudText = document.getElementById('magneticHudText');
            if (window.CarouselEngine.state.activeAlignmentNotice && hud && hudText) {
              hudText.textContent = window.CarouselEngine.state.activeAlignmentNotice;
              hud.style.display = 'flex';
              setTimeout(() => { if (hud) hud.style.display = 'none'; }, 1000);
            }

            updateCellSlidersFromState();
            requestRender();
            return;
          }
        }
        // Si el ratón está fuera del carrusel o sobre fondo libre -> Pasa al Zoom general de lienzo
      }

      // Zoom general de lienzo suave
      const delta = -e.deltaY;
      const zoomSpeed = 0.0016;
      const factor = Math.exp(delta * zoomSpeed);
      const newZoom = Math.min(8.0, Math.max(0.05, state.zoom * factor));

      const rect = canvasViewport.getBoundingClientRect();
      const mouseX = e.clientX - rect.left - rect.width * 0.5;
      const mouseY = e.clientY - rect.top - rect.height * 0.5;

      state.panX -= (mouseX - state.panX) * (factor - 1);
      state.panY -= (mouseY - state.panY) * (factor - 1);
      state.zoom = newZoom;
      state.viewIsFit = false;

      applyCanvasTransform();
      syncZoomControls();
      requestRender();
    }, { passive: false });

    // Estado de control multitáctil para iPad Pro y gestos con dedos / Apple Pencil
    const touchState = {
      isMultiTouch: false,
      mode: null, // 'photo-pinch' | 'canvas-pinch'
      initialDist: 0,
      initialMid: { x: 0, y: 0 },
      initialPhotoScale: 1,
      initialCanvasZoom: 1,
      initialPanX: 0,
      initialPanY: 0,
      targetPhotoIndex: -1,
      lastTapTime: 0,
      lastTapPos: { x: 0, y: 0 }
    };

    function handlePointerDown(e) {
      if (!state.imageSource && !state.carouselActive) return;
      if (
        (e.target && e.target.closest && (
          e.target.closest('#dropzoneOverlay') ||
          e.target.closest('.crop-overlay') ||
          e.target.closest('.integrated-sidebar') ||
          e.target.closest('.canva-floating-toolbar') ||
          e.target.closest('.canva-slide-navbar') ||
          e.target.closest('#bottomFilmstripBar') ||
          e.target.closest('.compare-handle') ||
          e.target.closest('.modal-backdrop')
        ))
      ) return;

      // Colocación del ancla (sujeto nítido): clic o arrastre sobre la foto
      if (!state.carouselActive && state.settings.anchorEnabled && (e.button === 0 || e.button === undefined) &&
          (e.metaKey || e.shiftKey || state.activeTool === 'anchor')) {
        state.pendingDragSnapshot = createSnapshotObject();
        state.pointerInteractionDirty = true;
        state.isAnchorDragging = true;
        placeAnchorAt(e.clientX, e.clientY);
        return;
      }

      // Interacción en modo Carrusel (Mover foto libremente, redimensionar esquinas y lados estilo Canva, recorte o huecos)
      if (state.carouselActive && window.CarouselEngine && (e.button === 0 || e.button === undefined) && !e.spaceKey) {
        const canvasRect = canvas.getBoundingClientRect();
        const normX = (e.clientX - canvasRect.left) / canvasRect.width;
        const normY = (e.clientY - canvasRect.top) / canvasRect.height;

        if (normX >= 0 && normX <= 1 && normY >= 0 && normY <= 1) {
          const strip = window.CarouselEngine.getStripDimensions(1200);
          const stripX = normX * strip.totalW;
          const stripY = normY * strip.totalH;

          if (window.CarouselEngine.state.mode === 'multi') {
            const selectedPhoto = window.CarouselEngine.getSelectedPhoto();
            const handleInfo = window.CarouselEngine.hitTestPhotoHandle(stripX, stripY, selectedPhoto);

            // A) Clic en el botón "✂ Encuadrar" de la etiqueta sobre la foto
            if (handleInfo && handleInfo.handle === 'badge-crop') {
              window.CarouselEngine.togglePhotoCropMode(window.CarouselEngine.state.selectedPhotoIndex, true);
              updateCarouselCellUI();
              requestRender();
              showToast('Modo Encuadre: Arrastra dentro para mover la foto o las esquinas para recortar');
              return;
            }

            // B) Clic en el botón "✓ Listo" del badge de recorte
            if (handleInfo && handleInfo.handle === 'crop-done') {
              window.CarouselEngine.togglePhotoCropMode(window.CarouselEngine.state.selectedPhotoIndex, false);
              updateCarouselCellUI();
              requestRender();
              showToast('Encuadre confirmado');
              return;
            }

            // C) Clic en el botón "↺ Restablecer" del badge de recorte
            if (handleInfo && handleInfo.handle === 'crop-reset') {
              saveSnapshot();
              window.CarouselEngine.resetPhotoCrop(window.CarouselEngine.state.selectedPhotoIndex);
              updateCarouselCellUI();
              requestRender();
              showToast('↺ Encuadre restablecido al tamaño original');
              return;
            }

            // D) Si la foto actual está en Modo Recorte:
            if (selectedPhoto && selectedPhoto.isCropMode) {
              if (handleInfo && handleInfo.handle) {
                if (handleInfo.handle === 'crop-body') {
                  state.pendingDragSnapshot = createSnapshotObject();
                  state.pointerInteractionDirty = false;
                  state.isPhotoPanningInCrop = true;
                  const fullBox = window.CarouselEngine.getPhotoUncroppedBox(selectedPhoto);
                  state.cropPanStart = {
                    stripX,
                    stripY,
                    startCropX: selectedPhoto.crop.x,
                    startCropY: selectedPhoto.crop.y,
                    fullW: fullBox.width,
                    fullH: fullBox.height
                  };
                  canvasViewport.style.cursor = 'grabbing';
                  return;
                } else if (handleInfo.handle.startsWith('crop-')) {
                  state.pendingDragSnapshot = createSnapshotObject();
                  state.pointerInteractionDirty = false;
                  state.isCropHandleDragging = handleInfo.handle;
                  const fullBox = window.CarouselEngine.getPhotoUncroppedBox(selectedPhoto);
                  state.cropHandleStart = {
                    stripX,
                    stripY,
                    startCrop: { ...selectedPhoto.crop },
                    fullW: fullBox.width,
                    fullH: fullBox.height,
                    fullLeft: fullBox.left,
                    fullTop: fullBox.top
                  };
                  return;
                }
              } else {
                // Clic fuera del marco de recorte -> Confirmar y salir del modo recorte
                window.CarouselEngine.togglePhotoCropMode(window.CarouselEngine.state.selectedPhotoIndex, false);
                updateCarouselCellUI();
                requestRender();
                return;
              }
            }

            // E) Si NO está en modo recorte: comprobar manijas de redimensión por esquina ('resize-*') o laterales ('side-*') estilo Canva
            if (handleInfo && handleInfo.handle && (handleInfo.handle.startsWith('resize-') || handleInfo.handle.startsWith('side-'))) {
              const corner = handleInfo.handle.startsWith('resize-')
                ? handleInfo.handle.replace('resize-', '')
                : handleInfo.handle;
              state.pendingDragSnapshot = createSnapshotObject();
              state.pointerInteractionDirty = false;
              state.isPhotoResizing = corner;
              const bb = window.CarouselEngine.getPhotoBoundingBox(selectedPhoto);
              state.resizeStart = {
                stripX,
                stripY,
                corner,
                origW: bb.width,
                origH: bb.height,
                origLeft: bb.left,
                origRight: bb.right,
                origTop: bb.top,
                origBottom: bb.bottom,
                photoScale: selectedPhoto.scale,
                anchorX: (corner === 'tl' || corner === 'bl') ? bb.right : bb.left,
                anchorY: (corner === 'tl' || corner === 'tr') ? bb.bottom : bb.top
              };
              return;
            }

            // F) Evaluar prioridad entre Hueco de Plantilla Vacío superpuesto y Foto Colocada
            const hitIdx = window.CarouselEngine.hitTestPhoto(stripX, stripY);
            const hitPhoto = hitIdx >= 0 ? window.CarouselEngine.state.photos[hitIdx] : null;
            const slot = window.CarouselEngine.state.activeTemplateId
              ? window.CarouselEngine.hitTestSlot(stripX, stripY)
              : null;
            const slotHasPhoto = slot && slot.photoId && window.CarouselEngine.state.photos.some(p => p.id === slot.photoId);

            // Si hay un hueco vacío cuya capa (zIndex) está por encima de la foto de fondo (o no hay foto debajo):
            if (slot && !slotHasPhoto && (!hitPhoto || (slot.zIndex || 2) > (hitPhoto.zIndex || 2))) {
              const wasSelected = window.CarouselEngine.state.selectedSlotId === slot.id;
              window.CarouselEngine.state.selectedSlotId = slot.id;
              window.CarouselEngine.state.selectedPhotoIndex = -1;
              updateCarouselCellUI();
              updateTemplateUI();
              requestRender();

              if (state.loadedPhotos.length === 0 || wasSelected) {
                const cellPicker = document.getElementById('cellFilePicker');
                if (cellPicker) {
                  cellPicker.dataset.targetSlotId = slot.id;
                  cellPicker.click();
                  return;
                }
              } else {
                showToast(`Marco «${slot.label}» seleccionado: haz clic en una foto de abajo para encajarla (o clic de nuevo para buscar archivo)`);
                return;
              }
            }

            // G) Clic en el cuerpo de una foto colocada -> Seleccionar y permitir arrastrar
            if (hitIdx >= 0) {
              selectCarouselPhotoByIndex(hitIdx);
              state.pendingDragSnapshot = createSnapshotObject();
              state.pointerInteractionDirty = false;
              state.isPhotoDragging = true;
              const photo = window.CarouselEngine.getSelectedPhoto();
              if (photo) {
                state.photoDragOffset = { x: stripX - photo.x, y: stripY - photo.y };
              }
              renderBottomFilmstrip();
              requestRender();
              return;
            }
          } else {
            state.pendingDragSnapshot = createSnapshotObject();
            state.pointerInteractionDirty = false;
            state.isSeamlessPanning = true;
            state.seamlessPanStart = { x: e.clientX };
            state.seamlessPanStartVal = window.CarouselEngine.state.seamlessPanX;
            requestRender();
            return;
          }
        }
      }

      state.isPanning = true;
      state.panStartX = e.clientX - state.panX;
      state.panStartY = e.clientY - state.panY;
      canvasViewport.classList.add('panning');
    }

    function placeAnchorAt(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      state.settings.anchorX = Math.max(0.0, Math.min(1.0, (clientX - rect.left) / rect.width));
      state.settings.anchorY = Math.max(0.0, Math.min(1.0, (clientY - rect.top) / rect.height));
      persistActiveSettings();
      updateAnchorGizmoPosition();
      requestRender();
    }

    function handlePointerMove(e) {
      if (state.isAnchorDragging) {
        placeAnchorAt(e.clientX, e.clientY);
        return;
      }

      // 1. Redimensionar foto por esquina (hacer más pequeña o más grande)
      if (state.isPhotoResizing && window.CarouselEngine && canvas) {
        state.pointerInteractionDirty = true;
        const canvasRect = canvas.getBoundingClientRect();
        const normX = (e.clientX - canvasRect.left) / canvasRect.width;
        const normY = (e.clientY - canvasRect.top) / canvasRect.height;
        const strip = window.CarouselEngine.getStripDimensions(1200);
        const stripX = normX * strip.totalW;
        const stripY = normY * strip.totalH;

        window.CarouselEngine.resizePhotoCorner(
          window.CarouselEngine.state.selectedPhotoIndex,
          state.isPhotoResizing,
          stripX,
          stripY,
          state.resizeStart,
          { snap: window.CarouselEngine.state.magneticSnapEnabled }
        );

        const hud = document.getElementById('magneticHudBanner');
        const hudText = document.getElementById('magneticHudText');
        if (window.CarouselEngine.state.activeAlignmentNotice && hud && hudText) {
          hudText.textContent = window.CarouselEngine.state.activeAlignmentNotice;
          hud.style.display = 'flex';
        } else if (hud) {
          hud.style.display = 'none';
        }

        updateCellSlidersFromState();
        requestRender();
        return;
      }

      // 2. Desplazar imagen dentro del marco de recorte ("arrastrar dentro de la imagen")
      if (state.isPhotoPanningInCrop && window.CarouselEngine && canvas) {
        state.pointerInteractionDirty = true;
        const canvasRect = canvas.getBoundingClientRect();
        const normX = (e.clientX - canvasRect.left) / canvasRect.width;
        const normY = (e.clientY - canvasRect.top) / canvasRect.height;
        const strip = window.CarouselEngine.getStripDimensions(1200);
        const stripX = normX * strip.totalW;
        const stripY = normY * strip.totalH;

        window.CarouselEngine.panPhotoInCrop(
          window.CarouselEngine.state.selectedPhotoIndex,
          stripX - state.cropPanStart.stripX,
          stripY - state.cropPanStart.stripY,
          state.cropPanStart
        );

        requestRender();
        return;
      }

      // 3. Redimensionar marco de recorte mediante manijas
      if (state.isCropHandleDragging && window.CarouselEngine && canvas) {
        state.pointerInteractionDirty = true;
        const canvasRect = canvas.getBoundingClientRect();
        const normX = (e.clientX - canvasRect.left) / canvasRect.width;
        const normY = (e.clientY - canvasRect.top) / canvasRect.height;
        const strip = window.CarouselEngine.getStripDimensions(1200);
        const stripX = normX * strip.totalW;
        const stripY = normY * strip.totalH;

        window.CarouselEngine.resizeCropHandle(
          window.CarouselEngine.state.selectedPhotoIndex,
          state.isCropHandleDragging,
          stripX,
          stripY,
          state.cropHandleStart
        );

        updateCellSlidersFromState();
        requestRender();
        return;
      }

      // 4. Mover foto libremente en carrusel (por cualquier casilla o entre medias) con Snapping Magnético
      if (state.isPhotoDragging && window.CarouselEngine && canvas) {
        state.pointerInteractionDirty = true;
        const canvasRect = canvas.getBoundingClientRect();
        const normX = (e.clientX - canvasRect.left) / canvasRect.width;
        const normY = (e.clientY - canvasRect.top) / canvasRect.height;
        const strip = window.CarouselEngine.getStripDimensions(1200);
        const stripX = normX * strip.totalW;
        const stripY = normY * strip.totalH;

        const targetX = stripX - (state.photoDragOffset ? state.photoDragOffset.x : 0);
        const targetY = stripY - (state.photoDragOffset ? state.photoDragOffset.y : 0);

        window.CarouselEngine.movePhoto(
          window.CarouselEngine.state.selectedPhotoIndex,
          targetX,
          targetY,
          { snap: window.CarouselEngine.state.magneticSnapEnabled }
        );

        // Mostrar u ocultar banner flotante HUD de alineación
        const hud = document.getElementById('magneticHudBanner');
        const hudText = document.getElementById('magneticHudText');
        if (window.CarouselEngine.state.activeAlignmentNotice && hud && hudText) {
          hudText.textContent = window.CarouselEngine.state.activeAlignmentNotice;
          hud.style.display = 'flex';
        } else if (hud) {
          hud.style.display = 'none';
        }

        updateCellSlidersFromState();
        requestRender();
        return;
      }

      // Mover panorámica de carrusel continuo
      if (state.isSeamlessPanning && window.CarouselEngine && canvas) {
        state.pointerInteractionDirty = true;
        const canvasRect = canvas.getBoundingClientRect();
        const dx = (e.clientX - state.seamlessPanStart.x) / (canvasRect.width * 0.45);
        window.CarouselEngine.state.seamlessPanX = Math.max(-1.0, Math.min(1.0, state.seamlessPanStartVal + dx));
        const slPan = document.getElementById('sliderCarouselPan');
        const vPan = document.getElementById('valCarouselPan');
        if (slPan) {
          slPan.value = Math.round(window.CarouselEngine.state.seamlessPanX * 100);
          if (vPan) vPan.textContent = `${slPan.value} %`;
        }
        requestRender();
        return;
      }

      // Desplazamiento global del tablero
      if (state.isPanning) {
        state.viewIsFit = false;
        state.panX = e.clientX - state.panStartX;
        state.panY = e.clientY - state.panStartY;
        applyCanvasTransform();
        return;
      }

      if (state.cropDragging) {
        state.pointerInteractionDirty = true;
        handleCropDrag(e);
        return;
      }

      // Actualizar cursor dinámico según manija bajo el ratón en carrusel
      if (!state.isPhotoDragging && !state.isPhotoResizing && !state.isPhotoPanningInCrop && !state.isCropHandleDragging && !state.isPanning && !state.isSeamlessPanning) {
        if (state.carouselActive && window.CarouselEngine && window.CarouselEngine.state.mode === 'multi') {
          const canvasRect = canvas.getBoundingClientRect();
          const normX = (e.clientX - canvasRect.left) / canvasRect.width;
          const normY = (e.clientY - canvasRect.top) / canvasRect.height;
          if (normX >= 0 && normX <= 1 && normY >= 0 && normY <= 1) {
            const strip = window.CarouselEngine.getStripDimensions(1200);
            const stripX = normX * strip.totalW;
            const stripY = normY * strip.totalH;
            const selectedPhoto = window.CarouselEngine.getSelectedPhoto();
            const hit = window.CarouselEngine.hitTestPhotoHandle(stripX, stripY, selectedPhoto);
            if (hit && hit.cursor) {
              canvasViewport.style.cursor = hit.cursor;
            } else {
              const anyIdx = window.CarouselEngine.hitTestPhoto(stripX, stripY);
              if (anyIdx >= 0) {
                canvasViewport.style.cursor = 'move';
              } else if (window.CarouselEngine.state.activeTemplateId) {
                const anySlot = window.CarouselEngine.hitTestSlot(stripX, stripY);
                canvasViewport.style.cursor = anySlot ? 'pointer' : 'default';
              } else {
                canvasViewport.style.cursor = 'default';
              }
            }
          } else {
            canvasViewport.style.cursor = 'default';
          }
        }
      }

      updateInfoCursorCoordinates(e);
    }

    function handlePointerUp() {
      if (state.pointerInteractionDirty && state.pendingDragSnapshot) {
        saveSnapshot(state.pendingDragSnapshot);
      }
      state.pendingDragSnapshot = null;
      state.pointerInteractionDirty = false;

      state.isAnchorDragging = false;
      state.isPhotoDragging = false;
      state.isPhotoResizing = null;
      state.isPhotoPanningInCrop = false;
      state.isCropHandleDragging = null;
      state.isSeamlessPanning = false;

      const hud = document.getElementById('magneticHudBanner');
      setTimeout(() => {
        if (!state.isPhotoDragging && !state.isPhotoResizing && hud) {
          hud.style.display = 'none';
        }
      }, 900);

      if (state.isPanning) {
        state.isPanning = false;
        canvasViewport.classList.remove('panning');
      }
      if (state.cropDragging) {
        state.cropDragging = null;
        persistActiveSettings();
        refreshEditIndicators();
      }
    }

    canvasViewport.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    // =========================================================================
    // SOPORTE MULTITÁCTIL Y GESTOS AVANZADOS PARA IPAD PRO (M1 / APPLE PENCIL)
    // =========================================================================
    canvasViewport.addEventListener('touchstart', (e) => {
      if (!state.imageSource && !state.carouselActive) return;
      if (
        (e.target && e.target.closest && (
          e.target.closest('#dropzoneOverlay') ||
          e.target.closest('.crop-overlay') ||
          e.target.closest('.integrated-sidebar') ||
          e.target.closest('.canva-floating-toolbar') ||
          e.target.closest('.canva-slide-navbar') ||
          e.target.closest('#bottomFilmstripBar') ||
          e.target.closest('.compare-handle') ||
          e.target.closest('.modal-backdrop')
        ))
      ) return;

      // Desactivar zoom y scroll nativo del viewport en iPadOS
      e.preventDefault();

      if (e.touches.length === 1) {
        const t0 = e.touches[0];
        const now = Date.now();
        const dt = now - touchState.lastTapTime;
        const distTap = Math.hypot(t0.clientX - touchState.lastTapPos.x, t0.clientY - touchState.lastTapPos.y);

        if (dt < 320 && distTap < 35) {
          // Doble toque rápido en iPad
          touchState.lastTapTime = 0;
          if (state.carouselActive && window.CarouselEngine && window.CarouselEngine.state.mode === 'multi') {
            const canvasRect = canvas.getBoundingClientRect();
            const normX = (t0.clientX - canvasRect.left) / canvasRect.width;
            const normY = (t0.clientY - canvasRect.top) / canvasRect.height;
            if (normX >= 0 && normX <= 1 && normY >= 0 && normY <= 1) {
              const strip = window.CarouselEngine.getStripDimensions(1200);
              const hitIdx = window.CarouselEngine.hitTestPhoto(normX * strip.totalW, normY * strip.totalH);
              if (hitIdx >= 0) {
                selectCarouselPhotoByIndex(hitIdx);
                const isCrop = window.CarouselEngine.togglePhotoCropMode(hitIdx);
                updateCarouselCellUI();
                requestRender();
                showToast(isCrop ? 'Modo Encuadre: Mueve o recorta la foto' : 'Encuadre confirmado');
                return;
              }
            }
          }
          // Doble toque sobre el fondo: Centrar y ajustar vista completa (como la tecla 'Z')
          fitViewCentered();
          showToast('Vista centrada');
          return;
        }

        touchState.lastTapTime = now;
        touchState.lastTapPos = { x: t0.clientX, y: t0.clientY };
        touchState.isMultiTouch = false;
        touchState.mode = null;

        handlePointerDown({
          clientX: t0.clientX,
          clientY: t0.clientY,
          button: 0,
          target: e.target,
          metaKey: false,
          shiftKey: false,
          spaceKey: false
        });
      } else if (e.touches.length === 2) {
        // Gesto con dos dedos (Pellizco / Zoom de foto o de lienzo + Desplazamiento con dos dedos)
        handlePointerUp();

        touchState.isMultiTouch = true;
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        const midX = (t0.clientX + t1.clientX) * 0.5;
        const midY = (t0.clientY + t1.clientY) * 0.5;

        let overSelectedPhoto = false;
        if (state.carouselActive && window.CarouselEngine && window.CarouselEngine.state.mode === 'multi') {
          const canvasRect = canvas.getBoundingClientRect();
          const normX = (midX - canvasRect.left) / canvasRect.width;
          const normY = (midY - canvasRect.top) / canvasRect.height;
          if (normX >= 0 && normX <= 1 && normY >= 0 && normY <= 1) {
            const strip = window.CarouselEngine.getStripDimensions(1200);
            const stripX = normX * strip.totalW;
            const stripY = normY * strip.totalH;
            const photo = window.CarouselEngine.getSelectedPhoto();
            const hitIdx = window.CarouselEngine.hitTestPhoto(stripX, stripY);
            if (photo && (hitIdx === window.CarouselEngine.state.selectedPhotoIndex || window.CarouselEngine.hitTestPhotoHandle(stripX, stripY, photo))) {
              overSelectedPhoto = true;
              touchState.mode = 'photo-pinch';
              touchState.targetPhotoIndex = window.CarouselEngine.state.selectedPhotoIndex;
              touchState.initialPhotoScale = photo.scale;
              touchState.initialDist = Math.max(10, dist);
              saveSnapshot();
            }
          }
        }

        if (!overSelectedPhoto) {
          touchState.mode = 'canvas-pinch';
          touchState.initialDist = Math.max(10, dist);
          touchState.initialMid = { x: midX, y: midY };
          touchState.initialCanvasZoom = state.zoom;
          touchState.initialPanX = state.panX;
          touchState.initialPanY = state.panY;
        }
      }
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && touchState.isMultiTouch) {
        e.preventDefault();
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        const midX = (t0.clientX + t1.clientX) * 0.5;
        const midY = (t0.clientY + t1.clientY) * 0.5;

        if (touchState.mode === 'photo-pinch' && window.CarouselEngine) {
          const ratio = dist / touchState.initialDist;
          const newScale = touchState.initialPhotoScale * ratio;
          window.CarouselEngine.scalePhoto(
            touchState.targetPhotoIndex,
            newScale,
            { snap: window.CarouselEngine.state.magneticSnapEnabled }
          );

          const hud = document.getElementById('magneticHudBanner');
          const hudText = document.getElementById('magneticHudText');
          if (window.CarouselEngine.state.activeAlignmentNotice && hud && hudText) {
            hudText.textContent = window.CarouselEngine.state.activeAlignmentNotice;
            hud.style.display = 'flex';
          }

          updateCellSlidersFromState();
          requestRender();
          return;
        } else if (touchState.mode === 'canvas-pinch') {
          const zoomFactor = dist / touchState.initialDist;
          const newZoom = Math.min(8.0, Math.max(0.05, touchState.initialCanvasZoom * zoomFactor));

          const panDx = midX - touchState.initialMid.x;
          const panDy = midY - touchState.initialMid.y;

          const rect = canvasViewport.getBoundingClientRect();
          const mouseX = touchState.initialMid.x - rect.left - rect.width * 0.5;
          const mouseY = touchState.initialMid.y - rect.top - rect.height * 0.5;

          const scaleRatio = newZoom / touchState.initialCanvasZoom;
          state.panX = touchState.initialPanX + panDx - (mouseX - touchState.initialPanX) * (scaleRatio - 1);
          state.panY = touchState.initialPanY + panDy - (mouseY - touchState.initialPanY) * (scaleRatio - 1);
          state.zoom = newZoom;
          state.viewIsFit = false;

          applyCanvasTransform();
          syncZoomControls();
          requestRender();
          return;
        }
      } else if (e.touches.length === 1 && !touchState.isMultiTouch) {
        const t0 = e.touches[0];
        handlePointerMove({ clientX: t0.clientX, clientY: t0.clientY });
      }
    }, { passive: false });

    window.addEventListener('touchend', (e) => {
      if (e.touches.length === 0) {
        if (touchState.isMultiTouch) {
          touchState.isMultiTouch = false;
          touchState.mode = null;
        } else {
          handlePointerUp();
        }
      } else if (e.touches.length === 1 && touchState.isMultiTouch) {
        touchState.isMultiTouch = false;
        touchState.mode = null;
      }
    });

    window.addEventListener('touchcancel', () => {
      touchState.isMultiTouch = false;
      touchState.mode = null;
      handlePointerUp();
    });

    // Doble clic sobre una foto en el carrusel para entrar o salir rápidamente del modo recorte
    canvasViewport.addEventListener('dblclick', (e) => {
      if (state.carouselActive && window.CarouselEngine && window.CarouselEngine.state.mode === 'multi') {
        const canvasRect = canvas.getBoundingClientRect();
        const normX = (e.clientX - canvasRect.left) / canvasRect.width;
        const normY = (e.clientY - canvasRect.top) / canvasRect.height;
        if (normX >= 0 && normX <= 1 && normY >= 0 && normY <= 1) {
          const strip = window.CarouselEngine.getStripDimensions(1200);
          const stripX = normX * strip.totalW;
          const stripY = normY * strip.totalH;
          const hitIdx = window.CarouselEngine.hitTestPhoto(stripX, stripY);
          if (hitIdx >= 0) {
            selectCarouselPhotoByIndex(hitIdx);
            const newMode = window.CarouselEngine.togglePhotoCropMode(hitIdx);
            updateCarouselCellUI();
            requestRender();
            if (newMode) {
              showToast('Modo Encuadre: Arrastra dentro para mover la foto o las esquinas para recortar');
            } else {
              showToast('Encuadre confirmado');
            }
          }
        }
      }
    });

    // Manijas y cuerpo de recorte
    const cropOverlay = document.getElementById('cropOverlay');
    cropOverlay.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      const handle = e.target.dataset.handle || 'body';
      state.pendingDragSnapshot = createSnapshotObject();
      state.pointerInteractionDirty = false;
      state.cropDragging = handle;
      state.cropDragStart = { x: e.clientX, y: e.clientY };
      state.cropStartRect = { ...state.settings.crop };
    });
  }

  function updateInfoCursorCoordinates(e) {
    if (!canvas || !displayCtx) return;
    const canvasRect = canvas.getBoundingClientRect();
    if (!canvasRect.width || !canvasRect.height) return;
    const infoX = document.getElementById('infoCursorX');
    const infoY = document.getElementById('infoCursorY');
    const infoR = document.getElementById('infoR');
    const infoG = document.getElementById('infoG');
    const infoB = document.getElementById('infoB');

    const normX = (e.clientX - canvasRect.left) / canvasRect.width;
    const normY = (e.clientY - canvasRect.top) / canvasRect.height;

    if (normX >= 0 && normX <= 1 && normY >= 0 && normY <= 1) {
      const px = Math.round(normX * state.rawWidth);
      const py = Math.round(normY * state.rawHeight);
      infoX.textContent = px;
      infoY.textContent = py;

      try {
        const canX = Math.floor(normX * canvas.width);
        const canY = Math.floor(normY * canvas.height);
        const p = displayCtx.getImageData(canX, canY, 1, 1).data;
        infoR.textContent = p[0];
        infoG.textContent = p[1];
        infoB.textContent = p[2];
      } catch (err) {
        const estLuma = Math.round(128 + 40 * Math.sin(normX * 3.14) + 30 * Math.cos(normY * 3.14));
        infoR.textContent = Math.min(255, Math.max(0, estLuma + 12));
        infoG.textContent = Math.min(255, Math.max(0, estLuma));
        infoB.textContent = Math.min(255, Math.max(0, estLuma - 10));
      }
    } else {
      infoX.textContent = '---';
      infoY.textContent = '---';
    }
  }

  function handleCropDrag(e) {
    if (!state.cropDragging || !canvas) return;

    const canvasRect = canvas.getBoundingClientRect();
    const dxNorm = (e.clientX - state.cropDragStart.x) / canvasRect.width;
    const dyNorm = (e.clientY - state.cropDragStart.y) / canvasRect.height;
    const r = state.cropStartRect;
    let newCrop = { ...r };

    if (state.cropDragging === 'body') {
      newCrop.x = Math.max(0.0, Math.min(1.0 - r.w, r.x + dxNorm));
      newCrop.y = Math.max(0.0, Math.min(1.0 - r.h, r.y + dyNorm));
    } else {
      const h = state.cropDragging;
      if (h.includes('r')) newCrop.w = Math.max(0.05, Math.min(1.0 - r.x, r.w + dxNorm));
      if (h.includes('l')) {
        const maxDx = r.w - 0.05;
        const actualDx = Math.max(-r.x, Math.min(maxDx, dxNorm));
        newCrop.x = r.x + actualDx;
        newCrop.w = r.w - actualDx;
      }
      if (h.includes('b')) newCrop.h = Math.max(0.05, Math.min(1.0 - r.y, r.h + dyNorm));
      if (h.includes('t')) {
        const maxDy = r.h - 0.05;
        const actualDy = Math.max(-r.y, Math.min(maxDy, dyNorm));
        newCrop.y = r.y + actualDy;
        newCrop.h = r.h - actualDy;
      }
    }

    state.settings.crop = newCrop;
    updateCropOverlayPosition();
    requestRender();
  }

  // =========================================================================
  // ATAJOS DE TECLADO GLOBALES
  // =========================================================================
  function initShortcuts() {
    const isTyping = (el) => el && (el.tagName === 'INPUT' && el.type !== 'range' && el.type !== 'checkbox' ||
      el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

    window.addEventListener('keydown', (e) => {
      if (isTyping(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key;
      const lower = key.length === 1 ? key.toLowerCase() : key;
      const anyModalOpen = !!document.querySelector('.modal-backdrop.open');

      // Escape: cerrar diálogos, salir de recorte / encuadre / ancla
      if (key === 'Escape') {
        if (anyModalOpen) {
          document.querySelectorAll('.modal-backdrop.open').forEach(m => m.classList.remove('open'));
          return;
        }
        if (state.carouselActive && window.CarouselEngine) {
          const photo = window.CarouselEngine.getSelectedPhoto();
          if (photo && photo.isCropMode) {
            window.CarouselEngine.togglePhotoCropMode(window.CarouselEngine.state.selectedPhotoIndex, false);
            updateCarouselCellUI();
            requestRender();
            showToast('Encuadre cancelado');
            return;
          }
        }
        if (state.activeTool === 'crop') { toggleCropMode(false); return; }
        if (state.activeTool === 'anchor') { setTool('pan'); return; }
        if (state.compareSplit) { setCompareSplit(false); return; }
        if (typeof state.closeMobileSidebar === 'function') state.closeMobileSidebar();
        return;
      }

      if (anyModalOpen) return;

      // Deshacer / rehacer
      if (mod && lower === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if (mod && lower === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      // Copiar / pegar ajustes (⇧⌘C / ⇧⌘V). ⌘V sin mayúsculas sigue pegando fotos.
      if (mod && e.shiftKey && lower === 'c') {
        e.preventDefault();
        copySettings();
        return;
      }
      if (mod && e.shiftKey && lower === 'v') {
        e.preventDefault();
        pasteSettings();
        return;
      }

      // Abrir y exportar
      if (mod && lower === 'o') {
        e.preventDefault();
        document.getElementById('filePicker').click();
        return;
      }
      if (mod && lower === 'e') {
        e.preventDefault();
        document.getElementById('btnOpenExportModal').click();
        return;
      }

      // Zoom
      if (mod && (key === '+' || key === '=')) {
        e.preventDefault();
        setZoomPercent(Math.round(state.zoom * 100 * 1.25));
        return;
      }
      if (mod && (key === '-' || key === '_')) {
        e.preventDefault();
        setZoomPercent(Math.round(state.zoom * 100 / 1.25));
        return;
      }
      if (mod && key === '0') {
        e.preventDefault();
        fitViewCentered();
        return;
      }

      if (mod || e.altKey) return;

      if (lower === 'z') {
        e.preventDefault();
        fitViewCentered();
      } else if (key === '\\') {
        // Mantener pulsada para ver el original
        e.preventDefault();
        if (!e.repeat) setBeforeAfter(true);
      } else if (lower === 'y') {
        e.preventDefault();
        setCompareSplit(!state.compareSplit);
      } else if (lower === 'c') {
        e.preventDefault();
        if (state.activeTool === 'crop') {
          toggleCropMode(false);
        } else {
          activateTab('crop');
        }
      } else if (key === '?' || (e.shiftKey && key === '/')) {
        e.preventDefault();
        openModal('shortcutsModal');
      } else if (/^[1-5]$/.test(key)) {
        e.preventDefault();
        activateTab(TAB_ORDER[parseInt(key, 10) - 1]);
      } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
        if (state.loadedPhotos.length > 1 && !state.carouselActive) {
          e.preventDefault();
          const dir = key === 'ArrowLeft' ? -1 : 1;
          const next = (state.activePhotoIndex + dir + state.loadedPhotos.length) % state.loadedPhotos.length;
          selectPhotoByIndex(next);
        }
      } else if (key === 'Enter') {
        if (state.carouselActive && window.CarouselEngine) {
          const photo = window.CarouselEngine.getSelectedPhoto();
          if (photo && photo.isCropMode) {
            window.CarouselEngine.togglePhotoCropMode(window.CarouselEngine.state.selectedPhotoIndex, false);
            updateCarouselCellUI();
            requestRender();
            showToast('Encuadre confirmado');
            return;
          }
        }
        if (state.activeTool === 'crop') {
          toggleCropMode(false);
          fitViewCentered();
          showToast('Recorte aplicado');
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === '\\') setBeforeAfter(false);
    });
    window.addEventListener('blur', () => setBeforeAfter(false));
  }

  // =========================================================================
  // PESTAÑAS DEL PANEL
  // =========================================================================
  function initTabs() {
    document.querySelectorAll('.sidebar-tab').forEach(tab => {
      tab.addEventListener('click', () => activateTab(tab.dataset.tab));
    });
  }

  function activateTab(tabName) {
    if (!TAB_ORDER.includes(tabName)) return;
    const prev = state.activeTab;
    state.activeTab = tabName;
    document.querySelectorAll('.sidebar-tab').forEach(t => {
      const on = t.dataset.tab === tabName;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.tab-panel').forEach(p => {
      p.classList.toggle('active', p.dataset.panel === tabName);
    });
    document.querySelectorAll('.mobile-nav-btn[data-mobile-tab]').forEach(b => {
      b.classList.toggle('active', b.dataset.mobileTab === tabName);
    });
    const body = document.querySelector('.sidebar-body');
    if (body && prev !== tabName) body.scrollTop = 0;

    // La pestaña Recorte muestra el marco de recorte; al salir se oculta
    if (tabName === 'crop' && state.imageSource && !state.carouselActive) {
      if (state.compareSplit) setCompareSplit(false);
      toggleCropMode(true);
    } else if (prev === 'crop' && tabName !== 'crop' && state.activeTool === 'crop') {
      toggleCropMode(false);
      fitViewCentered();
    }
    // El modo ancla solo tiene sentido en la pestaña Movimiento
    if (tabName === 'motion' && state.settings.anchorEnabled && !state.carouselActive) {
      setTool('anchor');
    } else if (tabName !== 'motion' && state.activeTool === 'anchor') {
      setTool('pan');
    }
    if (tabName === 'develop') scheduleProfileThumbnails(30);
  }

  // =========================================================================
  // TEMA CLARO / OSCURO
  // =========================================================================
  function initTheme() {
    const btn = document.getElementById('btnThemeToggle');
    applyTheme(document.documentElement.getAttribute('data-theme') || 'dark', false);
    if (btn) {
      btn.addEventListener('click', () => {
        const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        applyTheme(next, true);
      });
    }
  }

  function applyTheme(theme, persist) {
    const t = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'light' ? '#faf9f7' : '#161618');
    const btn = document.getElementById('btnThemeToggle');
    if (btn) btn.title = t === 'light' ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro';
    if (persist) {
      try { localStorage.setItem('muchofilm.theme', t); } catch (e) { /* sin almacenamiento */ }
    }
    scheduleHistogram();
  }

  // =========================================================================
  // COMPARAR ANTES / DESPUÉS
  // =========================================================================
  function initCompare() {
    const btn = document.getElementById('btnCompareSplit');
    if (btn) btn.addEventListener('click', () => setCompareSplit(!state.compareSplit));

    const splitter = document.getElementById('compareSplitter');
    const handle = splitter ? splitter.querySelector('.compare-handle') : null;
    if (!handle) return;

    let dragging = false;
    const moveTo = (clientX) => {
      const r = splitter.getBoundingClientRect();
      if (!r.width) return;
      state.splitPos = Math.max(0.0, Math.min(1.0, (clientX - r.left) / r.width));
      splitter.style.setProperty('--split-x', `${state.splitPos * 100}%`);
      requestRender();
    };
    handle.addEventListener('pointerdown', (e) => {
      dragging = true;
      handle.setPointerCapture(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
    });
    handle.addEventListener('pointermove', (e) => {
      if (dragging) moveTo(e.clientX);
    });
    const end = () => { dragging = false; };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
    // Evitar que el ratón/toque sobre el tirador active el desplazamiento del lienzo
    handle.addEventListener('mousedown', (e) => e.stopPropagation());
    handle.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
  }

  function setCompareSplit(on) {
    if (on && (!state.imageSource || state.carouselActive)) {
      if (state.carouselActive) showToast('La comparación no está disponible en modo carrusel');
      return;
    }
    state.compareSplit = !!on;
    if (on && state.activeTool === 'crop') toggleCropMode(false);
    const btn = document.getElementById('btnCompareSplit');
    if (btn) btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) state.splitPos = 0.5;
    updateCompareSplitter();
    requestRender();
  }

  function setBeforeAfter(on) {
    if (state.beforeAfter === !!on) return;
    if (on && !state.imageSource) return;
    state.beforeAfter = !!on;
    document.getElementById('beforeBadge')?.classList.toggle('visible', state.beforeAfter);
    updateCompareSplitter();
    requestRender();
  }

  function updateCompareSplitter() {
    const el = document.getElementById('compareSplitter');
    if (!el || !canvas) return;
    const show = state.compareSplit && !state.carouselActive && !!state.imageSource && !state.beforeAfter;
    el.classList.toggle('visible', show);
    if (!show) return;

    const cr = canvas.getBoundingClientRect();
    const vr = canvasViewport.getBoundingClientRect();
    // Si hay borde de negativo en modo "encajar", la comparación ocupa solo la ventana de la foto
    let fx = 0, fy = 0, fw = 1, fh = 1;
    const s = state.settings;
    const FR = window.FrameRenderer;
    if (FR && s.frameEnabled !== false && FR.isBorderActive(s.frameType) && pipeline && pipeline.canvas.width) {
      const geo = FR.getFrameGeometry(pipeline.canvas.width, pipeline.canvas.height, s.frameType, s.frameScale, s);
      if (!geo.isMultiWin && geo.width && geo.height) {
        fx = geo.photoX / geo.width;
        fy = geo.photoY / geo.height;
        fw = geo.photoW / geo.width;
        fh = geo.photoH / geo.height;
      }
    }
    el.style.left = `${cr.left - vr.left + fx * cr.width}px`;
    el.style.top = `${cr.top - vr.top + fy * cr.height}px`;
    el.style.width = `${fw * cr.width}px`;
    el.style.height = `${fh * cr.height}px`;
    el.style.setProperty('--split-x', `${state.splitPos * 100}%`);
  }

  // =========================================================================
  // DESLIZADORES: RELLENO, ESTADO MODIFICADO Y VALOR EDITABLE
  // =========================================================================
  function refreshSliderVisual(slider) {
    if (!slider || slider.type !== 'range') return;
    const min = parseFloat(slider.min || 0);
    const max = parseFloat(slider.max || 100);
    const val = parseFloat(slider.value);
    const def = parseFloat(slider.defaultValue);
    const span = max - min || 1;
    const pct = ((val - min) / span) * 100;
    // Relleno desde el centro en controles bipolares; desde el inicio en el resto
    const origin = (min < 0 && max > 0) ? ((0 - min) / span) * 100 : 0;
    slider.style.setProperty('--fill-a', `${Math.min(origin, pct)}%`);
    slider.style.setProperty('--fill-b', `${Math.max(origin, pct)}%`);
    const row = slider.closest('.slider-control-row');
    if (row) row.classList.toggle('is-modified', Math.abs(val - def) > 1e-6);
  }

  function refreshAllSliderVisuals() {
    document.querySelectorAll('.integrated-sidebar .macos-slider').forEach(refreshSliderVisual);
  }

  function initSliderEnhancements() {
    const sidebar = document.getElementById('integratedSidebar');
    if (!sidebar) return;

    sidebar.addEventListener('input', (e) => {
      if (e.target.classList && e.target.classList.contains('macos-slider')) refreshSliderVisual(e.target);
    });

    // Doble clic en la etiqueta = volver al valor inicial (igual que en el control)
    sidebar.querySelectorAll('.slider-control-row .slider-label').forEach(label => {
      label.title = 'Doble clic para restablecer';
      label.addEventListener('dblclick', () => {
        const slider = label.closest('.slider-control-row').querySelector('.macos-slider');
        if (slider) slider.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      });
    });

    // Clic en el número para escribir un valor exacto
    sidebar.querySelectorAll('.slider-control-row .slider-value-readout').forEach(readout => {
      const row = readout.closest('.slider-control-row');
      const slider = row ? row.querySelector('.macos-slider') : null;
      if (!slider) return;
      readout.title = 'Clic para escribir un valor';
      readout.setAttribute('role', 'button');
      readout.setAttribute('tabindex', '0');

      const startEdit = () => {
        if (row.querySelector('.readout-input')) return;
        const input = document.createElement('input');
        input.type = 'text';
        input.inputMode = 'decimal';
        input.className = 'readout-input';
        input.value = slider.value;
        readout.style.display = 'none';
        row.appendChild(input);
        input.focus();
        input.select();

        let done = false;
        const finish = (commit) => {
          if (done) return;
          done = true;
          if (commit) {
            const num = parseFloat(String(input.value).replace(',', '.').replace(/[^\d.+-]/g, ''));
            if (!isNaN(num)) {
              const clamped = Math.max(parseFloat(slider.min), Math.min(parseFloat(slider.max), num));
              slider.value = clamped;
              slider.dispatchEvent(new Event('input', { bubbles: true }));
              slider.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
          input.remove();
          readout.style.display = '';
        };
        input.addEventListener('keydown', (ev) => {
          ev.stopPropagation();
          if (ev.key === 'Enter') finish(true);
          else if (ev.key === 'Escape') finish(false);
        });
        input.addEventListener('blur', () => finish(true));
      };

      readout.addEventListener('click', startEdit);
      readout.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          startEdit();
        }
      });
    });

    refreshAllSliderVisuals();
  }

  // =========================================================================
  // RESTABLECER POR SECCIÓN
  // =========================================================================
  function initSectionResets() {
    document.querySelectorAll('[data-reset-section]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetSection(btn.dataset.resetSection);
      });
    });
  }

  function resetSection(section) {
    const keys = SECTION_KEYS[section];
    if (!keys || !state.imageSource) return;
    saveSnapshot();
    const d = getDefaultSettings();
    keys.forEach(k => { state.settings[k] = cloneDeep(d[k]); });
    if (section === 'basics') {
      state.settings.basicsEnabled = true;
    }
    if (section === 'motion' && state.activeTool === 'anchor') setTool('pan');
    persistActiveSettings();
    updateUIFromSettings();
    if (section === 'crop' || section === 'frame') fitViewCentered();
    if (section === 'crop') updateCropOverlayPosition();
    requestRender();
    const names = { basics: 'Ajustes básicos', grain: 'Grano', motion: 'Movimiento', dust: 'Polvo y desgaste', leak: 'Fugas de luz', frame: 'Borde', crop: 'Recorte' };
    showToast(`${names[section] || 'Sección'} restablecido`, { label: 'Deshacer', onAction: undo });
  }

  // =========================================================================
  // COPIAR / PEGAR AJUSTES Y APLICAR A TODAS
  // =========================================================================
  function extractStyle(settings) {
    const st = cloneDeep(settings);
    GEOMETRY_KEYS.forEach(k => delete st[k]);
    return st;
  }

  function applyStyleToActive(style) {
    state.settings = { ...state.settings, ...cloneDeep(style) };
    persistActiveSettings();
    updateUIFromSettings();
    if (!state.carouselActive) fitViewCentered();
    requestRender();
  }

  function copySettings() {
    if (!state.imageSource) return;
    state.copiedStyle = extractStyle(state.settings);
    updateProjectUI();
    showToast('Ajustes copiados · pégalos en otra foto con ⇧⌘V');
  }

  function pasteSettings() {
    if (!state.copiedStyle) {
      showToast('Primero copia los ajustes de una foto (⇧⌘C)');
      return;
    }
    if (!state.imageSource) return;
    saveSnapshot();
    applyStyleToActive(state.copiedStyle);
    renderBottomFilmstrip();
    showToast('Ajustes pegados', { label: 'Deshacer', onAction: undo });
  }

  function syncSettingsToAll() {
    if (state.loadedPhotos.length < 2 || !state.imageSource) return;
    saveSnapshot();
    const style = extractStyle(state.settings);
    state.loadedPhotos.forEach((p, idx) => {
      if (idx === state.activePhotoIndex) return;
      p.settings = { ...(p.settings || getDefaultSettings()), ...cloneDeep(style) };
    });
    persistActiveSettings();
    renderBottomFilmstrip();
    showToast(`Ajustes aplicados a ${state.loadedPhotos.length} fotos`, { label: 'Deshacer', onAction: undo });
  }

  function initSettingsClipboard() {
    document.getElementById('btnCopySettings')?.addEventListener('click', copySettings);
    document.getElementById('btnPasteSettings')?.addEventListener('click', pasteSettings);
    document.getElementById('btnSyncAll')?.addEventListener('click', syncSettingsToAll);
  }

  // =========================================================================
  // ESTILOS GUARDADOS ("MIS ESTILOS")
  // =========================================================================
  const STYLES_KEY = 'muchofilm.userStyles';

  function getUserStyles() {
    const list = storageGet(STYLES_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function renderUserStyles() {
    const wrap = document.getElementById('userStylesList');
    if (!wrap) return;
    const styles = getUserStyles();
    wrap.innerHTML = '';
    if (styles.length === 0) {
      const hint = document.createElement('span');
      hint.className = 'empty-hint';
      hint.textContent = 'Guarda tu combinación de ajustes favorita para aplicarla a otras fotos con un clic.';
      wrap.appendChild(hint);
      return;
    }
    styles.forEach(st => {
      const chip = document.createElement('div');
      chip.className = 'style-chip';

      const apply = document.createElement('button');
      apply.className = 'style-chip-apply';
      apply.title = `Aplicar «${st.name}»`;
      apply.innerHTML = '<svg class="i"><use href="#i-bookmark"/></svg>';
      apply.appendChild(document.createTextNode(st.name));
      apply.addEventListener('click', () => {
        if (!state.imageSource) {
          showToast('Abre primero una foto');
          return;
        }
        saveSnapshot();
        applyStyleToActive(st.settings);
        renderBottomFilmstrip();
        showToast(`Estilo «${st.name}» aplicado`, { label: 'Deshacer', onAction: undo });
      });

      const del = document.createElement('button');
      del.className = 'style-chip-del';
      del.title = `Borrar «${st.name}»`;
      del.setAttribute('aria-label', `Borrar estilo ${st.name}`);
      del.innerHTML = '<svg class="i"><use href="#i-x"/></svg>';
      del.addEventListener('click', () => {
        const before = getUserStyles();
        storageSet(STYLES_KEY, before.filter(x => x.id !== st.id));
        renderUserStyles();
        showToast(`Estilo «${st.name}» borrado`, {
          label: 'Deshacer',
          onAction: () => { storageSet(STYLES_KEY, before); renderUserStyles(); }
        });
      });

      chip.appendChild(apply);
      chip.appendChild(del);
      wrap.appendChild(chip);
    });
  }

  function initUserStyles() {
    const btnSave = document.getElementById('btnSaveStyle');
    const form = document.getElementById('saveStyleForm');
    const input = document.getElementById('saveStyleName');
    const cancel = document.getElementById('btnCancelStyle');
    if (!btnSave || !form || !input) return;

    const close = () => { form.hidden = true; input.value = ''; };
    btnSave.addEventListener('click', () => {
      if (!state.imageSource) {
        showToast('Abre una foto y ajústala para guardar su estilo');
        return;
      }
      form.hidden = false;
      const profile = state.settings.activeFilmProfile && FILM_PROFILES[state.settings.activeFilmProfile];
      input.value = profile ? `${profile.name.replace(/^(Kodak|Fujifilm|Fuji)\s+/, '')} personal` : '';
      input.focus();
      input.select();
    });
    cancel?.addEventListener('click', close);
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') close();
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = input.value.trim().slice(0, 32) || `Estilo ${getUserStyles().length + 1}`;
      const styles = getUserStyles();
      styles.push({ id: 'st_' + Date.now(), name, settings: extractStyle(state.settings) });
      storageSet(STYLES_KEY, styles);
      close();
      renderUserStyles();
      showToast(`Estilo «${name}» guardado`);
    });

    renderUserStyles();
  }

  // =========================================================================
  // DIÁLOGOS: ATAJOS Y UTILIDADES
  // =========================================================================
  function openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.add('open');
    const focusable = m.querySelector('button, select, input');
    if (focusable) setTimeout(() => focusable.focus(), 50);
  }

  function initShortcutsModal() {
    const modal = document.getElementById('shortcutsModal');
    document.getElementById('btnShortcuts')?.addEventListener('click', () => openModal('shortcutsModal'));
    document.getElementById('btnCloseShortcuts')?.addEventListener('click', () => modal.classList.remove('open'));
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });
  }

  // =========================================================================
  // AJUSTE AUTOMÁTICO DE TONO (analiza el histograma de luminancia de la foto)
  // =========================================================================
  function computeAutoTone(photo) {
    getThumbSourceFloat(photo);
    const f = photo.thumbFloat;
    const hist = new Uint32Array(256);
    const histMax = new Uint32Array(256); // canal más brillante de cada píxel (detecta colores saturados a punto de quemarse)
    let n = 0;
    for (let i = 0; i < f.length; i += 4) {
      const y = 0.2126 * f[i] + 0.7152 * f[i + 1] + 0.0722 * f[i + 2];
      hist[Math.max(0, Math.min(255, Math.round(y * 255)))]++;
      const mx = Math.max(f[i], f[i + 1], f[i + 2]);
      histMax[Math.max(0, Math.min(255, Math.round(mx * 255)))]++;
      n++;
    }
    const pctOf = (h, p) => {
      const target = n * p;
      let acc = 0;
      for (let i = 0; i < 256; i++) {
        acc += h[i];
        if (acc >= target) return i / 255;
      }
      return 1;
    };
    const pct = (p) => pctOf(hist, p);
    const p01 = pct(0.01);
    const p10 = pct(0.10);
    const p50 = pct(0.50);
    const p90 = pct(0.90);
    const p99 = pct(0.99);
    const pMax98 = pctOf(histMax, 0.98);

    const toLinear = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const round5 = (v) => Math.round(v / 5) * 5;

    // Exposición: llevar la mediana hacia el gris medio (18 %), con suavidad y sin quemar
    // las zonas más brillantes (el resto de la subida se consigue abriendo sombras)
    const linMedian = Math.max(0.005, toLinear(p50));
    let exposure = clamp(Math.log2(0.18 / linMedian) * 0.5, -1.0, 1.0);
    const headroom = Math.log2(0.92 / Math.max(0.02, toLinear(pMax98)));
    if (exposure > 0) exposure = Math.min(exposure, Math.max(0, headroom));
    exposure = Math.round(exposure * 20) / 20;

    // Luces y sombras: recuperar extremos recortados
    const highlights = p99 > 0.96 ? -clamp(round5((p99 - 0.9) * 450), 10, 60) : 0;
    // Si la foto es oscura y no se ha podido subir la exposición, abrir más las sombras
    const darkBoost = linMedian < 0.09 ? clamp(round5((0.09 - linMedian) * 300), 0, 25) : 0;
    const shadows = clamp((p01 < 0.03 ? clamp(round5((0.08 - p01) * 450), 10, 45) : 0) + darkBoost, 0, 60);

    // Blancos y negros: estirar el rango si la foto está "lavada"
    const whites = p99 < 0.9 ? clamp(round5((0.95 - p99) * 160), 0, 40) : 0;
    const blacks = p01 > 0.06 ? -clamp(round5((p01 - 0.02) * 300), 0, 40) : 0;

    // Contraste según la dispersión de tonos (sin subirlo si hay sombras profundas que se empastarían)
    const spread = p90 - p10;
    let contrast = spread < 0.55 ? clamp(round5((0.62 - spread) * 70), 5, 25) : (spread > 0.85 ? -10 : 5);
    if (p01 < 0.05 && contrast > 0) contrast = 0;

    return {
      exposure,
      highlights,
      shadows,
      whites,
      blacks,
      contrast,
      vibrance: 12,
      clarity: 5,
      sharpness: Math.max(state.settings.sharpness || 0, 15)
    };
  }

  // =========================================================================
  // MOTOR DE EXPORTACIÓN (FOTOGRAFÍA INDIVIDUAL Y CARRUSEL)
  // =========================================================================
  function initExportModal() {
    const modal = document.getElementById('exportModal');
    const openBtn = document.getElementById('btnOpenExportModal');
    const closeBtn = document.getElementById('btnCloseExportModal');
    const cancelBtn = document.getElementById('btnCancelExport');
    const confirmBtn = document.getElementById('btnConfirmExport');
    const resSelect = document.getElementById('exportResSelect');
    const fmtSelect = document.getElementById('exportFormatSelect');
    const jpegSlider = document.getElementById('sliderExportJpegQuality');
    const jpegLabel = document.getElementById('valExportJpegQuality');
    const jpegBox = document.getElementById('exportJpegQualityBox');
    const allRow = document.getElementById('exportAllRow');
    const allToggle = document.getElementById('exportAllToggle');

    // Recordar las últimas preferencias de exportación
    const prefs = storageGet('muchofilm.exportPrefs', null);
    if (prefs) {
      if (prefs.res && resSelect.querySelector(`option[value="${prefs.res}"]`)) resSelect.value = prefs.res;
      if (prefs.fmt) fmtSelect.value = prefs.fmt;
      if (prefs.q) jpegSlider.value = prefs.q;
    }

    const syncFormatUI = () => {
      document.querySelectorAll('[data-export-format]').forEach(b => {
        const on = b.dataset.exportFormat === fmtSelect.value;
        b.classList.toggle('active', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
      });
      jpegBox.style.display = (fmtSelect.value === 'jpeg') ? '' : 'none';
      jpegLabel.textContent = `${jpegSlider.value}%`;
      refreshSliderVisual(jpegSlider);
      updateExportSummary();
    };

    document.querySelectorAll('[data-export-format]').forEach(b => {
      b.addEventListener('click', () => {
        fmtSelect.value = b.dataset.exportFormat;
        syncFormatUI();
      });
    });

    openBtn.addEventListener('click', () => {
      if (!state.imageSource && !state.carouselActive) {
        showToast('Primero abre una foto');
        return;
      }
      if (state.carouselActive) {
        exportCarouselAction();
        return;
      }
      const count = state.loadedPhotos.length;
      if (allRow) allRow.hidden = count < 2;
      if (allToggle) allToggle.checked = false;
      document.getElementById('exportAllCount').textContent = count;
      syncFormatUI();
      openModal('exportModal');
    });

    [closeBtn, cancelBtn].forEach(b => b.addEventListener('click', () => modal.classList.remove('open')));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });

    resSelect.addEventListener('change', updateExportSummary);
    fmtSelect.addEventListener('change', syncFormatUI);
    jpegSlider.addEventListener('input', () => {
      jpegLabel.textContent = `${jpegSlider.value}%`;
      refreshSliderVisual(jpegSlider);
      updateExportSummary();
    });
    if (allToggle) allToggle.addEventListener('change', updateExportSummary);

    confirmBtn.addEventListener('click', async () => {
      storageSet('muchofilm.exportPrefs', { res: resSelect.value, fmt: fmtSelect.value, q: jpegSlider.value });
      modal.classList.remove('open');
      if (allToggle && allToggle.checked && state.loadedPhotos.length > 1) {
        await executeBatchExport();
      } else {
        await executeExport();
      }
    });
  }

  // =========================================================================
  // MODAL DE CONEXIÓN CON IPAD PRO (CÓDIGO QR Y RED WI-FI LOCAL)
  // =========================================================================
  function initIpadModal() {
    const modal = document.getElementById('ipadModal');
    const openBtn = document.getElementById('btnOpenIpadModal');
    const closeBtn = document.getElementById('btnCloseIpadModal');
    const closeBtn2 = document.getElementById('btnCloseIpadModalBtn');
    const copyBtn = document.getElementById('btnCopyIpadUrl');
    const urlInput = document.getElementById('ipadLanUrlInput');
    const bonjourInput = document.getElementById('ipadBonjourUrlInput');
    const copyBonjourBtn = document.getElementById('btnCopyBonjourUrl');
    const browserLink = document.getElementById('btnOpenInBrowserLan');
    const qrCanvas = document.getElementById('ipadQrCanvas');

    if (!modal || !openBtn) return;

    // Abierta como archivo (versión portátil de Windows) o publicada en una web https (Netlify):
    // no hay servidor local que compartir con el iPad
    if (window.location.protocol === 'file:' || window.location.protocol === 'https:') {
      openBtn.hidden = true;
      return;
    }

    async function updateLanInfo() {
      const port = window.location.port || '8095';
      let lanUrl = `http://${window.location.hostname || '127.0.0.1'}:${port}`;
      let bonjourUrl = '';

      try {
        const res = await fetch('/api/lan-info');
        if (res.ok) {
          const data = await res.json();
          if (data.lanUrl) {
            lanUrl = data.lanUrl;
          }
          if (data.bonjourUrl) {
            bonjourUrl = data.bonjourUrl;
          }
        }
      } catch (err) {
        // En caso de modo offline o sin servidor sips
      }

      if (urlInput) urlInput.value = lanUrl;
      if (bonjourInput && bonjourUrl) bonjourInput.value = bonjourUrl;
      if (browserLink) browserLink.href = lanUrl;

      if (qrCanvas && window.drawQRCode) {
        window.drawQRCode(qrCanvas, lanUrl, {
          colorDark: '#0d0e12',
          colorLight: '#ffffff',
          margin: 2
        });
      }
    }

    openBtn.addEventListener('click', () => {
      openModal('ipadModal');
      updateLanInfo();
    });

    [closeBtn, closeBtn2].forEach(b => {
      if (b) b.addEventListener('click', () => modal.classList.remove('open'));
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });

    if (copyBtn && urlInput) {
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(urlInput.value);
          const origText = copyBtn.textContent;
          copyBtn.textContent = '¡Copiado!';
          copyBtn.style.background = '#FF3344';
          copyBtn.style.color = '#ffffff';
          showToast('Dirección de red para iPad copiada');
          setTimeout(() => {
            copyBtn.textContent = origText;
            copyBtn.classList.remove('active');
          }, 1800);
        } catch (e) {
          urlInput.select();
          document.execCommand('copy');
          showToast('Dirección copiada al portapapeles');
        }
      });
    }

    if (copyBonjourBtn && bonjourInput) {
      copyBonjourBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(bonjourInput.value);
          const origText = copyBonjourBtn.textContent;
          copyBonjourBtn.textContent = '¡Copiado!';
          copyBonjourBtn.style.background = '#FF3344';
          copyBonjourBtn.style.color = '#ffffff';
          showToast('Enlace Bonjour (.local) copiado');
          setTimeout(() => {
            copyBonjourBtn.textContent = origText;
            copyBonjourBtn.classList.remove('active');
          }, 1800);
        } catch (e) {
          bonjourInput.select();
          document.execCommand('copy');
          showToast('Enlace Bonjour copiado al portapapeles');
        }
      });
    }
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
          .then((reg) => {
            console.log('[mucho FILM] PWA Service Worker registrado con éxito:', reg.scope);
          })
          .catch((err) => {
            console.warn('[mucho FILM] Error al registrar PWA Service Worker:', err);
          });
      });
    }
  }

  function computeExportSize(srcW, srcH, mode) {
    let outW = srcW;
    let outH = srcH;
    const limitLongEdge = (edge) => {
      const maxEdge = Math.max(srcW, srcH);
      if (maxEdge > edge) {
        const k = edge / maxEdge;
        outW = Math.round(srcW * k);
        outH = Math.round(srcH * k);
      }
    };
    if (mode === '150') {
      outW = Math.round(srcW * 1.5);
      outH = Math.round(srcH * 1.5);
    } else if (mode === '75') {
      outW = Math.round(srcW * 0.75);
      outH = Math.round(srcH * 0.75);
    } else if (mode === '50') {
      outW = Math.round(srcW * 0.5);
      outH = Math.round(srcH * 0.5);
    } else if (mode === '4k') {
      limitLongEdge(3840);
    } else if (mode === '2k') {
      limitLongEdge(2048);
    } else if (mode === 'ig') {
      // Instagram publica a 1080 px de ancho
      const k = 1080 / srcW;
      outW = 1080;
      outH = Math.round(srcH * k);
    }
    return { width: Math.max(1, outW), height: Math.max(1, outH) };
  }

  function calculateExportDimensions(photoW = state.rawWidth, photoH = state.rawHeight, settings = state.settings) {
    const cropped = pipeline.getCroppedDimensions(photoW, photoH, settings);
    const mode = document.getElementById('exportResSelect').value;
    const out = computeExportSize(cropped.width, cropped.height, mode);
    return { ...out, origWidth: cropped.width, origHeight: cropped.height };
  }

  function updateExportSummary() {
    const fmt = document.getElementById('exportFormatSelect').value;
    const jpegQ = document.getElementById('sliderExportJpegQuality').value;
    const all = document.getElementById('exportAllToggle');
    const batch = all && all.checked && state.loadedPhotos.length > 1;

    if (batch) {
      document.getElementById('summaryExportDimensions').textContent = `${state.loadedPhotos.length} fotos`;
      document.getElementById('summaryExportMP').textContent = 'cada una con su recorte';
    } else {
      const dims = calculateExportDimensions();
      document.getElementById('summaryExportDimensions').textContent = `${dims.width} × ${dims.height} px`;
      document.getElementById('summaryExportMP').textContent = `${((dims.width * dims.height) / 1000000).toFixed(1)} MP`;
      const ratio = dims.width / dims.origWidth;
      document.getElementById('summaryExportQuality').textContent =
        Math.abs(ratio - 1) < 0.01 ? '100 % (sin reescalar)' : `${Math.round(ratio * 100)} %`;
    }
    if (batch) {
      const opt = document.getElementById('exportResSelect');
      document.getElementById('summaryExportQuality').textContent = opt.options[opt.selectedIndex].text;
    }

    let fmtText = `JPEG · calidad ${jpegQ}%`;
    if (fmt === 'png') fmtText = 'PNG · sin pérdida';
    else if (fmt === 'tiff') fmtText = 'TIFF · sin compresión, 8 bits';
    document.getElementById('summaryExportFormat').textContent = fmtText;
    const lbl = document.getElementById('labelConfirmExport');
    if (lbl) lbl.textContent = batch ? `Descargar ${state.loadedPhotos.length} fotos` : 'Descargar';
  }

  // Renderiza una foto a resolución de exportación y devuelve el canvas final (con bordes y texturas)
  function renderPhotoForExport(expPipeline, floatData, w, h, settings, dims) {
    expPipeline.uploadFloatImage(floatData, w, h);
    const eff = getEffectiveSettings(settings);
    expPipeline.render(eff, dims.width, dims.height, { bypassAll: false, ignoreCrop: false });
    let out = expPipeline.canvas;
    if (window.FrameRenderer && window.FrameRenderer.hasActiveOverlays(eff)) {
      const framed = document.createElement('canvas');
      window.FrameRenderer.compositeFrame(framed, expPipeline.canvas, eff.frameType, {
        settings: eff,
        borderScale: eff.frameScale
      });
      out = framed;
    }
    return out;
  }

  function canvasToBlob(c, fmt, quality) {
    return new Promise((resolve) => {
      if (fmt === 'tiff' && window.TIFFCodec && window.TIFFCodec.encodeTIFF) {
        // TIFF real (antes se descargaba un PNG con extensión .tiff.png)
        let src = c;
        if (!(c instanceof HTMLCanvasElement) || !c.getContext('2d')) {
          src = document.createElement('canvas');
          src.width = c.width;
          src.height = c.height;
          src.getContext('2d').drawImage(c, 0, 0);
        }
        const ctx = src.getContext('2d');
        const px = ctx.getImageData(0, 0, src.width, src.height).data;
        resolve(window.TIFFCodec.encodeTIFF(px, src.width, src.height, 8));
        return;
      }
      if (fmt === 'png') c.toBlob(resolve, 'image/png');
      else c.toBlob(resolve, 'image/jpeg', quality);
    });
  }

  function exportFileName(baseFileName, fmt) {
    const base = (baseFileName || 'foto').replace(/\.[^/.]+$/, '');
    const ext = fmt === 'png' ? 'png' : (fmt === 'tiff' ? 'tif' : 'jpg');
    return `${base}_muchoFILM.${ext}`;
  }

  async function executeExport() {
    showToast('Exportando a resolución completa…', { duration: 60000 });
    await new Promise(r => setTimeout(r, 40));

    const dims = calculateExportDimensions();
    const fmt = document.getElementById('exportFormatSelect').value;
    const jpegQuality = parseInt(document.getElementById('sliderExportJpegQuality').value, 10) / 100.0;

    let expPipeline = null;
    try {
      // 2D canvas destino: el pipeline WebGL dibuja en su propio canvas offscreen
      expPipeline = new window.WebGLPipeline.PipelineInstance(document.createElement('canvas'));
      const outCanvas = renderPhotoForExport(expPipeline, state.imageSource, state.rawWidth, state.rawHeight, state.settings, dims);
      const blob = await canvasToBlob(outCanvas, fmt, jpegQuality);
      if (!blob) throw new Error('No se pudo codificar la imagen');
      const name = exportFileName(state.fileName, fmt);
      downloadBlob(blob, name);
      showToast(`Exportada: ${name} · ${outCanvas.width} × ${outCanvas.height} px`);
    } catch (err) {
      console.error('Error en la exportación:', err);
      showToast('No se pudo exportar. Prueba con un tamaño menor.');
    } finally {
      if (expPipeline) expPipeline.dispose();
    }
  }

  async function executeBatchExport() {
    const fmt = document.getElementById('exportFormatSelect').value;
    const jpegQuality = parseInt(document.getElementById('sliderExportJpegQuality').value, 10) / 100.0;
    persistActiveSettings();
    const photos = state.loadedPhotos.slice();
    let expPipeline = null;
    let ok = 0;
    try {
      expPipeline = new window.WebGLPipeline.PipelineInstance(document.createElement('canvas'));
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        showToast(`Exportando ${i + 1} de ${photos.length}: ${p.fileName}`, { duration: 60000 });
        await new Promise(r => setTimeout(r, 30));
        const pSettings = i === state.activePhotoIndex ? state.settings : (p.settings || getDefaultSettings());
        const dims = calculateExportDimensions(p.width, p.height, pSettings);
        try {
          const outCanvas = renderPhotoForExport(expPipeline, p.floatData, p.width, p.height, pSettings, dims);
          const blob = await canvasToBlob(outCanvas, fmt, jpegQuality);
          if (blob) {
            downloadBlob(blob, exportFileName(p.fileName, fmt));
            ok++;
          }
        } catch (err) {
          console.error('Error exportando', p.fileName, err);
        }
        // Pausa breve: algunos navegadores bloquean descargas demasiado seguidas
        await new Promise(r => setTimeout(r, 350));
      }
    } finally {
      if (expPipeline) expPipeline.dispose();
    }
    showToast(ok === photos.length ? `${ok} fotos exportadas` : `${ok} de ${photos.length} fotos exportadas`);
  }

  // Exportación de carrusel: renderiza cada foto con sus ajustes y corta las diapositivas
  async function exportCarouselAction() {
    showToast('Preparando el carrusel en alta resolución…', { duration: 60000 });
    await new Promise(r => setTimeout(r, 60));

    persistActiveSettings();
    let expPipeline = null;
    try {
      if (window.CarouselEngine && state.loadedPhotos.length > 0) {
        const maxExportDim = 3800;
        for (let i = 0; i < state.loadedPhotos.length; i++) {
          const photo = state.loadedPhotos[i];
          if (!photo || !photo.floatData) continue;

          const matchingCarouselPhotos = window.CarouselEngine.state.photos.filter(cp =>
            (cp.sourcePhotoId && cp.sourcePhotoId === photo.id) || cp.fileName === photo.fileName
          );
          if (matchingCarouselPhotos.length === 0) continue;

          const pSettings = (i === state.activePhotoIndex) ? { ...state.settings } : (photo.settings || getDefaultSettings());
          const cropped = pipeline.getCroppedDimensions(photo.width, photo.height, pSettings);
          const sc = Math.min(1.0, maxExportDim / Math.max(cropped.width, cropped.height));
          const dims = {
            width: Math.max(1, Math.round(cropped.width * sc)),
            height: Math.max(1, Math.round(cropped.height * sc))
          };

          try {
            if (!expPipeline) expPipeline = new window.WebGLPipeline.PipelineInstance(document.createElement('canvas'));
            const expSource = renderPhotoForExport(expPipeline, photo.floatData, photo.width, photo.height, pSettings, dims);
            const copyCanvas = document.createElement('canvas');
            copyCanvas.width = expSource.width;
            copyCanvas.height = expSource.height;
            copyCanvas.getContext('2d').drawImage(expSource, 0, 0);
            matchingCarouselPhotos.forEach(cp => { cp.renderedCanvas = copyCanvas; });
          } catch (err) {
            console.error(`Error procesando la foto ${i + 1} del carrusel:`, err);
          }
        }
      }
    } finally {
      if (expPipeline) expPipeline.dispose();
    }

    const activePhoto = window.CarouselEngine ? window.CarouselEngine.getSelectedPhoto() : null;
    const fallbackCanvas = activePhoto ? (activePhoto.renderedCanvas || activePhoto.canvas) : null;

    await window.CarouselEngine.exportCarouselSlices(
      fallbackCanvas,
      (current, total) => {
        showToast(`Cortando diapositiva ${current} de ${total}…`, { duration: 60000 });
      },
      (doneSlices) => {
        showToast(`Descargando ${doneSlices.length} diapositivas…`, { duration: 60000 });
        doneSlices.forEach((slice, idx) => {
          setTimeout(() => {
            downloadBlob(slice.blob, slice.filename);
            if (idx === doneSlices.length - 1) {
              showToast(`Carrusel exportado: ${doneSlices.length} diapositivas`);
            }
          }, idx * 280);
        });
      }
    );
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  let toastTimer = null;
  /**
   * Aviso flotante. options: { duration, label, onAction } — con label/onAction muestra un botón
   * (p. ej. "Deshacer").
   */
  function showToast(text, options = {}) {
    const toast = document.getElementById('toastMsg');
    if (!toast) return;
    const textEl = toast.querySelector('.toast-text');
    const actionEl = toast.querySelector('.toast-action');
    if (textEl) textEl.textContent = text;
    else toast.textContent = text;

    const hasAction = !!(options.label && typeof options.onAction === 'function' && actionEl);
    if (actionEl) {
      actionEl.hidden = !hasAction;
      actionEl.onclick = null;
      if (hasAction) {
        actionEl.textContent = options.label;
        actionEl.onclick = () => {
          toast.classList.remove('show', 'has-action');
          options.onAction();
        };
      }
    }
    toast.classList.toggle('has-action', hasAction);
    toast.classList.add('show');
    clearTimeout(toastTimer);
    const duration = options.duration || (hasAction ? 5000 : 2600);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show', 'has-action');
    }, duration);
  }

})();
