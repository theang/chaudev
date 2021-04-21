if ("undefined" === typeof(chaudev)) {
  var chaudev = {};

  chaudev = {
    DEFAULT: 0,
    defaultDeviceId: null,
    deviceIds: [],
    lastSetDeviceId: 0,

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

    enumDevices: function() {
      return navigator.mediaDevices.enumerateDevices().then(function (devicesEnum) {
        let deviceIds = [];
        devicesEnum.forEach(function(device) {
          chaudev.log("BEGIN: forEach device", device);
          let [kind, type, direction] = device.kind.match(/(\w+)(input|output)/i);
          if (type.match(/audio/i) && direction.match(/output/i)) {
            deviceIds.push(device.deviceId);
          }
        });
        return deviceIds;
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
            browser.runtime.sendMessage({command:"setDeviceIds",
              deviceIds: chaudev.deviceIds
            });
            return chaudev.deviceIds;
          } else {
            return chaudev.enumDevices();
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
        chaudev.setDeviceIdForNodes(id, avtags);
      }
    },

    onMessage: function(msg) {
      chaudev.log("BEGIN: message got: ", msg);
      if (msg.command === "setDeviceId") {
        chaudev.setDeviceId(msg.deviceId);
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
      browser.runtime.onMessage.addListener((message) => {
        chaudev.onMessage(message);
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
