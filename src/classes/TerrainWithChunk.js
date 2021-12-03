import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { InstancedUniformsMesh } from "three-instanced-uniforms-mesh";
import { makeRectangle } from "../lib/fractal-noise";
import { openSimplexNoise } from "../lib/simplexNoise";
import { map, mapToUnitCircle } from "../lib/utils";
import * as THREE from "three";
import Model from "./Model";


// le vertex shader basique pour le terrain
// il ne sert que pour générer les UV
const vertexShader =
    `
varying vec2 vUv;
varying vec3 pos;

void main() {
    vUv = uv;
    pos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); 
}
`

// le fragment shader pour le terrain
// applique une texture différente en fonction de la hauteur du pixel concerné
const fragmentShader =
    `
varying vec2 vUv;
varying vec3 pos;
uniform sampler2D textureGrass;
uniform sampler2D textureDirt;
uniform float textureRepeatX;
uniform float textureRepeatY;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;

void main() {
    if(pos.z > 4.5) {
        if(pos.z > 6.5) {
            vec4 color = texture(textureGrass, vec2(vUv.x * textureRepeatX, vUv.y * textureRepeatY));
            color.rgb += 0.1;
            gl_FragColor = color;
        } else {
            gl_FragColor = texture(textureGrass, vec2(vUv.x * textureRepeatX, vUv.y * textureRepeatY));
        }
    } else {
        gl_FragColor = texture(textureDirt, vec2(vUv.x * textureRepeatX, vUv.y * textureRepeatY));
    }
    #ifdef USE_FOG
          #ifdef USE_LOGDEPTHBUF_EXT
              float depth = gl_FragDepthEXT / gl_FragCoord.w;
          #else
              float depth = gl_FragCoord.z / gl_FragCoord.w;
          #endif
          float fogFactor = smoothstep( fogNear, fogFar, depth );
          gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
      #endif
}
`

class Terrain {

    constructor(segmentSize = 8) {

        // la taille d'un coté de la mesh
        this.size = 1024;
        this.segmentSize = segmentSize;

        // un générateur de bruit
        const noise = openSimplexNoise(12); // de -1 à 1
        const noise2 = openSimplexNoise("ouais une super seed");
        const noise3 = openSimplexNoise("nan ca c'est une meilleure seed");
        // créé plusiuers heightmap avec des fréquences différentes
        this.heightMap = makeRectangle(this.size / this.segmentSize, this.size / this.segmentSize, noise.noise2D); // heightMap de destination
        const heightMap1 = makeRectangle(this.size / this.segmentSize, this.size / this.segmentSize, noise.noise2D, { frequency: 0.1, amplitude: 2 });
        const heightMap2 = makeRectangle(this.size / this.segmentSize, this.size / this.segmentSize, noise2.noise2D, { frequency: 0.3, amplitude: 1 });
        const heightMap3 = makeRectangle(this.size / this.segmentSize, this.size / this.segmentSize, noise3.noise2D, { frequency: 0.6, amplitude: 2 });

        // ajoute les différentes heightmap
        // stocke le maximum et le minimum de la somme des heightmap pour faire un map() plus tard
        let min = 0, max = 1;
        for (let i = 0; i < this.heightMap.length; i++) {
            for (let j = 0; j < this.heightMap.length; j++) {
                let a = heightMap1[i][j] * 1.0
                    + heightMap2[i][j] * 0.5
                    + heightMap3[i][j] * 0.25;
                this.heightMap[i][j] = a;
                if (a < min)
                    min = a;
                if (a > max)
                    max = a;
            }
        }

        // créee la heightMap finale
        let heightScale = 11.3;
        for (let i = 0; i < this.heightMap.length; i++) {
            for (let j = 0; j < this.heightMap.length; j++) {
                // normalise la hauteur entre 0 et 1 puis multiplie par une scale
                let h = map(this.heightMap[i][j], min, max, 0, 1) * heightScale;
                if (h > 5)
                    h += 2;
                this.heightMap[i][j] = h;
            }
        }


    }

    init(scene) {
        // charge les texture d'herbe et de terre et dit qu'elles peuvent se répéter
        let textureGrass = new THREE.TextureLoader().load('./src/textures/grass.jpg');
        textureGrass.wrapS = textureGrass.wrapT = THREE.RepeatWrapping;
        let textureDirt = new THREE.TextureLoader().load('./src/textures/dirt.jpg');
        textureDirt.wrapS = textureDirt.wrapT = THREE.RepeatWrapping;

        const material = new THREE.ShaderMaterial({
            // wireframe: true,
            fog: true,
            uniforms: {
                textureGrass: { type: "t", value: textureGrass },
                textureDirt: { type: "t", value: textureDirt },
                textureRepeatX: { type: "f", value: 50.0 },
                textureRepeatY: { type: "f", value: 50.0 },
                // pour le brouillard
                fogColor: { type: "c", value: scene.getFogColor() },
                fogNear: { type: "f", value: scene.getFogNear() },
                fogFar: { type: "f", value: scene.getFogFar() }
            },
            vertexShader: vertexShader,
            fragmentShader: fragmentShader
        });

        // le nombre de chunks entre lesquels le terrain sera séparé
        const nbChunks = 64; // a besoin d'avoir une racine carré 
        // le nombre de chunk de chaque côté de la mesh
        const lines = Math.sqrt(nbChunks);
        // la taille de chaque chunk dans le monde
        const chunkSize = this.size / lines;
        // le nombre de segment dans chaque côté de chunk
        const chunkSegmentsCount = chunkSize / this.segmentSize;
        // stocke tous les chunks générés
        this.tabChunks = [];

        // parcourt les chunks en ligne et colonnes
        for (let i = 0; i < lines; i++) {
            for (let j = 0; j < lines; j++) {
                // créé la géométrie pour ce chunk
                const geometry = new THREE.PlaneBufferGeometry(chunkSize, chunkSize, chunkSegmentsCount - 1, chunkSegmentsCount - 1);
                // parcourt la géométrie du chunk
                let index = 0;
                for (let cpt = 0; cpt < geometry.attributes.position.array.length; cpt += 3) {
                    // pour chaque point, récupère où il se trouve dans sa 
                    const localX = index % chunkSegmentsCount;
                    const localY = Math.floor(index / chunkSegmentsCount);
                    // ajoute la position du chunk pour avoir la position globale
                    const globalX = (localX * this.segmentSize + i * chunkSize) / this.segmentSize - i;
                    const globalY = (localY * this.segmentSize + j * chunkSize) / this.segmentSize - j;
                    // récupère la hauteur associée à ce point depuis la heightMap
                    const height = this.heightMap[globalX][globalY];
                    // attribue la hauter au point du chunk actuel
                    geometry.attributes.position.array[cpt + 2] = height; // z

                    index++;
                }
                // créé la mesh de ce chunk
                const chunk = new THREE.Mesh(geometry, material);
                // positionne ce chunk dans le monde et le met à l'horizontale 
                chunk.position.set((-this.size / 2 + chunkSize / 2) + chunkSize * i, 0, (-this.size / 2 + chunkSize / 2) + chunkSize * j)
                chunk.rotateX(-Math.PI / 2);
                // stocke le chunk généré
                this.tabChunks.push(chunk);
            }
        }
        // ajoute le terrain
        for (let cpt = 0; cpt < this.tabChunks.length; cpt++) {
            const chunk = this.tabChunks[cpt];
            scene.addMeshWithPhysics(chunk, "static");
        }
    }

    spawnGrass(scene) {
        
    }

    spawnTrees(scene) {


    }

    updateGrass(cameraController) {

    }

}



export default Terrain
