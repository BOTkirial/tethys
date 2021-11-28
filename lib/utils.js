// -------------VARIABLES GLOBALES-------------

// ---------------FONCTIONS---------------

function constrain(n, low, high) {
    return Math.max(Math.min(n, high), low);
};

function map(n, start1, stop1, start2, stop2, withinBounds) {
    const newval = (n - start1) / (stop1 - start1) * (stop2 - start2) + start2;
    if (!withinBounds) {
        return newval;
    }
    if (start2 < stop2) {
        return constrain(newval, start2, stop2);
    } else {
        return constrain(newval, stop2, start2);
    }
};

function showNoise(heightMap, canvasID) {
    const canvas = document.getElementById(canvasID);
    canvas.width = heightMap.length;
    canvas.height = heightMap.length;
    const c = canvas.getContext('2d');
    c.fillStyle = "rgba(0, 0, 0, 1)";
    c.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < canvas.width - 1; i++) {
        for (let j = 0; j < canvas.height - 1; j++) {
            let a = heightMap[i][j];
            c.fillStyle = "rgba(255, 255, 255, " + a + ")";
            c.fillRect(i, j, 1, 1);
        }
    }
}

function mapToUnitCircle(x, y) {
    return [
        x * Math.sqrt(1 - ((y * y) / 2)),
        y * Math.sqrt(1 - ((x * x) / 2)),
    ]
}