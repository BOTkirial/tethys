const vertexShader =
    `
uniform float u_time;
varying vec2 vUv;

vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
    + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
        dot(x12.zw,x12.zw)), 0.0);
    m = m*m ;
    m = m*m ;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
}

void main() {
    vUv = uv;
    float y = snoise(vec2(position.x  + u_time, position.y) * 0.05);
    vec3 newPosition = vec3(position.x, position.y, y);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.); 
}
`

const fragmentShader =
    `
uniform sampler2D text;
uniform float u_time;
uniform float textureRepeatX;
uniform float textureRepeatY;
varying vec2 vUv;
// pour le brouillard
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;

float getBrightness(vec3 pixel) {
    return (pixel.x + pixel.y + pixel.z) / 3.0;
}

void main() {
    float offset = u_time * 0.02;
    vec4 pixelColor = texture(text, vec2(vUv.x * textureRepeatX + offset, vUv.y * textureRepeatY + offset));
    float brightness = getBrightness(pixelColor.xyz);
    if(brightness > 0.5) {
        gl_FragColor = vec4(pixelColor.x, pixelColor.y, pixelColor.z, 0.65);
    } else {
        gl_FragColor = vec4(pixelColor.x, pixelColor.y, pixelColor.z, 0.3);
    }
    #ifdef USE_FOG
          #ifdef USE_LOGDEPTHBUF_EXT
              float depth = gl_FragDepthEXT / gl_FragCoord.w;
          #else
              float depth = gl_FragCoord.z / gl_FragCoord.w;
          #endif
          float fogFactor = smoothstep( fogNear, fogFar, depth );
          gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
      #endif
}
`

class Water extends THREE.Mesh {

    constructor(width = 10, depth = 10, position = new THREE.Vector3(0, 0, 0), isRound = false) {
        super();
        this.width = width;
        this.depth = depth;
        this.position.copy(position);
        this.isRound = isRound;
    }

    init(scene) {

        let texture = new THREE.TextureLoader().load('./src/textures/water.jpg');
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        
        this.material = new THREE.ShaderMaterial({
            // wireframe: true,
            fog: true,
            uniforms: {
                u_time: { value: 0.0 },
                text: { type: "t", value: texture },
                textureRepeatX: { type: "f", value: this.width / 20.0 },
                textureRepeatY: { type: "f", value: this.depth / 20.0 },
                // pour le brouillard
                fogColor: { type: "c", value: scene.getFogColor() },
                fogNear: { type: "f", value: scene.getFogNear() },
                fogFar: { type: "f", value: scene.getFogFar() }
            },
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            transparent: true
        });

        this.geometry = new THREE.PlaneGeometry(this.width, this.depth, this.width / 16, this.depth / 16);

        if (this.isRound) {
            // parcourt chaque point de l'eau pour la mettre en rond
            let index = 0;
            let size = this.width;
            for (let cpt = 0; cpt < this.geometry.attributes.position.array.length; cpt += 3) {
                let newPosX = map(this.geometry.attributes.position.array[cpt], - size / 2, size / 2, -1, 1);
                let newPosY = map(this.geometry.attributes.position.array[cpt + 1], - size / 2, size / 2, -1, 1);
                let newPos = mapToUnitCircle(newPosX, newPosY);

                this.geometry.attributes.position.array[cpt + 0] = newPos[0] * size / 2;
                this.geometry.attributes.position.array[cpt + 1] = newPos[1] * size / 2;

                index++;
            }
        }

        this.rotateOnAxis(new THREE.Vector3(1.0, 0.0, 0.0), -Math.PI / 2);
        scene.add(this);
    }

    update() {
        this.material.uniforms.u_time.value += 0.05;
    }

}

export default Water;