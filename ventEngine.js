function VentEngine() {
  //the code that gives the ventilator results

  // calculations are done for every 1 ms
  // an array of values is returned
  //meant to be run as a webworker
  //in order not to slow down the graphics

  /*problem list:

    PEEP doesn't get to 0


    to do:
    place logic for setting changes to ensure OK setting changes.
    send message to vent graphics to update the data when modes change

    implement new naming system and modes
    http://www.rcjournal.com/guidelines_for_authors/preferred_nomenclature.cfm
    CMV, IMV, Spontaneous, APRV

    make patient breath abort if vent breath overwhelms with flow

    double breath with deep inspiration

    */

  //make it take a configuration object

  var ventLog = [];
  var secondsOfDataToGenerate = 1;
  var thisVent = this;
  this.dataArray = [];
  var dataArray = this.dataArray;

  var Timer = 0,
    patientBreathTime = 0,
    patientBreathTimer = 0,
    machineBreathTimer = 0,
    counter = 0,
    ventCounter = 0,
    //Ventilator Settings
    VentMode = 'CMV',
    BreathTarget = 'VC',
    machineFrequency = 8,
    //for PRVC modes
    volumeTarget = 400,
    testBreath = true,
    //common settings
    PEEP = 5,
    setFlowTrigger = -2, //L/min
    setPressureTrigger = -3, //cm
    triggerType = 'Flow';

  //VC settings
  thisVent.tidalVolumeSet = 525;
  var flowWaveForm = 'DescendingRamp';
  var maxInspiratoryFlow = 50, //HEREHEREHERE
    //PC settings
    drivingPressure = 30,
    inspiratoryTimeSet = 2,
    //PS settings
    drivingSupportPressure = 5,
    //System parameters
    lungVolume = 0, //volume above FRC
    //patient parameters
    patientInspiration = false,
    patientFrequency = 8,
    patientBreathPressure = 0, //pressure patient generates in the chest
    maxPatientBreathPressure = 20,
    patientInspiratoryTimeSet = 1,
    staticThoracicPressure = 0,
    dynamicPressure = 0,
    resistanceOfETT = 0.35,
    patientHeight = 70, //inches
    patientGender = 'Male';
  //calculate out ideal body weight and get the predicted lung volume from that
  //Males: IBW = 50 kg + 2.3 kg for each inch over 5 feet.
  //Females: IBW = 45.5 kg + 2.3 kg for each inch over 5 feet.
  var patientIBW;
  if (patientGender === 'Male') {
    patientIBW = 50 + (patientHeight - 60) * 2.3;
  } else {
    patientIBW = 45.5 + (patientHeight - 60) * 2.3;
  }

  var patientCompliantLungVolume = 12 * patientIBW; //volume after which the compliance drops rapidly
  var compliance = 0.04;
  var lowCompliance = compliance / 2;
  var normalCompliance = compliance;
  var cough = false;

  var cumulativePressure = 0, //for measuring mean pressure
    //Measurements
    //Measured volume is actually the flow measurement accumulated
    //In always means into the patient
    flowMeasuredOutflow = 0,
    flowMeasuredInflow = 0, //anything leaving the ventilator circuit - called inflow because usually into patient
    flowRequiredForPressure = 0, //flowRequired to maintain pressure in circuit in expiration
    pressureMeasured = 0,
    flowMeasured = 0, //general flow - negative means out of patient
    //measured volume  - basically just the flow by time
    volumeMeasured = 0, // different from lungVolume above because reset with each new breath
    //patient vent Data to be displayed
    Vte = 0,
    newBreath = false,
    volumeMeasuredOutflow = 0,
    peakPressure = 0,
    peakFlow = 0,
    peakPressureRecord = 0,
    breathVolumeArray = [],
    breathRateArray = [],
    breathRate = 0,
    minuteVentilation = 0,
    machineExpirationTimer = 0,
    ItoE = 0,
    meanPressure = 0,
    PRVCPressure = 0,
    machineInspiration = true;

  //vent alarms
  var peakPressureLimit = 55;
  var peakPressureAlarm = false;

  thisVent.plateauRequested = false; //expose plateauRequested
  var doPlateau; // part of plateau logic
  var plateauPressureMeasured = 0;
  var plateauPressure = 0;

  thisVent.expiratoryPauseRequested = false;
  var doExpiratoryPause = false;
  var expiratoryPressureMeasured = 0;

  var priorVentilatorFlow = 0; //place global

  var timeResolution = 0.001; //seconds. calculations are done for 1ms increments of time.

  function incrementTimers() {
    //timers incremented
    // incremented by a set amount

    Timer += timeResolution;
    patientBreathTimer += timeResolution;
    machineBreathTimer += timeResolution;
    machineExpirationTimer += timeResolution; //for calculation of I:E

    patientBreathTime += timeResolution;
    counter++;
  }

  function patientBreathController() {
    // the patient's brain

    if (patientInspiration && patientBreathTime > patientInspiratoryTimeSet) {
      //breath complete
      this.endPatientBreath();
    }

    if (!patientInspiration && patientBreathTimer >= 60 / patientFrequency) {
      //breath starts
      this.startPatientBreath();
    }

    this.endPatientBreath = function () {
      patientInspiration = false;
      patientBreathPressure = 0;
    };

    this.startPatientBreath = function () {
      patientInspiration = true;
      patientBreathTimer = 0;
      patientBreathTime = 0;
    };

    if (
      machineInspiration &&
      !patientInspiration &&
      60 / patientFrequency - patientBreathTimer < 60 / (8 * patientFrequency)
    ) {
      //if a machine breath occurs just prior to a set patient breath (by 1/8th of the time) the patient breath is aborted
      //patient timer is reset
      patientBreathTimer = 0;
      patientBreathTime = 0;
    }
  }

  function machineBreathController() {
    //should rename breathTarget strategy

    if (BreathTarget == 'PRVC' && testBreath) {
      //test breath cycling
      if (machineInspiration && volumeMeasured >= volumeTarget) {
        endOfInspiration();
      }
    } else if (BreathTarget == 'VC') {
      if (machineInspiration && volumeMeasured >= thisVent.tidalVolumeSet) {
        endOfInspiration();
      }
    } else if (BreathTarget == 'PC') {
      //time cycle
      if (machineInspiration && machineBreathTimer > inspiratoryTimeSet) {
        endOfInspiration();
      }
    } else if (BreathTarget == 'PS') {
      //flow cycle
      if (machineInspiration && flowMeasuredInflow < 0.1 * peakFlow) {
        endOfInspiration();
      }
    } else if (BreathTarget === 'PRVC' && !testBreath) {
      if (machineInspiration && machineBreathTimer > inspiratoryTimeSet) {
        endOfInspiration();
      }
    }

    //triggers

    //flow trigger
    if (
      triggerType === 'Flow' &&
      -1 * flowRequiredForPressure < setFlowTrigger
    ) {
      machineInspiration = true;
      newBreath = true;
      volumeMeasured = 0; //reset measured volume
    }

    //pressure trigger

    if (
      triggerType === 'Pressure' &&
      lungVolume * compliance + patientBreathPressure <
        setPressureTrigger + PEEP
    ) {
      machineInspiration = true;
      newBreath = true;
      volumeMeasured = 0; //reset measured volume
    }

    //machine trigger
    if (
      !machineInspiration &&
      machineBreathTimer >= 60 / machineFrequency &&
      BreathTarget != 'PS'
    ) {
      machineInspiration = true;
      newBreath = true;
      volumeMeasured = 0; //reset measured volume
    }

    if (VentMode == 'IMV') {
      //time trigger

      //just a hack so that IMV can keep the full mechanical breath target
      var IMVBreathTarget;
      if (BreathTarget === 'VC') {
        IMVBreathTarget = 'VC';
      } else if (BreathTarget === 'PC') {
        IMVBreathTarget = 'PC';
      }

      if (machineBreathTimer > 60 / machineFrequency - 2) {
        //in 2 second synchronization window for IMV mode
        //here set the breath target to the mandatory breath type
        //if new breath set it to mandatory type
        if (newBreath) {
          BreathTarget = IMVBreathTarget;
        }
      } else if (machineBreathTimer < 60 / machineFrequency) {
        //before 2 second window
        //here set the breath type to the spontaneous breath type
        //if new breath set it to spont type
        if (newBreath) {
          BreathTarget = 'PS';
        }
      }
    }

    //procedure to run once machine breath cycles
    function endOfInspiration() {
      machineInspiration = false;
      machineExpirationTimer = 0;
      priorVentilatorFlow = 0;
    }
  }

  function patientBreath() {
    //to add:
    //different breathing patterns (Kusmaull, Cheyne-Stokes, Apneustic, Ataxic)
    //forced exhalation
    //cough
    //hiccup
    //biting on tube?
    //place leaks and flow here?

    if (patientInspiration) {
      //patient breath formula here
      //  patientBreathPressure = 80 - 1 * Math.pow(((10 - 10 / (5 + 20 * Math.pow(((patientBreathTimer - 0.5) / 1.1), 2)))), 2);

      if (patientBreathTime / patientInspiratoryTimeSet < 0.5) {
        patientBreathPressure =
          (maxPatientBreathPressure * 2 * patientBreathTime) /
          patientInspiratoryTimeSet;
      } else {
        patientBreathPressure =
          (maxPatientBreathPressure *
            2 *
            (patientInspiratoryTimeSet - patientBreathTime)) /
          patientInspiratoryTimeSet;
      }

      patientBreathPressure = -1 * patientBreathPressure;
    }

    //leak
  }

  function machineBreath() {
    //provides the flow generated by the machine during inspiration
    //add pressure support breath, add volume targeted pressure control breath

    if (BreathTarget === 'VC') {
      if (flowWaveForm == 'DescendingRamp') {
        if (priorVentilatorFlow !== 0) {
          flowMeasuredInflow = priorVentilatorFlow * 0.999;
        } else {
          flowMeasuredInflow = maxInspiratoryFlow;
        }

        priorVentilatorFlow = flowMeasuredInflow;
      } else {
        //square wave
        flowMeasuredInflow = maxInspiratoryFlow;
      }
    } else if (BreathTarget === 'PC') {
      //increase flow until pressure applied is what is set

      staticThoracicPressure = lungVolume * compliance + patientBreathPressure;
      dynamicPressure = flowMeasuredInflow * resistanceOfETT;
      // increase flow until target pressure is reached
      while (
        staticThoracicPressure + dynamicPressure <
        drivingPressure + PEEP
      ) {
        flowMeasuredInflow += 0.01;
        dynamicPressure = flowMeasuredInflow * resistanceOfETT;
      }
      while (
        staticThoracicPressure + dynamicPressure >
        drivingPressure + PEEP
      ) {
        flowMeasuredInflow -= 0.01;
        dynamicPressure = flowMeasuredInflow * resistanceOfETT;
      }
    } //end PC
    else if (BreathTarget === 'PS') {
      //increase flow until pressure applied is what is set

      staticThoracicPressure = lungVolume * compliance + patientBreathPressure;
      dynamicPressure = flowMeasuredInflow * resistanceOfETT;
      // increase flow until target pressure is reached
      while (
        staticThoracicPressure + dynamicPressure <
        drivingSupportPressure + PEEP
      ) {
        flowMeasuredInflow += 0.01;
        dynamicPressure = flowMeasuredInflow * resistanceOfETT;
      }
      while (
        staticThoracicPressure + dynamicPressure >
        drivingSupportPressure + PEEP
      ) {
        flowMeasuredInflow -= 0.01;
        dynamicPressure = flowMeasuredInflow * resistanceOfETT;
      }
    } //end PS
    else if (BreathTarget === 'PRVC' && !testBreath) {
      staticThoracicPressure = lungVolume * compliance + patientBreathPressure;
      dynamicPressure = flowMeasuredInflow * resistanceOfETT;
      // increase flow until target pressure is reached
      while (staticThoracicPressure + dynamicPressure < PRVCPressure) {
        flowMeasuredInflow += 0.01;
        dynamicPressure = flowMeasuredInflow * resistanceOfETT;
      }
      while (staticThoracicPressure + dynamicPressure > PRVCPressure) {
        flowMeasuredInflow -= 0.01;
        dynamicPressure = flowMeasuredInflow * resistanceOfETT;
      }
    } else if (BreathTarget === 'PRVC' && testBreath) {
      flowMeasuredInflow = maxInspiratoryFlow;
    }
  }

  var expiration = function () {
    //is PEEP like CPAP where the patient gets as much gas as they want during the period when the machine is not giving a breath?
    // increase flow until target pressure - here PEEP - is reached
    //should be able to get as much flow as you want up to a maximum inspiratory flow rate
    // Limit the maximum rate of flow the ventilator gives so that the pressure/time curve shows a
    //dip before the patient initiated breath
    //priorVentilatorFlow remembers the prior flow rate so that the current flow rate can be limited.

    if (thisVent.plateauRequested && machineExpirationTimer < 0.1) {
      // plateau pressure with new breath only
      doPlateau = true;
    }

    if (doPlateau) {
      //perform plateau maneouver
      //hold flow for 1 second;
      if (machineExpirationTimer < 1) {
        flowMeasuredInflow = 0;
        flowMeasuredOutflow = 0;
      } else {
        thisVent.plateauRequested = false;
        doPlateau = false;
      }
    } else {
      //regular exhalation
      staticThoracicPressure = lungVolume * compliance + patientBreathPressure;
      dynamicPressure = 0;

      while (staticThoracicPressure + dynamicPressure < PEEP) {
        flowMeasuredInflow += 0.1;
        dynamicPressure = flowMeasuredInflow * resistanceOfETT;
        if (
          flowMeasuredInflow > 1 + priorVentilatorFlow ||
          flowMeasuredInflow > maxInspiratoryFlow
        ) {
          //if flow is increasing too rapidly or is more than max flow then break.
          //this is here to limit speed at which flow can fill circuit
          break;
        }
      }

      if (flowMeasuredInflow === 0) {
        flowMeasuredOutflow = (staticThoracicPressure - PEEP) / resistanceOfETT; //+ flowFromLargeAirways;  //HERE add the flow outwards from the large airways getting squeezed - its the quick puff of gas out at the end of inhalation. first 50cc of gas should be this.
      }

      flowRequiredForPressure = flowMeasuredInflow;
      priorVentilatorFlow = flowMeasuredInflow;
    }

    //
  };

  /////calculate measured pressures and volume

  function measureParameters() {
    pressureMeasured =
      flowMeasuredInflow * resistanceOfETT +
      lungVolume * compliance +
      patientBreathPressure;
    flowMeasured = flowMeasuredInflow - flowMeasuredOutflow;
    volumeMeasuredOutflow += (flowMeasuredOutflow * timeResolution * 1000) / 60;
    volumeMeasured += (flowMeasured * timeResolution * 1000) / 60; //resets with every new breath
    lungVolume += (flowMeasured * timeResolution * 1000) / 60; // does not reset

    //adjust compliance for lung volume
    //if the lung volume reaches the limit then compliance will drop rapidly

    if (lungVolume > patientCompliantLungVolume) {
      compliance = lowCompliance;
    } else {
      compliance = normalCompliance;
    }

    if (pressureMeasured > peakPressure) {
      peakPressure = pressureMeasured;
    }
    if (flowMeasuredInflow > peakFlow) {
      peakFlow = flowMeasured;
    } //getting peak flow for PSV

    if (doPlateau) {
      plateauPressure = pressureMeasured;
    }

    if (doExpiratoryPause) {
      expiratoryPressureMeasured = pressureMeasured;
    } else {
      expiratoryPressureMeasured = false; //if not being measured make false;
    }

    cumulativePressure += pressureMeasured;
  }

  function calculatePatientVentData() {
    //calculates out the patient data to present and for adjustments

    if (newBreath) {
      Vte = volumeMeasuredOutflow;
      newBreath = false;

      var expirationTime = Math.round(
        machineExpirationTimer / (machineBreathTimer - machineExpirationTimer)
      );
      if (isNaN(expirationTime)) {
        ItoE = 0;
      } else {
        ItoE = '1:' + expirationTime;
      }

      meanPressure = (timeResolution * cumulativePressure) / machineBreathTimer;
      if (BreathTarget === 'PRVC' && !testBreath) {
        if (Vte > volumeTarget) {
          PRVCPressure = PRVCPressure - 3;
        } else if (Vte < volumeTarget) {
          PRVCPressure = PRVCPressure + 3;
        }
      }

      if (BreathTarget === 'PRVC' && testBreath) {
        PRVCPressure = meanPressure + 10;
        testBreath = false;
      }

      machineBreathTimer = 0;
      console.log('newBreath');
      breathVolumeArray.push(Vte);
      breathRateArray.push(Timer);

      console.log('breath rate array length up: ', breathRateArray.length);
      if (breathVolumeArray.length > 15) {
        breathVolumeArray.shift();
        breathRateArray.shift();
      }
      volumeMeasuredOutflow = 0;

      peakPressureRecord = peakPressure;
      if (peakPressureRecord < peakPressureLimit) {
        peakPressureAlarm = false;
      } else {
        peakPressureAlarm = true;
      }

      plateauPressureMeasured = plateauPressure;
      plateauPressure = 0;

      peakPressure = 0;

      peakFlow = 0;
      cumulativePressure = 0;
      priorVentilatorFlow = 0;
    }

    console.log('breath Rate Array length down', breathRateArray.length);

    if (breathRateArray.length > 2) {
      console.log('breath Rate recalculated');
      breathRateArray.shift();
      //console.log(breathRateArray.length,  (Timer - breathRateArray[0])/60,  (breathRateArray.length * 60) / (Timer - breathRateArray[0]));
      breathRate = 60 / (Timer - breathRateArray[0]);
      //time it takes to take 1 breath divided by
    }

    if (breathVolumeArray.length > 1) {
      minuteVentilation =
        (breathRate *
          breathVolumeArray.reduce(function (
            previousValue,
            currentValue,
            index,
            array
          ) {
            return previousValue + currentValue;
          })) /
        breathVolumeArray.length /
        1000;
    }

    minuteVentilation = Math.round(minuteVentilation);
  }

  function ventLoop() {
    //proceeds through the ventilator functions
    //pushes the generated data to an array
    //increments timers
    //resets values prior to the next run

    flowMeasuredInflow = 0;
    flowMeasuredOutflow = 0;
    pressureMeasured = 0;
    flowRequiredForPressure = 0;

    patientBreathController();
    patientBreath();

    //for testing

    if (machineInspiration) {
      if (thisVent.expiratoryPauseRequested && machineBreathTimer < 0.01) {
        doExpiratoryPause = true;
      }

      if (doExpiratoryPause) {
        if (machineBreathTimer < 1) {
          flowMeasuredInflow = 0;
          flowMeasuredOutflow = 0;
        } else {
          doExpiratoryPause = false;
          thisVent.expiratoryPauseRequested = false;
        }
      } else {
        machineBreath();
      }
    } else {
      expiration();
    }

    measureParameters();
    //needs data from flowmeasuredInflow
    calculatePatientVentData();
    machineBreathController();

    dataArray.push({
      ventCount: ventCounter,
      count: counter,
      time: timeResolution,
      volume: volumeMeasured,
      pressure: pressureMeasured,
      flow: flowMeasured + 160, //make this happen in the ventGraphicsObject
      ventSettings: {
        tidalVolume: thisVent.tidalVolumeSet,
        mode: VentMode,
        target: BreathTarget,
        PEEP: PEEP,
        drivingPressure: drivingPressure,
        drivingSupportPressure: drivingSupportPressure,
        inspiratoryTime: inspiratoryTimeSet,
        frequency: machineFrequency,
        flowTriggerSensit: setFlowTrigger,
        pressureTriggerSensit: setPressureTrigger,
        trigger: triggerType,
        patientBreath: patientInspiration,
        machineBreath: machineInspiration,
        flowWaveForm: flowWaveForm,
        maxInspiratoryFlow: maxInspiratoryFlow,
      },
      patientVentData: {
        respiratoryRate: Math.floor(breathRate),
        //patient data
        patientSetRate: patientFrequency,
        patientBreathPressure: patientBreathPressure,
        patientInspiratoryTimeSet: patientInspiratoryTimeSet,
        //
        minuteVentilation: Math.floor(minuteVentilation),
        Vte: Math.floor(Vte),
        peakPressure: Math.floor(peakPressureRecord),
        ItoE: ItoE,
        plateauPressure: Math.floor(plateauPressureMeasured),
        expiratoryPressure: Math.floor(expiratoryPressureMeasured),
        resistanceOfETT: resistanceOfETT,
        lungCompliance: compliance,
      },
      alarms: {
        peakPressureAlarm: peakPressureAlarm,
      },

      log: ventLog.join(' - '),
    });

    ventLog.length = [];

    incrementTimers();
  }

  //public functions

  thisVent.returnVentDataArray = function () {
    //returns an array full of data generated by the ventilator
    //increments the ventCOunter which tells us how many sets of data have been generated

    ventCounter++;

    while (Timer < secondsOfDataToGenerate * ventCounter) {
      //1 seconds of data generated
      ventLoop();
    }

    return dataArray;
  };

  this.clearDataArray = function () {
    dataArray.length = 0;
  };

  //adjustment interface

  this.changeBreathTarget = function (newTarget) {
    //logic to ensure that this is a valid change here
    if (
      newTarget == 'VC' ||
      newTarget == 'PC' ||
      newTarget == 'PRVC' ||
      newTarget == 'PS'
    ) {
      BreathTarget = newTarget;
    }
  };

  this.changeVolumeSet = function (newVolumeSet) {
    this.tidalVolumeSet = newVolumeSet;
  };

  this.changePEEP = function (newPEEP) {
    if (!isNaN(newPEEP) && newPEEP > 0 && newPEEP < 30) {
      PEEP = newPEEP;
    }
  };

  this.changeMode = function (newMode) {
    if (newMode == 'CMV' || newMode == 'Spontaneous' || newMode == 'IMV') {
      VentMode = newMode;
    }
  };

  this.changeDrivingPressure = function (newDrivingPressure) {
    drivingPressure = newDrivingPressure;
  };

  this.changeInspiratoryTime = function (newInspiratoryTime) {
    inspiratoryTimeSet = newInspiratoryTime;
  };

  this.changeMachineRate = function (newMachineRate) {
    machineFrequency = newMachineRate;
  };

  this.changeMaxFlowRate = function (newFlowRate) {
    if (!isNaN(newFlowRate) && newFlowRate > 0 && newFlowRate < 101) {
      maxInspiratoryFlow = newFlowRate;
    }
  };

  this.changeFlowWaveForm = function (newFlowWaveForm) {
    flowWaveForm = newFlowWaveForm;
  };

  //patient settings

  this.changePatientRate = function (newPatientRate) {
    patientFrequency = newPatientRate;
  };

  this.changePatientBreathDepth = function (newPatientBreathDepth) {
    maxPatientBreathPressure = newPatientBreathDepth;
  };

  this.changePatientBreathDuration = function (newPatientBreathDuration) {
    patientInspiratoryTimeSet = newPatientBreathDuration;
  };

  this.changeLungCompliance = function (newLungCompliance) {
    compliance = newLungCompliance;
  };

  this.changeETTResistance = function (newETTResistance) {
    resistanceOfETT = newETTResistance;
  };

  this.startPatientBreath = function () {
    patientBreathController.startPatientBreath();
  };
} //end VentEngine

var thisVent = new VentEngine();

addEventListener(
  'message',
  function (e) {
    var ventDataObject = {
      ventDataArray: thisVent.returnVentDataArray(),
    };
    postMessage(ventDataObject);
    thisVent.clearDataArray();

    //check to see if vent settings changed
    if (JSON.stringify(e.data) !== '{}') {
    }

    if (e.data.target) {
      thisVent.changeBreathTarget(e.data.target);
    }

    if (e.data.machineRate) {
      thisVent.changeMachineRate(Number(e.data.machineRate));
    }

    if (e.data.TV) {
      thisVent.changeVolumeSet(Number(e.data.TV));
    }

    if (e.data.PEEP) {
      thisVent.changePEEP(Number(e.data.PEEP));
    }

    if (e.data.Mode) {
      thisVent.changeMode(e.data.Mode);
    }

    if (e.data.DrivingPressure) {
      thisVent.changeDrivingPressure(Number(e.data.DrivingPressure));
    }

    if (e.data.inspiratoryTime) {
      thisVent.changeInspiratoryTime(Number(e.data.inspiratoryTime));
    }

    if (e.data.maxFlowRate) {
      thisVent.changeMaxFlowRate(Number(e.data.maxFlowRate));
    }

    if (e.data.flowWaveForm) {
      thisVent.changeFlowWaveForm(e.data.flowWaveForm);
    }

    //patient settings

    if (e.data.patientRate) {
      thisVent.changePatientRate(Number(e.data.patientRate));
    }

    if (e.data.plateauRequested) {
      thisVent.plateauRequested = true;
    }

    if (e.data.expiratoryPauseRequested) {
      thisVent.expiratoryPauseRequested = true;
    }

    if (e.data.patientBreathDepth) {
      thisVent.changePatientBreathDepth(Number(e.data.patientBreathDepth));
    }

    if (e.data.patientBreathDuration) {
      thisVent.changePatientBreathDuration(
        Number(e.data.patientBreathDuration)
      );
    }

    if (e.data.lungCompliance) {
      thisVent.changeLungCompliance(Number(e.data.lungCompliance));
    }

    if (e.data.ETTResistance) {
      thisVent.changeETTResistance(Number(e.data.ETTResistance));
    }

    if (e.data.startPatientBreath) {
      thisVent.startPatientBreath();
    }
  },
  false
);
