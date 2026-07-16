import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type RobotArmTwinProps = {
  baseSteps: number;
  armAngle: number;
  gripperAngle: number;
  connected: boolean;
};

type Pose = { base: number; arm: number; gripper: number };

export function RobotArmTwin({ baseSteps, armAngle, gripperAngle, connected }: RobotArmTwinProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const targetRef = useRef<Pose>({ base: 0, arm: 90, gripper: 40 });
  const [webglReady, setWebglReady] = useState(true);

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
    camera.position.set(5.2, 3.7, 5.4);
    cameraRef.current = camera;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0xf2f0e9, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute("aria-label", "실시간 로봇팔 3D 모델");
    mount.prepend(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.target.set(0, 1.85, 0);
    controls.minDistance = 3.5;
    controls.maxDistance = 11;
    controls.maxPolarAngle = Math.PI * 0.49;
    controlsRef.current = controls;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x53615b, 2.2));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
    keyLight.position.set(4, 7, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xa8f0d1, 1.8);
    rimLight.position.set(-4, 3, -3);
    scene.add(rimLight);

    const grid = new THREE.GridHelper(7, 14, 0x909a95, 0xd3d5ce);
    grid.position.y = -0.01;
    scene.add(grid);

    const green = new THREE.MeshStandardMaterial({ color: 0x00a970, roughness: 0.55, metalness: 0.08 });
    const mint = new THREE.MeshStandardMaterial({ color: 0xa8f0d1, roughness: 0.62 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xff6b35, roughness: 0.48 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x17201e, roughness: 0.38, metalness: 0.3 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x2567ad, roughness: 0.42, metalness: 0.12 });

    const robot = new THREE.Group();
    scene.add(robot);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.83, 0.95, 0.32, 48), dark);
    base.position.y = 0.16;
    base.castShadow = base.receiveShadow = true;
    robot.add(base);
    const baseTop = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.72, 0.25, 48), green);
    baseTop.position.y = 0.42;
    baseTop.castShadow = true;
    robot.add(baseTop);

    const yawGroup = new THREE.Group();
    yawGroup.position.y = 0.54;
    robot.add(yawGroup);
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.46, 0.66), mint);
    pedestal.position.y = 0.23;
    pedestal.castShadow = true;
    yawGroup.add(pedestal);

    const jointMeshes: THREE.Group[] = [];
    const addJoint = (parent: THREE.Group, length: number, material: THREE.Material) => {
      const pivot = new THREE.Group();
      parent.add(pivot);
      jointMeshes.push(pivot);

      const servo = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.43, 0.48), blue);
      servo.position.y = 0.04;
      servo.castShadow = true;
      pivot.add(servo);
      const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.72, 24), orange);
      axle.rotation.x = Math.PI / 2;
      axle.castShadow = true;
      pivot.add(axle);
      const link = new THREE.Mesh(new THREE.BoxGeometry(0.27, length, 0.34), material);
      link.position.y = length / 2;
      link.castShadow = true;
      pivot.add(link);
      const next = new THREE.Group();
      next.position.y = length;
      pivot.add(next);
      return next;
    };

    const shoulderRoot = new THREE.Group();
    shoulderRoot.position.y = 0.48;
    yawGroup.add(shoulderRoot);
    const elbowRoot = addJoint(shoulderRoot, 1.28, green);
    const wristRoot = addJoint(elbowRoot, 1.08, mint);
    const toolRoot = addJoint(wristRoot, 0.78, green);

    const wristBlock = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.34, 0.56), dark);
    wristBlock.position.y = 0.18;
    wristBlock.castShadow = true;
    toolRoot.add(wristBlock);
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.22, 0.4), orange);
    palm.position.y = 0.46;
    palm.castShadow = true;
    toolRoot.add(palm);
    const leftJaw = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.65, 0.28), mint);
    const rightJaw = leftJaw.clone();
    leftJaw.position.y = rightJaw.position.y = 0.83;
    leftJaw.castShadow = rightJaw.castShadow = true;
    toolRoot.add(leftJaw, rightJaw);

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
      jointMeshes[0].rotation.z = jointAngle * 0.72;
      jointMeshes[1].rotation.z = -jointAngle * 0.86;
      jointMeshes[2].rotation.z = jointAngle * 0.68;
      const jawGap = THREE.MathUtils.mapLinear(current.gripper, 15, 85, 0.36, 0.14);
      leftJaw.position.x = -jawGap;
      rightJaw.position.x = jawGap;

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
    controls.target.set(0, 1.85, 0);
    controls.update();
  };

  return (
    <div className="twin-viewport" ref={mountRef}>
      {!webglReady && <p className="webgl-error">이 브라우저에서 3D 가속을 사용할 수 없습니다.</p>}
      <div className="twin-badge"><i className={connected ? "online" : ""} />{connected ? "LIVE STATE" : "PREVIEW POSE"}</div>
      <div className="view-controls" aria-label="3D 카메라 시점">
        <button onClick={() => setView([0, 2.6, 7])}>정면</button>
        <button onClick={() => setView([7, 2.6, 0])}>측면</button>
        <button onClick={() => setView([0.1, 8, 0.1])}>위</button>
      </div>
      <span className="orbit-hint">DRAG TO ORBIT · SCROLL TO ZOOM</span>
    </div>
  );
}
