// ExtendScript to create a test document in Photoshop
// Run via: osascript -e 'tell application "Adobe Photoshop 2025" to do javascript file "/path/to/create-test-doc.jsx"'

var doc = app.documents.add(1000, 1000, 72, "Chromascope Test", NewDocumentMode.RGB, DocumentFill.WHITE);

var halfW = 500, halfH = 500;

// Top-left: Red
doc.selection.select([[0, 0], [halfW, 0], [halfW, halfH], [0, halfH]]);
var red = new SolidColor(); red.rgb.red = 255; red.rgb.green = 0; red.rgb.blue = 0;
doc.selection.fill(red);

// Top-right: Green
doc.selection.select([[halfW, 0], [1000, 0], [1000, halfH], [halfW, halfH]]);
var green = new SolidColor(); green.rgb.red = 0; green.rgb.green = 255; green.rgb.blue = 0;
doc.selection.fill(green);

// Bottom-left: Blue
doc.selection.select([[0, halfH], [halfW, halfH], [halfW, 1000], [0, 1000]]);
var blue = new SolidColor(); blue.rgb.red = 0; blue.rgb.green = 0; blue.rgb.blue = 255;
doc.selection.fill(blue);

// Bottom-right: Skin tone
doc.selection.select([[halfW, halfH], [1000, halfH], [1000, 1000], [halfW, 1000]]);
var skin = new SolidColor(); skin.rgb.red = 210; skin.rgb.green = 160; skin.rgb.blue = 120;
doc.selection.fill(skin);

doc.selection.deselect();
