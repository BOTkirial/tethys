// la géometrie et le material pour toutes les spheres
const sphereGeometry = new THREE.SphereGeometry(6, 16, 32);
const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, fog: false });

class Cloud {

    constructor(params) {

        // le centre du cercle formé par les spheres
        this.position = (params?.position != undefined) ? params?.position : new THREE.Vector3(0, 100, 0);
        // le rayon du cercle formé par les sphers
        this.rayon = (params?.rayon != undefined) ? params?.rayon : 100;
        // l'offset pour séparer les deux rangées de spheres
        this.offset = (params?.offset != undefined) ? params?.offset : 5;
        // le nombre de spheres qui compose un nuage
        this.nbSPheres = (params?.nbSPheres != undefined) ? params?.nbSPheres : 25;
        // la vitesse à laquelle le groupe tourne sur lui meme
        this.rotationSpeed = (params?.rotationSpeed != undefined) ? params?.rotationSpeed : -0.0005;
        // la vitesse à laquelle l'angle se déplace pour créer les nouvelles spheres
        this.angleIncreaseSpeed = (params?.angleIncreaseSpeed != undefined) ? params?.angleIncreaseSpeed : 0.001;
        // la scale maximale a laquelle les spheres sont autorisées
        this.maxScale = (params?.maxScale != undefined) ? params?.maxScale : 1.5;
        
        // le groupe "nuage" qui est composé de spheres
        this.group = new THREE.Group();
        this.group.position.copy(this.position);

        // permet le positionnement en coordonnées polaires
        this.angle = Math.random() * Math.PI * 2;

        // place X spheres 2 par 2
        for (let cpt = 0; cpt < this.nbSPheres; cpt += 2) {
            let x = this.rayon * Math.cos(this.angle + THREE.MathUtils.degToRad(1 * cpt * 0.7));
            let y = this.randomY();
            let z = this.rayon * Math.sin(this.angle + THREE.MathUtils.degToRad(1 * cpt * 0.7));
            let position = new THREE.Vector3(x, y, z);
            this.createSphere(position, this.rayon);

            x = (this.rayon + this.offset) * Math.cos(this.angle + THREE.MathUtils.degToRad(1 * cpt * 0.7));
            y = this.randomY();
            z = (this.rayon + this.offset) * Math.sin(this.angle + THREE.MathUtils.degToRad(1 * cpt * 0.7));
            position = new THREE.Vector3(x, y, z);
            this.createSphere(position, this.rayon + this.offset);
        }

    }

    // génère la position y aléatoirement pour les nouvelles spheres
    randomY() {
        let scale = 8;
        return Math.random() * scale - (scale / 2);
    }

    update() {

        // fait tourner le groupe complet sur lui meme
        this.group.rotateOnAxis(new THREE.Vector3(0.0, 1.0, 0.0), this.rotationSpeed)

        // fait avancer l'angle pour les coordonnées polaires
        if (this.rotationSpeed > 0)
            this.angle -= this.angleIncreaseSpeed;
        else
            this.angle += this.angleIncreaseSpeed;

        // réduit la scale de la derniere sphere
        const backSphere = this.group.children[0]
        this.scaleSphereDown(backSphere, 0.01)

        // réduit les scales de toutes les spheres qui sont dans la moitié arriere
        for (let cpt = 0; cpt < this.group.children.length * 0.3; cpt++) {
            let currentSphere = this.group.children[cpt]
            this.scaleSphereDown(currentSphere, 0.005)
        }

        // augement la scale de toutes les spheres qui sont dans la moitié avant
        for (let cpt = this.group.children.length / 2; cpt < this.group.children.length - 1; cpt++) {
            let currentSphere = this.group.children[cpt]
            this.scaleSphereUp(currentSphere, 0.005)
        }

        // augmente la scale de la premiere sphere
        const frontSphere = this.group.children[this.group.children.length - 1];
        this.scaleSphereUp(frontSphere, 0.01)
    }

    // gere la réduction de la scale des spheres
    scaleSphereDown(sphere, rate) {
        // récup la scale de la sphere en question et la reduit
        const currentRayon = sphere.rayon;
        // ne vas jamais en dessous d'une scale de 0
        if (sphere.scale.x > 0) {
            sphere.scale.subScalar(rate)
        } else {
            // sinon retire la sphere du groupe
            this.group.remove(sphere);
            // créé une nouvelle sphere
            let x = currentRayon * Math.cos(this.angle + THREE.MathUtils.degToRad(1 * 0.5));
            let y = sphere.position.clone().y;
            let z = currentRayon * Math.sin(this.angle + THREE.MathUtils.degToRad(1 * 0.5));
            this.createSphere(new THREE.Vector3(x, y, z), currentRayon, true)
        }
    }

    // gere l'augementation de la scale des spheres
    scaleSphereUp(sphere, rate) {
        // ne depasse jamais une scale de 1
        if (sphere.scale.x < this.maxScale)
            sphere.scale.addScalar(rate)
    }

    // crée une mesh de sphere et l'ajoute au group
    createSphere(position, rayon, scaleIsZero = false) {
        const mesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
        mesh.rayon = rayon
        // si c'est une sphere ajoutée après le setup initial, sa scale est de 0 car elle doit grandir
        if (scaleIsZero)
            mesh.scale.set(0, 0, 0)
        mesh.position.copy(position)
        this.group.add(mesh)
    }

    // ajoute le group des spheres à la scene
    init(scene) {
        scene.add(this.group);
        return this;
    }

}

export default Cloud;