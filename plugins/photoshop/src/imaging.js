const { app, imaging } = require("photoshop");

async function getDocumentPixels() {
  const doc = app.activeDocument;
  if (!doc) return null;

  const targetSize = 256;

  const result = await imaging.getPixels({
    documentID: doc.id,
    targetSize: { width: targetSize, height: targetSize },
    colorSpace: "RGB",
    componentSize: 8,
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
      const components = 4;
      const totalPixels = w * h;
      rgb = new Uint8Array(totalPixels * 3);
      for (let i = 0; i < totalPixels; i++) {
        rgb[i * 3] = rawData[i * components];
        rgb[i * 3 + 1] = rawData[i * components + 1];
        rgb[i * 3 + 2] = rawData[i * components + 2];
      }
    } else {
      rgb = new Uint8Array(rawData);
    }

    return { data: rgb, width: w, height: h, colorProfile: profile };
  } finally {
    result.imageData.dispose();
  }
}

module.exports = { getDocumentPixels };
