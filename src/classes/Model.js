import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

const loader = new GLTFLoader();

class Model {

    constructor(url, scale, position = new THREE.Vector3(0, 0, 0), rotation = new THREE.Vector3(0, 0, 0)) {
        this.url = url;
        this.scale = scale;
        this.position = position;
        this.rotation = rotation;
    }

    init(scene, callback) {
        loader.load(
            // resource URL
            this.url,
            // called when the resource is loaded
            function (gltf) {
                console.log("loaded")
                gltf.scene.scale.set(this.scale, this.scale, this.scale);
                gltf.scene.position.copy(this.position);
                gltf.scene.rotation.setFromVector3(this.rotation);
                scene.add(gltf.scene)
                if (callback != undefined)
                    callback(gltf.scene)
            }.bind(this)
        );
    }

}

export default Model;