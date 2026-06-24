<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { t } from "../../i18n";

  export let activeColor = "";

  const dispatch = createEventDispatcher<{
    select: string;
    close: void;
  }>();

  const colors = [
    {
      value: "vscode-default",
      swatch: "var(--vscode-sideBarTitle-foreground)",
      title: "notesList.colorDefault",
    },
    {
      value: "vscode-muted",
      swatch:
        "color-mix(in srgb, var(--vscode-sideBarTitle-foreground) 24%, var(--vscode-editor-background) 76%)",
      title: "notesList.colorMuted",
    },
    {
      value: "vscode-soft",
      swatch: "var(--vscode-editor-background)",
      title: "notesList.colorSurface",
    },
    { value: "#66E1B4", swatch: "#66E1B4", title: "notesList.colorMint" },
    { value: "#BED8F1", swatch: "#BED8F1", title: "notesList.colorSky" },
    { value: "#F5C7F6", swatch: "#F5C7F6", title: "notesList.colorOrchid" },
    { value: "#FCF4A9", swatch: "#FCF4A9", title: "notesList.colorCream" },
    { value: "#FA9697", swatch: "#FA9697", title: "notesList.colorCoral" },
    { value: "#239489", swatch: "#239489", title: "notesList.colorTeal" },
    { value: "#83A7CC", swatch: "#83A7CC", title: "notesList.colorSteel" },
    { value: "#A394EB", swatch: "#A394EB", title: "notesList.colorLilac" },
    { value: "#E0AC5B", swatch: "#E0AC5B", title: "notesList.colorAmber" },
    { value: "#F96A83", swatch: "#F96A83", title: "notesList.colorRose" },
    { value: "#1B7A6F", swatch: "#1B7A6F", title: "notesList.colorForest" },
    { value: "#3667A9", swatch: "#3667A9", title: "notesList.colorOcean" },
    { value: "#5F63B6", swatch: "#5F63B6", title: "notesList.colorViolet" },
    { value: "#94774B", swatch: "#94774B", title: "notesList.colorBronze" },
    { value: "#F74661", swatch: "#F74661", title: "notesList.colorRuby" },
    { value: "#136159", swatch: "#136159", title: "notesList.colorPine" },
    { value: "#224177", swatch: "#224177", title: "notesList.colorNavy" },
    { value: "#28296D", swatch: "#28296D", title: "notesList.colorIndigo" },
    { value: "#6E4C41", swatch: "#6E4C41", title: "notesList.colorCocoa" },
    { value: "#721A38", swatch: "#721A38", title: "notesList.colorWine" },
  ];

  const systemColors = colors.slice(0, 3);
  const customColors = colors.slice(3);
  let customColor = "#B3D9FF";
  let customHex = customColor;

  $: if (/^#[0-9a-fA-F]{6}$/.test(activeColor)) {
    customColor = activeColor;
    customHex = activeColor.toUpperCase();
  }

  function select(value: string) {
    dispatch("select", value);
    dispatch("close");
  }

  function close() {
    dispatch("close");
  }

  function updateCustomColor(value: string) {
    customColor = value;
    customHex = value.toUpperCase();
  }

  function handleCustomColorInput(event: Event) {
    updateCustomColor((event.currentTarget as HTMLInputElement).value);
  }

  function applyCustomColor() {
    const value = customHex.trim();
    const normalized = value.startsWith("#") ? value : `#${value}`;
    if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) return;
    select(normalized.toUpperCase());
  }
</script>

<button class="modal-backdrop" on:click={close} aria-label="Close"></button>
<div class="color-picker-modal">
  <h3>{$t("notesList.color")}</h3>
  <button
    class="color-clear"
    class:active={activeColor === ""}
    on:click={() => select("")}
  >
    <span class="anemona icon-x"></span>
    {$t("notesList.colorNone")}
  </button>
  <div class="color-grid system-colors">
    {#each systemColors as color}
      <button
        class="color-swatch"
        class:active={activeColor === color.value}
        style="--swatch: {color.swatch}"
        on:click={() => select(color.value)}
        title={$t(color.title)}
      ></button>
    {/each}
  </div>
  <div class="color-grid custom-colors">
    {#each customColors as color}
      <button
        class="color-swatch"
        class:active={activeColor === color.value}
        style="--swatch: {color.swatch}"
        on:click={() => select(color.value)}
        title={$t(color.title)}
      ></button>
    {/each}
  </div>
  <div class="custom-picker">
    <label class="custom-picker__label" for="custom-color-input">
      {$t("notesList.colorCustom")}
    </label>
    <div class="custom-picker__row">
      <input
        id="custom-color-input"
        class="custom-picker__input"
        type="color"
        value={customColor}
        on:input={handleCustomColorInput}
        title={$t("notesList.colorCustom")}
      />
      <input
        class="custom-picker__hex"
        type="text"
        bind:value={customHex}
        maxlength="7"
        aria-label={$t("notesList.colorHex")}
      />
      <button
        class="btn primary custom-picker__apply"
        on:click={applyCustomColor}
      >
        {$t("notesList.colorApply")}
      </button>
    </div>
  </div>
  <div class="color-picker-actions">
    <button class="btn" on:click={close}>{$t("common.cancel")}</button>
  </div>
</div>

<style>
  .color-picker-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(300px, calc(100vw - 2rem));
    background: var(--theme-editor-modal-bg);
    color: var(--vscode-editor-foreground);
    border: 1px solid var(--theme-editor-modal-border);
    border-radius: var(--ui-radius-lg);
    padding: 0.9rem 0.7rem;
    z-index: var(--ui-z-modal);
    box-sizing: border-box;
    box-shadow: var(--ui-shadow);
  }

  .color-picker-modal h3 {
    margin: 0 0 0.5rem;
    font-size: var(--ui-font-md);
    font-weight: 500;
    text-align: center;
  }

  .color-clear {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.28rem;
    min-height: var(--ui-control-height);
    margin-bottom: 0.36rem;
    border: 1px solid var(--theme-editor-field-border);
    border-radius: var(--ui-radius-sm);
    background: var(--ui-soft);
    color: var(--vscode-foreground);
    cursor: pointer;
    font-size: var(--ui-font-control);
  }

  .color-clear:hover,
  .color-clear.active {
    border-color: var(--theme-editor-card-border-hover);
    background: var(--theme-editor-hover-bg);
  }

  .color-grid {
    display: grid;
    gap: 0;
    padding: 0;
    justify-items: stretch;
    align-items: stretch;
  }

  .color-grid.system-colors {
    grid-template-columns: repeat(3, 1fr);
    margin-bottom: 0.1rem;
  }

  .color-grid.custom-colors {
    grid-template-columns: repeat(5, 1fr);
  }

  .color-swatch {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 0;
    border: 1px solid color-mix(in srgb, var(--swatch) 70%, white 30%);
    background: var(--swatch);
    cursor: pointer;
    transition:
      outline-color 0.12s ease,
      filter 0.12s ease;
  }

  .color-swatch:hover {
    filter: brightness(1.08);
    z-index: 1;
  }

  .color-swatch.active {
    outline: 2px solid
      color-mix(in srgb, var(--vscode-focusBorder) 78%, white 22%);
    outline-offset: -2px;
  }

  .custom-picker {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--ui-border);
  }

  .custom-picker__label {
    display: block;
    margin-bottom: 0.28rem;
    color: var(--ui-muted);
    font-size: var(--ui-font-xs);
  }

  .custom-picker__row {
    display: grid;
    grid-template-columns: 2.1rem 1fr auto;
    gap: 0.28rem;
    align-items: center;
  }

  .custom-picker__input {
    width: 2.1rem;
    height: var(--ui-control-height);
    padding: 0;
    border: 1px solid var(--theme-editor-field-border);
    border-radius: var(--ui-radius-sm);
    background: transparent;
    cursor: pointer;
  }

  .custom-picker__hex {
    min-width: 0;
    height: var(--ui-control-height);
    box-sizing: border-box;
    border: 1px solid var(--theme-editor-field-border);
    border-radius: var(--ui-radius-sm);
    background: var(--theme-editor-field-bg);
    color: var(--vscode-input-foreground);
    padding: 0 var(--ui-control-pad-x);
    font-size: var(--ui-font-control);
    text-transform: uppercase;
  }

  .custom-picker__apply {
    min-height: var(--ui-control-height);
    padding-inline: 0.5rem;
  }

  .color-picker-actions {
    display: flex;
    justify-content: center;
    margin-top: 0.5rem;
  }
</style>
