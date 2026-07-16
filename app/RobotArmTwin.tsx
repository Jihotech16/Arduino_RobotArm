import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

type RobotArmTwinProps = {
  baseSteps: number;
  armAngle: number;
  gripperAngle: number;
  connected: boolean;
};

type Pose = { base: number; arm: number; gripper: number };

const MODEL_PATH = `${import.meta.env.BASE_URL}models/robot-arm/`;
const MM_TO_SCENE = 0.011;

export function RobotArmTwin({ baseSteps, armAngle, gripperAngle, connected }: RobotArmTwinProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const targetRef = useRef<Pose>({ base: 0, arm: 90, gripper: 90 });
  const [webglReady, setWebglReady] = useState(true);
  const [modelReady, setModelReady] = useState(false);

  useEffect(() => {
    targetRef.current = { base: baseSteps, arm: armAngle, gripper: gripperAngle };
  }, [baseSteps, armAngle, gripperAngle]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setWebglReady(false);
      return;
    }

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xf2f0e9, 7, 13);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
    camera.position.set(5.2, 3.6, 5.6);
    cameraRef.current = camera;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0xf2f0e9, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute("aria-label", "3MF 부품으로 조립한 실시간 로봇팔 3D 모델");
    mount.prepend(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.target.set(0, 1.8, 0);
    controls.minDistance = 3.4;
    controls.maxDistance = 11;
    controls.maxPolarAngle = Math.PI * 0.49;
    controlsRef.current = controls;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x50605a, 2.4));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.4);
    keyLight.position.set(4, 7, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xa8f0d1, 1.9);
    rimLight.position.set(-4, 3, -3);
    scene.add(rimLight);

    const grid = new THREE.GridHelper(7, 14, 0x909a95, 0xd3d5ce);
    grid.position.y = -0.01;
    scene.add(grid);

    const printedGreen = new THREE.MeshStandardMaterial({ color: 0x08a968, roughness: 0.66, metalness: 0.02 });
    const printedDark = new THREE.MeshStandardMaterial({ color: 0x26302d, roughness: 0.62 });
    const servoBlue = new THREE.MeshStandardMaterial({ color: 0x145d9e, roughness: 0.42, metalness: 0.12 });
    const servoLabel = new THREE.MeshStandardMaterial({ color: 0x242b2a, roughness: 0.58 });
    const hornWhite = new THREE.MeshStandardMaterial({ color: 0xf1eee5, roughness: 0.5 });
    const metal = new THREE.MeshStandardMaterial({ color: 0xbcc5c1, roughness: 0.3, metalness: 0.7 });

    const robot = new THREE.Group();
    robot.rotation.y = -0.25;
    scene.add(robot);

    const yawGroup = new THREE.Group();
    const shoulder = new THREE.Group();
    const elbow = new THREE.Group();
    const wrist = new THREE.Group();
    const leftClawPivot = new THREE.Group();
    const rightClawPivot = new THREE.Group();
    const jointPivots = [shoulder, elbow, wrist];

    const makeServo = (parent: THREE.Group, y = 0) => {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.19), servoBlue);
      body.position.set(0, y, 0);
      body.castShadow = true;
      parent.add(body);
      const label = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.012), servoLabel);
      label.position.set(0, y, 0.101);
      parent.add(label);
      const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.3, 20), metal);
      axle.rotation.x = Math.PI / 2;
      axle.position.set(0, y + 0.13, 0);
      axle.castShadow = true;
      parent.add(axle);
      const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.025, 24), hornWhite);
      horn.rotation.x = Math.PI / 2;
      horn.position.set(0, y + 0.13, 0.165);
      parent.add(horn);
    };

    const prepareCadMesh = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.scale.setScalar(MM_TO_SCENE);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    };

    const placeLink = (mesh: THREE.Mesh, parent: THREE.Group, fullLengthMm: number) => {
      mesh.rotation.z = Math.PI / 2;
      mesh.position.y = (fullLengthMm * MM_TO_SCENE) / 2;
      parent.add(mesh);
    };

    const loader = new STLLoader();
    let disposed = false;
    Promise.all([
      loader.loadAsync(`${MODEL_PATH}base-bottom.stl`),
      loader.loadAsync(`${MODEL_PATH}base-body.stl`),
      loader.loadAsync(`${MODEL_PATH}stepper-hat.stl`),
      loader.loadAsync(`${MODEL_PATH}joint-1.stl`),
      loader.loadAsync(`${MODEL_PATH}joint-2.stl`),
      loader.loadAsync(`${MODEL_PATH}gripper.stl`),
      loader.loadAsync(`${MODEL_PATH}claw.stl`),
      loader.loadAsync(`${MODEL_PATH}claw-insert.stl`),
    ]).then(([baseBottomGeo, baseBodyGeo, stepperHatGeo, joint1Geo, joint2Geo, gripperGeo, clawGeo, insertGeo]) => {
      if (disposed) return;

      const baseBottom = prepareCadMesh(baseBottomGeo, printedDark);
      baseBottom.rotation.x = -Math.PI / 2;
      baseBottom.position.y = 0.04;
      robot.add(baseBottom);

      const baseBody = prepareCadMesh(baseBodyGeo, printedGreen);
      baseBody.rotation.x = -Math.PI / 2;
      baseBody.position.y = 0.36;
      robot.add(baseBody);

      yawGroup.position.y = 0.68;
      robot.add(yawGroup);
      const stepperHat = prepareCadMesh(stepperHatGeo, printedGreen);
      stepperHat.rotation.x = -Math.PI / 2;
      stepperHat.position.y = 0.15;
      yawGroup.add(stepperHat);
      const baseBracket = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.42), printedGreen);
      baseBracket.position.y = 0.34;
      baseBracket.castShadow = true;
      yawGroup.add(baseBracket);
      makeServo(yawGroup, 0.37);

      shoulder.position.y = 0.53;
      yawGroup.add(shoulder);
      const joint1 = prepareCadMesh(joint1Geo, printedGreen);
      placeLink(joint1, shoulder, 76.5);
      makeServo(shoulder, 0.07);

      elbow.position.y = 0.66;
      shoulder.add(elbow);
      const joint2 = prepareCadMesh(joint2Geo, printedGreen);
      placeLink(joint2, elbow, 71.5);
      makeServo(elbow, 0.06);

      wrist.position.y = 0.61;
      elbow.add(wrist);
      const gripper = prepareCadMesh(gripperGeo, printedGreen);
      placeLink(gripper, wrist, 100);
      makeServo(wrist, 0.08);

      const gripperServo = new THREE.Group();
      gripperServo.position.y = 0.9;
      wrist.add(gripperServo);
      makeServo(gripperServo, 0);
      const insert = prepareCadMesh(insertGeo, hornWhite);
      insert.rotation.z = Math.PI / 2;
      insert.position.set(0, 0.13, 0.18);
      gripperServo.add(insert);

      leftClawPivot.position.set(-0.08, 0.14, 0);
      rightClawPivot.position.set(0.08, 0.14, 0);
      gripperServo.add(leftClawPivot, rightClawPivot);
      const leftClaw = prepareCadMesh(clawGeo, printedGreen);
      const rightClaw = prepareCadMesh(clawGeo.clone(), printedGreen);
      leftClaw.rotation.z = Math.PI / 2;
      rightClaw.rotation.z = Math.PI / 2;
      leftClaw.scale.z *= -1;
      leftClaw.position.y = rightClaw.position.y = 0.32;
      leftClawPivot.add(leftClaw);
      rightClawPivot.add(rightClaw);

      setModelReady(true);
    }).catch(() => {
      if (!disposed) setModelReady(false);
    });

    const current: Pose = { base: baseSteps, arm: armAngle, gripper: gripperAngle };
    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const target = targetRef.current;
      current.base = THREE.MathUtils.lerp(current.base, target.base, 0.11);
      current.arm = THREE.MathUtils.lerp(current.arm, target.arm, 0.11);
      current.gripper = THREE.MathUtils.lerp(current.gripper, target.gripper, 0.13);

      yawGroup.rotation.y = (current.base / 2048) * Math.PI * 2;
      const jointAngle = THREE.MathUtils.degToRad(current.arm - 90);
      jointPivots[0].rotation.z = jointAngle * 0.72;
      jointPivots[1].rotation.z = -jointAngle * 0.86;
      jointPivots[2].rotation.z = jointAngle * 0.68;
      const clawAngle = THREE.MathUtils.clamp(
        THREE.MathUtils.mapLinear(current.gripper, 10, 170, 0.46, 0.04),
        0.04,
        0.46,
      );
      leftClawPivot.rotation.z = clawAngle;
      rightClawPivot.rotation.z = -clawAngle;

      controls.update();
      renderer.render(scene, camera);
    };

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      cameraRef.current = null;
      controlsRef.current = null;
    };
  }, []);

  const setView = (position: [number, number, number]) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    camera.position.set(...position);
    controls.target.set(0, 1.8, 0);
    controls.update();
  };

  return (
    <div className="twin-viewport" ref={mountRef}>
      {!webglReady && <p className="webgl-error">이 브라우저에서 3D 가속을 사용할 수 없습니다.</p>}
      <div className="twin-badge"><i className={connected ? "online" : ""} />{modelReady ? connected ? "LIVE · 3MF CAD" : "3MF CAD READY" : "CAD LOADING"}</div>
      <div className="view-controls" aria-label="3D 카메라 시점">
        <button onClick={() => setView([0, 2.6, 7])}>정면</button>
        <button onClick={() => setView([7, 2.6, 0])}>측면</button>
        <button onClick={() => setView([0.1, 8, 0.1])}>위</button>
      </div>
      <span className="orbit-hint">3MF PRINT PARTS · DRAG TO ORBIT · SCROLL TO ZOOM</span>
    </div>
  );
}
