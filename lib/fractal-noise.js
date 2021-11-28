"use strict";
// This is free and unencumbered software released into the public domain
// Object.defineProperty(exports, "__esModule", { value: true });
// exports.makeSphereSurface = exports.makeRectangle = exports.makeLine = exports.makeCylinderSurface = exports.makeCuboid = void 0;
var TWO_PI = 2 * Math.PI;
function processOptions(options) {
    return {
        amplitude: typeof options.amplitude === "number" ? options.amplitude : 1.0,
        frequency: typeof options.frequency === "number" ? options.frequency : 1.0,
        octaves: typeof options.octaves === "number"
            ? Math.floor(options.octaves)
            : 1,
        persistence: typeof options.persistence === "number"
            ? options.persistence
            : 0.5,
    };
}
function makeCuboid(width, height, depth, noise3, options) {
    if (options === void 0) { options = {}; }
    var _a = processOptions(options), amplitude = _a.amplitude, frequency = _a.frequency, octaves = _a.octaves, persistence = _a.persistence;
    var field = new Array(width);
    for (var x = 0; x < width; x++) {
        field[x] = new Array(height);
        for (var y = 0; y < height; y++) {
            field[x][y] = new Array(depth);
            for (var z = 0; z < depth; z++) {
                var value = 0.0;
                for (var octave = 0; octave < octaves; octave++) {
                    var freq = frequency * Math.pow(2, octave);
                    value += noise3(x * freq, y * freq, z * freq) *
                        (amplitude * Math.pow(persistence, octave));
                }
                field[x][y][z] = value / (2 - 1 / Math.pow(2, octaves - 1));
            }
        }
    }
    return field;
}
// exports.makeCuboid = makeCuboid;
function makeCylinderSurface(circumference, height, noise3, options) {
    if (options === void 0) { options = {}; }
    var _a = processOptions(options), amplitude = _a.amplitude, frequency = _a.frequency, octaves = _a.octaves, persistence = _a.persistence;
    var radius = circumference / TWO_PI;
    var field = new Array(circumference);
    for (var x = 0; x < circumference; x++) {
        field[x] = new Array(height);
        for (var y = 0; y < height; y++) {
            var value = 0.0;
            for (var octave = 0; octave < octaves; octave++) {
                var freq = frequency * Math.pow(2, octave);
                var nx = x / circumference;
                var rdx = nx * TWO_PI;
                var _b = [radius * Math.sin(rdx), radius * Math.cos(rdx)], a = _b[0], b = _b[1];
                value += noise3(a * freq, b * freq, y * freq) *
                    (amplitude * Math.pow(persistence, octave));
            }
            field[x][y] = value / (2 - 1 / Math.pow(2, octaves - 1));
        }
    }
    return field;
}
// exports.makeCylinderSurface = makeCylinderSurface;
function makeLine(length, noise1, options) {
    if (options === void 0) { options = {}; }
    var _a = processOptions(options), amplitude = _a.amplitude, frequency = _a.frequency, octaves = _a.octaves, persistence = _a.persistence;
    var field = new Array(length);
    for (var x = 0; x < length; x++) {
        var value = 0.0;
        for (var octave = 0; octave < octaves; octave++) {
            var freq = frequency * Math.pow(2, octaves);
            value += noise1(x * freq) * (amplitude * Math.pow(persistence, octave));
        }
        field[x] = value / (2 - 1 / Math.pow(2, octaves - 1));
    }
    return field;
}
// exports.makeLine = makeLine;
function makeRectangle(width, height, noise2, options) {
    if (options === void 0) { options = {}; }
    var _a = processOptions(options), amplitude = _a.amplitude, frequency = _a.frequency, octaves = _a.octaves, persistence = _a.persistence;
    var field = new Array(width);
    for (var x = 0; x < width; x++) {
        field[x] = new Array(height);
        for (var y = 0; y < height; y++) {
            var value = 0.0;
            for (var octave = 0; octave < octaves; octave++) {
                var freq = frequency * Math.pow(2, octave);
                value += noise2(x * freq, y * freq) *
                    (amplitude * Math.pow(persistence, octave));
            }
            field[x][y] = value / (2 - 1 / Math.pow(2, octaves - 1));
        }
    }
    return field;
}
// exports.makeRectangle = makeRectangle;
function makeSphereSurface(circumference, noise3, options) {
    if (options === void 0) { options = {}; }
    var _a = processOptions(options), amplitude = _a.amplitude, frequency = _a.frequency, octaves = _a.octaves, persistence = _a.persistence;
    var field = new Array(circumference);
    for (var x = 0; x < circumference; x++) {
        field[x] = new Array(circumference);
        for (var y = 0; y < circumference; y++) {
            var value = 0.0;
            for (var octave = 0; octave < octaves; octave++) {
                var freq = frequency * Math.pow(2, octave);
                var _b = [x / circumference, y / circumference], nx = _b[0], ny = _b[1];
                var _c = [nx * TWO_PI, ny * Math.PI], rdx = _c[0], rdy = _c[1];
                var sinY = Math.sin(rdy + Math.PI);
                var a = TWO_PI * Math.sin(rdx) * sinY;
                var b = TWO_PI * Math.cos(rdx) * sinY;
                var d = TWO_PI * Math.cos(rdy);
                value += noise3(a * freq, b * freq, d * freq) *
                    (amplitude * Math.pow(persistence, octave));
            }
            field[x][y] = value / (2 - 1 / Math.pow(2, octaves - 1));
        }
    }
    return field;
}
// exports.makeSphereSurface = makeSphereSurface;
