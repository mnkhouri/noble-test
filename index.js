var cadence = require('cadence'),
    noble = require('noble');

noble.on('stateChange', function (state) {
    console.log(state)
    if (state == 'poweredOn') {
        var serviceUUIDs = [] // default: [] => all
        var allowDuplicates = false; // default: false
        noble.startScanning(serviceUUIDs, allowDuplicates, errorHandler); // particular UUID's
    }
});

noble.on('discover', discoverCb);

function errorHandler (error) {
    if (error) {
        console.log("ERROR!");
        console.log(error);
    }
}

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

function discoverCb (peripheral) {
    /*
    peripheral = {
        id: "<id>",
        address: "<BT address">, // Bluetooth Address of device, or 'unknown' if not known
        addressType: "<BT address type>", // Bluetooth Address type (public, random), or 'unknown' if not known
        connectable: <connectable>, // true or false, or undefined if not known
        advertisement: {
            localName: "<name>",
            txPowerLevel: <int>,
            serviceUuids: ["<service UUID>", ...],
            serviceSolicitationUuid: ["<service solicitation UUID>", ...],
            manufacturerData: <Buffer>,
            serviceData: [
                {
                    uuid: "<service UUID>"
                    data: <Buffer>
                },
                ...
            ]
        },
        rssi: <rssi>
    };
    */

    var printPeriph = {};
    var interestingChars = ['id', 'address', 'addressType', 'connectable', 'advertisement', 'rssi'];

    for (var i = 0; i < interestingChars.length; i++) {
        printPeriph[interestingChars[i]] = peripheral[interestingChars[i]];
    }
    console.log("Found peripheral");
    //console.log(printPeriph);

    var iBeaconData = parseIBeacon(peripheral.advertisement.manufacturerData)
    //if (iBeaconData) console.log(iBeaconData);
    if (iBeaconData && iBeaconData.uuid == '0112233445566778899aabbccddeeff0') {
        console.log('Found SWM!')
        console.log(printPeriph);
        //noble.stopScanning()
        //setTimeout(swmAction, 2000, peripheral, errorHandler)
        swmAction(peripheral, errorHandler)
    }
}

var swmAction = cadence(function (async, peripheral) {
    peripheral.connect((err) => {
        if (err) console.log("ERRRRRRR")
        else console.log("conncect cb")
    });
    peripheral.once('connect', function () {
        console.log('did connect')
        peripheral.discoverAllServicesAndCharacteristics(function(err, services, chars) {
            console.log('discoAllCb')
            console.log(err)
            console.log(services)
            console.log(chars)
        })
        /*peripheral.discoverServices([], function (services) {
            console.log('discoCb')
            console.log(services)
        })*/
    });
    peripheral.once('servicesDiscover', function(services) {
        console.log('got services')
        console.log(services)
    });
})

noble.on('scanStart', function () {console.log("scan start!")});
noble.on('scanStop', function () {console.log("scan stop!")});
noble.on('warning', function (warning) {console.log("warning!"); console.log(warning)});