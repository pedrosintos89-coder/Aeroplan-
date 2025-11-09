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
    const threshold = 30; // Seuil optimisé pour les images aériennes

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

// Fonction pour déterminer les limites réelles du bâtiment (Bounding Box)
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

    // إضافة هامش صغير لتحسين التقاط الأبعاد
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


// FONCTION D'ANALYSE AMÉLIORÉE
function analyzeImage(pixels, width, height, scaleFactor) {
    const box = getBuildingBoundingBox(pixels, width, height);
    const scale = scaleFactor || 100; 

    if (!box) {
        return { 
            overallWidth: width, 
            overallHeight: height, 
            windowCount: 0, 
            squareWindowWidth: 0, 
            roundedWindowCount: 0,
            slopeAngle: 0,
            widthMeters: 0,
            heightMeters: 0,
            squareWindowWidthMeters: 0
        };
    }
    
    // حساب كثافة الخطوط
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
    
    // معامل النوافذ (41)
    const windowFactor = 200; 
    let windowCount = Math.round(blackPixelCount / windowFactor); 
    windowCount = Math.min(100, windowCount); 

    // تحسين بسيط لتقدير زاوية الميلان بناءً على نسبة العرض إلى الارتفاع
    const aspect = box.width / box.height;
    let estimatedSlopeAngle = 35; 
    if (aspect > 1.2) {
        estimatedSlopeAngle = 30; 
    } else if (aspect < 0.8) {
        estimatedSlopeAngle = 40; 
    }
    
    // تقدير عرض النافذة
    const estimatedWindowWidth = Math.round(box.width / (windowCount * 2)) || 20; 

    // **تنفيذ تحويل القياسات من بكسل إلى متر**
    const widthMeters = box.width / scale;
    const heightMeters = box.height / scale;
    const squareWindowWidthMeters = estimatedWindowWidth / scale;

    return {
        overallWidth: box.width,
        overallHeight: box.height,
        windowCount: Math.max(0, windowCount),
        slopeAngle: estimatedSlopeAngle,
        squareWindowWidth: estimatedWindowWidth, 
        roundedWindowCount: 0,
        // حقول جديدة
        widthMeters: widthMeters,
        heightMeters: heightMeters,
        squareWindowWidthMeters: squareWindowWidthMeters
    };
}


self.onmessage = function(e) {
    const { imageData, width, height, scaleFactor } = e.data; // استقبال معامل القياس
    const inputPixels = imageData.data;
    
    // توليد الرسم الهندسي
    const finalSketchPixels = applySobel(inputPixels, width, height); 
    
    // تحليل القياسات
    const analysisResults = analyzeImage(finalSketchPixels, width, height, scaleFactor);

    // إرسال النتيجة
    self.postMessage({ 
        type: 'result', 
        data: finalSketchPixels.buffer, 
        width: width, 
        height: height,
        analysis: analysisResults
    }, [finalSketchPixels.buffer]);
};
