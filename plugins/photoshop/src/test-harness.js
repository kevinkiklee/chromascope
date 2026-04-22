var _active = false;
var _onMessage = null;

function activate(renderFn, getSettingsFn, updateSettingsFn, getLastBufferFn) {
  _active = true;

  _onMessage = function (msg) {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case "test:getStatus":
        return {
          type: "test:status",
          active: true,
          ready: true,
        };

      case "test:setConfig":
        updateSettingsFn(msg.settings);
        return { type: "test:configSet" };

      case "test:render":
        renderFn(null, false);
        return { type: "test:renderStarted" };

      case "test:extractImage":
        var buf = getLastBufferFn();
        if (!buf) return { type: "test:image", data: null, error: "no render available" };
        var base64 = "";
        for (var i = 0; i < buf.length; i++) {
          base64 += String.fromCharCode(buf[i]);
        }
        return {
          type: "test:image",
          data: btoa(base64),
          width: Math.sqrt(buf.length / 4) | 0,
          height: Math.sqrt(buf.length / 4) | 0,
        };

      case "test:stop":
        _active = false;
        return { type: "test:stopped" };

      default:
        return null;
    }
  };
}

function isActive() {
  return _active;
}

function handleMessage(msg) {
  if (!_active || !_onMessage) return null;
  return _onMessage(msg);
}

module.exports = { activate, isActive, handleMessage };
