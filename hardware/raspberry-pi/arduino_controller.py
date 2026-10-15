import serial
import time
import threading
import requests

SERIAL_PORT = "/dev/ttyUSB0"
BAUD_RATE = 9600
SERIAL_TIMEOUT = 1

DRAINLIFT_API = "https://drainlift.onrender.com/api/sensor-reading"
NOTIFICATION_API = "https://drainlift.onrender.com/api/notification"
MOTOR_COMMAND_API = "https://drainlift.onrender.com/api/motor-command"

RELEASE_POLL_INTERVAL = 3
SEND_INTERVAL = 5
RELEASE_MAX_AGE_MS = 30000

last_release_id = None
last_motor_command_id = None
last_fill_sent_time = 0
bypass_active = False

arduino = None
serial_lock = threading.Lock()

system_active = False
motor_running = False
door_is_open = False
compartment_full = False
actuator_state = "STOPPED"
release_active = False
fill_level = 0

monitor_started = False


def connect_arduino():
    global arduino

    try:
        if arduino is not None:
            try:
                if arduino.is_open:
                    return True
            except Exception:
                pass

        print(f"Connecting to Arduino on {SERIAL_PORT}...")

        arduino = serial.Serial(
            SERIAL_PORT,
            BAUD_RATE,
            timeout=SERIAL_TIMEOUT
        )

        time.sleep(2)

        print(f"Arduino connected on {SERIAL_PORT}")

        return True

    except Exception as e:

        print(f"Arduino connection error: {e}")

        arduino = None

        return False


def send_command(command):
    global arduino

    with serial_lock:

        try:

            if arduino is None or not arduino.is_open:

                if not connect_arduino():
                    return False

            command = command.strip()

            arduino.write(
                (command + "\n").encode()
            )

            arduino.flush()

            print(f"Pi -> Arduino: {command}")

            return True

        except Exception as e:

            print(f"Serial send error: {e}")

            try:
                arduino.close()
            except Exception:
                pass

            arduino = None

            return False


def send_fill_level(level):
    global last_fill_sent_time

    try:

        level = int(level)

        response = requests.post(
            DRAINLIFT_API,
            json={
                "fillLevel": level
            },
            timeout=10
        )

        print(
            f"Backend fill update: "
            f"{level}% -> HTTP {response.status_code}"
        )

        last_fill_sent_time = time.time()

        return response.ok

    except Exception as e:

        print(f"Backend fill update error: {e}")

        return False


def process_arduino_message(message):

    global system_active
    global motor_running
    global door_is_open
    global compartment_full
    global actuator_state
    global release_active
    global fill_level

    message = message.strip()

    if not message:
        return

    print(f"Arduino: {message}")

    if message in ("SYSTEM:STARTED", "SYSTEM:ACTIVE"):

        system_active = True

    elif message == "SYSTEM:STOPPED":

        system_active = False
        motor_running = False
        release_active = False
        actuator_state = "STOPPED"

    elif message in ("MOTOR:ON", "DETECT:MOTOR_ON"):

        motor_running = True

    elif message in ("MOTOR:OFF", "DETECT:MOTOR_OFF"):

        motor_running = False

    elif message == "MOTOR:STOPPED_FULL":

        motor_running = False

    elif message == "MOTOR:BLOCKED_FULL":

        motor_running = False

    elif message == "DOOR:OPEN":

        door_is_open = True

    elif message == "DOOR:CLOSED":

        door_is_open = False

    elif message == "ACTUATOR:EXTENDING":

        actuator_state = "EXTENDING"

    elif message == "ACTUATOR:RETRACTING":

        actuator_state = "RETRACTING"

    elif message == "ACTUATOR:STOPPED":

        actuator_state = "STOPPED"

    elif message.startswith("FILL_LEVEL:"):

        try:

            value = (
                message
                .replace("FILL_LEVEL:", "")
                .replace("%", "")
                .strip()
            )

            fill_level = int(float(value))

            send_fill_level(fill_level)

        except ValueError:

            print(
                f"Invalid fill level message: {message}"
            )

    elif message == "COMPARTMENT:FULL":

        compartment_full = True

    elif message == "COMPARTMENT:NOT_FULL":

        compartment_full = False

    elif message == "RELEASE:STARTED":

        release_active = True

    elif message == "RELEASE:ACTIVE":

        release_active = True

    elif message == "RELEASE:INACTIVE":

        release_active = False

    elif message == "RELEASE:COMPLETE":

        release_active = False
        actuator_state = "STOPPED"

        print(
            "[RELEASE] Release completed."
        )

        send_command("CHECK_COMPARTMENT")

    elif message == "RELEASE:CANCELLED":

        release_active = False
        actuator_state = "STOPPED"

    elif message == "ULTRASONIC:ERROR":

        print(
            "[ULTRASONIC] Sensor error."
        )

    elif message.startswith("BIN_DISTANCE:"):

        print(
            f"[ULTRASONIC] {message}"
        )

    elif message.startswith("RELEASE:IGNORED_BELOW_50"):

        print(
            "[RELEASE] Rejected because fill level is below 50%."
        )


def check_release_command():

    global last_release_id
    global bypass_active

    try:

        response = requests.get(
            NOTIFICATION_API,
            timeout=10
        )

        if not response.ok:

            print(
                f"Release API HTTP error: "
                f"{response.status_code}"
            )

            return

        data = response.json()

        bypass_active = bool(
            data.get("fullOverrideActive")
        )

        released_at = data.get(
            "releasedAt"
        )

        released_by = data.get(
            "releasedBy"
        )

        if not released_at:
            return

        if released_at == last_release_id:
            return

        last_release_id = released_at

        server_time = data.get(
            "serverTime"
        )

        if (
            isinstance(server_time, (int, float))
            and isinstance(released_at, (int, float))
            and server_time - released_at > RELEASE_MAX_AGE_MS
        ):

            print(
                "[RELEASE] Old release request ignored."
            )

            return

        print(
            "[RELEASE] New website release command detected."
        )

        print(
            f"[RELEASE] releasedAt={released_at}"
        )

        print(
            f"[RELEASE] releasedBy={released_by}"
        )

        if send_command("RELEASE"):

            print(
                "[RELEASE] RELEASE sent to Arduino."
            )

        else:

            print(
                "[RELEASE] Failed to send RELEASE."
            )

    except requests.RequestException as e:

        print(
            f"Release polling network error: {e}"
        )

    except Exception as e:

        print(
            f"Release polling error: {e}"
        )


def check_motor_command():

    global last_motor_command_id

    try:

        response = requests.get(
            MOTOR_COMMAND_API,
            timeout=10
        )

        if not response.ok:

            print(
                f"[MOTOR] API HTTP error: "
                f"{response.status_code}"
            )

            return

        data = response.json()

        command = data.get("command")
        command_id = data.get("commandId")

        if not command:
            return

        if command_id == last_motor_command_id:
            return

        last_motor_command_id = command_id

        print(
            f"[MOTOR] New command received: {command}"
        )

        if command == "DETECT":

            print(
                "[MOTOR] Sending DETECT to Arduino"
            )

            if send_command("DETECT"):

                print(
                    "[MOTOR] DETECT sent successfully"
                )

            else:

                print(
                    "[MOTOR] Failed to send DETECT"
                )

    except requests.RequestException as e:

        print(
            f"[MOTOR] Polling network error: {e}"
        )

    except Exception as e:

        print(
            f"[MOTOR] Polling error: {e}"
        )


def release_monitor():

    global last_release_id

    print(
        "[RELEASE] Monitor started."
    )

    try:

        response = requests.get(
            NOTIFICATION_API,
            timeout=10
        )

        if response.ok:

            data = response.json()

            last_release_id = data.get(
                "releasedAt"
            )

            print(
                "[RELEASE] Existing release initialized: "
                f"{last_release_id}"
            )

    except Exception as e:

        print(
            f"[RELEASE] Initial release check error: {e}"
        )

    while True:

        try:

            check_release_command()

        except Exception as e:

            print(
                f"[RELEASE] Monitor error: {e}"
            )

        time.sleep(RELEASE_POLL_INTERVAL)


def motor_command_monitor():

    global last_motor_command_id

    print(
        "[MOTOR] Command monitor started."
    )

    try:

        response = requests.get(
            MOTOR_COMMAND_API,
            timeout=10
        )

        if response.ok:

            last_motor_command_id = response.json().get(
                "commandId"
            )

            print(
                "[MOTOR] Existing command initialized: "
                f"{last_motor_command_id}"
            )

    except Exception as e:

        print(
            f"[MOTOR] Initial command check error: {e}"
        )

    while True:

        try:

            check_motor_command()

        except Exception as e:

            print(
                f"[MOTOR] Monitor error: {e}"
            )

        time.sleep(3)


def serial_monitor():

    global arduino

    print(
        "[SERIAL] Arduino monitor started."
    )

    while True:

        try:

            if arduino is None or not arduino.is_open:

                if not connect_arduino():

                    time.sleep(3)

                    continue

            line = arduino.readline()

            if line:

                try:

                    message = line.decode(
                        "utf-8",
                        errors="ignore"
                    ).strip()

                    if message:

                        process_arduino_message(
                            message
                        )

                except Exception as e:

                    print(
                        f"Serial message error: {e}"
                    )

        except Exception as e:

            print(
                f"Serial monitor error: {e}"
            )

            try:
                arduino.close()
            except Exception:
                pass

            arduino = None

            time.sleep(3)


def start_monitors():

    global monitor_started

    if monitor_started:

        print(
            "Arduino monitors already started."
        )

        return

    monitor_started = True

    print(
        "Starting Arduino monitors..."
    )

    connect_arduino()

    serial_thread = threading.Thread(
        target=serial_monitor,
        daemon=True
    )

    serial_thread.start()

    release_thread = threading.Thread(
        target=release_monitor,
        daemon=True
    )

    release_thread.start()

    motor_thread = threading.Thread(
        target=motor_command_monitor,
        daemon=True
    )

    motor_thread.start()

    print(
        "Arduino monitors started."
    )


def system_start():
    return send_command("SYSTEM_START")


def system_stop():
    return send_command("SYSTEM_STOP")


def detect():
    return send_command("DETECT")


def garbage_detected():

    if bypass_active:

        print(
            "[YOLO] Bypass Mode ON -> automatic DETECT ignored"
        )

        return False

    print(
        "[YOLO] Garbage detected -> sending DETECT"
    )

    return detect()


def relay_on():
    return send_command("RELAY_ON")


def relay_off():
    return send_command("RELAY_OFF")


def door_open():
    return send_command("DOOR_OPEN")


def door_close():
    return send_command("DOOR_CLOSE")


def check_compartment():
    return send_command("CHECK_COMPARTMENT")


def release():
    return send_command("RELEASE")


def actuator_extend():
    return send_command("ACTUATOR_EXTEND")


def actuator_retract():
    return send_command("ACTUATOR_RETRACT")


def actuator_stop():
    return send_command("ACTUATOR_STOP")


def status():
    return send_command("STATUS")


def get_local_status():

    return {
        "system_active": system_active,
        "motor_running": motor_running,
        "door_open": door_is_open,
        "compartment_full": compartment_full,
        "fill_level": fill_level,
        "actuator": actuator_state,
        "release_active": release_active
    }


def print_local_status():

    data = get_local_status()

    print()
    print(
        "========== DRAINLIFT STATUS =========="
    )

    print(
        f"System:       "
        f"{'ACTIVE' if data['system_active'] else 'STOPPED'}"
    )

    print(
        f"Motor:        "
        f"{'RUNNING' if data['motor_running'] else 'OFF'}"
    )

    print(
        f"Door:         "
        f"{'OPEN' if data['door_open'] else 'CLOSED'}"
    )

    print(
        f"Fill level:   "
        f"{data['fill_level']}%"
    )

    print(
        f"Compartment:  "
        f"{'FULL' if data['compartment_full'] else 'NOT FULL'}"
    )

    print(
        f"Actuator:     "
        f"{data['actuator']}"
    )

    print(
        f"Release:      "
        f"{'ACTIVE' if data['release_active'] else 'INACTIVE'}"
    )

    print(
        "======================================="
    )

    print()


if __name__ == "__main__":

    print()
    print(
        "======================================="
    )
    print(
        "       DRAINLIFT ARDUINO CONTROL"
    )
    print(
        "======================================="
    )
    print()

    start_monitors()

    time.sleep(1)

    print()
    print("Commands:")
    print("  start       - SYSTEM_START")
    print("  stop        - SYSTEM_STOP")
    print("  detect      - DETECT")
    print("  relayon     - RELAY_ON")
    print("  relayoff    - RELAY_OFF")
    print("  open        - DOOR_OPEN")
    print("  close       - DOOR_CLOSE")
    print("  check       - CHECK_COMPARTMENT")
    print("  release     - RELEASE")
    print("  extend      - ACTUATOR_EXTEND")
    print("  retract     - ACTUATOR_RETRACT")
    print("  actuatoroff - ACTUATOR_STOP")
    print("  status      - STATUS")
    print("  local       - Show local Pi status")
    print("  quit        - Exit")
    print()

    while True:

        try:

            command = input(
                "drainlift> "
            ).strip().lower()

            if command == "start":

                system_start()

            elif command == "stop":

                system_stop()

            elif command == "detect":

                detect()

            elif command == "relayon":

                relay_on()

            elif command == "relayoff":

                relay_off()

            elif command == "open":

                door_open()

            elif command == "close":

                door_close()

            elif command == "check":

                check_compartment()

            elif command == "release":

                release()

            elif command == "extend":

                actuator_extend()

            elif command == "retract":

                actuator_retract()

            elif command == "actuatoroff":

                actuator_stop()

            elif command == "status":

                status()

            elif command == "local":

                print_local_status()

            elif command in ("quit", "exit"):

                print(
                    "Exiting controller..."
                )

                break

            elif command == "":

                continue

            else:

                print("Unknown command.")

        except KeyboardInterrupt:

            print()
            print("Controller stopped.")

            break

        except Exception as e:

            print(
                f"CLI error: {e}"
            )