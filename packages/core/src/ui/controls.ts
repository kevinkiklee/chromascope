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
  { id: "scatter", label: "Scatter" },
  { id: "bloom", label: "Bloom" },
];

const HARMONY_SCHEMES: Array<{ id: HarmonySchemeId | "none"; label: string; title: string }> = [
  { id: "none", label: "Off", title: "No harmony overlay" },
  { id: "complementary", label: "Cmp", title: "Complementary" },
  { id: "splitComplementary", label: "Spl", title: "Split Complementary" },
  { id: "triadic", label: "Tri", title: "Triadic" },
  { id: "tetradic", label: "Tet", title: "Tetradic" },
  { id: "analogous", label: "Ana", title: "Analogous" },
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
      if ("title" in item && (item as any).title) {
        btn.setAttribute("title", (item as any).title);
      }
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
    const inputId = `vs-${label.toLowerCase().replace(/\s+/g, "-")}`;
    input.id = inputId;
    lbl.setAttribute("for", inputId);
    input.setAttribute("aria-label", label);
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

  // --- Type (density mode) ---
  const displayGroup = document.createElement("div");
  displayGroup.className = "vs-control-group";

  const dmRow = document.createElement("div");
  dmRow.className = "vs-control-row";
  const dmLabel = document.createElement("label");
  dmLabel.textContent = "Type";
  dmRow.appendChild(dmLabel);
  dmRow.appendChild(
    renderButtonGroup(DENSITY_MODES, current.densityMode, (id) => {
      current.densityMode = id;
      callbacks.onSettingsChange({ densityMode: id });
    }),
  );
  displayGroup.appendChild(dmRow);

  container.appendChild(displayGroup);

  // --- Harmony (scheme, rotation, zone width) ---
  const harmonyGroup = document.createElement("div");
  harmonyGroup.className = "vs-control-group";

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
    renderSlider("Zone Width", 0.1, 3.0, 0.1,
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
