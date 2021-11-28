class Renderer extends THREE.WebGLRenderer {

    constructor(params) {
        super(params);
        this.toneMapping = THREE.LinearToneMapping;
        this.outputEncoding = THREE.sRGBEncoding;
        this.setPixelRatio(window.devicePixelRatio);
        this.setSize(window.innerWidth, window.innerHeight);

        // display debug infos
        this.geometriesCount = document.querySelector("#text1");
        this.drawCallsCount = document.querySelector("#text2");
        this.verticesCount = document.querySelector("#text3");

        // compte les frames
        this.frame = 0n;
    }

    update(scene, camera, target = null) {
        this.frame += 1n;

        if(this.frame % 10n === 0n) {
            this.geometriesCount.innerHTML = this.info.memory.geometries;
            this.drawCallsCount.innerHTML = this.info.render.calls;
            this.verticesCount.innerHTML = this.info.render.triangles;
        }

        this.setRenderTarget(target);
        this.render(scene, camera);
    }

}

export default Renderer;