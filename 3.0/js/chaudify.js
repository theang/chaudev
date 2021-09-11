if ("undefined" === typeof(chaudev)) {
  var chaudev = {};

  chaudev = {
    DEFAULT: 0,
    defaultDeviceId: null,
    deviceIds: [],
    lastSetDeviceId: 0,
    localDeviceNames: [],

    filename: "chaudify.js: ",
    debug: true,

    log: function(str, obj) {
      if (chaudev.debug) {
        if (obj) {
          console.log(chaudev.filename + str + ": " + JSON.stringify(obj,null,4));
        } else {
          console.log(chaudev.filename + str);
        }
      }
    },

    onError: function (error) {
      console.error(`${chaudev.filename}: Error: ${error}`);
    },

    enumDevices: async function() {
      return navigator.mediaDevices.enumerateDevices().then(function (devicesEnum) {
        let deviceIds = [];
        let deviceNames = [];
        devicesEnum.forEach(function(device) {
          chaudev.log("BEGIN: forEach device", device);
          let [kind, type, direction] = device.kind.match(/(\w+)(input|output)/i);
          if (type.match(/audio/i) && direction.match(/output/i)) {
            chaudev.log();
            deviceIds.push(device.deviceId);
            let lbl = device.label;
            if (lbl !== '') {
              deviceNames.push(lbl);
            }
          }
        });
        chaudev.log("device Ids gathered: " + JSON.stringify(deviceIds));
        if ((deviceNames.length > 0) && ((deviceNames.length != chaudev.localDeviceNames.length) 
                                       || !chaudev.localDeviceNames.every((value, index) => value === deviceNames[index]))) {
          chaudev.localDeviceNames = deviceNames;
        }
        browser.runtime.sendMessage({command:"setDeviceIds",
          deviceIds: deviceIds
        });
        chaudev.deviceIds = deviceIds;
        return deviceIds;
      });
    },

    enumDevicesWithNames: async function() {
      chaudev.log("BEGIN: updateDevicesWithNames");
      chaudev.log("BEGIN: updateDevicesWithNames2", window.parent === window);
      chaudev.log("BEGIN: updateDevicesWithNames3", window.opener === null);
      return navigator.mediaDevices.getUserMedia({audio:true,video:false}).then(function (stream) {
        chaudev.log("BEGIN: getUserMedia");
        return chaudev.enumDevices();
      }).catch(function (err) {
        chaudev.log("ERROR: updateDevices", err);
        return chaudev.enumDevices();
      });
    },

    gatherDeviceIds: async function() {
      if (chaudev.deviceIds.length > 0) {
        return chaudev.deviceIds;
      } else {
        return browser.runtime.sendMessage({command:"getDeviceIds"
        }).then(function(response){
          if ((response.deviceIds) && (response.deviceIds.length > 0)) {
            chaudev.deviceIds = response.deviceIds;
            return chaudev.deviceIds;
          } else {
            return chaudev.enumDevicesWithNames();
          }
        });
      }
    },

    setDeviceIdForNodes: function(id, avtags) {
      chaudev.gatherDeviceIds().then(function(deviceIds) {
        chaudev.log("setDeviceIdForNodes: setting Device id: ", deviceIds);
        let idOrDef = id;
        if (!id) {
          idOrDef = chaudev.DEFAULT;
        }

        if ((idOrDef > 0) && (deviceIds.length < idOrDef)) {
          throw ("no deviceid for " + idOrDef);
        }
        let promises = [];
        if (avtags.length > 0) {
          if (!chaudev.defaultDevice) {
            chaudev.defaultDeviceId = avtags[0].sinkId;
          }
          let idToSet = chaudev.defaultDeviceId;
          if (idOrDef !== chaudev.DEFAULT) {
            idToSet = deviceIds[idOrDef - 1];
          }
          chaudev.log("setDeviceId: setting Device id: " + idToSet);
          for (let av of avtags) {
            chaudev.log("setSinkId: " + av.nodeName + " : " + av.currentSrc);
            promises.push(av.setSinkId(idToSet));
          }
          Promise.all(promises).then(function(results){
            chaudev.log("setDeviceId: all done: " + results.length);
          }).catch(function(err){
            chaudev.log("setDeviceId: failed with error: " + err);
          });
        } else {
          chaudev.log("setDeviceId: no audio and video found")
        }
      }).catch(chaudev.onError);
    },

    setDeviceId: function(id) {
      chaudev.log("BEGIN: set device id: " + id);
      const avtags = document.querySelectorAll('audio,video');
      if ((id || chaudev.DEFAULT) == chaudev.lastSetDeviceId) {
        chaudev.log("id to set equals lastSetDeviceId skip setting device id");
      } else {
        chaudev.lastSetDeviceId = id;
        if (avtags.length > 0) {
          chaudev.setDeviceIdForNodes(id, avtags);
        }
      }
    },

    onMessage: function(msg, sender, sendResponse) {
      chaudev.log("BEGIN: message got: ", msg);
      if (msg.command === "setDeviceId") {
        chaudev.setDeviceId(msg.deviceId);
      } else if (msg.command === "getDeviceNames") {
        chaudev.log("getDeviceNames, sending response: " + chaudev.localDeviceNames)
        sendResponse({command:"getDeviceNamesResponse", deviceNames: chaudev.localDeviceNames});
      } else {
        chaudev.log("unknown command ignored")
      }
    },

    isAudioOrVideo: function(node) {
      let name = node.nodeName;
      return ((name == "AUDIO") || (name == "VIDEO"));
    },

    getDeviceIdFromLocalStorage: async function() {
      let get = browser.storage.local.get("deviceId");
      return get.then(function(dev) {
        return dev.deviceId;
      }, chaudev.onError);
    },

    onLoad: function() {
      chaudev.getDeviceIdFromLocalStorage().then(function(deviceId) {
        chaudev.setDeviceId(deviceId);
      });
      browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        chaudev.onMessage(message, sender, sendResponse);
      });
      let observer = new MutationObserver(function(mutations, obs) {
          let nodes = [];
          mutations.forEach(function(mutation) {
            if (mutation.type == "childList") {
              mutation.addedNodes.forEach(function(el) {
                if (chaudev.isAudioOrVideo(el)) {
                  nodes.push(el);
                } // if isAudioOrVideo
              }); //forEach addedNodes
            } else {  //if mutation.type
              chaudev.log("unknown mutation: ", mutation);
            }
          });
          if (nodes.length > 0) {
            chaudev.getDeviceIdFromLocalStorage().then(function(deviceId) {
              chaudev.log("observer setting deviceId: " + deviceId);
              chaudev.setDeviceIdForNodes(deviceId, nodes);
            });
          }
        });
      observer.observe(document.documentElement, {
        childList: true,
        subtree:true
      });
    }
  };
}

(function() {
  if (!window.chaudevRun) {
    window.chaudevRun = true;
    chaudev.log("onLoad called from global context");
    chaudev.onLoad();
  }
})();
