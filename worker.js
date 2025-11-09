// Fonction utilitaire pour la conversion en Niveaux de Gris
function toGrayscale(r, g, b) {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// **FONCTION:** Application de filtres directionnels (Lignes Horizontales/Verticales)
// Produit un croquis en Noir et Blanc N E T
function applyLineFilters(pixels, width, height) {
    const grayData = new Float32Array(width * height);
    for (let i = 0; i < pixels.length; i += 4) {
        grayData[i / 4] = toGrayscale(pixels[i], pixels[i + 1], pixels[i + 2]);
    }
    
    const output = new Uint8ClampedArray(pixels.length); // Tableau de sortie en N&B
    
    const KERNEL_V = [1, 0, -1, 1, 0, -1, 1, 0, -1]; 
    const KERNEL_H = [1, 1, 1, 0, 0, 0, -1, -1, -1]; 
    const threshold = 60; // Seuil élevé pour des lignes plus nettes

    for (let y = 1; y < height - 1; y++) {
        if (y % 50 === 0) {
            self.postMessage({ type: 'progress', percent: Math.round((y / height) * 100) });
        }
        
        for (let x = 1; x < width - 1; x++) {
            let sumV = 0;
            let sumH = 0;
            
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const weightV = KERNEL_V[(ky + 1) * 3 + (kx + 1)];
                    const weightH = KERNEL_H[(ky + 1) * 3 + (kx + 1)];
                    const idx = (y * width + x + kx + ky * width); 
                    
                    sumV += grayData[idx] * weightV;
                    sumH += grayData[idx] * weightH;
                }
            }

            const magnitude = Math.sqrt(sumV * sumV + sumH * sumH);
            // البكسلات فوق العتبة تصبح سوداء (0)، الباقي أبيض (255)
            const edgeValue = magnitude > threshold ? 0 : 255; 
            
            const outputIdx = (y * width + x) * 4;
            // إخراج باللونين الأسود والأبيض فقط
            output[outputIdx] = edgeValue; 
            output[outputIdx + 1] = edgeValue;
            output[outputIdx + 2] = edgeValue;
            output[outputIdx + 3] = 255; 
        }
    }
    
    return output;
}

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
    windowCount = Math.min(100, windowCount); 

    const aspect = box.width / box.height;
    let estimatedSlopeAngle = 35; 
    if (aspect > 1.2) {
        estimatedSlopeAngle = 30; 
    } else if (aspect < 0.8) {
        estimatedSlopeAngle = 40; 
    }
    
    const estimatedWindowWidth = Math.round(box.width / (windowCount * 2)) || 20; 

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
        widthMeters: widthMeters,
        heightMeters: heightMeters,
        squareWindowWidthMeters: squareWindowWidthMeters
    };
}


// **دالة onmessage:** تستدعي فلتر الخطوط المستقيمة (applyLineFilters) فقط
self.onmessage = function(e) {
    const { imageData, width, height, scaleFactor } = e.data; 
    const originalPixels = imageData.data;
    
    // 1. توليد المخطط الهندسي النظيف (أبيض وأسود)
    const finalSketchPixels = applyLineFilters(originalPixels, width, height); 
    
    // 2. تحليل القياسات
    const analysisResults = analyzeImage(finalSketchPixels, width, height, scaleFactor);

    self.postMessage({ 
        type: 'result', 
        data: finalSketchPixels.buffer, 
        width: width, 
        height: height,
        analysis: analysisResults
    }, [finalSketchPixels.buffer]);
};
