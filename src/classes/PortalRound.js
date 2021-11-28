class Portal {

    constructor(params) {
        this.size = params?.size != undefined ? params.size : 10;
        this.position = params?.position != undefined ? params.position : new THREE.Vector3(0, 0, 0);
        this.rotation = params?.rotation != undefined ? params.rotation : new THREE.Vector3(0, 0, 0);
        this.associatedPortal = undefined;
        this.previousSide = undefined;
        this.canTP = true;
        // permet de verifier si le portal est visible, et si oui fait l'update
        this.frustum = new THREE.Frustum();
    }

    createScreenStructure(color = 0x212121) {
        const geometry = new THREE.TorusGeometry(this.size, 1, 8, 48);
        const material = new THREE.MeshStandardMaterial({ color: color });
        this.structure = new THREE.Mesh(geometry, material);
        this.structure.position.set(this.position.x, this.position.y, this.position.z);
        this.structure.rotation.set(this.rotation.x, this.rotation.y, this.rotation.z);
        this.scene.add(this.structure)
    }

    hideScreenStructure() {
        this.structure.visible = false;
    }

    createScreenMesh() {
        this.renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
        this.renderTarget.texture.encoding = 3001; // passe en sRGB
        const shader = new THREE.ShaderMaterial({

            side: THREE.DoubleSide,

            uniforms: {
                width: { value: window.innerWidth },
                height: { value: window.innerHeight },
                text: { value: this.renderTarget.texture }
            },

            vertexShader:
                `
            varying vec3 UV; 

            void main() {
                UV = position; 

                vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * modelViewPosition; 
            }
            `,

            fragmentShader:
                `
            uniform sampler2D text;
            uniform float width;
            uniform float height;
            uniform sampler2D ouverture;
            varying vec3 UV;
        
            void main()	{
              vec4 pixelColor = texture(text, vec2(gl_FragCoord.x / width, gl_FragCoord.y / height));
              gl_FragColor = pixelColor;
            }
            `
        });

        const geometry = new THREE.CylinderGeometry(this.size, this.size, 2, 32);
        this.screenMesh = new THREE.Mesh(geometry, shader);
        this.screenMesh.position.set(this.position.x, this.position.y, this.position.z);
        this.screenMesh.rotation.set(this.rotation.x, this.rotation.y, this.rotation.z)
        this.screenMesh.rotateX(Math.PI / 2);
        this.scene.add(this.screenMesh);

        this.screenMesh.layers.disableAll();
        this.screenMesh.layers.enable(10)

        // this.normalHelper = new THREE.ArrowHelper(this.getScreenNormal(), this.screenMesh.position, 10, 0xFFFFFF)
        // scene.add(this.normalHelper)
    }

    setScreenVisibility(visibility) {
        this.screenMesh.visible = visibility;
    }

    getScreenNormal() {
        return new THREE.Vector3(0, 1, 0).applyQuaternion(this.screenMesh.quaternion)
    }

    createCamera() {
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.rotation.order = "YXZ";
        this.camera.layers.enableAll()
        this.camera.layers.disable(10)
    }

    createDummy(color = 0xF4511E) {
        const boxGeometry = new THREE.BoxGeometry(6, 6, 0.2);
        const boxMaterial = new THREE.MeshBasicMaterial({ color: color });
        this.dummy = new THREE.Mesh(boxGeometry, boxMaterial);
        this.dummy.position.set(0, 10, 0)
        this.dummy.rotation.setFromVector3(this.rotation)
        this.dummy.visible = false;
        this.scene.add(this.dummy)
        // this.cameraHelper = new THREE.CameraHelper(this.camera);
        // scene.add(this.cameraHelper);
    }

    setAssociatedPortal(portal) {
        // prévient si la taille des portal est différentes
        if (portal.size !== this.size)
            console.warn("Attention, la taille de deux portal associés n'est pas la même")
        this.associatedPortal = portal;
    }

    moveCamera(mainCamera, associatedScene) {
        // enregistre la position de départ du portal associé
        let savePosition = this.associatedPortal.screenMesh.position.clone();
        let saveRotation = this.associatedPortal.screenMesh.rotation.clone();

        // téléporte le portal associé exactement sur ce portal
        this.associatedPortal.screenMesh.position.copy(this.screenMesh.position);
        this.associatedPortal.screenMesh.rotation.setFromVector3(this.screenMesh.rotation);
        // this.associatedPortal.screenMesh.rotateX(Math.PI / 2); // parce que c'est un cylindre et par défaut il est couché

        // détache la dummy du portal associé pour la passer en coordonnées globales
        associatedScene.attach(this.associatedPortal.dummy);
        // positionne la dummy du portal associée sur la mainCamera
        this.associatedPortal.dummy.position.copy(mainCamera.position.clone());
        this.associatedPortal.dummy.rotation.copy(mainCamera.rotation.clone());
        // ré attache la dummy à son portal associé
        this.associatedPortal.screenMesh.attach(this.associatedPortal.dummy);

        // annule toutes les translations et rotation du portal associé pour pouvoir faire les transformations oklm
        this.associatedPortal.screenMesh.position.set(0, 0, 0);
        this.associatedPortal.screenMesh.rotation.set(Math.PI / 2, 0, 0); // parce que c'est un cylindre et par défaut il est couché

        // fait passer la dumy de l'autre coté et la retourne
        this.associatedPortal.dummy.position.reflect(new THREE.Vector3(0.0, 0.0, -1.0).applyQuaternion(this.associatedPortal.screenMesh.quaternion)).reflect(new THREE.Vector3(-1.0, 0.0, 0.0).applyQuaternion(this.associatedPortal.screenMesh.quaternion))
        this.associatedPortal.dummy.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), Math.PI)

        // renvoie le portal associé d'où il vient
        this.associatedPortal.screenMesh.position.copy(savePosition)
        this.associatedPortal.screenMesh.rotation.copy(saveRotation)

        // repasse la dummy en coordonnées globales et positionne la caméra du portal dessus
        associatedScene.attach(this.associatedPortal.dummy)
        this.camera.position.copy(this.associatedPortal.dummy.position)
        this.camera.rotation.copy(this.associatedPortal.dummy.rotation)
    }

    checkForTp(cameraController) {
        // permet de savoir de quel côté du portal on se trouve
        const normal = this.getScreenNormal()
        const dot = normal.clone().dot(cameraController.camera.position.clone().sub(this.screenMesh.position));
        const side = dot > 0 ? 1 : -1;

        // permet de savoir si on est à l'intérieur du cercle de l'écran
        const isInRangeForTP = this.screenMesh.position.distanceTo(cameraController.camera.position) < this.size;

        // empeche de se tp d'un portal qui n'est pas dans la scene actuel de la camera
        const isRightScene = cameraController.scene.uuid == this.screenMesh.parent.uuid;

        // si le coté actuel n'est pas le meme que le coté précédent et qu'on est a portée de se tp, TP
        if (this.previousSide == 1 && isInRangeForTP && isRightScene)
            if (side != this.previousSide)
                this.tp(cameraController)

        // enregistre le coté précédent pour la comparaison
        this.previousSide = side;
    }

    tp(cameraController) {
        if (this.canTP && this.associatedPortal.canTP) {
            console.log("TP");
            // on bloque les tp successive
            this.canTP = false;
            this.associatedPortal.canTP = false;
            // positionne la camera sur la dummy caméra du portal associé
            cameraController.camera.position.copy(this.associatedPortal.dummy.position);
            cameraController.camera.rotation.copy(this.associatedPortal.dummy.rotation);
            // change la scene de la cameraController si besoin
            cameraController.setScene(this.associatedPortal.scene)
            let that = this;
            // cache l'intérieur du portal sur lequel on se tp pour éviter de voir son intérieur quand on y arrive
            this.associatedPortal.setScreenVisibility(false);
            window.setTimeout(function () {
                that.canTP = true;
                that.associatedPortal.canTP = true;
                that.associatedPortal.setScreenVisibility(true);
            }, 150)
        }
    }

    init(scene) {
        this.scene = scene;
        this.createScreenStructure(this.color);
        this.createScreenMesh();
        this.createCamera();
        this.createDummy(this.color);
    }

    update(renderer, cameraController) {

        // si ce portal a un portal associé
        if (this.associatedPortal != undefined) {

            // vérifie si il est visible
            this.frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cameraController.camera.projectionMatrix, cameraController.camera.matrixWorldInverse));
            const isVisible = this.frustum.intersectsObject(this.screenMesh);

            const mainCamera = cameraController.camera;
            this.checkForTp(cameraController);

            if (isVisible && this.scene.uuid == cameraController.scene.uuid) {
                this.moveCamera(mainCamera, this.associatedPortal.scene);
                renderer.setRenderTarget(this.renderTarget);
                renderer.render(this.associatedPortal.scene, this.camera);
            }



        }
    }

}

export default Portal;