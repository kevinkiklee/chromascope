const { app, imaging, core, action } = require("photoshop");

async function getDocumentPixels() {
  const doc = app.activeDocument;
  if (!doc) return null;

  const targetSize = 256;

  return await core.executeAsModal(async (context) => {
    // Use batchPlay to get composite pixel data, which avoids
    // smart object and clipboard errors from imaging.getPixels
    const [desc] = await action.batchPlay([
      {
        _obj: "get",
        _target: [
          { _property: "numberOfChannels" },
          { _ref: "document", _id: doc.id },
        ],
      },
    ], { modalBehavior: "execute" });

    const result = await imaging.getPixels({
      documentID: doc.id,
      targetSize: { width: targetSize, height: targetSize },
      colorSpace: "RGB",
      componentSize: 8,
      applyAlpha: true,
    });

    try {
      const imageData = result.imageData;
      const rawData = await imageData.getData();
      const w = imageData.width;
      const h = imageData.height;
      const hasAlpha = imageData.hasAlpha;
      const profile = imageData.colorProfile || "sRGB";

      let rgb;
      if (hasAlpha) {
        const totalPixels = w * h;
        rgb = new Uint8Array(totalPixels * 3);
        for (let i = 0; i < totalPixels; i++) {
          rgb[i * 3] = rawData[i * 4];
          rgb[i * 3 + 1] = rawData[i * 4 + 1];
          rgb[i * 3 + 2] = rawData[i * 4 + 2];
        }
      } else {
        rgb = new Uint8Array(rawData);
      }

      return { data: rgb, width: w, height: h, colorProfile: profile };
    } finally {
      result.imageData.dispose();
    }
  }, { commandName: "Chromascope: Read Pixels", interactive: true });
}

module.exports = { getDocumentPixels };
