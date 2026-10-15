
#include <Servo.h>

const int RED_LED = 2;
const int BLUE_LED = 4;
const int GREEN_LED = 3;

const int GREEN_BUTTON = 6;
const int BLUE_BUTTON = 5;
const int RED_BUTTON = 7;

const int RELAY_PIN = 8;

const int LPWM = 9;
const int RPWM = 10;

const int SERVO_PIN = 11;

const int ECHO_PIN = 12;
const int TRIG_PIN = 13;

const float EMPTY_DISTANCE = 70.0;
const float FULL_DISTANCE = 40.0;
const float FULL_THRESHOLD = 40.0;

const int RELEASE_MIN_FILL = 0;

const unsigned long ACTUATOR_TIME = 28000UL;
const unsigned long DETECT_TIME = 5000UL;
const unsigned long BUTTON_DEBOUNCE = 50UL;
const unsigned long ULTRASONIC_INTERVAL = 500UL;

const int DOOR_CLOSED = 90;
const int DOOR_OPEN = 180;

const int ACTUATOR_SPEED = 255;

Servo doorServo;

bool systemActive = false;
bool manualMotorMode = false;
bool relayRunning = false;
bool detectMotorActive = false;

bool doorOpen = false;
bool compartmentFull = false;
bool automaticRelease = false;

bool actuatorExtending = false;
bool actuatorRetracting = false;

int fillLevel = 0;

unsigned long detectStartTime = 0;
unsigned long actuatorStartTime = 0;
unsigned long lastUltrasonicCheck = 0;

bool lastRedReading = HIGH;
bool lastBlueReading = HIGH;
bool lastGreenReading = HIGH;

bool redStableState = HIGH;
bool blueStableState = HIGH;
bool greenStableState = HIGH;

unsigned long redLastChange = 0;
unsigned long blueLastChange = 0;
unsigned long greenLastChange = 0;

void setup() {
  Serial.begin(9600);

  pinMode(RED_LED, OUTPUT);
  pinMode(BLUE_LED, OUTPUT);
  pinMode(GREEN_LED, OUTPUT);

  pinMode(RED_BUTTON, INPUT_PULLUP);
  pinMode(BLUE_BUTTON, INPUT_PULLUP);
  pinMode(GREEN_BUTTON, INPUT_PULLUP);

  pinMode(RELAY_PIN, OUTPUT);

  pinMode(LPWM, OUTPUT);
  pinMode(RPWM, OUTPUT);

  pinMode(ECHO_PIN, INPUT);
  pinMode(TRIG_PIN, OUTPUT);

  digitalWrite(RED_LED, LOW);
  digitalWrite(BLUE_LED, LOW);
  digitalWrite(GREEN_LED, LOW);

  digitalWrite(RELAY_PIN, LOW);

  analogWrite(LPWM, 0);
  analogWrite(RPWM, 0);

  digitalWrite(TRIG_PIN, LOW);

  doorServo.attach(SERVO_PIN);
  doorServo.write(DOOR_CLOSED);

  delay(500);

  Serial.println("DRAINLIFT READY");
  Serial.println("SYSTEM:STOPPED");
  Serial.println("DOOR:CLOSED");
  Serial.println("ACTUATOR:STOPPED");
}

void loop() {
  checkButtons();

  if (systemActive) {
    monitorUltrasonic();
  }

  updateDetectMotor();
  updateAutomaticRelease();
  processSerial();
  updateLEDs();

  delay(10);
}

void checkButtons() {
  bool redReading = digitalRead(RED_BUTTON);
  bool blueReading = digitalRead(BLUE_BUTTON);
  bool greenReading = digitalRead(GREEN_BUTTON);

  if (redReading != lastRedReading) {
    redLastChange = millis();
    lastRedReading = redReading;
  }

  if (millis() - redLastChange > BUTTON_DEBOUNCE) {
    if (redReading != redStableState) {
      redStableState = redReading;

      if (redStableState == LOW) {
        systemActive = !systemActive;

        if (systemActive) {
          Serial.println("SYSTEM:ACTIVE");
          checkCompartment();
        } else {
          stopEverything();
          Serial.println("SYSTEM:STOPPED");
        }
      }
    }
  }

  if (blueReading != lastBlueReading) {
    blueLastChange = millis();
    lastBlueReading = blueReading;
  }

  if (millis() - blueLastChange > BUTTON_DEBOUNCE) {
    if (blueReading != blueStableState) {
      blueStableState = blueReading;

      if (blueStableState == LOW && systemActive) {
        if (doorOpen) {
          closeDoor();
        } else {
          openDoor();
        }
      }
    }
  }

  if (greenReading != lastGreenReading) {
    greenLastChange = millis();
    lastGreenReading = greenReading;
  }

  if (millis() - greenLastChange > BUTTON_DEBOUNCE) {
    if (greenReading != greenStableState) {
      greenStableState = greenReading;

      if (greenStableState == LOW && systemActive) {
        manualMotorMode = !manualMotorMode;

        if (manualMotorMode) {
          detectMotorActive = false;
          conveyorOn();
          Serial.println("MANUAL:MOTOR_ON");
        } else {
          conveyorOff();
          Serial.println("MANUAL:MOTOR_OFF");
        }
      }
    }
  }
}

void processSerial() {
  if (!Serial.available()) {
    return;
  }

  String command = Serial.readStringUntil('\n');
  command.trim();

  if (command == "SYSTEM_START") {
    systemStart();
  }
  else if (command == "SYSTEM_STOP") {
    systemStop();
  }
  else if (command == "DETECT") {
    garbageDetected();
  }
  else if (command == "RELAY_ON") {
    manualRelayOn();
  }
  else if (command == "RELAY_OFF") {
    manualRelayOff();
  }
  else if (command == "DOOR_OPEN") {
    if (systemActive) {
      openDoor();
    } else {
      Serial.println("DOOR:IGNORED_SYSTEM_OFF");
    }
  }
  else if (command == "DOOR_CLOSE") {
    if (systemActive) {
      closeDoor();
    } else {
      Serial.println("DOOR:IGNORED_SYSTEM_OFF");
    }
  }
  else if (command == "CHECK_COMPARTMENT") {
    checkCompartment();
  }
  else if (command == "RELEASE") {
    startAutomaticRelease();
  }
  else if (command == "ACTUATOR_EXTEND") {
    if (systemActive) {
      startActuatorExtend();
    } else {
      Serial.println("ACTUATOR:IGNORED_SYSTEM_OFF");
    }
  }
  else if (command == "ACTUATOR_RETRACT") {
    if (systemActive) {
      startActuatorRetract();
    } else {
      Serial.println("ACTUATOR:IGNORED_SYSTEM_OFF");
    }
  }
  else if (command == "ACTUATOR_STOP") {
    stopActuator();
  }
  else if (command == "STATUS") {
    sendStatus();
  }
  else {
    Serial.print("ERROR:UNKNOWN_COMMAND:");
    Serial.println(command);
  }
}

void systemStart() {
  systemActive = true;
  Serial.println("SYSTEM:ACTIVE");
  checkCompartment();
}

void systemStop() {
  systemActive = false;
  stopEverything();
  Serial.println("SYSTEM:STOPPED");
}

void stopEverything() {
  manualMotorMode = false;
  detectMotorActive = false;
  automaticRelease = false;

  conveyorOff();
  stopActuator();
  closeDoor();
}

void garbageDetected() {
  if (!systemActive) {
    Serial.println("DETECT:IGNORED_SYSTEM_OFF");
    return;
  }

  if (manualMotorMode) {
    Serial.println("DETECT:IGNORED_MANUAL_MODE");
    return;
  }

  if (automaticRelease) {
    Serial.println("DETECT:IGNORED_RELEASE_ACTIVE");
    return;
  }

  if (detectMotorActive) {
    Serial.println("DETECT:IGNORED_ALREADY_RUNNING");
    return;
  }

  conveyorOn();

  detectMotorActive = true;
  detectStartTime = millis();

  Serial.println("DETECT:ACCEPTED");
  Serial.println("DETECT:MOTOR_ON");
}

void updateDetectMotor() {
  if (!detectMotorActive) {
    return;
  }

  if (!systemActive || manualMotorMode) {
    detectMotorActive = false;
    conveyorOff();
    return;
  }

  if (millis() - detectStartTime >= DETECT_TIME) {
    detectMotorActive = false;
    conveyorOff();

    Serial.println("DETECT:MOTOR_OFF");
    Serial.println("DETECT:COMPLETE");
  }
}

void conveyorOn() {
  digitalWrite(RELAY_PIN, HIGH);
  relayRunning = true;
}

void conveyorOff() {
  digitalWrite(RELAY_PIN, LOW);
  relayRunning = false;
}

void manualRelayOn() {
  if (!systemActive) {
    Serial.println("RELAY:IGNORED_SYSTEM_OFF");
    return;
  }

  manualMotorMode = true;
  detectMotorActive = false;

  conveyorOn();
  Serial.println("RELAY:ON");
}

void manualRelayOff() {
  manualMotorMode = false;
  conveyorOff();
  Serial.println("RELAY:OFF");
}

void openDoor() {
  doorServo.write(DOOR_OPEN);
  doorOpen = true;
  Serial.println("DOOR:OPEN");
}

void closeDoor() {
  doorServo.write(DOOR_CLOSED);
  doorOpen = false;
  Serial.println("DOOR:CLOSED");
}

void monitorUltrasonic() {
  if (millis() - lastUltrasonicCheck < ULTRASONIC_INTERVAL) {
    return;
  }

  lastUltrasonicCheck = millis();
  updateFillLevel();
}

float getDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);

  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);

  digitalWrite(TRIG_PIN, LOW);

  unsigned long duration = pulseIn(ECHO_PIN, HIGH, 30000);

  if (duration == 0) {
    return -1;
  }

  return duration * 0.0343 / 2.0;
}

void updateFillLevel() {
  float distance = getDistance();

  if (distance <= 0) {
    return;
  }

  int previousFillLevel = fillLevel;

  if (distance >= EMPTY_DISTANCE) {
    fillLevel = 0;
  }
  else if (distance <= FULL_DISTANCE) {
    fillLevel = 100;
  }
  else {
    fillLevel = ((EMPTY_DISTANCE - distance) /
                 (EMPTY_DISTANCE - FULL_DISTANCE)) * 100.0;

    fillLevel = constrain(fillLevel, 0, 100);
  }

  if (fillLevel != previousFillLevel) {
    Serial.print("FILL_LEVEL:");
    Serial.print(fillLevel);
    Serial.println("%");
  }

  if (automaticRelease) {
    return;
  }

  bool previousFull = compartmentFull;
  compartmentFull = (distance <= FULL_THRESHOLD);

  if (compartmentFull && !previousFull) {
    Serial.println("COMPARTMENT:FULL");
  }
  else if (!compartmentFull && previousFull) {
    Serial.println("COMPARTMENT:NOT_FULL");
  }
}

void checkCompartment() {
  float distance = getDistance();

  if (distance <= 0) {
    Serial.println("ULTRASONIC:ERROR");
    return;
  }

  if (distance >= EMPTY_DISTANCE) {
    fillLevel = 0;
  }
  else if (distance <= FULL_DISTANCE) {
    fillLevel = 100;
  }
  else {
    fillLevel = ((EMPTY_DISTANCE - distance) /
                 (EMPTY_DISTANCE - FULL_DISTANCE)) * 100.0;

    fillLevel = constrain(fillLevel, 0, 100);
  }

  compartmentFull = (distance <= FULL_THRESHOLD);

  Serial.print("BIN_DISTANCE:");
  Serial.print(distance, 1);
  Serial.println("CM");

  Serial.print("FILL_LEVEL:");
  Serial.print(fillLevel);
  Serial.println("%");

  if (compartmentFull) {
    Serial.println("COMPARTMENT:FULL");
  } else {
    Serial.println("COMPARTMENT:NOT_FULL");
  }
}

void startAutomaticRelease() {
  if (!systemActive) {
    Serial.println("RELEASE:IGNORED_SYSTEM_OFF");
    return;
  }

  if (automaticRelease) {
    Serial.println("RELEASE:ALREADY_ACTIVE");
    return;
  }

  Serial.print("RELEASE:REQUESTED FILL=");
  Serial.print(fillLevel);
  Serial.println("%");

  if (fillLevel < RELEASE_MIN_FILL) {
    Serial.print("RELEASE:IGNORED_BELOW_50 FILL=");
    Serial.print(fillLevel);
    Serial.println("%");
    return;
  }

  conveyorOff();
  manualMotorMode = false;
  detectMotorActive = false;
  automaticRelease = true;

  Serial.println("RELEASE:STARTED");

  openDoor();
  delay(500);

  startActuatorRetract();
}

void updateAutomaticRelease() {
  if (!automaticRelease) {
    return;
  }

  if (actuatorRetracting) {
    if (millis() - actuatorStartTime >= ACTUATOR_TIME) {
      stopActuator();
      startActuatorExtend();
    }
  }
  else if (actuatorExtending) {
    if (millis() - actuatorStartTime >= ACTUATOR_TIME) {
      stopActuator();
      closeDoor();

      compartmentFull = false;
      fillLevel = 0;
      automaticRelease = false;

      Serial.println("FILL_LEVEL:0%");
      Serial.println("COMPARTMENT:NOT_FULL");
      Serial.println("RELEASE:COMPLETE");
    }
  }
}

void startActuatorExtend() {
  analogWrite(LPWM, ACTUATOR_SPEED);
  analogWrite(RPWM, 0);

  actuatorExtending = true;
  actuatorRetracting = false;
  actuatorStartTime = millis();

  Serial.println("ACTUATOR:EXTENDING");
}

void startActuatorRetract() {
  analogWrite(LPWM, 0);
  analogWrite(RPWM, ACTUATOR_SPEED);

  actuatorExtending = false;
  actuatorRetracting = true;
  actuatorStartTime = millis();

  Serial.println("ACTUATOR:RETRACTING");
}

void stopActuator() {
  analogWrite(LPWM, 0);
  analogWrite(RPWM, 0);

  actuatorExtending = false;
  actuatorRetracting = false;

  Serial.println("ACTUATOR:STOPPED");
}

void sendStatus() {
  Serial.print("FILL_LEVEL:");
  Serial.print(fillLevel);
  Serial.println("%");

  Serial.print("STATUS:SYSTEM=");
  Serial.print(systemActive ? "ACTIVE" : "STOPPED");

  Serial.print(",MOTOR=");
  Serial.print(relayRunning ? "ON" : "OFF");

  Serial.print(",DOOR=");
  Serial.print(doorOpen ? "OPEN" : "CLOSED");

  Serial.print(",COMPARTMENT=");
  Serial.print(compartmentFull ? "FULL" : "NOT_FULL");

  Serial.print(",ACTUATOR=");

  if (actuatorExtending) {
    Serial.println("EXTENDING");
  }
  else if (actuatorRetracting) {
    Serial.println("RETRACTING");
  }
  else {
    Serial.println("STOPPED");
  }
}

void updateLEDs() {
  digitalWrite(RED_LED, systemActive ? HIGH : LOW);
  digitalWrite(BLUE_LED, doorOpen ? HIGH : LOW);
  digitalWrite(GREEN_LED, manualMotorMode ? HIGH : LOW);
}
