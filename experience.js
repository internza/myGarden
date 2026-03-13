import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as TWEEN from "@tweenjs/tween.js";
import getStarfield from "./getStarfield";
import getFresnelMat from "./getFresnelMat";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";

async function main() {
  // Constants
  const TILT = -23.5 * (Math.PI / 180);
  const SPACE = new THREE.Color(0x000000);
  const SKY = new THREE.Color(0x448ee4);
  const ORBITAL_RADIUS = 15;
  const ORBITAL_SPEED = 0.5;
  const LINE_COUNT = 3000;
  const TARGET_POSITION = { z: 5 - 0.75 };
  const DURATION = 2100;
  const ACCELERATION = 1.5;

  // Three.js & Cannon.js
  const fontLoader = new FontLoader();
  const textureLoader = new THREE.TextureLoader();

  // Global variables
  let earth,
    moon,
    sun,
    stars,
    galaxy,
    lines,
    cloudModels = [],
    lightsMesh,
    cloudsMesh,
    glowMesh,
    ground,
    tree,
    cloudModel,
    grass,
    geom = new THREE.BufferGeometry(),
    earthGroup = new THREE.Group(),
    clock = new THREE.Clock(),
    oldElapsedTime = 0,
    tweenComplete = false,
    cloudGroup = new THREE.Group(),
    resume,
    miniSun;

  // Arrays
  geom.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(6 * LINE_COUNT), 3)
  );
  geom.setAttribute(
    "velocity",
    new THREE.BufferAttribute(new Float32Array(2 * LINE_COUNT), 1)
  );

  let pos = geom.getAttribute("position");
  let pa = pos.array;
  let vel = geom.getAttribute("velocity");
  let va = vel.array;

  // Scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SPACE);

  // Camera
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, 20);

  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = false;
  controls.enablePan = true;
  controls.enableRotate = true;

  // Ambient Light For Space
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
  ambientLight.position.set(10, 10, -10);
  scene.add(ambientLight);

  // // Directional Light for Space
  const sunLight = new THREE.DirectionalLight(0xffffff, 0.5);
  sunLight.position.set(-5, 0.5, 5);
  scene.add(sunLight);

  // Ambient Light on Earth
  const earthLight = new THREE.AmbientLight(0xffffff, 1.25);

  // Directional Light on Earth
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.set(1024, 1024);
  directionalLight.shadow.camera.far = 15;
  directionalLight.shadow.camera.left = -7;
  directionalLight.shadow.camera.top = 7;
  directionalLight.shadow.camera.right = 7;
  directionalLight.shadow.camera.bottom = -7;
  directionalLight.position.set(5, 5, 5);

  // Load texture helper function
  const loadTexture = (url) => {
    return new Promise((resolve, reject) => {
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(url, resolve, undefined, reject);
    });
  };

  // Load model helper function
  const loadModel = (url) => {
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.load(url, resolve, undefined, reject);
    });
  };

  // Create Earth
  const createEarth = async () => {
    const earthGeometry = new THREE.SphereGeometry(1.6, 50, 50);

    const texture = await loadTexture("/earth.jpg");
    const bumpMap = await loadTexture("/earthBump.jpg");
    const normalMap = await loadTexture("/normal.jpg");

    const earthMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      bumpMap: bumpMap,
      bumpScale: 0.05,
      normalMap: normalMap,
      metalness: 0.5,
      roughness: 0.7,
    });

    earth = new THREE.Mesh(earthGeometry, earthMaterial);
    earthGroup.add(earth);
    earthGroup.rotation.z = TILT;
    earthGroup.scale.set(2.5, 2.5, 2.5);

    const lightMaterial = new THREE.MeshStandardMaterial({
      map: textureLoader.load("/lights.jpg"),
      blending: THREE.AdditiveBlending,
    });
    lightsMesh = new THREE.Mesh(earthGeometry, lightMaterial);

    const cloudMaterial = new THREE.MeshStandardMaterial({
      map: textureLoader.load("/cloudmap.jpg"),
      blending: THREE.NormalBlending,
      transparent: true,
      opacity: 0.25,
      alphaMap: textureLoader.load("/alphamap.jpg"),
    });

    cloudsMesh = new THREE.Mesh(earthGeometry, cloudMaterial);
    cloudsMesh.scale.set(1.01, 1.01, 1.01);

    const glowMaterial = getFresnelMat();
    glowMesh = new THREE.Mesh(earthGeometry, glowMaterial);
    glowMesh.scale.setScalar(1.02);

    earthGroup.add(lightsMesh, cloudsMesh, glowMesh);

    return earthGroup;
  };

  // Create Moon
  const createMoon = async () => {
    const moonGeometry = new THREE.SphereGeometry(0.5, 50, 50);

    const texture = await loadTexture("/moon.jpg");
    const bumpMap = await loadTexture("/moonBump.jpg");
    const normalMap = await loadTexture("/moonNormal.jpg");

    const moonMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      bumpMap: bumpMap,
      bumpScale: 0.05,
      normalMap: normalMap,
      metalness: 0.5,
      roughness: 0.7,
    });

    moon = new THREE.Mesh(moonGeometry, moonMaterial);
    moon.position.set(10, 0, 0);
    moon.scale.set(1.5, 1.5, 1.5);

    return moon;
  };

  // Create Sun
  const createSun = async () => {
    const sunGeometry = new THREE.SphereGeometry(35, 50, 50);

    const texture = await loadTexture("/sun.jpg");
    const bumpMap = await loadTexture("/bumpy.jpg");

    const sunMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      bumpMap: bumpMap,
      bumpScale: 0.9,
      metalness: 0.5,
      roughness: 0.7,
    });

    sun = new THREE.Mesh(sunGeometry, sunMaterial);
    sun.position.set(105, 50, -80);

    return sun;
  };

  const createMiniSun = async () => {
    const sunGeometry = new THREE.SphereGeometry(5, 50, 50);

    const texture = await loadTexture("/sun.jpg");
    const bumpMap = await loadTexture("/bumpy.jpg");

    const sunMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      bumpMap: bumpMap,
      bumpScale: 0.9,
      metalness: 0.5,
      roughness: 0.7,
    });

    miniSun = new THREE.Mesh(sunGeometry, sunMaterial);
    miniSun.position.set(84, 40, -80);

    return miniSun;
  }

  // Create Stars
  stars = getStarfield({ numStars: 1500 });
  scene.add(stars);

  // Create Galaxy
const galaxySettings = {
  count: 8000, 
  size: 0.01, 
  radius: 100, 
  branches: 3,
  spin: 1, 
  randomness: 0.2, 
  randomnessPower: 3,
  insideColor: 0xff6030,
  outsideColor: 0x1b3984 
};

let galaxyGeometry, galaxyMaterial, galaxyPoints, sunLightFigure;

const createSunLight = () => {
  const sunLightGeometry = new THREE.SphereGeometry(65, 50, 50);
  const sunLightMaterial = new THREE.MeshStandardMaterial({
    color: 0x090808,
    side: THREE.BackSide,
    });

    sunLightFigure = new THREE.Mesh(sunLightGeometry, sunLightMaterial);
    sunLightFigure.position.set(90, 50, -50);

    return sunLightFigure;
  };

// Create the galaxy
const createGalaxy = () => {
  // Geometry
  galaxyGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(galaxySettings.count * 3);
  const colors = new Float32Array(galaxySettings.count * 3);

  const insideColor = new THREE.Color(galaxySettings.insideColor);
  const outsideColor = new THREE.Color(galaxySettings.outsideColor);

  for (let i = 0; i < galaxySettings.count; i++) {
    const i3 = i * 3;

    // Position of the star
    const radius = Math.random() * galaxySettings.radius;
    const branchAngle = (i % galaxySettings.branches) / galaxySettings.branches * Math.PI * 2;
    const spinAngle = radius * galaxySettings.spin;

    const randomX = Math.pow(Math.random(), galaxySettings.randomnessPower) * (Math.random() < 0.5 ? 1 : -1);
    const randomY = Math.pow(Math.random(), galaxySettings.randomnessPower) * (Math.random() < 0.5 ? 1 : -1);
    const randomZ = Math.pow(Math.random(), galaxySettings.randomnessPower) * (Math.random() < 0.5 ? 1 : -1);

    positions[i3] = Math.cos(branchAngle + spinAngle) * radius + randomX;
    positions[i3 + 1] = randomY;
    positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius + randomZ;

    // Color interpolation
    const mixedColor = insideColor.clone();
    mixedColor.lerp(outsideColor, radius / galaxySettings.radius);

    colors[i3] = mixedColor.r;
    colors[i3 + 1] = mixedColor.g;
    colors[i3 + 2] = mixedColor.b;
  }

  galaxyGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  galaxyGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // Material
  galaxyMaterial = new THREE.PointsMaterial({
    size: galaxySettings.size,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true
  });

  galaxyPoints = new THREE.Points(galaxyGeometry, galaxyMaterial);
  galaxyPoints.rotateX(Math.PI / 4.75);
  galaxyPoints.position.set(-140, -50, -80)
  galaxyPoints.scale.set(.6, .6, .6);

  return galaxyPoints;
  };

  const animateGalaxy = () => {
    galaxyPoints.rotation.y += 0.001; 
  };

  const mixers = [];
  let astronautModel;

  // Create Astronaut
  const createAstronaut = async () => {
    astronautModel = await loadModel("/astronaut.glb");
    astronautModel.scene.scale.set(5.5, 5.5, 5.5);
    astronautModel.scene.position.set(-35, 10, -100);
    astronautModel.scene.rotation.y = -Math.PI / 5;
  
    const mixer = new THREE.AnimationMixer(astronautModel.scene);
    const animations = astronautModel.animations;
    
    if (animations && animations.length > 0) {
      const action = mixer.clipAction(animations[0]); 
      action.play();
    }
  
    return { scene: astronautModel.scene, mixer: mixer };
  };

  // Create Lines
  function createLines() {
    for (let line_index = 0; line_index < LINE_COUNT; line_index++) {
      let x = Math.random() * 400 - 200;
      let y = Math.random() * 200 - 100;
      let z = Math.random() * 500 - 100;
      let xx = x;
      let yy = y;
      let zz = z;

      pa[6 * line_index] = x;
      pa[6 * line_index + 1] = y;
      pa[6 * line_index + 2] = z;

      pa[6 * line_index + 3] = xx;
      pa[6 * line_index + 4] = yy;
      pa[6 * line_index + 5] = zz;

      va[2 * line_index] = va[2 * line_index + 1] = 0;
    }

    let mat = new THREE.LineBasicMaterial({ color: 0xffffff });
    lines = new THREE.LineSegments(geom, mat);

    return lines;
  }

  // Create Ground
  const createGround = () => {
    const groundLength = 500;
    const groundWidth = 500;
    const groundThickness = 0.5;

    const groundGeometry = new THREE.BoxGeometry(
      groundLength,
      groundThickness,
      groundWidth
    );
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x101f01,
      metalness: 0.3,
      roughness: 0.4,
      side: THREE.DoubleSide,
    });

    ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.position.y = -300;
    ground.receiveShadow = true;

    return ground;
  };

  let currentAngle = 0;
  let hardStop = false;

  const moonOrbitEarth = () => {
    if (!moonStopped && !hardStop) {
      currentAngle += ORBITAL_SPEED * 0.005;
      
      if (moon && earth) {
        moon.position.x = earth.position.x + Math.cos(currentAngle) * ORBITAL_RADIUS;
        moon.position.z = earth.position.z + Math.sin(currentAngle) * ORBITAL_RADIUS;
      }
    }
  };

  // Load models
  const loadModels = async () => {

  };

  // Resize handler
  const onWindowResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  };

  const models = await loadModels();

  // Load tree
  const loader = new GLTFLoader();
  loader.load("tree.01.glb", (gltf) => {
    tree = gltf.scene;
    tree.scale.set(17, 12, 17);
    tree.rotation.y = -0.5 * Math.PI;
    tree.position.y = -300;
  });

  // Create clouds
  function createCloudDome() {
    const cloudCount = 120;
    const radius = 200;
    for (let i = 0; i < cloudCount; i++) {
      const cloudClone = cloudModel.clone();
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * radius;
      const height = Math.random() * 240 - 10;
      const scale = Math.random() * 2 + 0.5;

      cloudClone.position.set(
        Math.cos(angle) * distance,
        height,
        Math.sin(angle) * distance
      );

      cloudClone.scale.set(scale, scale, scale);
      cloudClone.lookAt(0, 0, 0);
      cloudGroup.add(cloudClone);
    }
  }

  loader.load("cloud_1.glb", (gltf) => {
    cloudModel = gltf.scene;
    cloudModel.scale.set(0.65, 0.65, 0.65);
    cloudModel.traverse((node) => {
      if (node.isMesh) {
        node.material.transparent = true;
        node.material.opacity = 0.8;
      }
    });
    createCloudDome();
   });

  // Load textures for overlay
  const overlayTextures = [
    textureLoader.load("/knickknack.jpg"),
    textureLoader.load("/Perplexed.JPG"),
    textureLoader.load("/P1.JPG"),
    textureLoader.load("/Nutrify.JPG"),
    textureLoader.load("/sdc.JPG"),
    textureLoader.load("/port1.JPG"),
    textureLoader.load("/port2.JPG"),
    textureLoader.load("/googleclone.JPG"),
    textureLoader.load("/hulu.JPG"),
    textureLoader.load("/twitter.JPG"),
    textureLoader.load("/skybackground.jpg"),
    textureLoader.load("/skybackground.jpg"),
  ];

// Create box geometry
const boxGeometry = new THREE.BoxGeometry(45, 40, 2);

// 1verlay planes
let planes = [];
const positions = [
  [-100, -80, -20, Math.PI / 2.2], // AR Knick Knack
  [-95, -90, 30, Math.PI / -2.5], // Perplexed
  [-65, -100, 75, Math.PI / -4], // Player One
  [-25, -110, 105, Math.PI / -7.5], // Nutrify

  [70, -175, -70, Math.PI / -4], // ML Car
  [105, -155, 10, Math.PI / 2], // 3D Portfolio
  [90, -145, 60, Math.PI / 3], // Portfolio
  [55, -130, 95, Math.PI / 7], // Google Clone

  [25, -190, -100, Math.PI / -8.5], // Hulu Clone
  [-30, -200, -105, 0.25], // Twitter Clone
  // [-15, -210, -110, Math.PI / -0.25],
  // [-55, -220, -100, Math.PI / 5.5],
];

// Manually set text positions and rotations
const textPositions = [
  [-95, -75, -35, -Math.PI / 2], // AR Knick Knack
  [-95, -85, 15, Math.PI / -2.5], // Perplexed
  [-67, -98, 70, Math.PI / -4], // Player One
  [-30, -110, 105, Math.PI / -7.5], // Nutrify

  [108, -175, -65, Math.PI / 1.35], // ML Car
  [130, -155, 20, Math.PI / 2], // 3D Portfolio
  [105, -142, 75, Math.PI / 3], // Portfolio
  [60, -130, 110, Math.PI / 7], // Google Clone

  [68, -188, -100, Math.PI / 1.15], // Hulu Clone
  [-10, -200, -115, Math.PI / 0.95], // Twitter Clone
];

// Project names
const projectNames = [
  "AR Knick Knack",
  "Perplexed",
  "Player One",
  "Nutrify",
  "ML Car",
  "3D Portfolio",
  "Portfolio",
  "Google Clone",
  "Hulu Clone",
  "Twitter Clone",
];

const projectNameColors = [
  0xffffff, // AR Knick Knack
  0xffffff, // Perplexed
  0xffffff, // Player One
  0x000000, // Nutrify
  0xffffff, // Machine Learning Car
  0xffffff, // Three.js Portfolio
  0xffffff, // Portfolio
  0x000000, // Google Clone
  0xffffff, // Hulu Clone
  0x000000, // Twitter Clone
];

// Project URLs
const projectUrls = [
  "https://github.com/internza/AR-KnickKnack/tree/master", // AR Knick Knack
  "https://day-ztrivia.vercel.app/", // Perplexed
  "https://day-zgamer.vercel.app/", // Player One
  "https://day-ztracker-react.vercel.app/", // Nutrify
  "https://self-driving-car-zkah.vercel.app/", // ML Car
  "https://first-three-js.vercel.app/", // 3D Portfolio
  "https://zyadalkurdi.com/", // Portfolio
  "https://day-z-search.vercel.app/", // Google Clone
  "https://hulu-cloned-mu.vercel.app/", // Hulu Clone
  "https://twitter-clone-steel-one.vercel.app/", // Twitter Clone
];

let textMeshes = [];

function addProjectsAndLabels() {
  positions.forEach((pos, index) => {
    const overlayMaterial = new THREE.MeshBasicMaterial({
      map: overlayTextures[index],
      transparent: true,
      opacity: 0.9,
    });

    const plane = new THREE.Mesh(boxGeometry, overlayMaterial);
    plane.position.set(pos[0], pos[1], pos[2]);
    plane.rotation.y = pos[3];

    // Attach the project URL to the plane's userData
    plane.userData.projectUrl = projectUrls[index];

    scene.add(plane);
    planes.push(plane);
  });

    fontLoader.load("/optimer_bold.typeface.json", function (font) {
      projectNames.forEach((name, index) => {
        const textGeometry = new TextGeometry(name, {
          font: font,
          size: 5,
          height: 0.25,
          curveSegments: 12,
          bevelEnabled: false,
        });
  
        const textMaterial = new THREE.MeshBasicMaterial({
          color: projectNameColors[index],
          transparent: true,
          opacity: 0.75,
        });
        const textMesh = new THREE.Mesh(textGeometry, textMaterial);
  
        textGeometry.computeBoundingBox();
        const boundingBox = textGeometry.boundingBox;
        const textWidth = boundingBox.max.x - boundingBox.min.x;
        const textHeight = boundingBox.max.y - boundingBox.min.y;
  
        const textPos = textPositions[index];
        textMesh.position.set(
          textPos[0] - textWidth / 2,
          textPos[1] - textHeight / 2,
          textPos[2]
        );
        textMesh.rotation.y = textPos[3];
  
        textMesh.visible = false;
        textMeshes.push(textMesh); 
  
        scene.add(textMesh);
      });
    });
  }

  function removeProjectsAndLabels() {
    planes.forEach((plane) => {
      scene.remove(plane);
    });
    planes = [];

    textMeshes.forEach((textMesh) => {
      scene.remove(textMesh);
    });
    textMeshes = [];
  }

  const particlesGeometry = new THREE.BufferGeometry();
  const particlesCount = 5000;

  const posArray = new Float32Array(particlesCount * 3);
  for (let i = 0; i < particlesCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 1000;
  }

  particlesGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(posArray, 3)
  );

  const particlesMaterial = new THREE.PointsMaterial({
    size: 0.5,
    color: 0xffffff,
  });

  const particles = new THREE.Points(particlesGeometry, particlesMaterial);

  let scrollPosition = 0;

  window.addEventListener("scroll", () => {
    scrollPosition = window.scrollY;
  });

  const reverseCameraAnimation = () => {
    const blackOverlay = document.querySelector(".black-overlay");

    blackOverlay.style.opacity = 1;

    setTimeout(() => {
      camera.position.set(0, 0, 20);
      camera.lookAt(new THREE.Vector3(0, 0, 0));

      scene.add(sun, earthGroup, moon, stars, galaxy, sunLight, ambientLight, sunLightFigure, astronautModel.scene);
      scene.remove(
        ground,
        earthLight,
        directionalLight,
        tree,
        particles,
        resume,
        sunAmbient, 
        directionalLight
      );
      scene.background = new THREE.Color(SPACE);

      removeProjectsAndLabels();
      hardStop = false;
      onEarth = false;
      onSun = false;
      onAstronaut = false;
      onGalaxy = false;
      onMoon = false;

      document.querySelector(".ScrollableContent").style.display = "none";
      document.querySelector(".space").style.display = "block";
      document.querySelector(".rocket__ship").style.display = "none";
      document.querySelector(".darkmode-toggle").style.display = "none";
      document.getElementById("nav").style.display = "none";
      document.querySelector('.intro__scroll').style.opacity = '0';
      document.getElementById('Contact').style.display = "none"
      document.querySelector(".credit").style.display = "none";

      astronautModel.scene.scale.set(5.5, 5.5, 5.5);
      astronautModel.scene.position.set(-35, 10, -100);
      astronautModel.scene.rotation.y = -Math.PI / 5;

      scene.remove(lines);
      tweenComplete = false;

      setTimeout(() => {
        blackOverlay.style.opacity = 0;
      }, 500);
    }, 500);
  };

  function createShootingStar() {
    const shootingStarGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const shootingStarMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const shootingStar = new THREE.Mesh(shootingStarGeometry, shootingStarMaterial);

    // Set random initial position for the star
    shootingStar.position.set(
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 100
    );

    scene.add(shootingStar);

    const trailPoints = new Float32Array(50 * 3);
    const trailGeometry = new THREE.BufferGeometry();
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPoints, 3));

    const trailMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.075,
        transparent: true,
        opacity: 0.7
    });
    const particles = new THREE.Points(trailGeometry, trailMaterial);
    scene.add(particles);

    const starPath = new TWEEN.Tween(shootingStar.position)
        .to({
            x: (Math.random() - 0.5) * 200,
            y: (Math.random() - 0.5) * 200,
            z: (Math.random() - 0.5) * 200
        }, 2000) 
        .onUpdate(() => {
            for (let i = trailPoints.length - 3; i > 0; i -= 3) {
                trailPoints[i] = trailPoints[i - 3];
                trailPoints[i + 1] = trailPoints[i - 2];
                trailPoints[i + 2] = trailPoints[i - 1];
            }
            trailPoints[0] = shootingStar.position.x;
            trailPoints[1] = shootingStar.position.y;
            trailPoints[2] = shootingStar.position.z;

            trailGeometry.attributes.position.needsUpdate = true;
        })
        .onComplete(() => {
            scene.remove(shootingStar);
            scene.remove(particles);
        });

    starPath.start();
  }

  setInterval(() => {

    if (!onEarth && !onGalaxy && !onSun && !onMoon && !onAstronaut)
    {
      createShootingStar();
    }
  }, 1500); 

  const rocketShip = document.querySelector(".rocket__ship img");
  rocketShip.addEventListener("click", reverseCameraAnimation);

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  let astronautTextMesh;
  let isAstronautTextVisible = false;

  fontLoader.load("/optimer_bold.typeface.json", function (font) {
    const astronautTextGeometry = new TextGeometry("<section id='Contact'>", {
      font: font,
      size: 10,
      height: 0.95,
      curveSegments: 12,
      bevelEnabled: false,
    });

    const astronautTextMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
    });

    astronautTextMesh = new THREE.Mesh(astronautTextGeometry, astronautTextMaterial);

    astronautTextGeometry.computeBoundingBox();
    const boundingBox = astronautTextGeometry.boundingBox;
    const textWidth = boundingBox.max.x - boundingBox.min.x;
    const textHeight = boundingBox.max.y - boundingBox.min.y;

    const textPos = [-40, 70, -200, 0];
    astronautTextMesh.position.set(
      textPos[0] - textWidth / 2,
      textPos[1] - textHeight / 2,
      textPos[2]
    );
    astronautTextMesh.rotation.y = textPos[3];

    astronautTextMesh.scale.set(0.01, 0.01, 0.01);
    astronautTextMesh.visible = true;

    scene.add(astronautTextMesh);
  });

  let galaxyTextMesh;
  let isGalaxyTextVisible = false;

  fontLoader.load("/optimer_bold.typeface.json", function (font) {
    const galaxyTextGeometry = new TextGeometry("<section id='Skills'>", {
      font: font,
      size: 5,
      height: 0.5,
      curveSegments: 12,
      bevelEnabled: false,
    });

    const galaxyTextMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
    });

    galaxyTextMesh = new THREE.Mesh(galaxyTextGeometry, galaxyTextMaterial);

    galaxyTextGeometry.computeBoundingBox();
    const boundingBox = galaxyTextGeometry.boundingBox;
    const textWidth = boundingBox.max.x - boundingBox.min.x;
    const textHeight = boundingBox.max.y - boundingBox.min.y;

    // -140, -50, -80
    const textPos = [-90, -35, -80, 0];
    galaxyTextMesh.position.set(
      textPos[0] - textWidth / 2,
      textPos[1] - textHeight / 2,
      textPos[2]
    );

    galaxyTextMesh.scale.set(0.01, 0.01, 0.01);
    galaxyTextMesh.visible = true;

    scene.add(galaxyTextMesh);
  });

  let goTextMesh;
  let isTextVisible = false;

  fontLoader.load("/optimer_bold.typeface.json", function (font) {
    const goTextGeometry = new TextGeometry("<section id='Projects'>", {
      font: font,
      size: 15,
      height: 0.95,
      curveSegments: 12,
      bevelEnabled: false,
    });

    const goTextMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
    });

    goTextMesh = new THREE.Mesh(goTextGeometry, goTextMaterial);

    goTextGeometry.computeBoundingBox();
    const boundingBox = goTextGeometry.boundingBox;
    const textWidth = boundingBox.max.x - boundingBox.min.x;
    const textHeight = boundingBox.max.y - boundingBox.min.y;

    const textPos = [0, -55, -200, 0];
    goTextMesh.position.set(
      textPos[0] - textWidth / 2,
      textPos[1] - textHeight / 2,
      textPos[2]
    );
    goTextMesh.rotation.y = textPos[3];

    goTextMesh.scale.set(0.01, 0.01, 0.01);
    goTextMesh.visible = true;

    scene.add(goTextMesh);
  });

  function scaleUpText() {
    new TWEEN.Tween(goTextMesh.scale)
      .to({ x: 1, y: 1, z: 1 }, 500)
      .easing(TWEEN.Easing.Elastic.Out)
      .start();

    new TWEEN.Tween(goTextMesh.material)
      .to({ opacity: 0.9 }, 500)
      .easing(TWEEN.Easing.Quadratic.InOut)
      .start();
  }

  function scaleDownText() {
    new TWEEN.Tween(goTextMesh.scale)
      .to({ x: 0.01, y: 0.01, z: 0.01 }, 500)
      .easing(TWEEN.Easing.Quadratic.InOut)
      .start();

    new TWEEN.Tween(goTextMesh.material)
      .to({ opacity: 0 }, 500)
      .easing(TWEEN.Easing.Quadratic.InOut)
      .start();
  }

  window.addEventListener("click", onMouseClick, false);

  function onMouseClick(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObject(earth);
    if (intersects.length > 0) {
      animateCameraToEarth();
    }
  }

  const animateCameraToEarth = (isTeleport) => {

    if (!isTeleport) {
      lines = createLines();
      scene.add(lines);

    setTimeout(() => {
      console.log("hi");
    }, 1000);

    new TWEEN.Tween(camera.position)
      .to(TARGET_POSITION, DURATION * ACCELERATION)
      .easing(TWEEN.Easing.Quadratic.InOut)
      .onUpdate(() => camera.lookAt(earth.position))
      .onComplete(() => {

        earthFunctionality();

        tweenComplete = true;
      })
      .start();

      function updateTweens() {
        requestAnimationFrame(updateTweens);
        TWEEN.update();
      }
      updateTweens();
    }
    else {
      const blackOverlay = document.querySelector(".black-overlay");
      blackOverlay.style.opacity = 1;

      setTimeout(() => {

        earthFunctionality();
        scene.remove(resume);
        document.getElementById("nav").style.display = "none";

        setTimeout(() => {
          blackOverlay.style.opacity = 0;
        }, 500);
      }, 500)
    }

  };

  let onEarth = false;

  const earthFunctionality = () => {

    scene.remove(sunAmbient, directionalLight)

    ground = createGround();
    const element = document.querySelector(".space");
    let INTERSECTED = null;
    let CLICKED = null;

    const tweenScale = (object, to, duration) => {
      new TWEEN.Tween(object.scale)
        .to({ x: to, y: to, z: to }, duration)
        .easing(TWEEN.Easing.Elastic.Out)
        .start();
    };

    window.addEventListener("mousemove", (event) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(planes);

      if (intersects.length > 0) {
        if (INTERSECTED != intersects[0].object) {
          if (INTERSECTED && INTERSECTED !== CLICKED) {
            tweenScale(INTERSECTED, 1, 1500);
          }

          INTERSECTED = intersects[0].object;
          if (INTERSECTED !== CLICKED) {
            tweenScale(INTERSECTED, 1.1, 1500);
          }

          const index = planes.indexOf(INTERSECTED);
          if (textMeshes[index]) {
            textMeshes[index].visible = true;
          }
          document.body.style.cursor = "pointer";
        }
      } else {
        if (INTERSECTED && INTERSECTED !== CLICKED) {
          tweenScale(INTERSECTED, 1, 5000);
          const index = planes.indexOf(INTERSECTED);
          if (textMeshes[index]) {
            textMeshes[index].visible = false;
          }
          INTERSECTED = null;
        }
        document.body.style.cursor = "auto";
      }
    });

    addProjectsAndLabels();

    window.addEventListener("click", () => {
      if (INTERSECTED) {
        const projectUrl = INTERSECTED.userData.projectUrl;
        if (projectUrl) {
          window.open(projectUrl, "_blank");
        }
      }
    });

    window.addEventListener("scroll", () => {
      scrollPosition = window.scrollY;
    });

    scene.add(
      ground,
      earthLight,
      directionalLight,
      tree,
      particles,
      miniSun
    );

    scene.remove(
      sun,
      earthGroup,
      moon,
      stars,
      galaxy,
      lines,
      sunLight,
      ambientLight,
      sunLightFigure,
      astronautModel.scene
    );
    camera.position.set(-3, 3, 3);
    const toggleButton = document.querySelector(".darkmode-toggle");
    toggleButton.style.display = "block";
    let isDarkMode = true;
    toggleButton.addEventListener("click", () => {});

    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext("2d");

    const updateGradient = () => {
      const gradient = context.createLinearGradient(0, 0, 0, 512);
      if (isDarkMode) {
        gradient.addColorStop(0, "#000000");
        gradient.addColorStop(1, "#4F6EDB");
      } else {
        gradient.addColorStop(0, "#B1B1B1");
        gradient.addColorStop(1, "#4F6EDB");
      }
      context.fillStyle = gradient;
      context.fillRect(0, 0, 512, 512);

      const texture = new THREE.CanvasTexture(canvas);
      scene.background = texture;
    };

    updateGradient();

    element.style.display = "none";
    document.querySelector(".ScrollableContent").style.display = "block";
    document.querySelector(".rocket__ship").style.display = "block";
    document.querySelector('.intro__scroll').style.opacity = '100%';

    onEarth = true;

    toggleButton.addEventListener("click", () => {
      isDarkMode = !isDarkMode;
      updateGradient();
    });
  }

  let onGalaxy = false;

  const animateCameraToGalaxy = (isTeleport) => {
    if (!isTeleport) {
      const targetRotation = {
        x: camera.rotation.x,
        y: Math.atan2(
          galaxyPoints.position.x - camera.position.x,
          galaxyPoints.position.z - camera.position.z
        ),
        z: camera.rotation.z,
      };
    
      new TWEEN.Tween(camera.rotation)
        .to({ x: Math.PI / -9.5, y: Math.PI / 3.5, z: targetRotation.z }, 1000)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .onUpdate(() => {
        })
        .onComplete(() => {
          new TWEEN.Tween(camera.position)
            .to(
              { x: galaxyPoints.position.x, y: galaxyPoints.position.y, z: galaxyPoints.position.z +4 },
              3500
            )
            .easing(TWEEN.Easing.Quadratic.InOut)
            .onUpdate(() => {
              camera.lookAt(galaxyPoints.position);
            })
            .onComplete(() => {
              galaxyFunctionality();
              tweenComplete = true;
            })
            .start();
        })
        .start();
      }
      else {
        setTimeout(() => {
          const blackOverlay = document.querySelector(".black-overlay");
          blackOverlay.style.opacity = 1;

          galaxyFunctionality();
          scene.remove(resume);

          document.getElementById("nav").style.display = "none";

          setTimeout(() => {
            blackOverlay.style.opacity = 0;
          }, 500);

        }, 500)
      }
  };

  const skills = [
    'react',
    'typescript',
    'html',
    'css',
    'python',
    'java',
    'c++',
  ]

  const createPlanet = (radius, skill, x, z) => {
    const planetGeometry = new THREE.SphereGeometry(radius, 32, 32);
    const planetMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000,
      roughness: 0.8,
      metalness: 0.2,
    });
    
    const planet = new THREE.Mesh(planetGeometry, planetMaterial);
    planet.position.set(x, 0, z);
    planet.userData.skill = skill;

    scene.add(planet);

    return planet;

  }

  const createSkillPlanets = () => {
    const skillPlanets = [];
    const radius = 50;
    const angle = (Math.PI * 2) / skills.length;

    skills.forEach((skill, index) => {
      const x = 1
      const z = 14
      const planet = createPlanet(1, skill, x, z);
      skillPlanets.push(planet);
    });

    return skillPlanets;
  }

  const galaxyFunctionality = () => {

    onGalaxy = true;

    scene.remove(sunAmbient, directionalLight)
    scene.add(earthLight, directionalLight, miniSun);

    scene.remove(
      sun,
      earthGroup,
      moon,
      stars,
      galaxy,
      lines,
      sunLight,
      ambientLight,
      sunLightFigure,
      astronautModel.scene
    );
    camera.position.set(-3, 3, 3);


    const element = document.querySelector(".space");
    element.style.display = "none";
    document.querySelector(".rocket__ship").style.display = "block";

  }

  let onAstronaut = false;

  const animateCameraToAstronaut = (isTeleport) => {

    if(!isTeleport) {
      const targetRotation = {
        x: camera.rotation.x,
        y: Math.atan2(
          astronautModel.scene.position.x - camera.position.x,
          astronautModel.scene.position.z - camera.position.z
        ),
        z: camera.rotation.z,
      };

      new TWEEN.Tween(camera.rotation)
        .to(
          { x: targetRotation.x, y: targetRotation.y, z: targetRotation.z},
          1000
        )
        .easing(TWEEN.Easing.Quadratic.InOut)
        .onUpdate(() => {
          camera.lookAt(astronautModel.scene.position);
        })
        .onComplete(() => {
          new TWEEN.Tween(camera.position)
            .to(
              {
                x: astronautModel.scene.position.x - 25,
                y: astronautModel.scene.position.y + 20,
                z: astronautModel.scene.position.z + 25,
              },
              DURATION * ACCELERATION
            )
            .easing(TWEEN.Easing.Quadratic.InOut)
            .onUpdate(() => {
              camera.lookAt(astronautModel.scene.position);
            })
            .onComplete(() => {
              
              astronautFuncionality();
              tweenComplete = true;
            })
            .start();
        })
        .start();
      }

      else {
        setTimeout(() => {
          const blackOverlay = document.querySelector(".black-overlay");
          blackOverlay.style.opacity = 1;

          astronautFuncionality();
          scene.remove(resume);

          document.getElementById("nav").style.display = "none";

          setTimeout(() => {
            blackOverlay.style.opacity = 0;
          }, 500);

        }, 500)
      }
  };

  const astronautFuncionality = () => {

    onAstronaut = true;

    scene.remove(sunAmbient, directionalLight)
    scene.add(earthLight, directionalLight, miniSun);

    scene.remove(
      sun,
      earthGroup,
      moon,
      stars,
      galaxy,
      lines,
      sunLight,
      ambientLight,
      sunLightFigure,
    );

    astronautModel.scene.scale.set(15,15,15);
    astronautModel.scene.position.set(100, -35, -30);
    astronautModel.scene.rotation.y = Math.PI / 3;

    const element = document.querySelector(".space");
    element.style.display = "none";
    document.querySelector(".rocket__ship").style.display = "block";
    document.getElementById('Contact').style.display = "block"
  }


  let moonPopUpVisible = false;
  let moonTextMesh;
  let moonStopped = false;
  let moonTextGeometry;

  fontLoader.load("/optimer_bold.typeface.json", function (font) {
    moonTextGeometry = new TextGeometry("<section id='Experience'>", {
      font: font,
      size: 5,
      height: 0.5,
      curveSegments: 12,
      bevelEnabled: false,
    });
  
    const moonTextMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0, 
    });

    moonTextMesh = new THREE.Mesh(moonTextGeometry, moonTextMaterial);
    
    moonTextMesh.scale.set(0.01, 0.01, 0.01);
    moonTextMesh.visible = true;
  
    scene.add(moonTextMesh);

  });

  let onMoon = false;

// Animate camera to moon
const animateCameraToMoon = (isTeleport) => {

  if (!isTeleport) {
    const targetRotation = {
      x: camera.rotation.x,
      y: Math.atan2(
        moon.position.x - camera.position.x,
        moon.position.z - camera.position.z
      ),
      z: camera.rotation.z,
    };

    new TWEEN.Tween(camera.rotation)
      .to({ x: targetRotation.x, y: targetRotation.y, z: targetRotation.z }, 500) 
      .easing(TWEEN.Easing.Quadratic.InOut)
      .onUpdate(() => {
        camera.lookAt(moon.position);
      })
      .onComplete(() => {
        setTimeout(() => {
        lines = createLines();
        scene.add(lines);

        lines.rotation.y = Math.atan2(
          moon.position.x - camera.position.x,
          moon.position.z - camera.position.z
        );

        }, 500)
        
        new TWEEN.Tween(camera.position)
          .to(
            { x: moon.position.x, y: moon.position.y, z: moon.position.z + 0.85 },
            DURATION * ACCELERATION + (moon.position.z * 0.01)
          )
          .easing(TWEEN.Easing.Quadratic.InOut)
          .onUpdate(() => {
            camera.lookAt(moon.position);
          })
          .onComplete(() => {
            moonFunctionality();
            tweenComplete = true;
          })
          .start();
      })
      .start();

    function updateTweens() {
      requestAnimationFrame(updateTweens);
      TWEEN.update();
    }
    updateTweens();
  }

  else {
    setTimeout(() => {
      const blackOverlay = document.querySelector(".black-overlay");
      blackOverlay.style.opacity = 1;

      moonFunctionality();
      scene.remove(resume);

      document.getElementById("nav").style.display = "none";

      setTimeout(() => {
        blackOverlay.style.opacity = 0;
      }, 500);
    }, 500)
  }
};

  const moonFunctionality = () => {

    onMoon = true;

    scene.remove(sunAmbient, directionalLight)
    scene.add(earthLight, directionalLight, miniSun);

    scene.remove(
      sun,
      earthGroup,
      moon,
      stars,
      galaxy,
      lines,
      sunLight,
      ambientLight,
      sunLightFigure,
      astronautModel.scene
    );
    camera.position.set(-3, 3, 3);

    const element = document.querySelector(".space");
    element.style.display = "none";
    document.querySelector(".rocket__ship").style.display = "block";
  }

  let sunPopUpVisible = false;
  let sunTextMesh;

  fontLoader.load("/optimer_bold.typeface.json", function (font) {
    const sunTextGeometry = new TextGeometry("<section id='Nav'>", {
      font: font,
      size: 4,
      height: 0.4,
      curveSegments: 12,
      bevelEnabled: false,
    });

    const sunTextMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      color: 0xffffff,
    });

    sunTextMesh = new THREE.Mesh(sunTextGeometry, sunTextMaterial);


    sunTextMesh.scale.set(0.01, 0.01, 0.01);
    sunTextMesh.visible = true;

    scene.add(sunTextMesh);
  });

  loader.load("resume.glb", (gltf) => {
    resume = gltf.scene;
    resume.scale.set(4.5, 4.5, 4.5);
    resume.position.set(0, 0, -100);
    resume.rotation.z = -Math.PI / 2.1;
    resume.rotation.y = Math.PI / -5;
  });

  let resumePopUpVisible = false;
  let resumeTextMesh;

  fontLoader.load("/optimer_bold.typeface.json", function (font) {
    const resumeTextGeometry = new TextGeometry("/resume.pdf", {
      font: font,
      size: 5,
      height: 0.5,
      curveSegments: 12,
      bevelEnabled: false,
    });

    const resumeTextMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
    });

    resumeTextMesh = new THREE.Mesh(resumeTextGeometry, resumeTextMaterial);

    resumeTextMesh.scale.set(0.01, 0.01, 0.01);
    resumeTextMesh.visible = true;

    resumeTextMesh.rotation.y = Math.PI / 2;

    scene.add(resumeTextMesh);
  });

  const sunAmbient = new THREE.AmbientLight(0xffffff, .65);

  window.navigate = (location) => {
    if (location === "Contact") {
      animateCameraToAstronaut(true);
    }
    if (location === "Experience") {
      animateCameraToMoon(true);
    }
    if (location === "Projects") {
      animateCameraToEarth(true);
    }
    if (location === "Skills") {
      animateCameraToGalaxy(true);
    }
  };

  let onSun = false;

 // Animate camera to sun
const animateCameraToSun = (isTeleport) => {

  if (!isTeleport) {
    const targetRotation = {
      x: camera.rotation.x,
      y: Math.atan2(
        sun.position.x - camera.position.x,
        sun.position.z - camera.position.z
      ),
      z: camera.rotation.z,
    };

    new TWEEN.Tween(camera.rotation)
      .to({ x: Math.PI / 6.5, y:-Math.PI / 5.5, z: targetRotation.z }, 1000)
      .easing(TWEEN.Easing.Quadratic.InOut)
      .onUpdate(() => {
      })
      .onComplete(() => {
        setTimeout(() => {
          
          lines = createLines();
          scene.add(lines);
          
          lines.rotation.y = Math.atan2(
            sun.position.x - camera.position.x,
            sun.position.z - camera.position.z
          );
        }, 750)

        new TWEEN.Tween(camera.position)
          .to(
            { x: 80, y: sun.position.y * 0.95, z: -50 },
            3100 * ACCELERATION
          )
          .easing(TWEEN.Easing.Quadratic.InOut)
          .onUpdate(() => {
            camera.lookAt(sun.position);
          })
          .onComplete(() => {
            
            sunFunctionality();
            tweenComplete = true;
          })
          .start();
      })
      .start();

    function updateTweens() {
      requestAnimationFrame(updateTweens);
      TWEEN.update();
    }
    updateTweens();
  }
  else {
    setTimeout(() => {
      const blackOverlay = document.querySelector(".black-overlay");
      blackOverlay.style.opacity = 1;

      sunFunctionality();
      document.querySelector(".darkmode-toggle").style.display = "none";
      document.querySelector('.intro__scroll').style.opacity = '0';
      scene.remove(tree, planes, ground, earthLight, directionalLight, miniSun, particles)
      scene.background = new THREE.Color(SPACE);
      removeProjectsAndLabels();

      setTimeout(() => {
        blackOverlay.style.opacity = 0;
      }, 500);
    }, 500)
  }
};

  const sunFunctionality = () => {
    const element = document.querySelector(".space");

    onSun = true;

    scene.add(directionalLight, sunAmbient, resume);

    scene.remove(
      earthGroup,
      moon,
      stars,
      galaxy,
      lines,
      sunLight,
      ambientLight,
      sun,
      sunLightFigure,
      astronautModel.scene
    );
    camera.position.set(-3, 3, 3);

    element.style.display = "none";
    document.querySelector(".rocket__ship").style.display = "block";
    document.getElementById("nav").style.display = "block";
    document.getElementById('Contact').style.display = "none"
  };

  window.addEventListener("click", onMouseClick, false);

  let miniSunTextMesh;
  let miniSunPopUpVisible = false;

  fontLoader.load("/optimer_bold.typeface.json", function (font) {
    const miniSunTextGeometry = new TextGeometry("<section id='Menu'>", {
      font: font,
      size: 5,
      height: 0.5,
      curveSegments: 12,
      bevelEnabled: false,
    });

    const miniSunTextMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
    });

    miniSunTextMesh = new THREE.Mesh(miniSunTextGeometry, miniSunTextMaterial);

    miniSunTextMesh.scale.set(0.01, 0.01, 0.01);
    miniSunTextMesh.visible = true;

    scene.add(miniSunTextMesh);
  });

  window.addEventListener("mousemove", (event) => { 
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersectsEarth = raycaster?.intersectObject(earth);
    const intersectsMoon = raycaster?.intersectObject(moon);
    const intersectsSun = raycaster?.intersectObject(sun);
    const intersectsAstronaut = raycaster?.intersectObject(astronautModel.scene);
    const intersectsGalaxy = raycaster?.intersectObject(galaxy);
    const intersectsMiniSun = raycaster?.intersectObject(miniSun);
    const intersectsResume = raycaster?.intersectObject(resume);

    if (intersectsEarth.length > 0) {
      document.body.style.cursor = "pointer";
      if (!isTextVisible) {
        scaleUpText();
        isTextVisible = true;
      }
    } else if (intersectsMoon.length > 0) {
      document.body.style.cursor = "pointer";

      if (!moonPopUpVisible) {
        moonPopUpVisible = true;
        moonStopped = true;

        if (moonStopped) {

          let zPosition = moon.position.z;
          if (moon.position.z > 2) {
            zPosition -= 5;
          }

          const textPos = [moon.position.x - 10, -3, zPosition, 0];
          moonTextMesh.position.set(
            textPos[0],
            textPos[1],
            textPos[2]
          );
        }
  
        new TWEEN.Tween(moonTextMesh.scale)
        .to({ x: .25, y: .25, z: .25 }, 500)
        .easing(TWEEN.Easing.Elastic.Out)
        .start();

        new TWEEN.Tween(moonTextMesh.material)
          .to({ opacity: 1 }, 500)
          .easing(TWEEN.Easing.Quadratic.InOut)
          .start();
  
      }
    } else if (intersectsSun.length > 0 && !onEarth && !onSun && !onAstronaut && !onGalaxy && !onMoon) {
      document.body.style.cursor = "pointer";

      if (!sunPopUpVisible) {
        sunPopUpVisible = true;

        const textPos = [30, 0, -40, 0];
        sunTextMesh.position.set(
          textPos[0],
          textPos[1],
          textPos[2]
        );

        new TWEEN.Tween(sunTextMesh.scale)
        .to({ x: 1, y: 1, z: 1 }, 500)
        .easing(TWEEN.Easing.Elastic.Out)
        .start();

      new TWEEN.Tween(sunTextMesh.material)
        .to({ opacity: 1 }, 500)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .start();
  
      }
    } else if (intersectsMiniSun.length > 0 && !onSun && (onEarth || onGalaxy || onAstronaut || onMoon)) {
      document.body.style.cursor = "pointer";

      if (!miniSunPopUpVisible) {
        miniSunPopUpVisible = true;

        let textPos = [];

        if (onEarth){
          textPos = [35, 35, -80, 0];
          miniSunTextMesh.rotation.y = Math.PI / 5;
        }

        else {
          textPos = [56, 42, -80, 0];
          miniSunTextMesh.rotation.y = Math.PI / 2;
        }

        miniSunTextMesh.position.set(
          textPos[0],
          textPos[1],
          textPos[2]
        );


        new TWEEN.Tween(miniSunTextMesh.scale)
        .to({ x: 0.8, y: 0.8, z: 0.8 }, 500)
        .easing(TWEEN.Easing.Elastic.Out)
        .start();

      new TWEEN.Tween(miniSunTextMesh.material)
        .to({ opacity: 1 }, 500)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .start();
  
      }
    } else if (intersectsAstronaut.length > 0 && !onAstronaut) {

      document.body.style.cursor = "pointer";

      if (!isAstronautTextVisible) {
        isAstronautTextVisible = true;

        new TWEEN.Tween(astronautTextMesh.scale)
        .to({ x: 1, y: 1, z: 1 }, 500)
        .easing(TWEEN.Easing.Elastic.Out)
        .start();

        new TWEEN.Tween(astronautTextMesh.material)
          .to({ opacity: 1 }, 500)
          .easing(TWEEN.Easing.Quadratic.InOut)
          .start();
        }

    } else if (intersectsResume.length > 0 && onSun) {
      document.body.style.cursor = "pointer";

      if (!resumePopUpVisible) {
        resumePopUpVisible = true;

        new TWEEN.Tween(resumeTextMesh.scale)
        .to({ x: 1, y: 1, z: 1 }, 500)
        .easing(TWEEN.Easing.Elastic.Out)
        .start();

        new TWEEN.Tween(resumeTextMesh.material)
          .to({ opacity: 1 }, 500)
          .easing(TWEEN.Easing.Quadratic.InOut)
          .start();

      }
    } else if (intersectsGalaxy.length > 0 && !onGalaxy && !onAstronaut) {

      document.body.style.cursor = "pointer";

      if (!isGalaxyTextVisible) {
        isGalaxyTextVisible = true;

        new TWEEN.Tween(galaxyTextMesh.scale)
        .to({ x: 1, y: 1, z: 1 }, 500)
        .easing(TWEEN.Easing.Elastic.Out)
        .start();

        new TWEEN.Tween(galaxyTextMesh.material)
          .to({ opacity: 1 }, 500)
          .easing(TWEEN.Easing.Quadratic.InOut)
          .start();
        }

    } else {
      document.body.style.cursor = "auto";

      if (isTextVisible) {
        scaleDownText();
        isTextVisible = false;
      }

      if (moonPopUpVisible) {
        moonPopUpVisible = false;
  
        new TWEEN.Tween(moonTextMesh.scale)
        .to({ x: 0.01, y: 0.01, z: 0.01 }, 500)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .start();

      new TWEEN.Tween(moonTextMesh.material)
        .to({ opacity: 0 }, 500)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .start();
  
        moonStopped = false; 
      }

      if (sunPopUpVisible) {
        sunPopUpVisible = false;
  
        new TWEEN.Tween(sunTextMesh.scale)
        .to({ x: 0.01, y: 0.01, z: 0.01 }, 500)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .start();

      new TWEEN.Tween(sunTextMesh.material)
        .to({ opacity: 0 }, 500)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .start();
      }

      if (isAstronautTextVisible) {
        isAstronautTextVisible = false;

        new TWEEN.Tween(astronautTextMesh.scale)
        .to({ x: 0.01, y: 0.01, z: 0.01 }, 500)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .start();
      }

      if (isGalaxyTextVisible) {
        isGalaxyTextVisible = false;

        new TWEEN.Tween(galaxyTextMesh.scale)
        .to({ x: 0.01, y: 0.01, z: 0.01 }, 500)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .start();
      }

      if (resumePopUpVisible) {
        resumePopUpVisible = false;

        new TWEEN.Tween(resumeTextMesh.scale)
        .to({ x: 0.01, y: 0.01, z: 0.01 }, 500)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .start();

      new TWEEN.Tween(resumeTextMesh.material)
        .to({ opacity: 0 }, 500)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .start();

      }

      if (miniSunPopUpVisible) {
        miniSunPopUpVisible = false;

        new TWEEN.Tween(miniSunTextMesh.scale)
        .to({ x: 0.01, y: 0.01, z: 0.01 }, 500)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .start();
      }
    }
  });

  function onMouseClick(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // Check for intersections with both the Earth, Moon, and Sun
    const intersectsEarth = raycaster.intersectObject(earth);
    const intersectsMoon = raycaster.intersectObject(moon);
    const intersectsSun = raycaster.intersectObject(sun);
    const intersectsAstronaut = raycaster.intersectObject(astronautModel.scene);
    const intersectsGalaxy = raycaster.intersectObject(galaxy);
    const intersectsMiniSun = raycaster.intersectObject(miniSun);
    const intersectsResume = raycaster?.intersectObject(resume);

    // If the Earth is clicked, animate camera to the Earth
    if (intersectsEarth.length > 0) {
      animateCameraToEarth();
    }

    // If the Moon is clicked, animate camera to the Moon and stop the moon from moving
    if (intersectsMoon.length > 0) {
      hardStop = true;
      animateCameraToMoon();
    }

    // If the Sun is clicked, animate camera to the Sun
    if (intersectsSun.length > 0 && !onEarth && !onSun && !onAstronaut && !onGalaxy && !onMoon) {
      animateCameraToSun();
    }

    // If the Astronaut is clicked, animate camera to the Astronaut
    if (intersectsAstronaut.length > 0 && !onAstronaut) {
      animateCameraToAstronaut();
    }

    // If the Galaxy is clicked, animate camera to the Galaxy
    if (intersectsGalaxy.length > 0 && !onGalaxy && !onAstronaut) {
      animateCameraToGalaxy();
    }

    // If the Mini Sun is clicked, animate camera to the  Sun
    if (intersectsMiniSun.length > 0 && !onSun && (onEarth || onGalaxy || onAstronaut || onMoon)) {
      animateCameraToSun(true);
    }

    // If the Resume is clicked, open resume.pdf in a new tab
    if (intersectsResume.length > 0 && onSun) {
      window.open("/resume.pdf", "_blank");
    }
  }

  // Animate the scene
  const animate = () => {
    requestAnimationFrame(animate);
    controls.update();
    const delta = clock.getDelta();

    if (moon) {
      moonOrbitEarth();
    }
    TWEEN.update();
    mixers.forEach(mixer => mixer.update(delta));

    const elapsedTime = clock.getElapsedTime();
    const deltaTime = elapsedTime - oldElapsedTime;
    oldElapsedTime = elapsedTime;

    if (tweenComplete) {
      camera.position.y = -scrollPosition * 0.05;

      if (scrollPosition >= 6000 && scrollPosition <= 6200) {
      } else if (scrollPosition >= 6200) {
        camera.position.y = -500;
        camera.lookAt(0, -20000, 0);
      } else {
        // the cameras x and z should go around the tree counter clockwise maintaining the same radius around the tree
        camera.position.x = 150 * Math.cos(-scrollPosition * 0.002);
        camera.position.z = 150 * Math.sin(-scrollPosition * 0.002);
        camera.lookAt(0, -0.05 * scrollPosition, 0);
      }

      cloudGroup.children.forEach((cloud) => {
        cloud.position.x += delta * 2; // Move clouds horizontally
        if (cloud.position.x > 100) {
          // Reset position when out of view
          cloud.position.x = -100;
        }
      });
    }

    if (earth) {
      earth.rotation.y += 0.2 * delta;
      lightsMesh.rotation.y += 0.2 * delta;
      cloudsMesh.rotation.y += 0.23 * delta;
      glowMesh.rotation.y += 0.2 * delta;
    }

    if (moon) {
      moon.rotation.y += 0.8 * delta;
    }

    if (sun) {
      sun.rotation.z += 0.05 * delta;
    }

    if (miniSun) {
      miniSun.rotation.x += 0.09 * delta;
    }

    if (resume) {
      resume.rotation.y += 0.85 * delta;
    }

    if (galaxy) {
      animateGalaxy();
    }

    if (stars) {
      stars.rotation.y -= 0.0002;
    }

    if (cloudModels.length > 0) {
      for (let i = 0; i < cloudModels.length; i++) {
        if (cloudModels[i].position.x > 100) {
          cloudModels[i].position.x = -130;
        } else {
          cloudModels[i].position.x += 2 * delta;
        }
      }
    }

    if (lines) {
      for (let line_index = 0; line_index < LINE_COUNT; line_index++) {
        va[2 * line_index] += 0.02;
        va[2 * line_index + 1] += 0.025;

        pa[6 * line_index + 2] += va[2 * line_index];
        pa[6 * line_index + 5] += va[2 * line_index + 1];

        if (pa[6 * line_index + 5] > 200) {
          var z = Math.random() * 200 - 100;
          pa[6 * line_index + 2] = z;
          pa[6 * line_index + 5] = z;
          va[2 * line_index] = 0;
          va[2 * line_index + 1] = 0;
        }
      }
    }

    pos.needsUpdate = true;
    renderer.render(scene, camera);
  };

  const loadingScreen = document.querySelector(".loading__screen__container");
  const loadingText = document.querySelector(
    ".loading__screen__container__text"
  );

  const updateLoadingScreen = (progress) => {
    const size = 21.5 * progress;
    loadingScreen.style.height = `${size}px`;
    loadingScreen.style.width = `${size}px`;

    if (progress >= 30) {
      loadingText.style.color = "white";
    }
  };

  let progress = 0;
  const interval = setInterval(() => {
    if (progress < 100) {
      progress += 2.25;
      updateLoadingScreen(progress);
    } else {
      clearInterval(interval);
    }
  }, 50);

  

  // Initialize the scene
  const init = async () => {
    document.querySelector(".loading__screen").style.display = "flex";
    const earthGroup = await createEarth();
    const moon = await createMoon();
    const sun = await createSun();
    galaxy = createGalaxy();
    const sunLightFigure = createSunLight();
    miniSun = createMiniSun();

    const { scene: astronautScene, mixer: astronautMixer } = await createAstronaut();
    scene.add(astronautScene);
    mixers.push(astronautMixer);

    scene.add(earthGroup);
    scene.add(moon);
    scene.add(sun);
    scene.add(stars);
    scene.add(galaxy);
    scene.add(sunLightFigure);

    document.querySelector(".loading__screen").style.display = "none";
    document.querySelector(".space").style.display = "block";
  

    updateLoadingScreen();

    animate();
    window.addEventListener("resize", onWindowResize);
  };

  await init();
}

main().catch(console.error);

/*
  TODO: 
        // Easy About Me Section
        // Fix raycaster issue when going on/off earth

        Earth = Projects
        Sun = Navigation
        Moon = Experience
        Galaxy = Skills
        Space Man = Contact / About
        Home = Home

        Make a moon scene in blender and export + bake it to a glb file and add it to the scene
            Add Experiences to the moon with physics and let the player drive a rover on the moon

  ENHANCEMENTS:
        Enhance the projects section, make them have better hover effects and maybe use post processing
        Enhance loading screen
        Animation effect upon each arrival of a planet

*/
