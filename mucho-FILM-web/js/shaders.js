/**
 * mucho FILM — Motor de Renderizado WebGL2 en Coma Flotante (Edición Roja)
 * Correcciones críticas:
 * 1. Orientación vertical íntegra: eliminación del volteo invertido en el encadenamiento FBO Multipaso.
 * 2. Enderezado euclídeo isótropo: rotación sin cizallamiento ni deformación de aspecto.
 * 3. Shutter Drag de 48 muestras con preservación de sujeto y grano analógico orgánico.
 */

window.WebGLPipeline = (function () {
  'use strict';

  const VERTEX_SHADER_SRC = `#version 300 es
  precision highp float;
  layout(location = 0) in vec2 a_position;
  layout(location = 1) in vec2 a_texCoord;
  out vec2 v_uv;

  void main() {
    v_uv = a_texCoord;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
  `;

  const PASS1_FRAGMENT_SHADER_SRC = `#version 300 es
  precision highp float;

  in vec2 v_uv;
  out vec4 outColor;

  uniform sampler2D u_imageTex;
  uniform vec2 u_texSize;

  // Geometría y Recorte
  uniform vec4 u_cropRect;         // x, y, w, h en [0..1]
  uniform int u_rotateSteps;       // 0=0°, 1=90° CW, 2=180°, 3=270° CW
  uniform float u_straightenRad;   // Ángulo en radianes
  uniform vec2 u_flip;             // (flipX, flipY), valores 1.0 o -1.0

  // Ajustes Básicos
  uniform float u_exposure;        // -3.0 a +3.0 EV
  uniform float u_brightness;      // -1.0 a +1.0
  uniform float u_contrast;        // -1.0 a +1.0
  uniform float u_highlights;      // -1.0 a +1.0
  uniform float u_shadows;         // -1.0 a +1.0
  uniform float u_whites;          // -1.0 a +1.0
  uniform float u_blacks;          // -1.0 a +1.0
  uniform float u_sharpenAmount;   // 0.0 a 1.0
  uniform float u_saturation;      // -1.0 a +1.0
  uniform float u_vibrance;        // -1.0 a +1.0
  uniform float u_temperature;     // -1.0 a +1.0
  uniform float u_tint;            // -1.0 a +1.0
  uniform float u_clarity;         // -1.0 a +1.0
  uniform float u_shadowFade;      // 0.0 a 0.25 (desvanecimiento de negros)
  uniform float u_highlightRollOff;// 0.70 a 1.0 (Creamy ivory whites roll-off)
  uniform vec3  u_channelCurve;    // Ajuste tonal de canal en sombras (R, G, B)
  uniform vec4  u_bwMixer;         // Mezclador B&W
  uniform int   u_isBlackAndWhite; // 0 o 1
  uniform vec3  u_hslReds;         // (hue, sat, lum)
  uniform vec3  u_hslOranges;      // (hue, sat, lum)
  uniform vec3  u_hslYellows;      // (hue, sat, lum)
  uniform vec3  u_hslGreens;       // (hue, sat, lum)
  uniform vec3  u_hslAquas;        // (hue, sat, lum)
  uniform vec3  u_hslBlues;        // (hue, sat, lum)
  uniform vec3  u_calibRed;        // (hue, sat, 0)
  uniform vec3  u_calibGreen;      // (hue, sat, 0)
  uniform vec3  u_calibBlue;       // (hue, sat, 0)

  uniform int u_bypassAll;

  float getLuma(vec3 c) {
    return dot(c, vec3(0.2126, 0.7152, 0.0722));
  }

  vec3 rgb2hsl(vec3 c) {
    float maxVal = max(c.r, max(c.g, c.b));
    float minVal = min(c.r, min(c.g, c.b));
    float delta = maxVal - minVal;
    float l = (maxVal + minVal) * 0.5;
    float s = 0.0;
    float h = 0.0;
    if (delta > 0.0001) {
      s = l < 0.5 ? delta / (maxVal + minVal) : delta / (2.0 - maxVal - minVal);
      if (maxVal == c.r) {
        h = (c.g - c.b) / delta + (c.g < c.b ? 6.0 : 0.0);
      } else if (maxVal == c.g) {
        h = (c.b - c.r) / delta + 2.0;
      } else {
        h = (c.r - c.g) / delta + 4.0;
      }
      h /= 6.0;
    }
    return vec3(h, s, l);
  }

  float hue2rgb(float p, float q, float t) {
    float tc = t;
    if (tc < 0.0) tc += 1.0;
    if (tc > 1.0) tc -= 1.0;
    if (tc < 1.0 / 6.0) return p + (q - p) * 6.0 * tc;
    if (tc < 1.0 / 2.0) return q;
    if (tc < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - tc) * 6.0;
    return p;
  }

  vec3 hsl2rgb(vec3 hsl) {
    float h = hsl.x;
    float s = hsl.y;
    float l = hsl.z;
    if (s <= 0.0001) return vec3(l);
    float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
    float p = 2.0 * l - q;
    return vec3(
      hue2rgb(p, q, h + 1.0 / 3.0),
      hue2rgb(p, q, h),
      hue2rgb(p, q, h - 1.0 / 3.0)
    );
  }

  float hueWeight(float h, float targetH, float width) {
    float d = abs(h - targetH);
    if (d > 0.5) d = 1.0 - d;
    return smoothstep(width, 0.0, d);
  }

  vec2 rotate2D(vec2 p, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
  }

  // Mapeo euclídeo isométrico exacto sin deformación de proporción
  vec2 mapUVToSource(vec2 uv) {
    vec2 cropCenter = u_cropRect.xy + u_cropRect.zw * 0.5;
    vec2 c = u_cropRect.xy + uv * u_cropRect.zw - cropCenter;

    c *= u_flip;

    if (u_rotateSteps == 1) {
      c = vec2(c.y, -c.x);
    } else if (u_rotateSteps == 2) {
      c = vec2(-c.x, -c.y);
    } else if (u_rotateSteps == 3) {
      c = vec2(-c.y, c.x);
    }

    if (abs(u_straightenRad) > 0.0001) {
      float aspect = max(0.01, u_texSize.x / max(1.0, u_texSize.y));
      // 1. Proyectar a coordenadas métricas isótropas (1 px X == 1 px Y)
      vec2 iso = vec2(c.x * aspect, c.y);
      // 2. Rotar rígidamente en el plano euclídeo
      iso = rotate2D(iso, -u_straightenRad);
      // 3. Devolver al espacio UV
      c = vec2(iso.x / aspect, iso.y);

      // 4. Auto-escala para que no aparezcan esquinas vacías al rotar
      float absRad = abs(u_straightenRad);
      float maxAsp = max(aspect, 1.0 / aspect);
      float autoZoom = cos(absRad) + sin(absRad) * maxAsp;
      c = c / autoZoom;
    }

    return clamp(cropCenter + c, 0.0005, 0.9995);
  }

  void main() {
    vec2 srcUV = mapUVToSource(v_uv);
    vec3 rawColor = texture(u_imageTex, srcUV).rgb;

    if (u_bypassAll == 1) {
      outColor = vec4(rawColor, 1.0);
      return;
    }

    vec3 color = rawColor;

    // 1. Nitidez (Unsharp Mask en luminancia para no introducir aberraciones cromáticas)
    if (u_sharpenAmount > 0.001) {
      float srcAspect = u_texSize.x / max(1.0, u_texSize.y);
      float srcDiag = length(vec2(srcAspect, 1.0));
      vec2 texel = vec2(srcDiag / srcAspect, srcDiag) / 2400.0;

      vec3 n1 = texture(u_imageTex, clamp(srcUV + vec2( texel.x,  0.0), 0.001, 0.999)).rgb;
      vec3 n2 = texture(u_imageTex, clamp(srcUV + vec2(-texel.x,  0.0), 0.001, 0.999)).rgb;
      vec3 n3 = texture(u_imageTex, clamp(srcUV + vec2( 0.0,  texel.y), 0.001, 0.999)).rgb;
      vec3 n4 = texture(u_imageTex, clamp(srcUV + vec2( 0.0, -texel.y), 0.001, 0.999)).rgb;
      vec3 avgNeighbor = (n1 + n2 + n3 + n4) * 0.25;

      float origLuma = getLuma(color);
      float blurLuma = getLuma(avgNeighbor);
      float detail = origLuma - blurLuma;
      color = clamp(color + vec3(detail * u_sharpenAmount * 2.2), 0.0, 1.0);
    }

    // 2. Exposición (EV en escala logarítmica con compresión de altas luces fotográfica)
    if (abs(u_exposure) > 0.001) {
      float evGain = exp2(u_exposure);
      // Corrección: faltaban paréntesis y la curva daba valores negativos que hundían
      // las sombras a negro con cualquier cambio de exposición.
      vec3 expCompressed = (1.0 - exp(-color * evGain * 1.15)) / (1.0 - exp(-1.15));
      // La compresión de altas luces entra de forma progresiva para no dar saltos cerca de 0 EV
      float shoulder = 0.45 * clamp(abs(u_exposure), 0.0, 1.0);
      color = clamp(mix(clamp(color * evGain, 0.0, 1.0), expCompressed, shoulder), 0.0, 1.0);
    }

    // 3. Brillo (Elevación suave en tonos medios)
    if (abs(u_brightness) > 0.001) {
      float L = getLuma(color);
      float midMask = sin(clamp(L, 0.0, 1.0) * 3.14159265);
      color = clamp(color + vec3(u_brightness * 0.32 * (0.6 + 0.4 * midMask)), 0.0, 1.0);
    }

    // 4. Sombras y Altas Luces (Recuperación y Densidad Zonal)
    if (abs(u_shadows) > 0.001 || abs(u_highlights) > 0.001) {
      float L = getLuma(color);
      float shadowZone = smoothstep(0.68, 0.0, L);
      float highlightZone = smoothstep(0.32, 1.0, L);

      float shFactor = pow(2.0, -u_shadows * 0.88 * shadowZone);
      color = pow(max(color, vec3(0.0001)), vec3(shFactor));
      color += vec3(u_highlights * 0.28 * highlightZone);
      color = clamp(color, 0.0, 1.0);
    }

    // 4b. Blancos y Negros (Muted dynamic range & Softened black point)
    if (abs(u_whites) > 0.001 || abs(u_blacks) > 0.001) {
      float L = getLuma(color);
      float whiteZone = smoothstep(0.65, 1.0, L);
      float blackZone = smoothstep(0.35, 0.0, L);
      color += vec3(u_whites * 0.22 * whiteZone);
      color += vec3(u_blacks * 0.18 * blackZone);
      color = clamp(color, 0.0, 1.0);
    }

    // 5. Contraste (Curva S fotográfica centrada en gris medio 18%)
    if (abs(u_contrast) > 0.001) {
      float cFactor = 1.0 + u_contrast * 0.85;
      vec3 linContrast = (color - 0.5) * cFactor + 0.5;
      vec3 sCurve = color * color * (3.0 - 2.0 * color);
      color = clamp(mix(linContrast, sCurve, max(0.0, u_contrast * 0.45)), 0.0, 1.0);
    }

    // 6. Claridad / Textura (Microcontraste / Look difuso de negativo)
    if (abs(u_clarity) > 0.001) {
      float L = getLuma(color);
      float midMask = 4.0 * L * (1.0 - L);
      float cShift = (L - 0.5) * midMask * u_clarity * 0.35;
      color = clamp(color + vec3(cShift), 0.0, 1.0);
    }

    // 7. Balance de Blancos y Matiz Analógico
    if (abs(u_temperature) > 0.001 || abs(u_tint) > 0.001) {
      vec3 tempShift = vec3(u_temperature * 0.16, u_temperature * 0.05, -u_temperature * 0.18);
      vec3 tintShift = vec3(u_tint * 0.10, -u_tint * 0.16, u_tint * 0.08);
      color = clamp(color + tempShift + tintShift, 0.0, 1.0);
    }

    // 8. Ajustes de Color Selectivos HSL (Rojos, Naranjas/Piel, Amarillos, Verdes, Aquas, Azules)
    if (length(u_hslReds) > 0.001 || length(u_hslOranges) > 0.001 || length(u_hslYellows) > 0.001 || length(u_hslGreens) > 0.001 || length(u_hslAquas) > 0.001 || length(u_hslBlues) > 0.001) {
      vec3 hsl = rgb2hsl(color);
      float h = hsl.x;

      float wRed = hueWeight(h, 0.0, 0.08);
      float wOrange = hueWeight(h, 0.083, 0.075);
      float wYellow = hueWeight(h, 0.166, 0.075);
      float wGreen = hueWeight(h, 0.333, 0.110);
      float wAqua = hueWeight(h, 0.500, 0.090);
      float wBlue = hueWeight(h, 0.600, 0.120);

      float dH = wRed * u_hslReds.x + wOrange * u_hslOranges.x + wYellow * u_hslYellows.x + wGreen * u_hslGreens.x + wAqua * u_hslAquas.x + wBlue * u_hslBlues.x;
      float dS = wRed * u_hslReds.y + wOrange * u_hslOranges.y + wYellow * u_hslYellows.y + wGreen * u_hslGreens.y + wAqua * u_hslAquas.y + wBlue * u_hslBlues.y;
      float dL = wRed * u_hslReds.z + wOrange * u_hslOranges.z + wYellow * u_hslYellows.z + wGreen * u_hslGreens.z + wAqua * u_hslAquas.z + wBlue * u_hslBlues.z;

      hsl.x = fract(hsl.x + dH * 0.12);
      hsl.y = clamp(hsl.y * (1.0 + dS), 0.0, 1.0);
      hsl.z = clamp(hsl.z + dL * 0.22, 0.0, 1.0);
      color = hsl2rgb(hsl);
    }

    // 8b. Calibración de Cámara / Primary Mixer (Red, Green, Blue Primaries)
    if (length(u_calibRed) > 0.001 || length(u_calibGreen) > 0.001 || length(u_calibBlue) > 0.001) {
      float rH = u_calibRed.x * 0.10;
      float rS = u_calibRed.y * 0.20;
      color.g += color.r * rH * 0.35;
      color.b -= color.r * rH * 0.15;
      color.r = mix(getLuma(color), color.r, 1.0 + rS);

      float gH = u_calibGreen.x * 0.10;
      float gS = u_calibGreen.y * 0.20;
      color.r -= color.g * gH * 0.25;
      color.b += color.g * gH * 0.25;
      color.g = mix(getLuma(color), color.g, 1.0 + gS);

      float bH = u_calibBlue.x * 0.10;
      float bS = u_calibBlue.y * 0.20;
      color.r += color.b * bH * 0.25;
      color.g -= color.b * bH * 0.15;
      color.b = mix(getLuma(color), color.b, 1.0 + bS);

      color = clamp(color, 0.0, 1.0);
    }

    // 9. Saturación e Intensidad (Vibrance) con protección de tonos de piel
    if (abs(u_saturation) > 0.001 || abs(u_vibrance) > 0.001) {
      float L = getLuma(color);
      float maxC = max(color.r, max(color.g, color.b));
      float minC = min(color.r, min(color.g, color.b));
      float curSat = (maxC > 0.001) ? (maxC - minC) / maxC : 0.0;
      float vibScale = u_vibrance * (1.0 - curSat * 0.85);
      float satFactor = max(0.0, 1.0 + u_saturation + vibScale);
      color = clamp(mix(vec3(L), color, satFactor), 0.0, 1.0);
    }

    // 10. Mezclador Blanco y Negro
    if (u_isBlackAndWhite == 1) {
      float rw = max(0.01, 0.29 + u_bwMixer.x * 0.40);
      float gw = max(0.01, 0.58 + u_bwMixer.y * 0.40);
      float bw = max(0.01, 0.13 + u_bwMixer.z * 0.40);
      float sumW = rw + gw + bw;
      float bwLuma = dot(color, vec3(rw, gw, bw) / sumW);
      color = vec3(clamp(bwLuma, 0.0, 1.0));
    }

    // 11. Curva de Tonos, Shadow Fade (Matte Black Point), Highlight Roll-off (Creamy Ivory Whites) y Tinte de Canal
    if (u_shadowFade > 0.0001 || u_highlightRollOff < 0.9999 || length(u_channelCurve) > 0.0001) {
      float rollOff = (u_highlightRollOff > 0.01) ? u_highlightRollOff : 1.0;
      color = color * (rollOff - u_shadowFade) + vec3(u_shadowFade);

      if (length(u_channelCurve) > 0.0001) {
        float shadowMask = smoothstep(0.70, 0.0, getLuma(color));
        color = clamp(color + u_channelCurve * shadowMask * 0.18, 0.0, 1.0);
      }
    }

    outColor = vec4(color, 1.0);
  }
  `;

  const OPTICS_FRAGMENT_SHADER_SRC = `#version 300 es
  precision highp float;

  in vec2 v_uv;
  out vec4 outColor;

  uniform sampler2D u_pass1Tex;
  uniform sampler2D u_imageTex;
  uniform vec2 u_texSize;
  uniform float u_aspect;

  // Geometría para vista Antes/Después
  uniform vec4 u_cropRect;
  uniform int u_rotateSteps;
  uniform float u_straightenRad;
  uniform vec2 u_flip;

  // Modos de vista
  uniform int u_bypassAll;
  uniform float u_splitPos;

  // Motor de Movimiento Editorial (Shutter Drag & Motion Blur)
  uniform int u_motionType;          // 0 = Barrido Lineal, 1 = Trepidación Orgánica, 2 = Zoom Drag
  uniform float u_dragLength;        // 0.0 a 1.0
  uniform float u_dragAngleRad;      // 0.0 a 2*PI
  uniform float u_flashFreeze;       // 0.0 a 1.0 (Golpe de Flash / 2ª Cortinilla)
  uniform float u_highlightTrails;   // 0.0 a 1.0 (Estelas luminosas)

  // Zona de Protección / Anclaje
  uniform int u_anchorEnabled;       // 0 o 1
  uniform vec2 u_anchorUV;           // Coordenadas UV [0..1]
  uniform float u_anchorRadius;      // 0.0 a 1.0
  uniform float u_anchorFeather;     // 0.0 a 1.0

  // Grano Analógico Orgánico
  uniform float u_grainAmount;       // 0.0 a 1.0
  uniform float u_grainSize;         // 0.0 a 1.0
  uniform float u_grainRoughness;    // 0.0 a 1.0

  // Suciedad y Polvo Vintage (Dust & Scratches)
  uniform int u_dustEnabled;         // 0 o 1
  uniform float u_dustAmount;        // 0.0 a 1.0 (motas de polvo orgánicas)
  uniform float u_scratchesAmount;   // 0.0 a 1.0 (fibras, pelos y arañazos de arrastre)
  uniform int u_dustInvert;          // 0 = Polvo negro (escáner), 1 = Polvo blanco (diapositivas)

  float getLuma(vec3 c) {
    return dot(c, vec3(0.2126, 0.7152, 0.0722));
  }

  // Corrección crítica de lectura FBO: invertimos Y (1.0 - c.y) para que el FBO se lea exactamente en orden top-down
  vec3 samplePass1(vec2 topDownUV) {
    vec2 c = clamp(topDownUV, vec2(0.0005), vec2(0.9995));
    return texture(u_pass1Tex, vec2(c.x, 1.0 - c.y)).rgb;
  }

  vec2 rotate2D(vec2 p, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
  }

  vec2 mapUVToSource(vec2 uv) {
    vec2 cropCenter = u_cropRect.xy + u_cropRect.zw * 0.5;
    vec2 c = u_cropRect.xy + uv * u_cropRect.zw - cropCenter;
    c *= u_flip;
    if (u_rotateSteps == 1) {
      c = vec2(c.y, -c.x);
    } else if (u_rotateSteps == 2) {
      c = vec2(-c.x, -c.y);
    } else if (u_rotateSteps == 3) {
      c = vec2(-c.y, c.x);
    }
    if (abs(u_straightenRad) > 0.0001) {
      float aspect = max(0.01, u_texSize.x / max(1.0, u_texSize.y));
      vec2 iso = vec2(c.x * aspect, c.y);
      iso = rotate2D(iso, -u_straightenRad);
      c = vec2(iso.x / aspect, iso.y);
      float absRad = abs(u_straightenRad);
      float maxAsp = max(aspect, 1.0 / aspect);
      float autoZoom = cos(absRad) + sin(absRad) * maxAsp;
      c = c / autoZoom;
    }
    return clamp(cropCenter + c, 0.0005, 0.9995);
  }

  float interleavedGradientNoise(vec2 isoPos) {
    vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
    return fract(magic.z * fract(dot(isoPos, magic.xy)));
  }

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float organicGrainIso(vec2 isoUV, float sizeNorm, float roughness, vec2 seedShift) {
    float grainFreq = mix(2400.0, 620.0, clamp(sizeNorm, 0.0, 1.0));
    vec2 p = isoUV * grainFreq + seedShift;
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);

    float a = hash12(i);
    float b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0));
    float d = hash12(i + vec2(1.0, 1.0));
    float n1 = mix(mix(a, b, u.x), mix(c, d, u.x), u.y) - 0.5;

    vec2 p2 = p * 2.17 + vec2(17.3, 31.7);
    vec2 i2 = floor(p2);
    vec2 f2 = fract(p2);
    vec2 u2 = f2 * f2 * (3.0 - 2.0 * f2);
    float n2 = mix(
      mix(hash12(i2), hash12(i2 + vec2(1.0, 0.0)), u2.x),
      mix(hash12(i2 + vec2(0.0, 1.0)), hash12(i2 + vec2(1.0, 1.0)), u2.x),
      u2.y
    ) - 0.5;

    return mix(n1, n1 * 0.65 + n2 * 0.75, clamp(roughness, 0.0, 1.0));
  }

  // Generador fotorrealista de motas de polvo analógico orgánico de escáner y laboratorio
  float filmDustSpecks(vec2 isoUV) {
    float dustAccum = 0.0;

    // 1. CAPA MICRO-POLVO (Micro-specks): motas diminutas y afiladas microscópicas
    vec2 pMicro = isoUV * 880.0;
    vec2 ipM = floor(pMicro);
    vec2 fpM = fract(pMicro);
    float rndM = hash12(ipM + vec2(17.4, 61.9));
    if (rndM > 0.976) {
      vec2 centerM = vec2(hash12(ipM + vec2(3.1, 7.3)), hash12(ipM + vec2(9.2, 4.8)));
      float dM = length(fpM - centerM);
      float rM = 0.08 + hash12(ipM + vec2(1.5, 8.2)) * 0.16;
      float micro = smoothstep(rM, rM * 0.18, dM);
      dustAccum += micro * (0.45 + 0.55 * hash12(ipM + vec2(5.5, 2.2)));
    }

    // 2. CAPA MEDIA (Flakes / Escamas de celulosa orgánicas irregulares, no circulares)
    vec2 pMed = isoUV * 260.0;
    vec2 ipMed = floor(pMed);
    vec2 fpMed = fract(pMed);
    float rndMed = hash12(ipMed + vec2(38.2, 84.1));
    if (rndMed > 0.963) {
      vec2 centerMed = vec2(hash12(ipMed + vec2(6.7, 1.4)), hash12(ipMed + vec2(2.8, 9.5)));
      vec2 rel = fpMed - centerMed;
      float ang = atan(rel.y, rel.x);

      // Perturbación armónica del contorno: genera lajas y bordes dentados naturales de polvo
      float p1 = hash12(ipMed + vec2(11.2, 33.4));
      float p2 = hash12(ipMed + vec2(44.5, 77.8));
      float contourPerturb = sin(ang * 3.0 + p1 * 6.28) * 0.28
                           + cos(ang * 5.0 - p2 * 6.28) * 0.18
                           + sin(ang * 7.0 + p1 * 3.14) * 0.10;
      float deformedDist = length(rel) * (1.0 + contourPerturb);

      float rMed = 0.07 + hash12(ipMed + vec2(13.1, 27.6)) * 0.15;
      float flake = smoothstep(rMed, rMed * 0.32, deformedDist);
      float density = 0.55 + 0.45 * hash12(ipMed + vec2(8.9, 14.3));
      dustAccum += flake * density;
    }

    // 3. CAPA OCASIONAL (Macro-debris / Motas grandes con núcleo y borde traslúcido)
    vec2 pMac = isoUV * 95.0;
    vec2 ipMac = floor(pMac);
    vec2 fpMac = fract(pMac);
    float rndMac = hash12(ipMac + vec2(71.9, 13.5));
    if (rndMac > 0.982) {
      vec2 centerMac = vec2(hash12(ipMac + vec2(4.3, 8.1)), hash12(ipMac + vec2(7.2, 3.4)));
      vec2 relM = fpMac - centerMac;
      float angM = atan(relM.y, relM.x);
      float contourM = sin(angM * 4.0) * 0.24 + cos(angM * 6.0) * 0.14;
      float dM = length(relM) * (1.0 + contourM);
      float rMac = 0.10 + hash12(ipMac + vec2(19.3, 41.2)) * 0.14;
      float core = smoothstep(rMac * 0.65, rMac * 0.15, dM);
      float halo = smoothstep(rMac, rMac * 0.50, dM) * 0.52;
      dustAccum += max(core, halo);
    }

    return clamp(dustAccum, 0.0, 1.0);
  }

  // Generador fotorrealista de pelos, fibras textiles curvadas y micro-arañazos de arrastre
  float filmFibersAndScratches(vec2 isoUV) {
    // 1. Fibras orgánicas y pelos finos con ahusamiento (tapering) natural
    vec2 p = isoUV * 75.0;
    vec2 ip = floor(p);
    vec2 fp = fract(p);
    float rnd = hash12(ip + vec2(43.7, 88.1));
    float fiber = 0.0;
    if (rnd > 0.962) {
      float ang = hash12(ip + vec2(12.3, 31.4)) * 6.28318;
      vec2 dir = vec2(cos(ang), sin(ang));
      vec2 perp = vec2(-dir.y, dir.x);
      vec2 rel = fp - vec2(0.5);

      float tAlong = dot(rel, dir);
      float distAcross = dot(rel, perp);

      // Curvatura orgánica en espiral / arco
      float curlAmp = 0.10 + hash12(ip + vec2(9.1, 14.5)) * 0.12;
      float curve = (tAlong * tAlong * 1.8 + sin(tAlong * 7.5)) * curlAmp;
      float distToFiber = abs(distAcross - curve);

      // Ahusamiento (más grueso en el centro, afinándose en los extremos del pelo)
      float lengthNorm = abs(tAlong) / 0.46;
      float taper = clamp(1.0 - lengthNorm * lengthNorm, 0.0, 1.0);
      float thickness = 0.018 * taper;

      float fiberMask = smoothstep(thickness + 0.008, thickness, distToFiber);
      float endFade = smoothstep(0.48, 0.38, abs(tAlong));
      fiber = fiberMask * endFade * (0.65 + 0.35 * taper);
    }

    // 2. Micro-arañazos verticales (hairlines de fricción en cámaras y rodillos)
    float stripX = fract(isoUV.x * 24.0 + 0.17);
    float stripSeed = floor(isoUV.x * 24.0);
    float scratchRnd = hash12(vec2(stripSeed, 113.8));
    float scratch = 0.0;
    if (scratchRnd > 0.94) {
      float targetX = hash12(vec2(stripSeed, 55.4));
      float dX = abs(stripX - targetX);
      float broken = hash12(vec2(stripSeed, floor(isoUV.y * 180.0)));
      scratch = smoothstep(0.012, 0.002, dX) * smoothstep(0.35, 0.95, broken) * 0.72;
    }

    return max(fiber, scratch);
  }

  vec2 computeMotionOffsetDiag(
    float t,
    int motionType,
    float maxDragDiag,
    vec2 dir,
    vec2 perp,
    vec2 relFromCenterDiag
  ) {
    if (motionType == 0) {
      return dir * ((t - 0.15) * maxDragDiag);
    } else if (motionType == 1) {
      vec2 P0 = vec2(0.0);
      vec2 P1 = (dir * 0.36 + perp * 0.30) * maxDragDiag;
      vec2 P2 = (dir * 0.76 - perp * 0.18) * maxDragDiag;
      vec2 P3 = (dir * 1.00 + perp * 0.12) * maxDragDiag;

      float it = 1.0 - t;
      vec2 bezier = it * it * it * P0
                  + 3.0 * it * it * t * P1
                  + 3.0 * it * t * t * P2
                  + t * t * t * P3;

      vec2 tremor = (perp * sin(t * 9.424778) * 0.045 + dir * cos(t * 6.283185) * 0.024) * maxDragDiag * t;
      return bezier + tremor;
    } else {
      float radialFactor = clamp(maxDragDiag * 3.85, 0.0, 0.68);
      float twist = sin(u_dragAngleRad) * 0.18 * radialFactor * t;
      vec2 zoomedRel = rotate2D(relFromCenterDiag * (1.0 - t * radialFactor), twist);
      return zoomedRel - relFromCenterDiag;
    }
  }

  void main() {
    if (u_bypassAll == 1 || (u_splitPos >= 0.0 && v_uv.x < u_splitPos)) {
      vec2 srcUV = mapUVToSource(v_uv);
      vec3 rawPhoto = texture(u_imageTex, srcUV).rgb;
      outColor = vec4(rawPhoto, 1.0);
      return;
    }

    float safeAspect = max(0.05, u_aspect);
    float diag = length(vec2(safeAspect, 1.0));
    vec2 diagToUV = vec2(diag / safeAspect, diag);
    vec2 isoUV = (v_uv * vec2(safeAspect, 1.0)) / diag;

    vec3 baseColor = samplePass1(v_uv);
    vec3 color = baseColor;

    float protectionAtten = 1.0;
    if (u_anchorEnabled == 1) {
      float distToAnchorDiag = length((v_uv - u_anchorUV) * vec2(safeAspect, 1.0)) / diag;
      float innerR = clamp(u_anchorRadius, 0.02, 1.0) * 0.36;
      float outerR = innerR + max(0.025, clamp(u_anchorFeather, 0.02, 1.0) * 0.42);
      float zoneMask = smoothstep(innerR, outerR, distToAnchorDiag);
      protectionAtten = mix(0.10, 1.0, zoneMask);
    }

    // 1. Shutter Drag (48 muestras)
    float effectiveDrag = u_dragLength * protectionAtten;
    if (effectiveDrag > 0.001) {
      float maxDragDiag = pow(clamp(effectiveDrag, 0.0, 1.0), 1.22) * 0.135;
      vec2 dir = vec2(cos(u_dragAngleRad), sin(u_dragAngleRad));
      vec2 perp = vec2(-dir.y, dir.x);
      vec2 centerUV = (u_anchorEnabled == 1) ? u_anchorUV : vec2(0.5, 0.5);
      vec2 relFromCenterDiag = ((v_uv - centerUV) * vec2(safeAspect, 1.0)) / diag;

      float jitter = interleavedGradientNoise(floor(isoUV * 2400.0)) - 0.5;

      const int NUM_SAMPLES = 48;
      vec3 accumLin = vec3(0.0);
      vec3 peakTrailLin = vec3(0.0);
      float weightSum = 0.0;

      float hiBoost = clamp(u_highlightTrails, 0.0, 1.0);
      float freezeAmt = clamp(u_flashFreeze, 0.0, 1.0);

      for (int i = 0; i < NUM_SAMPLES; i++) {
        float t = (float(i) + 0.5 + jitter * 0.85) / float(NUM_SAMPLES);
        t = clamp(t, 0.0, 1.0);

        vec2 offsetDiag = computeMotionOffsetDiag(t, u_motionType, maxDragDiag, dir, perp, relFromCenterDiag);
        vec2 sampleUV = v_uv + offsetDiag * diagToUV;
        vec3 sRGB = samplePass1(sampleUV);

        vec3 sLin = pow(max(sRGB, vec3(0.0)), vec3(2.2));
        float sLuma = getLuma(sRGB);

        float curtainWeight = mix(1.0, exp(-t * (1.15 + freezeAmt * 1.65)), freezeAmt * 0.65);
        float brightMask = smoothstep(0.38, 0.98, sLuma);
        float expHighlightWeight = exp(hiBoost * 5.4 * (sLuma * sLuma * 0.65 + brightMask * 0.95));

        float w = curtainWeight * expHighlightWeight;
        accumLin += sLin * w;
        weightSum += w;

        float trailDecay = 1.0 - t * 0.35;
        peakTrailLin = max(peakTrailLin, sLin * brightMask * trailDecay);
      }

      vec3 blurredLin = accumLin / max(0.0001, weightSum);

      if (hiBoost > 0.001) {
        vec3 baseLin = pow(max(baseColor, vec3(0.0)), vec3(2.2));
        vec3 trailExcess = max(vec3(0.0), peakTrailLin - baseLin * 0.85);
        blurredLin += trailExcess * (hiBoost * 0.62);
      }

      vec3 motionColor = clamp(pow(max(blurredLin, vec3(0.0)), vec3(1.0 / 2.2)), 0.0, 1.0);

      float localFreeze = clamp(freezeAmt + (1.0 - protectionAtten) * 0.45, 0.0, 1.0);
      if (localFreeze > 0.001) {
        float motionLuma = getLuma(motionColor);
        float baseLuma = getLuma(baseColor);
        float luminousGhost = smoothstep(baseLuma - 0.02, baseLuma + 0.32, motionLuma) * (0.35 + 0.65 * hiBoost);
        vec3 flashComposite = mix(baseColor, max(baseColor, motionColor), luminousGhost * 0.78);
        color = mix(motionColor, flashComposite, pow(localFreeze, 0.85));
      } else {
        color = motionColor;
      }
    }

    // 2. Grano Analógico
    float grain = clamp(u_grainAmount, 0.0, 1.0);
    if (grain > 0.001) {
      float L = getLuma(color);
      float emulsionMask = 4.0 * L * (1.0 - L) * 0.75 + 0.25;

      float gVal = organicGrainIso(isoUV, u_grainSize, u_grainRoughness, vec2(0.0, 0.0));
      color = clamp(color + vec3(gVal * grain * 0.22 * emulsionMask), 0.0, 1.0);
    }

    // (El polvo y ruido sucio procedimental anterior fue eliminado; ahora se aplican las texturas reales de Analog Film en FrameRenderer)

    if (u_splitPos >= 0.0 && abs(v_uv.x - u_splitPos) < 0.0018) {
      color = vec3(1.0, 0.2, 0.25);
    }

    outColor = vec4(color, 1.0);
  }
  `;

  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('Error compilando shader WebGL2: ' + info);
    }
    return shader;
  }

  class PipelineInstance {
    constructor(canvas) {
      this.canvas = canvas;
      const gl = canvas.getContext('webgl2', {
        alpha: false,
        depth: false,
        stencil: false,
        antialias: false,
        preserveDrawingBuffer: true,
        premultipliedAlpha: false
      });

      if (!gl) {
        throw new Error('WebGL2 no está disponible en este dispositivo.');
      }
      this.gl = gl;

      this.extFloatColor = gl.getExtension('EXT_color_buffer_float');
      this.extFloatLinear = gl.getExtension('OES_texture_float_linear');

      const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
      const fsPass1 = compileShader(gl, gl.FRAGMENT_SHADER, PASS1_FRAGMENT_SHADER_SRC);
      const fsPass2 = compileShader(gl, gl.FRAGMENT_SHADER, OPTICS_FRAGMENT_SHADER_SRC);

      // Programa Pase 1
      const prog1 = gl.createProgram();
      gl.attachShader(prog1, vs);
      gl.attachShader(prog1, fsPass1);
      gl.linkProgram(prog1);
      if (!gl.getProgramParameter(prog1, gl.LINK_STATUS)) {
        throw new Error('Error vinculando Pase 1: ' + gl.getProgramInfoLog(prog1));
      }
      this.program1 = prog1;

      // Programa Pase 2
      const prog2 = gl.createProgram();
      gl.attachShader(prog2, vs);
      gl.attachShader(prog2, fsPass2);
      gl.linkProgram(prog2);
      if (!gl.getProgramParameter(prog2, gl.LINK_STATUS)) {
        throw new Error('Error vinculando Pase 2: ' + gl.getProgramInfoLog(prog2));
      }
      this.program2 = prog2;

      // Geometría del plano completo:
      // Mapea y=-1.0 a v=1.0 (inferior) y y=+1.0 a v=0.0 (superior) exactamente como en negativo de laboratorio
      const quadData = new Float32Array([
        // x,    y,   u,   v
        -1.0, -1.0, 0.0, 1.0,
         1.0, -1.0, 1.0, 1.0,
        -1.0,  1.0, 0.0, 0.0,
         1.0,  1.0, 1.0, 0.0
      ]);

      const quadVAO = gl.createVertexArray();
      gl.bindVertexArray(quadVAO);
      const quadVBO = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
      gl.bufferData(gl.ARRAY_BUFFER, quadData, gl.STATIC_DRAW);

      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
      gl.bindVertexArray(null);
      this.quadVAO = quadVAO;

      this.imageTexture = null;
      this.imageWidth = 0;
      this.imageHeight = 0;

      this.pass1FBO = null;
      this.pass1Texture = null;
      this.fboWidth = 0;
      this.fboHeight = 0;

      this.cacheUniformLocations();
    }

    cacheUniformLocations() {
      const gl = this.gl;
      this.u1 = {
        imageTex: gl.getUniformLocation(this.program1, 'u_imageTex'),
        texSize: gl.getUniformLocation(this.program1, 'u_texSize'),
        cropRect: gl.getUniformLocation(this.program1, 'u_cropRect'),
        rotateSteps: gl.getUniformLocation(this.program1, 'u_rotateSteps'),
        straightenRad: gl.getUniformLocation(this.program1, 'u_straightenRad'),
        flip: gl.getUniformLocation(this.program1, 'u_flip'),
        exposure: gl.getUniformLocation(this.program1, 'u_exposure'),
        brightness: gl.getUniformLocation(this.program1, 'u_brightness'),
        contrast: gl.getUniformLocation(this.program1, 'u_contrast'),
        highlights: gl.getUniformLocation(this.program1, 'u_highlights'),
        shadows: gl.getUniformLocation(this.program1, 'u_shadows'),
        whites: gl.getUniformLocation(this.program1, 'u_whites'),
        blacks: gl.getUniformLocation(this.program1, 'u_blacks'),
        sharpenAmount: gl.getUniformLocation(this.program1, 'u_sharpenAmount'),
        saturation: gl.getUniformLocation(this.program1, 'u_saturation'),
        vibrance: gl.getUniformLocation(this.program1, 'u_vibrance'),
        temperature: gl.getUniformLocation(this.program1, 'u_temperature'),
        tint: gl.getUniformLocation(this.program1, 'u_tint'),
        clarity: gl.getUniformLocation(this.program1, 'u_clarity'),
        shadowFade: gl.getUniformLocation(this.program1, 'u_shadowFade'),
        highlightRollOff: gl.getUniformLocation(this.program1, 'u_highlightRollOff'),
        channelCurve: gl.getUniformLocation(this.program1, 'u_channelCurve'),
        bwMixer: gl.getUniformLocation(this.program1, 'u_bwMixer'),
        isBlackAndWhite: gl.getUniformLocation(this.program1, 'u_isBlackAndWhite'),
        hslReds: gl.getUniformLocation(this.program1, 'u_hslReds'),
        hslOranges: gl.getUniformLocation(this.program1, 'u_hslOranges'),
        hslYellows: gl.getUniformLocation(this.program1, 'u_hslYellows'),
        hslGreens: gl.getUniformLocation(this.program1, 'u_hslGreens'),
        hslAquas: gl.getUniformLocation(this.program1, 'u_hslAquas'),
        hslBlues: gl.getUniformLocation(this.program1, 'u_hslBlues'),
        calibRed: gl.getUniformLocation(this.program1, 'u_calibRed'),
        calibGreen: gl.getUniformLocation(this.program1, 'u_calibGreen'),
        calibBlue: gl.getUniformLocation(this.program1, 'u_calibBlue'),
        bypassAll: gl.getUniformLocation(this.program1, 'u_bypassAll')
      };

      this.u2 = {
        pass1Tex: gl.getUniformLocation(this.program2, 'u_pass1Tex'),
        imageTex: gl.getUniformLocation(this.program2, 'u_imageTex'),
        texSize: gl.getUniformLocation(this.program2, 'u_texSize'),
        aspect: gl.getUniformLocation(this.program2, 'u_aspect'),
        cropRect: gl.getUniformLocation(this.program2, 'u_cropRect'),
        rotateSteps: gl.getUniformLocation(this.program2, 'u_rotateSteps'),
        straightenRad: gl.getUniformLocation(this.program2, 'u_straightenRad'),
        flip: gl.getUniformLocation(this.program2, 'u_flip'),
        bypassAll: gl.getUniformLocation(this.program2, 'u_bypassAll'),
        splitPos: gl.getUniformLocation(this.program2, 'u_splitPos'),
        motionType: gl.getUniformLocation(this.program2, 'u_motionType'),
        dragLength: gl.getUniformLocation(this.program2, 'u_dragLength'),
        dragAngleRad: gl.getUniformLocation(this.program2, 'u_dragAngleRad'),
        flashFreeze: gl.getUniformLocation(this.program2, 'u_flashFreeze'),
        highlightTrails: gl.getUniformLocation(this.program2, 'u_highlightTrails'),
        anchorEnabled: gl.getUniformLocation(this.program2, 'u_anchorEnabled'),
        anchorUV: gl.getUniformLocation(this.program2, 'u_anchorUV'),
        anchorRadius: gl.getUniformLocation(this.program2, 'u_anchorRadius'),
        anchorFeather: gl.getUniformLocation(this.program2, 'u_anchorFeather'),
        grainAmount: gl.getUniformLocation(this.program2, 'u_grainAmount'),
        grainSize: gl.getUniformLocation(this.program2, 'u_grainSize'),
        grainRoughness: gl.getUniformLocation(this.program2, 'u_grainRoughness'),
        dustEnabled: gl.getUniformLocation(this.program2, 'u_dustEnabled'),
        dustAmount: gl.getUniformLocation(this.program2, 'u_dustAmount'),
        scratchesAmount: gl.getUniformLocation(this.program2, 'u_scratchesAmount'),
        dustInvert: gl.getUniformLocation(this.program2, 'u_dustInvert')
      };
    }

    uploadFloatImage(floatRGBA, width, height) {
      const gl = this.gl;
      this.imageWidth = width;
      this.imageHeight = height;

      if (!this.imageTexture) {
        this.imageTexture = gl.createTexture();
      }
      gl.bindTexture(gl.TEXTURE_2D, this.imageTexture);

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      if (this.extFloatLinear) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, floatRGBA);
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.FLOAT, floatRGBA);
      }

      gl.bindTexture(gl.TEXTURE_2D, null);
    }

    ensurePass1FBO(width, height) {
      const gl = this.gl;
      if (this.pass1FBO && this.fboWidth === width && this.fboHeight === height) {
        return;
      }

      if (this.pass1FBO) {
        gl.deleteFramebuffer(this.pass1FBO);
        gl.deleteTexture(this.pass1Texture);
      }

      this.fboWidth = width;
      this.fboHeight = height;

      this.pass1FBO = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.pass1FBO);

      this.pass1Texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.pass1Texture);

      const internalFmt = this.extFloatColor ? gl.RGBA16F : gl.RGBA8;
      const type = this.extFloatColor ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;

      gl.texImage2D(
        gl.TEXTURE_2D, 0, internalFmt, width, height, 0, gl.RGBA, type, null
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      gl.framebufferTexture2D(
        gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.pass1Texture, 0
      );

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    getCroppedDimensions(srcWidth, srcHeight, settings) {
      const crop = settings.crop || { x: 0, y: 0, w: 1, h: 1 };
      let cw = Math.max(1, Math.round(srcWidth * crop.w));
      let ch = Math.max(1, Math.round(srcHeight * crop.h));

      if (settings.rotateSteps === 1 || settings.rotateSteps === 3) {
        return { width: ch, height: cw };
      }
      return { width: cw, height: ch };
    }

    render(settings, targetWidth, targetHeight, options = {}) {
      const gl = this.gl;
      if (!this.imageTexture) return;

      const outW = Math.max(1, Math.round(targetWidth));
      const outH = Math.max(1, Math.round(targetHeight));

      if (this.canvas.width !== outW || this.canvas.height !== outH) {
        this.canvas.width = outW;
        this.canvas.height = outH;
      }

      this.ensurePass1FBO(outW, outH);

      const crop = (options.ignoreCrop)
        ? { x: 0, y: 0, w: 1, h: 1 }
        : (settings.crop || { x: 0, y: 0, w: 1, h: 1 });

      const flipX = settings.flipH ? -1.0 : 1.0;
      const flipY = settings.flipV ? -1.0 : 1.0;
      const straightenRad = ((settings.straighten || 0) * Math.PI) / 180.0;
      const aspect = outW / Math.max(1, outH);

      // ----------------------------------------------------
      // PASE 1: Geometría + Ajustes Básicos -> FBO
      // ----------------------------------------------------
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.pass1FBO);
      gl.viewport(0, 0, outW, outH);
      gl.useProgram(this.program1);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.imageTexture);
      gl.uniform1i(this.u1.imageTex, 0);

      gl.uniform2f(this.u1.texSize, this.imageWidth, this.imageHeight);
      gl.uniform4f(this.u1.cropRect, crop.x, crop.y, crop.w, crop.h);
      gl.uniform1i(this.u1.rotateSteps, settings.rotateSteps || 0);
      gl.uniform1f(this.u1.straightenRad, straightenRad);
      gl.uniform2f(this.u1.flip, flipX, flipY);

      gl.uniform1f(this.u1.exposure, settings.exposure || 0.0);
      gl.uniform1f(this.u1.brightness, (settings.brightness || 0.0) / 100.0);
      gl.uniform1f(this.u1.contrast, (settings.contrast || 0.0) / 100.0);
      gl.uniform1f(this.u1.highlights, (settings.highlights || 0.0) / 100.0);
      gl.uniform1f(this.u1.shadows, (settings.shadows || 0.0) / 100.0);
      gl.uniform1f(this.u1.whites, (settings.whites || 0.0) / 100.0);
      gl.uniform1f(this.u1.blacks, (settings.blacks || 0.0) / 100.0);
      gl.uniform1f(this.u1.sharpenAmount, (settings.sharpness || 0.0) / 100.0);

      gl.uniform1f(this.u1.saturation, (settings.saturation || 0.0) / 100.0);
      gl.uniform1f(this.u1.vibrance, (settings.vibrance || 0.0) / 100.0);
      gl.uniform1f(this.u1.temperature, (settings.temperature || 0.0) / 100.0);
      gl.uniform1f(this.u1.tint, (settings.tint || 0.0) / 100.0);
      gl.uniform1f(this.u1.clarity, (settings.clarity || 0.0) / 100.0);
      gl.uniform1f(this.u1.shadowFade, settings.shadowFade || 0.0);
      gl.uniform1f(this.u1.highlightRollOff, settings.highlightRollOff !== undefined ? settings.highlightRollOff : 1.0);

      const cc = settings.channelCurve || [0.0, 0.0, 0.0];
      gl.uniform3f(this.u1.channelCurve, cc[0] || 0.0, cc[1] || 0.0, cc[2] || 0.0);

      const bwm = settings.bwMixer || [0.0, 0.0, 0.0, 0.0];
      gl.uniform4f(this.u1.bwMixer, bwm[0] || 0.0, bwm[1] || 0.0, bwm[2] || 0.0, bwm[3] || 0.0);

      gl.uniform1i(this.u1.isBlackAndWhite, settings.isBlackAndWhite ? 1 : 0);

      const r = settings.hslReds || [0, 0, 0];
      const o = settings.hslOranges || [0, 0, 0];
      const y = settings.hslYellows || [0, 0, 0];
      const g = settings.hslGreens || [0, 0, 0];
      const aq = settings.hslAquas || [0, 0, 0];
      const b = settings.hslBlues || [0, 0, 0];
      gl.uniform3f(this.u1.hslReds, r[0] / 100.0, r[1] / 100.0, r[2] / 100.0);
      gl.uniform3f(this.u1.hslOranges, o[0] / 100.0, o[1] / 100.0, o[2] / 100.0);
      gl.uniform3f(this.u1.hslYellows, y[0] / 100.0, y[1] / 100.0, y[2] / 100.0);
      gl.uniform3f(this.u1.hslGreens, g[0] / 100.0, g[1] / 100.0, g[2] / 100.0);
      gl.uniform3f(this.u1.hslAquas, aq[0] / 100.0, aq[1] / 100.0, aq[2] / 100.0);
      gl.uniform3f(this.u1.hslBlues, b[0] / 100.0, b[1] / 100.0, b[2] / 100.0);

      const cR = settings.calibRed || [0, 0, 0];
      const cG = settings.calibGreen || [0, 0, 0];
      const cB = settings.calibBlue || [0, 0, 0];
      gl.uniform3f(this.u1.calibRed, cR[0] / 100.0, cR[1] / 100.0, cR[2] / 100.0);
      gl.uniform3f(this.u1.calibGreen, cG[0] / 100.0, cG[1] / 100.0, cG[2] / 100.0);
      gl.uniform3f(this.u1.calibBlue, cB[0] / 100.0, cB[1] / 100.0, cB[2] / 100.0);

      gl.uniform1i(this.u1.bypassAll, options.bypassAll ? 1 : 0);

      gl.bindVertexArray(this.quadVAO);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // ----------------------------------------------------
      // PASE 2: Movimiento + Grano -> Pantalla o Canvas Final
      // ----------------------------------------------------
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, outW, outH);
      gl.useProgram(this.program2);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.pass1Texture);
      gl.uniform1i(this.u2.pass1Tex, 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.imageTexture);
      gl.uniform1i(this.u2.imageTex, 1);

      gl.uniform2f(this.u2.texSize, this.imageWidth, this.imageHeight);
      gl.uniform1f(this.u2.aspect, aspect);
      gl.uniform4f(this.u2.cropRect, crop.x, crop.y, crop.w, crop.h);
      gl.uniform1i(this.u2.rotateSteps, settings.rotateSteps || 0);
      gl.uniform1f(this.u2.straightenRad, straightenRad);
      gl.uniform2f(this.u2.flip, flipX, flipY);

      gl.uniform1i(this.u2.bypassAll, options.bypassAll ? 1 : 0);
      gl.uniform1f(this.u2.splitPos, options.splitPos !== undefined ? options.splitPos : -1.0);

      let motionTypeIdx = 1;
      if (settings.motionType === 'pan') motionTypeIdx = 0;
      else if (settings.motionType === 'zoom') motionTypeIdx = 2;

      gl.uniform1i(this.u2.motionType, motionTypeIdx);
      gl.uniform1f(this.u2.dragLength, (settings.motionLength || 0.0) / 100.0);
      gl.uniform1f(this.u2.dragAngleRad, ((settings.motionAngle || 0.0) * Math.PI) / 180.0);
      gl.uniform1f(this.u2.flashFreeze, (settings.flashFreeze || 0.0) / 100.0);
      gl.uniform1f(this.u2.highlightTrails, (settings.highlightTrails || 0.0) / 100.0);

      gl.uniform1i(this.u2.anchorEnabled, settings.anchorEnabled ? 1 : 0);
      gl.uniform2f(this.u2.anchorUV, settings.anchorX !== undefined ? settings.anchorX : 0.5, settings.anchorY !== undefined ? settings.anchorY : 0.5);
      gl.uniform1f(this.u2.anchorRadius, (settings.anchorRadius || 25.0) / 100.0);
      gl.uniform1f(this.u2.anchorFeather, (settings.anchorFeather || 35.0) / 100.0);

      gl.uniform1f(this.u2.grainAmount, (settings.grainAmount || 0.0) / 100.0);
      gl.uniform1f(this.u2.grainSize, (settings.grainSize || 35.0) / 100.0);
      gl.uniform1f(this.u2.grainRoughness, (settings.grainRoughness || 50.0) / 100.0);

      gl.uniform1i(this.u2.dustEnabled, settings.dustEnabled ? 1 : 0);
      gl.uniform1f(this.u2.dustAmount, (settings.dustAmount || 0.0) / 100.0);
      gl.uniform1f(this.u2.scratchesAmount, (settings.scratchesAmount || 0.0) / 100.0);
      gl.uniform1i(this.u2.dustInvert, settings.dustInvert ? 1 : 0);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
    }

    /**
     * Libera texturas, framebuffers y el propio contexto WebGL2.
     * Los navegadores limitan los contextos activos (~16): sin liberar, cada exportación
     * acumulaba uno nuevo hasta que el navegador destruía el del visor principal.
     */
    dispose() {
      const gl = this.gl;
      if (!gl) return;
      try {
        if (this.imageTexture) gl.deleteTexture(this.imageTexture);
        if (this.pass1Texture) gl.deleteTexture(this.pass1Texture);
        if (this.pass1FBO) gl.deleteFramebuffer(this.pass1FBO);
        const lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      } catch (err) {
        console.warn('[mucho FILM] No se pudo liberar el contexto WebGL:', err);
      }
      this.imageTexture = null;
      this.pass1Texture = null;
      this.pass1FBO = null;
      this.gl = null;
    }
  }

  return {
    PipelineInstance
  };
})();
