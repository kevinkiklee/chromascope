import type { VectorscopeSettings, ColorSpaceId, DensityModeId } from "../types.js";

export interface ControlsCallbacks {
  onSettingsChange: (partial: Partial<VectorscopeSettings>) => void;
}

const COLOR_SPACES: Array<{ id: ColorSpaceId; label: string }> = [
  { id: "ycbcr", label: "YCbCr" },
  { id: "cieluv", label: "CIE LUV" },
  { id: "hsl", label: "HSL" },
];

const DENSITY_MODES: Array<{ id: DensityModeId; label: string }> = [
  { id: "scatter", label: "Scatter" },
  { id: "heatmap", label: "Heatmap" },
  { id: "bloom", label: "Bloom" },
];

/**
 * Renders the settings controls into the given container element.
 * Returns an update function to sync UI when settings change externally.
 */
export function createControls(
  container: HTMLElement,
  initialSettings: VectorscopeSettings,
  callbacks: ControlsCallbacks,
): { update: (settings: VectorscopeSettings) => void } {
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
      btn.dataset.id = item.id;
      btn.addEventListener("click", () => {
        onChange(item.id);
        // Update active state
        for (const b of group.querySelectorAll(".vs-btn")) {
          b.classList.toggle("active", (b as HTMLElement).dataset.id === item.id);
        }
      });
      group.appendChild(btn);
    }

    return group;
  }

  // Build DOM
  container.innerHTML = "";

  // Color Space group
  const csGroup = document.createElement("details");
  csGroup.className = "vs-control-group";
  csGroup.open = true;
  csGroup.innerHTML = "<summary>Display</summary>";

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
  csGroup.appendChild(csRow);

  // Density mode row
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
  csGroup.appendChild(dmRow);

  container.appendChild(csGroup);

  return {
    update(settings: VectorscopeSettings) {
      current = { ...settings };
      // Re-render if needed (for external settings changes)
    },
  };
}
