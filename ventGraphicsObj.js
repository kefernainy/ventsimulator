// The ventilator graphics object.

//todo:make smallFont, largeFont, tinyFont to be reactive to ventilator size.
//todo: make it take a configuration object

var VentGraphics = function (ventConfigObject) {
  var width = ventConfigObject.setwidth || 500;
  var height = ventConfigObject.setheight || 400;
  var numberSecPerScreen = ventConfigObject.numberSecPerScreen || 30; //For scaling the horizontal axis (number of seconds per screen)
  var volumePerScreen = 800; //For scaling the vertical axis (number of milliliters per screen)
  var flowPerScreen = 150; //For scaling the vertical axis on flow-time graphs (number of L/second)
  var pressurePerScreen = 100; // for scaling the vertical axis on pressure time graphs (cm water /second)
  var heightOfTopBar = height / 4; // Height of bar at top of graphs that shows the numbers
  var leftIndent = 20; //Indentation at left of screen to allow for gradation bars
  var bottomIndent = 20; //Indentation at bottom of screen to allow for gradation bars
  var firstDraw = true;
  var screenValid = false;
  var barValid = false;
  var ctxBackgroundLayer;
  var ctxVentGraphicsLayer;
  var ctxVentDataLayer;
  var ctxTopLayer;
  var ventBackgroundCache;
  var topbarCache;
  var display = ventConfigObject.setVentDisplay || 'Volume';
  var yellow = 'rgba(255,255,0,0.9)';

  var numberOfPixelsPerSecond = (width - leftIndent) / numberSecPerScreen;
  var numberOfPixelsPerVolume =
    (height - bottomIndent - heightOfTopBar) / volumePerScreen;
  var numberOfPixelsPerPressure =
    (height - bottomIndent - heightOfTopBar) / pressurePerScreen;
  var numberOfPixelsPerFlow =
    (height - bottomIndent - heightOfTopBar) / flowPerScreen / 2;

  var oldHeight = 0;
  var oldTime = 0;
  var screenTimer = 0;
  var oldCount = 0;
  var newCount = 0;

  var ventMode = '';
  var breathTarget = '';
  //timers canvas parts
  topbarCache = document.createElement('canvas');
  var topbarCacheContext = topbarCache.getContext('2d');
  var topbarDataCache = document.createElement('canvas');
  var topbarDataCacheContext = topbarDataCache.getContext('2d');
  // graphics canvs

  var graphicsCache = document.createElement('canvas');
  var graphicsCacheContext = graphicsCache.getContext('2d');
  //

  this.setMode = function (mode) {
    if (mode != ventMode) {
      screenValid = false;
      barValid = false;
      ventMode = mode;
    }
  };

  this.setNumberSecPerScreen = function (numberOfSecondsToShow) {
    if (
      !isNaN(
        numberOfSecondsToShow &&
          numberOfSecondsToShow > 2 &&
          numberOfSecondsToShow < 31
      )
    ) {
      numberSecPerScreen = numberOfSecondsToShow;
      numberOfPixelsPerSecond = (width - leftIndent) / numberSecPerScreen;
      screenValid = false;
      barValid = false;
    }
  };

  this.setBreathTarget = function (target) {
    if (target != breathTarget) {
      screenValid = false;
      barValid = false;
      breathTarget = target;
    }
  };

  this.setDisplay = function (ventDisplay) {
    display = ventDisplay;
    screenValid = false;
    barValid = false;
  };

  this.initialize = (function (elementName) {
    if (!elementName) {
      elementName = 'c';
    }
    var canvas = document.getElementById(elementName);
    canvas.outerHTML =
      '<viewport id=' +
      elementName +
      " style = 'width:" +
      width +
      'px;height:' +
      height +
      "px'></viewport>";
    canvas = document.getElementById(elementName);

    canvas.innerHTML =
      "<canvas id= 'backgroundLayer-" +
      elementName +
      "' style = 'position:absolute; z-index:10;'></canvas>" +
      "<canvas id= 'ventGraphicsLayer-" +
      elementName +
      "' style = 'position:absolute; z-index:20;'></canvas>" +
      "<canvas id= 'ventDataLayer-" +
      elementName +
      "' style = 'position:absolute; z-index:20'></canvas>" +
      "<canvas id= 'topLayer-" +
      elementName +
      "' style = 'position:absolute; z-index:30'></canvas>";

    var canvasBackground = document.getElementById(
      'backgroundLayer-' + elementName
    );
    var canvasVentGraphicsLayer = document.getElementById(
      'ventGraphicsLayer-' + elementName
    );
    var canvasVentDataLayer = document.getElementById(
      'ventDataLayer-' + elementName
    );
    var canvasTopLayer = document.getElementById('topLayer-' + elementName);

    canvasBackground.width = width;
    canvasBackground.height = height;
    canvasVentGraphicsLayer.width = width;
    canvasVentGraphicsLayer.height = height;
    canvasVentDataLayer.width = width;
    canvasVentDataLayer.height = height;
    canvasTopLayer.width = width;
    canvasTopLayer.height = height;
    ctxBackgroundLayer = canvasBackground.getContext('2d');
    ctxVentGraphicsLayer = canvasVentGraphicsLayer.getContext('2d');
    ctxVentDataLayer = canvasVentDataLayer.getContext('2d');
    ctxTopLayer = canvasTopLayer.getContext('2d');

    //top layer experimentation:

    var Lineargradient = ctxTopLayer.createLinearGradient(0, 0, 0, 225);
    var Radialgradient = ctxTopLayer.createRadialGradient(
      75,
      50,
      5,
      90,
      60,
      300
    );
    ctxTopLayer.fillStyle = Lineargradient;
    Lineargradient.addColorStop(0, 'rgba(0,0,0,0.4)');
    Lineargradient.addColorStop(0.3, 'rgba(0,0,0,0.0)');
    ctxTopLayer.fillRect(0, 0, width, height);

    Radialgradient.addColorStop(0, 'rgba(255,255,255,0.4)');
    Radialgradient.addColorStop(1, 'rgba(255,255,255,0.0)');
    ctxTopLayer.fillStyle = Radialgradient;
    ctxTopLayer.fillRect(0, 0, width, height);

    ctxTopLayer.globalAlpha = 1;
    ///////////////////////////

    /////////////
  })(ventConfigObject.elementName);

  this.drawVentBackground = function () {
    var i;
    if (!screenValid) {
      //draw into off screen canvas to cache the background so that it is not drawn each time

      ventBackgroundCache = document.createElement('canvas');
      ventBackgroundCache.width = width;
      ventBackgroundCache.height = height;
      var ventBackgroundCacheContext = ventBackgroundCache.getContext('2d');

      ventBackgroundCacheContext.fillStyle = 'rgba(25,25,112,1)';
      ventBackgroundCacheContext.font = '5pt Arial';
      ventBackgroundCacheContext.beginPath();

      if (firstDraw) {
        ventBackgroundCacheContext.rect(0, 100, width, height);
      } else {
        ventBackgroundCacheContext.rect(0, 0, width, height);
        firstDraw = false;
      }
      ventBackgroundCacheContext.closePath();
      ventBackgroundCacheContext.fill();

      //Vertical gradations
      ventBackgroundCacheContext.fillStyle = yellow;

      var NumberOfPixelsPerSecond = (width - leftIndent) / numberSecPerScreen;
      ventBackgroundCacheContext.fillText(
        'Seconds',
        leftIndent,
        height - bottomIndent + 10
      );
      ventBackgroundCacheContext.fillText('Pt Breath', leftIndent, 130);
      ventBackgroundCacheContext.fillText('Pt Breath', leftIndent, 130);
      for (i = leftIndent; i < width; i = i + NumberOfPixelsPerSecond) {
        ventBackgroundCacheContext.moveTo(i, heightOfTopBar);
        ventBackgroundCacheContext.lineTo(i, height - bottomIndent);
      }
      //Horizontal gradations

      if (display === 'Pressure') {
        var NumberOfPixelsPer10CM =
          ((height - heightOfTopBar - bottomIndent) * 10) / pressurePerScreen;
        var PresMarker = 0;
        ctxBackgroundLayer.fillText('P', 0, heightOfTopBar + 5);
        for (
          i = height - bottomIndent;
          i > heightOfTopBar;
          i = i - NumberOfPixelsPer10CM
        ) {
          ventBackgroundCacheContext.moveTo(leftIndent, i);
          ventBackgroundCacheContext.lineTo(width - leftIndent, i);
          ventBackgroundCacheContext.fillText(PresMarker, 2, i);
          PresMarker = PresMarker + 10;
        }
        ventBackgroundCacheContext.strokeStyle = '#868A08'; //"rgba(134,138,8,0.5)";//;
        ventBackgroundCacheContext.lineWidth = 0.5;
        ventBackgroundCacheContext.stroke();
      } else if (display == 'Volume') {
        var NumberOfPixelsPer100CC =
          ((height - heightOfTopBar - bottomIndent) * 100) / volumePerScreen;
        var volMarker = 0;
        ventBackgroundCacheContext.fillText('Vol', 0, heightOfTopBar + 5);
        for (
          i = height - bottomIndent;
          i > heightOfTopBar;
          i = i - NumberOfPixelsPer100CC
        ) {
          ventBackgroundCacheContext.moveTo(leftIndent, i);
          ventBackgroundCacheContext.lineTo(width - leftIndent, i);
          ventBackgroundCacheContext.fillText(volMarker, 2, i);
          volMarker = volMarker + 100;
        }
        ventBackgroundCacheContext.strokeStyle = '#868A08';
        ventBackgroundCacheContext.lineWidth = 0.5;
        ventBackgroundCacheContext.stroke();
      } else if (display == 'Flow') {
        var NumberOfPixelsPer20CM =
          ((height - heightOfTopBar - bottomIndent) * 20) / flowPerScreen / 2;
        var FlowMarker = 0;
        ventBackgroundCacheContext.fillText('Flow', 0, heightOfTopBar);
        for (
          i = height - bottomIndent - (height - heightOfTopBar) / 2;
          i > heightOfTopBar;
          i = i - NumberOfPixelsPer20CM
        ) {
          ventBackgroundCacheContext.moveTo(leftIndent, i);
          ventBackgroundCacheContext.lineTo(width - leftIndent, i);
          ventBackgroundCacheContext.fillText(FlowMarker, 2, i);
          FlowMarker = FlowMarker + 20;
        }

        FlowMarker = 0;
        for (
          i = height - bottomIndent - (height - heightOfTopBar) / 2;
          i < height - bottomIndent;
          i = i + NumberOfPixelsPer20CM
        ) {
          ventBackgroundCacheContext.moveTo(leftIndent, i);
          ventBackgroundCacheContext.lineTo(width - leftIndent, i);
          ventBackgroundCacheContext.fillText(FlowMarker, 2, i);
          FlowMarker = FlowMarker - 20;
        }
        ventBackgroundCacheContext.strokeStyle = '#868A08';
        ventBackgroundCacheContext.lineWidth = 0.5;
        ventBackgroundCacheContext.stroke();
      }

      ventBackgroundCacheContext.save();
      ctxBackgroundLayer.drawImage(ventBackgroundCache, 0, 0);
      screenValid = true;
    } else {
      //Draw from cache
      ctxBackgroundLayer.drawImage(ventBackgroundCache, 0, 0);
    }
  };

  this.drawGraphics = (ventData) => {
    //ventGraphicsCacheContext
    //plan to make several shadow contexts on which the 3 graphs are drawn
    //the final image will be drawn from them
    //can use this to combine graphs as they can be drawn to stretch...
    var lungVolumeMeasured = ventData.volume;
    var pressureMeasured = ventData.pressure;
    var flowMeasured = ventData.flow;
    var count = ventData.count;
    var time = ventData.time;
    var newHeight;

    graphicsCache.width = width;
    graphicsCache.height = height;
    /////

    /////

    if (
      ventData.breathTarget !== breathTarget ||
      ventData.ventMode !== ventMode
    ) {
      //check to see if there has been a change in the target/mode so that graphics change
      ventMode = ventData.ventMode;
      breathTarget = ventData.breathTarget;
      barValid = false;
    }

    newCount = count;
    var timeElapsed = (newCount - oldCount) * time;
    screenTimer += timeElapsed;
    oldCount = newCount;

    var newX = leftIndent + screenTimer * numberOfPixelsPerSecond;
    var oldX = leftIndent + oldTime * numberOfPixelsPerSecond;

    if (!screenValid || screenTimer > numberSecPerScreen) {
      screenTimer = 0;
      this.drawVentBackground();
    }

    if (display == 'Volume') {
      graphicsCacheContext.strokeStyle = 'Red';
      graphicsCacheContext.fillStyle = 'Red';
      graphicsCacheContext.lineWidth = 5;

      newHeight =
        height - (lungVolumeMeasured * numberOfPixelsPerVolume + bottomIndent);
    } else if (display == 'Pressure') {
      graphicsCacheContext.strokeStyle = 'LightGreen';
      graphicsCacheContext.lineWidth = 5;
      newHeight =
        height - (pressureMeasured * numberOfPixelsPerPressure + bottomIndent);
    } else if (display == 'Flow') {
      graphicsCacheContext.strokeStyle = 'Green';
      graphicsCacheContext.lineWidth = 5;

      newHeight =
        height - (flowMeasured * numberOfPixelsPerFlow + bottomIndent);
    }

    graphicsCacheContext.beginPath();
    if (screenTimer === 0) {
      //clear both shadow and graphics canvas
      graphicsCacheContext.clearRect(
        0,
        0,
        graphicsCacheContext.width,
        graphicsCacheContext.height
      );
      ctxVentGraphicsLayer.clearRect(
        0,
        0,
        ctxVentGraphicsLayer.canvas.width,
        ctxVentGraphicsLayer.canvas.height
      );
    } else {
      graphicsCacheContext.moveTo(oldX, oldHeight);
      graphicsCacheContext.lineTo(newX, newHeight);
    }
    //for debug shows machine and patientBreath on graphics
    if (ventData.machineBreath) {
      graphicsCacheContext.fillRect(newX, 110, 1, 6);
    } else {
      //graphicsCacheContext.fillRect(newX, 110, 1, 6);
    }
    if (ventData.patientBreath) {
      graphicsCacheContext.fillRect(newX, 130, 1, 6);
    } else {
      //  graphicsCacheContext.fillRect(newX, 130, 1, 2);
    }

    graphicsCacheContext.stroke();
    ctxVentGraphicsLayer.drawImage(graphicsCache, 0, 0);
    oldHeight = newHeight;
    oldTime = screenTimer;
    this.drawTimers(ventData);
  };

  this.drawTimers = function (ventData) {
    //PeakPressure, PressureMean, PEEPMeasured, BreathRateMeasured, ExhaledTidalVolume, MinuteVentilationMeasured, IoverE, peakPressureAlarm, plateauPressure, expiratoryPressure) {
    // Draws the timers and indicators at the top of the ventilator screen
    var verticalDist, horizontalDist, maxWidth, indent;
    if (!barValid) {
      topbarCache.width = width;
      topbarCache.height = heightOfTopBar;

      //top bar of parameters

      topbarCacheContext.fillStyle = 'rgba(25,25,112,1)';
      topbarCacheContext.fillRect(0, 0, width, heightOfTopBar);

      topbarCacheContext.fillStyle = yellow;
      topbarCacheContext.font = '25pt Verdana';
      verticalDist = height / 10;
      horizontalDist = width / 10;
      maxWidth = width / 8;
      indent = width / 10;
      topbarCacheContext.fillText(
        'P',
        indent + horizontalDist,
        verticalDist,
        maxWidth
      );
      topbarCacheContext.fillText(
        'I:E',
        indent + 2 * horizontalDist,
        verticalDist,
        maxWidth
      );
      topbarCacheContext.fillText(
        'f',
        indent + 3.5 * horizontalDist,
        verticalDist,
        maxWidth
      );
      topbarCacheContext.fillText(
        'V',
        indent + 4.7 * horizontalDist,
        verticalDist,
        maxWidth
      );
      topbarCacheContext.fillText(
        'V',
        indent + 7 * horizontalDist,
        verticalDist,
        maxWidth
      );

      indent = indent + 10;
      verticalDist = verticalDist + 10;
      maxWidth = maxWidth / 2;
      topbarCacheContext.font = '10pt Verdana';
      topbarCacheContext.fillText(
        'Peak',
        indent + horizontalDist,
        verticalDist,
        maxWidth
      );
      topbarCacheContext.fillText(
        'TE',
        indent + 4.7 * horizontalDist,
        verticalDist,
        maxWidth
      );
      topbarCacheContext.fillText(
        'Etot',
        indent + 7 * horizontalDist,
        verticalDist,
        maxWidth
      );

      topbarCacheContext.font = '27pt Verdana';
      if (ventMode == 'CMV') {
        topbarCacheContext.fillText('CMV', 10, verticalDist, 2 * maxWidth);
        if (breathTarget == 'VC') {
          topbarCacheContext.fillText(
            'Vt',
            10,
            verticalDist + 35,
            2 * maxWidth
          );
        } else if (breathTarget == 'PC') {
          topbarCacheContext.fillText(
            'Pt',
            10,
            verticalDist + 30,
            2 * maxWidth
          );
        } else if (breathTarget == 'PRVC') {
          topbarCacheContext.fillText(
            'Pr',
            10,
            verticalDist + 30,
            2 * maxWidth
          );
        } //PRVC
      } //AC
      else if (ventMode == 'Spontaneous') {
        topbarCacheContext.fillText('Sup', 10, verticalDist, maxWidth);
        if (breathTarget === 'PS') {
          topbarCacheContext.fillText(
            'Pt',
            10,
            verticalDist + 30,
            2 * maxWidth
          );
        } //PS
      } //PSV

      topbarCacheContext.fillStyle = 'rgba(25,25,112,1)';
      topbarCacheContext.fillRect(horizontalDist, verticalDist, width, 50);

      topbarCacheContext.save();
      ctxVentDataLayer.drawImage(topbarCache, 0, 0);
      barValid = true;
    } else {
      //draw bar from cache
      ctxVentDataLayer.drawImage(topbarCache, 0, 0);
    }
    // now draw the actual numbers
    //experimental

    topbarDataCache.width = width;
    topbarDataCache.height = heightOfTopBar;

    //

    verticalDist = height / 5;
    horizontalDist = width / 10;
    maxWidth = width / 8;
    indent = width / 10;

    if (ventData.peakPressureAlarm) {
      topbarDataCacheContext.fillStyle = 'Red';
      topbarDataCacheContext.font = '12pt Arial';
      topbarDataCacheContext.fillText(
        'Peak Pressure Alarm',
        horizontalDist,
        verticalDist + 12
      );
    }

    if (ventData.plateauPressure > 0) {
      topbarDataCacheContext.fillStyle = 'White';
      topbarDataCacheContext.font = '12pt Arial';
      topbarDataCacheContext.fillText(
        'Plateau Pressure  ' + ventData.plateauPressure,
        horizontalDist,
        verticalDist + 12
      );
    }

    if (ventData.expiratoryPressure) {
      topbarDataCacheContext.fillStyle = 'White';
      topbarDataCacheContext.font = '12pt Arial';
      topbarDataCacheContext.fillText(
        'Expiratory Pressure  ' + ventData.expiratoryPressure,
        horizontalDist,
        verticalDist + 12
      );
    }

    topbarDataCacheContext.fillStyle = yellow;
    topbarDataCacheContext.font = '25pt Arial';

    topbarDataCacheContext.fillText(
      ventData.peakPressure,
      indent + horizontalDist,
      verticalDist,
      maxWidth
    );
    topbarDataCacheContext.fillText(
      ventData.ItoE,
      indent + 2 * horizontalDist,
      verticalDist,
      maxWidth
    );
    topbarDataCacheContext.fillText(
      ventData.respiratoryRate,
      indent + 3.5 * horizontalDist,
      verticalDist,
      maxWidth
    );
    topbarDataCacheContext.fillText(
      ventData.Vte,
      indent + 4.7 * horizontalDist,
      verticalDist,
      maxWidth
    );
    topbarDataCacheContext.fillText(
      ventData.minuteVentilation,
      indent + 7 * horizontalDist,
      verticalDist,
      maxWidth
    );

    ctxVentDataLayer.drawImage(topbarDataCache, 0, 0);
  };
};
