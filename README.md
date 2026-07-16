# ARM-01 Robot Arm Controller

Arduino Uno 로봇팔을 Arduino IDE 시리얼 모니터와 Web Serial 웹앱 양쪽에서 제어하는 프로젝트입니다.

**웹 컨트롤러:** https://jihotech16.github.io/Arduino_RobotArm/

## 배선

- 관절 서보 3개 신호선: D3 (세 서보가 같은 각도로 동시 동작)
- 그리퍼 서보 신호선: D5
- 28BYJ-48 ULN2003: IN1→D8, IN2→D9, IN3→D10, IN4→D11
- 서보와 스테퍼는 별도 5V 전원을 권장하며, 외부 전원 GND와 Arduino GND를 반드시 공통 연결합니다.

## Arduino IDE에서 먼저 테스트

1. `arduino/RobotArmController/RobotArmController.ino`를 Arduino IDE에서 엽니다.
2. 보드 `Arduino Uno`, 올바른 포트를 선택하고 업로드합니다.
3. 시리얼 모니터를 `115200 baud`로 엽니다. 줄바꿈 설정은 무엇이든 괜찮습니다.
4. 아래 글자 하나를 입력하고 전송합니다.

| 키 | 동작 |
|---|---|
| W / S | 관절 서보 3개 함께 올리기 / 내리기 |
| A / D | 스테퍼 베이스 왼쪽 / 오른쪽 |
| Q / E | 그리퍼 열기 / 닫기 |
| R | 관절과 그리퍼를 홈 각도로 이동 |

## 웹앱

Chrome 또는 Edge에서 웹앱을 열고 `USB 연결`을 누른 뒤 Arduino Uno 포트를 선택합니다. 키보드 키를 누르고 있는 동안 명령이 반복 전송됩니다. Arduino IDE 시리얼 모니터가 포트를 사용 중이면 먼저 닫아야 웹앱에서 연결할 수 있습니다.

`main` 브랜치에 변경사항을 올리면 GitHub Actions가 정적 사이트를 다시 빌드하여 GitHub Pages에 자동 배포합니다.

> 베이스 스테퍼에는 원점 센서가 없으므로 R 키가 베이스의 물리적 원점을 찾지는 않습니다. 정확한 홈 복귀가 필요하면 리미트 스위치를 추가해야 합니다.
