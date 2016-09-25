# sbrick

Initial POC for an sbrick control program for NodeJS. When running, it will scan for bluetooth devices nearby. If it detects an sbrick it will connect to it automatically.

After connection, then app will listen to keyboard events and pass these along to the sbrick. The available commands are:
- up key: Increase speed if direction is FORWARD
- down key: Decrease speed if direction is BACKWARD
- w key: Set direction to FORWARD if speed is 0
- s key: Set direction to BACKWARD if speed is 0
- x key: Set speed to 0
