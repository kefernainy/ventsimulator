var ventConfigObject = {
 elementName: "volumeVent"
};

var myVent = new Ventilator(ventConfigObject);

$("#ventControls").ready(function() {

 // tohave the control panel show up and then disappear if you click outside it

 $("#volumeVent").click(function(e) {
  e.stopPropagation();
  $("#tabs").toggle("fade", 200);
 });

 var tabAll = $("#tabs").find('*').add("#tabs"); // an array with all the elements in tabs - so that clicking tabs doesn't fire the fade effect.

 $(document).click(function(e) {
  e.stopPropagation();

  if (tabAll.index($(e.target)) == -1) {
   $("#tabs").hide("fade", 200);
  }
 });


 ////////////////////

 $("#tabs").tabs();

 var $ventModeSelect = $("#ventModeSelect");
 var $ACBreathTargetSelect = $("#ACBreathTargetSelect");
 var $SpontBreathTargetSelect = $("#SpontBreathTargetSelect");
 var $ventControls = $("#ventControls");

 var $startPatientBreathButton = $("#startPatientBreath");




 var synchronizeControls = function() {
//Get the values from the ventEngine and apply them to the settings interface
  if (myVent.currentVentData) {

   //set volume slider
   $("#volumeSlider").val(myVent.currentVentData[myVent.ventDataCounter].ventSettings.tidalVolume);
   $ventModeSelect.val(myVent.currentVentData[myVent.ventDataCounter].ventSettings.mode);
   $("#breathRateSlider").val(myVent.currentVentData[myVent.ventDataCounter].ventSettings.frequency);
   //get the mode and set the breath target

   if (myVent.currentVentData[myVent.ventDataCounter].ventSettings.mode == "CMV") {
    $ACBreathTargetSelect.val(myVent.currentVentData[myVent.ventDataCounter].ventSettings.target);
   }
   else if (myVent.currentVentData[myVent.ventDataCounter].ventSettings.mode == "Spontaneous") {
    $SpontBreathTargetSelect.val(myVent.currentVentData[myVent.ventDataCounter].ventSettings.target);
   }

   //set peep
   $("#spontDrivingPressureSlider").val(myVent.currentVentData[myVent.ventDataCounter].ventSettings.drivingSupportPressure);
   $("#drivingPressureSlider").val(myVent.currentVentData[myVent.ventDataCounter].ventSettings.drivingPressure);
   $("#peepSlider").val(myVent.currentVentData[myVent.ventDataCounter].ventSettings.PEEP);
   $("#flowRateSlider").val(myVent.currentVentData[myVent.ventDataCounter].ventSettings.maxInspiratoryFlow);
   $("#flowWaveFormSelect").val(myVent.currentVentData[myVent.ventDataCounter].ventSettings.flowWaveForm);

   //patient stuff
   $("#patientBreathRateSlider").val(myVent.currentVentData[myVent.ventDataCounter].patientVentData.patientSetRate);
   $("#patientBreathDurationSlider").val(myVent.currentVentData[myVent.ventDataCounter].patientVentData.patientInspiratoryTimeSet);
   $("#patientBreathDepthSlider").val(myVent.currentVentData[myVent.ventDataCounter].patientVentData.maxPatientBreathPressure);
   $("#ETTResistanceSlider").val(myVent.currentVentData[myVent.ventDataCounter].patientVentData.resistanceOfETT);
   $("#lungComplianceSlider").val(myVent.currentVentData[myVent.ventDataCounter].patientVentData.lungCompliance);


   $ventControls.trigger("change");
   $("#ventDisplayControls").trigger("change");
   
 // make labes agree with sliders
 
   $("#peepSet").val($("#peepSlider").val());
   $("#breathRateSet").val($("#breathRateSlider").val());
   $("#patientBreathRateSet").val($("#patientBreathRateSlider").val());
   $("#patientBreathDurationSet").val($("#patientBreathDurationSlider").val());
   $("#patientBreathDepthSet").val($("#patientBreathDepthSlider").val());
   $("#ETTResistanceSet").val($("#ETTResistanceSlider").val());
   $("#lungComplianceSet").val($("#lungComplianceSlider").val());
   $("#secondsPerScreenSet").val($("#secondsPerScreenSlider").val());
   $("#volumeSet").val($("#volumeSlider").val());
   $("#flowRateSet").val($("#flowRateSlider").val());
   $("#spontDrivingPressureSet").val($("#spontDrivingPressureSlider").val());
   $("#drivingPressureSet").val($("#drivingPressureSlider").val());
   $("#inspiratoryTimeSet").val($("#inspiratoryTimeSlider").val());

  }
  else {
   //wait until vent data loaded to synchronize
   console.log("vent not ready..will retry control sync in 250ms");
   setTimeout(synchronizeControls, 250);
  }

 };


 $ventControls.change(function() {
//make sure the right menus are showing

  if ($ventModeSelect.val() == "CMV") {
   $("#AllACOptions").show();
   $("#pressureSupportOptions").hide();

   $("#ACBreathTargetSelect").show();
   $("#SpontBreathTargetSelect").hide();

   //if AC volume target then we need
   //to set volume and waveForm and flow rate

   if ($ACBreathTargetSelect.val() == "VC") {

    $("#volumeTargetOptions").show();
    $("#pressureTargetOptions").hide();
   }
   else if ($ACBreathTargetSelect.val() == "PC") {

    $("#volumeTargetOptions").hide();
    $("#pressureTargetOptions").show();

   }
  }

  else if ($ventModeSelect.val() == "IMV") {
   $("#AllACOptions").show();
   $("#pressureSupportOptions").show();

   $("#ACBreathTargetSelect").show();
   $("#SpontBreathTargetSelect").show();


   //if volume target then we need
   //to set volume and waveForm and flow rate

   if ($ACBreathTargetSelect.val() == "VC") {


    $("#volumeTargetOptions").show();
    $("#pressureTargetOptions").hide();
   }
   else if ($ACBreathTargetSelect.val() == "PC") {

    $("#volumeTargetOptions").hide();
    $("#pressureTargetOptions").show();

   }

   if ($SpontBreathTargetSelect.val() == "PS") {
    $("#pressureSupportOptions").show();
   }

  }


  else if ($ventModeSelect.val() == "Spontaneous") {

   $("#AllACOptions").hide();
   $("#volumeTargetOptions").hide();
   $("#pressureTargetOptions").hide();

   $("#ACBreathTargetSelect").hide();
   $("#SpontBreathTargetSelect").show();

   if ($SpontBreathTargetSelect.val() == "PS") {
    $("#pressureSupportOptions").show();
   }

  }
 });

 ////////////////
 //button clicks
 
  $startPatientBreathButton.click(function() {
  myVent.startPatientBreath();
 });


 $("#plateauButton").click(function() {
  myVent.requestPlateau();
  $("#tabs").hide("fade", 200);

 });

 $("#expiratoryPauseButton").click(function() {
  myVent.requestExpiratoryPause();
  $("#tabs").hide("fade", 200);

 });

 $("#stopButton").click(function() {
  var thisButton = $(this);
  if (myVent.stopped) {
   myVent.timerWebWorker.postMessage('start');
   thisButton.text("Pause");
   myVent.stopped = false;
  }
  else {
   myVent.timerWebWorker.postMessage('stop');
   thisButton.text("Resume");

   myVent.stopped = true;
  };
  $("#tabs").hide("fade", 200);

 });



 $("#patientSubmitButton").click(function() {
  myVent.changePatientBreathDepth($("#patientBreathDepthSlider").val());
  myVent.changePatientBreathDuration($("#patientBreathDurationSlider").val());
  myVent.changePatientRate($("#patientBreathRateSlider").val());
  myVent.changeLungCompliance($("#lungComplianceSlider").val());
  myVent.changeETTResistance($("#ETTResistanceSlider").val());
  $("#tabs").hide("fade", 200);

 });

 $("#submitSettingsButton").click(function() {
  //change breath target depending on mode
  myVent.changeMode($("#ventModeSelect").val());
  myVent.changePEEP($("#peepSlider").val());
  myVent.changeMaxFlowRate($("#flowRateSlider").val());
  myVent.changeFlowWaveForm($("#flowWaveFormSelect").val());

  if ($("#ventModeSelect").val() == "CMV") {
   myVent.changeBreathTarget($("#ACBreathTargetSelect").val());
   myVent.changeDrivingPressure($("#drivingPressureSlider").val());
  }
  else if ($("#ventModeSelect").val() == "Spontaneous") {
   myVent.changeBreathTarget($("#SpontBreathTargetSelect").val());
   myVent.changeDrivingPressure($("#spontDrivingPressureSlider").val());
  }


  myVent.changeVolumeSet($("#volumeSlider").val());

  myVent.changeInspiratoryTime($("#inspiratoryTimeSlider").val());
  myVent.changeMachineRate($("#breathRateSlider").val());

  $("#tabs").hide("fade", 200);
 });


 $("#ventDisplayControls").change(function() {
  myVent.ventGraphics.setDisplay($('input:radio[name=ventDisplayRadio]:checked').val());

  myVent.ventGraphics.setNumberSecPerScreen($("#secondsPerScreenSlider").val());
 });


 var startUpVentControls = (function() {
  synchronizeControls();

 })();


});