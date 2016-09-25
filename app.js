var noble = require('noble')
var keypress = require('keypress')

const sBrickCharacteristic = '02b8cbcc0e254bda8790a15f53e6010f'
const remoteControlCharacteristic = '4dc591b0857c41deb5f115abda665b0c'
const FORWARD           = 1
const BACKWARD          = 0
const DRIVE_SPEED       = [0,160,170,180,190,200,210,220]
const RSSI_THRESHOLD    = -90
const EXIT_GRACE_PERIOD = 2000  // milliseconds
const INTERVAL          = 100   // milliseconds

var speedIndex = 0
var peripherals = []
var characteristicsArray = []
var remoteControl
var inRange = []
var speed = 0
var direction = FORWARD
var lights = 0

var increaseSpeed = function() {
  if (speedIndex < DRIVE_SPEED.length - 1) {
    speedIndex++
  }
  speed = DRIVE_SPEED[speedIndex]
}
var decreaseSpeed = function() {
  if (speedIndex > 0) {
    speedIndex--
  }
  speed = DRIVE_SPEED[speedIndex]
}

var stop = function() {
  speedIndex = 0
  speed = DRIVE_SPEED[speedIndex]
}

// Initialize keypress
keypress(process.stdin)
process.stdin.setRawMode(true)
process.stdin.resume()
process.stdin.setEncoding('utf-8')

// listen for the "keypress" event
process.stdin.on('keypress', function (ch, key) {
  // console.log('got "keypress"', key);
  if(key){
    if(key.name === 'x') {
      stop()
    }
    if(key.name === 'up' && direction === FORWARD) {
      increaseSpeed()
    }
    if(key.name === 'w' && speedIndex === 0) {
      direction = FORWARD
    }
    if(key.name === 'down' && direction === BACKWARD){
      decreaseSpeed()
    }
    if(key.name === 's' && speedIndex === 0){
      direction = BACKWARD
    }
    if(key.name === 'l'){
      toggleLights(remoteControl)
    }
    if (key.sequence == '\u0003' || (key.ctrl && key.name === 'c')) { process.exit(); }    // ctrl-c
  }
});

noble.on('stateChange', function(state){
  console.log(state)
  if(state === 'poweredOn') {
    noble.startScanning([], true)
  } else if(state === 'poweredOff'){
    noble.stopScanning()
  }
  else {
    // Something else happened
    console.log(state)
  }
})

noble.on('scanStart', function(){
  console.log('Started scanning')
})

noble.on('scanStop', function(){
  console.log('Stopped scanning')
})

noble.on('discover', function(peripheral) {
  if (peripheral.rssi < RSSI_THRESHOLD) {
    // ignore
    return;
  }

  var id = peripheral.id;
  var entered = !inRange[id];

  if (entered) {
    inRange[id] = {
      peripheral: peripheral
    };

    console.log('"' + peripheral.advertisement.localName + '" entered (RSSI ' + peripheral.rssi + ') ' + new Date());
    if(peripheral.advertisement.localName === 'SBrick'){
      console.log('Found an SBrick with RSSI strength: ' + peripheral.rssi)
      console.log('Connecting to SBrick')
      peripheral.connect(function(error) {
        console.log('connected to peripheral: ' + peripheral.uuid);

        peripheral.discoverAllServicesAndCharacteristics(function(error, services, characteristics){
          characteristics.forEach(function(characteristic){
            characteristicsArray[characteristic.uuid] = characteristic
          })
          remoteControl = characteristicsArray[sBrickCharacteristic]
          remoteControl.notify(true,displayError)
          console.log('Fetched remote control characteristic', remoteControl)

          console.log('Watchdog timer is ', getWatchdogTimer(remoteControl))
          console.log('Thermal limit is ', getThermalLimit(remoteControl))

          setInterval(function() {
            // console.log('In main loop')
            drive(remoteControl,direction,speed)
          },INTERVAL)
        })
      });
    }
  }

  inRange[id].lastSeen = Date.now();
});


setInterval(function() {
  for (var id in inRange) {
    if (inRange[id].lastSeen < (Date.now() - EXIT_GRACE_PERIOD)) {
      var peripheral = inRange[id].peripheral;

      console.log('"' + peripheral.advertisement.localName + '" exited (RSSI ' + peripheral.rssi + ') ' + new Date());

      delete inRange[id];
    }
  }
}, EXIT_GRACE_PERIOD / 2);

// Push a break command to the sbrick
var driveBreak = function(remote){
  var command = new Buffer([00,00],'hex')
  remote.write(command,true, displayError)
  remote.read(function(error,data){
    return data
  })
}

// Push a drive command to the sbrick
var drive = function(remote, direction, speed){
  var command = new Buffer([01,00,direction,speed],'hex')
  remote.write(command,true, displayError)
  remote.read(function(error,data){
    return data
  })
}

// Toggle lights. TODO: Get channel from input, instead of hard coded into this function.
var toggleLights = function(remote){
  if(lights === 0) {
    lights = 255
  } else {
    lights = 0
  }
  var command = new Buffer([01,03,00,lights],'hex')
  remote.write(command,true, displayError)
  remote.read(function(error,data){
    return data
  })
}

var getWatchdogTimer = function(remote){
  console.log('In getWatchdogTimer')
  var command = new Buffer('0E','hex')
  remote.write(command,false, displayError)
  remote.read(function(error,data){
    console.log('WatchdogTimer is ', data)
    return data
  })
}

var getThermalLimit = function(remote){
  console.log('In getThermalLimit')
  var command = new Buffer('15','hex')
  return remote.write(command,false, displayError)
}

var displayError = function(error){
  if(error){
    console.log('ERROR: ' , error)
  }
}

var getChannelStatus = function(remote){
  var command = new Buffer('22','hex')
  remote.write(command,false, displayError)
  remote.read(function(error,data){
    console.log('Channel status: ', data)
    return data
  })
}
