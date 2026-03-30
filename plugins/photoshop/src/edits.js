const { action, core } = require("photoshop");

async function applyHSL(params) {
  await core.executeAsModal(async () => {
    await action.batchPlay([
      {
        _obj: "make",
        _target: [{ _ref: "adjustmentLayer" }],
        using: {
          _obj: "adjustmentLayer",
          type: {
            _obj: "hueSaturation",
            adjustment: [
              {
                _obj: "hueSatAdjustmentV2",
                hue: params.hue || 0,
                saturation: params.saturation || 0,
                lightness: params.lightness || 0,
              },
            ],
          },
        },
      },
    ], { synchronousExecution: true });
  }, { commandName: "ChromaScope HSL Adjustment" });
}

async function applyColorBalance(params) {
  const descriptor = {
    _obj: "make",
    _target: [{ _ref: "adjustmentLayer" }],
    using: {
      _obj: "adjustmentLayer",
      type: {
        _obj: "colorBalance",
      },
    },
  };

  if (params.shadows) {
    descriptor.using.type.shadowLevels = params.shadows;
  }
  if (params.midtones) {
    descriptor.using.type.midtoneLevels = params.midtones;
  }
  if (params.highlights) {
    descriptor.using.type.highlightLevels = params.highlights;
  }

  await core.executeAsModal(async () => {
    await action.batchPlay([descriptor], { synchronousExecution: true });
  }, { commandName: "ChromaScope Color Balance" });
}

async function applyCurves(params) {
  const curvePoints = (params.points || [[0, 0], [255, 255]]).map(([input, output]) => ({
    _obj: "curvePoint",
    horizontal: input,
    vertical: output,
  }));

  await core.executeAsModal(async () => {
    await action.batchPlay([
      {
        _obj: "make",
        _target: [{ _ref: "adjustmentLayer" }],
        using: {
          _obj: "adjustmentLayer",
          type: {
            _obj: "curves",
            adjustment: [
              {
                _obj: "curvesAdjustment",
                channel: { _ref: "channel", _enum: "channel", _value: params.channel || "composite" },
                curve: curvePoints,
              },
            ],
          },
        },
      },
    ], { synchronousExecution: true });
  }, { commandName: "ChromaScope Curves Adjustment" });
}

async function handleEditCommand(editMsg) {
  switch (editMsg.mode) {
    case "hsl":
      await applyHSL(editMsg.params);
      break;
    case "colorGrading":
      await applyColorBalance(editMsg.params);
      break;
    case "curves":
      await applyCurves(editMsg.params);
      break;
    case "pixels":
      console.warn("Direct pixel editing not yet implemented");
      break;
  }
}

module.exports = { applyHSL, applyColorBalance, applyCurves, handleEditCommand };
