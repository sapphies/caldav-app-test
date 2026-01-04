// prevent flash of light mode - runs before page render
(function () {
  try {
    const stored = localStorage.getItem("caldav-tasks-settings");
    let effectiveTheme = "system";

    if (stored) {
      const settings = JSON.parse(stored);
      effectiveTheme = settings.state?.theme || "system";
    }

    // Determine if we should use dark mode
    let isDark = false;
    if (effectiveTheme === "dark") {
      isDark = true;
    } else if (effectiveTheme === "system") {
      isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    }

    // Apply dark class
    if (isDark) {
      document.documentElement.classList.add("dark");
    }

    // Set color-scheme meta tag to match the resolved theme
    const meta = document.createElement("meta");
    meta.name = "color-scheme";
    meta.content = isDark ? "dark" : "light";
    document.head.appendChild(meta);
  } catch (e) {
    // Fallback to system preference on error
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (isDark) {
      document.documentElement.classList.add("dark");
    }
    const meta = document.createElement("meta");
    meta.name = "color-scheme";
    meta.content = isDark ? "dark" : "light";
    document.head.appendChild(meta);
  }
})();
