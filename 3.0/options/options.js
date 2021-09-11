if ("undefined" === typeof(chaudev)) {
  var chaudev = {};

  chaudev = {
    DEFAULT: 0,
    updating: false,
    filename: "options.js: ",
    deviceNames: [],
    debug:true,
    AUDIO_DEVICE: browser.i18n.getMessage("optionsGenericAudioDevice"),

    log: function(str, obj) {
      if (chaudev.debug) {
        if (obj) {
          console.log(chaudev.filename + str + ": " + JSON.stringify(obj,null,4));
        } else {
          console.log(chaudev.filename + str);
        }
      }
    },

    onError: function(error) {
      console.log(`Error(options.js): ${error}`);
    },

    propagateSelection: function(deviceId) {
      chaudev.log("propagateSelection: " + deviceId);
      browser.runtime.sendMessage({command:"setTabsDeviceId", devId: deviceId }).catch(chaudev.onError);
    },

    iterInput: function(findCond, iterFunc) {
      const form = document.getElementById("chdev");
      let index = 0;
      if (form != null) {
        const inputs = form.getElementsByTagName("input");
        if (inputs != null) {
          for (let input of inputs) {
            if (input.type == "radio") {
              let label = input.parentNode.getElementsByTagName("label").item(0);
              if (iterFunc != null) {
                iterFunc(input, label, index);
              }
              if (findCond != null) {
                if (findCond(input, label, index)) {
                  return input;
                }
              }
              index++;
            }
          }
        }
      }
      return null;
    },

    createDeviceDiv: function(dev) {
      let newOption = document.createElement('div');
      let newInput = document.createElement('input');
      newInput.type = "radio";
      newInput.id = dev.id;
      newInput.value = dev.val;
      newInput.name = "dev";
      newInput.checked = dev.isSelected;
      //newInput.setAttribute("onclick", "chaudev.onChange(event.target)");
      newInput.addEventListener("change", chaudev.onChange);
      let newLabel = document.createElement('label');
      newLabel.setAttribute("for", dev.id);
      newLabel.textContent = ( dev.label || dev.id );
      newOption.appendChild(newInput);
      newOption.appendChild(newLabel);
      return newOption;
    },

    onChange : function() {
      let opt = this;
      chaudev.log("DEBUG: onChange = " + opt.value + ", " + opt.checked);
      let deviceId = opt.value;
      if (opt.checked && (!chaudev.updating)) {
        chaudev.log("DEBUG: New id = " + deviceId);
        browser.runtime.sendMessage({command:"setTabsDeviceId", devId: deviceId }).catch(chaudev.onError);
      }
    },

    updateDevicesWithNamesFromPopup: function() {
      browser.tabs.create({url:'options.html#names'});
    },

    updateDevicesWithNames: function() {
      chaudev.log("BEGIN: updateDevicesWithNames");
      chaudev.log("BEGIN: updateDevicesWithNames2", window.parent === window);
      chaudev.log("BEGIN: updateDevicesWithNames3", window.opener === null);
      window.navigator.mediaDevices.getUserMedia({audio:true,video:false}).then(function (stream) {
        chaudev.log("BEGIN: getUserMedia");
        chaudev.updateDevicesWithDefault();
      }).catch(function (err) {
        chaudev.log("ERROR: updateDevices", err);
        chaudev.updateDevicesWithDefault();
      });
    },

    updateDevicesWithDefault: function() {
      let get = browser.storage.local.get("deviceId");
      get.then(function(dev) {
        chaudev.log("DEBUG: device id from local storage: ", dev);
        if (dev.deviceId) {
          chaudev.updateDevices(dev.deviceId);
        } else {
          chaudev.updateDevices(chaudev.DEFAULT);
        }
      }).catch(function(err) {
        chaudev.onError(err);
        chaudev.log("DEBUG: could not detect device id from local storage");
        chaudev.updateDevices(chaudev.DEFAULT);
      });
    },

    inputIterFunc: function(input, label, index, devices, defaultId) {
      chaudev.log("DEBUG: inputIterFunc1:" + index);
      chaudev.log("DEBUG: inputIterFunc2:" + defaultId);
      let dev = {};
      if ((devices.length >= index) && (index > 0)) {
        dev = devices[index - 1];
      }
      if (index != chaudev.DEFAULT) {
        if (devices.length < index) {
          //remove current element, and move to next
          if (input.checked) {
            changed = true;
          }
          input.parentNode.parentNode.removeChild(input.parentNode);
        } else {
          input.parentNode.parentNode.replaceChild(chaudev.createDeviceDiv(dev), input.parentNode);
        } //else
      } else { // if devId != chaudev.DEFAULT
        if (defaultId == chaudev.DEFAULT) {
          chaudev.log("DEBUG: set checked for default option");
          input.checked = true;
        }
      }
    },

    mapDevices: function(defaultId, devicesEnum) {
      let devices = [];
      let names = [];
      let current = 1;

      devicesEnum.forEach(function(device) {
        chaudev.log("BEGIN: forEach device", device);
        let [kind, type, direction] = device.kind.match(/(\w+)(input|output)/i);
        if (type.match(/audio/i) && direction.match(/output/i)) {
          let lbl = device.label;
          if (lbl == '') {
            lbl = chaudev.AUDIO_DEVICE + " " + current;
          } else {
            names.push(device.label);
          }
          devices.push({
            label: lbl,
            val: current,
            isSelected: (defaultId == current),
            id: "dev" + current
          });
          current++;
        }
      });
      return {devices:devices, names:names};
    },

    updateDevices: function(defaultId) {
      chaudev.log("BEGIN: updateDevices");
      navigator.mediaDevices.enumerateDevices().then(function (devicesEnum) {
        chaudev.log("BEGIN: enumerateDevices");
        chaudev.updating = true;
        let deviceMap = chaudev.mapDevices(defaultId, devicesEnum);
        chaudev.log("BEGIN: updateDevices deviceMap", deviceMap);
        let changed = false;
        let namesAvailable = false;
        if (chaudev.deviceNames.length > 0 && deviceMap.devices.length == 0) {
          chaudev.deviceNames.forEach(function (name, index) {
            deviceMap.devices.push({label: name,
                                    val: index + 1,
                                    isSelected: (index+1 == defaultId),
                                    id: "dev" + (index + 1)});
          });
        }
        if (deviceMap.devices.length > 0) {
          if (deviceMap.names.length > 0) {
            browser.runtime.sendMessage({command:"setDeviceNames",
              deviceNames: deviceMap.names }).catch(chaudev.onError);
            chaudev.deviceNames = deviceMap.names;
            namesAvailable = true;
          } else if (chaudev.deviceNames.length > 0) {
            for (let i = 0; (i < chaudev.deviceNames.length) && (i < deviceMap.devices.length); i++) {
              deviceMap.devices[i].label=chaudev.deviceNames[i];
            }
            namesAvailable = true;
          } else {
            // redirect to options page here
          }

          if (namesAvailable) {
            document.getElementById("show_names").style.display = "none";
          }

          let current = 0;
          chaudev.iterInput(null, function(input, label, index) {
            chaudev.inputIterFunc(input, label, index, deviceMap.devices, defaultId);
            current ++;
          });

          while (deviceMap.devices.length + 1 > current) {
            let dev = deviceMap.devices[current - 1];
            let chdev = document.getElementById("chdev");
            chdev.appendChild(chaudev.createDeviceDiv(dev));
            current++;
          }
        }
        chaudev.updating = false;
      });
    },

    localize: function() {
      const toLocalize = document.querySelectorAll("[data-localize]");
      chaudev.log("Current locale: " + browser.i18n.getUILanguage());
      const parser = new DOMParser();
      for (let tag of toLocalize) {
        chaudev.log("BEGIN: localizing: " + tag.nodeName);
        let name = tag.getAttribute("data-localize");
        let localizedMessage = browser.i18n.getMessage(name);
        chaudev.log("BEGIN: localized: " + name + ": " + localizedMessage);
        if (localizedMessage != name) {
          if (localizedMessage.indexOf("<") != -1) {
            const html = parser.parseFromString(localizedMessage, "text/html");
            const body = html.getElementsByTagName("body")[0];
            while (tag.firstChild) {
              tag.removeChild(tag.lastChild);
            }
            tag.innerHTML = '';
            const childNodes = Array.from(body.childNodes);
            childNodes.forEach(function(cnode) {
              chaudev.log("BEGIN: localizing, adding: " + cnode.nodeName);
              tag.appendChild(cnode);
            });
          } else {
            tag.textContent = localizedMessage;
          }
        }
      }
    },

    init: function() {
      chaudev.log("BEGIN: init " + document.URL);
      chaudev.log("BEGIN: platform ", browser.runtime.getPlatformInfo())
      chaudev.localize();
      let idx = document.URL.indexOf("#");
      let mode = ((idx != -1) ? document.URL.substring(idx+1) : "common");
      chaudev.log("BEGIN: mode " + mode);
      let audioTest = document.getElementById("audioTest");
      if (typeof audioTest.setSinkId === "function") {
        document.querySelector("#default").addEventListener("change", chaudev.onChange);
        let showNames = document.querySelector("#show_names");
        if ((mode == "common") || (mode == "names")) {
          showNames.addEventListener("click", chaudev.updateDevicesWithNames);
        } else {
          showNames.addEventListener("click", chaudev.updateDevicesWithNamesFromPopup);
        }
        chaudev.log("BEGIN: set up mediaDevices");
        navigator.mediaDevices.ondevicechage = function (e) {
          /*TODO: proper handling here is to reset everything: setDeviceId to 0 (default), and clean all deviceIds*/
          chaudev.updateDevicesWithDefault();
        };
        let updateDevices = chaudev.updateDevicesWithDefault;
        if (mode == "names") {
          updateDevices = chaudev.updateDevicesWithNames;
        }
        browser.runtime.sendMessage({command:"getDeviceNames" }).then((response) => {
          chaudev.log("BEGIN: deviceNames: ", response.deviceNames);
          chaudev.deviceNames = response.deviceNames;
          chaudev.log("BEGIN: getDeviceNames response: mode " + mode);
          if ((mode == "popup") && chaudev.deviceNames.length == 0) {
            chaudev.log("Starting from firefox 91.0 we cannot enumerate audiooutput devices in options popup until we open options page and ask for mic permissions");
            chaudev.updateDevicesWithNamesFromPopup();
            window.close()
            return;
          }
          updateDevices();
        }).catch((err) => {
          chaudev.onError(err);
          updateDevices();
        });
      } else {
        let panel = document.getElementById("panel");
        let help = document.getElementById("help");
        help.style.display = "block";
        panel.style.display = "none";
      }
    }
  }
}

chaudev.log("global: load");

document.addEventListener("DOMContentLoaded", chaudev.init);
