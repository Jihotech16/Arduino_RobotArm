#include <Servo.h>
#include <Stepper.h>

// ---- Pin configuration ----
const byte ARM_SERVO_PIN = 3;      // Joint servos 1, 2, 3: signal wires together
const byte GRIPPER_SERVO_PIN = 5;
const byte STEPPER_IN1 = 8;
const byte STEPPER_IN2 = 9;
const byte STEPPER_IN3 = 10;
const byte STEPPER_IN4 = 11;

// 28BYJ-48 + ULN2003: change this value if your motor is different.
const int STEPS_PER_REVOLUTION = 2048;
const int STEPPER_CHUNK = 8;
const int SERVO_INCREMENT = 2;
const int ARM_MIN = 15;
const int ARM_MAX = 165;
const int GRIPPER_MIN = 10;
const int GRIPPER_MAX = 170;
const int ARM_HOME = 90;
const int GRIPPER_HOME = 90;

Servo armServos;
Servo gripperServo;

// Stepper library order for a 28BYJ-48 is IN1, IN3, IN2, IN4.
Stepper baseStepper(STEPS_PER_REVOLUTION,
                    STEPPER_IN1, STEPPER_IN3, STEPPER_IN2, STEPPER_IN4);

int armAngle = ARM_HOME;
int gripperAngle = GRIPPER_HOME;
long basePosition = 0;

void reportState() {
  Serial.print(F("STATE "));
  Serial.print(basePosition);
  Serial.print(' ');
  Serial.print(armAngle);
  Serial.print(' ');
  Serial.println(gripperAngle);
}

void moveArm(int amount) {
  armAngle = constrain(armAngle + amount, ARM_MIN, ARM_MAX);
  armServos.write(armAngle);
}

void moveGripper(int amount) {
  gripperAngle = constrain(gripperAngle + amount, GRIPPER_MIN, GRIPPER_MAX);
  gripperServo.write(gripperAngle);
}

void moveBase(int amount) {
  baseStepper.step(amount);
  basePosition += amount;
}

void goHome() {
  // Servo home only. The stepper has no position sensor, so base zeroing
  // requires a limit switch and is intentionally not attempted here.
  armAngle = ARM_HOME;
  gripperAngle = GRIPPER_HOME;
  armServos.write(armAngle);
  gripperServo.write(gripperAngle);
}

void handleCommand(char command) {
  switch (tolower(command)) {
    case 'w': moveArm(+SERVO_INCREMENT); break;
    case 's': moveArm(-SERVO_INCREMENT); break;
    case 'a': moveBase(-STEPPER_CHUNK); break;
    case 'd': moveBase(+STEPPER_CHUNK); break;
    case 'q': moveGripper(-SERVO_INCREMENT); break;
    case 'e': moveGripper(+SERVO_INCREMENT); break;
    case 'r': goHome(); break;
    case 'x': return; // Stop marker; useful for future expansion.
    default: return;  // Ignore Enter, newline, spaces, and unknown input.
  }
  reportState();
}

void setup() {
  Serial.begin(115200);
  armServos.attach(ARM_SERVO_PIN);
  gripperServo.attach(GRIPPER_SERVO_PIN);
  baseStepper.setSpeed(10);
  goHome();
  delay(350);
  Serial.println(F("READY ARM-01"));
  reportState();
}

void loop() {
  while (Serial.available() > 0) {
    handleCommand((char)Serial.read());
  }
}
