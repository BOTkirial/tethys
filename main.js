import "./style.css";
import * as THREE from "three";
import Renderer from "./src/classes/Renderer.js";
import Scene from "./src/classes/Scene.js";
import CameraController from "./src/classes/CameraController.js";
import Water from "./src/classes/Water.js";
import Cloud from "./src/classes/Cloud.js";
import Terrain from "./src/classes/Terrain.js";
import Snake from "./src/classes/Snake.js";
import Portal from "./src/classes/PortalRound.js";
import Model from "./src/classes/Model.js";

// ==========SETUP==========

const renderer = new Renderer();

const scene = new Scene(new THREE.Color(0xDDE0E3), 0, 400);
scene.enablePhysics();
scene.setSky(renderer, "src/textures/ciel.png");
scene.setLight();
scene.setFog();

const sceneSnake = new Scene();
sceneSnake.setBackgroundColor(0xFF0000);

const cameraController = new CameraController(new THREE.Vector3(0, 20, 0));
cameraController.init(scene);

// ==========LOGIQUE==========

const water = new Water(1024, 1024, new THREE.Vector3(0, 8, 0), true);
water.init(scene);

const water2 = new Water(1024, 1024, new THREE.Vector3(0, 5.5, 0), true);
water2.init(sceneSnake);

let tabClouds = [];
for (let cpt = 3; cpt < 20; cpt++)
    tabClouds.push(new Cloud({
        position: new THREE.Vector3(0, 400 - 15 * cpt, 0),
        rayon: 75 + 50 * cpt,
        nbSpheres: 25 + 5 * cpt,
        rotationSpeed: -0.0001 / (cpt / 2),
        angleIncreaseSpeed: 0.001 / (cpt / 2),
        maxScale: cpt / 2.5
    }).init(scene));

const snake = new Snake();
snake.init(scene);

const portal = new Portal({ size: 50 });
portal.init(sceneSnake);
portal.setAssociatedPortal(snake.portal);
snake.portal.setAssociatedPortal(portal);

const terrain = new Terrain(true, 8);
terrain.init(scene);
terrain.spawnGrass(scene);
terrain.spawnTrees(scene);

const house = new Model("src/models/maison.glb", 100);
house.position.set(100, 40, 140);
house.rotation.set(0, 2 * Math.PI, 0);
house.init(scene);

// const sphereGeometry = new THREE.SphereBufferGeometry(10);
// const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xFF0000 });
// const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
// sphereMesh.position.set(0, 20, 0);
// scene.addMeshWithSpherePhysics(sphereMesh);

function gameloop() {

    cameraController.update();
    tabClouds.forEach((cloud) => { cloud.update() })
    water.update();
    terrain.updateGrass(scene, cameraController);
    snake.update(renderer, cameraController);
    portal.update(renderer, cameraController);
    scene.updatePhysics();

    renderer.update(cameraController.scene, cameraController.camera);

    window.requestAnimationFrame(gameloop);
}

gameloop();