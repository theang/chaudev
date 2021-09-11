if ("undefined" === typeof(chaudev)) {
  var chaudev = {};
  chaudev = {
    DEFAULT: 0,
    defaultDeviceId: null,
    deviceNames: [],
    currentlySelected: 0,
    deviceIds: {},
    debug: true,
    filename: "background.js: ",

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
      console.error(`${chaudev.filename} Error: ${error}`);
    },

    saveToStore: function(devId) {
      if (!("undefined" === typeof(browser))) {
        chaudev.log("DEBUG: persisting deviceId " + devId);
        browser.storage.local.set({
          deviceId : devId
        });
      }
    },

    setDeviceId: function(id, persist) {
      var idToSet = id;
      if (!id) {
        idToSet = chaudev.DEFAULT;
      }
      if (idToSet != chaudev.currentlySelected) {
        chaudev.currentlySelected = idToSet;
        if (persist) {
          chaudev.log("DEBUG: persisting id: " + idToSet);
          chaudev.saveToStore(chaudev.currentlySelected);
        }
        chaudev.log("DEBUG: changing devices in all tabs to " + idToSet);
        browser.tabs.query({}).then((foundTabs) => {
          foundTabs.forEach(function(tab) {
            chaudev.log("DEBUG: changing devices in tab " + tab.id);
            browser.tabs.sendMessage(
              tab.id,
              {command:"setDeviceId", deviceId: idToSet}
            ).catch(function(err) {
              chaudev.log("Tab send message has error, skipping tab:" + tab.id, err);
            });
          });
        }).catch(chaudev.onError);
      } else {
        chaudev.log("DEBUG: no device change as " + idToSet
         + " equals to currentlySelected: " + chaudev.currentlySelected);
      }
    },

    onMessage: function(msg, sender, sendResponse) {
      if (msg.command === "setTabsDeviceId") {
        chaudev.setDeviceId(msg.devId, true);
      } else if (msg.command == "setDeviceNames") {
        chaudev.deviceNames = msg.deviceNames;
      } else if (msg.command == "getDeviceNames") {
        sendResponse({command:"getDeviceNamesResponse", deviceNames: chaudev.deviceNames});
      } else if (msg.command == "getDeviceIds") {
        if (sender.tab) {
          sendResponse({command:"getDeviceIdsResponse", deviceIds: chaudev.deviceIds[sender.tab.id]});
        } else {
          chaudev.log("getDeviceIds Sender has no tab", sender);
          sendResponse({command:"getDeviceIdsResponse", deviceIds: []});
        }
      } else if (msg.command == "setDeviceIds") {
        if (sender.tab) {
          chaudev.deviceIds[sender.tab.id] = msg.deviceIds;
          if (chaudev.deviceNames.length == 0) {
            browser.tabs.sendMessage(
              sender.tab.id,
              {command:"getDeviceNames"}
            ).then(function (response) {
              chaudev.deviceNames = response.deviceNames;
            }).catch(function(err) {
              chaudev.log("Tab send message has error, skipping getting names:" + sender.tab.id, err);
            });
          }
        } else {
          chaudev.log("Sender has no tab", sender);
        }
      } else if (msg.command == "setCurrentDeviceId") {
        chaudev.setDeviceId(msg.deviceId, true);
      } else if (msg.command == "getCurrentDeviceId") {
        chaudev.deviceIds[msg.sessionId] = msg.deviceIds;
        sendResponse({command:"getCurrentDeviceIdResponse", deviceId: chaudev.currentlySelected});
      }
    },

    sessionCleanup: function(sessionInfos) {
      sessionInfos.forEach(function(sessionInfo) {
        let id = null;
        if (sessionInfo.tab) {
          chaudev.log("DEBUG: background.js: session info: ", sessionInfo.tab);
          id = sessionInfo.tab.sessionId;
        } else {
          id = sessionInfo.window.sessionId;
        }
        chaudev.log("DEBUG: background.js: session cleanup: ", id);
        if (id && chaudev.deviceIds[id]) {
          delete chaudev.deviceIds[id];
        }
      });
    },

    handleTabRemoved: function(tabId, removeInfo) {
      chaudev.log("DEBUG: background.js: tab removed: ", tabId);
      if (tabId && chaudev.deviceIds[tabId]) {
        delete chaudev.deviceIds[tabId];
      }
    },

    sessionChanged: function() {
      browser.sessions.getRecentlyClosed({}).then(chaudev.sessionCleanup);
    },

    onLoad: function() {
      chaudev.log("DEBUG: background.js: onLoad enter");
      let get = browser.storage.local.get("deviceId");
      get.then(function(dev) {
        chaudev.log("DEBUG: background.js: initial device id from settings: ", dev);
        chaudev.setDeviceId(dev.deviceId, false);
      }).catch(chaudev.onError);
      browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        chaudev.log("DEBUG: background.js: message received: ", message);
        chaudev.onMessage(message, sender, sendResponse);
      });
      browser.tabs.onRemoved.addListener(chaudev.handleTabRemoved);
      //browser.sessions.onChanged.addListener(chaudev.sessionChanged);
    }
  };
}

(function() {
  chaudev.log("DEBUG: background.js: running topmost script");
  chaudev.onLoad();
})();
