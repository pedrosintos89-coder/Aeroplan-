// Fonction utilitaire pour la conversion en Niveaux de Gris (Luminosity method)
function toGrayscale(r, g, b) {
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
    // Le seuil (threshold) détermine la sensibilité à la détection des bords.
    const threshold = 100; 

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            let sumX = 0;
            let sumY = 0;
            
            // Appliquer le noyau 3x3
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
            // Si la magnitude est supérieure au seuil, on trace un bord noir (0), sinon on laisse blanc (255).
            const edgeValue = magnitude > threshold ? 0 : 255; 
            
            const outputIdx = (y * width + x) * 4;
            output[outputIdx] = edgeValue; 
            output[outputIdx + 1] = edgeValue;
            output[outputIdx + 2] = edgeValue;
            output[outputIdx + 3] = 255; 
        }
        
        // Rapport de progression pour la barre d'état
        if (y % 50 === 0) {
            self.postMessage({ type: 'progress', percent: Math.round((y / height) * 100) });
        }
    }
    
    return output;
}

// Fonction simplifiée d'analyse des mesures (Placeholder)
function analyzeImage(width, height) {
    // NOTE: L'analyse réelle des fenêtres, pentes et dimensions précises nécessite des bibliothèques externes (comme OpenCV)
    // Pour l'instant, nous fournissons des estimations basées sur la taille globale de l'image.
    
    // Estimation simple du nombre de fenêtres (Approximation basée sur la surface)
    // Nous supposons que chaque 10 000 pixels correspond à une unité de détail.
    const estimatedWindowCount = Math.round((width * height) / 10000); 
    
    // Angle de pente de toit (Estimation d'un angle par défaut, à affiner manuellement)
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

    // Envoi du résultat final (y compris le buffer des pixels et les analyses)
    self.postMessage({ 
        type: 'result', 
        data: finalSketchPixels.buffer, 
        width: width, 
        height: height,
        analysis: analysisResults
    }, [finalSketchPixels.buffer]);
};
