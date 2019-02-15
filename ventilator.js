var Ventilator = function(ventConfigObject) {
    /*
    Ventilator constructor
    takes an element name and gives it to the ventGraphics object to make several canvases and draw the ventilator
    starts a timer with a webworker
    starts a ventEngine which generates an array full of ventData
    calls the ventEngine for new data when the current array is almost empty
    calls the ventgraphics to draw the data

    exposes the ventGraphics object to allow adjustments
    transmits adjustmentObject to ventEngine to change vent settings

    */

    var myVentEngine = new Worker('ventEngine.js');
    var timerWebWorker = new Worker('timer.js');
    var adjustmentObject = {};
    var currentVentData = [];
    var ventDataCounter = 0;
    var lastVentDataCounter = 0;
    var oldTime = 0;
    var newTime = 0;
    var ventDataPending = false;
    var thisVent = this;
    this.stopped = false;

 
 


    function ventLoop() {
        //calls each ventGraphicsObjects drawgraphics method
        //calculates out how many ms have passed to get the right data point
        newTime = Date.now();
        var timeDifference = newTime - oldTime;
        if (ventDataCounter === 0) {
            timeDifference = 1;
        }

        if (timeDifference > 200) {
            //if something pauses the vent this is to prevent an overflow on the time difference if vent paused for too long
            timeDifference = 100;
        }


        ventDataCounter += timeDifference;
        oldTime = newTime;

        var basicVentData = currentVentData[ventDataCounter];
        var patientVentData = basicVentData.patientVentData;
        var ventSettingsVentData = basicVentData.ventSettings;
        var ventAlarmVentData = basicVentData.alarms;

        var ventDataObject = {
            volume: basicVentData.volume,
            pressure: basicVentData.pressure,
            flow:  basicVentData.flow,
            patientPressure: patientVentData.patientBreathPressure,
            count: basicVentData.count,
            time: basicVentData.time,
            //ventSettings
            patientBreath: ventSettingsVentData.patientBreath,
            machineBreath: ventSettingsVentData.machineBreath,
            breathTarget: ventSettingsVentData.target,
            ventMode: ventSettingsVentData.mode,
            //patientData
            plateauPressure: patientVentData.plateauPressure,
            expiratoryPressure: patientVentData.expiratoryPressure,
            peakPressure: patientVentData.peakPressure,
            respiratoryRate: patientVentData.respiratoryRate,
            Vte: patientVentData.Vte,
            ItoE: patientVentData.ItoE,
            minuteVentilation: patientVentData.minuteVentilation,
            //alarms
            peakPressureAlarm: ventAlarmVentData.peakPressureAlarm,

        };


        thisVent.ventGraphics.drawGraphics(ventDataObject);

        if (((currentVentData.length - ventDataCounter) < 1000) && (!ventDataPending)) { //when only 1000 data points are left
            ventDataPending = true;
            myVentEngine.postMessage(
                adjustmentObject);
            adjustmentObject = {};
        }
        
           //exposing instance variables - done here so that they're updated
    thisVent.currentVentData = currentVentData; //the array filled with the ventilator data
    thisVent.ventDataCounter = ventDataCounter; //position at which we are graphing
    thisVent.timerWebWorker = timerWebWorker;
    

    }


    thisVent.ventGraphics = new VentGraphics(ventConfigObject);

    myVentEngine.addEventListener('message', function(e) {
        
        console.log("first data payload");
        //gets the data from the ventilator Web Worker
        // clears the old array upto the current point in order to save memory
        //concatenates the new array to the old one
        //start the ventLoop if the ventilator is just starting newly

        for (var counter = lastVentDataCounter; counter < ventDataCounter; counter++) { // clearing the array of old stuff
            currentVentData[counter] = undefined;
        }

        currentVentData = currentVentData.concat(e.data.ventDataArray);

        ventDataPending = false;

    }, false);

    timerWebWorker.addEventListener('message', function(e) {
        ventLoop();
    }, false);

    myVentEngine.postMessage({}); //start the ventEngine

    timerWebWorker.postMessage('start');


    thisVent.changeBreathTarget = function(newTarget) {
        adjustmentObject.target = newTarget;
    };

    thisVent.changeFlowWaveForm = function(newWaveForm) {
        adjustmentObject.flowWaveForm = newWaveForm;
    };

    thisVent.changeVolumeSet = function(newVolume) {
        adjustmentObject.TV = newVolume;
    };

    thisVent.changePEEP = function(newPEEP) {
        adjustmentObject.PEEP = newPEEP;
    };

    thisVent.changeMode = function(newMode) {
        adjustmentObject.Mode = newMode;
    };

    thisVent.changeDrivingPressure = function(newDrivingPressure) {
        adjustmentObject.DrivingPressure = newDrivingPressure;
    };
    thisVent.changeInspiratoryTime = function(newInspiratoryTime) {
        adjustmentObject.inspiratoryTime = newInspiratoryTime;
    };

    thisVent.changeMachineRate = function(newMachineRate) {
        adjustmentObject.machineRate = newMachineRate;
    };

    thisVent.changeMaxFlowRate = function(newMaxFlowRate) {
        adjustmentObject.maxFlowRate = newMaxFlowRate;
    };

    thisVent.changePatientRate = function(newPatientRate) {
        adjustmentObject.patientRate = newPatientRate;
    };

    thisVent.requestPlateau = function(requestPlateau) {
        adjustmentObject.plateauRequested = true;
    };

    thisVent.requestExpiratoryPause = function(requestExpiratoryPause) {
        adjustmentObject.expiratoryPauseRequested = true;
    };

    thisVent.changePatientBreathDuration = function(newPatientBreathDuration) {
        adjustmentObject.patientBreathDuration = newPatientBreathDuration;
    };


    thisVent.changePatientBreathDepth = function(newPatientBreathDepth) {
        adjustmentObject.patientBreathDepth = newPatientBreathDepth;
    };

    thisVent.changeLungCompliance = function(newLungCompliance) {
        adjustmentObject.lungCompliance = newLungCompliance;
    };

    thisVent.changeETTResistance = function(newETTResistance) {
        adjustmentObject.ETTResistance = newETTResistance;
    };

    thisVent.startPatientBreath = function() {
        adjustmentObject.startPatientBreath = true;
    };




};
