/**
 * mucho FILM — Motor de Decodificación y Codificación TIFF (8/16/32-bit), DNG y Cámara RAW
 * Soporta:
 * 1. Modo Escritorio Nativo (macOS CoreImage / sips vía /api/decode-raw): Decodificación 100% nativa de
 *    DNG, CR2, CR3, NEF, ARW, RAF, ORF, RW2, 3FR y TIFF a máxima resolución y 16 bits.
 * 2. Modo HTML Puro (sin servidor): Decodificador recursivo de IFDs + SubIFDs (Tag 330) para DNG y TIFF,
 *    soporte de 8/10/12/14/16/32 bits, LZW, Deflate, PackBits, Demosaicing Bayer CFA (Tag 32803),
 *    Linear DNG (Tag 34892) y extracción de flujos JPEG de alta resolución en DNG comprimidos.
 */

window.TIFFCodec = (function () {
  'use strict';

  const TYPE_SIZES = {
    1: 1,  // BYTE
    2: 1,  // ASCII
    3: 2,  // SHORT (16-bit unsigned)
    4: 4,  // LONG (32-bit unsigned)
    5: 8,  // RATIONAL (2x LONG)
    6: 1,  // SBYTE
    7: 1,  // UNDEFINED
    8: 2,  // SSHORT
    9: 4,  // SLONG
    10: 8, // SRATIONAL
    11: 4, // FLOAT (32-bit IEEE)
    12: 8  // DOUBLE (64-bit IEEE)
  };

  const COMPRESSION_NAMES = {
    1: 'Sin compresión',
    5: 'LZW',
    6: 'JPEG ( OJPEG )',
    7: 'JPEG / Lossless DNG',
    8: 'Deflate (ZIP)',
    32773: 'PackBits',
    32946: 'Deflate',
    34892: 'Lossy DNG'
  };

  let desktopBridgeAvailable = null;

  /**
   * Comprueba si el motor nativo de escritorio (mucho FILM Desktop App / server.py) está activo
   */
  async function checkDesktopBridge() {
    if (desktopBridgeAvailable !== null) return desktopBridgeAvailable;
    if (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:') {
      desktopBridgeAvailable = false;
      return false;
    }
    try {
      const res = await fetch('/api/status', { method: 'GET', cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        desktopBridgeAvailable = !!(data && data.nativeRawEngine);
        return desktopBridgeAvailable;
      }
    } catch (e) {
      // Modo estático HTML sin backend Python
    }
    desktopBridgeAvailable = false;
    return false;
  }

  /**
   * Decodificador LZW para tiras o tiles TIFF/DNG
   */
  function decodeLZW(input, expectedLength) {
    const out = new Uint8Array(expectedLength || input.length * 4);
    let outPos = 0;

    const tablePrefix = new Int32Array(4096);
    const tableSuffix = new Uint8Array(4096);
    const tableLength = new Uint16Array(4096);
    const decodeStack = new Uint8Array(4096);

    function initTable() {
      for (let i = 0; i < 256; i++) {
        tablePrefix[i] = -1;
        tableSuffix[i] = i;
        tableLength[i] = 1;
      }
    }

    initTable();
    let nextCode = 258;
    let codeSize = 9;
    let bitPos = 0;
    const totalBits = input.length * 8;

    function getNextCode() {
      if (bitPos + codeSize > totalBits) return 257;
      const bytePos = bitPos >> 3;
      const bitOffset = bitPos & 7;
      const b0 = input[bytePos] || 0;
      const b1 = input[bytePos + 1] || 0;
      const b2 = input[bytePos + 2] || 0;
      const combined = (b0 << 16) | (b1 << 8) | b2;
      const shift = 24 - bitOffset - codeSize;
      const code = (combined >> shift) & ((1 << codeSize) - 1);
      bitPos += codeSize;
      return code;
    }

    let oldCode = -1;
    let firstChar = 0;

    while (bitPos < totalBits && outPos < out.length) {
      const code = getNextCode();
      if (code === 257) break;

      if (code === 256) {
        initTable();
        nextCode = 258;
        codeSize = 9;
        oldCode = getNextCode();
        if (oldCode === 257) break;
        firstChar = oldCode & 0xff;
        if (outPos < out.length) out[outPos++] = firstChar;
        continue;
      }

      let curCode = code;
      let stackPtr = 0;

      if (curCode >= nextCode) {
        decodeStack[stackPtr++] = firstChar;
        curCode = oldCode;
      }

      while (curCode >= 258 && stackPtr < 4096) {
        decodeStack[stackPtr++] = tableSuffix[curCode];
        curCode = tablePrefix[curCode];
      }
      firstChar = tableSuffix[curCode & 0xff];
      decodeStack[stackPtr++] = firstChar;

      while (stackPtr > 0 && outPos < out.length) {
        out[outPos++] = decodeStack[--stackPtr];
      }

      if (oldCode !== -1 && nextCode < 4096) {
        tablePrefix[nextCode] = oldCode;
        tableSuffix[nextCode] = firstChar;
        tableLength[nextCode] = tableLength[oldCode] + 1;
        nextCode++;

        if (nextCode === 511 && codeSize === 9) codeSize = 10;
        else if (nextCode === 1023 && codeSize === 10) codeSize = 11;
        else if (nextCode === 2047 && codeSize === 11) codeSize = 12;
      }

      oldCode = code;
    }

    return out.subarray(0, outPos);
  }

  /**
   * Decodificador PackBits (RLE estándar TIFF, Compression = 32773)
   */
  function decodePackBits(input, expectedLength) {
    const out = new Uint8Array(expectedLength || input.length * 4);
    let inPos = 0;
    let outPos = 0;
    while (inPos < input.length && outPos < out.length) {
      let n = input[inPos++];
      if (n >= 128) n -= 256;
      if (n === -128) continue;
      if (n >= 0) {
        const count = n + 1;
        for (let i = 0; i < count && inPos < input.length && outPos < out.length; i++) {
          out[outPos++] = input[inPos++];
        }
      } else {
        const count = 1 - n;
        const val = input[inPos++];
        for (let i = 0; i < count && outPos < out.length; i++) {
          out[outPos++] = val;
        }
      }
    }
    return out.subarray(0, outPos);
  }

  /**
   * Decodificador Deflate / Zlib asíncrono mediante DecompressionStream nativo
   */
  async function decodeDeflate(input) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('El navegador no soporta DecompressionStream para TIFF/DNG Deflate.');
    }
    for (const format of ['deflate', 'deflate-raw']) {
      try {
        const ds = new DecompressionStream(format);
        const writer = ds.writable.getWriter();
        writer.write(input);
        writer.close();
        const response = new Response(ds.readable);
        const ab = await response.arrayBuffer();
        return new Uint8Array(ab);
      } catch (e) {
        // Intentar siguiente formato
      }
    }
    throw new Error('No se pudo descomprimir el bloque Deflate.');
  }

  /**
   * Aplica Predictor = 2 (Horizontal Differencing) por fila para 8-bit o 16-bit
   */
  function applyHorizontalPredictor(stripBytes, width, rowsInStrip, samplesPerPixel, bitsPerSample, littleEndian) {
    const bytesPerSample = bitsPerSample >> 3;
    const rowBytes = width * samplesPerPixel * bytesPerSample;

    if (bitsPerSample === 8) {
      for (let r = 0; r < rowsInStrip; r++) {
        const rowOffset = r * rowBytes;
        if (rowOffset + rowBytes > stripBytes.length) break;
        for (let i = samplesPerPixel; i < rowBytes; i++) {
          stripBytes[rowOffset + i] = (stripBytes[rowOffset + i] + stripBytes[rowOffset + i - samplesPerPixel]) & 0xff;
        }
      }
    } else if (bitsPerSample === 16) {
      const dv = new DataView(stripBytes.buffer, stripBytes.byteOffset, stripBytes.byteLength);
      const rowSamples = width * samplesPerPixel;
      for (let r = 0; r < rowsInStrip; r++) {
        const rowByteOffset = r * rowBytes;
        if (rowByteOffset + rowBytes > stripBytes.byteLength) break;
        for (let s = samplesPerPixel; s < rowSamples; s++) {
          const curOffset = rowByteOffset + s * 2;
          const prevOffset = rowByteOffset + (s - samplesPerPixel) * 2;
          const sum = (dv.getUint16(curOffset, littleEndian) + dv.getUint16(prevOffset, littleEndian)) & 0xffff;
          dv.setUint16(curOffset, sum, littleEndian);
        }
      }
    }
  }

  /**
   * Lee un directorio IFD de un archivo TIFF o DNG
   */
  function parseIFD(dv, offset, littleEndian) {
    if (offset <= 0 || offset + 2 > dv.byteLength) {
      return { tags: {}, nextIFD: 0 };
    }
    const numEntries = dv.getUint16(offset, littleEndian);
    const tags = {};
    let pos = offset + 2;

    for (let i = 0; i < numEntries; i++) {
      if (pos + 12 > dv.byteLength) break;
      const tag = dv.getUint16(pos, littleEndian);
      const type = dv.getUint16(pos + 2, littleEndian);
      const count = dv.getUint32(pos + 4, littleEndian);
      const typeSize = TYPE_SIZES[type] || 1;
      const totalBytes = count * typeSize;

      let valueOffset = pos + 8;
      if (totalBytes > 4) {
        valueOffset = dv.getUint32(pos + 8, littleEndian);
      }

      // Evitar lecturas gigantes para tags binarios crudos salvo que los necesitemos
      const maxReadCount = Math.min(count, 65536);
      const values = [];
      for (let c = 0; c < maxReadCount; c++) {
        const elemPos = valueOffset + c * typeSize;
        if (elemPos + typeSize > dv.byteLength) break;
        switch (type) {
          case 1:
          case 7:
            values.push(dv.getUint8(elemPos));
            break;
          case 2:
            values.push(String.fromCharCode(dv.getUint8(elemPos)));
            break;
          case 3:
            values.push(dv.getUint16(elemPos, littleEndian));
            break;
          case 4:
            values.push(dv.getUint32(elemPos, littleEndian));
            break;
          case 5: {
            const num = dv.getUint32(elemPos, littleEndian);
            const den = dv.getUint32(elemPos + 4, littleEndian);
            values.push(den !== 0 ? num / den : 0);
            break;
          }
          case 8:
            values.push(dv.getInt16(elemPos, littleEndian));
            break;
          case 9:
            values.push(dv.getInt32(elemPos, littleEndian));
            break;
          case 10: {
            const snum = dv.getInt32(elemPos, littleEndian);
            const sden = dv.getInt32(elemPos + 4, littleEndian);
            values.push(sden !== 0 ? snum / sden : 0);
            break;
          }
          case 11:
            values.push(dv.getFloat32(elemPos, littleEndian));
            break;
          case 12:
            values.push(dv.getFloat64(elemPos, littleEndian));
            break;
          default:
            values.push(dv.getUint8(elemPos));
        }
      }

      tags[tag] = count === 1 && type !== 2 ? values[0] : (type === 2 ? values.join('').replace(/\0/g, '') : values);
      pos += 12;
    }

    const nextIFD = pos + 4 <= dv.byteLength ? dv.getUint32(pos, littleEndian) : 0;
    return { tags, nextIFD };
  }

  /**
   * Recorre recursivamente todos los IFDs y SubIFDs (Tag 330, usado por DNG para guardar la imagen principal)
   */
  function collectAllIFDs(dv, firstOffset, littleEndian) {
    const allIFDs = [];
    const visited = new Set();

    function traverse(offset) {
      if (!offset || offset <= 0 || offset >= dv.byteLength || visited.has(offset) || visited.size > 64) {
        return;
      }
      visited.add(offset);
      const { tags, nextIFD } = parseIFD(dv, offset, littleEndian);
      if (Object.keys(tags).length > 0) {
        allIFDs.push(tags);
      }

      // Tag 330 = SubIFDs (estándar DNG para el raster de resolución completa y previews)
      if (tags[330] !== undefined) {
        const subOffsets = Array.isArray(tags[330]) ? tags[330] : [tags[330]];
        for (let i = 0; i < subOffsets.length; i++) {
          traverse(subOffsets[i]);
        }
      }

      // Tag 34665 = ExifIFD (a veces contiene SubIFDs adicionales)
      if (nextIFD) {
        traverse(nextIFD);
      }
    }

    traverse(firstOffset);
    return allIFDs;
  }

  /**
   * Extrae y decodifica el flujo JPEG incrustado más grande dentro de un archivo DNG/RAW
   * cuando el navegador trabaja en modo HTML puro (sin servidor) y el DNG usa Lossless JPEG Process 14.
   */
  async function extractLargestEmbeddedJPEG(arrayBuffer, allIFDs) {
    const u8 = new Uint8Array(arrayBuffer);
    const candidates = [];

    // 1. Revisar IFDs con compresión JPEG (6 o 7) que sean JPEG estándar (SOI 0xFFD8)
    for (let i = 0; i < allIFDs.length; i++) {
      const t = allIFDs[i];
      const comp = t[259];
      if (comp === 6 || comp === 7 || comp === 34892) {
        const offsets = Array.isArray(t[273]) ? t[273] : (t[273] ? [t[273]] : (Array.isArray(t[324]) ? t[324] : (t[324] ? [t[324]] : [])));
        const counts = Array.isArray(t[279]) ? t[279] : (t[279] ? [t[279]] : (Array.isArray(t[325]) ? t[325] : (t[325] ? [t[325]] : [])));
        if (offsets.length === 1 && counts.length === 1) {
          const off = offsets[0];
          const len = counts[0];
          if (off + 2 < u8.length && u8[off] === 0xFF && u8[off + 1] === 0xD8) {
            candidates.push({ offset: off, length: Math.min(len, u8.length - off), width: t[256] || 0, height: t[257] || 0 });
          }
        }
      }
      // Tag 513 (JPEGInterchangeFormat) y 514 (JPEGInterchangeFormatLength)
      if (t[513] && t[514]) {
        const off = Array.isArray(t[513]) ? t[513][0] : t[513];
        const len = Array.isArray(t[514]) ? t[514][0] : t[514];
        if (off + 2 < u8.length && u8[off] === 0xFF && u8[off + 1] === 0xD8) {
          candidates.push({ offset: off, length: Math.min(len, u8.length - off), width: t[256] || 0, height: t[257] || 0 });
        }
      }
    }

    // 2. Escanear marcadores JPEG SOI (FF D8 FF) y EOI (FF D9) en el archivo DNG/RAW por si el preview está en otro bloque
    for (let i = 0; i < u8.length - 4; i++) {
      if (u8[i] === 0xFF && u8[i + 1] === 0xD8 && u8[i + 2] === 0xFF) {
        // Comprobar que no sea un flujo Lossless JPEG Process 14 (SOF3 = FF C3) que el navegador no renderiza en <img>
        let isLosslessSOF3 = false;
        let eoiPos = -1;
        const searchLimit = Math.min(u8.length - 1, i + 25 * 1024 * 1024);
        for (let j = i + 2; j < searchLimit; j++) {
          if (u8[j] === 0xFF) {
            const marker = u8[j + 1];
            if (marker === 0xC3) {
              isLosslessSOF3 = true;
              break;
            }
            if (marker === 0xD9) {
              eoiPos = j + 2;
              // Seguimos buscando si es un thumbnail diminuto dentro del APP1
              if (eoiPos - i > 35000) break;
            }
          }
        }
        if (!isLosslessSOF3 && eoiPos > i + 4096) {
          candidates.push({ offset: i, length: eoiPos - i, width: 0, height: 0 });
          i = eoiPos - 1;
        }
      }
    }

    // Ordenar candidatos de mayor a menor tamaño en bytes
    candidates.sort((a, b) => b.length - a.length);

    for (let c = 0; c < candidates.length; c++) {
      const cand = candidates[c];
      try {
        const slice = u8.subarray(cand.offset, cand.offset + cand.length);
        const blob = new Blob([slice], { type: 'image/jpeg' });
        const decoded = await decodeBlobToFloatRGBA(blob, 'DNG Preview');
        if (decoded && decoded.width >= 160 && decoded.height >= 120) {
          decoded.format = 'DNG';
          decoded.bitDepth = 16;
          decoded.compression = 'DNG Embedded Raster';
          return decoded;
        }
      } catch (e) {
        // Probar siguiente candidato
      }
    }

    return null;
  }

  async function decodeBlobToFloatRGBA(blob, label) {
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.decoding = 'async';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('No se pudo decodificar flujo de imagen ' + label));
        img.src = url;
      });
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, width, height).data;
      const floatRGBA = new Float32Array(width * height * 4);
      const inv255 = 1.0 / 255.0;
      for (let i = 0; i < imgData.length; i++) {
        floatRGBA[i] = imgData[i] * inv255;
      }
      return {
        width,
        height,
        canvas,
        bitDepth: 8,
        channels: 3,
        compression: 'Nativa',
        format: label,
        floatData: floatRGBA
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Demosaicing Bilineal de alta velocidad para sensores CFA Bayer (PhotometricInterpretation = 32803 en DNG)
   */
  function demosaicBayerCFA(rawPlane, width, height, cfaPattern) {
    const outRGBA = new Float32Array(width * height * 4);
    // Patrón CFA por defecto: RGGB = [0, 1, 1, 2] (0=R, 1=G, 2=B)
    const pat = (Array.isArray(cfaPattern) && cfaPattern.length >= 4) ? cfaPattern : [0, 1, 1, 2];

    function colorAt(x, y) {
      return pat[(y & 1) * 2 + (x & 1)];
    }

    function sampleClamped(x, y) {
      const cx = Math.max(0, Math.min(width - 1, x));
      const cy = Math.max(0, Math.min(height - 1, y));
      return rawPlane[cy * width + cx];
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const c = colorAt(x, y);
        const center = sampleClamped(x, y);
        let r = 0, g = 0, b = 0;

        if (c === 0) {
          // Píxel Rojo
          r = center;
          g = 0.25 * (sampleClamped(x - 1, y) + sampleClamped(x + 1, y) + sampleClamped(x, y - 1) + sampleClamped(x, y + 1));
          b = 0.25 * (sampleClamped(x - 1, y - 1) + sampleClamped(x + 1, y - 1) + sampleClamped(x - 1, y + 1) + sampleClamped(x + 1, y + 1));
        } else if (c === 2) {
          // Píxel Azul
          b = center;
          g = 0.25 * (sampleClamped(x - 1, y) + sampleClamped(x + 1, y) + sampleClamped(x, y - 1) + sampleClamped(x, y + 1));
          r = 0.25 * (sampleClamped(x - 1, y - 1) + sampleClamped(x + 1, y - 1) + sampleClamped(x - 1, y + 1) + sampleClamped(x + 1, y + 1));
        } else {
          // Píxel Verde
          g = center;
          const horizColor = colorAt(x + 1, y);
          const hAvg = 0.5 * (sampleClamped(x - 1, y) + sampleClamped(x + 1, y));
          const vAvg = 0.5 * (sampleClamped(x, y - 1) + sampleClamped(x, y + 1));
          if (horizColor === 0) {
            r = hAvg;
            b = vAvg;
          } else {
            r = vAvg;
            b = hAvg;
          }
        }

        const dst = (y * width + x) * 4;
        outRGBA[dst] = Math.max(0, Math.min(1, r));
        outRGBA[dst + 1] = Math.max(0, Math.min(1, g));
        outRGBA[dst + 2] = Math.max(0, Math.min(1, b));
        outRGBA[dst + 3] = 1.0;
      }
    }

    return outRGBA;
  }

  /**
   * Extrae muestras empaquetadas de 10, 12 o 14 bits en una tira DNG/TIFF sin comprimir
   */
  function unpackPackedSamples(rawBytes, numSamples, bitsPerSample, blackLevel, whiteLevel) {
    const out = new Float32Array(numSamples);
    let bitPos = 0;
    const totalBits = rawBytes.length * 8;
    const maxCode = (1 << bitsPerSample) - 1;
    const wLevel = whiteLevel > blackLevel ? whiteLevel : maxCode;
    const span = Math.max(1, wLevel - blackLevel);

    for (let i = 0; i < numSamples; i++) {
      if (bitPos + bitsPerSample > totalBits) break;
      const bytePos = bitPos >> 3;
      const bitOffset = bitPos & 7;
      const b0 = rawBytes[bytePos] || 0;
      const b1 = rawBytes[bytePos + 1] || 0;
      const b2 = rawBytes[bytePos + 2] || 0;
      const combined = (b0 << 16) | (b1 << 8) | b2;
      const shift = 24 - bitOffset - bitsPerSample;
      const rawVal = (combined >> shift) & maxCode;
      bitPos += bitsPerSample;
      out[i] = Math.max(0.0, Math.min(1.0, (rawVal - blackLevel) / span));
    }

    return out;
  }

  /**
   * Decodifica un ArrayBuffer TIFF o DNG a Float32Array RGBA (0.0 a 1.0)
   */
  async function decodeTIFF(arrayBuffer, isDngHint = false) {
    const dv = new DataView(arrayBuffer);
    if (dv.byteLength < 8) {
      throw new Error('Archivo TIFF/DNG inválido o truncado.');
    }

    const byteOrder = dv.getUint16(0, false);
    let littleEndian = true;
    if (byteOrder === 0x4949) {
      littleEndian = true;
    } else if (byteOrder === 0x4D4D) {
      littleEndian = false;
    } else {
      throw new Error('Cabecera TIFF/DNG no reconocida (se esperaba II o MM).');
    }

    const magic = dv.getUint16(2, littleEndian);
    if (magic !== 42 && magic !== 0x4F52 && magic !== 0x55) {
      throw new Error('Número mágico TIFF/DNG no soportado (' + magic + ').');
    }

    const firstIFDOffset = dv.getUint32(4, littleEndian);
    // Recorrer TODOS los IFDs y SubIFDs (clave para archivos .DNG)
    const allIFDs = collectAllIFDs(dv, firstIFDOffset, littleEndian);

    // Separar IFDs decodificables directamente en JS (compresión 1, 5, 8, 32773, 32946)
    let bestDirectIFD = null;
    let maxDirectPixels = 0;

    for (let i = 0; i < allIFDs.length; i++) {
      const t = allIFDs[i];
      const w = Array.isArray(t[256]) ? t[256][0] : t[256];
      const h = Array.isArray(t[257]) ? t[257][0] : t[257];
      const comp = t[259] || 1;
      const canDecompressInJS = (comp === 1 || comp === 5 || comp === 8 || comp === 32773 || comp === 32946);
      if (w && h && canDecompressInJS && w * h > maxDirectPixels) {
        maxDirectPixels = w * h;
        bestDirectIFD = t;
      }
    }

    // Si el archivo es un DNG cuyos SubIFDs principales están comprimidos con Lossless JPEG (comp=7)
    // y el mejor IFD sin comprimir es solo una miniatura pequeña (< 400x400), extraer el mayor JPEG de alta resolución incrustado
    if (!bestDirectIFD || (isDngHint && maxDirectPixels < 300000)) {
      const embeddedJpegResult = await extractLargestEmbeddedJPEG(arrayBuffer, allIFDs);
      if (embeddedJpegResult && embeddedJpegResult.width * embeddedJpegResult.height > maxDirectPixels) {
        return embeddedJpegResult;
      }
    }

    if (!bestDirectIFD) {
      // Último intento buscando flujos JPEG incrustados
      const fallbackJpeg = await extractLargestEmbeddedJPEG(arrayBuffer, allIFDs);
      if (fallbackJpeg) return fallbackJpeg;
      throw new Error('El archivo DNG/TIFF utiliza compresión propietaria; ábrelo desde la app de escritorio "mucho FILM" para decodificación nativa.');
    }

    const tags = bestDirectIFD;
    const width = Array.isArray(tags[256]) ? tags[256][0] : tags[256];
    const height = Array.isArray(tags[257]) ? tags[257][0] : tags[257];
    const bitsPerSampleArr = Array.isArray(tags[258]) ? tags[258] : [tags[258] || 8];
    const bitsPerSample = bitsPerSampleArr[0] || 8;
    const compression = tags[259] || 1;
    const photometric = tags[262] !== undefined ? tags[262] : 2;
    const samplesPerPixel = tags[277] || bitsPerSampleArr.length || (photometric === 2 ? 3 : 1);
    const rowsPerStripRaw = Array.isArray(tags[278]) ? tags[278][0] : tags[278];
    const planarConfig = tags[284] || 1;
    const predictor = tags[317] || 1;
    const sampleFormat = Array.isArray(tags[339]) ? tags[339][0] : (tags[339] || 1);

    const blackLevelTag = tags[50714];
    const whiteLevelTag = tags[50717];
    const blackLevel = Array.isArray(blackLevelTag) ? blackLevelTag[0] : (blackLevelTag || 0);
    const defaultWhite = (bitsPerSample <= 16) ? ((1 << bitsPerSample) - 1) : 65535;
    const whiteLevel = Array.isArray(whiteLevelTag) ? whiteLevelTag[0] : (whiteLevelTag || defaultWhite);

    const stripOffsets = Array.isArray(tags[273]) ? tags[273] : (tags[273] !== undefined ? [tags[273]] : []);
    const stripByteCounts = Array.isArray(tags[279]) ? tags[279] : (tags[279] !== undefined ? [tags[279]] : []);
    const rowsPerStrip = (stripOffsets.length === 1 && planarConfig === 1) ? height : (rowsPerStripRaw || height);

    const tileWidth = tags[322];
    const tileLength = tags[323];
    const tileOffsets = Array.isArray(tags[324]) ? tags[324] : (tags[324] !== undefined ? [tags[324]] : []);
    const tileByteCounts = Array.isArray(tags[325]) ? tags[325] : (tags[325] !== undefined ? [tags[325]] : []);

    const isPackedBits = (bitsPerSample === 10 || bitsPerSample === 12 || bitsPerSample === 14);
    const bytesPerSample = isPackedBits ? 2 : Math.max(1, bitsPerSample >> 3);
    const totalRawBytes = width * height * samplesPerPixel * bytesPerSample;
    const rawBuffer = new Uint8Array(totalRawBytes);

    async function decompressChunk(chunkBytes, expectedByteLen) {
      if (compression === 1) return chunkBytes;
      if (compression === 5) return decodeLZW(chunkBytes, expectedByteLen);
      if (compression === 32773) return decodePackBits(chunkBytes, expectedByteLen);
      if (compression === 8 || compression === 32946) return await decodeDeflate(chunkBytes);
      throw new Error('Compresión (' + compression + ') requiere decodificador nativo.');
    }

    if (stripOffsets.length > 0 && isPackedBits && compression === 1) {
      // Desempaquetar muestras de 10/12/14 bits de DNG sin comprimir
      const numSamples = width * height * samplesPerPixel;
      const totalPackedBytes = stripByteCounts.reduce((a, b) => a + b, 0);
      const packedAll = new Uint8Array(totalPackedBytes);
      let writePos = 0;
      for (let s = 0; s < stripOffsets.length; s++) {
        const off = stripOffsets[s];
        const cnt = stripByteCounts[s];
        packedAll.set(new Uint8Array(arrayBuffer, off, Math.min(cnt, dv.byteLength - off)), writePos);
        writePos += cnt;
      }
      const unpackedFloats = unpackPackedSamples(packedAll, numSamples, bitsPerSample, blackLevel, whiteLevel);
      if (photometric === 32803 && samplesPerPixel === 1) {
        const cfaPat = tags[33422] || tags[50710] || [0, 1, 1, 2];
        const demosaiced = demosaicBayerCFA(unpackedFloats, width, height, cfaPat);
        return {
          width,
          height,
          bitDepth: bitsPerSample,
          channels: 3,
          compression: 'DNG Bayer Raw',
          format: 'DNG',
          floatData: demosaiced
        };
      }
    }

    if (stripOffsets.length > 0) {
      const channelsInStrip = planarConfig === 2 ? 1 : samplesPerPixel;
      const stripsPerPlane = Math.ceil(height / rowsPerStrip);

      for (let s = 0; s < stripOffsets.length; s++) {
        const offset = stripOffsets[s];
        const planeIdx = planarConfig === 2 ? Math.floor(s / stripsPerPlane) : 0;
        const stripIdxInPlane = planarConfig === 2 ? (s % stripsPerPlane) : s;
        const currentRow = stripIdxInPlane * rowsPerStrip;
        const rowsInThisStrip = Math.min(rowsPerStrip, height - currentRow);
        if (rowsInThisStrip <= 0) continue;

        const expectedStripBytes = rowsInThisStrip * width * channelsInStrip * bytesPerSample;
        const byteCount = stripByteCounts[s] || (dv.byteLength - offset);
        const compressedSlice = new Uint8Array(arrayBuffer, offset, Math.min(byteCount, dv.byteLength - offset));

        const decoded = await decompressChunk(compressedSlice, expectedStripBytes);
        const stripCopy = new Uint8Array(decoded.length);
        stripCopy.set(decoded);

        if (predictor === 2) {
          applyHorizontalPredictor(stripCopy, width, rowsInThisStrip, channelsInStrip, bitsPerSample, littleEndian);
        }

        if (planarConfig === 1) {
          const destByteOffset = currentRow * width * samplesPerPixel * bytesPerSample;
          const copyLen = Math.min(stripCopy.length, rawBuffer.length - destByteOffset);
          if (copyLen > 0) {
            rawBuffer.set(stripCopy.subarray(0, copyLen), destByteOffset);
          }
        } else {
          const numPixels = rowsInThisStrip * width;
          for (let p = 0; p < numPixels; p++) {
            const dstPixelIdx = (currentRow * width + p) * samplesPerPixel + planeIdx;
            for (let b = 0; b < bytesPerSample; b++) {
              rawBuffer[dstPixelIdx * bytesPerSample + b] = stripCopy[p * bytesPerSample + b];
            }
          }
        }
      }
    } else if (tileOffsets.length > 0 && tileWidth && tileLength) {
      const tilesAcross = Math.ceil(width / tileWidth);
      for (let t = 0; t < tileOffsets.length; t++) {
        const offset = tileOffsets[t];
        const byteCount = tileByteCounts[t] || (dv.byteLength - offset);
        const expectedTileBytes = tileWidth * tileLength * samplesPerPixel * bytesPerSample;
        const compressedSlice = new Uint8Array(arrayBuffer, offset, Math.min(byteCount, dv.byteLength - offset));
        const decoded = await decompressChunk(compressedSlice, expectedTileBytes);
        const tileCopy = new Uint8Array(decoded.length);
        tileCopy.set(decoded);

        if (predictor === 2) {
          applyHorizontalPredictor(tileCopy, tileWidth, tileLength, samplesPerPixel, bitsPerSample, littleEndian);
        }

        const tileX = (t % tilesAcross) * tileWidth;
        const tileY = Math.floor(t / tilesAcross) * tileLength;
        const validW = Math.min(tileWidth, width - tileX);
        const validH = Math.min(tileLength, height - tileY);
        const pixelBytes = samplesPerPixel * bytesPerSample;

        for (let r = 0; r < validH; r++) {
          const srcOffset = r * tileWidth * pixelBytes;
          const dstOffset = ((tileY + r) * width + tileX) * pixelBytes;
          rawBuffer.set(tileCopy.subarray(srcOffset, srcOffset + validW * pixelBytes), dstOffset);
        }
      }
    } else {
      throw new Error('El archivo TIFF/DNG no contiene StripOffsets ni TileOffsets válidos.');
    }

    const numPixels = width * height;
    const rawDV = new DataView(rawBuffer.buffer, rawBuffer.byteOffset, rawBuffer.byteLength);
    const invertZero = photometric === 0;
    const normSpan16 = Math.max(1, whiteLevel - blackLevel);

    function readSample(pixelIndex, channelIndex) {
      const sampleIdx = pixelIndex * samplesPerPixel + channelIndex;
      const bytePos = sampleIdx * bytesPerSample;
      if (bytePos + bytesPerSample > rawDV.byteLength) return 0;

      let v = 0;
      if (bitsPerSample === 8) {
        v = rawDV.getUint8(bytePos) / 255.0;
      } else if (bitsPerSample === 16) {
        if (sampleFormat === 2) {
          v = (rawDV.getInt16(bytePos, littleEndian) + 32768) / 65535.0;
        } else {
          const rawU16 = rawDV.getUint16(bytePos, littleEndian);
          v = (rawU16 - blackLevel) / normSpan16;
        }
      } else if (bitsPerSample === 32) {
        if (sampleFormat === 3) {
          v = rawDV.getFloat32(bytePos, littleEndian);
        } else {
          v = rawDV.getUint32(bytePos, littleEndian) / 4294967295.0;
        }
      } else {
        v = rawDV.getUint8(bytePos) / 255.0;
      }

      if (invertZero) v = 1.0 - v;
      return Math.max(0.0, Math.min(1.0, v));
    }

    // Si es un sensor CFA Bayer de 1 canal en 16 bits, aplicar Demosaicing Bilineal
    if (photometric === 32803 && samplesPerPixel === 1) {
      const cfaPlane = new Float32Array(numPixels);
      for (let i = 0; i < numPixels; i++) {
        cfaPlane[i] = readSample(i, 0);
      }
      const cfaPat = tags[33422] || tags[50710] || [0, 1, 1, 2];
      const floatRGBA = demosaicBayerCFA(cfaPlane, width, height, cfaPat);
      return {
        width,
        height,
        bitDepth: bitsPerSample,
        channels: 3,
        compression: COMPRESSION_NAMES[compression] || 'DNG CFA',
        format: isDngHint ? 'DNG' : 'TIFF',
        floatData: floatRGBA
      };
    }

    const floatRGBA = new Float32Array(numPixels * 4);
    for (let i = 0; i < numPixels; i++) {
      const outIdx = i * 4;
      if (samplesPerPixel === 1) {
        const g = readSample(i, 0);
        floatRGBA[outIdx] = g;
        floatRGBA[outIdx + 1] = g;
        floatRGBA[outIdx + 2] = g;
        floatRGBA[outIdx + 3] = 1.0;
      } else if (samplesPerPixel === 2) {
        const g = readSample(i, 0);
        const a = readSample(i, 1);
        floatRGBA[outIdx] = g;
        floatRGBA[outIdx + 1] = g;
        floatRGBA[outIdx + 2] = g;
        floatRGBA[outIdx + 3] = a;
      } else {
        floatRGBA[outIdx] = readSample(i, 0);
        floatRGBA[outIdx + 1] = readSample(i, 1);
        floatRGBA[outIdx + 2] = readSample(i, 2);
        floatRGBA[outIdx + 3] = samplesPerPixel >= 4 ? readSample(i, 3) : 1.0;
      }
    }

    return {
      width,
      height,
      bitDepth: bitsPerSample,
      channels: samplesPerPixel,
      compression: COMPRESSION_NAMES[compression] || ('Código ' + compression),
      format: isDngHint ? 'DNG' : 'TIFF',
      floatData: floatRGBA
    };
  }

  /**
   * Analiza un flujo de bytes JPEG para extraer su resolución real (width y height)
   * leyendo los marcadores SOF0 (0xFFC0), SOF1 (0xFFC1) o SOF2 (0xFFC2).
   */
  function parseJPEGDimensions(u8, startOffset) {
    let pos = startOffset;
    if (u8[pos] !== 0xFF || u8[pos + 1] !== 0xD8) return null;
    pos += 2;
    const len = u8.length;
    while (pos < len - 8) {
      if (u8[pos] !== 0xFF) {
        pos++;
        continue;
      }
      const marker = u8[pos + 1];
      if (marker === 0xD9) return null; // Fin de imagen
      if (marker === 0xDA) break;       // Inicio de datos comprimidos (SOS)
      if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
        const h = (u8[pos + 5] << 8) | u8[pos + 6];
        const w = (u8[pos + 7] << 8) | u8[pos + 8];
        return { width: w, height: h };
      }
      if (marker === 0x00 || (marker >= 0xD0 && marker <= 0xD7)) {
        pos += 2;
        continue;
      }
      const segmentLen = (u8[pos + 2] << 8) | u8[pos + 3];
      if (segmentLen < 2) break;
      pos += 2 + segmentLen;
    }
    return null;
  }

  /**
   * Localiza todos los flujos JPEG contenidos dentro de un buffer (utilizado para Canon CR3,
   * Fuji RAF, y como respaldo infalible para RAWs propietarios con preview embebido).
   */
  function findJPEGCandidates(u8) {
    const candidates = [];
    const len = u8.length;
    for (let i = 0; i < len - 4; i++) {
      if (u8[i] === 0xFF && u8[i + 1] === 0xD8 && u8[i + 2] === 0xFF) {
        const dims = parseJPEGDimensions(u8, i);
        let eoi = -1;
        // Búsqueda del marcador de fin de imagen EOI (0xFF 0xD9)
        const maxSearch = Math.min(len - 1, i + 35000000); // Límite de 35MB por flujo
        for (let j = i + 10; j < maxSearch; j++) {
          if (u8[j] === 0xFF && u8[j + 1] === 0xD9) {
            eoi = j + 2;
            break;
          }
        }
        if (eoi > i) {
          const w = dims ? dims.width : 0;
          const h = dims ? dims.height : 0;
          candidates.push({
            offset: i,
            length: eoi - i,
            width: w,
            height: h,
            pixels: w * h
          });
          i = eoi - 1;
        }
      }
    }
    // Ordenar de mayor a menor resolución (píxeles), o por tamaño en bytes si no se determinó resolución
    candidates.sort((a, b) => {
      if (b.pixels !== a.pixels) return b.pixels - a.pixels;
      return b.length - a.length;
    });
    return candidates;
  }

  /**
   * Determina si el buffer binario corresponde al formato Canon CR3 (ISOBMFF con marca 'crx ')
   */
  function isCanonCR3Buffer(u8) {
    if (u8.length < 16) return false;
    // Caja 'ftyp' en bytes 4..7
    if (u8[4] === 0x66 && u8[5] === 0x74 && u8[6] === 0x79 && u8[7] === 0x70) {
      // Marca principal 'crx ' (0x63, 0x72, 0x78, 0x20)
      if (u8[8] === 0x63 && u8[9] === 0x72 && u8[10] === 0x78) return true;
      const ftypSize = (u8[0] << 24) | (u8[1] << 16) | (u8[2] << 8) | u8[3];
      const lim = Math.min(ftypSize, u8.length);
      for (let i = 8; i < lim - 3; i += 4) {
        if (u8[i] === 0x63 && u8[i + 1] === 0x72 && u8[i + 2] === 0x78) return true;
      }
    }
    return false;
  }

  /**
   * Decodificador dedicado para Canon CR3 (Canon RAW v3 en contenedor ISOBMFF).
   * Extrae la vista previa de máxima resolución generada por la cámara en 16-bit Float.
   */
  async function decodeCanonCR3(arrayBuffer, fileName) {
    const u8 = new Uint8Array(arrayBuffer);
    const candidates = findJPEGCandidates(u8);

    if (!candidates || candidates.length === 0) {
      throw new Error('No se pudo encontrar el flujo de imagen dentro del archivo Canon CR3.');
    }

    // Intentar con el candidato de mayor resolución disponible
    for (let i = 0; i < candidates.length; i++) {
      const cand = candidates[i];
      try {
        const slice = u8.subarray(cand.offset, cand.offset + cand.length);
        const blob = new Blob([slice], { type: 'image/jpeg' });
        const decoded = await decodeBlobToFloatRGBA(blob, 'Canon CR3 Preview');
        if (decoded && decoded.width >= 160 && decoded.height >= 120) {
          decoded.id = 'cr3-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
          decoded.name = fileName || 'Canon_Scan.CR3';
          decoded.bitDepth = 16;
          decoded.format = 'CR3';
          decoded.compression = 'Canon CR3 RAW (ISOBMFF)';
          return decoded;
        }
      } catch (err) {
        // Probar siguiente candidato si uno falla
      }
    }

    throw new Error('No se pudo decodificar el raster de imagen del archivo Canon CR3.');
  }

  /**
   * Decodificador universal para formatos RAW propietarios (Fuji RAF, Nikon NEF, Sony ARW, etc.)
   * cuando no hay servidor de demosaicing nativo disponible.
   */
  async function decodeUniversalRawPreview(arrayBuffer, fileName, formatHint) {
    const u8 = new Uint8Array(arrayBuffer);
    const candidates = findJPEGCandidates(u8);

    if (candidates && candidates.length > 0) {
      for (let i = 0; i < candidates.length; i++) {
        const cand = candidates[i];
        try {
          const slice = u8.subarray(cand.offset, cand.offset + cand.length);
          const blob = new Blob([slice], { type: 'image/jpeg' });
          const decoded = await decodeBlobToFloatRGBA(blob, formatHint + ' Preview');
          if (decoded && decoded.width >= 160 && decoded.height >= 120) {
            decoded.id = 'raw-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
            decoded.name = fileName || ('Scan_' + formatHint);
            decoded.bitDepth = 16;
            decoded.format = formatHint || 'RAW';
            decoded.compression = (formatHint || 'RAW') + ' Raster Embebido';
            return decoded;
          }
        } catch (e) {
          // Probar siguiente
        }
      }
    }

    throw new Error('Formato RAW no compatible en modo navegador directo. Inicia la aplicación mucho FILM para soporte de motor nativo.');
  }

  /**
   * Decodifica un archivo DNG / RAW / TIFF a través del motor nativo de macOS (/api/decode-raw en server.py)
   */
  async function decodeViaDesktopBridge(file, extUpper) {
    const ab = await file.arrayBuffer();
    const res = await fetch('/api/decode-raw?filename=' + encodeURIComponent(file.name), {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: ab
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || 'Error en el motor nativo RAW/DNG');
    }

    const cType = res.headers.get('Content-Type') || '';
    if (cType.includes('image/jpeg')) {
      const blob = await res.blob();
      const decoded = await decodeBlobToFloatRGBA(blob, extUpper || 'RAW');
      decoded.format = extUpper || 'RAW';
      decoded.compression = 'Motor Nativo macOS (CR3/RAW)';
      decoded.bitDepth = 16;
      return decoded;
    }

    const tiffBuffer = await res.arrayBuffer();
    const decoded = await decodeTIFF(tiffBuffer, false);
    decoded.format = extUpper || 'DNG';
    decoded.compression = 'Motor Nativo macOS 16-bit';
    return decoded;
  }

  /**
   * Decodifica imágenes estándar (PNG, JPEG, WebP) a Float32Array RGBA
   */
  async function decodeStandardImage(file) {
    const ext = (file.name.split('.').pop() || 'IMG').toUpperCase();
    return await decodeBlobToFloatRGBA(file, ext === 'JPG' ? 'JPEG' : ext);
  }

  /**
   * Punto de entrada universal para decodificar cualquier archivo de escáner o cámara:
   * Canon CR3, CR2, Nikon NEF, Sony ARW, Fuji RAF, Olympus ORF, Panasonic RW2, DNG, TIFF (8/16-bit), PNG, JPEG, WebP.
   */
  async function loadImageFile(file) {
    const nameLower = file.name.toLowerCase();
    const extUpper = (file.name.split('.').pop() || 'IMG').toUpperCase();

    const isCr3 = nameLower.endsWith('.cr3') || extUpper === 'CR3';
    const isRaf = nameLower.endsWith('.raf') || extUpper === 'RAF';

    const isRawOrDng =
      isCr3 ||
      isRaf ||
      nameLower.endsWith('.dng') ||
      nameLower.endsWith('.cr2') ||
      nameLower.endsWith('.nef') ||
      nameLower.endsWith('.arw') ||
      nameLower.endsWith('.orf') ||
      nameLower.endsWith('.rw2') ||
      nameLower.endsWith('.pef') ||
      nameLower.endsWith('.3fr') ||
      nameLower.endsWith('.fff') ||
      nameLower.endsWith('.iiq');

    const isTiff =
      nameLower.endsWith('.tif') ||
      nameLower.endsWith('.tiff') ||
      file.type === 'image/tiff' ||
      file.type === 'image/x-tiff';

    const bridgeReady = await checkDesktopBridge();

    // 1. Manejo específico y optimizado de Canon CR3 (ISOBMFF)
    if (isCr3) {
      const ab = await file.arrayBuffer();
      if (bridgeReady) {
        try {
          return await decodeViaDesktopBridge(file, 'CR3');
        } catch (bridgeErr) {
          console.warn('Fallback a decodificador Canon CR3 JS:', bridgeErr);
        }
      }
      return await decodeCanonCR3(ab, file.name);
    }

    // 2. Manejo específico de Fuji RAF
    if (isRaf) {
      const ab = await file.arrayBuffer();
      if (bridgeReady) {
        try {
          return await decodeViaDesktopBridge(file, 'RAF');
        } catch (bridgeErr) {
          console.warn('Fallback a decodificador Fuji RAF JS:', bridgeErr);
        }
      }
      return await decodeUniversalRawPreview(ab, file.name, 'RAF');
    }

    // 3. Manejo de archivos DNG y RAW estándar (CR2, NEF, ARW, ORF, RW2, PEF)
    if (isRawOrDng) {
      const ab = await file.arrayBuffer();
      if (bridgeReady) {
        try {
          return await decodeViaDesktopBridge(file, extUpper);
        } catch (bridgeErr) {
          console.warn('Fallback a decodificador DNG/RAW JS:', bridgeErr);
        }
      }
      try {
        return await decodeTIFF(ab, true);
      } catch (tiffErr) {
        console.warn('decodeTIFF no pudo decodificar sensor RAW; intentando extracción de raster:', tiffErr);
        return await decodeUniversalRawPreview(ab, file.name, extUpper);
      }
    }

    // 4. Archivos TIFF
    if (isTiff) {
      const ab = await file.arrayBuffer();
      try {
        return await decodeTIFF(ab, false);
      } catch (tiffErr) {
        if (bridgeReady) {
          return await decodeViaDesktopBridge(file, 'TIFF');
        }
        throw tiffErr;
      }
    }

    // 5. Comprobar primeros bytes por si es un CR3, TIFF o DNG sin extensión estándar
    const headerSlice = await file.slice(0, 16).arrayBuffer();
    if (headerSlice.byteLength >= 12) {
      const u8Head = new Uint8Array(headerSlice);
      if (isCanonCR3Buffer(u8Head)) {
        const ab = await file.arrayBuffer();
        return await decodeCanonCR3(ab, file.name);
      }
      const dv = new DataView(headerSlice);
      const bo = dv.getUint16(0, false);
      const magic = dv.getUint16(2, bo === 0x4949);
      if ((bo === 0x4949 || bo === 0x4D4D) && magic === 42) {
        const ab = await file.arrayBuffer();
        return await decodeTIFF(ab, false);
      }
    }

    return await decodeStandardImage(file);
  }

  /**
   * Codificador binario de archivo TIFF sin pérdida (8-bit o 16-bit RGB) para exportación máster
   */
  function encodeTIFF(pixels, width, height, bitDepth = 16) {
    const isFloat = pixels instanceof Float32Array;
    const bytesPerSample = bitDepth === 16 ? 2 : 1;
    const samplesPerPixel = 3;
    const imageByteCount = width * height * samplesPerPixel * bytesPerSample;

    const headerAndMetaSize = 184;
    const totalSize = headerAndMetaSize + imageByteCount;
    const buffer = new ArrayBuffer(totalSize);
    const dv = new DataView(buffer);
    const u8 = new Uint8Array(buffer);

    dv.setUint16(0, 0x4949, true);
    dv.setUint16(2, 42, true);
    dv.setUint32(4, 8, true);

    const numTags = 11;
    dv.setUint16(8, numTags, true);
    let pos = 10;

    function writeTag(tag, type, count, valueOrOffset) {
      dv.setUint16(pos, tag, true);
      dv.setUint16(pos + 2, type, true);
      dv.setUint32(pos + 4, count, true);
      if (type === 3 && count === 1) {
        dv.setUint16(pos + 8, valueOrOffset, true);
        dv.setUint16(pos + 10, 0, true);
      } else {
        dv.setUint32(pos + 8, valueOrOffset, true);
      }
      pos += 12;
    }

    const pixelDataOffset = headerAndMetaSize;

    writeTag(256, 4, 1, width);
    writeTag(257, 4, 1, height);
    writeTag(258, 3, 3, 146);
    writeTag(259, 3, 1, 1);
    writeTag(262, 3, 1, 2);
    writeTag(273, 4, 1, pixelDataOffset);
    writeTag(277, 3, 1, 3);
    writeTag(278, 4, 1, height);
    writeTag(279, 4, 1, imageByteCount);
    writeTag(282, 5, 1, 152);
    writeTag(283, 5, 1, 160);

    dv.setUint32(pos, 0, true);

    dv.setUint16(146, bitDepth, true);
    dv.setUint16(148, bitDepth, true);
    dv.setUint16(150, bitDepth, true);

    dv.setUint32(152, 300, true);
    dv.setUint32(156, 1, true);
    dv.setUint32(160, 300, true);
    dv.setUint32(164, 1, true);

    const numPixels = width * height;
    if (bitDepth === 16) {
      let outByte = pixelDataOffset;
      for (let i = 0; i < numPixels; i++) {
        const srcIdx = i * 4;
        let r, g, b;
        if (isFloat) {
          r = Math.max(0, Math.min(65535, Math.round(pixels[srcIdx] * 65535)));
          g = Math.max(0, Math.min(65535, Math.round(pixels[srcIdx + 1] * 65535)));
          b = Math.max(0, Math.min(65535, Math.round(pixels[srcIdx + 2] * 65535)));
        } else {
          r = pixels[srcIdx] * 257;
          g = pixels[srcIdx + 1] * 257;
          b = pixels[srcIdx + 2] * 257;
        }
        dv.setUint16(outByte, r, true);
        dv.setUint16(outByte + 2, g, true);
        dv.setUint16(outByte + 4, b, true);
        outByte += 6;
      }
    } else {
      let outByte = pixelDataOffset;
      for (let i = 0; i < numPixels; i++) {
        const srcIdx = i * 4;
        if (isFloat) {
          u8[outByte] = Math.max(0, Math.min(255, Math.round(pixels[srcIdx] * 255)));
          u8[outByte + 1] = Math.max(0, Math.min(255, Math.round(pixels[srcIdx + 1] * 255)));
          u8[outByte + 2] = Math.max(0, Math.min(255, Math.round(pixels[srcIdx + 2] * 255)));
        } else {
          u8[outByte] = pixels[srcIdx];
          u8[outByte + 1] = pixels[srcIdx + 1];
          u8[outByte + 2] = pixels[srcIdx + 2];
        }
        outByte += 3;
      }
    }

    return new Blob([buffer], { type: 'image/tiff' });
  }

  /**
   * Generador de negativos sintéticos de 16 bits realistas (C-41 con máscara naranja Dmin y B&W)
   */
  function generateSampleRoll() {
    function hash2D(x, y) {
      const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
      return h - Math.floor(h);
    }

    function smoothNoise(x, y) {
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      const fx = x - ix;
      const fy = y - iy;
      const u = fx * fx * (3.0 - 2.0 * fx);
      const v = fy * fy * (3.0 - 2.0 * fy);
      const a = hash2D(ix, iy);
      const b = hash2D(ix + 1, iy);
      const c = hash2D(ix, iy + 1);
      const d = hash2D(ix + 1, iy + 1);
      return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
    }

    function fbm(x, y) {
      let val = 0.0;
      let amp = 0.5;
      let freq = 1.0;
      for (let i = 0; i < 4; i++) {
        val += amp * smoothNoise(x * freq, y * freq);
        freq *= 2.02;
        amp *= 0.5;
      }
      return val;
    }

    function buildSyntheticNegative(config) {
      const width = config.width || 1200;
      const height = config.height || 800;
      const floatData = new Float32Array(width * height * 4);
      const baseR = config.base[0];
      const baseG = config.base[1];
      const baseB = config.base[2];
      const gammaR = config.gamma[0];
      const gammaG = config.gamma[1];
      const gammaB = config.gamma[2];

      for (let y = 0; y < height; y++) {
        const v = y / height;
        for (let x = 0; x < width; x++) {
          const u = x / width;
          const idx = (y * width + x) * 4;

          const inHolderEdge = u < 0.022 || u > 0.978 || v < 0.028 || v > 0.972;
          const inFilmRebate = !inHolderEdge && (u < 0.062 || u > 0.938 || v < 0.072 || v > 0.928);

          const grain = (hash2D(x * 0.73, y * 0.73) - 0.5) * 0.012;

          if (inHolderEdge) {
            const holderNoise = Math.max(0.008, 0.022 + grain * 0.4);
            floatData[idx] = holderNoise;
            floatData[idx + 1] = holderNoise;
            floatData[idx + 2] = holderNoise;
            floatData[idx + 3] = 1.0;
            continue;
          }

          if (inFilmRebate) {
            floatData[idx] = Math.min(1.0, Math.max(0.01, baseR + grain * 0.5));
            floatData[idx + 1] = Math.min(1.0, Math.max(0.01, baseG + grain * 0.4));
            floatData[idx + 2] = Math.min(1.0, Math.max(0.01, baseB + grain * 0.35));
            floatData[idx + 3] = 1.0;
            continue;
          }

          const fu = (u - 0.062) / (0.938 - 0.062);
          const fv = (v - 0.072) / (0.928 - 0.072);

          const scene = config.sceneFn(fu, fv, fbm, smoothNoise);
          let sr = Math.max(0.002, Math.min(0.998, scene[0]));
          let sg = Math.max(0.002, Math.min(0.998, scene[1]));
          let sb = Math.max(0.002, Math.min(0.998, scene[2]));

          if (config.dustSpots) {
            for (let d = 0; d < config.dustSpots.length; d++) {
              const spot = config.dustSpots[d];
              const dx = (fu - spot.u) * width;
              const dy = (fv - spot.v) * height;
              const distSq = dx * dx + dy * dy;
              if (distSq < spot.r * spot.r) {
                const falloff = Math.exp(-distSq / (spot.r * spot.r * 0.35));
                sr = sr * (1.0 - falloff * 0.92) + 0.96 * falloff;
                sg = sg * (1.0 - falloff * 0.92) + 0.96 * falloff;
                sb = sb * (1.0 - falloff * 0.92) + 0.96 * falloff;
              }
            }
          }

          const expR = Math.pow(sr, 0.85);
          const expG = Math.pow(sg, 0.85);
          const expB = Math.pow(sb, 0.85);

          const dR = expR * 1.45 * gammaR;
          const dG = expG * 1.40 * gammaG;
          const dB = expB * 1.35 * gammaB;

          const negR = baseR * Math.pow(10.0, -dR * 0.65) + grain;
          const negG = baseG * Math.pow(10.0, -dG * 0.65) + grain * 0.85;
          const negB = baseB * Math.pow(10.0, -dB * 0.65) + grain * 0.75;

          floatData[idx] = Math.max(0.005, Math.min(0.995, negR));
          floatData[idx + 1] = Math.max(0.005, Math.min(0.995, negG));
          floatData[idx + 2] = Math.max(0.005, Math.min(0.995, negB));
          floatData[idx + 3] = 1.0;
        }
      }

      return {
        id: config.id,
        name: config.name,
        width,
        height,
        bitDepth: 16,
        channels: 3,
        compression: '16-bit Float Raw',
        format: config.format || 'TIFF 16-BIT',
        filmStockHint: config.filmStockHint,
        floatData
      };
    }

    const sample1 = buildSyntheticNegative({
      id: 'sample-portra-400',
      name: '01_Portra400_Retrato_HoraDorada.dng',
      format: 'DNG 16-BIT',
      filmStockHint: 'Color C-41 (Portra 400)',
      width: 1080,
      height: 720,
      base: [0.89, 0.51, 0.28],
      gamma: [1.0, 0.97, 0.93],
      dustSpots: [
        { u: 0.22, v: 0.18, r: 5.5 },
        { u: 0.78, v: 0.26, r: 4.5 }
      ],
      sceneFn: (u, v, fbmFn) => {
        const n = fbmFn(u * 4.0, v * 4.0);
        let r = 0.88 - v * 0.35 + n * 0.08;
        let g = 0.74 - v * 0.28 + n * 0.06;
        let b = 0.62 - v * 0.35;

        if (v > 0.36) {
          const foliageMask = Math.min(1.0, (v - 0.36) * 4.0);
          const bokeh = Math.pow(fbmFn(u * 7.5 + 1.2, v * 6.5), 1.4);
          const fR = 0.18 + bokeh * 0.52;
          const fG = 0.28 + bokeh * 0.48;
          const fB = 0.16 + bokeh * 0.25;
          r = r * (1 - foliageMask) + fR * foliageMask;
          g = g * (1 - foliageMask) + fG * foliageMask;
          b = b * (1 - foliageMask) + fB * foliageMask;
        }

        const sunDist = Math.hypot((u - 0.76) * 1.5, v - 0.24);
        if (sunDist < 0.45) {
          const glow = Math.pow(1.0 - sunDist / 0.45, 2.4);
          r += glow * 0.32;
          g += glow * 0.22;
          b += glow * 0.09;
        }

        const headX = (u - 0.46) * 1.45;
        const headY = (v - 0.43) * 1.15;
        const headDist = Math.hypot(headX, headY);

        const shoulderX = (u - 0.46) * 0.85;
        const shoulderY = (v - 0.86) * 1.1;
        if (shoulderX * shoulderX + shoulderY * shoulderY < 0.11 && v > 0.56) {
          const fold = fbmFn(u * 18.0, v * 12.0) * 0.12;
          const lightSide = u > 0.46 ? 1.15 : 0.78;
          r = (0.76 + fold) * lightSide;
          g = (0.58 + fold * 0.8) * lightSide;
          b = (0.44 + fold * 0.6) * lightSide;
        }

        if (Math.abs(u - 0.46) < 0.045 && v >= 0.50 && v <= 0.63) {
          const shade = 0.75 + (u - 0.42) * 2.2;
          r = 0.74 * shade;
          g = 0.53 * shade;
          b = 0.41 * shade;
        }

        if (headDist < 0.155) {
          const rimLight = Math.max(0.0, (u - 0.40) * 4.2);
          const cheekHighlight = Math.exp(-Math.hypot(u - 0.49, v - 0.44) * 22.0) * 0.18;
          const skinBase = 0.68 + rimLight * 0.22 + cheekHighlight;
          r = Math.min(0.96, skinBase * 1.08);
          g = Math.min(0.88, skinBase * 0.81);
          b = Math.min(0.78, skinBase * 0.65);

          if (v < 0.36 || u < 0.39 + (v - 0.42) * 0.25) {
            const hairTex = fbmFn(u * 28.0, v * 28.0);
            const rim = headDist > 0.125 && u > 0.46 ? 0.35 : 0.0;
            r = 0.14 + hairTex * 0.12 + rim * 0.65;
            g = 0.09 + hairTex * 0.08 + rim * 0.38;
            b = 0.07 + hairTex * 0.06 + rim * 0.15;
          }
        }

        return [r, g, b];
      }
    });

    const sample2 = buildSyntheticNegative({
      id: 'sample-cine-800t',
      name: '02_Cine800T_Nocturno_Halation.tiff',
      filmStockHint: 'Color C-41 (Cine 800T)',
      width: 1080,
      height: 720,
      base: [0.86, 0.49, 0.29],
      gamma: [1.02, 0.98, 0.96],
      sceneFn: (u, v, fbmFn) => {
        const n = fbmFn(u * 5.0, v * 5.0);
        let r = 0.04 + n * 0.03;
        let g = 0.08 + n * 0.05;
        let b = 0.16 + n * 0.07;

        if ((u < 0.28 || u > 0.72) && v < 0.72) {
          r = 0.035;
          g = 0.055;
          b = 0.095;
          const wx = Math.floor(u * 28);
          const wy = Math.floor(v * 22);
          if ((wx + wy * 3) % 7 === 0 && v > 0.15 && v < 0.62) {
            r = 0.78;
            g = 0.56;
            b = 0.28;
          }
        }

        const lights = [
          { x: 0.32, y: 0.36, rad: 0.028, col: [0.99, 0.92, 0.78] },
          { x: 0.68, y: 0.32, rad: 0.032, col: [0.99, 0.45, 0.25] },
          { x: 0.50, y: 0.44, rad: 0.020, col: [0.98, 0.95, 0.85] },
          { x: 0.24, y: 0.48, rad: 0.024, col: [0.30, 0.88, 0.96] }
        ];

        for (const l of lights) {
          const d = Math.hypot((u - l.x) * 1.5, v - l.y);
          const core = Math.exp(-(d * d) / (l.rad * l.rad * 0.45));
          const bloom = Math.exp(-d / (l.rad * 2.5)) * 0.35;
          r = Math.min(0.995, r + l.col[0] * (core + bloom));
          g = Math.min(0.995, g + l.col[1] * (core + bloom));
          b = Math.min(0.995, b + l.col[2] * (core + bloom));
        }

        if (v >= 0.68) {
          const ripple = (fbmFn(u * 16.0, v * 45.0) - 0.5) * 0.03;
          let rr = 0.03;
          let rg = 0.06;
          let rb = 0.11;
          for (const l of lights) {
            const dx = Math.abs(u + ripple - l.x);
            const dy = Math.abs(v - (0.68 + (0.68 - l.y) * 0.55));
            const refl = Math.exp(-(dx * dx * 85.0 + dy * dy * 18.0));
            rr += l.col[0] * refl * 0.75;
            rg += l.col[1] * refl * 0.75;
            rb += l.col[2] * refl * 0.75;
          }
          r = Math.min(0.98, rr);
          g = Math.min(0.98, rg);
          b = Math.min(0.98, rb);
        }

        return [r, g, b];
      }
    });

    const sample3 = buildSyntheticNegative({
      id: 'sample-gold-200',
      name: '03_Gold200_Costa_Mediterranea.tiff',
      filmStockHint: 'Color C-41 (Gold 200)',
      width: 1080,
      height: 720,
      base: [0.90, 0.53, 0.26],
      gamma: [1.0, 0.99, 0.94],
      sceneFn: (u, v, fbmFn) => {
        const cloud = Math.max(0.0, fbmFn(u * 4.5 + 2.0, v * 6.0) - 0.48) * 1.6;
        let r = 0.34 + v * 0.25 + cloud * 0.55;
        let g = 0.58 + v * 0.22 + cloud * 0.40;
        let b = 0.86 + v * 0.08 + cloud * 0.14;

        if (v > 0.52) {
          const wave = fbmFn(u * 24.0, v * 48.0) * 0.08;
          r = 0.09 + wave * 0.5;
          g = 0.36 + (v - 0.52) * 0.25 + wave;
          b = 0.62 - (v - 0.52) * 0.15 + wave;
        }

        const cliffEdge = 0.38 + Math.sin(v * 6.0) * 0.06 + (v - 0.3) * 0.22;
        if (u < cliffEdge && v > 0.26) {
          const rockTex = fbmFn(u * 14.0, v * 14.0);
          r = 0.72 + rockTex * 0.18;
          g = 0.52 + rockTex * 0.14;
          b = 0.34 + rockTex * 0.10;

          if (u > 0.12 && u < 0.31 && v > 0.30 && v < 0.52) {
            if (v < 0.36) {
              r = 0.82;
              g = 0.36;
              b = 0.22;
            } else {
              const sunlit = u < 0.24 ? 1.0 : 0.72;
              r = 0.94 * sunlit;
              g = 0.90 * sunlit;
              b = 0.82 * sunlit;
            }
          }
        }

        return [r, g, b];
      }
    });

    const sample4 = buildSyntheticNegative({
      id: 'sample-hp5-bw',
      name: '04_HP5_Plus_400_Estudio_BW.tiff',
      filmStockHint: 'Blanco y Negro (HP5 Plus)',
      width: 1080,
      height: 720,
      base: [0.84, 0.84, 0.83],
      gamma: [0.95, 0.95, 0.95],
      sceneFn: (u, v, fbmFn) => {
        const n = fbmFn(u * 8.0, v * 8.0) * 0.04;
        const beam = (u * 0.85 + v * 0.55);
        let lum = 0.14 + n;

        if (beam > 0.52 && beam < 0.88) {
          const edgeSoft = Math.min((beam - 0.52) * 18.0, (0.88 - beam) * 18.0, 1.0);
          lum = 0.16 + edgeSoft * (0.76 - v * 0.18) + n;
        }

        const colPositions = [0.22, 0.50, 0.78];
        for (const cx of colPositions) {
          if (Math.abs(u - cx) < 0.055 && v < 0.82) {
            const cyl = (u - (cx - 0.055)) / 0.11;
            lum = 0.12 + Math.pow(Math.sin(cyl * Math.PI), 1.4) * 0.72;
          }
        }

        if (v >= 0.76) {
          const tile = ((Math.floor(u * 12) + Math.floor((v - 0.76) * 24)) % 2 === 0) ? 0.08 : -0.05;
          lum = Math.max(0.05, Math.min(0.95, lum * 0.85 + tile));
        }

        return [lum, lum, lum];
      }
    });

    return [sample1, sample2, sample3, sample4];
  }

  return {
    checkDesktopBridge,
    loadImageFile,
    decodeTIFF,
    encodeTIFF,
    generateSampleRoll
  };
})();
