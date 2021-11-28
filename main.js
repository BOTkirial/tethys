import Renderer from "./src/classes/Renderer.js";
import Scene from "./src/classes/Scene.js";
import CameraController from "./src/classes/CameraController.js";
import Water from "./src/classes/Water.js";
import Cloud from "./src/classes/Cloud.js";
import Terrain from "./src/classes/Terrain.js";
import Snake from "./src/classes/Snake.js";
import Portal from "./src/classes/PortalRound.js";
import Model from "./src/classes/Model.js";

const { AmmoPhysics, PhysicsLoader } = ENABLE3D;
let renderer, scene, sceneSnake, cameraController, physics, clock;

function Main() {

    // ==========SETUP==========

    renderer = new Renderer({ canvas: document.querySelector("#canvas") });

    scene = new Scene(new THREE.Color(0xDDE0E3), 0, 400);
    scene.setSky(renderer, "src/textures/ciel.png");
    scene.setLight();
    scene.setFog();

    sceneSnake = new Scene();
    sceneSnake.setBackgroundColor(0xFF0000);

    cameraController = new CameraController(new THREE.Vector3(0, 20, 0));
    cameraController.init(scene);

    physics = new AmmoPhysics(scene);
    physics.debug.enable(true);
    clock = new THREE.Clock();

    // ==========LOGIQUE==========

    function spawnCube(x, y, z) {
        const geometry = new THREE.BoxBufferGeometry(1, 1, 1)
        const material = new THREE.MeshLambertMaterial({ color: 0x00ff00 })
        const cube = new THREE.Mesh(geometry, material)
        cube.position.set(x, y, z)
        scene.add(cube)
        physics.add.existing(cube)
        cube.body.setCollisionFlags(0)
    }

    for (let cpt = 0; cpt < 5; cpt++)
        spawnCube(0, 50 + 10 * cpt, -20)

    spawnCube(120, 30, 100);

    const water = new Water(1024, 1024, new THREE.Vector3(0, 5.5, 0), true);
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

    const terrain = new Terrain(true, 8, 2);
    terrain.init(scene);
    // terrain.initPhysics(physics);
    terrain.spawnGrass(scene);
    terrain.spawnTrees(scene);

    const house = new Model("src/models/maison.glb", 100);
    house.position.set(100, 40, 140);
    house.rotation.set(0, 2 * Math.PI, 0);
    console.log(house)
    house.init(scene);

    function gameloop() {

        cameraController.update();
        tabClouds.forEach((cloud) => { cloud.update() })
        water.update();
        terrain.updateGrass(scene, cameraController);
        snake.update(renderer, cameraController);
        portal.update(renderer, cameraController);

        physics.update(clock.getDelta() * 1000);
        physics.updateDebugger();

        renderer.update(cameraController.scene, cameraController.camera);

        window.requestAnimationFrame(gameloop);
    }

    gameloop();
}

PhysicsLoader('/lib/ammo/kripken', () => Main())
