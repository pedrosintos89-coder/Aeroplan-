// Fonction utilitaire pour la conversion en Niveaux de Gris
function toGrayscale(r, g, b) {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// FONCTION: Utilisation de Sobel avec un Seuil Optimisé (30)
function applyOptimizedSobel(pixels, width, height) {
    const grayData = new Float32Array(width * height);
    for (let i = 0; i < pixels.length; i += 4) {
        grayData[i / 4] = toGrayscale(pixels[i], pixels[i + 1], pixels[i + 2]);
    }
    
    const output = new Uint8ClampedArray(pixels.length);
    const Gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1]; 
    const Gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1]; 
    const threshold = 30; // Seuil Optimisé

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
                    const idx = (y * width + x + kx + ky * width); 
                    
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

// [getBuildingBoundingBox reste inchangée]
function getBuildingBoundingBox(pixels, width, height) {
    let minX = width, minY = height, maxX = 0, maxY = 0;
    let foundEdge = false;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            if (pixels[i] === 0) { 
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
                foundEdge = true;
            }
        }
    }
    
    if (!foundEdge) return null;

    const margin = 5;
    minX = Math.max(0, minX - margin);
    minY = Math.max(0, minY - margin);
    maxX = Math.min(width, maxX + margin);
    maxY = Math.min(height, maxY + margin);

    return {
        width: maxX - minX,
        height: maxY - minY,
        minX: minX,
        minY: minY
    };
}


// **دالة التحليل المُحسَّنة بمدخلات الذكاء الاصطناعي المساعد**
function analyzeImage(pixels, width, height, scaleFactor, floorCount, windowType) {
    const box = getBuildingBoundingBox(pixels, width, height);
    const scale = scaleFactor || 100; 
    const floors = floorCount || 1; 

    if (!box) {
        return { 
            overallWidth: width, 
            overallHeight: height, 
            windowCount: 0, 
            squareWindowWidth: 0, 
            slopeAngle: 0,
            widthMeters: 0,
            heightMeters: 0,
            squareWindowWidthMeters: 0,
            floorCount: floors,
            windowType: windowType,
            floorHeightMeters: 0 
        };
    }
    
    // حساب كثافة الخطوط لتقدير عدد النوافذ
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
    
    const windowFactor = 200; 
    let windowCount = Math.round(blackPixelCount / windowFactor); 
    windowCount = Math.max(1, Math.min(100, windowCount)); 

    const aspect = box.width / box.height;
    let estimatedSlopeAngle = 35; 
    if (aspect > 1.2) {
        estimatedSlopeAngle = 30; 
    } else if (aspect < 0.8) {
        estimatedSlopeAngle = 40; 
    }
    
    const estimatedWindowWidth = Math.round(box.width / (windowCount * 2)) || 20; 

    // **تحويل القياسات الأساسية**
    const widthMeters = box.width / scale;
    const heightMeters = box.height / scale;
    const squareWindowWidthMeters = estimatedWindowWidth / scale;
    
    // **القاعدة الهندسية المعتمدة على مدخلات AI (ارتفاع الطابق)**
    // استخدام عدد الطوابق (floors) لتقدير ارتفاع الطابق
    const floorHeightMeters = heightMeters / floors;

    return {
        overallWidth: box.width,
        overallHeight: box.height,
        windowCount: windowCount,
        slopeAngle: estimatedSlopeAngle,
        squareWindowWidth: estimatedWindowWidth, 
        // نتائج الذكاء الاصطناعي المساعد
        floorCount: floors,
        windowType: windowType === 'arched' ? 'Arrondie/Cintrée' : 'Carrée',
        // القياسات النهائية
        widthMeters: widthMeters,
        heightMeters: heightMeters,
        squareWindowWidthMeters: squareWindowWidthMeters,
        floorHeightMeters: floorHeightMeters
    };
}


self.onmessage = function(e) {
    // استقبال مدخلات الذكاء الاصطناعي المساعد
    const { imageData, width, height, scaleFactor, floorCount, windowType } = e.data; 
    const originalPixels = imageData.data;
    
    // توليد المخطط (Sobel المحسّن)
    const finalSketchPixels = applyOptimizedSobel(originalPixels, width, height); 
    
    // تحليل القياسات (تضمين مدخلات AI)
    const analysisResults = analyzeImage(finalSketchPixels, width, height, scaleFactor, floorCount, windowType);

    self.postMessage({ 
        type: 'result', 
        data: finalSketchPixels.buffer, 
        width: width, 
        height: height,
        analysis: analysisResults
    }, [finalSketchPixels.buffer]);
};
