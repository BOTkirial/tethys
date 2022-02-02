import * as THREE from "three";
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';

class PlayerController {

    constructor(renderer) {
        // la camera et le control fps
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
        this.controls = new PointerLockControls(this.camera, renderer.domElement);
        // evenement pour locker le curseur et activer les controls
        renderer.domElement.addEventListener("click", () => {
            this.controls.connect();
            this.controls.lock();
        });
        this.controls.addEventListener("lock", () => {
            console.log("locked")
        });
        this.controls.addEventListener("unlock", () => {
            console.log("unlocked")
        })
        // la scene que voit la camera
        this.scene = undefined;
        // la vitesse à laquelle se déplace le player
        this.speed = 30;
        this.direction = new THREE.Vector3(0, 0, 0);
    }

    // définit la scene que voit la camera
    setScene(scene) {
        this.scene = scene;
    }

    // ajoute le controleur à la scene
    init(scene) {
        this.setScene(scene);
        // créé la sphere physique pour les collisions
        const sphereGeometry = new THREE.SphereBufferGeometry(2);
        const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xFF0000 });
        this.sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
        this.sphereMesh.position.set(10, 40, 0);
        this.sphereBody = scene.addMeshWithSpherePhysics(this.sphereMesh);
        // événements pour le controle
        window.addEventListener("keydown", (e) => {
            switch (e.key) {
                case "z": this.direction.z = 1;
                case "q": this.direction.x = -1;
                case "s": this.direction.z = -1;
                case "d": this.direction.x = 1;
            }
        })
        window.addEventListener("keyup", (e) => {
            switch (e.key) {
                case "z": this.direction.z = 0;
                case "s": this.direction.z = 0;
                case "q": this.direction.x = 0;
                case "d": this.direction.x = 0;
            }
        })
        console.log(this.sphereBody)
    }

    update() {
        // déplace la sphere
        this.sphereBody.velocity.x = this.direction.x * this.speed;
        this.sphereBody.velocity.z = this.direction.z * this.speed;
        // met la camera sur la position de la sphere
        this.camera.position.copy(this.sphereMesh.position)
        this.camera.position.y += 7;
    }

}

export default PlayerController;