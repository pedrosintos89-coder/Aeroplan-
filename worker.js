// Fonction utilitaire pour la conversion en Niveaux de Gris
function toGrayscale(r, g, b) {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Fonction de détection des bords (Sobel)
function applySobel(pixels, width, height) {
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

// **تم إزالة دالة applyClosing**


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


// **FONCTION D'ANALYSE AMÉLIORÉE (تبقى كما هي)**
function analyzeImage(pixels, width, height) {
    const box = getBuildingBoundingBox(pixels, width, height);

    if (!box) {
        return { overallWidth: width, overallHeight: height, windowCount: 0, slopeAngle: 0 };
    }
    
    // حساب كثافة الخطوط في المنطقة
    let blackPixelCount = 0;
    const step = 5; 
    for (let y = box.minY; y < box.minY + box.height; y += step) {
        for (let x = box.minX; x < box.minX + box.width; x += step) {
            const i = (y * width + x) * 4;
            if (pixels[i] === 0) {
                blackPixelCount++;
            }
        }
    }
    
    // تقدير عدد النوافذ (نفس المعادلة التي أعطت 71)
    const windowFactor = 500; 
    let windowCount = Math.round(blackPixelCount / windowFactor); 
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
    // نستخدم مخرجات Sobel مباشرة كـ finalSketchPixels
    const finalSketchPixels = applySobel(inputPixels, width, height); 
    
    // **Étape 2: تم حذف خطوة التنقية (applyClosing)**

    // Étape 3: Analyse des mesures (على الرسم التخطيطي الأصلي لـ Sobel)
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
