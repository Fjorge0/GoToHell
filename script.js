import * as THREE from 'three';
import WebGL from 'three/addons/capabilities/WebGL.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'; // TODO: Remove orbit controls

const EARTH_RADIUS = 6371;

function calcDistance(lat1, lon1, lat2, lon2) {
	// Haversign formula
	// https://en.wikipedia.org/wiki/Haversine_formula
	const dlon = lon2 - lon1;
	const dlat = lat2 - lat1;

	const a = Math.pow(Math.sin(dlat / 2), 2) + Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin(dlon / 2), 2);

	return EARTH_RADIUS * 2 * Math.asin(Math.sqrt(a));
};

function calcBearing(lat1, lon1, lat2, lon2) {
	// Spherical law of cosines
	// https://www.askamathematician.com/2018/07/q-given-two-points-on-the-globe-how-do-you-figure-out-the-direction-and-distance-to-each-other
	const distance = calcDistance(lat1, lon1, lat2, lon2);

	const theta_1 = Math.PI / 2 - lat1;
	const theta_2 = Math.PI / 2 - lat2;

	const phi = distance / EARTH_RADIUS;
	
	return Math.acos((Math.cos(theta_2) - Math.cos(theta_1) * Math.cos(phi)) / (Math.sin(theta_1) * Math.sin(phi)));
};

window.addEventListener("load", () => {
	const canVibrate = ('vibrate' in window.navigator);
	// Constants
	const hell_latitude = 42.4338 * (Math.PI / 180);
	const hell_longitude = -83.9845 * (Math.PI / 180);
	const hell_altitude = 270;

	// Variables for current device data
	var latitude;
	var longitude;
	var heading;
	var yaw;
	var pitch;
	var roll;

	// Wait function for infinite loop
	function wait(ms) { return new Promise(res => setTimeout(res, ms)); };

	// Display errors as HTML
	function displayError(id, message = null, timeout = 0) {
		if (message && !$(`#${id}`).length) {
			console.error(`code: ${id}\n${message}`);

			$(`#error-template`).clone().attr({
				id: id
			}).html(message).appendTo("#message-box");

			if (timeout > 0) {
				setTimeout(displayError(id), timeout);
			};
		} else if (!message && $(`#${id}`).length) {
			console.warn(`Removing error ${id}.`);

			$(`#${id}`).remove();
		};
	};

	// Save the location of the device
	function handleGeoPosition(position) {
		latitude = position.coords.latitude * Math.PI / 180;
		longitude = position.coords.longitude * Math.PI / 180;
		heading = position.coords.heading * Math.PI / 180;

		displayError("geo-no-perm");
		displayError("geo-error");
		displayError("geo-timeout");
	};

	// Display various error codes from the geolocation API
	function handleGeoError(err) {
		switch (err.code) {
			case 1:
				displayError("geo-no-perm", "Please allow geolocation.");
				break;
			case 2:
				displayError("geo-error", "Something went wrong while determining your location.");
				break;
			case 3:
				displayError("geo-timeout", "Geolocation request timed out.");
				break;
		}
	};

	// Save device orientation
	function handleOrientation(orientation) {
		if (orientation.webkitCompassHeading) {
			yaw = orientation.webkitCompassHeading;
			
			console.warn("Using webkit-specific compass heading.");
		} else if (orientation.alpha) {
			yaw = orientation.alpha;
		};

		pitch = orientation.beta * Math.PI / 180;
		roll = orientation.gamma * Math.PI / 180;
		yaw *= Math.PI / 180;
	};

	// Vibrate morse code for "go to hell"
	var vibrate_lock = false;
	function vibrate() {
		if (vibrate_lock) {
			return;
		}

		const pattern = [300, 100, 300, 100, 100, 300, 300, 100, 300, 100, 300, 700, 300, 300, 300, 100, 300, 100, 300, 700, 100, 100, 100, 100, 100, 100, 100, 300, 100, 300, 100, 100, 300, 100, 100, 100, 100, 300, 100, 100, 300, 100, 100, 100, 100, 100, 700];

		vibrate_lock = true;
		setTimeout(() => {vibrate_lock = false}, pattern.reduce((a, b) => a + b, 0))
		window.navigator.vibrate(pattern);
	};


	// Get orientation
	if (DeviceOrientationEvent.requestPermission) {
		console.warn("Requesting permission for device orientation.")

		function requestOrientationPermission() {
			DeviceOrientationEvent.requestPermission()
			.then((response) => {
				if (response === "granted") {
					window.addEventListener("deviceorientation", handleOrientation, true);
					
					$('#message-ask-orient-perm').attr({style: "display: none;"});
				} else {
					displayError("compass-no-perm", "Please allow getting device orientation.");
				}
			}).catch(() => {
				displayError("compass-no-support", "Your device does not support getting compass headings.")
			});
		};

		const request = document.getElementById("message-ask-orient-perm");
		request.addEventListener("click", requestOrientationPermission);
		request.style = {};
	} else {
		window.addEventListener("deviceorientationabsolute", handleOrientation, true);
	}

	// Check for WebGL support
	if (!WebGL.isWebGLAvailable()) {
		displayError("webgl-no-support", "Please enable WebGL or use a browser that supports it.");
		return;
	};

	// Check for geolocation support
	if ("geolocation" in navigator) {
		navigator.geolocation.getCurrentPosition(handleGeoPosition, handleGeoError);
		navigator.geolocation.watchPosition(handleGeoPosition, handleGeoError);
	} else {
		displayError("geo-no-support", "Your device does not support geolocation.");
	}

	// Lock orientation to portrait if possible
	if ('lock' in screen.orientation) {
		screen.orientation.lock('portrait-primary');
	}

	// Create the required three.js objects
	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
	const renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	const loader = new GLTFLoader();

	const controls = new OrbitControls(camera, renderer.domElement)
	controls.enableDamping = true

	scene.add(new THREE.AxesHelper(5))


	// Add some light
	const alight = new THREE.AmbientLight(0x8c8c8c);
	scene.add(alight);

	camera.position.z = 5;

	document.getElementById("center").appendChild(renderer.domElement);
	renderer.domElement.id = "arrow";

	// Load the arrow
	loader.load('static/arrow.gltf', function (gltf) {
		let model = gltf.scene;
		model.scale.set(0.3, 0.3, 0.3);

		// Replace model material
		var newMaterial = new THREE.MeshStandardMaterial({color: 0xff0000});
		model.traverse((o) => {
			if (o.isMesh) o.material = newMaterial;
		});

		scene.add(model);

		// Add a light to the model
		const light = new THREE.PointLight(0xa6a6a6, 10);
		light.position.set(0, 1, 7.5);
		model.add(light);
		
		// Make the render size a square
		const size = Math.min(document.getElementById("center").clientWidth, document.getElementById("center").clientHeight);
		renderer.setSize(size, size);

		// Render the scene
		renderer.render(scene, camera);

		// Draw the arrow on the canvas
		function displayArrow() {
			// Call function every frame
			requestAnimationFrame(displayArrow);

			// Get distance between user and hell
			const distance = calcDistance(latitude, longitude, hell_latitude, hell_longitude);
			const bearing = calcBearing(latitude, longitude, hell_latitude, hell_longitude);

			// Get compass heading
			const hdn = yaw || heading;

			// Display error if the device has no compass
			if (!hdn && !DeviceOrientationEvent.requestPermission) {
				displayError("compass-no-support", "Your device does not support getting compass headings.");
			} else {
				displayError("compass-no-support");
			}

			// Different modes for a device with full sensors and only compass
			if (latitude != null && longitude != null && hdn != null && pitch != null && yaw != null) {
				model.rotation.x = -pitch;
				model.rotation.y = -roll;
				model.rotation.z = hdn + bearing;

				// TODO: Calculate angle to hell
			} else if (latitude != null && longitude != null && hdn != null) {
				// TODO: Implement 2D compass
			}

			if (Math.abs(bearing - hdn) < (Math.PI / 12)) {
				if (canVibrate) {
					vibrate();
				}
			} else if (canVibrate) {
				window.navigator.vibrate(0);
			}

			// Display the distance between user location and Hell
			$("#distance").html(`${distance.toFixed(2).toLocaleString()}km`);

			controls.update()

			// Make the render size a square
			const size = Math.min(document.getElementById("center").clientWidth, document.getElementById("center").clientHeight);
			renderer.setSize(size, size);

			// Render the scene
			renderer.render(scene, camera);
		};

		// Draw the arrow
		displayArrow();
	}, undefined, function (error) {
		console.error(error);
	});
});

// vim:ts=2:sw=2:noexpandtab
