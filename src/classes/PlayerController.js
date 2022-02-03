import * as THREE from "three";
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import {Body} from "cannon-es";


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
        this.direction = new THREE.Vector3(0, 0, 0);
        this.speed = 46
    }

    // définit la scene que voit la camera
    setScene(scene) {
        this.scene = scene;
    }

    // ajoute le controleur à la scene
    init(scene) {
        this.setScene(scene);
        // créé la sphere physique pour les collisions
        const sphereGeometry = new THREE.SphereBufferGeometry(5);
        const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xFF0000 });
        this.sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
        this.sphereMesh.position.set(10, 40, 0);
        this.sphereBody = scene.addMeshWithSpherePhysics(this.sphereMesh, {mass: 50, type: Body.DYNAMIC});
        // événements pour le controle
        window.addEventListener("keydown", (e) => {
            switch (e.key) {
                case "z":
                    this.direction.z = - this.speed
                    break;
                case "q":
                    this.direction.x = -this.speed
                    break;
                case "s":
                    this.direction.z = this.speed
                    break;
                case "d":
                    this.direction.x = this.speed
                    break;
            }
        })
        window.addEventListener("keyup", (e) => {
            switch (e.key) {
                case "z":
                    this.direction.z = 0
                    break;
                case "q":
                    this.direction.x = 0
                    break;
                case "s":
                    this.direction.z = 0
                    break;
                case "d":
                    this.direction.x = 0
                    break;
            }
        })
    }

    update() {
        // oriente la direction avec la camera
        const localDirection = new THREE.Vector3().copy(this.direction);
        localDirection.applyQuaternion(this.camera.quaternion)
        // déplace la sphere
        this.sphereBody.velocity.x = localDirection.x;
        this.sphereBody.velocity.z = localDirection.z;
        // met la camera sur la position de la sphere
        this.camera.position.copy(this.sphereMesh.position)
        this.camera.position.y += 4;
    }

}

export default PlayerController;