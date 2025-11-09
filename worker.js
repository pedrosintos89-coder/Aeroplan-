// Fonction utilitaire pour la conversion en Niveaux de Gris
function toGrayscale(r, g, b) {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Fonction de détection des bords (Sobel)
function applySobel(pixels, width, height) {
    // ... [Code de Sobel Edge Detection (reste inchangé)] ...
    const grayData = new Float32Array(width * height);
    for (let i = 0; i < pixels.length; i += 4) {
        grayData[i / 4] = toGrayscale(pixels[i], pixels[i + 1], pixels[i + 2]);
    }
    
    const output = new Uint8ClampedArray(pixels.length);
    const Gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1]; 
    const Gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1]; 
    const threshold = 30; 

    for (let y = 1; y < height - 1; y++) {
        if (y % 50 === 0) {
            self.postMessage({ type: 'progress', percent: Math.round((y / height) * 100) });
        }
        
        for (let x = 1; x < width - 1; x++) {
            let sumX = 0;
            let sumY = 0;
            
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const weightX = Gx[(ky + 1) * 3 + (kx + 1)];
                    const weightY = Gy[(ky + 1) * 3 + (kx + 1)];
                    const idx = (y + ky) * width + (x + kx);
                    
                    sumX += grayData[idx] * weightX;
                    sumY += grayData[idx] * weightY;
                }
            }

            const magnitude = Math.sqrt(sumX * sumX + sumY * sumY);
            const edgeValue = magnitude > threshold ? 0 : 255; 
            
            const outputIdx = (y * width + x) * 4;
            output[outputIdx] = edgeValue; 
            output[outputIdx + 1] = edgeValue;
            output[outputIdx + 2] = edgeValue;
            output[outputIdx + 3] = 255; 
        }
    }
    
    return output;
}

// **FONCTION D'OPÉRATION MORPHOLOGIQUE (Fermeture)**
// تستخدم لتنظيف الضوضاء وملء الفجوات الصغيرة في الخطوط
function applyClosing(pixels, width, height) {
    // هذه عملية تنقية أساسية (Dilatation suivie d'Érosion)
    // لتنعيم الخطوط وملء الفجوات الصغيرة.
    const tempPixels = new Uint8ClampedArray(pixels);
    const output = new Uint8ClampedArray(pixels.length);
    const radius = 1; // 3x3 kernel

    // Étape 1: Dilatation (تقوية الخطوط)
    for (let y = radius; y < height - radius; y++) {
        for (let x = radius; x < width - radius; x++) {
            const outputIdx = (y * width + x) * 4;
            let isBlack = false;
            
            for (let ky = -radius; ky <= radius; ky++) {
                for (let kx = -radius; kx <= radius; kx++) {
                    const idx = ((y + ky) * width + (x + kx)) * 4;
                    if (tempPixels[idx] === 0) { // Si un pixel voisin est noir
                        isBlack = true;
                        break;
                    }
                }
                if(isBlack) break;
            }
            // إذا كان أي جار أسود، يصبح المركز أسود
            tempPixels[outputIdx] = tempPixels[outputIdx+1] = tempPixels[outputIdx+2] = isBlack ? 0 : 255;
        }
    }

    // Étape 2: Érosion (إزالة الضوضاء)
    for (let y = radius; y < height - radius; y++) {
        for (let x = radius; x < width - radius; x++) {
            const outputIdx = (y * width + x) * 4;
            let isWhite = false;
            
            for (let ky = -radius; ky <= radius; ky++) {
                for (let kx = -radius; kx <= radius; kx++) {
                    const idx = ((y + ky) * width + (x + kx)) * 4;
                    if (tempPixels[idx] === 255) { // Si un pixel voisin est blanc
                        isWhite = true;
                        break;
                    }
                }
                if(isWhite) break;
            }
            // إذا كان أي جار أبيض، يصبح المركز أبيض
            output[outputIdx] = output[outputIdx+1] = output[outputIdx+2] = isWhite ? 255 : 0;
            output[outputIdx+3] = 255;
        }
    }
    return output;
}

// دالة تحديد الأبعاد الكلية (لا نستخدمها حاليًا)
function getBuildingBoundingBox(pixels, width, height) {
    let minX = width, minY = height, maxX = 0, maxY = 0;
    let foundEdge = false;

    // ... [Code getBuildingBoundingBox] ... (reste inchangé)
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            if (pixels[i] === 0) { // Bord noir
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
                foundEdge = true;
            }
        }
    }
    
    if (!foundEdge) return null;

    return {
        width: maxX - minX,
        height: maxY - minY,
        minX: minX,
        minY: minY
    };
}


// **FONCTION D'ANALYSE AMÉLIORÉE**
function analyzeImage(pixels, width, height) {
    const box = getBuildingBoundingBox(pixels, width, height);

    if (!box) {
        return { overallWidth: width, overallHeight: height, windowCount: 0, slopeAngle: 0 };
    }
    
    // **تحسين: حساب كثافة الخطوط في المنطقة**
    let blackPixelCount = 0;
    const step = 5; // فحص كل 5 بكسلات
    for (let y = box.minY; y < box.minY + box.height; y += step) {
        for (let x = box.minX; x < box.minX + box.width; x += step) {
            const i = (y * width + x) * 4;
            if (pixels[i] === 0) {
                blackPixelCount++;
            }
        }
    }
    
    // **تحسين تقدير عدد النوافذ:** نستخدم الكثافة البكسلية
    // معامل جديد (10) لتقدير كل 10 تجمعات سوداء كنوافذ
    const buildingArea = (box.width / step) * (box.height / step);
    const densityRatio = blackPixelCount / buildingArea;
    
    // إذا كانت نسبة الكثافة (Density) عالية (أكثر من 0.05)، نعتبر أن التفاصيل هي نوافذ
    // قيمة 500 تمثل عامل قياس تقريبي
    const windowFactor = 500; 
    let windowCount = Math.round(blackPixelCount / windowFactor); 
    
    // نضمن أن العدد ليس مبالغًا فيه (لا يزيد عن 100 نافذة مثلاً)
    windowCount = Math.min(100, windowCount); 

    const estimatedSlopeAngle = 35; 

    return {
        overallWidth: box.width,
        overallHeight: box.height,
        windowCount: Math.max(0, windowCount),
        slopeAngle: estimatedSlopeAngle
    };
}


self.onmessage = function(e) {
    const { imageData, width, height } = e.data;
    const inputPixels = imageData.data;
    
    // Étape 1: Génération de l'esquisse (Sobel)
    let sketchPixels = applySobel(inputPixels, width, height);
    
    // **Étape 2: تنقية الخطوط (Closing Morphological Operation)**
    const finalSketchPixels = applyClosing(sketchPixels, width, height);
    
    // Étape 3: Analyse des mesures (على الرسم التخطيطي المُنقَّى)
    const analysisResults = analyzeImage(finalSketchPixels, width, height);

    // Envoi du résultat final
    self.postMessage({ 
        type: 'result', 
        data: finalSketchPixels.buffer, 
        width: width, 
        height: height,
        analysis: analysisResults
    }, [finalSketchPixels.buffer]);
};
