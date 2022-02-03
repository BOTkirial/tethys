import * as THREE from "three";
import Model from "./Model.js";
import Portal from "./PortalRound.js";

class Snake {

    constructor(position = new THREE.Vector3(0, 500, 0)) {
        this.position = position;
        this.head = new SnakeHead(this);
        this.body = new SnakeBody(this, 30);
    }

    init(scene) {
        this.head.init(scene);
        this.body.init(scene);
        // ajoute le portal dans la bouche du serpent
        this.portal = new Portal({ size: 50 })
        this.portal.init(scene);
        this.portal.hideScreenStructure();
    }

    update(renderer, cameraController) {
        if (this.head.initialized && this.body.initialized) {
            this.head.update();
            this.body.update();
            // déplace le portal en meme temps que la tete du serpent
            this.portal.screenMesh.position.copy(this.getHead().position);
            this.portal.screenMesh.rotation.copy(this.getHead().rotation);
            this.portal.screenMesh.rotateX(Math.PI / 2);
            this.portal.screenMesh.position.add(this.getHead().direction.clone().multiplyScalar(20));
            this.portal.update(renderer, cameraController)
        }
    }

    getHead() {
        return this.head;
    }

    getBody() {
        return this.body;
    }

}

class SnakeHead extends THREE.Object3D {

    constructor(snake) {
        super();
        this.direction = new THREE.Vector3(0, 0, 1);
        this.angleX = 0.001;
        this.angleY = -0.000;
        this.speedScale = 1;
        this.max = 6;
        this.initialized = false;
        this.snake = snake;
        this.maxPathLength = 3500;
        this.pathIndex = 0;
        this.path = [];
    }

    init(scene) {
        // charge le model
        let head = new Model("src/models/serpent/bouche.glb", 120);
        // initialise le model avec un callback qui le clone plusieurs fois avec une position différente
        head.init(this, (model) => {
            for (let cpt = 1; cpt < this.max; cpt++) {
                let newModel = model.clone();
                newModel.position.z += cpt * 10;
                this.add(newModel);
            }
            // marque l'initialisation comme faite
            this.initialized = true;
        });
        this.position.copy(this.snake.position)
        // ajoute la tete et ses enfants à la scene
        scene.add(this);
    }

    update() {
        // stocke l'historique des positions de la tete, avec un max et revient à 0 si ça déborde
        this.path[this.pathIndex % this.maxPathLength] = [this.position.clone(), this.rotation.clone()];
        this.pathIndex++;
        // fait tourner et déplacer la tete
        this.rotate();
        this.move();
    }

    rotate() {
        // fait tourner les dents soit dans un sens soit dans l'autre
        for (let cpt = 0; cpt < this.max; cpt++) {
            let head = this.children[cpt];
            if (head != undefined)
                head.rotation.z += (cpt % 2 == 0) ? 0.01 : -0.01;
        }
    }

    move() {
        // offset à appliquer à la direction pour le faire serpenter
        let offset = Math.cos(Number(this.pathIndex) * 0.01) * 0.005;
        // déplace la tete dans la direction actuelle selon la vitesse
        this.position.add(this.direction.clone().normalize().multiplyScalar(this.speedScale))
        // change la direction horizontallement + l'offset pour le faire serpenter
        this.direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.angleX + offset).normalize();
        this.direction.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.angleY + offset).normalize();
        // oriente la tete dans la direction actuelle
        this.lookAt(this.position.clone().add(this.direction.clone().normalize().multiplyScalar(this.speedScale)))
    }

}

class SnakeBody extends THREE.Object3D {

    constructor(snake, nbSegments) {
        super();
        this.nbSegments = nbSegments;
        this.initialized = false;
        this.snake = snake;
        this.index = 0;
    }

    init(scene) {
        let segment = new Model("src/models/serpent/segment.glb", 80);
        segment.init(this, (model) => {
            // modifie le 1er model comme ceux du callback
            this.children[0].pathIndex = 0;
            this.children[0].position.copy(this.snake.position)
            for (let cpt = 1; cpt < this.nbSegments; cpt++) {
                let newModel = model.clone();
                newModel.pathIndex = 0;
                newModel.position.copy(this.snake.position)
                this.add(newModel);
            }
            scene.add(this);
            this.initialized = true;
        });
    }

    update() {

        // l'offset à appliquer pour aller chercher la position du segment
        let offset = 6;
        // l'offset à appliquer au premier segment après la tete
        let firstSegmentOffset = 30;
        for (let cpt = 0; cpt < this.children.length; cpt++) {
            let currentSegment = this.children[cpt];
            // si l'index pour ce segment existe
            if (this.index - firstSegmentOffset - (offset * cpt) > 0) {
                let transform = this.snake.getHead().path[(this.index - firstSegmentOffset - offset * cpt) % this.snake.getHead().maxPathLength]
                currentSegment.position.copy(transform[0])
                currentSegment.rotation.copy(transform[1])
            }
        }

        this.index++;

    }

}

export default Snake;