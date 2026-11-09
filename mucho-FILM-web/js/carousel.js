/**
 * mucho FILM — Estudio de Carruseles Estilo Canva (Carousel Engine 4.0)
 *
 * - Marcos / Huecos Inteligentes estilo Canva (Auto-Cover fit sin deformación).
 * - Plantillas Editoriales 100% fieles a las referencias (10 y 5 diapositivas, capas solapadas, textos editoriales).
 * - Doble clic en cualquier foto para encuadrar interiormente (pan y zoom dentro del marco).
 * - Tiradores en las 4 esquinas (escala proporcional) y en los 4 lados (reajuste de caja con Cover automático tipo Canva).
 * - Orden de capas (zIndex) unificado para que los huecos superpuestos (insets/polaroids) siempre sean accesibles sobre fondos.
 * - Exportación nativa de alta resolución libre de marcas de interfaz.
 */

window.CarouselEngine = (function () {
  'use strict';

  const RATIO_VALUES = {
    '1:1': { w: 1, h: 1, exportW: 2160, exportH: 2160, label: '1:1 Cuadrado (2160 × 2160 px)' },
    '4:5': { w: 4, h: 5, exportW: 2160, exportH: 2700, label: '4:5 Vertical Instagram (2160 × 2700 px)' },
    '3:4': { w: 3, h: 4, exportW: 2025, exportH: 2700, label: '3:4 Vertical Retrato (2025 × 2700 px)' }
  };

  /**
   * Helper para convertir coordenadas medidas [leftNorm, topNorm, rightNorm, bottomNorm]
   * en definición de hueco normalizado { id, label, cellIndex, xNorm, yNorm, wNorm, hNorm, zIndex, ... }
   */
  function boxToSlot(id, label, l, t, r, b, zIndex = 1, extra = {}) {
    const xNorm = Number(((l + r) * 0.5).toFixed(4));
    const yNorm = Number(((t + b) * 0.5).toFixed(4));
    const wNorm = Number(Math.max(0.05, r - l).toFixed(4));
    const hNorm = Number(Math.max(0.05, b - t).toFixed(4));
    const cellIndex = Math.max(0, Math.floor(xNorm));
    return {
      id,
      label,
      cellIndex,
      xNorm,
      yNorm,
      wNorm,
      hNorm,
      zIndex,
      ...extra
    };
  }

  /**
   * CATÁLOGO DE PLANTILLAS EDITORIALES PREDEFINIDAS (VERIFICADAS PIXEL A PIXEL CON LAS CAPTURAS)
   */
  const TEMPLATES = {
    'carousel_1': {
      id: 'carousel_1',
      num: '#1',
      name: 'Carousel #1 — Editorial Wedding Story',
      shortName: 'Carousel #1',
      badge: '10 SLIDES · 15 FOTOS',
      description: 'Apertura a sangre en columpio, dúo vertical, banquete panorámico entre 3-4 con insets, arboleda, bodegón floral y cierre arquitectónico.',
      slideCount: 10,
      ratioKey: '4:5',
      texts: [],
      slots: [
        boxToSlot('c1_s1', '1. Portada Columpio', 0.06, 0.00, 0.90, 1.00, 1),
        boxToSlot('c1_s2_l', '2. Pareja Vertical', 1.06, 0.19, 1.48, 0.81, 1),
        boxToSlot('c1_s2_r', '3. Novia Movimiento', 1.50, 0.19, 2.08, 0.81, 1),
        boxToSlot('c1_s3_4_banquet', '4. Panorámica Banquete (3-4)', 2.26, 0.14, 3.74, 0.89, 1),
        boxToSlot('c1_s3_in', '5. Miniatura Superior', 2.16, 0.05, 2.45, 0.30, 3),
        boxToSlot('c1_s4_in', '6. Detalle Altar Playa', 3.62, 0.52, 3.91, 0.78, 3),
        boxToSlot('c1_s5_6_orchard', '7. Novia en Arboleda (5-6)', 4.12, 0.00, 5.24, 1.00, 1),
        boxToSlot('c1_s6_7_peony', '8. Flores Horizontales (6-7)', 5.52, 0.08, 6.50, 0.48, 1),
        boxToSlot('c1_s6_inv', '9. Papelería & Carta', 5.38, 0.30, 5.90, 0.92, 2),
        boxToSlot('c1_s6_7_mini', '10. Detalle Manos', 5.74, 0.68, 6.08, 1.00, 3),
        boxToSlot('c1_s7_8_bride', '11. Vestido & Ramo (7-8)', 6.73, 0.00, 7.50, 1.00, 1),
        boxToSlot('c1_s8_top', '12. Arco Ceremonia', 7.58, 0.03, 7.94, 0.43, 1),
        boxToSlot('c1_s8_bot', '13. Sillas Banquete', 7.58, 0.45, 7.94, 0.83, 1),
        boxToSlot('c1_s9_10_bq', '14. Ramo B&N (9-10)', 8.02, 0.17, 9.16, 1.00, 1),
        boxToSlot('c1_s10_arch', '15. Vestido en Arcos', 9.20, 0.17, 9.96, 1.00, 1)
      ]
    },

    'carousel_2': {
      id: 'carousel_2',
      num: '#2',
      name: 'Carousel #2 — Cover, Ribbon & Veil',
      shortName: 'Carousel #2',
      badge: '10 SLIDES · 15 FOTOS',
      description: 'Portada en paspartú centrado, fondo continuo en diapositivas 2-4 con zapatos superpuestos, velo central entre 5-6, díptico y mosaico 2×2.',
      slideCount: 10,
      ratioKey: '4:5',
      texts: [],
      slots: [
        boxToSlot('c2_s1_cov', '1. Portada Paspartú', 0.22, 0.20, 0.78, 0.80, 1),
        boxToSlot('c2_s2_4_bg', '2. Fondo Continuo Seda (2-4)', 1.00, 0.00, 3.78, 1.00, 0, { isBackground: true }),
        boxToSlot('c2_s2_3_shoes', '3. Zapatos Novia (Sobre Fondo)', 1.20, 0.16, 2.80, 0.82, 2),
        boxToSlot('c2_s4_walk', '4. Novia de Espaldas (Sobre Fondo)', 3.16, 0.10, 3.92, 0.90, 2),
        boxToSlot('c2_s5_left', '5. Miniatura Ramo Izq.', 4.20, 0.36, 4.52, 0.72, 1),
        boxToSlot('c2_s5_6_veil', '6. Detalle Velo (5-6)', 4.60, 0.12, 5.42, 0.92, 1),
        boxToSlot('c2_s6_right', '7. Miniatura Vestido Der.', 5.54, 0.46, 5.86, 0.82, 1),
        boxToSlot('c2_s7_top', '8. Díptico B&N Superior', 6.24, 0.22, 6.78, 0.50, 1),
        boxToSlot('c2_s7_bot', '9. Díptico B&N Inferior', 6.24, 0.52, 6.78, 0.82, 1),
        boxToSlot('c2_s8_swing', '10. Columpio Vertical', 7.16, 0.00, 7.88, 1.00, 1),
        boxToSlot('c2_s9_g1', '11. Mosaico 1 (Sup. Izq.)', 8.14, 0.14, 8.50, 0.49, 1),
        boxToSlot('c2_s9_g2', '12. Mosaico 2 (Sup. Der.)', 8.53, 0.14, 8.89, 0.49, 1),
        boxToSlot('c2_s9_g3', '13. Mosaico 3 (Inf. Izq.)', 8.14, 0.51, 8.50, 0.86, 1),
        boxToSlot('c2_s9_g4', '14. Mosaico 4 (Inf. Der.)', 8.53, 0.51, 8.89, 0.86, 1),
        boxToSlot('c2_s10_hands', '15. Manos & Alianzas B&N', 9.22, 0.18, 9.80, 0.76, 1)
      ]
    },

    'carousel_3': {
      id: 'carousel_3',
      num: '#3',
      name: 'Carousel #3 — Gran Altar & Escalera',
      shortName: 'Carousel #3',
      badge: '10 SLIDES · 14 FOTOS',
      description: 'Portada con doble foto superpuesta, escalera señorial con inset B&N, castillo de hiedra, gran altar floral entre 6-7, díptico y tríptico final.',
      slideCount: 10,
      ratioKey: '4:5',
      texts: [],
      slots: [
        boxToSlot('c3_s1_bg', '1. Fondo Textura Pórtico', 0.00, 0.00, 1.00, 1.00, 0, { isBackground: true }),
        boxToSlot('c3_s1_fg', '2. Retrato Pareja (Sobre Fondo)', 0.14, 0.14, 0.86, 0.86, 2),
        boxToSlot('c3_s2_3_stairs', '3. Escalera de Piedra (2-3)', 1.00, 0.20, 2.50, 1.00, 1),
        boxToSlot('c3_s3_inset', '4. Inset B&N (2-3)', 2.43, 0.08, 2.88, 0.54, 3),
        boxToSlot('c3_s4_5_ivy', '5. Castillo de Hiedra (4-5)', 3.10, 0.00, 4.22, 1.00, 1),
        boxToSlot('c3_s5_shoes', '6. Detalle Zapatos Sup.', 4.50, 0.08, 4.90, 0.48, 1),
        boxToSlot('c3_s5_bq', '7. Detalle Ramo Solapado', 4.14, 0.58, 4.62, 0.88, 2),
        boxToSlot('c3_s6_7_altar', '8. Gran Altar Floral (6-7)', 5.10, 0.08, 6.90, 0.92, 1),
        boxToSlot('c3_s8_top', '9. Damas de Honor Sup.', 7.28, 0.06, 7.72, 0.48, 1),
        boxToSlot('c3_s8_bot', '10. Retrato Novia Inf.', 7.28, 0.51, 7.72, 0.93, 1),
        boxToSlot('c3_s10_walk', '11. Paseo Final (Diap. 10)', 9.10, 0.00, 9.98, 1.00, 1),
        boxToSlot('c3_s9_t1', '12. Tríptico Vertical 1', 8.05, 0.26, 8.41, 0.78, 2),
        boxToSlot('c3_s9_t2', '13. Tríptico Vertical 2', 8.44, 0.26, 8.80, 0.78, 2),
        boxToSlot('c3_s9_t3', '14. Tríptico Vertical 3 (Cruza 9-10)', 8.83, 0.26, 9.19, 0.78, 3)
      ]
    },

    'carousel_4': {
      id: 'carousel_4',
      num: '#4',
      name: 'Carousel #4 — Minimal Barn & Villa',
      shortName: 'Carousel #4',
      badge: '5 SLIDES · 6 FOTOS',
      description: 'Diseño de 5 diapositivas: portada en paspartú centrado, abrazo en madera con tarjeta floral solapada, detalle espalda y salida.',
      slideCount: 5,
      ratioKey: '4:5',
      texts: [],
      slots: [
        boxToSlot('c4_s1_cov', '1. Portada Paspartú', 0.22, 0.20, 0.78, 0.80, 1),
        boxToSlot('c4_s2_3_couple', '2. Pareja en Madera (2-3)', 1.15, 0.09, 2.30, 0.89, 1),
        boxToSlot('c4_s2_card', '3. Detalle Floral Solapado', 1.07, 0.38, 1.41, 0.76, 3),
        boxToSlot('c4_s3_back', '4. Detalle Espalda Novia', 2.38, 0.17, 2.75, 0.56, 2),
        boxToSlot('c4_s3_5_barn', '5. Salida Puertas Madera (3-5)', 2.71, 0.00, 4.10, 1.00, 0),
        boxToSlot('c4_s5_villa', '6. Villa de Hiedra', 4.21, 0.09, 4.82, 0.78, 1)
      ]
    },

    'carousel_5': {
      id: 'carousel_5',
      num: '#5',
      name: 'Carousel #5 — Fine Art Peony & Beach',
      shortName: 'Carousel #5',
      badge: '5 SLIDES · 10 FOTOS',
      description: 'Diseño de 5 diapositivas: bodegón de peonía rosa con detalle solapado, vestido junto al mar, collage con marco interior, perfil sobre fondo B&N y cierre.',
      slideCount: 5,
      ratioKey: '4:5',
      texts: [],
      slots: [
        boxToSlot('c5_s1_2_peony', '1. Flat-lay Peonía (1-2)', 0.35, 0.09, 1.13, 0.84, 1),
        boxToSlot('c5_s1_pink', '2. Detalle Rosa Inf. Izq.', 0.09, 0.56, 0.48, 0.94, 3),
        boxToSlot('c5_s2_sea', '3. Vestido en la Orilla', 1.35, 0.13, 1.87, 0.82, 1),
        boxToSlot('c5_s3_bq', '4. Ramo Novia Sup.', 2.10, 0.11, 2.54, 0.60, 1),
        boxToSlot('c5_s3_chair', '5. Silla Jardín Inf.', 2.15, 0.65, 2.41, 0.92, 1),
        boxToSlot('c5_s3_framed', '6. Cuadro Enmarcado', 2.49, 0.37, 2.74, 0.73, 3, { frameBorder: '#3a322c' }),
        boxToSlot('c5_s3_4_bg', '7. Fondo Floral B&N (3-4)', 2.69, 0.23, 3.70, 0.83, 0, { isBackground: true }),
        boxToSlot('c5_s4_profile', '8. Perfil Novia (Sobre Fondo)', 3.21, 0.13, 3.80, 0.82, 2),
        boxToSlot('c5_s5_bg', '9. Fondo Pétalos (Diap. 5)', 4.00, 0.00, 5.00, 1.00, 0, { isBackground: true }),
        boxToSlot('c5_s5_fg', '10. Pareja Paseo (Sobre Fondo)', 4.16, 0.21, 4.65, 0.82, 2)
      ]
    },

    'carousel_6': {
      id: 'carousel_6',
      num: '#6',
      name: 'Carousel #6 — Garden & Mosaic Story',
      shortName: 'Carousel #6',
      badge: '10 SLIDES · 20 FOTOS',
      description: 'Plantilla superior de la portada: pórtico, flat-lay con caja de anillos, paseo en jardín, mosaicos 2×2, paisaje de olivos con escalera y retrato final.',
      slideCount: 10,
      ratioKey: '4:5',
      texts: [],
      slots: [
        boxToSlot('c6_s1', '1. Pareja Pórtico', 0.14, 0.04, 0.86, 0.96, 1),
        boxToSlot('c6_s2_bg', '2. Fondo Bodegón (Diap. 2)', 1.00, 0.00, 2.00, 1.00, 0, { isBackground: true }),
        boxToSlot('c6_s2_fg', '3. Anillos & Papelería', 1.22, 0.24, 1.76, 0.78, 2),
        boxToSlot('c6_s3_main', '4. Paseo en Jardín', 2.16, 0.20, 2.68, 0.66, 1),
        boxToSlot('c6_s3_in', '5. Miniatura Novia', 2.54, 0.55, 2.86, 0.89, 2),
        boxToSlot('c6_s4_1', '6. Collage 1 (Sup. Izq.)', 3.08, 0.09, 3.48, 0.49, 1),
        boxToSlot('c6_s4_2', '7. Collage 2 (Sup. Der.)', 3.50, 0.09, 3.92, 0.49, 1),
        boxToSlot('c6_s4_3', '8. Collage 3 (Inf. Izq.)', 3.08, 0.51, 3.48, 0.91, 1),
        boxToSlot('c6_s4_4', '9. Collage 4 (Inf. Der.)', 3.50, 0.51, 3.92, 0.91, 1),
        boxToSlot('c6_s5_tl', '10. Detalle Sup. Izq.', 4.08, 0.08, 4.40, 0.40, 1),
        boxToSlot('c6_s5_mid', '11. Velo en Jardín', 4.44, 0.28, 4.92, 0.85, 1),
        boxToSlot('c6_s5_6_ch', '12. Silla Ceremonia (5-6)', 4.88, 0.58, 5.26, 0.93, 2),
        boxToSlot('c6_s6_7_gd', '13. Paisaje Olivos (6-7)', 5.27, 0.08, 6.48, 0.93, 1),
        boxToSlot('c6_s7_8_st', '14. Escalera Novia (7-8)', 6.38, 0.22, 7.36, 0.82, 2),
        boxToSlot('c6_s8_top', '15. Detalle Ramo Sup.', 7.34, 0.06, 7.72, 0.44, 3),
        boxToSlot('c6_s8_bot', '16. Detalle Mesa Inf.', 7.69, 0.66, 7.94, 0.91, 2),
        boxToSlot('c6_s9_m1', '17. Mosaico 1 (Diap. 9)', 8.00, 0.00, 8.50, 0.50, 1),
        boxToSlot('c6_s9_m2', '18. Mosaico 2 (Diap. 9)', 8.50, 0.00, 9.00, 0.50, 1),
        boxToSlot('c6_s9_m3', '19. Mosaico 3 (Diap. 9)', 8.00, 0.50, 8.50, 1.00, 1),
        boxToSlot('c6_s9_m4', '20. Mosaico 4 (Diap. 9)', 8.50, 0.50, 9.00, 1.00, 1),
        boxToSlot('c6_s10_bg', '21. Marco Fondo (Diap. 10)', 9.10, 0.10, 9.94, 0.92, 0, { isBackground: true }),
        boxToSlot('c6_s10_fg', '22. Retrato Final (Sobre Fondo)', 9.26, 0.22, 9.78, 0.80, 2)
      ]
    },

    'carousel_4_5_full': {
      id: 'carousel_4_5_full',
      num: '#4+#5',
      name: 'Carousel #4 + #5 — Serie Completa 10 Slides',
      shortName: 'Serie #4+#5 (10)',
      badge: '10 SLIDES · 16 FOTOS',
      description: 'Combina las 5 diapositivas de Carousel #4 y las 5 de Carousel #5 en un único carrusel continuo de 10 diapositivas.',
      slideCount: 10,
      ratioKey: '4:5',
      texts: [],
      slots: [
        boxToSlot('c45_1', '1. Portada Paspartú', 0.22, 0.20, 0.78, 0.80, 1),
        boxToSlot('c45_2', '2. Pareja en Madera (2-3)', 1.15, 0.09, 2.30, 0.89, 1),
        boxToSlot('c45_3', '3. Detalle Floral Solapado', 1.07, 0.38, 1.41, 0.76, 3),
        boxToSlot('c45_4', '4. Detalle Espalda Novia', 2.38, 0.17, 2.75, 0.56, 2),
        boxToSlot('c45_5', '5. Salida Puertas Madera (3-5)', 2.71, 0.00, 4.10, 1.00, 0),
        boxToSlot('c45_6', '6. Villa de Hiedra', 4.21, 0.09, 4.82, 0.78, 1),
        boxToSlot('c45_7', '7. Flat-lay Peonía (6-7)', 5.35, 0.09, 6.13, 0.84, 1),
        boxToSlot('c45_8', '8. Detalle Rosa Inf. Izq.', 5.09, 0.56, 5.48, 0.94, 3),
        boxToSlot('c45_9', '9. Vestido en la Orilla', 6.35, 0.13, 6.87, 0.82, 1),
        boxToSlot('c45_10', '10. Ramo Novia Sup.', 7.10, 0.11, 7.54, 0.60, 1),
        boxToSlot('c45_11', '11. Silla Jardín Inf.', 7.15, 0.65, 7.41, 0.92, 1),
        boxToSlot('c45_12', '12. Cuadro Enmarcado', 7.49, 0.37, 7.74, 0.73, 3, { frameBorder: '#3a322c' }),
        boxToSlot('c45_13', '13. Fondo Floral B&N (8-9)', 7.69, 0.23, 8.70, 0.83, 0, { isBackground: true }),
        boxToSlot('c45_14', '14. Perfil Novia (Sobre Fondo)', 8.21, 0.13, 8.80, 0.82, 2),
        boxToSlot('c45_15', '15. Fondo Pétalos (Diap. 10)', 9.00, 0.00, 10.00, 1.00, 0, { isBackground: true }),
        boxToSlot('c45_16', '16. Pareja Paseo (Sobre Fondo)', 9.16, 0.21, 9.65, 0.82, 2)
      ]
    }
  };

  const state = {
    active: false,
    ratioKey: '4:5',
    slideCount: 3,
    mode: 'multi',              // 'multi' (marcos y fotos tipo Canva) | 'seamless' (1 foto extendida panorámica)
    seamlessPanX: 0,            // -1.0 a +1.0
    seamlessZoom: 1.0,          // 1.0 a 3.0
    selectedPhotoIndex: -1,     // Índice en state.photos (-1 si no hay foto seleccionada)
    selectedSlotId: null,       // Id del hueco vacío seleccionado estilo Canva
    photos: [],                 // Array de objetos foto en el carrusel
    showGuidelines: true,
    magneticSnapEnabled: true,
    activeGuides: [],           // Líneas magnéticas activas para renderizar
    activeAlignmentNotice: '',  // Texto descriptivo de alineación para HUD
    noticeTimeout: null,
    activeTemplateId: null,     // Id de la plantilla activa ('carousel_1', etc.) o null si es libre
    templateSlots: [],          // Array de huecos de plantilla actuales
    templateTexts: [],          // Textos editoriales editables de la plantilla activa
    hoveredSlotId: null,        // Id del hueco sobre el que se hace hover/drag
    hoveredPhotoIndex: -1,      // Índice de foto sobre la que se hace hover
    activeSlideViewIndex: -1    // -1 = vista completa, 0..N-1 = diapositiva enfocada
  };

  function getRatioInfo(key = state.ratioKey) {
    return RATIO_VALUES[key] || RATIO_VALUES['4:5'];
  }

  function getStripDimensions(baseHeight = 1200) {
    const r = getRatioInfo();
    const cellH = baseHeight;
    const cellW = Math.round(cellH * (r.w / r.h));
    const totalW = cellW * state.slideCount;
    return {
      cellW,
      cellH,
      totalW,
      totalH: cellH,
      slideCount: state.slideCount,
      aspect: totalW / cellH
    };
  }

  /**
   * Ajusta automáticamente las propiedades internas (width, height, crop, scale) de una foto
   * para que llene exactamente la caja (targetBoxW × targetBoxH) en modo "Cover" estilo Canva,
   * sin deformar jamás la relación de aspecto original de la fotografía.
   */
  function fitPhotoToFrameBox(photo, targetBoxW, targetBoxH, customSource = null) {
    if (!photo) return;
    const src = customSource || photo.renderedCanvas || photo.canvas || photo.img;
    const rawW = (src && src.width > 0) ? src.width : Math.max(100, Number(photo.naturalWidth) || 1200);
    const rawH = (src && src.height > 0) ? src.height : Math.max(100, Number(photo.naturalHeight) || 1200);
    photo.naturalWidth = rawW;
    photo.naturalHeight = rawH;

    const isRot90 = (photo.rotation === 90 || photo.rotation === 270);
    const effImgW = isRot90 ? rawH : rawW;
    const effImgH = isRot90 ? rawW : rawH;
    const imgAspect = Math.max(0.05, effImgW / effImgH);

    const boxW = Math.max(24, Number(targetBoxW) || 400);
    const boxH = Math.max(24, Number(targetBoxH) || 400);
    const boxAspect = boxW / boxH;

    photo.boxW = boxW;
    photo.boxH = boxH;

    // Calcular recorte normalizado Cover respetando el centro actual si ya tenía encuadre personalizado
    const prevCenterX = (photo.crop && typeof photo.crop.x === 'number' && typeof photo.crop.w === 'number')
      ? (photo.crop.x + photo.crop.w * 0.5)
      : 0.5;
    const prevCenterY = (photo.crop && typeof photo.crop.y === 'number' && typeof photo.crop.h === 'number')
      ? (photo.crop.y + photo.crop.h * 0.5)
      : 0.5;

    const innerZoom = Math.max(1.0, Math.min(4.0, Number(photo.innerZoom) || 1.0));
    photo.innerZoom = innerZoom;

    let cropW = 1.0;
    let cropH = 1.0;
    if (imgAspect > boxAspect) {
      cropW = (boxAspect / imgAspect) / innerZoom;
      cropH = 1.0 / innerZoom;
    } else {
      cropW = 1.0 / innerZoom;
      cropH = (imgAspect / boxAspect) / innerZoom;
    }
    cropW = Math.max(0.02, Math.min(1.0, cropW));
    cropH = Math.max(0.02, Math.min(1.0, cropH));

    const cropX = Math.max(0.0, Math.min(1.0 - cropW, prevCenterX - cropW * 0.5));
    const cropY = Math.max(0.0, Math.min(1.0 - cropH, prevCenterY - cropH * 0.5));

    photo.crop = { x: cropX, y: cropY, w: cropW, h: cropH };
    photo.scale = 1.0;

    if (isRot90) {
      photo.width = boxH / cropW;
      photo.height = boxW / cropH;
    } else {
      photo.width = boxW / cropW;
      photo.height = boxH / cropH;
    }
    photo.aspect = rawW / rawH;
  }

  /**
   * Crea un objeto de foto libre en el carrusel
   */
  function createPhotoItem(canvasOrImg, fileName = '', initialCellIndex = 0, extra = {}) {
    const strip = getStripDimensions(1200);
    const pw = (canvasOrImg && canvasOrImg.width) ? canvasOrImg.width : 1200;
    const ph = (canvasOrImg && canvasOrImg.height) ? canvasOrImg.height : 1200;
    const aspect = pw / ph;

    // Tamaño base elegante adaptado a una celda (con un pequeño margen editorial por defecto)
    const maxW = strip.cellW * 0.88;
    const maxH = strip.totalH * 0.88;
    let boxW = maxW;
    let boxH = boxW / aspect;
    if (boxH > maxH) {
      boxH = maxH;
      boxW = boxH * aspect;
    }

    const targetCell = Math.max(0, Math.min(state.slideCount - 1, initialCellIndex));
    const initX = (extra.x !== undefined) ? extra.x : (targetCell * strip.cellW + strip.cellW * 0.5);
    const initY = (extra.y !== undefined) ? extra.y : (strip.totalH * 0.5);

    const item = {
      id: 'photo_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
      canvas: canvasOrImg,
      img: canvasOrImg,
      renderedCanvas: extra.renderedCanvas || canvasOrImg,
      floatData: extra.floatData || null,
      sourcePhotoId: extra.sourcePhotoId || null,
      fileName: fileName || `Foto ${state.photos.length + 1}`,
      x: initX,
      y: initY,
      width: boxW,
      height: boxH,
      boxW: boxW,
      boxH: boxH,
      naturalWidth: pw,
      naturalHeight: ph,
      scale: 1.0,
      innerZoom: 1.0,
      rotation: 0,
      crop: { x: 0.0, y: 0.0, w: 1.0, h: 1.0 },
      isCropMode: false,
      locked: false,
      aspect: aspect,
      zIndex: (extra.zIndex !== undefined) ? extra.zIndex : (state.photos.length + 1),
      slotId: extra.slotId || null,
      frameBorder: extra.frameBorder || null
    };

    fitPhotoToFrameBox(item, boxW, boxH, canvasOrImg);
    return item;
  }

  function setRatio(key) {
    if (RATIO_VALUES[key] && state.ratioKey !== key) {
      const oldStrip = getStripDimensions(1200);
      state.ratioKey = key;
      const newStrip = getStripDimensions(1200);

      // Si hay una plantilla activa, recalcular las cajas de los huecos al nuevo ancho de celda
      if (state.activeTemplateId && state.templateSlots.length > 0) {
        for (const slot of state.templateSlots) {
          if (slot.photoId) {
            const p = state.photos.find(item => item.id === slot.photoId);
            if (p) {
              p.x = slot.xNorm * newStrip.cellW;
              p.y = slot.yNorm * newStrip.totalH;
              fitPhotoToFrameBox(p, slot.wNorm * newStrip.cellW, slot.hNorm * newStrip.totalH);
            }
          }
        }
      } else if (oldStrip.totalW > 0) {
        const ratioX = newStrip.totalW / oldStrip.totalW;
        for (const p of state.photos) {
          p.x *= ratioX;
        }
      }
      clampPhotosToStrip();
    }
  }

  function setSlideCount(count) {
    state.slideCount = Math.max(2, Math.min(10, parseInt(count, 10) || 3));
    if (state.selectedPhotoIndex >= state.photos.length) {
      state.selectedPhotoIndex = Math.max(-1, state.photos.length - 1);
    }
    if (state.activeSlideViewIndex >= state.slideCount) {
      state.activeSlideViewIndex = state.slideCount - 1;
    }
    clampPhotosToStrip();
  }

  function setMode(mode) {
    state.mode = (mode === 'seamless') ? 'seamless' : 'multi';
  }

  function setSelectedPhoto(index) {
    if (state.photos.length === 0 || index < 0) {
      state.selectedPhotoIndex = -1;
      return;
    }
    state.selectedPhotoIndex = Math.max(0, Math.min(state.photos.length - 1, parseInt(index, 10) || 0));
    state.selectedSlotId = null;
  }

  function getSelectedPhoto() {
    if (state.photos.length === 0 || state.selectedPhotoIndex < 0) return null;
    return state.photos[state.selectedPhotoIndex] || null;
  }

  function addPhoto(canvasOrImg, fileName = '', targetCellIndex = null, extraOrFloatData = {}, maybeSourcePhotoId = null) {
    let cellIdx = targetCellIndex;
    if (cellIdx === null || cellIdx === undefined) {
      cellIdx = state.photos.length % state.slideCount;
    }
    let extra = {};
    if (extraOrFloatData && typeof extraOrFloatData === 'object' && !ArrayBuffer.isView(extraOrFloatData)) {
      extra = { ...extraOrFloatData };
    } else if (extraOrFloatData) {
      extra.floatData = extraOrFloatData;
    }
    if (maybeSourcePhotoId && !extra.sourcePhotoId) {
      extra.sourcePhotoId = maybeSourcePhotoId;
    }
    const photo = createPhotoItem(canvasOrImg, fileName, cellIdx, extra);
    state.photos.push(photo);
    state.selectedPhotoIndex = state.photos.length - 1;
    state.selectedSlotId = null;
    return photo;
  }

  function removePhoto(index) {
    if (index >= 0 && index < state.photos.length) {
      const removed = state.photos.splice(index, 1)[0];
      if (removed && removed.slotId && state.templateSlots) {
        const slot = state.templateSlots.find(s => s.id === removed.slotId);
        if (slot) {
          slot.photoId = null;
          state.selectedSlotId = slot.id;
        }
      }
      state.selectedPhotoIndex = (state.photos.length > 0)
        ? Math.max(0, Math.min(state.photos.length - 1, state.selectedPhotoIndex))
        : -1;
    }
  }

  function clearAllPhotos() {
    state.photos = [];
    state.selectedPhotoIndex = -1;
    state.selectedSlotId = null;
    state.activeGuides = [];
    state.activeAlignmentNotice = '';
    if (state.templateSlots) {
      state.templateSlots.forEach(s => { s.photoId = null; });
    }
  }

  // =========================================================================
  // GESTIÓN DE PLANTILLAS PREDEFINIDAS EDITORIALES ESTILO CANVA
  // =========================================================================

  /**
   * Aplica una plantilla editorial al carrusel.
   * Limpia las fotos sueltas automáticas previas y si había fotos ya colocadas en huecos,
   * permite conservarlas o adaptarlas a los nuevos huecos.
   */
  function applyTemplate(templateId, options = {}) {
    if (!templateId || templateId === 'free') {
      state.activeTemplateId = null;
      state.templateSlots = [];
      state.templateTexts = [];
      state.hoveredSlotId = null;
      state.selectedSlotId = null;
      return null;
    }

    const tmpl = TEMPLATES[templateId];
    if (!tmpl) return null;

    // Guardar las fotos que el usuario ya hubiera colocado explícitamente en huecos previos
    const previousSlottedPhotos = state.photos.filter(p => p.slotId && (p.canvas || p.img));

    state.activeTemplateId = templateId;
    state.ratioKey = tmpl.ratioKey || '4:5';
    state.slideCount = tmpl.slideCount;
    state.mode = 'multi';
    state.hoveredSlotId = null;
    state.activeSlideViewIndex = -1;

    // Clonar huecos y textos de la plantilla
    state.templateSlots = tmpl.slots.map((s, idx) => ({
      ...s,
      slotNumber: idx + 1,
      photoId: null
    }));

    state.templateTexts = (tmpl.texts || []).map(t => ({ ...t }));

    // Limpiar fotos sueltas para que no tapen la plantilla recién elegida
    state.photos = [];
    state.selectedPhotoIndex = -1;
    state.selectedSlotId = state.templateSlots.length > 0 ? state.templateSlots[0].id : null;

    // Si el usuario ya había asignado fotos a huecos en otra plantilla y pide mantenerlas
    if (options.preserveSlottedPhotos !== false && previousSlottedPhotos.length > 0) {
      const count = Math.min(previousSlottedPhotos.length, state.templateSlots.length);
      for (let i = 0; i < count; i++) {
        const oldP = previousSlottedPhotos[i];
        assignPhotoToSlot(state.templateSlots[i].id, oldP.canvas || oldP.img, oldP.fileName, oldP.floatData, {
          sourcePhotoId: oldP.sourcePhotoId,
          renderedCanvas: oldP.renderedCanvas
        });
      }
    }

    return tmpl;
  }

  /**
   * Vacía los huecos de la plantilla activa
   */
  function clearTemplateSlots() {
    if (state.templateSlots) {
      state.templateSlots.forEach(s => { s.photoId = null; });
    }
    state.photos = [];
    state.selectedPhotoIndex = -1;
    state.selectedSlotId = (state.templateSlots && state.templateSlots.length > 0) ? state.templateSlots[0].id : null;
  }

  function getActiveTemplate() {
    return state.activeTemplateId ? TEMPLATES[state.activeTemplateId] : null;
  }

  function getTemplateSlots() {
    return state.templateSlots || [];
  }

  function getSlotById(slotId) {
    if (!state.templateSlots) return null;
    return state.templateSlots.find(s => s.id === slotId) || null;
  }

  /**
   * Obtiene el rectángulo actual en píxeles de un hueco de plantilla.
   * Si el hueco tiene una foto asignada y el usuario movió o redimensionó ese marco,
   * devuelve la posición actual del marco para que siempre coincida.
   */
  function getSlotRect(slot, cellWOrBaseH, maybeCellH) {
    let cellW = cellWOrBaseH;
    let cellH = maybeCellH;
    if (cellH === undefined) {
      const strip = getStripDimensions(cellWOrBaseH || 1200);
      cellW = strip.cellW;
      cellH = strip.totalH;
    }
    if (slot.photoId) {
      const assigned = state.photos.find(p => p.id === slot.photoId);
      if (assigned) {
        const bb = getPhotoBoundingBox(assigned);
        const scaleX = cellW / getStripDimensions(1200).cellW;
        const scaleY = cellH / 1200;
        const w = bb.width * scaleX;
        const h = bb.height * scaleY;
        return {
          cx: bb.centerX * scaleX,
          cy: bb.centerY * scaleY,
          w,
          h,
          width: w,
          height: h,
          left: bb.left * scaleX,
          right: bb.right * scaleX,
          top: bb.top * scaleY,
          bottom: bb.bottom * scaleY
        };
      }
    }
    const cx = slot.xNorm * cellW;
    const cy = slot.yNorm * cellH;
    const w = slot.wNorm * cellW;
    const h = slot.hNorm * cellH;
    return {
      cx,
      cy,
      w,
      h,
      width: w,
      height: h,
      left: cx - w * 0.5,
      right: cx + w * 0.5,
      top: cy - h * 0.5,
      bottom: cy + h * 0.5
    };
  }

  /**
   * Detecta qué hueco de la plantilla está bajo (stripX, stripY).
   * Prioriza huecos con mayor zIndex y menor área (para que los insets encima de fondos siempre se puedan tocar).
   */
  function hitTestSlot(stripX, stripY) {
    if (!state.activeTemplateId || !state.templateSlots || state.templateSlots.length === 0) {
      return null;
    }
    const strip = getStripDimensions(1200);
    const cellW = strip.cellW;
    const cellH = strip.totalH;

    const candidates = [];
    for (let i = 0; i < state.templateSlots.length; i++) {
      const slot = state.templateSlots[i];
      const rect = getSlotRect(slot, cellW, cellH);
      if (stripX >= rect.left && stripX <= rect.right && stripY >= rect.top && stripY <= rect.bottom) {
        candidates.push({
          slot,
          zIndex: (typeof slot.zIndex === 'number') ? slot.zIndex : 1,
          area: rect.w * rect.h
        });
      }
    }

    if (candidates.length === 0) return null;

    // Ordenar: mayor zIndex primero; en caso de empate, menor área primero
    candidates.sort((a, b) => {
      if (b.zIndex !== a.zIndex) return b.zIndex - a.zIndex;
      return a.area - b.area;
    });

    return candidates[0].slot;
  }

  /**
   * Asigna y encuadra perfectamente (Cover sin deformación) una foto dentro de un hueco de la plantilla.
   */
  function assignPhotoToSlot(slotId, canvasOrImg, fileName = '', floatData = null, extraOrSourceId = {}) {
    const slot = getSlotById(slotId);
    if (!slot || !canvasOrImg) return null;

    const extra = (typeof extraOrSourceId === 'string')
      ? { sourcePhotoId: extraOrSourceId }
      : (extraOrSourceId || {});

    const strip = getStripDimensions(1200);
    const cellW = strip.cellW;
    const cellH = strip.totalH;

    const targetCenterX = slot.xNorm * cellW;
    const targetCenterY = slot.yNorm * cellH;
    const targetW = Math.max(24, slot.wNorm * cellW);
    const targetH = Math.max(24, slot.hNorm * cellH);

    // Comprobar si ya había una foto asignada a este hueco para reemplazarla manteniendo la posición del marco
    let existingIndex = -1;
    if (slot.photoId) {
      existingIndex = state.photos.findIndex(p => p.id === slot.photoId);
    }

    let photoItem;
    if (existingIndex >= 0) {
      photoItem = state.photos[existingIndex];
      const keepBoxW = photoItem.boxW || targetW;
      const keepBoxH = photoItem.boxH || targetH;
      photoItem.canvas = canvasOrImg;
      photoItem.img = canvasOrImg;
      photoItem.renderedCanvas = extra.renderedCanvas || canvasOrImg;
      photoItem.floatData = floatData;
      photoItem.sourcePhotoId = extra.sourcePhotoId || null;
      photoItem.fileName = fileName || slot.label;
      photoItem.rotation = 0;
      photoItem.innerZoom = 1.0;
      photoItem.crop = { x: 0.0, y: 0.0, w: 1.0, h: 1.0 };
      photoItem.isCropMode = false;
      photoItem.slotId = slot.id;
      photoItem.zIndex = (typeof slot.zIndex === 'number') ? slot.zIndex : photoItem.zIndex;
      photoItem.frameBorder = slot.frameBorder || null;
      fitPhotoToFrameBox(photoItem, keepBoxW, keepBoxH, canvasOrImg);
      state.selectedPhotoIndex = existingIndex;
    } else {
      photoItem = createPhotoItem(canvasOrImg, fileName || slot.label, slot.cellIndex, {
        x: targetCenterX,
        y: targetCenterY,
        floatData: floatData,
        sourcePhotoId: extra.sourcePhotoId || null,
        renderedCanvas: extra.renderedCanvas || canvasOrImg,
        slotId: slot.id,
        zIndex: (typeof slot.zIndex === 'number') ? slot.zIndex : 1,
        frameBorder: slot.frameBorder || null
      });
      fitPhotoToFrameBox(photoItem, targetW, targetH, canvasOrImg);
      state.photos.push(photoItem);
      // Ordenar state.photos por zIndex ascendente para que las capas superpuestas se respeten
      sortPhotosByZIndex();
      state.selectedPhotoIndex = state.photos.findIndex(p => p.id === photoItem.id);
    }

    slot.photoId = photoItem.id;
    state.selectedSlotId = null;
    return photoItem;
  }

  function sortPhotosByZIndex() {
    const selected = getSelectedPhoto();
    const selectedId = selected ? selected.id : null;
    state.photos.sort((a, b) => (Number(a.zIndex) || 0) - (Number(b.zIndex) || 0));
    if (selectedId) {
      state.selectedPhotoIndex = state.photos.findIndex(p => p.id === selectedId);
    }
  }

  /**
   * Rellena automáticamente los huecos vacíos de la plantilla con las fotos proporcionadas
   */
  function autoFillSlots(loadedPhotos = []) {
    if (!state.activeTemplateId || !state.templateSlots || state.templateSlots.length === 0) {
      return 0;
    }

    const pool = (loadedPhotos && loadedPhotos.length > 0) ? loadedPhotos : [];
    if (pool.length === 0) return 0;

    let filledCount = 0;
    for (let i = 0; i < state.templateSlots.length; i++) {
      const slot = state.templateSlots[i];
      const hasPhoto = slot.photoId && state.photos.some(p => p.id === slot.photoId);
      if (!hasPhoto) {
        const item = pool[filledCount % pool.length];
        assignPhotoToSlot(slot.id, item.renderedCanvas || item.canvas, item.fileName, item.floatData, {
          sourcePhotoId: item.id || null,
          renderedCanvas: item.renderedCanvas || item.canvas
        });
        filledCount++;
      }
    }
    return filledCount;
  }

  function bringForward(index) {
    if (index >= 0 && index < state.photos.length) {
      const photo = state.photos[index];
      photo.zIndex = (Number(photo.zIndex) || 1) + 1;
      if (index < state.photos.length - 1) {
        const item = state.photos.splice(index, 1)[0];
        state.photos.splice(index + 1, 0, item);
        state.selectedPhotoIndex = index + 1;
      }
    }
  }

  function sendBackward(index) {
    if (index >= 0 && index < state.photos.length) {
      const photo = state.photos[index];
      photo.zIndex = Math.max(0, (Number(photo.zIndex) || 1) - 1);
      if (index > 0) {
        const item = state.photos.splice(index, 1)[0];
        state.photos.splice(index - 1, 0, item);
        state.selectedPhotoIndex = index - 1;
      }
    }
  }

  function clampPhotosToStrip() {
    const strip = getStripDimensions(1200);
    for (const p of state.photos) {
      p.x = Math.max(0, Math.min(strip.totalW, p.x));
      p.y = Math.max(0, Math.min(strip.totalH, p.y));
    }
  }

  function drawRoundedRect(ctx, x, y, w, h, r = 6) {
    if (!ctx || w <= 0 || h <= 0) return;
    if (ctx.arcTo) {
      const radius = Math.max(0, Math.min(r, Math.abs(w) * 0.5, Math.abs(h) * 0.5));
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + w - radius, y);
      ctx.arcTo(x + w, y, x + w, y + radius, radius);
      ctx.lineTo(x + w, y + h - radius);
      ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
      ctx.lineTo(x + radius, y + h);
      ctx.arcTo(x, y + h, x, y + h - radius, radius);
      ctx.lineTo(x, y + radius);
      ctx.arcTo(x, y, x + radius, y, radius);
      ctx.closePath();
    } else {
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.closePath();
    }
  }

  /**
   * Obtiene la caja delimitadora en píxeles del lienzo continuo para una foto
   */
  function getPhotoBoundingBox(photo) {
    if (!photo) {
      return { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0, centerX: 0, centerY: 0 };
    }
    const cropW = (photo.crop && typeof photo.crop.w === 'number' && !isNaN(photo.crop.w)) ? photo.crop.w : 1.0;
    const cropH = (photo.crop && typeof photo.crop.h === 'number' && !isNaN(photo.crop.h)) ? photo.crop.h : 1.0;
    const isRot90 = (photo.rotation === 90 || photo.rotation === 270);
    const baseW = Math.max(10, Number(photo.width) || 1200) * cropW;
    const baseH = Math.max(10, Number(photo.height) || 1200) * cropH;
    const effW = isRot90 ? baseH : baseW;
    const effH = isRot90 ? baseW : baseH;
    const scale = Math.max(0.05, Math.min(10.0, Number(photo.scale) || 1.0));
    const curW = Math.max(1, effW * scale);
    const curH = Math.max(1, effH * scale);
    const px = (typeof photo.x === 'number' && !isNaN(photo.x)) ? photo.x : 0;
    const py = (typeof photo.y === 'number' && !isNaN(photo.y)) ? photo.y : 0;

    return {
      left: px - curW * 0.5,
      right: px + curW * 0.5,
      top: py - curH * 0.5,
      bottom: py + curH * 0.5,
      width: curW,
      height: curH,
      centerX: px,
      centerY: py
    };
  }

  /**
   * Obtiene los límites de la fotografía completa original (sin recortar) sobre el lienzo
   */
  function getPhotoUncroppedBox(photo) {
    if (!photo) {
      return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, centerX: 0, centerY: 0 };
    }
    const bb = getPhotoBoundingBox(photo);
    const crop = photo.crop || { x: 0.0, y: 0.0, w: 1.0, h: 1.0 };
    const cropW = Math.max(0.01, (typeof crop.w === 'number' && !isNaN(crop.w)) ? crop.w : 1.0);
    const cropH = Math.max(0.01, (typeof crop.h === 'number' && !isNaN(crop.h)) ? crop.h : 1.0);
    const cropX = (typeof crop.x === 'number' && !isNaN(crop.x)) ? crop.x : 0.0;
    const cropY = (typeof crop.y === 'number' && !isNaN(crop.y)) ? crop.y : 0.0;

    const fullW = Math.max(1, bb.width / cropW);
    const fullH = Math.max(1, bb.height / cropH);
    const fullLeft = bb.left - cropX * fullW;
    const fullTop = bb.top - cropY * fullH;

    return {
      left: fullLeft,
      top: fullTop,
      right: fullLeft + fullW,
      bottom: fullTop + fullH,
      width: fullW,
      height: fullH,
      centerX: fullLeft + fullW * 0.5,
      centerY: fullTop + fullH * 0.5
    };
  }

  /**
   * SNAPPING MAGNÉTICO INTELIGENTE ESTILO CANVA
   */
  function computeMagneticSnapping(photo, targetX, targetY, options = {}) {
    if (!photo || !state.magneticSnapEnabled) {
      return { snappedX: targetX, snappedY: targetY, guides: [], notice: '' };
    }

    const strip = getStripDimensions(1200);
    const threshold = options.threshold || 14;
    const bb = getPhotoBoundingBox(photo);
    const halfW = bb.width * 0.5;
    const halfH = bb.height * 0.5;

    let snappedX = targetX;
    let snappedY = targetY;
    let bestDistX = threshold + 1;
    let bestDistY = threshold + 1;
    const guides = [];
    let noticeX = '';
    let noticeY = '';

    for (let i = 0; i <= strip.slideCount; i++) {
      const seamX = i * strip.cellW;

      const distL = Math.abs((targetX - halfW) - seamX);
      if (distL < threshold && distL < bestDistX) {
        bestDistX = distL;
        snappedX = seamX + halfW;
        guides.push({ type: 'v', x: seamX, label: `Borde Diap. ${i + 1}` });
        noticeX = `Borde Diapositiva #${i + 1}`;
      }

      const distR = Math.abs((targetX + halfW) - seamX);
      if (distR < threshold && distR < bestDistX) {
        bestDistX = distR;
        snappedX = seamX - halfW;
        guides.push({ type: 'v', x: seamX, label: `Borde Diap. ${i}` });
        noticeX = `Borde Diapositiva #${i}`;
      }

      if (i > 0 && i < strip.slideCount) {
        const distCenterSeam = Math.abs(targetX - seamX);
        if (distCenterSeam < threshold && distCenterSeam < bestDistX) {
          bestDistX = distCenterSeam;
          snappedX = seamX;
          guides.push({ type: 'v', x: seamX, label: `Entre Medias (#${i} y #${i + 1})` });
          noticeX = `Entre medias (#${i} y #${i + 1})`;
        }
      }

      if (i < strip.slideCount) {
        const slideCenterX = seamX + strip.cellW * 0.5;
        const distC = Math.abs(targetX - slideCenterX);
        if (distC < threshold && distC < bestDistX) {
          bestDistX = distC;
          snappedX = slideCenterX;
          guides.push({ type: 'v', x: slideCenterX, label: `Centro Diap. ${i + 1}` });
          noticeX = `Centro Diapositiva #${i + 1}`;
        }
      }
    }

    const canvasCenterY = strip.totalH * 0.5;
    const distCY = Math.abs(targetY - canvasCenterY);
    if (distCY < threshold && distCY < bestDistY) {
      bestDistY = distCY;
      snappedY = canvasCenterY;
      guides.push({ type: 'h', y: canvasCenterY, label: 'Centro Horizontal' });
      noticeY = 'Centro vertical';
    }

    const distTop = Math.abs((targetY - halfH) - 0);
    if (distTop < threshold && distTop < bestDistY) {
      bestDistY = distTop;
      snappedY = halfH;
      guides.push({ type: 'h', y: 0, label: 'Borde Superior' });
      noticeY = 'Borde superior';
    }

    const distBottom = Math.abs((targetY + halfH) - strip.totalH);
    if (distBottom < threshold && distBottom < bestDistY) {
      bestDistY = distBottom;
      snappedY = strip.totalH - halfH;
      guides.push({ type: 'h', y: strip.totalH, label: 'Borde Inferior' });
      noticeY = 'Borde inferior';
    }

    for (const other of state.photos) {
      if (other.id === photo.id) continue;
      const obb = getPhotoBoundingBox(other);

      const distOtherCX = Math.abs(targetX - obb.centerX);
      if (distOtherCX < threshold && distOtherCX < bestDistX) {
        bestDistX = distOtherCX;
        snappedX = obb.centerX;
        guides.push({ type: 'v', x: obb.centerX, label: 'Mismo Centro' });
        noticeX = 'Alineado al centro';
      }

      const distOtherCY = Math.abs(targetY - obb.centerY);
      if (distOtherCY < threshold && distOtherCY < bestDistY) {
        bestDistY = distOtherCY;
        snappedY = obb.centerY;
        guides.push({ type: 'h', y: obb.centerY, label: 'Mismo Centro' });
        noticeY = 'Alineado verticalmente';
      }

      const distLL = Math.abs((targetX - halfW) - obb.left);
      if (distLL < threshold && distLL < bestDistX) {
        bestDistX = distLL;
        snappedX = obb.left + halfW;
        guides.push({ type: 'v', x: obb.left, label: 'Mismo Borde Izq.' });
        noticeX = 'Mismo borde izquierdo';
      }

      const distRR = Math.abs((targetX + halfW) - obb.right);
      if (distRR < threshold && distRR < bestDistX) {
        bestDistX = distRR;
        snappedX = obb.right - halfW;
        guides.push({ type: 'v', x: obb.right, label: 'Mismo Borde Der.' });
        noticeX = 'Mismo borde derecho';
      }

      const distTT = Math.abs((targetY - halfH) - obb.top);
      if (distTT < threshold && distTT < bestDistY) {
        bestDistY = distTT;
        snappedY = obb.top + halfH;
        guides.push({ type: 'h', y: obb.top, label: 'Mismo Borde Sup.' });
        noticeY = 'Mismo borde superior';
      }

      const distBB = Math.abs((targetY + halfH) - obb.bottom);
      if (distBB < threshold && distBB < bestDistY) {
        bestDistY = distBB;
        snappedY = obb.bottom - halfH;
        guides.push({ type: 'h', y: obb.bottom, label: 'Mismo Borde Inf.' });
        noticeY = 'Mismo borde inferior';
      }
    }

    let finalNotice = '';
    if (noticeX && noticeY) finalNotice = `🧲 ${noticeX} · ${noticeY}`;
    else if (noticeX) finalNotice = `🧲 ${noticeX}`;
    else if (noticeY) finalNotice = `🧲 ${noticeY}`;

    return { snappedX, snappedY, guides, notice: finalNotice };
  }

  function movePhoto(index, newCenterX, newCenterY, options = {}) {
    const photo = state.photos[index];
    if (!photo || photo.locked) return;

    if (options.snap !== false) {
      const snapResult = computeMagneticSnapping(photo, newCenterX, newCenterY, options);
      photo.x = snapResult.snappedX;
      photo.y = snapResult.snappedY;
      state.activeGuides = snapResult.guides;

      if (snapResult.notice) {
        state.activeAlignmentNotice = snapResult.notice;
        clearTimeout(state.noticeTimeout);
        state.noticeTimeout = setTimeout(() => {
          state.activeAlignmentNotice = '';
          state.activeGuides = [];
        }, 1400);
      }
    } else {
      photo.x = newCenterX;
      photo.y = newCenterY;
      state.activeGuides = [];
      state.activeAlignmentNotice = '';
    }
  }

  function scalePhoto(index, newScale, options = {}) {
    const photo = state.photos[index];
    if (!photo || photo.locked) return;

    // Si la foto está en modo encuadre interior (isCropMode), la rueda hace zoom interior tipo Canva
    if (photo.isCropMode) {
      const curZoom = Number(photo.innerZoom) || 1.0;
      const ratio = newScale / (Number(photo.scale) || 1.0);
      photo.innerZoom = Math.max(1.0, Math.min(4.0, curZoom * ratio));
      const bb = getPhotoBoundingBox(photo);
      fitPhotoToFrameBox(photo, bb.width, bb.height);
      return;
    }

    const strip = getStripDimensions(1200);
    let targetScale = Math.max(0.15, Math.min(4.5, newScale));

    if (state.magneticSnapEnabled && options.snap !== false) {
      const baseW = photo.width * (photo.crop ? photo.crop.w : 1);
      const baseH = photo.height * (photo.crop ? photo.crop.h : 1);
      const curW = baseW * targetScale;
      const curH = baseH * targetScale;

      if (Math.abs(curW - strip.cellW) < 20) {
        targetScale = strip.cellW / baseW;
        state.activeAlignmentNotice = '🧲 Mismo ancho que Diapositiva';
      } else if (Math.abs(curH - strip.cellH) < 20) {
        targetScale = strip.cellH / baseH;
        state.activeAlignmentNotice = '🧲 Mismo alto que Diapositiva';
      }
    }

    photo.scale = targetScale;
    const bb = getPhotoBoundingBox(photo);
    photo.boxW = bb.width;
    photo.boxH = bb.height;
  }

  /**
   * Encuentra qué foto está bajo unas coordenadas dadas del lienzo continuo.
   * Si hay varias fotos superpuestas, devuelve la que tenga mayor zIndex (y menor área en empate).
   */
  function hitTestPhoto(canvasX, canvasY) {
    const hits = [];
    for (let i = state.photos.length - 1; i >= 0; i--) {
      const p = state.photos[i];
      const bb = getPhotoBoundingBox(p);
      if (canvasX >= bb.left && canvasX <= bb.right && canvasY >= bb.top && canvasY <= bb.bottom) {
        hits.push({
          index: i,
          zIndex: (typeof p.zIndex === 'number') ? p.zIndex : i,
          area: bb.width * bb.height
        });
      }
    }
    if (hits.length === 0) return -1;
    hits.sort((a, b) => {
      if (b.zIndex !== a.zIndex) return b.zIndex - a.zIndex;
      return a.area - b.area;
    });
    return hits[0].index;
  }

  /**
   * Detecta si el puntero está sobre alguna manija de redimensión (4 esquinas + 4 lados estilo Canva),
   * botón flotante o marco de recorte
   */
  function hitTestPhotoHandle(stripX, stripY, photo, threshold = 22) {
    if (!photo) return null;
    const bb = getPhotoBoundingBox(photo);

    // 1. MODO RECORTE / ENCUADRE INTERNO ESTILO CANVA
    if (photo.isCropMode) {
      const btnH = 28;
      const doneW = 96;
      const resetW = 104;
      const gap = 8;
      const totalBarW = doneW + resetW + gap;
      const startX = photo.x - totalBarW * 0.5;
      const barY = Math.max(14, bb.top - btnH - 12);

      if (stripX >= startX && stripX <= startX + doneW && stripY >= barY && stripY <= barY + btnH) {
        return { handle: 'crop-done', cursor: 'pointer' };
      }

      const rstX = startX + doneW + gap;
      if (stripX >= rstX && stripX <= rstX + resetW && stripY >= barY && stripY <= barY + btnH) {
        return { handle: 'crop-reset', cursor: 'pointer' };
      }

      if (Math.hypot(stripX - bb.left, stripY - bb.top) <= threshold) return { handle: 'crop-tl', cursor: 'nwse-resize' };
      if (Math.hypot(stripX - bb.right, stripY - bb.top) <= threshold) return { handle: 'crop-tr', cursor: 'nesw-resize' };
      if (Math.hypot(stripX - bb.left, stripY - bb.bottom) <= threshold) return { handle: 'crop-bl', cursor: 'nesw-resize' };
      if (Math.hypot(stripX - bb.right, stripY - bb.bottom) <= threshold) return { handle: 'crop-br', cursor: 'nwse-resize' };

      if (Math.abs(stripY - bb.top) <= threshold && stripX >= bb.left && stripX <= bb.right) return { handle: 'crop-tc', cursor: 'ns-resize' };
      if (Math.abs(stripY - bb.bottom) <= threshold && stripX >= bb.left && stripX <= bb.right) return { handle: 'crop-bc', cursor: 'ns-resize' };
      if (Math.abs(stripX - bb.left) <= threshold && stripY >= bb.top && stripY <= bb.bottom) return { handle: 'crop-ml', cursor: 'ew-resize' };
      if (Math.abs(stripX - bb.right) <= threshold && stripY >= bb.top && stripY <= bb.bottom) return { handle: 'crop-mr', cursor: 'ew-resize' };

      if (stripX >= bb.left && stripX <= bb.right && stripY >= bb.top && stripY <= bb.bottom) {
        return { handle: 'crop-body', cursor: 'grab' };
      }
      return null;
    }

    // 2. MODO SELECCIÓN NORMAL ESTILO CANVA (4 ESQUINAS + 4 TIRADORES LATERALES + BARRA SUPERIOR)
    const badgeH = 26;
    const nameW = 92;
    const cropBtnW = 96;
    const badgeGap = 6;
    const totalTopW = nameW + cropBtnW + badgeGap;
    const topBarX = photo.x - totalTopW * 0.5;
    const topBarY = Math.max(12, bb.top - badgeH - 10);

    const cropBtnX = topBarX + nameW + badgeGap;
    if (stripX >= cropBtnX && stripX <= cropBtnX + cropBtnW && stripY >= topBarY && stripY <= topBarY + badgeH) {
      return { handle: 'badge-crop', cursor: 'pointer' };
    }

    // 4 Esquinas (escalado proporcional)
    if (Math.hypot(stripX - bb.left, stripY - bb.top) <= threshold) return { handle: 'resize-tl', cursor: 'nwse-resize' };
    if (Math.hypot(stripX - bb.right, stripY - bb.top) <= threshold) return { handle: 'resize-tr', cursor: 'nesw-resize' };
    if (Math.hypot(stripX - bb.left, stripY - bb.bottom) <= threshold) return { handle: 'resize-bl', cursor: 'nesw-resize' };
    if (Math.hypot(stripX - bb.right, stripY - bb.bottom) <= threshold) return { handle: 'resize-br', cursor: 'nwse-resize' };

    // 4 Tiradores laterales tipo pastilla Canva (reajustan el ancho/alto del marco con Auto-Cover)
    if (Math.hypot(stripX - bb.left, stripY - bb.centerY) <= threshold) return { handle: 'side-l', cursor: 'ew-resize' };
    if (Math.hypot(stripX - bb.right, stripY - bb.centerY) <= threshold) return { handle: 'side-r', cursor: 'ew-resize' };
    if (Math.hypot(stripX - bb.centerX, stripY - bb.top) <= threshold) return { handle: 'side-t', cursor: 'ns-resize' };
    if (Math.hypot(stripX - bb.centerX, stripY - bb.bottom) <= threshold) return { handle: 'side-b', cursor: 'ns-resize' };

    if (stripX >= bb.left && stripX <= bb.right && stripY >= bb.top && stripY <= bb.bottom) {
      return { handle: 'photo-body', cursor: 'move' };
    }

    return null;
  }

  /**
   * Redimensiona una foto arrastrando una esquina (proporcional) o un lateral (reencuadre Cover estilo Canva)
   */
  function resizePhotoCorner(index, handle, stripX, stripY, startData, options = {}) {
    const photo = state.photos[index];
    if (!photo || !startData || photo.locked) return;

    // Caso A: Tirador lateral estilo Canva ('l', 'r', 't', 'b' o 'side-l', etc.)
    const cleanHandle = handle.replace('resize-', '').replace('side-', '');
    if (cleanHandle === 'l' || cleanHandle === 'r' || cleanHandle === 't' || cleanHandle === 'b') {
      const strip = getStripDimensions(1200);
      let newLeft = startData.origLeft !== undefined ? startData.origLeft : (photo.x - startData.origW * 0.5);
      let newRight = startData.origRight !== undefined ? startData.origRight : (photo.x + startData.origW * 0.5);
      let newTop = startData.origTop !== undefined ? startData.origTop : (photo.y - startData.origH * 0.5);
      let newBottom = startData.origBottom !== undefined ? startData.origBottom : (photo.y + startData.origH * 0.5);

      const minDim = 48;
      if (cleanHandle === 'l') {
        newLeft = Math.min(newRight - minDim, stripX);
        if (state.magneticSnapEnabled) {
          for (let i = 0; i <= strip.slideCount; i++) {
            if (Math.abs(newLeft - i * strip.cellW) < 14) newLeft = i * strip.cellW;
          }
        }
      } else if (cleanHandle === 'r') {
        newRight = Math.max(newLeft + minDim, stripX);
        if (state.magneticSnapEnabled) {
          for (let i = 0; i <= strip.slideCount; i++) {
            if (Math.abs(newRight - i * strip.cellW) < 14) newRight = i * strip.cellW;
          }
        }
      } else if (cleanHandle === 't') {
        newTop = Math.min(newBottom - minDim, stripY);
        if (state.magneticSnapEnabled && Math.abs(newTop) < 14) newTop = 0;
      } else if (cleanHandle === 'b') {
        newBottom = Math.max(newTop + minDim, stripY);
        if (state.magneticSnapEnabled && Math.abs(newBottom - strip.totalH) < 14) newBottom = strip.totalH;
      }

      const newW = Math.max(minDim, newRight - newLeft);
      const newH = Math.max(minDim, newBottom - newTop);
      photo.x = (newLeft + newRight) * 0.5;
      photo.y = (newTop + newBottom) * 0.5;
      fitPhotoToFrameBox(photo, newW, newH);
      return;
    }

    // Caso B: Tirador de esquina ('tl', 'tr', 'bl', 'br') -> Escalado proporcional
    const { anchorX, anchorY, origW, origH, photoScale } = startData;
    if (origW <= 0 || origH <= 0 || photoScale <= 0) return;

    const vecX = (cleanHandle.includes('r')) ? (stripX - anchorX) : (anchorX - stripX);
    const vecY = (cleanHandle.includes('b')) ? (stripY - anchorY) : (anchorY - stripY);

    const diagLen = Math.hypot(origW, origH);
    if (diagLen <= 0) return;
    const proj = (vecX * origW + vecY * origH) / (diagLen * diagLen);

    let targetScale = Math.max(0.10, Math.min(5.0, photoScale * proj));

    if (state.magneticSnapEnabled && options.snap !== false) {
      const strip = getStripDimensions(1200);
      const testW = (origW / photoScale) * targetScale;
      const testH = (origH / photoScale) * targetScale;

      if (Math.abs(testW - strip.cellW) < 16) {
        targetScale = (strip.cellW / (origW / photoScale));
        state.activeAlignmentNotice = '🧲 Mismo ancho que Diapositiva';
      } else if (Math.abs(testH - strip.cellH) < 16) {
        targetScale = (strip.cellH / (origH / photoScale));
        state.activeAlignmentNotice = '🧲 Mismo alto que Diapositiva';
      }
    }

    const scaleFactor = targetScale / photoScale;
    const newW = origW * scaleFactor;
    const newH = origH * scaleFactor;

    photo.scale = targetScale;
    photo.boxW = newW;
    photo.boxH = newH;
    photo.x = (cleanHandle.includes('r')) ? (anchorX + newW * 0.5) : (anchorX - newW * 0.5);
    photo.y = (cleanHandle.includes('b')) ? (anchorY + newH * 0.5) : (anchorY - newH * 0.5);
  }

  function resizeCropHandle(index, handle, stripX, stripY, startData) {
    const photo = state.photos[index];
    if (!photo || !startData) return;

    const { startCrop, fullW, fullH, fullLeft, fullTop } = startData;
    if (fullW <= 0 || fullH <= 0) return;

    const normX = Math.max(0.0, Math.min(1.0, (stripX - fullLeft) / fullW));
    const normY = Math.max(0.0, Math.min(1.0, (stripY - fullTop) / fullH));

    const minCropSize = 0.05;
    let newCropX = photo.crop.x;
    let newCropY = photo.crop.y;
    let newCropW = photo.crop.w;
    let newCropH = photo.crop.h;

    const startRight = startCrop.x + startCrop.w;
    const startBottom = startCrop.y + startCrop.h;

    if (handle.includes('l')) {
      newCropX = Math.max(0.0, Math.min(startRight - minCropSize, normX));
      newCropW = startRight - newCropX;
    } else if (handle.includes('r')) {
      const right = Math.max(startCrop.x + minCropSize, Math.min(1.0, normX));
      newCropW = right - startCrop.x;
      newCropX = startCrop.x;
    }

    if (handle.includes('t')) {
      newCropY = Math.max(0.0, Math.min(startBottom - minCropSize, normY));
      newCropH = startBottom - newCropY;
    } else if (handle.includes('b')) {
      const bottom = Math.max(startCrop.y + minCropSize, Math.min(1.0, normY));
      newCropH = bottom - startCrop.y;
      newCropY = startCrop.y;
    }

    photo.crop = { x: newCropX, y: newCropY, w: newCropW, h: newCropH };

    const newCropLeft = fullLeft + newCropX * fullW;
    const newCropTop = fullTop + newCropY * fullH;
    const newCropBoxW = newCropW * fullW;
    const newCropBoxH = newCropH * fullH;

    photo.x = newCropLeft + newCropBoxW * 0.5;
    photo.y = newCropTop + newCropBoxH * 0.5;
    photo.boxW = newCropBoxW;
    photo.boxH = newCropBoxH;
  }

  function panPhotoInCrop(index, dStripX, dStripY, startData) {
    const photo = state.photos[index];
    if (!photo || !startData) return;

    const { startCropX, startCropY, fullW, fullH } = startData;
    if (fullW <= 0 || fullH <= 0) return;

    const dxNorm = dStripX / fullW;
    const dyNorm = dStripY / fullH;

    photo.crop.x = Math.max(0.0, Math.min(1.0 - photo.crop.w, startCropX - dxNorm));
    photo.crop.y = Math.max(0.0, Math.min(1.0 - photo.crop.h, startCropY - dyNorm));
  }

  function setPhotoCrop(index, crop) {
    const photo = state.photos[index];
    if (!photo || !crop) return;
    photo.crop = {
      x: Math.max(0.0, Math.min(0.95, (typeof crop.x === 'number') ? crop.x : 0.0)),
      y: Math.max(0.0, Math.min(0.95, (typeof crop.y === 'number') ? crop.y : 0.0)),
      w: Math.max(0.05, Math.min(1.0, (typeof crop.w === 'number') ? crop.w : 1.0)),
      h: Math.max(0.05, Math.min(1.0, (typeof crop.h === 'number') ? crop.h : 1.0))
    };
  }

  function setPhotoCropRatio(index, ratioKey) {
    const photo = state.photos[index];
    if (!photo) return;

    if (ratioKey === 'free') return;
    if (ratioKey === 'reset') {
      resetPhotoCrop(index);
      return;
    }

    const bb = getPhotoBoundingBox(photo);
    let targetAspect = 1.0;
    if (ratioKey === '1:1') targetAspect = 1.0;
    else if (ratioKey === '4:5') targetAspect = 4 / 5;
    else if (ratioKey === '3:4') targetAspect = 3 / 4;
    else if (ratioKey === '16:9') targetAspect = 16 / 9;

    const newH = bb.height;
    const newW = newH * targetAspect;
    fitPhotoToFrameBox(photo, newW, newH);
  }

  function resetPhotoCrop(index) {
    const photo = state.photos[index];
    if (!photo) return;
    photo.innerZoom = 1.0;
    if (photo.slotId) {
      const slot = getSlotById(photo.slotId);
      if (slot) {
        const strip = getStripDimensions(1200);
        photo.crop = { x: 0.0, y: 0.0, w: 1.0, h: 1.0 };
        fitPhotoToFrameBox(photo, slot.wNorm * strip.cellW, slot.hNorm * strip.totalH);
        return;
      }
    }
    photo.crop = { x: 0.0, y: 0.0, w: 1.0, h: 1.0 };
  }

  function togglePhotoCropMode(index, active) {
    const targetIdx = (index !== undefined) ? index : state.selectedPhotoIndex;
    const photo = state.photos[targetIdx];
    if (!photo) return false;

    const targetActive = (active !== undefined) ? !!active : !photo.isCropMode;

    for (let i = 0; i < state.photos.length; i++) {
      if (i !== targetIdx) {
        state.photos[i].isCropMode = false;
      }
    }

    photo.isCropMode = targetActive;
    if (targetActive) {
      state.selectedPhotoIndex = targetIdx;
    }
    return photo.isCropMode;
  }

  /**
   * Dibuja un hueco vacío individual con estética limpia tipo Canva Frame
   */
  function drawSingleEmptySlot(ctx, slot, cellW, cellH, scaleFactor = 1.0) {
    const cx = slot.xNorm * cellW;
    const cy = slot.yNorm * cellH;
    const w = slot.wNorm * cellW;
    const h = slot.hNorm * cellH;
    const left = cx - w * 0.5;
    const top = cy - h * 0.5;

    const isHovered = (state.hoveredSlotId === slot.id);
    const isSelected = (state.selectedSlotId === slot.id);
    const isForeground = (slot.zIndex && slot.zIndex >= 2);

    ctx.save();

    // Sombra suave si es un marco superpuesto (inset / polaroid)
    if (isForeground) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.14)';
      ctx.shadowBlur = 16 * scaleFactor;
      ctx.shadowOffsetY = 4 * scaleFactor;
    }

    // Fondo estilo Canva Frame
    if (isHovered) {
      ctx.fillStyle = isForeground ? '#fff0f2' : 'rgba(255, 51, 75, 0.10)';
    } else if (isSelected) {
      ctx.fillStyle = isForeground ? '#fff5f6' : 'rgba(255, 51, 75, 0.06)';
    } else {
      ctx.fillStyle = isForeground ? '#faf8f5' : (slot.isBackground ? '#f3f0ea' : '#edeae2');
    }

    const r = Math.max(3, Math.min(8, 5 * scaleFactor));
    drawRoundedRect(ctx, left, top, w, h, r);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Si tiene marco decorativo (como el cuadro enmarcado de Carousel #5)
    if (slot.frameBorder) {
      ctx.lineWidth = 6 * scaleFactor;
      ctx.strokeStyle = slot.frameBorder;
      ctx.setLineDash([]);
      ctx.strokeRect(left, top, w, h);
    }

    // Borde interactivo estilo Canva
    ctx.lineWidth = (isHovered || isSelected) ? (2.6 * scaleFactor) : (1.4 * scaleFactor);
    ctx.strokeStyle = isHovered
      ? '#ff334b'
      : (isSelected ? '#ff334b' : 'rgba(24, 24, 27, 0.18)');
    ctx.setLineDash((isHovered || isSelected) ? [] : [6 * scaleFactor, 4 * scaleFactor]);
    drawRoundedRect(ctx, left, top, w, h, r);
    ctx.stroke();
    ctx.setLineDash([]);

    // Ilustración minimalista de paisaje/foto estilo Canva en el centro del hueco
    const minSide = Math.min(w, h);
    const iconSize = Math.max(18 * scaleFactor, Math.min(38 * scaleFactor, minSide * 0.18));
    const iconY = cy - (h > 130 * scaleFactor ? (14 * scaleFactor) : 0);

    // Círculo blanco contenedor del icono
    ctx.beginPath();
    ctx.arc(cx, iconY, iconSize * 0.72, 0, Math.PI * 2);
    ctx.fillStyle = isHovered ? '#ff334b' : 'rgba(255, 255, 255, 0.92)';
    ctx.fill();
    ctx.lineWidth = 1.4 * scaleFactor;
    ctx.strokeStyle = isHovered ? '#ff334b' : 'rgba(255, 51, 75, 0.45)';
    ctx.stroke();

    // Signo + nítido dentro del círculo
    const plusR = iconSize * 0.30;
    ctx.beginPath();
    ctx.moveTo(cx - plusR, iconY);
    ctx.lineTo(cx + plusR, iconY);
    ctx.moveTo(cx, iconY - plusR);
    ctx.lineTo(cx, iconY + plusR);
    ctx.lineWidth = 2.2 * scaleFactor;
    ctx.strokeStyle = isHovered ? '#ffffff' : '#ff334b';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Pastilla con el número de hueco en la esquina superior izquierda del hueco
    const numStr = `#${slot.slotNumber || ''}`;
    const pillW = Math.max(24 * scaleFactor, 26 * scaleFactor);
    const pillH = 18 * scaleFactor;
    const pillX = left + 8 * scaleFactor;
    const pillY = top + 8 * scaleFactor;
    if (w > 60 * scaleFactor && h > 55 * scaleFactor) {
      drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 5 * scaleFactor);
      ctx.fillStyle = (isHovered || isSelected) ? '#ff334b' : 'rgba(24, 24, 27, 0.65)';
      ctx.fill();
      ctx.font = `700 ${Math.max(8, Math.round(9.5 * scaleFactor))}px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(numStr, pillX + pillW * 0.5, pillY + pillH * 0.5);
    }

    // Etiqueta del hueco debajo del icono
    if (h > 95 * scaleFactor && w > 85 * scaleFactor) {
      ctx.font = `600 ${Math.max(9, Math.round(10.5 * scaleFactor))}px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif`;
      ctx.fillStyle = isHovered ? '#ff334b' : 'rgba(24, 24, 27, 0.72)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const labelText = isHovered ? '¡Soltar foto aquí!' : (slot.label || 'Añadir foto');
      // Recortar texto si el hueco es estrecho
      const maxChars = Math.max(8, Math.floor(w / (6.2 * scaleFactor)));
      const shortLabel = labelText.length > maxChars ? (labelText.slice(0, maxChars - 1) + '…') : labelText;
      ctx.fillText(shortLabel, cx, iconY + iconSize * 0.72 + 13 * scaleFactor);

      if (h > 150 * scaleFactor && w > 120 * scaleFactor) {
        ctx.font = `500 ${Math.max(8, Math.round(9 * scaleFactor))}px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif`;
        ctx.fillStyle = 'rgba(24, 24, 27, 0.45)';
        ctx.fillText('Arrastra o haz clic', cx, iconY + iconSize * 0.72 + 27 * scaleFactor);
      }
    }

    ctx.restore();
  }

  /**
   * Dibuja los textos editoriales de la plantilla activa (portadas "Emily & Marco", fechas, etc.)
   */
  function drawTemplateTexts(ctx, texts, cellW, cellH, scaleFactor = 1.0) {
    if (!texts || texts.length === 0) return;
    ctx.save();
    for (const t of texts) {
      if (!t.text) continue;
      const tx = t.xNorm * cellW;
      const ty = t.yNorm * cellH;
      // Escalar el tamaño de fuente según scaleFactor
      const scaledFont = (t.font || '400 24px Georgia, serif').replace(/(\d+(?:\.\d+)?)px/, (_, sz) => {
        return `${Math.round(parseFloat(sz) * scaleFactor)}px`;
      });
      ctx.font = scaledFont;
      ctx.fillStyle = t.color || '#222222';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.text, tx, ty);
    }
    ctx.restore();
  }

  /**
   * Renderiza una foto individual en el lienzo continuo asegurando encuadre Cover sin distorsión
   */
  function drawSinglePhotoItem(targetCtx, photo, photoIndex, fallbackPhotoCanvas, options = {}) {
    if (!photo) return;
    const scaleFactor = (options.baseHeight || 1200) / 1200;

    // Determinar la fuente de imagen correcta:
    // SOLO usar fallbackPhotoCanvas (pipeline.canvas) si la foto pertenece a la foto activa en WebGL2
    let pSource = photo.renderedCanvas || photo.canvas || photo.img;
    if (
      fallbackPhotoCanvas &&
      fallbackPhotoCanvas.width > 0 &&
      fallbackPhotoCanvas.height > 0 &&
      options.activeSourcePhotoId &&
      photo.sourcePhotoId === options.activeSourcePhotoId
    ) {
      pSource = fallbackPhotoCanvas;
      photo.renderedCanvas = fallbackPhotoCanvas;
    } else if (
      fallbackPhotoCanvas &&
      fallbackPhotoCanvas.width > 0 &&
      fallbackPhotoCanvas.height > 0 &&
      !options.activeSourcePhotoId &&
      !photo.sourcePhotoId &&
      photoIndex === state.selectedPhotoIndex &&
      state.photos.length === 1
    ) {
      pSource = fallbackPhotoCanvas;
    }

    if (!pSource || !pSource.width || !pSource.height || pSource.width <= 0 || pSource.height <= 0) return;

    const pw = pSource.width;
    const ph = pSource.height;

    // Si las dimensiones de la fuente cambiaron (por ejemplo tras aplicar un marco o rotación),
    // re-sincronizar con la caja del marco para que NUNCA se deforme
    if (photo.naturalWidth !== pw || photo.naturalHeight !== ph) {
      const bb = getPhotoBoundingBox(photo);
      fitPhotoToFrameBox(photo, bb.width, bb.height, pSource);
    }

    const crop = photo.crop || { x: 0.0, y: 0.0, w: 1.0, h: 1.0 };
    const safeCropX = Math.max(0.0, Math.min(0.99, Number(crop.x) || 0.0));
    const safeCropY = Math.max(0.0, Math.min(0.99, Number(crop.y) || 0.0));
    const safeCropW = Math.max(0.01, Math.min(1.0 - safeCropX, Number(crop.w) || 1.0));
    const safeCropH = Math.max(0.01, Math.min(1.0 - safeCropY, Number(crop.h) || 1.0));

    const sx = Math.max(0, Math.min(pw - 1, Math.round(safeCropX * pw)));
    const sy = Math.max(0, Math.min(ph - 1, Math.round(safeCropY * ph)));
    const sw = Math.max(1, Math.min(pw - sx, Math.round(safeCropW * pw)));
    const sh = Math.max(1, Math.min(ph - sy, Math.round(safeCropH * ph)));

    const posX = (typeof photo.x === 'number' && !isNaN(photo.x)) ? (photo.x * scaleFactor) : 0;
    const posY = (typeof photo.y === 'number' && !isNaN(photo.y)) ? (photo.y * scaleFactor) : 0;
    const safeScale = Math.max(0.05, Math.min(10.0, Number(photo.scale) || 1.0));
    const safeWidth = Math.max(10, Number(photo.width) || 1200);
    const safeHeight = Math.max(10, Number(photo.height) || 1200);
    const drawW = Math.max(1, Math.round(safeWidth * safeCropW * safeScale * scaleFactor));
    const drawH = Math.max(1, Math.round(safeHeight * safeCropH * safeScale * scaleFactor));

    // Si esta foto está en Modo Encuadre Interno activo (solo en vista interactiva)
    if (!options.forExport && photo.isCropMode && photoIndex === state.selectedPhotoIndex) {
      const fullW = Math.max(1, Math.round(safeWidth * safeScale * scaleFactor));
      const fullH = Math.max(1, Math.round(safeHeight * safeScale * scaleFactor));
      const cropLeft = posX - drawW * 0.5;
      const cropTop = posY - drawH * 0.5;
      const fullLeft = cropLeft - safeCropX * fullW;
      const fullTop = cropTop - safeCropY * fullH;

      try {
        targetCtx.save();
        targetCtx.globalAlpha = 0.35;
        targetCtx.drawImage(pSource, fullLeft, fullTop, fullW, fullH);
        targetCtx.restore();

        targetCtx.save();
        targetCtx.fillStyle = 'rgba(15, 15, 18, 0.45)';
        targetCtx.fillRect(fullLeft, fullTop, fullW, Math.max(0, cropTop - fullTop));
        targetCtx.fillRect(fullLeft, cropTop + drawH, fullW, Math.max(0, (fullTop + fullH) - (cropTop + drawH)));
        targetCtx.fillRect(fullLeft, cropTop, Math.max(0, cropLeft - fullLeft), drawH);
        targetCtx.fillRect(cropLeft + drawW, cropTop, Math.max(0, (fullLeft + fullW) - (cropLeft + drawW)), drawH);
        targetCtx.restore();
      } catch (eCrop) {
        if (typeof console !== 'undefined' && console.warn) console.warn('Error en dibujo de recorte:', eCrop);
      }
    }

    try {
      targetCtx.save();
      targetCtx.translate(posX, posY);
      if (photo.rotation) {
        targetCtx.rotate((photo.rotation * Math.PI) / 180);
      }

      targetCtx.drawImage(pSource, sx, sy, sw, sh, -drawW * 0.5, -drawH * 0.5, drawW, drawH);

      // Si el hueco tiene un marco pictórico (ej. cuadro enmarcado en Carousel #5)
      if (photo.frameBorder) {
        targetCtx.lineWidth = Math.max(2, 6 * scaleFactor);
        targetCtx.strokeStyle = photo.frameBorder;
        targetCtx.strokeRect(-drawW * 0.5, -drawH * 0.5, drawW, drawH);
      }

      targetCtx.restore();
    } catch (eDraw) {
      if (typeof console !== 'undefined' && console.warn) console.warn(`Error dibujando foto ${photoIndex + 1}:`, eDraw);
    }

    // Resaltar borde hover tipo Canva cuando se arrastra otra foto encima de un hueco ocupado
    if (!options.forExport && photo.slotId && state.hoveredSlotId === photo.slotId) {
      targetCtx.save();
      const bb = getPhotoBoundingBox(photo);
      targetCtx.lineWidth = 3.5 * scaleFactor;
      targetCtx.strokeStyle = '#ff334b';
      targetCtx.fillStyle = 'rgba(255, 51, 75, 0.18)';
      targetCtx.fillRect(bb.left * scaleFactor, bb.top * scaleFactor, bb.width * scaleFactor, bb.height * scaleFactor);
      targetCtx.strokeRect(bb.left * scaleFactor, bb.top * scaleFactor, bb.width * scaleFactor, bb.height * scaleFactor);
      targetCtx.restore();
    }
  }

  /**
   * Renderiza la tira completa del carrusel en el lienzo de destino
   */
  function renderCarouselStrip(targetCtx, fallbackPhotoCanvas, options = {}) {
    const baseH = options.baseHeight || 1200;
    const { totalW, totalH, cellW, cellH, slideCount } = getStripDimensions(baseH);
    const scaleFactor = baseH / 1200;

    const canvas = targetCtx.canvas;
    if (canvas.width !== totalW || canvas.height !== totalH) {
      canvas.width = totalW;
      canvas.height = totalH;
    }

    // Fondo limpio de estudio: Blanco puro
    targetCtx.clearRect(0, 0, totalW, totalH);
    targetCtx.fillStyle = '#ffffff';
    targetCtx.fillRect(0, 0, totalW, totalH);

    // =========================================================================
    // MODO 1: PANORÁMICA CONTINUA FLUIDA
    // =========================================================================
    if (state.mode === 'seamless') {
      const source = (state.photos.length > 0 && state.photos[0].canvas) ? state.photos[0].canvas : fallbackPhotoCanvas;
      if (source && source.width > 0) {
        const pw = source.width;
        const ph = source.height;

        const baseScale = Math.max(totalW / pw, totalH / ph);
        const scale = baseScale * state.seamlessZoom;
        const drawW = pw * scale;
        const drawH = ph * scale;

        const maxShiftX = Math.max(0, drawW - totalW);
        const shiftX = (state.seamlessPanX * maxShiftX * 0.5);
        const drawX = (totalW - drawW) * 0.5 + shiftX;
        const drawY = (totalH - drawH) * 0.5;

        targetCtx.drawImage(source, drawX, drawY, drawW, drawH);
      }
    }
    // =========================================================================
    // MODO 2: ESTUDIO DE MARCOS Y CAPAS ESTILO CANVA
    // =========================================================================
    else {
      // Construir cola de renderizado unificada ordenada por zIndex para que los huecos vacíos superpuestos
      // (ej. insets encima de fondos) se pinten ENCIMA de las fotos de fondo
      const renderQueue = [];

      // 1. Huecos vacíos (solo en vista interactiva, NUNCA en exportación)
      if (!options.forExport && state.activeTemplateId && state.templateSlots && state.templateSlots.length > 0) {
        for (let i = 0; i < state.templateSlots.length; i++) {
          const slot = state.templateSlots[i];
          const hasPhoto = slot.photoId && state.photos.some(p => p.id === slot.photoId);
          if (!hasPhoto) {
            renderQueue.push({
              type: 'slot',
              zIndex: (typeof slot.zIndex === 'number') ? slot.zIndex : 1,
              order: i,
              slot
            });
          }
        }
      }

      // 2. Fotografías reales colocadas
      for (let i = 0; i < state.photos.length; i++) {
        const photo = state.photos[i];
        if (!photo) continue;
        renderQueue.push({
          type: 'photo',
          zIndex: (typeof photo.zIndex === 'number') ? photo.zIndex : (i + 1),
          order: 100 + i,
          photo,
          photoIndex: i
        });
      }

      renderQueue.sort((a, b) => {
        if (a.zIndex !== b.zIndex) return a.zIndex - b.zIndex;
        return a.order - b.order;
      });

      for (const item of renderQueue) {
        if (item.type === 'slot') {
          drawSingleEmptySlot(targetCtx, item.slot, cellW, cellH, scaleFactor);
        } else if (item.type === 'photo') {
          drawSinglePhotoItem(targetCtx, item.photo, item.photoIndex, fallbackPhotoCanvas, options);
        }
      }

      // 3. Controles de selección de la foto activa (solo en vista interactiva)
      if (!options.forExport && state.selectedPhotoIndex >= 0 && state.photos[state.selectedPhotoIndex]) {
        try {
          drawActivePhotoSelection(targetCtx, state.photos[state.selectedPhotoIndex]);
        } catch (eSel) {
          if (typeof console !== 'undefined' && console.warn) console.warn('Error dibujando selección:', eSel);
        }
      }
    }

    // =========================================================================
    // GUÍAS MAGNÉTICAS DE ALINEADO Y LÍNEAS DE CORTE DE DIAPOSITIVAS
    // =========================================================================
    if (!options.forExport) {
      if (state.showGuidelines) {
        drawSlideDivisionLines(targetCtx, totalW, totalH, cellW, slideCount);
      }
      if (state.activeGuides && state.activeGuides.length > 0) {
        drawMagneticGuides(targetCtx, state.activeGuides, totalW, totalH);
      }
      if (state.activeAlignmentNotice) {
        drawAlignmentNoticeHUD(targetCtx, state.activeAlignmentNotice, totalW, totalH);
      }
    }
  }

  /**
   * Dibuja una miniatura de previsualización de cualquier plantilla en un canvas pequeño (para el menú lateral)
   */
  function renderTemplatePreviewCanvas(canvas, templateId) {
    if (!canvas) return;
    const tmpl = TEMPLATES[templateId];
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (!tmpl) {
      // Modo libre
      ctx.fillStyle = '#f8f7f4';
      ctx.fillRect(0, 0, w, h);
      return;
    }

    const slideCount = tmpl.slideCount;
    const cellW = w / slideCount;
    const cellH = h;

    // Fondo blanco de las diapositivas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // Ordenar huecos por zIndex
    const slots = [...tmpl.slots].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

    // Paleta de tonos editoriales cálidos para que la miniatura se vea como las capturas
    const tones = ['#d9d2c7', '#c7beb2', '#e3ddd3', '#b8afa2', '#cfc7bc', '#ded8ce'];

    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      const sx = (s.xNorm - s.wNorm * 0.5) * cellW;
      const sy = (s.yNorm - s.hNorm * 0.5) * cellH;
      const sw = s.wNorm * cellW;
      const sh = s.hNorm * cellH;

      ctx.save();
      ctx.fillStyle = s.isBackground ? '#ece7df' : tones[i % tones.length];
      ctx.fillRect(sx, sy, sw, sh);
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = '#ffffff';
      ctx.strokeRect(sx, sy, sw, sh);
      ctx.restore();
    }

    // Líneas divisorias de diapositivas
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 51, 75, 0.55)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 2]);
    for (let i = 1; i < slideCount; i++) {
      const x = Math.round(i * cellW) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Dibuja el marco de selección interactivo estilo Canva (4 esquinas + 4 tiradores laterales + barra flotante)
   */
  function drawActivePhotoSelection(ctx, photo) {
    const bb = getPhotoBoundingBox(photo);

    // CASO A: MODO ENCUADRE INTERNO (RECORTE)
    if (photo.isCropMode) {
      ctx.save();

      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ff334b';
      ctx.setLineDash([]);
      ctx.strokeRect(bb.left, bb.top, bb.width, bb.height);

      // Cuadrícula de tercios
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.setLineDash([5, 4]);
      const oneThirdH = bb.height / 3;
      const oneThirdW = bb.width / 3;
      ctx.beginPath();
      ctx.moveTo(bb.left, bb.top + oneThirdH);
      ctx.lineTo(bb.right, bb.top + oneThirdH);
      ctx.moveTo(bb.left, bb.top + oneThirdH * 2);
      ctx.lineTo(bb.right, bb.top + oneThirdH * 2);
      ctx.moveTo(bb.left + oneThirdW, bb.top);
      ctx.lineTo(bb.left + oneThirdW, bb.bottom);
      ctx.moveTo(bb.left + oneThirdW * 2, bb.top);
      ctx.lineTo(bb.left + oneThirdW * 2, bb.bottom);
      ctx.stroke();

      ctx.setLineDash([]);
      const bracketLen = Math.min(24, Math.min(bb.width, bb.height) * 0.35);
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#ffffff';
      ctx.lineCap = 'square';
      drawCornerBrackets(ctx, bb, bracketLen);
      ctx.lineWidth = 2.8;
      ctx.strokeStyle = '#ff334b';
      drawCornerBrackets(ctx, bb, bracketLen);

      const btnH = 28;
      const doneW = 96;
      const resetW = 104;
      const gap = 8;
      const totalBarW = doneW + resetW + gap;
      const startX = photo.x - totalBarW * 0.5;
      const barY = Math.max(14, bb.top - btnH - 12);

      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;

      drawRoundedRect(ctx, startX, barY, doneW, btnH, 8);
      ctx.fillStyle = '#ff334b';
      ctx.fill();

      drawRoundedRect(ctx, startX + doneW + gap, barY, resetW, btnH, 8);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.stroke();

      ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('✓ Listo', startX + doneW * 0.5, barY + btnH * 0.5);
      ctx.fillStyle = '#18181b';
      ctx.fillText('↺ Restablecer', startX + doneW + gap + resetW * 0.5, barY + btnH * 0.5);

      ctx.restore();
      return;
    }

    // CASO B: SELECCIÓN ESTILO CANVA (MARCO CONTINUO + 4 ESQUINAS CIRCULARES + 4 PASTILLAS LATERALES)
    ctx.save();

    // 1. Marco continuo nítido estilo Canva
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#ff334b';
    ctx.setLineDash([]);
    ctx.strokeRect(bb.left, bb.top, bb.width, bb.height);

    // 2. 4 Tiradores laterales tipo pastilla (Left, Right, Top, Bottom) para reajustar caja con Auto-Cover
    const pillLong = 18;
    const pillShort = 6;
    const sideHandles = [
      { x: bb.left - pillShort * 0.5, y: bb.centerY - pillLong * 0.5, w: pillShort, h: pillLong },
      { x: bb.right - pillShort * 0.5, y: bb.centerY - pillLong * 0.5, w: pillShort, h: pillLong },
      { x: bb.centerX - pillLong * 0.5, y: bb.top - pillShort * 0.5, w: pillLong, h: pillShort },
      { x: bb.centerX - pillLong * 0.5, y: bb.bottom - pillShort * 0.5, w: pillLong, h: pillShort }
    ];

    for (const sh of sideHandles) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1;
      drawRoundedRect(ctx, sh.x, sh.y, sh.w, sh.h, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = '#ff334b';
      ctx.stroke();
    }

    // 3. 4 Manijas circulares en las esquinas
    const handleRadius = 7.5;
    const corners = [
      [bb.left, bb.top],
      [bb.right, bb.top],
      [bb.left, bb.bottom],
      [bb.right, bb.bottom]
    ];

    for (const [cx, cy] of corners) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.30)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetY = 2;

      ctx.beginPath();
      ctx.arc(cx, cy, handleRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = '#ff334b';
      ctx.stroke();
    }

    // 4. Barra flotante superior: [Nombre] + [✂ Encuadrar]
    const badgeH = 26;
    const nameW = 92;
    const cropBtnW = 96;
    const badgeGap = 6;
    const totalTopW = nameW + cropBtnW + badgeGap;
    const topBarX = photo.x - totalTopW * 0.5;
    const topBarY = Math.max(12, bb.top - badgeH - 10);

    drawRoundedRect(ctx, topBarX, topBarY, nameW, badgeH, 7);
    ctx.fillStyle = 'rgba(20, 20, 24, 0.90)';
    ctx.fill();

    ctx.font = '700 10.5px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(photo.fileName ? photo.fileName.slice(0, 11) : 'MARCO', topBarX + nameW * 0.5, topBarY + badgeH * 0.5);

    ctx.shadowColor = 'rgba(255, 51, 75, 0.40)';
    ctx.shadowBlur = 8;
    drawRoundedRect(ctx, topBarX + nameW + badgeGap, topBarY, cropBtnW, badgeH, 7);
    ctx.fillStyle = '#ff334b';
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('✂ Encuadrar', topBarX + nameW + badgeGap + cropBtnW * 0.5, topBarY + badgeH * 0.5);

    ctx.restore();
  }

  function drawCornerBrackets(ctx, bb, len) {
    ctx.beginPath();
    ctx.moveTo(bb.left, bb.top + len);
    ctx.lineTo(bb.left, bb.top);
    ctx.lineTo(bb.left + len, bb.top);
    ctx.moveTo(bb.right - len, bb.top);
    ctx.lineTo(bb.right, bb.top);
    ctx.lineTo(bb.right, bb.top + len);
    ctx.moveTo(bb.left, bb.bottom - len);
    ctx.lineTo(bb.left, bb.bottom);
    ctx.lineTo(bb.left + len, bb.bottom);
    ctx.moveTo(bb.right - len, bb.bottom);
    ctx.lineTo(bb.right, bb.bottom);
    ctx.lineTo(bb.right, bb.bottom - len);
    ctx.stroke();
  }

  function drawSlideDivisionLines(ctx, totalW, totalH, cellW, slideCount) {
    ctx.save();
    for (let i = 0; i < slideCount; i++) {
      const cellX = i * cellW;

      if (i > 0) {
        ctx.beginPath();
        ctx.setLineDash([8, 6]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255, 51, 75, 0.70)';
        ctx.moveTo(cellX, 0);
        ctx.lineTo(cellX, totalH);
        ctx.stroke();
      }

      // Pastilla numerada de diapositiva (DIAP. 1/N)
      const badgeW = 82;
      const badgeH = 24;
      const bx = cellX + 14;
      const by = 14;

      ctx.setLineDash([]);
      drawRoundedRect(ctx, bx, by, badgeW, badgeH, 7);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = 'rgba(255, 51, 75, 0.75)';
      ctx.stroke();

      ctx.font = '700 10.5px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
      ctx.fillStyle = '#18181b';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`DIAP. ${i + 1}/${slideCount}`, bx + badgeW * 0.5, by + badgeH * 0.5);
    }
    ctx.restore();
  }

  function drawMagneticGuides(ctx, guides, totalW, totalH) {
    ctx.save();
    for (const g of guides) {
      ctx.beginPath();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = '#ff334b';
      ctx.shadowColor = 'rgba(255, 51, 75, 0.7)';
      ctx.shadowBlur = 8;
      ctx.setLineDash([4, 3]);

      if (g.type === 'v') {
        ctx.moveTo(g.x, 0);
        ctx.lineTo(g.x, totalH);
        ctx.stroke();
      } else if (g.type === 'h') {
        ctx.moveTo(0, g.y);
        ctx.lineTo(totalW, g.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawAlignmentNoticeHUD(ctx, noticeText, totalW, totalH) {
    ctx.save();
    ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
    const textMetrics = ctx.measureText(noticeText);
    const pillW = Math.max(160, textMetrics.width + 36);
    const pillH = 32;
    const px = (totalW - pillW) * 0.5;
    const py = 20;

    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 6;

    drawRoundedRect(ctx, px, py, pillW, pillH, 16);
    ctx.fillStyle = 'rgba(20, 20, 24, 0.95)';
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ff334b';
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(noticeText, px + pillW * 0.5, py + pillH * 0.5);
    ctx.restore();
  }

  /**
   * Exporta cada celda cortada del carrusel en alta resolución nativa
   */
  async function exportCarouselSlices(fallbackPhotoCanvas, onProgress, onDone, options = {}) {
    const r = getRatioInfo();
    const cellW = r.exportW;
    const cellH = r.exportH;
    const totalW = cellW * state.slideCount;
    const totalH = cellH;

    const stripCanvas = document.createElement('canvas');
    stripCanvas.width = totalW;
    stripCanvas.height = totalH;
    const stripCtx = stripCanvas.getContext('2d');

    renderCarouselStrip(stripCtx, fallbackPhotoCanvas, {
      baseHeight: cellH,
      forExport: true,
      activeSourcePhotoId: options.activeSourcePhotoId || null
    });

    const slices = [];
    for (let i = 0; i < state.slideCount; i++) {
      if (onProgress) onProgress(i + 1, state.slideCount);

      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = cellW;
      sliceCanvas.height = cellH;
      const sliceCtx = sliceCanvas.getContext('2d');

      const srcX = i * cellW;
      sliceCtx.drawImage(
        stripCanvas,
        srcX, 0, cellW, cellH,
        0, 0, cellW, cellH
      );

      const blob = await new Promise(res => sliceCanvas.toBlob(res, 'image/jpeg', 0.96));
      const numStr = String(i + 1).padStart(2, '0');
      const filename = `muchoFILM_Carrusel_${r.w}x${r.h}_${numStr}.jpg`;

      slices.push({ blob, filename, width: cellW, height: cellH, index: i + 1 });
      await new Promise(r => setTimeout(r, 60));
    }

    if (onDone) onDone(slices);
    return slices;
  }

  /**
   * Serializa el estado completo del carrusel (plantilla, huecos, fotos, recortes, posiciones, capas)
   * para permitir Deshacer (Cmd+Z) y Rehacer (Cmd+Shift+Z) instantáneo en cualquier acción.
   */
  function serializeState() {
    return {
      activeTemplateId: state.activeTemplateId,
      ratioKey: state.ratioKey,
      slideCount: state.slideCount,
      mode: state.mode,
      seamlessPanX: state.seamlessPanX,
      seamlessZoom: state.seamlessZoom,
      selectedPhotoIndex: state.selectedPhotoIndex,
      selectedSlotId: state.selectedSlotId,
      showGuidelines: state.showGuidelines,
      magneticSnapEnabled: state.magneticSnapEnabled,
      templateSlots: (state.templateSlots || []).map(s => ({ ...s })),
      photos: (state.photos || []).map(p => ({
        id: p.id,
        sourcePhotoId: p.sourcePhotoId || null,
        fileName: p.fileName,
        x: p.x,
        y: p.y,
        width: p.width,
        height: p.height,
        boxW: p.boxW,
        boxH: p.boxH,
        naturalWidth: p.naturalWidth,
        naturalHeight: p.naturalHeight,
        scale: p.scale,
        innerZoom: p.innerZoom,
        rotation: p.rotation,
        crop: p.crop ? { ...p.crop } : { x: 0, y: 0, w: 1, h: 1 },
        isCropMode: !!p.isCropMode,
        locked: !!p.locked,
        aspect: p.aspect,
        zIndex: p.zIndex,
        slotId: p.slotId || null,
        frameBorder: p.frameBorder || null,
        _canvasRef: p.canvas || null,
        _imgRef: p.img || null,
        _renderedCanvasRef: p.renderedCanvas || null,
        _floatDataRef: p.floatData || null
      }))
    };
  }

  /**
   * Restaura una instantánea serializada del carrusel
   */
  function restoreState(snap, loadedPhotos = []) {
    if (!snap) return;
    state.activeTemplateId = snap.activeTemplateId || null;
    state.ratioKey = snap.ratioKey || '4:5';
    state.slideCount = snap.slideCount || 3;
    state.mode = snap.mode || 'multi';
    state.seamlessPanX = snap.seamlessPanX || 0;
    state.seamlessZoom = snap.seamlessZoom || 1.0;
    state.selectedPhotoIndex = (typeof snap.selectedPhotoIndex === 'number') ? snap.selectedPhotoIndex : -1;
    state.selectedSlotId = snap.selectedSlotId || null;
    if (typeof snap.showGuidelines === 'boolean') state.showGuidelines = snap.showGuidelines;
    if (typeof snap.magneticSnapEnabled === 'boolean') state.magneticSnapEnabled = snap.magneticSnapEnabled;
    state.templateSlots = (snap.templateSlots || []).map(s => ({ ...s }));
    state.templateTexts = [];
    state.activeGuides = [];
    state.activeAlignmentNotice = '';

    state.photos = (snap.photos || []).map(p => {
      const matchLoaded = (loadedPhotos || []).find(lp =>
        (p.sourcePhotoId && lp.id === p.sourcePhotoId) || (p.fileName && lp.fileName === p.fileName)
      );
      const cRef = p._canvasRef || (matchLoaded ? matchLoaded.canvas : null);
      const rRef = p._renderedCanvasRef || (matchLoaded ? (matchLoaded.renderedCanvas || matchLoaded.canvas) : cRef);
      const fRef = p._floatDataRef || (matchLoaded ? matchLoaded.floatData : null);
      return {
        id: p.id,
        canvas: cRef,
        img: p._imgRef || cRef,
        renderedCanvas: rRef,
        floatData: fRef,
        sourcePhotoId: p.sourcePhotoId || (matchLoaded ? matchLoaded.id : null),
        fileName: p.fileName,
        x: p.x,
        y: p.y,
        width: p.width,
        height: p.height,
        boxW: p.boxW,
        boxH: p.boxH,
        naturalWidth: p.naturalWidth,
        naturalHeight: p.naturalHeight,
        scale: p.scale,
        innerZoom: p.innerZoom || 1.0,
        rotation: p.rotation || 0,
        crop: p.crop ? { ...p.crop } : { x: 0, y: 0, w: 1, h: 1 },
        isCropMode: !!p.isCropMode,
        locked: !!p.locked,
        aspect: p.aspect,
        zIndex: p.zIndex,
        slotId: p.slotId || null,
        frameBorder: p.frameBorder || null
      };
    });

    if (state.selectedPhotoIndex >= state.photos.length) {
      state.selectedPhotoIndex = state.photos.length - 1;
    }
  }

  return {
    state,
    RATIO_VALUES,
    TEMPLATES,
    getRatioInfo,
    getStripDimensions,
    fitPhotoToFrameBox,
    setRatio,
    setSlideCount,
    setMode,
    setSelectedPhoto,
    getSelectedPhoto,
    addPhoto,
    removePhoto,
    clearAllPhotos,
    bringForward,
    sendBackward,
    movePhoto,
    scalePhoto,
    hitTestPhoto,
    getPhotoBoundingBox,
    getPhotoUncroppedBox,
    hitTestPhotoHandle,
    resizePhotoCorner,
    resizeCropHandle,
    panPhotoInCrop,
    setPhotoCrop,
    setPhotoCropRatio,
    resetPhotoCrop,
    togglePhotoCropMode,
    computeMagneticSnapping,
    renderCarouselStrip,
    renderTemplatePreviewCanvas,
    exportCarouselSlices,
    applyTemplate,
    clearTemplateSlots,
    getActiveTemplate,
    getTemplateSlots,
    getSlotById,
    getSlotRect,
    getSlotPixelRect: getSlotRect,
    hitTestSlot,
    assignPhotoToSlot,
    autoFillSlots,
    serializeState,
    restoreState
  };
})();
