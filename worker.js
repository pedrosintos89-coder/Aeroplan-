// Function to convert RGBA to Grayscale
function toGrayscale(r, g, b) {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Function to apply a simple edge detection (Sobel-like) for analysis
function getEdgesForAnalysis(pixels, width, height) {
    const grayData = new Float32Array(width * height);
    for (let i = 0; i < pixels.length; i += 4) {
        grayData[i / 4] = toGrayscale(pixels[i], pixels[i + 1], pixels[i + 2]);
    }
    
    const tempEdges = new Uint8ClampedArray(pixels.length);
    const Gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1]; 
    const Gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1]; 
    const threshold = 40; 

    for (let y = 1; y < height - 1; y++) {
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
            tempEdges[outputIdx] = edgeValue; 
            tempEdges[outputIdx + 1] = edgeValue;
            tempEdges[outputIdx + 2] = edgeValue;
            tempEdges[outputIdx + 3] = 255; 
        }
    }
    return tempEdges;
}

// Function to get building bounding box from edge pixels
function getBuildingBoundingBox(pixels, width, height) {
    let minX = width, minY = height, maxX = 0, maxY = 0;
    let foundEdge = false;

    for (let y = 0; y < height; y++) {
        if (y % 20 === 0) { // Report progress every 20 lines
            self.postMessage({ type: 'progress', percent: Math.round((y / height) * 100 * 0.5) });
        }
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

// **NEW FUNCTION: Analyze ground images for dominant window type**
function analyzeGroundImages(groundImageDataArray) {
    let archedCount = 0;
    let squareCount = 0;

    if (groundImageDataArray && groundImageDataArray.length > 0) {
        // Simple heuristic: count occurrences of "arched" shapes in the ground images
        // This is a very basic example; a real AI would use complex image recognition
        groundImageDataArray.forEach((imageData, index) => {
            const pixels = imageData.data;
            const width = imageData.width;
            const height = imageData.height;

            // Perform a very basic check for curves (e.g., density of certain edge patterns)
            // This is a placeholder for a more sophisticated AI analysis.
            // For now, let's just make a dummy decision based on image aspect ratio for illustration.
            // In a real scenario, you'd use a pre-trained model for object detection.
            if (width / height < 0.8 && height > 100) { // Tall and narrow images might suggest arched windows
                archedCount++;
            } else if (width / height > 1.2 && width > 100) { // Wide images might suggest square windows
                squareCount++;
            } else if (index % 2 === 0) { // Fallback, alternate for demo
                archedCount++;
            } else {
                squareCount++;
            }
            
            self.postMessage({ type: 'progress', percent: 50 + Math.round(((index + 1) / groundImageDataArray.length) * 100 * 0.4) });
        });
    }

    if (archedCount > squareCount) {
        return 'Arrondie/Cintrée';
    } else if (squareCount > 0) {
        return 'Carrée';
    }
    return null; // No strong detection
}


// Main image analysis function
function analyzeImage(aerialPixels, width, height, scaleFactor, floorCount, windowType, groundImageDataArray) {
    const box = getBuildingBoundingBox(aerialPixels, width, height);
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
            floorHeightMeters: 0,
            detectedWindowType: null // Nouvelle propriété
        };
    }
    
    let blackPixelCount = 0;
    const step = 5; 
    for (let y = box.minY; y < box.minY + box.height; y += step) {
        for (let x = box.minX; x < box.minX + box.width; x += step) {
            const i = (y * width + x) * 4;
            if (aerialPixels[i] === 0) {
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

    const widthMeters = box.width / scale;
    const heightMeters = box.height / scale;
    const squareWindowWidthMeters = estimatedWindowWidth / scale;
    
    const floorHeightMeters = heightMeters / floors;

    // **INTEGRATE GROUND IMAGE ANALYSIS**
    const detectedWindowType = analyzeGroundImages(groundImageDataArray);
    self.postMessage({ type: 'progress', percent: 95 }); // Final progress update
    
    return {
        overallWidth: box.width,
        overallHeight: box.height,
        windowCount: windowCount,
        slopeAngle: estimatedSlopeAngle,
        squareWindowWidth: estimatedWindowWidth, 
        floorCount: floors,
        windowType: windowType === 'arched' ? 'Arrondie/Cintrée' : 'Carrée', // Default from UI
        widthMeters: widthMeters,
        heightMeters: heightMeters,
        squareWindowWidthMeters: squareWindowWidthMeters,
        floorHeightMeters: floorHeightMeters,
        detectedWindowType: detectedWindowType // Pass detected type back
    };
}


self.onmessage = function(e) {
    const { aerialImageData, groundImageDataArray, width, height, scaleFactor, floorCount, windowType } = e.data; 
    const aerialPixels = aerialImageData.data;
    
    // Process aerial image for basic bounding box and count
    const analysisPixels = getEdgesForAnalysis(aerialPixels, width, height); 
    
    // Pass groundImageDataArray to the analysis function
    const analysisResults = analyzeImage(analysisPixels, width, height, scaleFactor, floorCount, windowType, groundImageDataArray);

    self.postMessage({ 
        type: 'result', 
        analysis: analysisResults
    });
};
