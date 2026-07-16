"use client";

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";

const RobotArmTwin = lazy(() =>
  import("./RobotArmTwin").then((module) => ({ default: module.RobotArmTwin })),
);

type SerialPortLike = {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
};

type NavigatorWithSerial = Navigator & {
  serial?: {
    requestPort(): Promise<SerialPortLike>;
  };
};

type Command = "w" | "s" | "a" | "d" | "q" | "e" | "r";

const CONTINUOUS_KEYS = new Set<Command>(["w", "s", "a", "d", "q", "e"]);
const LABELS: Record<Command, string> = {
  w: "관절 올리기",
  s: "관절 내리기",
  a: "베이스 왼쪽",
  d: "베이스 오른쪽",
  q: "그리퍼 열기",
  e: "그리퍼 닫기",
  r: "홈 위치",
};

export function RobotArmController() {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [activeKey, setActiveKey] = useState<Command | null>(null);
  const [lastCommand, setLastCommand] = useState("연결 대기 중");
  const [armAngle, setArmAngle] = useState(90);
  const [gripperAngle, setGripperAngle] = useState(40);
  const [baseSteps, setBaseSteps] = useState(0);
  const [log, setLog] = useState<string[]>(["SYSTEM  Web Serial 준비 완료"]);
  const portRef = useRef<SerialPortLike | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const repeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lineBufferRef = useRef("");

  const addLog = useCallback((message: string) => {
    const time = new Date().toLocaleTimeString("ko-KR", { hour12: false });
    setLog((items) => [...items.slice(-5), `${time}  ${message}`]);
  }, []);

  const stopRepeat = useCallback(() => {
    if (repeatRef.current) clearInterval(repeatRef.current);
    repeatRef.current = null;
    setActiveKey(null);
  }, []);

  const writeCommand = useCallback(async (command: Command) => {
    const writer = writerRef.current;
    if (!writer) return;
    try {
      await writer.write(new TextEncoder().encode(command));
      setLastCommand(`${command.toUpperCase()} · ${LABELS[command]}`);
    } catch {
      addLog("ERROR   명령 전송 실패");
      stopRepeat();
    }
  }, [addLog, stopRepeat]);

  const processLine = useCallback((line: string) => {
    const state = line.match(/^STATE\s+(-?\d+)\s+(\d+)\s+(\d+)/);
    if (state) {
      setBaseSteps(Number(state[1]));
      setArmAngle(Number(state[2]));
      setGripperAngle(Number(state[3]));
    }
    if (line.trim()) addLog(`UNO     ${line.trim()}`);
  }, [addLog]);

  const readSerial = useCallback(async (port: SerialPortLike) => {
    if (!port.readable) return;
    const reader = port.readable.getReader();
    readerRef.current = reader;
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        lineBufferRef.current += decoder.decode(value, { stream: true });
        const lines = lineBufferRef.current.split(/\r?\n/);
        lineBufferRef.current = lines.pop() ?? "";
        lines.forEach(processLine);
      }
    } catch {
      // Port closing also ends the reader with an exception.
    } finally {
      reader.releaseLock();
      readerRef.current = null;
    }
  }, [processLine]);

  const disconnect = useCallback(async () => {
    stopRepeat();
    try {
      await readerRef.current?.cancel();
      writerRef.current?.releaseLock();
      writerRef.current = null;
      await portRef.current?.close();
    } catch {
      // The device may already be unplugged.
    }
    portRef.current = null;
    setConnected(false);
    setLastCommand("연결 해제됨");
    addLog("SYSTEM  연결 해제");
  }, [addLog, stopRepeat]);

  const connect = useCallback(async () => {
    const serial = (navigator as NavigatorWithSerial).serial;
    if (!serial) {
      addLog("ERROR   Chrome 또는 Edge에서 열어주세요");
      return;
    }
    setConnecting(true);
    try {
      const port = await serial.requestPort();
      await port.open({ baudRate: 115200 });
      portRef.current = port;
      if (!port.writable) throw new Error("Writable stream unavailable");
      writerRef.current = port.writable.getWriter();
      setConnected(true);
      setLastCommand("제어 준비 완료");
      addLog("SYSTEM  Arduino Uno 연결 · 115200 baud");
      void readSerial(port);
    } catch {
      addLog("ERROR   연결이 취소되었거나 포트를 열 수 없음");
    } finally {
      setConnecting(false);
    }
  }, [addLog, readSerial]);

  const startCommand = useCallback((command: Command) => {
    if (!connected || activeKey === command) return;
    stopRepeat();
    setActiveKey(command);
    void writeCommand(command);
    if (CONTINUOUS_KEYS.has(command)) {
      repeatRef.current = setInterval(() => void writeCommand(command), 85);
    }
  }, [activeKey, connected, stopRepeat, writeCommand]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase() as Command;
      if (!(key in LABELS) || event.repeat) return;
      event.preventDefault();
      startCommand(key);
    };
    const up = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase() as Command;
      if (key === activeKey) stopRepeat();
    };
    const blur = () => stopRepeat();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [activeKey, startCommand, stopRepeat]);

  useEffect(() => () => {
    if (repeatRef.current) clearInterval(repeatRef.current);
    void readerRef.current?.cancel();
  }, []);

  const keyButton = (key: Command, text: string) => (
    <button
      className={`key-button ${activeKey === key ? "active" : ""}`}
      disabled={!connected}
      onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); startCommand(key); }}
      onPointerUp={stopRepeat}
      onPointerCancel={stopRepeat}
      onContextMenu={(event) => event.preventDefault()}
      aria-label={`${key.toUpperCase()} 키, ${LABELS[key]}`}
    >
      <span>{key.toUpperCase()}</span>
      <small>{text}</small>
    </button>
  );

  return (
    <main className="control-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">A1</div>
          <div><strong>ARM—01</strong><span>ROBOTICS LAB</span></div>
        </div>
        <div className={`connection-pill ${connected ? "online" : ""}`}>
          <i /> {connected ? "UNO ONLINE" : "UNO OFFLINE"}
        </div>
      </header>

      <section className="hero-row">
        <div>
          <p className="eyebrow">KEYBOARD CONTROL STATION / UNO R3</p>
          <h1>손끝으로 움직이는<br /><em>로봇팔 컨트롤.</em></h1>
          <p className="lede">키를 누르고 있는 동안 명령을 연속 전송합니다. 세 관절은 함께, 베이스와 그리퍼는 따로 움직입니다.</p>
        </div>
        <div className="connection-card">
          <div className="port-visual"><span>USB</span><i /><i /><i /></div>
          <div><span className="mini-label">SERIAL PORT</span><strong>{connected ? "Arduino Uno · 115200" : "장치를 연결해 주세요"}</strong></div>
          <button onClick={connected ? disconnect : connect} disabled={connecting} className={connected ? "disconnect-button" : "connect-button"}>
            {connecting ? "연결 중…" : connected ? "연결 해제" : "USB 연결"}
          </button>
        </div>
      </section>

      <section className="panel twin-panel">
        <div className="panel-heading">
          <div><span className="index">01</span><h2>3D 디지털 트윈</h2></div>
          <span className="hint">Arduino 상태값과 실시간 동기화</span>
        </div>
        <div className="twin-layout">
          <Suspense fallback={<div className="twin-loading">3D MODEL LOADING…</div>}>
            <RobotArmTwin baseSteps={baseSteps} armAngle={armAngle} gripperAngle={gripperAngle} connected={connected} />
          </Suspense>
          <div className="twin-telemetry">
            <div className="telemetry-heading"><span>DIGITAL TWIN</span><b>OPEN-LOOP</b></div>
            <div className="telemetry-value"><span>BASE / YAW</span><strong>{Math.round((baseSteps / 2048) * 360)}°</strong><small>{baseSteps} STEPS</small></div>
            <div className="telemetry-value"><span>JOINTS / LINKED</span><strong>{armAngle}°</strong><small>J1 · J2 · J3</small></div>
            <div className="telemetry-value"><span>GRIPPER</span><strong>{gripperAngle}°</strong><small>{gripperAngle < 45 ? "OPEN" : "CLOSED"}</small></div>
            <p className="twin-note"><b>SIM</b> 명령 상태를 시각화합니다. 실제 위치 피드백에는 엔코더 또는 각도 센서가 필요합니다.</p>
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="panel primary-panel">
          <div className="panel-heading"><div><span className="index">02</span><h2>실시간 제어</h2></div><span className="hint">키보드 또는 버튼을 길게 누르세요</span></div>
          <div className="control-groups">
            <div className="control-block">
              <div className="control-title"><span>LINKED JOINTS</span><b>{armAngle}°</b></div>
              <div className="key-pair">{keyButton("w", "올리기")}{keyButton("s", "내리기")}</div>
              <div className="meter"><span style={{ width: `${(armAngle / 180) * 100}%` }} /></div>
            </div>
            <div className="control-block">
              <div className="control-title"><span>BASE ROTATION</span><b>{baseSteps > 0 ? "+" : ""}{baseSteps}</b></div>
              <div className="key-pair">{keyButton("a", "왼쪽")}{keyButton("d", "오른쪽")}</div>
              <div className="direction-line"><span>◀ COUNTER CLOCKWISE</span><span>CLOCKWISE ▶</span></div>
            </div>
            <div className="control-block">
              <div className="control-title"><span>GRIPPER</span><b>{gripperAngle}°</b></div>
              <div className="key-pair">{keyButton("q", "열기")}{keyButton("e", "닫기")}</div>
              <div className="meter warm"><span style={{ width: `${(gripperAngle / 100) * 100}%` }} /></div>
            </div>
          </div>
          <button className="home-button" disabled={!connected} onClick={() => void writeCommand("r")}><span>R</span> 관절·그리퍼 홈 위치로</button>
        </article>

        <aside className="side-stack">
          <article className="panel pin-panel">
            <div className="panel-heading"><div><span className="index">03</span><h2>핀 구성</h2></div></div>
            <div className="pin-list">
              <div><span className="pin-number">03</span><p><b>관절 서보 × 3</b><small>동일 신호 · 동시 제어</small></p><i className="servo-color" /></div>
              <div><span className="pin-number">05</span><p><b>그리퍼 서보</b><small>열기 / 닫기</small></p><i className="grip-color" /></div>
              <div><span className="pin-number">08—11</span><p><b>스테퍼 모터</b><small>IN1 · IN2 · IN3 · IN4</small></p><i className="stepper-color" /></div>
            </div>
            <p className="power-note"><b>!</b> 서보는 외부 5V 전원을 사용하고 Arduino와 GND를 공통으로 연결하세요.</p>
          </article>

          <article className="panel console-panel">
            <div className="panel-heading"><div><span className="index">04</span><h2>시리얼 로그</h2></div><span className="live-label">LIVE</span></div>
            <div className="console">
              {log.map((item, index) => <p key={`${item}-${index}`}>{item}</p>)}
              <p className="cursor-line">› {lastCommand}<span className="cursor" /></p>
            </div>
          </article>
        </aside>
      </section>

      <footer><span>ARM—01 / WEB SERIAL CONTROLLER</span><span>CHROME · EDGE · 115200 BAUD</span></footer>
    </main>
  );
}
