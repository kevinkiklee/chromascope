# Adobe UXP Photoshop Plugin API Reference

Comprehensive reference for building UXP plugins for Photoshop. Compiled from the official AdobeDocs/uxp-photoshop and AdobeDocs/uxp documentation repositories (UXP v8.1.0, Manifest v5).

---

## Table of Contents

1. [HTML Element Support](#html-element-support)
2. [Unsupported HTML Elements](#unsupported-html-elements)
3. [Unsupported HTML Attributes](#unsupported-html-attributes)
4. [CSS Support](#css-support)
5. [CSS Limitations](#css-limitations)
6. [Canvas API](#canvas-api)
7. [Imaging API](#imaging-api)
8. [Spectrum UXP Components](#spectrum-uxp-components)
9. [Panel Sizing and Layout](#panel-sizing-and-layout)
10. [Event System](#event-system)
11. [ExecuteAsModal](#executeasmodal)
12. [DOM Limitations](#dom-limitations)
13. [Theme Awareness](#theme-awareness)
14. [Manifest v5 Configuration](#manifest-v5-configuration)
15. [Known Issues](#known-issues)

---

## HTML Element Support

UXP supports a subset of standard HTML elements. The following are confirmed working:

### Structural Elements
- `<html>`, `<head>`, `<body>`, `<script>`, `<style>`, `<link>`
- `<div>`, `<span>`, `<p>`, `<a>`
- `<h1>` through `<h6>`, `<hr>`, `<footer>`

### Form Elements
- `<input>` -- Supported types: text, password, number, range, checkbox, radio, search. **Not supported**: `type="file"`, `type="color"`.
- `<select>` -- Works but `<option>` tags require explicit `value` attribute or `select.value` returns `undefined`. Setting `<select value="..."/>` does not show the selected value; use `setAttribute` or the `selected` attribute on the `<option>`.
- `<textarea>` -- Size cannot be set with `rows`/`cols`; use CSS width/height instead.
- `<button>` -- Standard button element.
- `<label>` -- `<label for="id"/>` is **not supported**; wrap the label around the control instead. Uses `inline-flex` with wrapping; disable with `flex-wrap: nowrap`.
- `<form>` -- Only supports `method="dialog"`, not URL submission. Without explicit width, block elements inside won't span full width.
- `<progress>` -- Works but is not theme-aware.

### Media Elements
- `<img>` -- Works. In dialogs, requires explicit `width`/`height` or the dialog resizes incorrectly. Ignores embedded EXIF rotation. Grayscale images fail to render but occupy DOM space. Failed images do not display a broken-icon placeholder.
- `<video>` -- Full HTMLVideoElement API available (v7.4.0+): `play()`, `pause()`, `stop()`, `load()`, `fastSeek()`, `canPlayType()`. Supports `src`, `currentTime`, `duration`, `volume`, `muted`, `loop`, `playbackRate`, `videoWidth`, `videoHeight`, audio/video/text tracks.
- `<canvas>` -- Supported since v7.0.0. See [Canvas API](#canvas-api) section.
- `<webview>` -- Available in manifest v5 (UXP 6.0+), modal dialogs only. Must declare allowed domains in manifest.

### Other Supported Elements
- `<dialog>` -- Modal and non-modal. `showModal()` returns a Promise. `show()` accepts positioning options.
- `<template>`, `<slot>` -- Custom element infrastructure is available.
- `<menu>`, `<menuitem>` -- Basic support.

### Input Element Properties
| Property | Type | Notes |
|----------|------|-------|
| `value` | * | Current value |
| `defaultValue` | string | Default value (known issue: may not work) |
| `checked` | boolean | Checkbox state |
| `indeterminate` | boolean | Indeterminate state |
| `disabled` | boolean | Disabled state |
| `type` | string | Input type |
| `placeholder` | string | Placeholder text |
| `readOnly` | boolean | Read-only state |
| `min`, `max`, `step` | string | Range input constraints |
| `selectionStart`, `selectionEnd` | number | Text selection bounds |
| `uxpVariant` | string | UXP styling variant |
| `uxpQuiet` | string | Quiet mode rendering |

### Select Element Properties
| Property | Type | Notes |
|----------|------|-------|
| `value` | string | Currently selected value |
| `selectedIndex` | number | Index of selected option |
| `selectedOptions` | Array\<Node\> | Currently selected option nodes |
| `options` | NodeList | All option elements (read-only) |
| `uxpVariant` | string | Styling variant |
| `uxpQuiet` | string | Quiet mode |

---

## Unsupported HTML Elements

These elements are **not supported** and are treated as simple `<div>` elements:

- `<ul>`, `<ol>`, `<li>` -- Lists are unsupported; style as divs with CSS for list-like appearance
- `<i>`, `<em>` -- Use CSS `font-style: italic` instead
- `<title>` -- Not functional in UXP context
- `<input type="file">` -- No file picker input
- `<input type="color">` -- No color picker input
- `<iframe>` -- Use `<webview>` in manifest v5 dialogs instead

**Workaround for lists**: Use flexbox column layout with custom bullet styling via `::before` pseudo-elements.

---

## Unsupported HTML Attributes

The following global attributes do **not work** in UXP:

| Attribute | Notes |
|-----------|-------|
| `accesskey` | Not supported |
| `aria-*` | All ARIA attributes unsupported |
| `autocapitalize` | Not supported |
| `contenteditable` | Not supported |
| `contextmenu` | Not supported |
| `dir` | Not supported |
| `draggable` / `dropzone` | Drag and Drop is fully unsupported |
| `hidden` | Not supported |
| `inputmode` | Not supported |
| `is` | Not supported |
| `item*` | Not supported |
| `part` | Not supported |
| `spellcheck` | Not supported |
| `tabindex` | Partial: positive values allow focus, but tab order cannot be specified. Negative values prevent focus. |
| `translate` | Not supported |

**Event handler attributes**: Most `on*` attributes should not be used. Attach event handlers using `addEventListener` instead.

**Unitless dimension attributes**: `width="300"` does not work in UXP v3.1.0+. Use `width="300px"` or CSS styling.

---

## CSS Support

### Supported Properties

**Layout (Flexbox-based)**:
- `display`: `none`, `inline`, `block`, `inline-block`, `flex`, `inline-flex`
- `flex`, `flex-basis`, `flex-direction`, `flex-grow`, `flex-shrink`, `flex-wrap`
- `align-content`, `align-items`, `align-self`, `justify-content`
- `position` (with `top`, `bottom`, `left`, `right`)
- `overflow`, `overflow-x`, `overflow-y`

**Box Model**:
- `width`, `height`, `min-width`, `min-height`, `max-width`, `max-height`
- `margin` (and directional variants)
- `padding` (and directional variants)
- `border` (and directional variants for color, style, width)
- `border-radius` (and corner-specific variants)

**Typography**:
- `font-family`, `font-size`, `font-style`, `font-weight`
- `color`, `letter-spacing`, `text-align`, `text-overflow`, `white-space`

**Background**:
- `background`, `background-color`
- `background-image` -- Supports `url('plugin://assets/filename')`, `linear-gradient()`, `radial-gradient()`
- `background-size`, `background-repeat` (declared but repeat does not work), `background-attachment`

**Visual**:
- `opacity`, `visibility`

### Supported Units
`px`, `em`, `rem`, `vh`, `vw`, `vmin`, `vmax`, `cm`, `mm`, `in`, `pc`, `pt`

### Supported Features
- `calc()` -- Works for length values and numeric portions of `rgb()`. Example: `width: calc(100vh - 50px)`
- CSS Variables (Custom Properties) -- Fully supported, including with `prefers-color-scheme` for theming
- `var()` function

### Supported Selectors
- Type selector (`div`)
- Class selector (`.class`)
- ID selector (`#id`)
- Universal selector (`*`)
- Attribute selector (`[attr]`, `[attr=value]`)
- Child combinator (`>`)
- Descendant combinator (space)
- Adjacent sibling combinator (`+`)
- General sibling combinator (`~`)

### Supported Pseudo-classes
`active`, `checked`, `defined`, `disabled`, `empty`, `enabled`, `first-child`, `focus`, `hover`, `last-child`, `nth-child`, `nth-last-child`, `nth-last-of-type`, `nth-of-type`, `only-child`, `root`

### Supported Pseudo-elements
`::after`, `::before`

### Supported Media Queries
- `width`
- `height`
- `prefers-color-scheme` -- Responds to Photoshop theme (Darkest, Dark, Light, Lightest)

---

## CSS Limitations

These standard CSS features are **not available** in UXP:

| Feature | Status |
|---------|--------|
| `font` shorthand | Not supported; use individual `font-*` properties |
| `text-transform` | Not supported (no uppercase/lowercase/capitalize) |
| CSS transitions | Not supported |
| CSS animations / `@keyframes` | Not supported |
| `transform` | Not supported |
| `box-shadow` | Not supported |
| `text-shadow` | Not supported |
| `grid` layout | Not supported; use flexbox |
| `position: sticky` | Not supported |
| `z-index` | Limited support |
| `float` / `clear` | Not supported |
| `cursor` | Limited; cursor may not revert properly |
| `background-repeat` | Declared but does not function; images do not repeat |
| `border-color: unset` | May not reset to initial value |
| `baseline` alignment | Supported but buggy and unreliable |
| `text-decoration` | Limited support |
| `:before` / `:after` with `content` | Supported but limited |

**Key architectural note**: UXP uses a custom layout engine, not a browser engine. Flexbox is the primary layout mechanism. There is no CSS Grid support.

---

## Canvas API

### HTMLCanvasElement (v7.0.0+)

UXP supports `<canvas>` with a 2D rendering context only.

```javascript
const canvas = document.createElement('canvas');
canvas.width = 400;
canvas.height = 400;
const ctx = canvas.getContext('2d'); // Only '2d' is supported
```

**Properties**: `width`, `height`

**Methods**: `getContext('2d')` -- returns `CanvasRenderingContext2D`

**NOT available**: `toDataURL()`, `toBlob()`, `getContext('webgl')`, `getContext('webgl2')`, `transferControlToOffscreen()`

### CanvasRenderingContext2D

**Style Properties**:
| Property | Type | Description |
|----------|------|-------------|
| `lineWidth` | number | Line thickness |
| `lineJoin` | string | How line segments connect |
| `lineCap` | string | Endpoint appearance |
| `globalAlpha` | number | Transparency (0-1) |
| `fillStyle` | string \| CanvasGradient | Interior color/gradient |
| `strokeStyle` | string | Outline color |

**Path Methods**:
- `beginPath()`, `closePath()`
- `moveTo(x, y)`, `lineTo(x, y)`
- `arc(x, y, radius, startAngle, endAngle, counterclockwise)`
- `arcTo(x1, y1, x2, y2, radius)`
- `bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y)`
- `quadraticCurveTo(cpx, cpy, x, y)`
- `rect(x, y, width, height)`

**Drawing Methods**:
- `fill()`, `stroke()`
- `fillRect(x, y, width, height)`
- `strokeRect(x, y, width, height)`
- `clearRect(x, y, width, height)` -- **Known issue**: may not work on Windows

**Gradient Methods**:
- `createLinearGradient(x0, y0, x1, y1)` -- **Known issue**: may not work on Windows
- `createRadialGradient(x0, y0, r0, x1, y1, r1)` -- **Known issue**: may not work on Windows

**NOT available**: `drawImage()`, `getImageData()`, `putImageData()`, `createImageData()`, `fillText()`, `strokeText()`, `measureText()`, `save()`, `restore()`, `translate()`, `rotate()`, `scale()`, `setTransform()`, `clip()`, `createPattern()`, `globalCompositeOperation`, `shadowBlur`, `shadowColor`, `shadowOffsetX`, `shadowOffsetY`, `imageSmoothingEnabled`

### Path2D (v7.0.0+)

```javascript
const path = new Path2D();
path.moveTo(10, 10);
path.lineTo(100, 100);
path.arc(50, 50, 40, 0, Math.PI * 2);
ctx.fill(path);
```

**Methods**: `addPath(path)`, `closePath()`, `moveTo(x, y)`, `lineTo(x, y)`, `bezierCurveTo()`, `quadraticCurveTo()`, `arc()`, `arcTo()`, `rect(x, y, w, h)`

### CanvasGradient

```javascript
const gradient = ctx.createLinearGradient(0, 0, 200, 0);
gradient.addColorStop(0, 'red');
gradient.addColorStop(1, 'blue');
ctx.fillStyle = gradient;
```

**Methods**: `addColorStop(offset, colorValue)` -- offset is 0-1.

### Canvas Limitations Summary

The UXP canvas is explicitly described as supporting "only basic shapes for now." Critical limitations for our vectorscope use case:

1. **No `drawImage()`** -- Cannot draw images onto canvas
2. **No `getImageData()` / `putImageData()`** -- Cannot read/write pixel data from canvas
3. **No `toDataURL()` / `toBlob()`** -- Cannot export canvas content
4. **No text rendering** -- No `fillText()` or `strokeText()`
5. **No transforms** -- No `translate()`, `rotate()`, `scale()`
6. **No compositing** -- No `globalCompositeOperation`
7. **No patterns** -- No `createPattern()`
8. **Windows issues** -- `clearRect()`, `createLinearGradient()`, `createRadialGradient()` may fail

**Implication for Chromascope**: The canvas API is too limited for our vectorscope rendering. We use the core library bundled as a single HTML file via vite-plugin-singlefile, which embeds a full canvas implementation in the WebView. Alternatively, the Imaging API can be used to process pixel data in JavaScript and display results via `<img>` elements using `encodeImageData()`.

---

## Imaging API

Access via `const imaging = require("photoshop").imaging;`

All imaging methods must be called within `executeAsModal`.

### PhotoshopImageData

Object representing image pixel data.

**Properties**:
| Property | Type | Description |
|----------|------|-------------|
| `width` | number | Width in pixels |
| `height` | number | Height in pixels |
| `colorSpace` | string | "RGB", "Grayscale", or "Lab" |
| `colorProfile` | string | e.g., "sRGB IEC61966-2.1" |
| `hasAlpha` | boolean | Alpha channel present |
| `components` | number | Components per pixel (3=RGB, 4=RGBA, 1=Gray) |
| `componentSize` | number | 8, 16, or 32 bits per component |
| `pixelFormat` | string | "RGB", "RGBA", "Grayscale", "GrayscaleAlpha", "LAB", "LABAlpha" |
| `isChunky` | boolean | true=interleaved (RGBRGB), false=planar (RRGGBB) |
| `type` | string | Currently only "image/uncompressed" |

**Methods**:
- `getData(options?)` -- Returns `Promise<Uint8Array | Uint16Array | Float32Array>`
  - `options.chunky` (boolean, default true): Memory layout
  - `options.fullRange` (boolean, default false): For 16-bit, use [0..65535] instead of [0..32768]
- `dispose()` -- Synchronous. Releases memory immediately. **Always call when done.**

### getPixels(options)

Retrieve pixel data from the active document or a specific layer.

```javascript
const imageObj = await imaging.getPixels({
    documentID: doc.id,           // optional, defaults to active doc
    layerID: layer.id,            // optional, omit for composite
    historyStateID: stateId,      // optional, for historical states
    sourceBounds: {               // optional, crop region
        left: 0, top: 0,
        right: 300, bottom: 300
    },
    targetSize: { height: 100 },  // optional, scale down
    colorSpace: "RGB",            // optional: "RGB", "Grayscale", "Lab"
    colorProfile: "sRGB IEC61966-2.1", // optional
    componentSize: 8,             // optional: -1 (source), 8, 16, 32
    applyAlpha: false             // optional: premultiply alpha with white matte
});

// Returns: { imageData: PhotoshopImageData, sourceBounds: Object, level: Number }
const pixelData = await imageObj.imageData.getData();
// pixelData is Uint8Array for 8-bit, Uint16Array for 16-bit, Float32Array for 32-bit

imageObj.imageData.dispose(); // ALWAYS dispose when done
```

### putPixels(options)

Write pixel data to a layer.

```javascript
await imaging.putPixels({
    layerID: layer.id,            // REQUIRED
    documentID: doc.id,           // optional
    imageData: imageData,         // REQUIRED: PhotoshopImageData
    replace: true,                // optional: false blends with existing
    targetBounds: { left: 0, top: 0 }, // optional: insertion point
    commandName: "My Edit"        // optional: history panel label
});
```

### createImageDataFromBuffer(arrayBuffer, options)

Create PhotoshopImageData from raw pixel buffer.

```javascript
const width = 100, height = 100, components = 4; // RGBA
const buffer = new Uint8Array(width * height * components);

// Fill with red pixels
for (let i = 0; i < buffer.length; i += 4) {
    buffer[i] = 255;     // R
    buffer[i + 1] = 0;   // G
    buffer[i + 2] = 0;   // B
    buffer[i + 3] = 255; // A
}

const imageData = await imaging.createImageDataFromBuffer(buffer, {
    width: width,               // REQUIRED
    height: height,             // REQUIRED
    components: components,     // REQUIRED
    colorSpace: "RGB",          // REQUIRED: "RGB", "Grayscale", "Lab"
    colorProfile: "sRGB IEC61966-2.1", // optional
    chunky: true,               // optional, default true
    fullRange: false            // optional, for 16-bit only
});
```

**Buffer constraint**: Array element count must equal `width * height * components`.

**Grayscale mask example**:
```javascript
const maskBuffer = new Uint8Array(width * height); // 1 component
const maskData = await imaging.createImageDataFromBuffer(maskBuffer, {
    width, height,
    components: 1,
    chunky: false,
    colorProfile: "Gray Gamma 2.2",
    colorSpace: "Grayscale"
});
```

### encodeImageData(options)

Encode PhotoshopImageData to JPEG for display in `<img>` elements.

```javascript
const jpegBase64 = await imaging.encodeImageData({
    imageData: imageObj.imageData,  // REQUIRED: must be RGB color space
    base64: true                    // optional: return base64 string
});

const img = document.createElement('img');
img.src = "data:image/jpeg;base64," + jpegBase64;
document.body.appendChild(img);
```

**Without base64**: Returns `Number[]` (raw JPEG byte array).

### getLayerMask(options)

```javascript
const maskObj = await imaging.getLayerMask({
    layerID: layer.id,    // REQUIRED
    documentID: doc.id,   // optional
    kind: "user",         // optional: "user" (default) or "vector"
    sourceBounds: { left: 0, top: 0, right: 300, bottom: 300 },
    targetSize: { height: 100 }
});
// Returns single-channel grayscale PhotoshopImageData
```

### putLayerMask(options)

```javascript
await imaging.putLayerMask({
    layerID: layer.id,         // REQUIRED
    documentID: doc.id,        // optional
    kind: "user",              // currently only "user" supported
    imageData: grayImageData,  // REQUIRED: single-component grayscale
    replace: true,             // optional
    targetBounds: { left: 0, top: 0 },
    commandName: "Edit Mask"
});
```

### getSelection(options) / putSelection(options)

Read/write the document's selection as grayscale pixel data.

```javascript
// Read selection
const selObj = await imaging.getSelection({
    documentID: doc.id,
    sourceBounds: { left: 0, top: 0, right: 300, bottom: 300 },
    targetSize: { height: 100 }
});

// Write selection
await imaging.putSelection({
    documentID: doc.id,
    imageData: grayImageData,
    replace: true,
    targetBounds: { left: 0, top: 0 },
    commandName: "Modify Selection"
});
```

### ImageBlob

Custom type extending Blob for uncompressed image data. Used to create URLs for `<img>` elements.

```javascript
const blob = new ImageBlob(arrayBuffer, {
    type: "image/png",  // or "image/jpg", "image/jpeg", or raw options
    width: 100,
    height: 100,
    colorSpace: "RGB",
    components: 4,
    componentSize: 8,
    pixelFormat: "RGBA"
});

// Properties: size (read-only), type (read-only)
// Methods: arrayBuffer(), slice(), stream(), text()
```

### Pixel Format Notes

- **Chunky (interleaved)**: `[R1, G1, B1, R2, G2, B2, ...]` -- default
- **Planar**: `[R1, R2, ..., G1, G2, ..., B1, B2, ...]`
- **8-bit range**: 0-255
- **16-bit range**: 0-32768 (default) or 0-65535 (fullRange: true)
- **32-bit range**: 0.0-1.0 (HDR may exceed)
- **Bounds convention**: left/top inclusive, right/bottom exclusive

### Performance Guidelines

1. Request the smallest region possible via `sourceBounds`
2. Use `targetSize` to scale down thumbnails
3. Call `dispose()` immediately after extracting pixel data
4. Work in the document's native colorSpace/colorProfile when possible
5. All imaging methods are async -- always `await`

---

## Spectrum UXP Components

Native Photoshop-styled UI widgets following Adobe's Spectrum design system. Available since UXP v4.1.

### sp-button

```html
<!-- Variants: cta (default), primary, secondary, warning, overBackground -->
<sp-button variant="primary">Click Me</sp-button>
<sp-button variant="warning" quiet>Delete</sp-button>
<sp-button disabled>Disabled</sp-button>

<!-- With icon -->
<sp-button variant="primary">
    <sp-icon name="ui:Magnifier" size="s" slot="icon"></sp-icon>
    Search
</sp-button>
```

Events: `click`

### sp-action-button

```html
<sp-action-button>An Action</sp-action-button>
<sp-action-button quiet>Quiet Action</sp-action-button>

<!-- Icon-only (needs custom CSS) -->
<sp-action-button style="padding: 0; max-width: 32px; max-height: 32px;">
    <sp-icon name="ui:Magnifier" size="s" slot="icon"></sp-icon>
</sp-action-button>
```

Events: `click`

### sp-checkbox

```html
<sp-checkbox>Include metadata</sp-checkbox>
<sp-checkbox checked>Pre-checked</sp-checkbox>
<sp-checkbox indeterminate>Partial</sp-checkbox>
<sp-checkbox disabled>Disabled</sp-checkbox>
<sp-checkbox invalid>Invalid</sp-checkbox>
```

Events: `change`, `input` -- Access `evt.target.checked`

### sp-dropdown

```html
<sp-dropdown placeholder="Select..." style="width: 320px">
    <sp-menu slot="options">
        <sp-menu-item>Option 1</sp-menu-item>
        <sp-menu-item disabled>Option 2 (disabled)</sp-menu-item>
        <sp-menu-divider></sp-menu-divider>
        <sp-menu-item>Option 3</sp-menu-item>
    </sp-menu>
</sp-dropdown>
```

**Attributes**: `placeholder`, `quiet`, `disabled`, `invalid`
**Events**: `change` -- Access `evt.target.selectedIndex`
**Known issue**: Needs explicit `width` or displays oddly. Dropdowns do not respond to arrow keys.

### sp-slider

```html
<sp-slider min="0" max="100" value="50">
    <sp-label slot="label">Opacity</sp-label>
</sp-slider>

<!-- Filled variant -->
<sp-slider min="0" max="360" value="0" variant="filled" show-value>
    <sp-label slot="label">Rotation</sp-label>
</sp-slider>
```

**Attributes**: `min`, `max`, `value`, `disabled`, `variant` ("filled"), `fill-offset` ("left"/"right"), `value-label` (custom unit display, e.g. "%"), `show-value`
**Events**: `input` (during drag), `change` (on release) -- Access `evt.target.value`

### sp-textfield

```html
<sp-textfield placeholder="Enter text">
    <sp-label isrequired="true" slot="label">Name</sp-label>
</sp-textfield>

<!-- Quiet variant -->
<sp-textfield quiet placeholder="Search..."></sp-textfield>
```

**Variants**: disabled, valid/invalid, quiet
**Types**: text (default), numeric (range: -214748.36 to 214748.36), search, password
**Events**: `change`, `input`
**Known issue**: Password field value cannot be read on macOS. Workaround: toggle type between "password" and "text" on focus/blur.

### sp-textarea

```html
<sp-textarea placeholder="Enter description...">
    <sp-label slot="label">Description</sp-label>
</sp-textarea>
```

### sp-radio-group / sp-radio

```html
<sp-radio-group>
    <sp-label slot="label">Color Space:</sp-label>
    <sp-radio value="ycbcr">YCbCr BT.601</sp-radio>
    <sp-radio value="ycbcr709">YCbCr BT.709</sp-radio>
    <sp-radio value="hsl">HSL</sp-radio>
</sp-radio-group>

<!-- Vertical layout -->
<sp-radio-group column>
    <sp-label slot="label">Mode:</sp-label>
    <sp-radio value="scatter">Scatter</sp-radio>
    <sp-radio value="density">Density</sp-radio>
</sp-radio-group>
```

**Events**: `change` -- Access `evt.target.value`

### sp-menu / sp-menu-item

```html
<sp-menu>
    <sp-menu-item>Deselect</sp-menu-item>
    <sp-menu-item>Select Inverse</sp-menu-item>
    <sp-menu-divider></sp-menu-divider>
    <sp-menu-item disabled>Feather...</sp-menu-item>
</sp-menu>
```

**Note**: `sp-menu-divider` only renders visually when inside an `sp-dropdown`.
**Events**: `change` -- Access `evt.target.selectedIndex`

### sp-icon

```html
<sp-icon name="ui:Magnifier" size="m"></sp-icon>
```

**Sizes**: `xxs`, `xs`, `s`, `m`, `l`, `xl`, `xxl`
**Built-in icons** (36 total): Includes chevrons, arrows, checkmarks, alerts, success, info, help, magnifier, cross, star, gripper, folder, asterisk, dash, corner triangle, more.

### sp-progressbar

```html
<sp-progressbar max="100" value="42" show-value>
    <sp-label slot="label">Processing...</sp-label>
</sp-progressbar>

<!-- Small variant -->
<sp-progressbar max="100" value="75" size="small"></sp-progressbar>
```

**Attributes**: `max`, `value`, `value-label`, `show-value`, `size` ("small"), `variant` ("overBackground")

### sp-divider

```html
<sp-divider size="large"></sp-divider>  <!-- large, medium (default), small -->
```

### sp-link

```html
<sp-link href="https://adobe.com">Adobe</sp-link>
<sp-link quiet>Quiet Link</sp-link>
```

**Important**: Navigation to `href` cannot be prevented. If no `href`, browser will not launch.

### Typography Components

```html
<sp-heading size="XXS">Heading</sp-heading>  <!-- XXS to XXXL -->
<sp-body size="S">Body text</sp-body>         <!-- XS, S, M, L, XL -->
<sp-detail size="S">Detail text</sp-detail>   <!-- S, M, L, XL -->
<sp-label>Label text</sp-label>
```

### Using Spectrum Components with React

Spectrum UXP widgets work with React but require special handling for events since React's synthetic event system does not capture custom element events. Use `ref` with `addEventListener`:

```jsx
function MySlider() {
    const ref = useRef(null);
    useEffect(() => {
        const el = ref.current;
        const handler = (e) => console.log(e.target.value);
        el.addEventListener('input', handler);
        return () => el.removeEventListener('input', handler);
    }, []);
    return <sp-slider ref={ref} min="0" max="100" value="50" />;
}
```

---

## Panel Sizing and Layout

### Manifest Size Properties

Define in `manifest.json` under each panel entry point:

```json
{
    "type": "panel",
    "id": "mainPanel",
    "label": "Chromascope",
    "minimumSize": { "width": 230, "height": 200 },
    "maximumSize": { "width": 2000, "height": 2000 },
    "preferredDockedSize": { "width": 230, "height": 300 },
    "preferredFloatingSize": { "width": 400, "height": 500 }
}
```

| Property | Description | Notes |
|----------|-------------|-------|
| `minimumSize` | Smallest allowed dimensions | Host may not honor minimum width in all docking configurations |
| `maximumSize` | Largest allowed dimensions | Same caveat as minimum |
| `preferredDockedSize` | Initial size when docked | This is a preference and may not be honored |
| `preferredFloatingSize` | Initial size when floating | This is a preference and may not be honored |

### Panel Scrolling

Panels do support scrolling via CSS `overflow: auto` or `overflow: scroll`. However, scroll views do not auto-scroll to ensure focused controls are visible (macOS only, known issue).

### Panel Lifecycle (Manifest v5)

```javascript
entrypoints.setup({
    plugin: {
        create() { /* plugin loaded */ },
        destroy() { /* plugin unloaded */ }
    },
    panels: {
        mainPanel: {
            create(rootNode) { /* panel DOM created */ },
            show(rootNode, data) { /* panel becomes visible */ },
            hide(rootNode, data) { /* panel hidden */ },
            destroy(rootNode) { /* panel destroyed */ },
            invokeMenu(menuId) { /* flyout menu item clicked */ }
        }
    }
});
```

All lifecycle methods support Promises with a 300ms timeout.

**Known issues**:
- `show` callback fires only once, not on each re-show (PS-57284)
- `hide` callback never fires (PS-57284)

### Panel Icons

Required for marketplace submission. 23x23 pixels with optional transparency. Specify theme variants:

```json
{
    "icons": [
        { "width": 23, "height": 23, "path": "icons/dark.png", "scale": [1, 2], "theme": ["dark", "darkest"] },
        { "width": 23, "height": 23, "path": "icons/light.png", "scale": [1, 2], "theme": ["light", "lightest"] }
    ]
}
```

---

## Event System

### Action Notification Listener

Subscribe to document-modifying events (layer changes, selections, filters, etc.):

```javascript
const { action } = require("photoshop");

// Subscribe
await action.addNotificationListener(
    ['open', 'close', 'save', 'select', 'make', 'set'],
    (eventName, descriptor) => {
        console.log(`Event: ${eventName}`, descriptor);
    }
);

// Unsubscribe
await action.removeNotificationListener(
    ['open', 'close', 'save'],
    myCallback
);
```

Available since v23.0. The callback receives the event name (string) and an ActionDescriptor with event details.

**Common action events**: layer operations (merge, duplicate, group, ungroup), selection changes (select, deselect, inverse, grow, contract), pixel modifications (blur, sharpen, levels, curves, invert), layer effects, transform operations (rotate, flip, crop, canvas size, image size).

### Core Notification Listener

Subscribe to UI and OS events:

```javascript
const { core } = require("photoshop");

// UI Events
await core.addNotificationListener('UI', ['userIdle'], (event, descriptor) => {
    if (descriptor.idleEnd) {
        console.log('User returned from idle');
    }
});

// OS Events
await core.addNotificationListener('OS', ['activationChanged'], callback);
```

Available since v23.3.

**UI Events**: `userIdle`, `minimizeAppWindow`, `panelVisibilityChanged`, workspace activation/dragging/layout/resizing events.

**OS Events**: `activationChanged`, `displayConfigurationChanged`.

**Important**: Event notifications are suppressed during non-interactive `executeAsModal` scope.

### DOM Event Listeners

Standard DOM events work with some limitations:

```javascript
element.addEventListener('click', handler);
element.addEventListener('change', handler);
element.addEventListener('input', handler);
```

**Supported event types**: `click`, `change`, `input`, `focus`, `blur`, `mousedown`, `mouseup`, `mousemove`, `mouseenter`, `mouseleave`, `pointerdown`, `pointerup`, `pointermove`, `keydown`, `keyup`, `wheel`, `resize` (via ResizeObserver), `load` (for images).

**NOT supported**:
- `keypress` event
- `dragstart`, `drag`, `dragend`, `drop` -- Drag and Drop is fully unsupported
- Interactive elements swallow most events (clicks on buttons don't bubble to parents)

### IntersectionObserver / ResizeObserver

Both are available for detecting visibility and size changes:

```javascript
const observer = new ResizeObserver(entries => {
    for (const entry of entries) {
        console.log(entry.contentRect.width, entry.contentRect.height);
    }
});
observer.observe(myElement);
```

---

## ExecuteAsModal

Required for any operation that modifies the Photoshop document state.

```javascript
const { core } = require("photoshop");

async function myDocumentEdit(executionContext, descriptor) {
    // Check for cancellation
    if (executionContext.isCancelled) {
        throw "User cancelled";
    }

    // Report progress
    executionContext.reportProgress({ value: 0.5, commandName: "Processing..." });

    // Suspend history for undo grouping
    const suspensionID = await executionContext.hostControl.suspendHistory({
        documentID: app.activeDocument.id,
        name: "My Edit"
    });

    // ... do imaging work here ...

    await executionContext.hostControl.resumeHistory(suspensionID);
}

// Execute
try {
    await core.executeAsModal(myDocumentEdit, {
        commandName: "Chromascope Edit",     // shown in progress bar
        descriptor: { myParam: "value" },    // passed to targetFunction
        interactive: false,                   // true allows user input
        timeOut: 5000                         // retry timeout in ms (v25.10+)
    });
} catch (e) {
    if (e.number === 9) {
        console.log("Another plugin holds modal state");
    }
}
```

**Key behaviors**:
- Only one plugin can hold modal state at a time
- Menu items are disabled during modal state
- Progress bar appears after 2+ seconds
- Escape key cancels the operation
- Event notifications are suppressed during non-interactive modal scope
- Nested modal scopes share the global modal state

---

## DOM Limitations

### Missing Standard APIs

| API | Status |
|-----|--------|
| `document.createElement('iframe')` | Use `<webview>` in dialogs (manifest v5) |
| `window.devicePixelRatio` | Always returns 1 |
| `localStorage` / `sessionStorage` | Not available; use UXP storage APIs |
| `XMLHttpRequest` cookies | Not supported |
| `XMLHttpRequest` Blob send | Not supported; use ArrayBuffer |
| `WebSocket` extensions | Not supported |
| `fetch` | Available with limitations |
| `CustomEvent` | Available |
| `CustomElementRegistry` | Available (`customElements.define()`) |
| `ShadowRoot` | Available |
| `TreeWalker` | Available |
| `MutationObserver` | Not available |
| `requestAnimationFrame` | Limited support |
| `Web Workers` | Not available |
| `Service Workers` | Not available |
| `IndexedDB` | Not available |
| `WebGL` | Not available |
| `WebAssembly` | Not available |

### Available DOM APIs

- `Document`, `DocumentFragment`, `Element`, `Node`, `Text`, `Comment`
- `querySelector()`, `querySelectorAll()`, `getElementById()`
- `createElement()`, `createTextNode()`, `createDocumentFragment()`
- `appendChild()`, `removeChild()`, `insertBefore()`, `replaceChild()`
- `setAttribute()`, `getAttribute()`, `removeAttribute()`
- `classList`, `ClassList` operations
- `innerHTML`, `outerHTML`, `textContent`, `innerText`
- `clientWidth`, `clientHeight`, `offsetWidth`, `offsetHeight`, `scrollLeft`, `scrollTop`, `scrollWidth`, `scrollHeight`
- `getBoundingClientRect()`
- `getComputedStyle()`
- `AbortController` / `AbortSignal`
- `alert()`, `confirm()`, `prompt()` -- basic dialogs

### Dialog Behavior

- Closed dialogs remain in the DOM; you must call `element.remove()` explicitly
- `showModal()` returns a Promise (not void like in browsers)
- Only one dialog can be shown at a time
- `HTMLDialogElement.REJECTION_REASON_NOT_ALLOWED` -- thrown when another dialog is already open
- `HTMLDialogElement.REJECTION_REASON_DETACHED` -- thrown when node is removed from DOM

### innerHTML Caveat

`innerHTML` with inline event handlers (e.g., `onclick="..."`) is parsed in Photoshop but behavior is unreliable. Always use `addEventListener`.

---

## Theme Awareness

Photoshop exposes CSS variables that update when the user changes themes (Darkest, Dark, Light, Lightest).

### Host CSS Variables

```css
/* Colors */
--uxp-host-background-color
--uxp-host-text-color
--uxp-host-border-color
--uxp-host-link-text-color
--uxp-host-text-color-secondary
--uxp-host-link-hover-text-color
--uxp-host-label-text-color
--uxp-host-widget-hover-background-color
--uxp-host-widget-hover-text-color
--uxp-host-widget-hover-border-color

/* Font sizes */
--uxp-host-font-size
--uxp-host-font-size-smaller
--uxp-host-font-size-larger
```

### Usage

```css
body {
    background-color: var(--uxp-host-background-color);
    color: var(--uxp-host-text-color);
    font-size: var(--uxp-host-font-size);
}

.panel-border {
    border: 1px solid var(--uxp-host-border-color);
}

a {
    color: var(--uxp-host-link-text-color);
}
a:hover {
    color: var(--uxp-host-link-hover-text-color);
}
```

### Media Query

```css
@media (prefers-color-scheme: dark) {
    /* Styles for Dark and Darkest themes */
}
@media (prefers-color-scheme: light) {
    /* Styles for Light and Lightest themes */
}
```

Spectrum UXP components (`sp-*`) are automatically theme-aware.

---

## Manifest v5 Configuration

### Permissions

```json
{
    "manifestVersion": 5,
    "requiredPermissions": {
        "network": {
            "domains": ["https://api.example.com"]
        },
        "clipboard": "readAndWrite",
        "localFileSystem": "fullAccess",
        "launchProcess": {
            "schemes": ["https"],
            "extensions": [".pdf"]
        },
        "ipc": {
            "enablePluginCommunication": true
        },
        "webview": {
            "allow": "yes",
            "domains": ["https://example.com"]
        },
        "enableUserInfo": true
    }
}
```

| Permission | Values | Notes |
|-----------|--------|-------|
| `network.domains` | string[] | HTTPS domains the plugin can access |
| `clipboard` | "readAndWrite" \| "read" | Clipboard access level |
| `localFileSystem` | "request" \| "plugin" \| "fullAccess" | File system access |
| `launchProcess` | { schemes, extensions } | Required for `openExternal` / `openPath` |
| `ipc` | { enablePluginCommunication } | Inter-plugin communication |
| `webview` | { allow, domains } | WebView in modal dialogs (UXP 6.0+) |
| `enableUserInfo` | boolean | User GUID access (PS v25.1, UXP v7.3) |

### Minimum Requirements

Manifest v5 requires Photoshop 23.3.0+ and UXP 6.0+.

---

## Known Issues

### Critical for Chromascope

1. **Canvas APIs broken on Windows**: `createLinearGradient()`, `createRadialGradient()`, `clearRect()` may not work
2. **No `toDataURL` or `toBlob`** on canvas -- cannot export canvas content directly
3. **No `drawImage`** on canvas -- cannot composite images
4. **No `getImageData`/`putImageData`** on canvas -- cannot read/write individual pixels
5. **`window.devicePixelRatio` always returns 1** -- cannot detect high-DPI displays
6. **`show`/`hide` panel callbacks unreliable** -- `show` fires only once, `hide` never fires (PS-57284)
7. **No CSS transitions or animations** -- all visual changes are immediate
8. **No CSS Grid** -- flexbox only

### UI Issues

9. No element can overlay text-editing widgets; text fields always render above other content
10. Complex SVG files may fail or render unexpectedly; limited SVG support
11. Grayscale images fail to render but occupy DOM space
12. `<img>` in dialogs needs explicit width/height or dialog resizes incorrectly
13. `<img>` ignores embedded EXIF rotation
14. `sp-dropdown` needs explicit width or displays oddly
15. `sp-tooltip` location attribute controls tip direction, not position
16. Numeric `sp-textfield` triggers validation errors outside range -214748.36 to 214748.36
17. Drag and Drop is fully unsupported
18. Scroll views don't auto-scroll to focused controls (macOS)
19. `<label for="id"/>` unsupported; wrap label around control instead
20. `<option>` tags require `value` attribute
21. `<option>` tags don't support `disabled` attribute
22. HTML5 input validation unsupported
23. `<textarea>` size cannot be set with rows/cols
24. `<form>` only supports `method="dialog"`

### Network Issues

25. Self-signed certificates unsupported for secure WebSockets on macOS
26. WebSocket extensions unsupported
27. XHR can only send binary content via ArrayBuffer, not Blob
28. XHR doesn't support cookies

### Other Issues

29. Closed dialogs remain in DOM; must call `remove()` explicitly
30. `entrypoints.setup()` calls delayed by more than ~20ms may cause uncatchable errors
31. Clipboard APIs throw errors in panel-less plugins
32. `keypress` event unsupported (use `keydown`/`keyup`)
33. Password field values unreadable on macOS
34. `font` shorthand CSS unsupported
35. `text-transform` CSS unsupported
