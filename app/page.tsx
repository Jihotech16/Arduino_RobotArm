import type { Metadata } from "next";
import { RobotArmController } from "./RobotArmController";

export const metadata: Metadata = {
  title: "ARM-01 Control Station",
  description: "Web Serial 기반 Arduino Uno 로봇팔 키보드 컨트롤러",
};

export default function Home() {
  return <RobotArmController />;
}
