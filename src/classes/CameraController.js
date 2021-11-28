import * as THREE from "three";

class CameraController {

    constructor(position = new THREE.Vector3(0, 0, 0), rotation = new THREE.Vector3(0, 0, 0)) {
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
        this.camera.rotation.order = "YXZ"
        this.camera.position.set(position.x, position.y, position.z);
        this.camera.rotation.set(rotation.x, rotation.y, rotation.z);
        // la caméra voit tous les calques
        this.camera.layers.enableAll();
        this.direction = new THREE.Vector3(0, 0, 0);
        this.speed = 10;
        // définit le cone de vision pour faire du culling en plus du culling automatique
        this.viewFrustum = new THREE.Frustum().setFromProjectionMatrix(this.camera.projectionMatrix);
    }

    init(scene) {
        this.setScene(scene);

        // verrouille le curseur
        window.addEventListener("click", function () {
            document.querySelector("#canvas").requestPointerLock()
        })

        // rotation de la camera
        window.addEventListener("mousemove", (e) => {
            this.camera.rotation.y -= e.movementX * 0.01;
            this.camera.rotation.x -= e.movementY * 0.01;
        });

        // déplacement de la caméra
        window.addEventListener("keydown", (e) => {
            if (e.keyCode != 122 && e.keyCode != 123 && e.keyCode != 116)
                e.preventDefault();
            switch (e.keyCode) {
                case 90:
                    this.direction.z = -this.speed
                    break;
                case 81:
                    this.direction.x = -this.speed
                    break;
                case 68:
                    this.direction.x = this.speed
                    break;
                case 83:
                    this.direction.z = this.speed
                    break;
                case 16:
                    this.direction.y = this.speed
                    break;
                case 17:
                    this.direction.y = -this.speed
                    break;
            }
        });

        // stop le déplacement
        window.addEventListener("keyup", (e) => {
            e.preventDefault();

            switch (e.keyCode) {
                case 90:
                    this.direction.z = 0
                    break;
                case 81:
                    this.direction.x = 0
                    break;
                case 68:
                    this.direction.x = 0
                    break;
                case 83:
                    this.direction.z = 0
                    break;
                case 16:
                    this.direction.y = 0
                    break;
                case 17:
                    this.direction.y = 0
                    break;
            }

        });
    }

    // la scene que la caméra envoie au renderer
    setScene(scene) {
        this.scene = scene;
    }

    update() {
        this.camera.translateOnAxis(this.direction, 0.2);
        // redresse l'axe z si jamais il est penché
        if (this.camera.rotation.z > 0.005 || this.camera.rotation.z < -0.005) {
            console.log("fixing", this.camera.rotation.z);
            if (this.camera.rotation.z > 0)
                this.camera.rotation.z -= 0.005;
            if (this.camera.rotation.z < 0)
                this.camera.rotation.z += 0.005;
        }
    }

}

export default CameraController;