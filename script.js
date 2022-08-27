import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as dat from 'dat.gui';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { Raycaster, Vector2 } from 'three';

let pupil, eyering, eyecover;
let targetX = 0;
let targetY = 0;
let xpos, ypos;
let time, mixer1, mixer2, closeLidAction, coverEyeAction;
var mouse, raycaster;
let mousePresent = true;
let xstep = 0;
let ystep = 0;


// Debug

const gui = new dat.GUI()


// Canvas

const canvas = document.querySelector('canvas.webgl');


// Scene

const scene = new THREE.Scene();


// Objects

const geometry = new THREE.CircleBufferGeometry( .63, 32, 0, 6.28 );


// Materials

const material = new THREE.MeshStandardMaterial();
material.color = new THREE.Color(0xff0000);


// Mesh

// Create the circle that detects when clicking on the eye
const eyeCollision = new THREE.Mesh(geometry,material);
eyeCollision.position.x = 0;
eyeCollision.position.y = 3;
eyeCollision.position.z = 1;
eyeCollision.visible = false;
scene.add(eyeCollision);

// Helper to toggle the visibility of the circle for debug purposes
const help = gui.addFolder('Eye Collision')
help.add(eyeCollision, 'visible')


// Lights

// Create three spotlights for the front, top, and bottom of the model
// Front
const spotLight = new THREE.SpotLight(0xffffff);
spotLight.position.set(0, 2, 20);
spotLight.castShadow = false;
spotLight.intensity = 1.5;
scene.add(spotLight);

// Top
const spotLight2 = new THREE.SpotLight(0xffffff);
spotLight2.position.set(0, 20, 0);
spotLight2.rotateX(90);
spotLight2.castShadow = false;
spotLight2.intensity = 1.5;
scene.add(spotLight2);

// Bottom
const spotLight3 = new THREE.SpotLight(0xffffff);
spotLight3.position.set(0, -20, 0);
spotLight3.rotateX(-90);
spotLight3.castShadow = false;
spotLight3.intensity = 1.5;
scene.add(spotLight3);

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

// Listener for window resizing
window.addEventListener('resize', () =>
{
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    // Update camera
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})


// Loading

// Loader for the logo.glb file
const assetLoader = new GLTFLoader();

// DracoLoader for it as well
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath( '/examples/js/libs/draco/' );
assetLoader.setDRACOLoader(dracoLoader);

// Load the 3D object file
assetLoader.load(
	
	"/objectLoad/logo.glb",
	
	function ( glb ) {
		const model = glb.scene;  

		// Find the important components and assign them to variables
		model.traverse(function(element){
			if (element.name == "Pupil"){
				element.renderOrder = 2;
				pupil = element;
				targetX = element.position.x;
				targetY = element.position.y;
			}

			if (element.name == "EyeRing") {
				element.renderOrder = 2;
				eyering = element;
			}

			// Removing colorWrite and changing the render order for the eyecover
			// makes it invisible, while being able to hid objects behind it
			if (element.name == "EyeCover") {
				element.material.colorWrite = false;
				element.renderOrder = 1;
				eyecover = element;
			}
		}

		);
		
		scene.add(model);
	
		// Initialize mixers for the blinking animation
		mixer1 = new THREE.AnimationMixer(model);
		mixer2 = new THREE.AnimationMixer(model);
		const clips = glb.animations;
		// EyelidAction and EyeCoverAction were given their names in the blender project file
		const closeLid = THREE.AnimationClip.findByName(clips, 'EyelidAction');
		const coverEye = THREE.AnimationClip.findByName(clips, 'EyeCoverAction');
		closeLidAction = mixer1.clipAction(closeLid);
		coverEyeAction = mixer2.clipAction(coverEye);
		closeLidAction.setLoop(THREE.LoopOnce, 0);
		coverEyeAction.setLoop(THREE.LoopOnce, 0);
	},

	function (xhr) {
		console.log( (xhr.loaded / xhr.total * 100) + '% loaded');
	},

	function (error) {
		console.log('an error happened');
	}
	
	);


/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100);
camera.position.x = 0;
camera.position.y = 3;
camera.position.z = 8;
scene.add(camera);


// Raycasting

// Declare the raycaster and vector to point from the mouse onto the scene
mouse = new THREE.Vector2();
raycaster = new THREE.Raycaster();


/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas
});
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));


/**
 * Animate
 */

// Declare event listeners for following the mouse and reacting to clicking
document.addEventListener('mousemove', onMouseMove);
document.addEventListener('mousedown', onClick);
document.addEventListener('mouseout', onIdle);

// Variables to store mouse position relative to the screen center
let mouseX = 0;
let mouseY = 0;

// Variables to store the half-screen size
let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;

// Function to be ran for mouse move listener
// Updates the known mouse position and vector
function onMouseMove(event) {
	mousePresent = true;
	mouseX = (event.clientX - windowHalfX);
	mouseY = (event.clientY - windowHalfY);
	mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
	mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
}

// Function to be ran for mouse click listener
// Updates the raycaster and chacks if the eyeCollision circle is being clicked
// If so it plays the blinking animations once
function onClick(event) {
	raycaster.setFromCamera(mouse, camera);
	const intersects = raycaster.intersectObjects(scene.children);
	for (let i = 0; i < intersects.length; i++) {
		if (intersects[i].object == eyeCollision) {
			if (closeLidAction && coverEyeAction) {
				closeLidAction.stop();
				coverEyeAction.stop();
				closeLidAction.play();
				coverEyeAction.play();
			}
		}
	}
}

// Function to be ran for mouse out listener
// It stores values for the distance to travel each frame when resetEye() is called
function onIdle(event) {
	mousePresent = false;
	xstep = Math.abs(pupil.position.x - targetX) / 10;
	ystep = Math.abs(pupil.position.y - targetY) / 10;
}

// A function to ease the pupil back to the screen's center
function resetEye() {

	if (pupil.position.x > targetX + xstep) {
		pupil.position.x -= xstep;
	}
	else if (pupil.position.x > targetX) {
		pupil.position.x = targetX;
	}

	if (pupil.position.x < targetX - xstep) {
		pupil.position.x += xstep;
	}
	else if (pupil.position.x < targetX) {
		pupil.position.x = targetX;
	}
	
	if (pupil.position.y > targetY + ystep) {
		pupil.position.y -= ystep;
	}
	else if (pupil.position.y > targetY) {
		pupil.position.y = targetY;
	}

	if (pupil.position.y < targetY - ystep) {
		pupil.position.y += ystep;
	}
	else if (pupil.position.y < targetY) {
		pupil.position.y = targetY;
	}

}

const clock = new THREE.Clock()

const tick = () =>
{

    //const elapsedTime = clock.getElapsedTime()

	// If the pupil is loaded, move it to follow the mouse
	if (pupil && mousePresent) {

		if (mouseX > 640) {
			xpos = targetX + (4 / 15);
		} else if (mouseX < -640) {
			xpos = targetX - (4 / 15);
		} else {
			xpos = targetX + (mouseX / 2400);
		}
		
		if (mouseY > 300) {
			ypos = targetY - (3 / 10);
		} else if (mouseY < -300) {
			ypos = targetY + (3 / 10);
		} else {
			ypos = targetY - (mouseY / 1000);
		}

		pupil.position.x = xpos;
		pupil.position.y = ypos;

	// If the mouse leaves the scene, reset the pupil to the center
	} else if (pupil && !mousePresent) {
		resetEye();
	}

	// Update the window half-size in case the window was resized
	windowHalfX = window.innerWidth / 2;
	windowHalfY = window.innerHeight / 2;

	// If the mixers are declared, update the animations as needed
	if (mixer1 && mixer2) {
		time = clock.getDelta()
		mixer1.update(time);
		mixer2.update(time);
	}

    // Render
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()