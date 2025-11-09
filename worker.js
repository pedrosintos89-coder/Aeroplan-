// Fonction utilitaire pour la conversion en Niveaux de Gris (Luminosity method)
function toGrayscale(r, g, b) {
    // Calcul basé sur la perception humaine de la luminosité
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Fonction de détection des bords (Sobel simplifiée) pour extraire les lignes
function applySobel(pixels, width, height) {
    // 1. Convertir en données de niveaux de gris
    const grayData = new Float32Array(width * height);
    for (let i = 0; i < pixels.length; i += 4) {
        grayData[i / 4] = toGrayscale(pixels[i], pixels[i + 1], pixels[i + 2]);
    }
    
    const output = new Uint8ClampedArray(pixels.length);
    const Gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1]; // Noyau Sobel horizontal
    const Gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1]; // Noyau Sobel vertical
    
    // **القيمة المُعدلة**: تم تخفيضها من 100 إلى 30 لالتقاط المزيد من الحواف في الصور الباهتة/الجوية
    const threshold = 30; 

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            let sumX = 0;
            let sumY = 0;
            
            // تطبيق نواة Sobel 3x3
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
            // تحويل الحافة إلى أسود (0) وما سوى ذلك إلى أبيض (255)
            const edgeValue = magnitude > threshold ? 0 : 255; 
            
            const outputIdx = (y * width + x) * 4;
            output[outputIdx] = edgeValue; 
            output[outputIdx + 1] = edgeValue;
            output[outputIdx + 2] = edgeValue;
            output[outputIdx + 3] = 255; 
        }
        
        // إرسال تقرير بالتقدم
        if (y % 50 === 0) {
            self.postMessage({ type: 'progress', percent: Math.round((y / height) * 100) });
        }
    }
    
    return output;
}

// Fonction simplifiée d'analyse des mesures (Placeholder)
function analyzeImage(width, height) {
    // هذه مجرد تقديرات تستند إلى حجم البكسل الكلي.
    // يمكن تعديلها لاحقًا لتشمل تحليلًا متقدماً للأشكال الهندسية.
    
    // Estimation simple du nombre de fenêtres (Approximation basée sur la surface)
    const estimatedWindowCount = Math.round((width * height) / 10000); 
    
    // Angle de pente de toit (Estimation par défaut)
    const estimatedSlopeAngle = 35; 
    
    return {
        overallWidth: width,
        overallHeight: height,
        windowCount: estimatedWindowCount,
        slopeAngle: estimatedSlopeAngle
    };
}


self.onmessage = function(e) {
    const { imageData, width, height } = e.data;
    const inputPixels = imageData.data;
    
    // Étape 1: Génération de l'esquisse (Détection des bords)
    const finalSketchPixels = applySobel(inputPixels, width, height);
    
    // Étape 2: Analyse des mesures
    const analysisResults = analyzeImage(width, height);

    // Envoi du résultat final
    self.postMessage({ 
        type: 'result', 
        data: finalSketchPixels.buffer, 
        width: width, 
        height: height,
        analysis: analysisResults
    }, [finalSketchPixels.buffer]);
};
