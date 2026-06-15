/**
 * Shared contract between routed model components and the global header toolbar.
 * Each model component declares its action buttons as data; `AppComponent`
 * renders them in the header for the active route. Adding/removing a button
 * means editing the model component, not the header.
 */
export interface ToolbarButton {
  label: string;
  action: () => void;
  variant?: 'primary' | 'secondary'; // secondary = grey (import/export)
  icon?: string; // svg path, optional
  testId?: string; // preserve Cypress data-test-id
  visible?: boolean; // default true
}

export interface ModelToolbarHost {
  toolbarButtons: ToolbarButton[];
  /**
   * Mark this (routed) component's view for change detection.
   * Required because toolbar buttons live in `AppComponent`'s template; a click
   * there only dirties AppComponent's view, never the routed feature component.
   * AppComponent calls this after running a button action so the action's state
   * change (e.g. opening a dialog) actually re-renders. See `AppComponent.runAction`.
   */
  markForCheck(): void;
}
