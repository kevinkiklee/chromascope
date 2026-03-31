import type {
  ChromascopeSettings,
  ColorSpaceId,
  DensityModeId,
  HarmonySchemeId,
} from "../types.js";

export interface ControlsCallbacks {
  onSettingsChange: (partial: Partial<ChromascopeSettings>) => void;
}

const COLOR_SPACES: Array<{ id: ColorSpaceId; label: string }> = [
  { id: "ycbcr", label: "YCbCr" },
  { id: "cieluv", label: "LUV" },
  { id: "hsl", label: "HSL" },
];

const DENSITY_MODES: Array<{ id: DensityModeId; label: string }> = [
  { id: "scatter", label: "Scat" },
  { id: "heatmap", label: "Heat" },
  { id: "bloom", label: "Bloom" },
];

const HARMONY_SCHEMES: Array<{ id: HarmonySchemeId | "none"; label: string }> = [
  { id: "none", label: "Off" },
  { id: "complementary", label: "Cmp" },
  { id: "splitComplementary", label: "Spl" },
  { id: "triadic", label: "Tri" },
  { id: "tetradic", label: "Tet" },
  { id: "analogous", label: "Ana" },
];

export function createControls(
  container: HTMLElement,
  initialSettings: ChromascopeSettings,
  callbacks: ControlsCallbacks,
): { update: (settings: ChromascopeSettings) => void } {
  let current = { ...initialSettings };

  function renderButtonGroup<T extends string>(
    items: Array<{ id: T; label: string }>,
    activeId: T,
    onChange: (id: T) => void,
  ): HTMLElement {
    const group = document.createElement("div");
    group.className = "vs-btn-group";

    for (const item of items) {
      const btn = document.createElement("button");
      btn.className = `vs-btn${item.id === activeId ? " active" : ""}`;
      btn.textContent = item.label;
      btn.setAttribute("data-vs-id", item.id);
      btn.addEventListener("click", () => {
        onChange(item.id);
        for (const b of group.querySelectorAll(".vs-btn")) {
          b.classList.toggle("active", b.getAttribute("data-vs-id") === item.id);
        }
      });
      group.appendChild(btn);
    }

    return group;
  }

  function renderSlider(
    label: string,
    min: number,
    max: number,
    step: number,
    value: number,
    formatValue: (v: number) => string,
    onChange: (v: number) => void,
  ): HTMLElement {
    const row = document.createElement("div");
    row.className = "vs-slider-row";

    const lbl = document.createElement("label");
    lbl.textContent = label;
    row.appendChild(lbl);

    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    row.appendChild(input);

    const display = document.createElement("span");
    display.className = "vs-slider-value";
    display.textContent = formatValue(value);
    row.appendChild(display);

    input.addEventListener("input", () => {
      const v = parseFloat(input.value);
      display.textContent = formatValue(v);
      onChange(v);
    });

    return row;
  }

  container.innerHTML = "";

  // --- Display group ---
  const displayGroup = document.createElement("details");
  displayGroup.className = "vs-control-group";
  displayGroup.open = true;
  displayGroup.innerHTML = "<summary>Display</summary>";

  const csRow = document.createElement("div");
  csRow.className = "vs-control-row";
  const csLabel = document.createElement("label");
  csLabel.textContent = "Color Space";
  csRow.appendChild(csLabel);
  csRow.appendChild(
    renderButtonGroup(COLOR_SPACES, current.colorSpace, (id) => {
      current.colorSpace = id;
      callbacks.onSettingsChange({ colorSpace: id });
    }),
  );
  displayGroup.appendChild(csRow);

  const dmRow = document.createElement("div");
  dmRow.className = "vs-control-row";
  const dmLabel = document.createElement("label");
  dmLabel.textContent = "Density";
  dmRow.appendChild(dmLabel);
  dmRow.appendChild(
    renderButtonGroup(DENSITY_MODES, current.densityMode, (id) => {
      current.densityMode = id;
      callbacks.onSettingsChange({ densityMode: id });
    }),
  );
  displayGroup.appendChild(dmRow);

  container.appendChild(displayGroup);

  // --- Harmony group ---
  const harmonyGroup = document.createElement("details");
  harmonyGroup.className = "vs-control-group";
  harmonyGroup.open = true;
  harmonyGroup.innerHTML = "<summary>Harmony</summary>";

  const schemeRow = document.createElement("div");
  schemeRow.className = "vs-control-row";
  const schemeLabel = document.createElement("label");
  schemeLabel.textContent = "Scheme";
  schemeRow.appendChild(schemeLabel);
  schemeRow.appendChild(
    renderButtonGroup(
      HARMONY_SCHEMES,
      current.harmony.scheme ?? "none",
      (id) => {
        const scheme = id === "none" ? null : (id as HarmonySchemeId);
        current.harmony = { ...current.harmony, scheme };
        callbacks.onSettingsChange({ harmony: current.harmony });
      },
    ),
  );
  harmonyGroup.appendChild(schemeRow);

  harmonyGroup.appendChild(
    renderSlider("Rotation", 0, 360, 1,
      Math.round((current.harmony.rotation * 180) / Math.PI),
      (v) => `${v}°`,
      (v) => {
        current.harmony = { ...current.harmony, rotation: (v * Math.PI) / 180 };
        callbacks.onSettingsChange({ harmony: current.harmony });
      },
    ),
  );

  harmonyGroup.appendChild(
    renderSlider("Zone Width", 0.2, 3.0, 0.1,
      current.harmony.zoneWidth,
      (v) => v.toFixed(1),
      (v) => {
        current.harmony = { ...current.harmony, zoneWidth: v };
        callbacks.onSettingsChange({ harmony: current.harmony });
      },
    ),
  );

  container.appendChild(harmonyGroup);

  return {
    update(settings: ChromascopeSettings) {
      current = { ...settings };
    },
  };
}
