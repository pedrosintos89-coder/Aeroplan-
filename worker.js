// Fonction utilitaire pour la conversion en Niveaux de Gris
function toGrayscale(r, g, b) {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Fonction de détection des bords (Sobel simplifiée)
function applySobel(pixels, width, height) {
    const grayData = new Float32Array(width * height);
    for (let i = 0; i < pixels.length; i += 4) {
        grayData[i / 4] = toGrayscale(pixels[i], pixels[i + 1], pixels[i + 2]);
    }
    
    const output = new Uint8ClampedArray(pixels.length);
    const Gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1]; 
    const Gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1]; 
    const threshold = 30; // Valeur optimisée après l'essai précédent

    for (let y = 1; y < height - 1; y++) {
        // Rapport de progression
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
            // Les bords deviennent noirs (0), le reste blanc (255)
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

// **NOUVELLE FONCTION** : Détecte les limites réelles du bâtiment (Bounding Box)
function getBuildingBoundingBox(pixels, width, height) {
    let minX = width, minY = height, maxX = 0, maxY = 0;
    let foundEdge = false;

    // Itérer sur les pixels pour trouver le pixel le plus à gauche, droite, haut et bas (noir)
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            // Vérifier si le pixel est noir (un bord)
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

    // Retourner les dimensions réelles du bâtiment
    return {
        width: maxX - minX,
        height: maxY - minY,
        minX: minX,
        minY: minY
    };
}


// Fonction d'analyse des mesures
function analyzeImage(pixels, width, height) {
    // 1. Déterminer les dimensions du bâtiment uniquement (pas l'image complète)
    const box = getBuildingBoundingBox(pixels, width, height);

    if (!box) {
        return { overallWidth: width, overallHeight: height, windowCount: 0, slopeAngle: 0 };
    }
    
    // 2. Tenter de compter les 'fenêtres' (en comptant les zones noires denses)
    // Nous allons compter le nombre de fois où nous rencontrons une séquence de lignes horizontales/verticales
    let blackPixelCount = 0;
    for (let y = box.minY; y < box.minY + box.height; y++) {
        for (let x = box.minX; x < box.minX + box.width; x++) {
            const i = (y * width + x) * 4;
            if (pixels[i] === 0) {
                blackPixelCount++;
            }
        }
    }
    
    // Tenter de calculer l'angle de pente (très approximatif sans algorithme de Hough)
    // Ici, nous utilisons l'hypothèse que la pente est visible sur les bords supérieurs.
    const estimatedSlopeAngle = 35; // Gardé par défaut pour l'instant
    
    // Simplification : Estimation du nombre de fenêtres basée sur la densité des bords dans la zone du bâtiment.
    // Plus il y a de pixels noirs (bords) dans la zone, plus il y a de détails (fenêtres).
    // Divisé par la surface du bâtiment * un facteur d'échelle.
    const buildingSurface = box.width * box.height;
    const windowCount = Math.round(blackPixelCount / (buildingSurface / 20)); // Facteur d'échelle ajusté (20)


    return {
        overallWidth: box.width,
        overallHeight: box.height,
        windowCount: Math.max(0, windowCount), // S'assurer que ce n'est pas négatif
        slopeAngle: estimatedSlopeAngle
    };
}


self.onmessage = function(e) {
    const { imageData, width, height } = e.data;
    const inputPixels = imageData.data;
    
    // Étape 1: Génération de l'esquisse
    const finalSketchPixels = applySobel(inputPixels, width, height);
    
    // Étape 2: Analyse des mesures (utilise maintenant les pixels de l'esquisse)
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
