import Model from "./Model.js";
import { map, mapToUnitCircle, showNoise } from "../lib/utils.js";
import * as THREE from "three";
import { InstancedUniformsMesh } from "three-instanced-uniforms-mesh";
import { makeNoise2D } from "open-simplex-noise";
import { makeRectangle } from "fractal-noise";
import * as CANNON from "cannon-es";

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
    if(pos.z > 6.0) {
        if(pos.z > 8.0) {
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

    constructor(isRound = false, segmentSize = 8) {

        // la taille d'un coté de la mesh
        this.size = 1024;
        // le nombre de segment qui constituent un coté de la mesh
        this.nbSegments = this.size / segmentSize;
        this.segmentSize = segmentSize;
        // est ce que le terrain est rond ou pas ?
        this.isRound = isRound;

        // un générateur de bruit
        const noise = new makeNoise2D(12); // de -1 à 1
        const noise2 = new makeNoise2D("ouais une super seed");
        const noise3 = new makeNoise2D("nan ca c'est une meilleure seed");
        // créé plusiuers heightmap avec des fréquences différentes
        this.heightMap = makeRectangle(this.size, this.size, noise); // heightMap de destination
        const heightMap1 = makeRectangle(this.size, this.size, noise, { frequency: 0.005, amplitude: 1 });
        const heightMap2 = makeRectangle(this.size, this.size, noise2, { frequency: 0.01, amplitude: 50 });
        const heightMap3 = makeRectangle(this.size, this.size, noise3, { frequency: 0.006, amplitude: 50 });

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
        // console.log(min, max)

        // crée la heightMap finale
        let heightScale = 18;
        for (let i = 0; i < this.heightMap.length; i++) {
            for (let j = 0; j < this.heightMap.length; j++) {
                // normalise la hauteur entre 0 et 1 puis multiplie par une scale
                let h = map(this.heightMap[i][j], min, max, 0, 1) * heightScale;
                this.heightMap[i][j] = h;
            }
        }

        // prépare le tableau pour stocker les données de la heightMap pour la collisionShape
        this.collisionHeightMap = Array(this.size / this.segmentSize).fill(0).map(val => Array(this.size / this.segmentSize).fill(0));

        // parcourt la heightMap finale avec une résolution plus basse pour remplir la collisionHeightMap
        for (let i = 0; i < this.heightMap.length; i += this.segmentSize) {
            for (let j = 0; j < this.heightMap.length; j += this.segmentSize) {
                this.collisionHeightMap[i / this.segmentSize][j / this.segmentSize] = this.heightMap[i][j];
            }
        }

        // showNoise(this.collisionHeightMap);
        // showNoise(this.heightMap);
        // showNoise(heightMap1);
        // showNoise(heightMap2);
        // showNoise(heightMap3);

    }

    spawnGrass(scene) {

        // créé la géométrie du brin d'herbe
        var grassGeometry = new THREE.BufferGeometry();
        var vertices = new Float32Array([
            0, 0, 0,
            0.1, 0, 0,
            0, 0.65, 0
        ]);
        grassGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

        // material pour l'herbe
        this.grassMaterial = new THREE.ShaderMaterial({
            side: THREE.DoubleSide,
            fog: true,
            uniforms: {
                pos: { type: "vec3", value: new THREE.Vector3(0, 0, 0) }, // prépare la position du brin
                rot: { type: "f", value: 0.0 }, // prépare la rotation du brin
                time: { type: "f", value: 0.0 }, // prépare le temps du shader pour l'animation
                // pour le brouillard
                fogColor: { type: "c", value: scene.getFogColor() },
                fogNear: { type: "f", value: scene.getFogNear() },
                fogFar: { type: "f", value: scene.getFogFar() }
            },
            // shader pour faire l'animation et le placement des brins
            vertexShader: `
                        varying vec2 vUv;
                        // récupère la position d'une instance de mesh
                        uniform vec3 pos;
                        // récupère la rotation d'une instance de mesh
                        uniform float rot;
                        // progression du temps pour animer le vent
                        uniform float time;

                        mat4 rotationMatrix(vec3 axis, float angle)
                        {
                            axis = normalize(axis);
                            float s = sin(angle);
                            float c = cos(angle);
                            float oc = 1.0 - c;
                            
                            return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                                        oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
                                        oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
                                        0.0,                                0.0,                                0.0,                                1.0);
                        }

                        void main() {
                            vUv = uv;                      
                            // la matrix de transformation basée sur la position qu'on envoit en uniform
                            mat4 transformation = mat4(
                                1.0, 0.0, 0.0, 0.0, // premiere colonne
                                0.0, 1.0, 0.0, 0.0, // deuxieme colonne
                                0.0, 0.0, 1.0, 0.0, // troisieme colonne
                                pos.x, pos.y, pos.z, 1.0  // quatrieme colonne
                            );

                            vec3 customPos = position;
                            customPos *= 6.0; // scale la taille des brins d'herbe
                            customPos.x += sin(time * 0.006) * customPos.y * 0.4; // anim les brins d'herbes avec le temps
                            gl_Position = projectionMatrix 
                                            * viewMatrix
                                            * (transformation * rotationMatrix(vec3(0.0, 1.0, 0.0), rot))
                                            * vec4( customPos, 1.0 );
                        }
                    `,
            // shader pour colorer les brins selon leur position dans le monde
            fragmentShader: `
                        varying vec2 vUv;
                        uniform vec3 pos;
                        // implémente le brouillard
                        uniform vec3 fogColor;
                        uniform float fogNear;
                        uniform float fogFar;
                        
                        void main() {
                            vec4 pixelColor = vec4(
                                0.75 + pos.x / 255.0,
                                0.5 + pos.y / 255.0,
                                1.0 + pos.z / 255.0,
                                1
                            );
                            gl_FragColor = pixelColor;
                            // pour le FOG
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
                        `,
            transparent: false
        });

        // stocke les points où on vas faire spawn une herbe ou une fleure
        const grassPoints = [];
        const flowerPoints = [];
        const grassHeightLimit = 8.4;
        const grassDensity = 1
        const flowerDensity = 0.001
        // parcourt la heightMap à la recherche de point suffisement hauts
        for (let i = 0; i < this.heightMap.length; i++) {
            for (let j = 0; j < this.heightMap.length; j++) {
                // la hauteur du point
                let height = this.heightMap[i][j]
                // si il est suffisement haut
                if (height > grassHeightLimit) {
                    let finalPos = [map(j, 0, this.heightMap.length, -1, 1), map(i, 0, this.heightMap.length, -1, 1)];
                    if (this.isRound) { finalPos = mapToUnitCircle(finalPos[0], finalPos[1]); }
                    // gere la densité de l'herbe
                    if (Math.random() < grassDensity) {
                        // créé aléatoirement une herbe ou une fleur
                        if (Math.random() > flowerDensity) {
                            grassPoints.push(new THREE.Vector3(finalPos[0] * this.size / 2, height, finalPos[1] * this.size / 2))
                        } else {
                            flowerPoints.push(new THREE.Vector3(finalPos[0] * this.size / 2, height, finalPos[1] * this.size / 2))
                        }
                    }
                }
            }
        }

        const instancedGrassMesh = new InstancedUniformsMesh(grassGeometry, this.grassMaterial, grassPoints.length);
        for (let cpt = 0; cpt < grassPoints.length; cpt++) {
            let position = grassPoints[cpt]
            instancedGrassMesh.setUniformAt("pos", cpt, position);
            instancedGrassMesh.setUniformAt("rot", cpt, Math.random() * Math.PI * 2);
        }
        scene.add(instancedGrassMesh);

        // fait pop les fleurs jaunes
        const flower = new Model("src/models/plantes/fleur_jaune.glb", 10);
        flower.init(scene, function (model) {
            for (let cpt = flowerPoints.length - 1; cpt >= 0; cpt--) {
                const point = flowerPoints[cpt];
                if (Math.random() > 0.5) {
                    const newModel = model.clone();
                    newModel.position.copy(point);
                    scene.add(newModel);
                    // enleve ce point du tableau
                    flowerPoints.splice(cpt, 1)
                }
            }
            // fait pop les fleurs rouges
            const flower = new Model("src/models/plantes/fleur_rouge.glb", 10);
            flower.init(scene, function (model) {
                flowerPoints.forEach((point) => {
                    const newModel = model.clone();
                    newModel.position.copy(point);
                    scene.add(newModel);
                })
            })
        })
    }

    spawnTrees(scene) {

        // parcourt la heightMap a la recherche des points hors de l'eau
        const treePoints = [];
        const heightLimit = 10;
        const noise = new makeNoise2D("bruit pour seed le spawn des arbres");
        for (let cpt = 0; cpt < this.mesh.geometry.attributes.position.array.length; cpt += 3) {
            let y = this.mesh.geometry.attributes.position.array[cpt + 2];
            if (y > heightLimit) {
                let x = this.mesh.geometry.attributes.position.array[cpt + 1];
                let z = this.mesh.geometry.attributes.position.array[cpt + 0];
                if (map(noise(x * 10, z * 10), -1, 1, 0, 1) < 0.18)
                    treePoints.push(new THREE.Vector3(x, y, z))
            }
        }

        // charge le modele de l'arbre
        const tree = new Model("src/models/plantes/tree.glb", 100);
        tree.init(scene, function (model) {
            // pour chaque point déecté
            treePoints.forEach((point) => {
                // clone un arbre et le déplace sur le point
                const newModel = model.clone();
                newModel.rotateY(Math.random() * 2 * Math.PI)
                newModel.position.copy(point);
                newModel.position.y -= 8;
                scene.add(newModel);
            })
        });

    }

    init(scene) {
        // génère le terrain et applique une height à chaque point basé sur sa position dans la heightMap
        const geometry = new THREE.PlaneBufferGeometry(this.size, this.size, this.nbSegments - 1, this.nbSegments - 1);

        // traverse les points de la géométrie du terrain 3 par 3 car x, y et z sont stockés dans le meme tableau à la suite
        for (let cpt = 0; cpt < geometry.attributes.position.array.length; cpt += 3) {

            // attribue la hauteur du point de la geometrie en fonction de sa position sur la heightMap
            const x = Math.floor(map(geometry.attributes.position.array[cpt + 0], -this.size / 2, this.size / 2, 0, this.size - 1));
            const y = Math.floor(map(geometry.attributes.position.array[cpt + 1], -this.size / 2, this.size / 2, 0, this.size - 1));
            let height = this.heightMap[x][y];
            // applique la nouvelle hauteur
            geometry.attributes.position.array[cpt + 2] = height;


            // map les points du carré dans un cercle
            if (this.isRound) {
                let newPosX = map(geometry.attributes.position.array[cpt], - this.size / 2, this.size / 2, -1, 1);
                let newPosY = map(geometry.attributes.position.array[cpt + 1], - this.size / 2, this.size / 2, -1, 1);
                let newPos = mapToUnitCircle(newPosX, newPosY);

                geometry.attributes.position.array[cpt + 0] = newPos[0] * this.size / 2;
                geometry.attributes.position.array[cpt + 1] = newPos[1] * this.size / 2;
            }
        }

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

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.rotateX(-Math.PI / 2)
        // TODO : cette ligne sert à aligner avec l'herbe (on fait la meme sur la collision shape), il doit y avoir mieux
        this.mesh.rotateZ(-Math.PI * 0.5)
        scene.add(this.mesh);

        // fait le donut autour du terrain
        if (this.isRound) {
            const donutGeometry = new THREE.TorusGeometry(this.size / 2, 17, 32, 32);
            const donutMaterial = new THREE.MeshBasicMaterial({ color: 0x6D4C41 });
            const donutMesh = new THREE.Mesh(donutGeometry, donutMaterial);
            donutMesh.rotateX(Math.PI / 2)
            scene.add(donutMesh);
        }
    }

    initPhysics(world) {
        // récupère une copie local de la heightMap pour la collision
        let collisionHeightMap = this.collisionHeightMap;
        // si le terrain est rond...
        if (this.isRound) {
            // remet la collision heightMap a 0
            collisionHeightMap = Array(this.size / this.segmentSize).fill(0).map(val => Array(this.size / this.segmentSize).fill(0));
            // pour chaque point de l'ancienne collisionHeightMap...
            for (let i = 0; i < this.collisionHeightMap.length; i++) {
                for (let j = 0; j < this.collisionHeightMap.length; j++) {
                    // récupère la hauteur d'un poinr de l'ancienne collisionHeightMap
                    let height = this.collisionHeightMap[i][j];
                    // calcule la position de ce point si la collisionMap etait ronde
                    let newPos = mapToUnitCircle(map(i, 0, this.collisionHeightMap.length, -1, 1), map(j, 0, this.collisionHeightMap.length, -1, 1));
                    collisionHeightMap
                    // applique la hauteur du point à sa position "arrondie" sur la nouvelle collisionHeightMap
                    [Math.floor(map(newPos[0], -1, 1, 0, this.collisionHeightMap.length))]
                    [Math.floor(map(newPos[1], -1, 1, 0, this.collisionHeightMap.length))] = height;
                }
            }
        }
        // génère la shepe pour la collision a partir de la collisionShape
        const heightFieldShape = new CANNON.Heightfield(collisionHeightMap, { elementSize: this.segmentSize });
        const heightFieldBody = new CANNON.Body({ shape: heightFieldShape })
        // positionne la shape sur la mesh
        heightFieldBody.position.set(-this.size / 2, -1, -this.size / 2);
        // applique la meme rotation que la mesh
        heightFieldBody.quaternion.copy(this.mesh.quaternion);
        world.addBody(heightFieldBody);
    }

    updateGrass(scene, cameraController) {
        if (this.grassMaterial != undefined)
            // fait progresser le temps du shader de l'herbe pour l'animation
            this.grassMaterial.uniforms.time.value += 1;
    }

}



export default Terrain
