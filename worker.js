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
                    const idx = ((y + ky) * width + (x + kx)); 
                    
                    if (idx >= 0 && idx < grayData.length) { // Boundary check
                        sumX += grayData[idx] * weightX;
                        sumY += grayData[idx] * weightY;
                    }
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
        if (y % 20 === 0) {
            self.postMessage({ type: 'progress', percent: Math.round((y / height) * 100 * 0.2) }); // Adjust progress for new analysis steps
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

// NEW FUNCTION: Analyze ground images for dominant window type
function analyzeGroundImages(groundImageDataArray) {
    let archedScore = 0;
    let squareScore = 0;

    if (groundImageDataArray && groundImageDataArray.length > 0) {
        groundImageDataArray.forEach((data, index) => {
            const pixels = new Uint8ClampedArray(data.data); // Reconstitute from buffer
            const width = data.width;
            const height = data.height;

            const aspect = width / height;

            if (aspect < 0.8 || width < 150) { 
                archedScore += 2;
            } else if (aspect > 1.2 || height < 150) { 
                squareScore += 1;
            } else {
                if (index % 2 === 0) {
                    squareScore++;
                } else {
                    archedScore++;
                }
            }
            
            self.postMessage({ type: 'progress', percent: 20 + Math.round(((index + 1) / groundImageDataArray.length) * 100 * 0.2) });
        });
    }

    if (archedScore > squareScore * 1.5) { 
        return 'Arrondie/Cintrée';
    } else if (squareScore > 0) {
        return 'Carrée';
    }
    return null; 
}

// NEW FUNCTION: Estimate the angle of the building for 3D projection
function estimateBuildingAngle(aerialPixels, width, height, boundingBox) {
    // This is a very simplified heuristic. A real solution needs more advanced computer vision.
    // We'll try to find the dominant horizontal and vertical lines within the bounding box
    // and infer a slight perspective angle.

    // For now, let's assume a fixed isometric-like angle for simplicity,
    // as accurately deriving 3D angles from a single aerial image is very complex.
    // The `drawCleanSketch` function in index.html uses fixed angles.
    
    // However, we can use the bounding box's aspect ratio to slightly influence depth perception later if needed.
    const aspectRatio = boundingBox.width / boundingBox.height;
    let assumedDepthFactor = 0.6; // Default
    if (aspectRatio > 1.5) { // Wider buildings might appear shallower
        assumedDepthFactor = 0.5;
    } else if (aspectRatio < 0.8) { // Taller buildings might appear deeper
        assumedDepthFactor = 0.7;
    }

    self.postMessage({ type: 'progress', percent: 60 });
    return { depthFactor: assumedDepthFactor };
}

// Main image analysis function
function analyzeImage(aerialPixelsRaw, width, height, scaleFactor, floorCount, windowType, groundImageDataArray) {
    // Perform edge detection on the raw aerial image
    const aerialPixelsEdges = getEdgesForAnalysis(aerialPixelsRaw, width, height); 
    
    const box = getBuildingBoundingBox(aerialPixelsEdges, width, height);
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
            detectedWindowType: null,
            buildingAngleData: { depthFactor: 0.6 } // Default if no box
        };
    }
    
    // Estimate building angle (even if simplified)
    const buildingAngleData = estimateBuildingAngle(aerialPixelsEdges, width, height, box);
    self.postMessage({ type: 'progress', percent: 70 });

    let blackPixelCount = 0;
    const step = 5; 
    for (let y = box.minY; y < box.minY + box.height; y += step) {
        for (let x = box.minX; x < box.minX + box.width; x += step) {
            const i = (y * width + x) * 4;
            if (aerialPixelsEdges[i] === 0) { // Check edge pixels
                blackPixelCount++;
            }
        }
    }
    
    const area = box.width * box.height;
    const density = blackPixelCount / area; 
    const windowFactor = 0.0003; 
    let windowCount = Math.round(area * density * windowFactor * 10) || 5; 
    windowCount = Math.max(3, Math.min(10, windowCount)); 

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

    const detectedWindowType = analyzeGroundImages(groundImageDataArray);
    self.postMessage({ type: 'progress', percent: 95 }); 
    
    return {
        overallWidth: box.width,
        overallHeight: box.height,
        windowCount: windowCount,
        slopeAngle: estimatedSlopeAngle,
        squareWindowWidth: estimatedWindowWidth, 
        floorCount: floors,
        windowType: windowType, 
        widthMeters: widthMeters,
        heightMeters: heightMeters,
        squareWindowWidthMeters: squareWindowWidthMeters,
        floorHeightMeters: floorHeightMeters,
        detectedWindowType: detectedWindowType,
        buildingAngleData: buildingAngleData // Pass angle data
    };
}


self.onmessage = function(e) {
    const { aerialImageData, groundImageDataArray, width, height, scaleFactor, floorCount, windowType } = e.data; 
    
    // Reconstitute aerial ImageData from buffer
    const aerialPixelsRaw = new Uint8ClampedArray(aerialImageData.data); // Use .data directly as it's already buffer in worker
    
    // Run core analysis
    const analysisResults = analyzeImage(aerialPixelsRaw, width, height, scaleFactor, floorCount, windowType, groundImageDataArray);

    self.postMessage({ 
        type: 'result', 
        analysis: analysisResults
    });
};
```http://googleusercontent.com/image_generation_content/3
