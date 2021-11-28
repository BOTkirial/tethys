import * as THREE from "three";
import * as CANNON from "cannon-es";
import CannonDebugRenderer from '../../lib/cannonDebugRenderer'
import CannonUtils from "../../lib/cannonUtils";


class Scene extends THREE.Scene {

    constructor(fogColor = new THREE.Color(0xDDE0E3), fogNear = 0, fogFar = 1000) {
        super();
        // propriétés du brouillard
        this.fogColor = fogColor;
        this.fogNear = fogNear;
        this.fogFar = fogFar;
        // pour la durée d'une step de simulation physique
        this.clock = new THREE.Clock();
    }

    enablePhysics() {
        this.world = new CANNON.World();
        this.world.gravity.set(0, -9.82, 0);
        this.world.broadphase = new CANNON.NaiveBroadphase();
        this.world.allowSleep = true;
        this.world.solver.iterations = 10;
        this.cannonDebugRenderer = new CannonDebugRenderer(this, this.world)
    }

    setSky(renderer, url) {
        const loader = new THREE.TextureLoader();
        const texture = loader.load(
            url,
            () => {
                const rt = new THREE.WebGLCubeRenderTarget(texture.image.height);
                rt.fromEquirectangularTexture(renderer, texture);
                this.background = rt.texture;
            });
    }

    setBackgroundColor(color) {
        this.background = new THREE.Color(color)
    }

    setLight() {
        const light = new THREE.AmbientLight(0xFFFFFF, 1);
        this.add(light);
    }

    setFog() {
        this.fog = new THREE.Fog(this.fogColor, this.fogNear, this.fogFar)
    }

    getFogColor() {
        return this.fogColor;
    }

    getFogNear() {
        return this.fogNear;
    }

    getFogFar() {
        return this.fogFar;
    }

    getWorld() {
        return this.world;
    }

    addMeshWithBoxPhysics(mesh, type) {
        const t = type === "static" ? CANNON.Body.STATIC : CANNON.Body.DYNAMIC;
        // calcule la boundingBox de la mesh
        mesh.geometry.computeBoundingBox();
        const boundingBox = mesh.geometry.boundingBox;
        // utilise un vec3 qui fait la moitiée de la boundingBox pour générer la collisionShape
        const halfExtents = new CANNON.Vec3((boundingBox.max.x - boundingBox.min.x) / 2, (boundingBox.max.y - boundingBox.min.y) / 2, (boundingBox.max.z - boundingBox.min.z) / 2);
        // créé le corps physique
        const body = new CANNON.Body({ mass: 1, type: t });
        body.addShape(new CANNON.Box(halfExtents));
        // positionne la partie physique sur la partie visuelle
        body.position.copy(mesh.position);
        body.quaternion.copy(mesh.quaternion);
        // stocke une référence à la partie visuelle dans la partie physique pour synchroniser les deux lors de l'update
        body.mesh = mesh;
        // ajoute la partie visuelle a la scene
        this.add(mesh)
        // ajoute la partie physique au monde
        this.world.addBody(body)
    }

    addMeshWithSpherePhysics(mesh, type) {
        const t = type === "static" ? CANNON.Body.STATIC : CANNON.Body.DYNAMIC;
        // calcule la boundingSphere pour la mesh
        mesh.geometry.computeBoundingSphere();
        const boundingSphere = mesh.geometry.boundingSphere;
        // créé la collision mesh sphere avec le radius de la bounding sphere
        const radius = boundingSphere.radius;
        const body = new CANNON.Body({ mass: 1, type: t });
        body.addShape(new CANNON.Sphere(radius));
        // positionne la sphere physique sur la sphere visuelle
        body.position.copy(mesh.position);
        body.quaternion.copy(mesh.quaternion);
        // garde une regerence a la partie visuelle dans la partie physique
        body.mesh = mesh;
        // ajoute les deux parties a la scene et au monde
        this.add(mesh);
        this.world.addBody(body);
    }

    addMeshWithPhysics(mesh, type) {
        const t = type === "static" ? CANNON.Body.STATIC : CANNON.Body.DYNAMIC;
        const shape = CannonUtils.CreateTrimesh(mesh.geometry);
        const body = new CANNON.Body({ mass: 1, type: t });
        body.addShape(shape);
        // positionne le physique sur le visuel
        body.position.copy(mesh.position);
        body.quaternion.copy(mesh.quaternion);
        // garde la reference visuelle
        body.mesh = mesh;
        // ajoute les deux parties a la scene et au monde
        this.world.addBody(body);
        this.add(mesh);
    }

    updatePhysics() {
        // ne s'execute que si le monde physique est défini
        if (this.world === undefined) return;
        // calcule le temps passé depuis la derniere simulation
        let delta = this.clock.getDelta();
        if (delta > 0.1) delta = 0.1;
        // simule le temps passé
        this.world.step(delta);
        // this.cannonDebugRenderer.update()

        // pour chaque body physique dans le monde
        this.world.bodies.forEach((body) => {
            // met la position de la partie visuelle à jour avec la position de la partie physique
            body.mesh.position.set(body.position.x, body.position.y, body.position.z);
            // met la rotation de la partie visuelle à jour avec la rotation de la partie physique
            body.mesh.quaternion.set(
                body.quaternion.x,
                body.quaternion.y,
                body.quaternion.z,
                body.quaternion.w
            )
        });
    }

}

export default Scene;