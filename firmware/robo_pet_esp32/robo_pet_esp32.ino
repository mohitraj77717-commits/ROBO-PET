/*
 * ROBO PET — ESP32 Firmware
 * Hardware: ESP32 + Dual SG90 Servos (Pan & Tilt) + SSD1306 OLED (128x64) + HC-SR04 Ultrasonic Sensor + Buzzer
 * Baud Rate: 115200
 */

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ESP32Servo.h>
#include <ArduinoJson.h>

// ==========================================
// PIN CONFIGURATIONS
// ==========================================
#define PIN_SERVO_PAN    18   // Pan (Yaw / Left-Right)
#define PIN_SERVO_TILT   19   // Tilt (Pitch / Up-Down)

#define PIN_TRIG         5    // Ultrasonic HC-SR04 Trig
#define PIN_ECHO         4    // Ultrasonic HC-SR04 Echo

#define PIN_BUZZER       23   // Piezo Buzzer

#define OLED_SDA         21   // I2C SDA
#define OLED_SCL         22   // I2C SCL
#define SCREEN_WIDTH     128
#define SCREEN_HEIGHT    64
#define OLED_RESET       -1

// ==========================================
// SERVO CALIBRATION & SAFE LIMITS (SG90)
// ==========================================
#define PAN_MIN          10
#define PAN_MAX          170
#define PAN_CENTER       90

#define TILT_MIN         40
#define TILT_MAX         140
#define TILT_CENTER      90

// ==========================================
// GLOBALS & INSTANCES
// ==========================================
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
Servo servoPan;
Servo servoTilt;

int currentPan = PAN_CENTER;
int currentTilt = TILT_CENTER;
int targetPan = PAN_CENTER;
int targetTilt = TILT_CENTER;

String currentEmotion = "neutral";
String currentAction = "none";
String displayMode = "face"; // "face", "time", "temperature", "distance"

unsigned long lastTelemetryTime = 0;
const unsigned long TELEMETRY_INTERVAL = 2500; // Emit telemetry every 2.5s

unsigned long actionStartTime = 0;
bool isActionActive = false;

// ==========================================
// SETUP
// ==========================================
void setup() {
  Serial.begin(115200);
  delay(500);

  // Pin modes
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  pinMode(PIN_BUZZER, OUTPUT);

  // Initialize Servos
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  servoPan.setPeriodHertz(50);
  servoTilt.setPeriodHertz(50);
  servoPan.attach(PIN_SERVO_PAN, 500, 2400);
  servoTilt.attach(PIN_SERVO_TILT, 500, 2400);

  // Move to initial center
  setServoAngles(PAN_CENTER, TILT_CENTER);

  // Initialize OLED
  Wire.begin(OLED_SDA, OLED_SCL);
  if (display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    drawFace("neutral");
  }

  // Welcome chirp
  playChirp(880, 100);
  playChirp(1200, 150);

  Serial.println("{\"type\":\"boot\",\"status\":\"ready\",\"device\":\"ROBO-PET-ESP32\"}");
}

// ==========================================
// MAIN LOOP
// ==========================================
void loop() {
  // 1. Process incoming Serial JSON commands
  if (Serial.available() > 0) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.length() > 0) {
      handleSerialCommand(line);
    }
  }

  // 2. Smoothly update servo positions towards targets
  updateServoMovement();

  // 3. Handle active movement routine animations
  if (isActionActive) {
    runMovementRoutine();
  }

  // 4. Periodically transmit sensor telemetry to Python backend
  if (millis() - lastTelemetryTime >= TELEMETRY_INTERVAL) {
    lastTelemetryTime = millis();
    emitTelemetry();
  }
}

// ==========================================
// SERIAL COMMAND PARSING
// ==========================================
void handleSerialCommand(const String& jsonStr) {
  StaticJsonDocument<384> doc;
  DeserializationError error = deserializeJson(doc, jsonStr);
  if (error) {
    return;
  }

  const char* type = doc["type"] | "cmd";

  if (strcmp(type, "cmd") == 0) {
    if (doc.containsKey("emotion")) {
      currentEmotion = String((const char*)doc["emotion"]);
      drawFace(currentEmotion);
    }
    if (doc.containsKey("action")) {
      const char* act = doc["action"];
      if (act && strlen(act) > 0) {
        startMovement(String(act));
      }
    }
    if (doc.containsKey("display")) {
      const char* disp = doc["display"];
      if (disp && strlen(disp) > 0) {
        displayMode = String(disp);
        updateDisplayScreen();
      }
    }
  } else if (strcmp(type, "display") == 0) {
    displayMode = String((const char*)(doc["mode"] | "face"));
    updateDisplayScreen();
  } else if (strcmp(type, "alert") == 0) {
    playAlertTone();
    startMovement("wiggle");
    drawFace("surprised");
  }
}

// ==========================================
// SERVO MOVEMENT LOGIC
// ==========================================
void setServoAngles(int pan, int tilt) {
  targetPan = constrain(pan, PAN_MIN, PAN_MAX);
  targetTilt = constrain(tilt, TILT_MIN, TILT_MAX);
}

void updateServoMovement() {
  // Smooth easing step
  if (currentPan != targetPan) {
    int step = (targetPan > currentPan) ? 1 : -1;
    currentPan += step;
    servoPan.write(currentPan);
    delayMicroseconds(1200);
  }
  if (currentTilt != targetTilt) {
    int step = (targetTilt > currentTilt) ? 1 : -1;
    currentTilt += step;
    servoTilt.write(currentTilt);
    delayMicroseconds(1200);
  }
}

void startMovement(const String& act) {
  currentAction = act;
  actionStartTime = millis();
  isActionActive = true;

  if (act == "dance") {
    playChirp(600, 80);
    playChirp(800, 80);
  } else if (act == "wiggle") {
    playChirp(700, 50);
  } else if (act == "stop") {
    isActionActive = false;
    setServoAngles(PAN_CENTER, TILT_CENTER);
  }
}

void runMovementRoutine() {
  unsigned long elapsed = millis() - actionStartTime;

  if (currentAction == "dance") {
    if (elapsed > 3500) {
      isActionActive = false;
      setServoAngles(PAN_CENTER, TILT_CENTER);
      return;
    }
    float phase = (elapsed % 800) / 800.0 * 2.0 * PI;
    int panOffset = sin(phase) * 35;
    int tiltOffset = cos(phase) * 20;
    setServoAngles(PAN_CENTER + panOffset, TILT_CENTER + tiltOffset);

  } else if (currentAction == "nod") {
    if (elapsed > 1800) {
      isActionActive = false;
      setServoAngles(PAN_CENTER, TILT_CENTER);
      return;
    }
    float phase = (elapsed % 600) / 600.0 * 2.0 * PI;
    int tiltOffset = sin(phase) * 25;
    setServoAngles(PAN_CENTER, TILT_CENTER + tiltOffset);

  } else if (currentAction == "shake") {
    if (elapsed > 1800) {
      isActionActive = false;
      setServoAngles(PAN_CENTER, TILT_CENTER);
      return;
    }
    float phase = (elapsed % 500) / 500.0 * 2.0 * PI;
    int panOffset = sin(phase) * 30;
    setServoAngles(PAN_CENTER + panOffset, TILT_CENTER);

  } else if (currentAction == "look_left") {
    if (elapsed < 1200) {
      setServoAngles(135, TILT_CENTER);
    } else {
      isActionActive = false;
      setServoAngles(PAN_CENTER, TILT_CENTER);
    }

  } else if (currentAction == "look_right") {
    if (elapsed < 1200) {
      setServoAngles(45, TILT_CENTER);
    } else {
      isActionActive = false;
      setServoAngles(PAN_CENTER, TILT_CENTER);
    }

  } else if (currentAction == "look_center") {
    setServoAngles(PAN_CENTER, TILT_CENTER);
    isActionActive = false;

  } else if (currentAction == "wave") {
    if (elapsed > 2200) {
      isActionActive = false;
      setServoAngles(PAN_CENTER, TILT_CENTER);
      return;
    }
    float phase = (elapsed % 450) / 450.0 * 2.0 * PI;
    setServoAngles(PAN_CENTER + sin(phase) * 20, TILT_CENTER + cos(phase) * 15);

  } else if (currentAction == "wiggle") {
    if (elapsed > 1600) {
      isActionActive = false;
      setServoAngles(PAN_CENTER, TILT_CENTER);
      return;
    }
    float phase = (elapsed % 200) / 200.0 * 2.0 * PI;
    setServoAngles(PAN_CENTER + sin(phase) * 18, TILT_CENTER);
  }
}

// ==========================================
// OLED FACE RENDERING
// ==========================================
void drawFace(const String& em) {
  display.clearDisplay();

  int leftEyeX = 36;
  int rightEyeX = 92;
  int eyeY = 32;

  if (em == "happy") {
    // Curved upward arcs
    display.drawCircle(leftEyeX, eyeY + 4, 16, SSD1306_WHITE);
    display.fillRect(leftEyeX - 18, eyeY + 4, 36, 18, SSD1306_BLACK);
    display.drawCircle(rightEyeX, eyeY + 4, 16, SSD1306_WHITE);
    display.fillRect(rightEyeX - 18, eyeY + 4, 36, 18, SSD1306_BLACK);
  } else if (em == "sad") {
    display.drawCircle(leftEyeX, eyeY - 4, 16, SSD1306_WHITE);
    display.fillRect(leftEyeX - 18, eyeY - 20, 36, 18, SSD1306_BLACK);
    display.drawCircle(rightEyeX, eyeY - 4, 16, SSD1306_WHITE);
    display.fillRect(rightEyeX - 18, eyeY - 20, 36, 18, SSD1306_BLACK);
  } else if (em == "angry") {
    display.fillCircle(leftEyeX, eyeY, 12, SSD1306_WHITE);
    display.fillCircle(rightEyeX, eyeY, 12, SSD1306_WHITE);
    display.drawLine(leftEyeX - 14, eyeY - 14, leftEyeX + 14, eyeY - 4, SSD1306_BLACK);
    display.drawLine(rightEyeX - 14, eyeY - 4, rightEyeX + 14, eyeY - 14, SSD1306_BLACK);
  } else if (em == "sleepy") {
    display.drawFastHLine(leftEyeX - 14, eyeY, 28, SSD1306_WHITE);
    display.drawFastHLine(rightEyeX - 14, eyeY, 28, SSD1306_WHITE);
    display.setCursor(96, 12);
    display.setTextSize(1);
    display.print("Zzz");
  } else if (em == "surprised") {
    display.drawCircle(leftEyeX, eyeY, 16, SSD1306_WHITE);
    display.drawCircle(rightEyeX, eyeY, 16, SSD1306_WHITE);
    display.drawCircle(64, 48, 5, SSD1306_WHITE);
  } else if (em == "confused") {
    display.fillCircle(leftEyeX, eyeY - 4, 12, SSD1306_WHITE);
    display.drawFastHLine(rightEyeX - 12, eyeY + 4, 24, SSD1306_WHITE);
    display.setCursor(60, 10);
    display.setTextSize(1);
    display.print("?");
  } else { // neutral
    display.fillRoundRect(leftEyeX - 10, eyeY - 12, 20, 24, 8, SSD1306_WHITE);
    display.fillRoundRect(rightEyeX - 10, eyeY - 12, 20, 24, 8, SSD1306_WHITE);
  }

  display.display();
}

void updateDisplayScreen() {
  if (displayMode == "face") {
    drawFace(currentEmotion);
    return;
  }

  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(8, 8);
  display.println("ROBO PET MONITOR");
  display.drawFastHLine(0, 20, 128, SSD1306_WHITE);

  display.setCursor(8, 28);
  if (displayMode.indexOf("temp") >= 0) {
    display.setTextSize(2);
    display.print("24.8 C");
  } else if (displayMode.indexOf("dist") >= 0) {
    int dist = readUltrasonicDistance();
    display.setTextSize(2);
    display.print(dist);
    display.print(" cm");
  } else {
    display.setTextSize(1);
    display.println("Mode: Active");
    display.setCursor(8, 44);
    display.print("Emotion: ");
    display.print(currentEmotion);
  }

  display.display();
}

// ==========================================
// SENSORS & TELEMETRY
// ==========================================
int readUltrasonicDistance() {
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);

  long duration = pulseIn(PIN_ECHO, HIGH, 25000); // 25ms timeout (~4m)
  if (duration == 0) return 40; // Default fallback
  int distCm = duration * 0.034 / 2;
  return constrain(distCm, 2, 300);
}

void emitTelemetry() {
  int distanceCm = readUltrasonicDistance();
  // Ambient temperature (simulated or read from sensor)
  float tempC = 24.5 + (random(-5, 5) / 10.0);
  int batteryPct = 88;

  StaticJsonDocument<192> doc;
  doc["type"] = "telemetry";
  doc["temp"] = tempC;
  doc["dist"] = distanceCm;
  doc["battery"] = batteryPct;
  doc["emotion"] = currentEmotion;

  serializeJson(doc, Serial);
  Serial.println();
}

// ==========================================
// AUDIO SYNTHESIZER
// ==========================================
void playChirp(int freq, int durationMs) {
  tone(PIN_BUZZER, freq, durationMs);
}

void playAlertTone() {
  for (int i = 0; i < 3; i++) {
    playChirp(1000, 120);
    delay(80);
    playChirp(1500, 150);
    delay(100);
  }
}
