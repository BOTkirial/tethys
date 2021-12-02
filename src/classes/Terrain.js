import Model from "./Model.js";
import { map, mapToUnitCircle, showNoise } from "../lib/utils.js";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { InstancedUniformsMesh } from "three-instanced-uniforms-mesh";
import { makeNoise2D } from "open-simplex-noise";
import { makeRectangle } from "fractal-noise";

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
    if(pos.y > 6.5) {
        if(pos.y > 8.5) {
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
        const heightMap1 = makeRectangle(this.size, this.size, noise, { frequency: 0.01, amplitude: 2 });
        const heightMap2 = makeRectangle(this.size, this.size, noise2, { frequency: 0.03, amplitude: 1 });
        const heightMap3 = makeRectangle(this.size, this.size, noise3, { frequency: 0.06, amplitude: 2 });

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

        // créee la heightMap finale
        let heightScale = 14;
        for (let i = 0; i < this.heightMap.length; i++) {
            for (let j = 0; j < this.heightMap.length; j++) {
                // normalise la hauteur entre 0 et 1 puis multiplie par une scale
                let h = map(this.heightMap[i][j], min, max, 0, 1) * heightScale;
                this.heightMap[i][j] = h;
            }
        }

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
            0.05, 0.4, 0
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
        const grassHeightLimit = 8;
        const grassDensity = 1
        const flowerDensity = 0.002
        // parcourt la heightMap à la recherche de point suffisement haute
        for (let i = 0; i < this.heightMap.length; i++) {
            for (let j = 0; j < this.heightMap.length; j++) {
                // la hauteur du point
                let z = this.heightMap[i][j]
                // si il est suffisement haut
                if (z > grassHeightLimit) {
                    let newPosX = map(i, 0, this.heightMap.length, -1, 1);
                    let newPosY = map(j, 0, this.heightMap.length, -1, 1);
                    let newPos = mapToUnitCircle(newPosX, newPosY);
                    // gere la densité de l'herbe
                    if (Math.random() < grassDensity) {
                        // créé aléatoirement une herbe ou une fleur
                        if (Math.random() > flowerDensity) {
                            grassPoints.push(new THREE.Vector3(newPos[0] * this.size / 2, z * 1.4, newPos[1] * this.size / 2))
                        } else {
                            flowerPoints.push(new THREE.Vector3(newPos[0] * this.size / 2, z * 1.4, newPos[1] * this.size / 2))
                        }
                    }
                }
            }
        }

        // créé des chunks pour la répartition de l'herbe
        const nbChunks = 64; // doit etre un nombre avec une racine carré entiere
        const nbLines = Math.sqrt(nbChunks);
        const chunkSize = (this.size) / nbLines;
        const chunks = [];
        // parcourt les chunks
        for (let x = 0; x < nbLines; x++) {
            for (let z = 0; z < nbLines; z++) {
                // récupère les points qui sont compris dans ce chunk
                let chunk = grassPoints.filter((point) => {
                    const correctX = point.x > (-this.size / 2) + x * chunkSize && point.x <= (-this.size / 2) + (x + 1) * chunkSize;
                    const correctZ = point.z > (-this.size / 2) + z * chunkSize && point.z <= (-this.size / 2) + (z + 1) * chunkSize;
                    return correctX && correctZ;
                })
                chunks.push(chunk)
            }
        }

        // tableau pour générer les InstancedChunks a partir de
        this.tabInstancedMeshes = [];
        // parcourt les chunks
        for (let i = 0; i < nbChunks; i++) {
            const chunk = chunks[i];
            // créé une instanced mesh
            const instancedGrassMesh = new InstancedUniformsMesh(grassGeometry, this.grassMaterial, chunk.length);
            // parametre les uniforms de chaque instance dans cette mesh, pour placer ses brins et attribuer leurs orientation
            for (let cpt = 0; cpt < chunk.length; cpt++) {
                let position = new THREE.Vector3(chunk[cpt].x, chunk[cpt].y, chunk[cpt].z)
                instancedGrassMesh.setUniformAt("pos", cpt, position);
                instancedGrassMesh.setUniformAt("rot", cpt, Math.random() * Math.PI * 2);
            }
            // place le chunk dans le monde
            const x = i % nbLines;
            const z = Math.floor(i / nbLines);
            instancedGrassMesh.position.z = -this.size * 0.4 + x * chunkSize;
            instancedGrassMesh.position.x = -this.size * 0.4 + z * chunkSize;
            // scale pour la detection du culling du chunk
            instancedGrassMesh.scale.set(300, 50, 300);
            // const box = new THREE.BoxHelper(instancedGrassMesh, 0xFF0000);
            // scene.add(box);
            // active le culling pour les instanced mesh
            instancedGrassMesh.frustumCulled = false;
            this.tabInstancedMeshes.push(instancedGrassMesh);
        }

        // ajoute chaque instanced mesh a la scene
        for (let cpt = 0; cpt < this.tabInstancedMeshes.length; cpt++) {
            scene.add(this.tabInstancedMeshes[cpt]);
        }

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
        for (let cpt = 0; cpt < this.mesh.geometry.attributes.position.array.length; cpt += 3) {
            if (this.mesh.geometry.attributes.position.array[cpt + 1] > 10)
                if (Math.random() < 0.01)
                    treePoints.push(new THREE.Vector3(this.mesh.geometry.attributes.position.array[cpt + 0], this.mesh.geometry.attributes.position.array[cpt + 1], this.mesh.geometry.attributes.position.array[cpt + 2]))
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
        const geometry = new THREE.BoxBufferGeometry(this.size, 5, this.size, this.nbSegments, 1, this.nbSegments);

        // traverse les points de la géométrie du terrain 3 par 3 car x, y et z sont stockés dans le meme tableau à la suite
        for (let cpt = 0; cpt < geometry.attributes.position.array.length; cpt += 3) {

            const y = Math.floor(map(geometry.attributes.position.array[cpt + 2], -this.size / 2, this.size / 2, 0, this.size - 1));
            const x = Math.floor(map(geometry.attributes.position.array[cpt + 0], -this.size / 2, this.size / 2, 0, this.size - 1));
            // attribue la hauteur du point de la geometrie en fonction de sa position sur la heightMap
            let height = this.heightMap[x][y];

            // ne s'occupe que des points du haut de la box
            if (geometry.attributes.position.array[cpt + 1] > 0 && height !== undefined)
                // laisse les points aux extrémités tranquilles
                if (Math.abs(geometry.attributes.position.array[cpt]) < this.size / 2)
                    if (Math.abs(geometry.attributes.position.array[cpt + 2]) < this.size / 2)
                        // applique la nouvelle hauteur plus un offset pour faire de l'épaisseur
                        geometry.attributes.position.array[cpt + 1] = height + 2;

            // map les points du carré dans un cercle
            if (this.isRound) {
                let newPosX = map(geometry.attributes.position.array[cpt], - this.size / 2, this.size / 2, -1, 1);
                let newPosY = map(geometry.attributes.position.array[cpt + 2], - this.size / 2, this.size / 2, -1, 1);
                let newPos = mapToUnitCircle(newPosX, newPosY);

                geometry.attributes.position.array[cpt + 0] = newPos[0] * this.size / 2;
                geometry.attributes.position.array[cpt + 2] = newPos[1] * this.size / 2;
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
        scene.add(this.mesh);
        // scene.addMeshWithPhysics(this.mesh, "static");


        // fait le donut autour du terrain
        const donutGeometry = new THREE.TorusGeometry(this.size / 2, 17, 32, 32);
        const donutMaterial = new THREE.MeshBasicMaterial({ color: 0x6D4C41 });
        const donutMesh = new THREE.Mesh(donutGeometry, donutMaterial);
        donutMesh.rotateX(Math.PI / 2)
        scene.add(donutMesh);
    }

    updateGrass(scene, cameraController) {
        if (this.grassMaterial != undefined) {
            this.grassMaterial.uniforms.time.value += 1;
            // implemente un draw distance
            this.tabInstancedMeshes.forEach((instancedMesh) => {
                let distance = instancedMesh.position.distanceTo(cameraController.camera.position);
                // si la distance entre l'instanced mesh et la camera est trop haute, n'affiche pas l'instanced mesh
                if (distance > scene.getFogFar()) {
                    instancedMesh.visible = false;
                } else {
                    instancedMesh.visible = true;
                }
            })
        }
    }

}



export default Terrain
