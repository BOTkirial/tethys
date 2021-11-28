class PortalSquare extends Portal {

    constructor(params) {
        super(params)
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

            fragmentShader:
                `
            uniform sampler2D text;
            uniform float width;
            uniform float height;
        
            void main()	{
              vec4 pixelColor = texture(text, vec2(gl_FragCoord.x / width, gl_FragCoord.y / height));
              gl_FragColor = pixelColor;
            }
            `
        });
        const geometry = new THREE.BoxGeometry(this.size, this.size, 2);
        this.screenMesh = new THREE.Mesh(geometry, shader);
        this.screenMesh.position.set(this.position.x, this.position.y, this.position.z);
        this.screenMesh.rotation.set(this.rotation.x, this.rotation.y, this.rotation.z);
        this.scene.add(this.screenMesh);

        this.screenMesh.layers.disableAll();
        this.screenMesh.layers.enable(10)

        // this.normalHelper = new THREE.ArrowHelper(this.getScreenNormal(), this.screenMesh.position, 10, 0xFFFFFF)
        // scene.add(this.normalHelper)
    }

    getScreenNormal() {
        return new THREE.Vector3(0, 0, 1).applyQuaternion(this.screenMesh.quaternion)
    }

    moveCamera(mainCamera, associatedScene) {
        // enregistre la position de départ du portal associé
        let savePosition = this.associatedPortal.screenMesh.position.clone()
        let saveRotation = this.associatedPortal.screenMesh.rotation.clone()

        // téléporte le portal associé exactement sur ce portal
        this.associatedPortal.screenMesh.position.copy(this.position);
        this.associatedPortal.screenMesh.rotation.setFromVector3(this.rotation);

        // détache la dummy du portal associé pour la passer en coordonnées globales
        associatedScene.attach(this.associatedPortal.dummy)
        // positionne la dummy du portal associée sur la mainCamera
        this.associatedPortal.dummy.position.copy(mainCamera.position.clone())
        this.associatedPortal.dummy.rotation.copy(mainCamera.rotation.clone())
        // ré attache la dummy à son portal associé
        this.associatedPortal.screenMesh.attach(this.associatedPortal.dummy)

        // annule toutes les translations et rotation du portal associé pour pouvoir faire les transformations oklm
        this.associatedPortal.screenMesh.position.set(0, 0, 0);
        this.associatedPortal.screenMesh.rotation.set(0, 0, 0); // parce que c'est un cylindre et par défaut il est couché

        // fait passer la dumy de l'autre coté et la retourne
        this.associatedPortal.dummy.position.reflect(new THREE.Vector3(0.0, 0.0, -1.0).applyQuaternion(this.associatedPortal.screenMesh.quaternion)).reflect(new THREE.Vector3(-1.0, 0.0, 0.0).applyQuaternion(this.associatedPortal.screenMesh.quaternion))
        this.associatedPortal.dummy.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), Math.PI)

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
        const dot = normal.clone().dot(cameraController.camera.position.clone().sub(this.position));
        const side = dot > 0 ? 1 : -1;

        // permet de savoir si on est à l'intérieur du cercle de l'écran
        const isInRangeForTP = this.position.distanceTo(cameraController.camera.position) < this.size;

        // empeche de se tp d'un portal qui n'est pas dans la scene actuel de la camera
        const isRightScene = cameraController.scene.uuid == this.screenMesh.parent.uuid;

        // si le coté actuel n'est pas le meme que le coté précédent et qu'on est a portée de se tp, TP
        if (this.previousSide == 1 && isInRangeForTP && isRightScene)
            if (side != this.previousSide)
                this.tp(cameraController)

        // enregistre le coté précédent pour la comparaison
        this.previousSide = side;
    }

    init(scene) {
        this.scene = scene;
        this.createScreenMesh();
        this.createCamera();
        this.createDummy(this.color);
    }

}