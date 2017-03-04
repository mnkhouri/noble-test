var async = require('async');
var noble = require('noble');

//var peripheralIdOrAddress = process.argv[2].toLowerCase();

noble.on('stateChange', function(state) {
  if (state === 'poweredOn') {
    noble.startScanning();
  } else {
    noble.stopScanning();
  }
});

function parseIBeacon (manufacturerData) {
    if (!manufacturerData) {
        return null
    }

    /*
    4C 00 # Company identifier code (0x004C == Apple)
    02 # Byte 0 of iBeacon advertisement indicator
    15 # Byte 1 of iBeacon advertisement indicator
    e2 c5 6d b5 df fb 48 d2 b0 60 d0 f5 a7 10 96 e0 # iBeacon proximity uuid
    00 00 # major
    00 00 # minor
    c5 # The 2's complement of the calibrated Tx Power
     */

    var iBeaconData = {}
    iBeaconData.company = manufacturerData.readUInt16LE(0)
    iBeaconData.adv1 = manufacturerData.readUInt8(2)
    iBeaconData.adv2 = manufacturerData.readUInt8(3)

    if (iBeaconData.adv1 != 0x02 || iBeaconData.adv2 != 0x15) {
        // not an iBeacon
        return null;
    }

    iBeaconData.uuid = manufacturerData.toString('hex', 4, 20)
    iBeaconData.major = manufacturerData.readUInt16LE(21)
    iBeaconData.minor = manufacturerData.readUInt16LE(23)
    iBeaconData.txpow = manufacturerData.readInt8(24)

    return iBeaconData
}

noble.on('discover', function(peripheral) {
  //if (peripheral.id === peripheralIdOrAddress || peripheral.address === peripheralIdOrAddress) {

    console.log('peripheral with ID ' + peripheral.id + ' found');
    var advertisement = peripheral.advertisement;

    var localName = advertisement.localName;
    var txPowerLevel = advertisement.txPowerLevel;
    var manufacturerData = advertisement.manufacturerData;
    var serviceData = advertisement.serviceData;
    var serviceUuids = advertisement.serviceUuids;

    if (localName) {
      console.log('  Local Name        = ' + localName);
    }

    if (txPowerLevel) {
      console.log('  TX Power Level    = ' + txPowerLevel);
    }

    if (manufacturerData) {
      console.log('  Manufacturer Data = ' + manufacturerData.toString('hex'));
    }

    if (serviceData && serviceData.length > 0) {
      console.log('  Service Data      = ' + serviceData);
    }

    if (serviceUuids && serviceUuids.length > 0) {
      console.log('  Service UUIDs     = ' + serviceUuids);
    }

    console.log();

    var iBeaconData = parseIBeacon(manufacturerData)
    if (iBeaconData && iBeaconData.uuid == '0112233445566778899aabbccddeeff0') {
      noble.stopScanning();
      explore(peripheral);
    }
  //}
});

function explore(peripheral) {
  console.log('services and characteristics:');

  peripheral.on('disconnect', function() {
    process.exit(0);
  });

  peripheral.connect(function(error) {
    peripheral.discoverServices([], function(error, services) {
      var serviceIndex = 0;

      async.whilst(
        function () {
          return (serviceIndex < services.length);
        },
        function(callback) {
          var service = services[serviceIndex];
          var serviceInfo = service.uuid;

          if (service.name) {
            serviceInfo += ' (' + service.name + ')';
          }
          console.log(serviceInfo);

          service.discoverCharacteristics([], function(error, characteristics) {
            var characteristicIndex = 0;

            async.whilst(
              function () {
                return (characteristicIndex < characteristics.length);
              },
              function(callback) {
                var characteristic = characteristics[characteristicIndex];
                var characteristicInfo = '  ' + characteristic.uuid;

                if (characteristic.name) {
                  characteristicInfo += ' (' + characteristic.name + ')';
                }

                async.series([
                  function(callback) {
                    characteristic.discoverDescriptors(function(error, descriptors) {
                      async.detect(
                        descriptors,
                        function(descriptor, callback) {
                          return callback(descriptor.uuid === '2901');
                        },
                        function(userDescriptionDescriptor){
                          if (userDescriptionDescriptor) {
                            userDescriptionDescriptor.readValue(function(error, data) {
                              if (data) {
                                characteristicInfo += ' (' + data.toString() + ')';
                              }
                              callback();
                            });
                          } else {
                            callback();
                          }
                        }
                      );
                    });
                  },
                  function(callback) {
                        characteristicInfo += '\n    properties  ' + characteristic.properties.join(', ');

                    if (characteristic.properties.indexOf('read') !== -1) {
                      characteristic.read(function(error, data) {
                        if (data) {
                          var string = data.toString('ascii');

                          characteristicInfo += '\n    value       ' + data.toString('hex') + ' | \'' + string + '\'';
                        }
                        callback();
                      });
                    } else {
                      callback();
                    }
                  },
                  function() {
                    console.log(characteristicInfo);
                    characteristicIndex++;
                    callback();
                  }
                ]);
              },
              function(error) {
                serviceIndex++;
                callback();
              }
            );
          });
        },
        function (err) {
          peripheral.disconnect();
        }
      );
    });
  });
}