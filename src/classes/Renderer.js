import * as THREE from "three";

class Renderer extends THREE.WebGLRenderer {

    constructor() {
        // créé la canvas pour dessiner
        const canvas = document.createElement("canvas");
        canvas.setAttribute("id", "canvas");
        document.body.appendChild(canvas);
        // envoie la canvas a la class héritée
        super({ canvas: canvas });
        // parametrage des couleurs
        this.toneMapping = THREE.LinearToneMapping;
        this.outputEncoding = THREE.sRGBEncoding;
        // résolution et taille de la canvas
        this.setPixelRatio(window.devicePixelRatio);
        this.setSize(window.innerWidth, window.innerHeight);

        // créé les elements html pour afficher les infos de debug
        this.geometriesCountReference = document.createElement("p");
        this.drawCallsCountReference = document.createElement("p");
        this.verticesCountReference = document.createElement("p");
        this.geometriesCountReference.setAttribute("class", "debugInfo");
        this.drawCallsCountReference.setAttribute("class", "debugInfo");
        this.verticesCountReference.setAttribute("class", "debugInfo");
        // ajoute les elements au document
        document.body.appendChild(this.geometriesCountReference);
        document.body.appendChild(this.drawCallsCountReference);
        document.body.appendChild(this.verticesCountReference);
        // compte les frames
        this.frame = 0n;
    }

    update(scene, camera, target = null) {
        this.frame += 1n;

        if(this.frame % 10n === 0n) {
            this.geometriesCountReference.innerHTML = this.info.memory.geometries;
            this.drawCallsCountReference.innerHTML = this.info.render.calls;
            this.verticesCountReference.innerHTML = this.info.render.triangles;
        }

        this.setRenderTarget(target);
        this.render(scene, camera);
    }

}

export default Renderer;