
var addGeoJSONLayer, ajaxErrorHandler, buttonAutoChallenge, buttonManualChallenge, challenge, changeMapLayer, clearTask, currentChallenge, currentTask, difficulty, dlgOpen, drawFeatures, editor, enableKeyboardShortcuts, geojsonLayer, getChallenge, getExtent, location, makeButton, makeDlg, map, markdown, mrErrorHandler, mr_attrib, msg, msgMovingOnToTheNextChallenge, msgTaskText, msgZoomInForEdit, nomToString, pageStartTime, revGeocode, revGeocodeOSMObj, root, selectedFeature, setDelay, showTask, tileAttrib, tileLayer, tileUrl, totalFixed, totalTasks, updateChallenge, updateStats;

root = typeof exports !== "undefined" && exports !== null ? exports : this;
markdown = new Showdown.converter();
map = void 0;
geojsonLayer = null;
tileLayer = null;
tileUrl = "http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
tileAttrib = '© <a href="http://openstreetmap.org">OpenStreetMap</a> contributors';
currentChallenge = null;
currentTask = null;
selectedFeature = null;
editor = "";
difficulty = null;
location = null;
challenge = null;
totalTasks = 0;
totalFixed = 0;
pageStartTime = null;
msgMovingOnToTheNextChallenge = 'OK, moving right along...';
msgZoomInForEdit = "Please zoom in a little so we don't have to load a huge area from the API.";
mr_attrib = "<small>\n  <p>\n    thing by <a href='mailto:m@rtijn.org'>Martijn van Exel and Serge Wroclawski</a>\n  <p>\n</small>";
buttonAutoChallenge = {
    label: "Find a new challenge",
    action: "getNewChallenge()"
  };
buttonManualChallenge = {
    label: "Let me choose a new challenge",
    action: 'window.location.href="/challenges/'
  };
buttonExitApp = {
    label: "Return to homepage",
    action: 'window.location.href="/"'
  };
function setDelay(seconds, func) {
    /*
      # Wraps setTimeout to make it easiet to write in Coffeescript
    */
    return setTimeout(func, seconds * 1000);
};

jQuery.fn.extend({
    /*
      # Returns get parameters.
      #
      # If the desired param does not exist, null will be returned
      #
      # To get the document params:
      # @example value = $(document).getUrlParam("paramName");
      #
      # To get the params of a html-attribut (uses src attribute)
      # @example value = $('#imgLink').getUrlParam("paramName");
    */

    getUrlParam: function(strParamName) {
      var qString, query, returnVal, strHref, strQueryString;
      strParamName = escape(unescape(strParamName));
      if ($(this).attr("nodeName") === "#document") {
        if (window.location.search.search(strParamName) > -1) {
          qString = window.location.search.substr(1, window.location.search.length).split("&");
        }
      } else if ($(this).attr("src") !== "undefined") {
        strHref = $(this).attr("src");
        if (strHref.indexOf("?") > -1) {
          strQueryString = strHref.substr(strHref.indexOf("?") + 1);
          qString = strQueryString.split("&");
        }
      } else if ($(this).attr("href") !== "undefined") {
        strHref = $(this).attr("href");
        if (strHref.indexOf("?") > -1) {
          strQueryString = strHref.substr(strHref.indexOf("?") + 1);
          qString = strQueryString.split("&");
        }
      } else {
        return null;
      }
      if (!qString) {
        return null;
      }
      returnVal = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = qString.length; _i < _len; _i++) {
          query = qString[_i];
          if (escape(unescape(query.split("=")[0])) === strParamName) {
            _results.push(query.split("=")[1]);
          }
        }
        return _results;
      })();
      if (returnVal.lenght === 0) {
        return null;
      } else if (returnVal.lenght === 1) {
        return returnVal[0];
      } else {
        return returnVal;
      }
    }
  });

function clearTask() {
    /*
      # Clear all the task-related variables in between tasks
    */
    currentTask = null;
    selectedFeature = null;
    map.removeLayer(geojsonLayer);
    return addGeoJSONLayer();
  };

function getExtent(feature) {
    /*
      # Takes in a JSON feature and return a Leaflet LatLngBounds
    */

    var bounds, coordinates, lat, latlon, lats, lon, lons, minlat, ne, sw, _i, _len, _ref;
    if (!(feature.geometry.coordinates && feature.geometry.coordinates.length > 0)) {
      return false;
    }
    if (feature.geometry.type === "Point") {
      lon = feature.geometry.coordinates[0];
      lat = feature.geometry.coordinates[1];
      latlon = new L.LatLng(lat, lon);
      bounds = new L.LatLngBounds(latlon);
      bounds.extend(latlon);
      return bounds;
    } else {
      lats = [];
      lons = [];
      _ref = feature.geometry.coordinates;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        coordinates = _ref[_i];
        lats.push(coordinates[1]);
        lons.push(coordinates[0]);
      }
      minlat = Math.min.apply(Math, lats);
      sw = new L.LatLng(Math.min.apply(Math, lats), Math.min.apply(Math, lons));
      ne = new L.LatLng(Math.max.apply(Math, lats), Math.max.apply(Math, lons));
      return new L.LatLngBounds(sw, ne);
    }
  };

function msgClose() {
    /*
      # Close the msg box
    */
    return $("#msgBox").fadeOut();
  };

function msg(html) {
    /*
      # Display a msg (html) in the msgbox. Must be closed with msgClose()
    */
    $("#msgBox").html(html).fadeIn();
    return $("#msgBox").css("display", "block");
  };

function msgTaskText() {
    /*
      # Display the current task text in the msgbox
    */
    if (currentTask.text) {
      return msg(currentTask.text);
    }
  };

function makeButton(label, action) {
    /*
      # Takes in a label and onclick action and returns a button div
    */

    var button;
    button = $('div').addClass("button");
    button.attr({
      onclick: action
    });
    button.content = label;
    return button;
  };

function makeDlg(dlgData) {
    /*
      # Takes dialog box data and returns a dialog box for nextUp actions
    */

    var button, buttons, dlg, item, _i, _len, _ref;
    dlg = $('<div></div>').addClass("dlg");
    dlg.append(markdown.makeHtml(dlgData.text));
    buttons = $('<div></div>').addClass("buttons");
    _ref = dlgData.buttons;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      item = _ref[_i];
      button = makeButton(item.label, item.action);
      buttons.append(button);
    }
    dlg.append(buttons);
    return dlg;
  };

function dlgOpen(h) {
    /*
      #  Display the data (html) in a dialog box. Must be closed with dlgClose()
    */
    $("#dlgBox").html(h).fadeIn();
    return $("#dlgBox").css("display", "block");
  };

function dlgClose() {
    /*
      # Closes the dialog box
    */
    return $("#dlgBox").fadeOut();
  };

function ajaxErrorHandler(jqxhr, statusString, error) {
    /*
      # Handle AJAX errors in this function (or hand them over to
      # mrErrorHandler if appropriate
    */

    var dlg;
    switch (jqxhr.status) {
      case 400:
        return mrErrorHandler(error);
      default:
        dlg = makeDlg({
          text: "The application has encountered a critical error: " + jqxhr.status + ": " + error,
          buttons: [buttonExitApp]
        });
        return dlgOpen(dlg);
    }
  };

function mrErrorHandler(errorString) {
    /*
      # This function takes in MapRoulette errors and handles them
    */

    var desc, dlg, error;
    error = errorString.split(':')[0];
    desc = errorString.split(':')[1].trim();
    switch (error) {
      case "ChallengeInactive":
        dlg = makeDlg({
          text: "The current challenge is unavailable (maybe down for maintence. What should we do?",
          buttons: [buttonAutoChallenge, buttonManualChallenge]
        });
        break;
      case "ChallengeComplete":
        dlg = makeDlg({
          text: "This challenge has no tasks available (maybe it's complete!). What should we do?",
          buttons: [buttonAutoChallenge, buttonManualChallenge]
        });
        break;
      default:
        dlg = makeDlg({
          text: "An unhandled MapRoulette error has occured. Sorry :(",
          buttons: [buttonExitApp]
        });
    }
    return dlgOpen(dlg);
  };

function nomToString(addr) {
    /*
      # Takes a geocode object returned from Nominatim and returns a
      # nicely formatted string
    */

    var county, locality, str, town;
    str = "";
    if (addr.city != null) {
      locality = addr.city;
    } else {
      if (addr.town != null) {
        town = addr.town;
      } else if (addr.hamlet != null) {
        town = addr.hamlet;
      } else {
        town = "Somewhere in";
      }
      if (addr.county != null) {
        if (addr.county.toLowerCase().indexOf('county') > -1) {
          county = ", " + addr.county;
        } else {
          county = ", " + addr.county + " County";
        }
      } else {
        county = "";
      }
      locality = "" + addr.town + " " + county;
    }
    if (addr.state != null) {
      return "" + locality + ", " + addr.state;
    } else {
      if (addr.country != null) {
        return "" + locality + ", " + addr.country;
      } else {
        return "Somewhere on Earth";
      }
    }
  };

function revGeocodeOSMObj(feature) {
    /*
      # Reverse geocodes an OSM object as a geoJSON feature
    */

    var id, mqurl, request, type;
    type = feature.properties.type;
    id = feature.properties.id;
    mqurl = "http://open.mapquestapi.com/nominatim/v1/reverse?format=json&osm_type=" + type + "@osm_id=" + id;
    msgClose();
    request = $.ajax({
      url: mqurl
    });
    request.done(function(data) {
      var locstr;
      locstr = nomToString(data.address);
      return msg(locstr);
    });
    return request.fail(ajaxErrorHandler);
  };

function revGeocode() {
    /*
      # Reverse geocodes the center of the (currently displayed) map
    */

    var mqurl, request;
    mqurl = "http://open.mapquestapi.com/nominatim/v1/reverse?format=json&lat=" + map.getCenter().lat + " &lon=" + map.getCenter().lng;
    msgClose();
    request = $.ajax({
      url: mqurl
    });
    request.done(function(data) {
      var locstr;
      locstr = nomToString(data.address);
      return msg(locstr);
    });
    return request.fail(ajaxErrorHandler);
  };

function drawFeatures(features) {
    /*
      # Draw the features onto the current geojson layer. Also pulls out
      # selected features
    */

    var extent, feature, _i, _len, _results;
    _results = [];
    for (_i = 0, _len = features.length; _i < _len; _i++) {
      feature = features[_i];
      if (feature.properties.selected === true) {
        selectedFeature = feature;
      }
      geojsonLayer.addData(feature);
      extent = getExtent(selectedFeature);
      _results.push(map.fitBounds(extent));
    }
    return _results;
  };

function showTask(task) {
    /*
      # Displays a task to the display and waits for the user prompt
    */
    drawFeatures(task.features);
    revGeocode();
    setDelay(3, msgClose());
    return msgTaskText();
  };

function getChallenge(id) {
    /*
      # Gets a specific challenge
    */

    var request;
    request = $.ajax({
      url: "/api/c/challenges/" + id
    });
    request.done(function(data) {
      challenge = data;
      updateChallenge(challenge);
      updateStats(challenge);
      return getTask();
    });
    return request.fail(ajaxErrorHandler);
  };

function getNewChallenge(difficulty, near) {
    /*
      # Gets a challenge based on difficulty and location
    */

    var request, url;
    if (!near) {
      near = "" + (map.getCenter().lng) + "|" + (map.getCenter().lat);
    }
    url = "/api/c/challenges?difficulty=" + difficulty + "&contains=" + near;
    request = $.ajax({
      url: "/api/c/challenges?difficulty=" + difficulty + "&contains=" + near
    });
    request.done(function(data) {
      challenge = data.challenges[0];
      updateChallenge(challenge);
      updateStats(challenge);
      return getTask(near);
    });
    return request.fail(ajaxErrorHandler);
  };

function getTask(near) {
    var request, url;
    if (near == null) {
      near = null;
    }
    /*
      # Gets another task from the current challenge, close to the
      # location (if supplied)
    */

    if (!near) {
      near = "" + (map.getCenter().lng) + "|" + (map.getCenter().lat);
    }
    url = "/api/c/challenges/" + challenge + "/tasks?near=" + near;
    request = $.ajax({
      url: url
    });
    request.done(function(data) {
      currentTask = data[0];
      return showTask(data[0]);
    });
    return request.fail(ajaxErrorHandler);
  };

function changeMapLayer(layerUrl, layerAttrib) {
    if (layerAttrib == null) {
      layerAttrib = tileAttrib;
    }
    /*
      # Change the tile layer
    */

    map.removeLayer(tileLayer);
    tileLayer = new TileLayer(layerUrl, {
      attribution: layerAttrib
    });
    return map.addLayer(tileLayer, true);
  };

function addGeoJSONLayer() {
    /*
      # Adds a GeoJSON layer to the map
    */
    geojsonLayer = new L.geoJson(null, {
      onEachFeature: function(feature, layer) {
        if (feature.properties && feature.properties.text) {
          layer.bindPopup(feature.properties.text);
          return layer.openPopup();
        }
      }
    });
    return map.addLayer(geojsonLayer);
  };

function nextUp(action) {
    /*
      # Display a message that we're moving on to the next error, store
      # the result of the confirmation dialog in the database, and load
      # the next challenge
    */

    var near, payload, request, task_id;
    dlgClose();
    msg(msgMovingOnToTheNextChallenge);
    setDelay(1, msgClose());
    payload = {
      "action": action,
      "editor": editor
    };
    near = currentTask.center;
    challenge = currentChallenge.id;
    task_id = currentTask.id;
    request = $.ajax({
      url: "/c/" + challenge + "/task/" + task_id,
      type: "POST",
      data: payload
    });
    request.done(function() {
      return setDelay(1, function() {
        clearTask();
        return getTask(near);
      });
    });
    return request.fail(ajaxErrorHandler);
  };

function openIn(e) {
    /*
      # Open the currently displayed OSM objects in the selected editor (e)
    */

    var JOSMurl, PotlatchURL, bounds, id, loc, ne, selectedFeatureId, selectedFeatureType, sw;
    editor = e;
    if (map.getZoom() < 14) {
      msg(msgZoomInForEdit, 3);
      return false;
    }
    bounds = map.getBounds();
    sw = bounds.getSouthWest();
    ne = bounds.getNorthEast();
    selectedFeatureId = selectedFeature.properties.id;
    selectedFeatureType = selectedFeature.properties.type;
    if (editor === "josm") {
      JOSMurl = "http://127.0.0.1:8111/load_and_zoom?left=" + sw.lng + "&right=" + ne.lng + "&top=" + ne.lat + "&bottom=" + sw.lat + "&new_layer=0&select=" + selectedFeaturetype + selectedFeatureId;
      return $.ajax({
        url: JOSMurl,
        complete: function(t) {
          if (t.status === 200) {
            return setTimeout(confirmMapped, 4000);
          } else {
            return msg("JOSM remote control did not respond (" + t.status + "). Do you have JOSM running?", 2);
          }
        }
      });
    } else if (editor === "potlatch") {
      PotlatchURL = "http://www.openstreetmap.org/edit?editor=potlatch2&bbox=" + map.getBounds().toBBoxString();
      window.open(PotlatchURL);
      return setTimeout(confirmMapped, 4000);
    } else if (editor === "id") {
      if (selectedFeatureType === "node") {
        id = "n" + selectedFeatureId;
      } else if (selectedFeatureType === "way") {
        id = "w" + selectedFeatureId;
      }
      loc = "" + (map.getZoom()) + "/" + (map.getCenter().lng) + "/" + (map.getCenter().lat);
      window.open("http://geowiki.com/iD/#id=" + id + "&map=" + loc);
      return confirmMapped();
    }
  };

  this.confirmMapped = function() {
    /*
      # Show the mapping confirmation dialog box
    */

    var editorText;
    if (editor === 'josm') {
      editorText = 'JOSM';
    } else if (editor === 'potlatch') {
      editorText = 'Potlatch';
    } else if (editor === 'id') {
      editorText = 'iD';
    }
    return dlgOpen(currentChallenge.doneDlg);
  };

function showHelp() {
    /*
      # Show the about window
    */
    return dlgOpen("" + currentChallenge.help + "\n<p>" + mr_attrib + "</p>\n<p><div class='button' onClick=\"dlgClose()\">OK</div></p>", 0);
  };

function updateStats(challenge) {
    /*
      # Get the stats for the challenge and display the count of remaining
      # tasks
    */

    var request;
    request = $.ajax({
      url: "/api/c/challenges/" + challenge + "/stats"
    });
    request.done(function(data) {
      var remaining;
      remaining = data.stats.total - data.stats.done;
      return $("#counter").text(remaining);
    });
    return request.fail(ajaxErrorHandler);
  };

function updateChallenge(challenge) {
    /*
      # Use the current challenge metadata to fill in the web page
    */

    var request;
    request = $.ajax({
      url: "/api/c/challenges/" + challenge
    });
    request.done(data(function() {
      var tileURL;
      currentChallenge = data.challenge;
      $('#challengeDetails').text(currentChallenge.name);
      if ((data.tileurl != null) && data.tileurl !== tileURL) {
        tileURL = data.tileurl;
        if (data.tileattribution != null) {
          tileAttrib = data.tileasttribution;
        }
        changeMapLayer(tileURL, tileAttrib);
      }
      currentChallenge.help = markdown.makeHtml(currentChallenge.help);
      return currentChallenge.doneDlg = makeDlg(currentChallenge.doneDlg);
    }));
    return request.fail(ajaxErrorHandler);
  };

function enableKeyboardShortcuts() {
    /*
      # Enables and sets the keyboard shortcuts
    */
    return $(document).bind("keydown", function(e) {
      var key;
      key = String.fromCharCode(e);
      switch (key.which) {
        case "q":
          return nextUp("falsepositive");
        case "w":
          return nextUp("skip");
        case "e":
          return openIn('josm');
        case "r":
          return openIn('potlatch');
        case "i":
          return openIn('id');
      }
    });
  };

function init(loggedin) {
    /*
      # Find a challenge and set the map up
    */

    var near;
    map = new L.Map("map");
    map.attributionControl.setPrefix('');
    tileLayer = new L.TileLayer(tileUrl, {
      attribution: tileAttrib
    });
    map.setView(new L.LatLng(40.0, -90.0), 17);
    map.addLayer(tileLayer);
    addGeoJSONLayer();
    enableKeyboardShortcuts();
    challenge = $(document).getUrlParam("challenge");
    difficulty = $(document).getUrlParam("difficulty");
    near = $(document).getUrlParam("near");
    if (challenge != null) {
      updateChallenge(challenge);
      updateStats(challenge);
      return getTask(near);
    } else {
      if (!difficulty) {
        difficulty = 1;
      }
      if (!near) {
        near = "" + (map.getCenter().lng) + "|" + (map.getCenter().lat);
      }
      return getNewChallenge(difficulty, near);
    }
};
