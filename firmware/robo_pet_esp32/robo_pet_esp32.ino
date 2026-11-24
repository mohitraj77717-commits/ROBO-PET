/*
 * =========================================================================
 * ROBO PET — Complete ESP32 Hardware Firmware
 * =========================================================================
 * Hardware Components:
 *   - ESP32 Dev Module (WROOM-32)
 *   - SSD1306 128x64 OLED Display (I2C: SDA=GPIO 21, SCL=GPIO 22)
 *   - Dual SG90 Servos:
 *       * Pan  (Yaw / Left-Right): GPIO 18
 *       * Tilt (Pitch / Up-Down):  GPIO 19
 *   - Six Individual LEDs:
 *       * Red 1:   GPIO 25 | Red 2:   GPIO 26
 *       * Blue 1:  GPIO 27 | Blue 2:  GPIO 14
 *       * Green 1: GPIO 32 | Green 2: GPIO 33
 *   - Piezo Buzzer: GPIO 23
 *
 * Serial Communication: 115200 Baud, JSON protocol:
 *   {"type": "cmd", "emotion": "happy", "action": "dance"}
 *
 * (No sensors in final hardware. All sensor code removed).
 * =========================================================================
 */

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ESP32Servo.h>
#include <ArduinoJson.h>

// ==========================================
// PIN ASSIGNMENTS
// ==========================================
// Dual SG90 Servos
#define PIN_SERVO_PAN       18  // Pan / Yaw (horizontal rotation)
#define PIN_SERVO_TILT      19  // Tilt / Pitch (vertical rotation)

// Six Individual LEDs
#define PIN_LED_RED1        25
#define PIN_LED_RED2        26
#define PIN_LED_BLUE1       27
#define PIN_LED_BLUE2       14
#define PIN_LED_GREEN1      32
#define PIN_LED_GREEN2      33

// Audio Buzzer
#define PIN_BUZZER          23

// OLED Display (I2C)
#define OLED_SDA            21
#define OLED_SCL            22
#define SCREEN_WIDTH        128
#define SCREEN_HEIGHT       64
#define OLED_RESET          -1

// ==========================================
// SERVO MECHANICAL SAFETY LIMITS (SG90)
// ==========================================
#define PAN_MIN             15
#define PAN_MAX             165
#define PAN_CENTER          90

#define TILT_MIN            45
#define TILT_MAX            135
#define TILT_CENTER         90

// ==========================================
// GLOBAL HARDWARE OBJECTS & STATE
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
bool isActionActive = false;
unsigned long actionStartTime = 0;

// LED Blink & Pattern Timers
unsigned long lastLedUpdate = 0;
bool ledStateToggle = false;

// ==========================================
// FUNCTION PROTOTYPES
// ==========================================
// OLED Expression Functions
void showHappyFace();
void showSadFace();
void showAngryFace();
void showSleepyFace();
void showNeutralFace();
void showSurprisedFace();
void showConfusedFace();

// Movement Functions
void performDance();
void performNod();
void performShake();
void performLook();
void performWave();
void performWiggle();

// LED Functions
void setAllLEDs(bool r1, bool r2, bool b1, bool b2, bool g1, bool g2);
void updateLEDs();

// Buzzer Sound Functions
void playChirp(int freq, int durationMs);
void playHappySound();
void playSadSound();
void playAngrySound();
void playSurpriseAlert();
void playConfusedSound();
void playDanceSequence();

// Coordination Helpers
void setEmotion(const String& em);
void startMovement(const String& act);
void setServoAngles(int pan, int tilt);
void updateServoEasing();
void handleSerialCommand(const String& jsonStr);

// ==========================================
// SETUP
// ==========================================
void setup() {
  Serial.begin(115200);
  delay(300);

  // Configure LED pins
  pinMode(PIN_LED_RED1, OUTPUT);
  pinMode(PIN_LED_RED2, OUTPUT);
  pinMode(PIN_LED_BLUE1, OUTPUT);
  pinMode(PIN_LED_BLUE2, OUTPUT);
  pinMode(PIN_LED_GREEN1, OUTPUT);
  pinMode(PIN_LED_GREEN2, OUTPUT);

  // Turn off all LEDs initially
  setAllLEDs(false, false, false, false, false, false);

  // Configure Buzzer
  pinMode(PIN_BUZZER, OUTPUT);

  // Configure Servos (ESP32PWM allocated timers)
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  servoPan.setPeriodHertz(50);
  servoTilt.setPeriodHertz(50);
  servoPan.attach(PIN_SERVO_PAN, 500, 2400);
  servoTilt.attach(PIN_SERVO_TILT, 500, 2400);

  // Rest servos at neutral center
  setServoAngles(PAN_CENTER, TILT_CENTER);
  servoPan.write(PAN_CENTER);
  servoTilt.write(TILT_CENTER);

  // Initialize I2C OLED
  Wire.begin(OLED_SDA, OLED_SCL);
  if (display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    showNeutralFace();
  }

  // Initial LED pattern: neutral (green steady)
  setAllLEDs(false, false, false, false, true, true);

  // Startup audio chime
  playHappySound();

  // Send boot ready announcement to serial
  Serial.println("{\"type\":\"boot\",\"status\":\"ready\",\"device\":\"ROBO-PET-ESP32\",\"baud\":115200}");
}

// ==========================================
// MAIN LOOP (NON-BLOCKING)
// ==========================================
void loop() {
  // 1. Receive incoming serial JSON commands
  if (Serial.available() > 0) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.length() > 0) {
      handleSerialCommand(line);
    }
  }

  // 2. Smoothly step servos towards target angles
  updateServoEasing();

  // 3. Service active servo movement routine
  if (isActionActive) {
    if (currentAction == "dance")       performDance();
    else if (currentAction == "nod")    performNod();
    else if (currentAction == "shake")  performShake();
    else if (currentAction == "look")   performLook();
    else if (currentAction == "wave")   performWave();
    else if (currentAction == "wiggle") performWiggle();
  }

  // 4. Update LED pattern based on current emotion
  updateLEDs();
}

// ==========================================
// SERIAL COMMAND INTERPRETER
// ==========================================
void handleSerialCommand(const String& jsonStr) {
  StaticJsonDocument<384> doc;
  DeserializationError error = deserializeJson(doc, jsonStr);
  if (error) {
    return; // Ignore malformed serial lines
  }

  // 1. Extract emotion if present
  if (doc.containsKey("emotion")) {
    const char* em = doc["emotion"];
    if (em && strlen(em) > 0) {
      setEmotion(String(em));
    }
  }

  // 2. Extract action/movement if present
  if (doc.containsKey("action")) {
    const char* act = doc["action"];
    if (act && strlen(act) > 0 && strcmp(act, "null") != 0 && strcmp(act, "none") != 0) {
      startMovement(String(act));
    }
  }

  // 3. Handle alert event (e.g. timer expired)
  const char* type = doc["type"] | "cmd";
  if (strcmp(type, "alert") == 0) {
    playSurpriseAlert();
    showSurprisedFace();
    startMovement("wiggle");
  }

  // Confirm receipt to backend
  Serial.print("{\"type\":\"ack\",\"emotion\":\"");
  Serial.print(currentEmotion);
  Serial.print("\",\"action\":\"");
  Serial.print(currentAction);
  Serial.println("\"}");
}

// ==========================================
// EMOTION & EXPRESSION COORDINATOR
// ==========================================
void setEmotion(const String& em) {
  currentEmotion = em;

  if (em == "happy") {
    showHappyFace();
    playHappySound();
  } else if (em == "sad") {
    showSadFace();
    playSadSound();
  } else if (em == "angry") {
    showAngryFace();
    playAngrySound();
  } else if (em == "sleepy") {
    showSleepyFace();
  } else if (em == "surprised") {
    showSurprisedFace();
    playSurpriseAlert();
  } else if (em == "confused") {
    showConfusedFace();
    playConfusedSound();
  } else {
    showNeutralFace();
  }
}

// ==========================================
// A. OLED EXPRESSION FUNCTIONS (7 EMOTIONS)
// ==========================================
void showHappyFace() {
  display.clearDisplay();
  int leftEyeX = 36, rightEyeX = 92, eyeY = 32;

  // Upward smiling arcs
  display.drawCircle(leftEyeX, eyeY + 4, 16, SSD1306_WHITE);
  display.fillRect(leftEyeX - 18, eyeY + 4, 36, 18, SSD1306_BLACK);

  display.drawCircle(rightEyeX, eyeY + 4, 16, SSD1306_WHITE);
  display.fillRect(rightEyeX - 18, eyeY + 4, 36, 18, SSD1306_BLACK);

  // Blush dots
  display.fillCircle(leftEyeX - 16, eyeY + 14, 3, SSD1306_WHITE);
  display.fillCircle(rightEyeX + 16, eyeY + 14, 3, SSD1306_WHITE);
  display.display();
}

void showSadFace() {
  display.clearDisplay();
  int leftEyeX = 36, rightEyeX = 92, eyeY = 32;

  // Downward droopy eyes
  display.drawCircle(leftEyeX, eyeY - 4, 16, SSD1306_WHITE);
  display.fillRect(leftEyeX - 18, eyeY - 20, 36, 18, SSD1306_BLACK);

  display.drawCircle(rightEyeX, eyeY - 4, 16, SSD1306_WHITE);
  display.fillRect(rightEyeX - 18, eyeY - 20, 36, 18, SSD1306_BLACK);
  display.display();
}

void showAngryFace() {
  display.clearDisplay();
  int leftEyeX = 36, rightEyeX = 92, eyeY = 32;

  // Angled sharp brows and fierce eyes
  display.fillCircle(leftEyeX, eyeY, 13, SSD1306_WHITE);
  display.fillCircle(rightEyeX, eyeY, 13, SSD1306_WHITE);

  // Slanted brow cutouts
  display.drawLine(leftEyeX - 14, eyeY - 14, leftEyeX + 14, eyeY - 2, SSD1306_BLACK);
  display.drawLine(leftEyeX - 14, eyeY - 15, leftEyeX + 14, eyeY - 3, SSD1306_BLACK);
  display.drawLine(leftEyeX - 14, eyeY - 16, leftEyeX + 14, eyeY - 4, SSD1306_BLACK);

  display.drawLine(rightEyeX - 14, eyeY - 2, rightEyeX + 14, eyeY - 14, SSD1306_BLACK);
  display.drawLine(rightEyeX - 14, eyeY - 3, rightEyeX + 14, eyeY - 15, SSD1306_BLACK);
  display.drawLine(rightEyeX - 14, eyeY - 4, rightEyeX + 14, eyeY - 16, SSD1306_BLACK);
  display.display();
}

void showSleepyFace() {
  display.clearDisplay();
  int leftEyeX = 36, rightEyeX = 92, eyeY = 32;

  // Horizontal closed calm slits
  display.drawFastHLine(leftEyeX - 14, eyeY, 28, SSD1306_WHITE);
  display.drawFastHLine(leftEyeX - 14, eyeY + 1, 28, SSD1306_WHITE);

  display.drawFastHLine(rightEyeX - 14, eyeY, 28, SSD1306_WHITE);
  display.drawFastHLine(rightEyeX - 14, eyeY + 1, 28, SSD1306_WHITE);

  // Floating Zzz
  display.setTextSize(1);
  display.setCursor(94, 10);
  display.print("Zzz");
  display.display();
}

void showNeutralFace() {
  display.clearDisplay();
  int leftEyeX = 36, rightEyeX = 92, eyeY = 32;

  // Friendly rounded capsules
  display.fillRoundRect(leftEyeX - 10, eyeY - 12, 20, 24, 8, SSD1306_WHITE);
  display.fillRoundRect(rightEyeX - 10, eyeY - 12, 20, 24, 8, SSD1306_WHITE);
  display.display();
}

void showSurprisedFace() {
  display.clearDisplay();
  int leftEyeX = 36, rightEyeX = 92, eyeY = 30;

  // Wide circular eyes
  display.drawCircle(leftEyeX, eyeY, 16, SSD1306_WHITE);
  display.drawCircle(leftEyeX, eyeY, 15, SSD1306_WHITE);

  display.drawCircle(rightEyeX, eyeY, 16, SSD1306_WHITE);
  display.drawCircle(rightEyeX, eyeY, 15, SSD1306_WHITE);

  // Mouth O
  display.drawCircle(64, 48, 6, SSD1306_WHITE);
  display.display();
}

void showConfusedFace() {
  display.clearDisplay();
  int leftEyeX = 36, rightEyeX = 92, eyeY = 32;

  // Left eye arched round, right eye squinted
  display.fillCircle(leftEyeX, eyeY - 4, 12, SSD1306_WHITE);
  display.drawFastHLine(rightEyeX - 12, eyeY + 4, 24, SSD1306_WHITE);
  display.drawFastHLine(rightEyeX - 12, eyeY + 5, 24, SSD1306_WHITE);

  // Question mark
  display.setTextSize(1);
  display.setCursor(62, 8);
  display.print("?");
  display.display();
}

// ==========================================
// B. LED BEHAVIOUR & PATTERNS
// ==========================================
void setAllLEDs(bool r1, bool r2, bool b1, bool b2, bool g1, bool g2) {
  digitalWrite(PIN_LED_RED1, r1 ? HIGH : LOW);
  digitalWrite(PIN_LED_RED2, r2 ? HIGH : LOW);
  digitalWrite(PIN_LED_BLUE1, b1 ? HIGH : LOW);
  digitalWrite(PIN_LED_BLUE2, b2 ? HIGH : LOW);
  digitalWrite(PIN_LED_GREEN1, g1 ? HIGH : LOW);
  digitalWrite(PIN_LED_GREEN2, g2 ? HIGH : LOW);
}

void updateLEDs() {
  unsigned long now = millis();

  if (currentEmotion == "happy") {
    // Green LEDs steady ON
    setAllLEDs(false, false, false, false, true, true);

  } else if (currentEmotion == "sad") {
    // Blue LEDs slow blinking (period 1000ms: 500ms ON, 500ms OFF)
    if (now - lastLedUpdate >= 500) {
      lastLedUpdate = now;
      ledStateToggle = !ledStateToggle;
      setAllLEDs(false, false, ledStateToggle, ledStateToggle, false, false);
    }

  } else if (currentEmotion == "angry") {
    // Red LEDs rapid blinking (period 240ms: 120ms ON, 120ms OFF)
    if (now - lastLedUpdate >= 120) {
      lastLedUpdate = now;
      ledStateToggle = !ledStateToggle;
      setAllLEDs(ledStateToggle, ledStateToggle, false, false, false, false);
    }

  } else if (currentEmotion == "sleepy") {
    // Blue LEDs slow subtle alternate pattern (period 1200ms)
    if (now - lastLedUpdate >= 600) {
      lastLedUpdate = now;
      ledStateToggle = !ledStateToggle;
      setAllLEDs(false, false, ledStateToggle, !ledStateToggle, false, false);
    }

  } else if (currentEmotion == "surprised") {
    // Red and Green combination
    setAllLEDs(true, true, false, false, true, true);

  } else if (currentEmotion == "confused") {
    // Blue and Green combination
    setAllLEDs(false, false, true, true, true, true);

  } else {
    // Neutral: Green LEDs steady ON
    setAllLEDs(false, false, false, false, true, true);
  }
}

// ==========================================
// C. BUZZER SOUND SEQUENCES
// ==========================================
void playChirp(int freq, int durationMs) {
  tone(PIN_BUZZER, freq, durationMs);
}

void playHappySound() {
  playChirp(600, 60);
  delay(70);
  playChirp(880, 80);
  delay(90);
  playChirp(1200, 120);
}

void playSadSound() {
  playChirp(520, 100);
  delay(110);
  playChirp(380, 150);
}

void playAngrySound() {
  playChirp(260, 90);
  delay(100);
  playChirp(220, 120);
}

void playSurpriseAlert() {
  playChirp(900, 70);
  delay(80);
  playChirp(1400, 100);
}

void playConfusedSound() {
  playChirp(440, 60);
  delay(70);
  playChirp(660, 60);
  delay(70);
  playChirp(550, 90);
}

void playDanceSequence() {
  playChirp(650, 70);
  delay(80);
  playChirp(780, 70);
  delay(80);
  playChirp(980, 90);
}

// ==========================================
// D. SERVO MOTOR MOVEMENTS (6 ACTIONS)
// ==========================================
void setServoAngles(int pan, int tilt) {
  targetPan = constrain(pan, PAN_MIN, PAN_MAX);
  targetTilt = constrain(tilt, TILT_MIN, TILT_MAX);
}

void updateServoEasing() {
  // Non-blocking smooth step towards target angles
  if (currentPan != targetPan) {
    int step = (targetPan > currentPan) ? 1 : -1;
    currentPan += step;
    servoPan.write(currentPan);
    delayMicroseconds(1000);
  }
  if (currentTilt != targetTilt) {
    int step = (targetTilt > currentTilt) ? 1 : -1;
    currentTilt += step;
    servoTilt.write(currentTilt);
    delayMicroseconds(1000);
  }
}

void startMovement(const String& act) {
  // A new movement safely interrupts or replaces an ongoing movement
  currentAction = act;
  actionStartTime = millis();
  isActionActive = true;

  if (act == "dance") {
    playDanceSequence();
  } else if (act == "stop") {
    isActionActive = false;
    currentAction = "none";
    setServoAngles(PAN_CENTER, TILT_CENTER);
  }
}

// 1. Dance Routine
void performDance() {
  unsigned long elapsed = millis() - actionStartTime;
  if (elapsed > 3200) {
    isActionActive = false;
    currentAction = "none";
    setServoAngles(PAN_CENTER, TILT_CENTER);
    return;
  }
  float phase = (elapsed % 700) / 700.0 * 2.0 * PI;
  int panOffset = sin(phase) * 32;
  int tiltOffset = cos(phase) * 18;
  setServoAngles(PAN_CENTER + panOffset, TILT_CENTER + tiltOffset);
}

// 2. Nod Routine
void performNod() {
  unsigned long elapsed = millis() - actionStartTime;
  if (elapsed > 1600) {
    isActionActive = false;
    currentAction = "none";
    setServoAngles(PAN_CENTER, TILT_CENTER);
    return;
  }
  float phase = (elapsed % 500) / 500.0 * 2.0 * PI;
  int tiltOffset = sin(phase) * 22;
  setServoAngles(PAN_CENTER, TILT_CENTER + tiltOffset);
}

// 3. Shake Routine
void performShake() {
  unsigned long elapsed = millis() - actionStartTime;
  if (elapsed > 1600) {
    isActionActive = false;
    currentAction = "none";
    setServoAngles(PAN_CENTER, TILT_CENTER);
    return;
  }
  float phase = (elapsed % 450) / 450.0 * 2.0 * PI;
  int panOffset = sin(phase) * 28;
  setServoAngles(PAN_CENTER + panOffset, TILT_CENTER);
}

// 4. Look Routine (Curious look left, then right, then center)
void performLook() {
  unsigned long elapsed = millis() - actionStartTime;
  if (elapsed < 800) {
    setServoAngles(PAN_CENTER + 35, TILT_CENTER - 10); // Look left/up
  } else if (elapsed < 1600) {
    setServoAngles(PAN_CENTER - 35, TILT_CENTER + 10); // Look right/down
  } else if (elapsed < 2200) {
    setServoAngles(PAN_CENTER, TILT_CENTER);           // Center
  } else {
    isActionActive = false;
    currentAction = "none";
    setServoAngles(PAN_CENTER, TILT_CENTER);
  }
}

// 5. Wave Routine
void performWave() {
  unsigned long elapsed = millis() - actionStartTime;
  if (elapsed > 2000) {
    isActionActive = false;
    currentAction = "none";
    setServoAngles(PAN_CENTER, TILT_CENTER);
    return;
  }
  float phase = (elapsed % 400) / 400.0 * 2.0 * PI;
  setServoAngles(PAN_CENTER + sin(phase) * 20, TILT_CENTER + cos(phase) * 14);
}

// 6. Wiggle Routine
void performWiggle() {
  unsigned long elapsed = millis() - actionStartTime;
  if (elapsed > 1600) {
    isActionActive = false;
    currentAction = "none";
    setServoAngles(PAN_CENTER, TILT_CENTER);
    return;
  }
  float phase = (elapsed % 180) / 180.0 * 2.0 * PI;
  setServoAngles(PAN_CENTER + sin(phase) * 16, TILT_CENTER);
}
