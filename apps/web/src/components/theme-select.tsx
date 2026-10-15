"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ThemeSelect() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return <label className="theme-select"><span>Color theme</span>
    <select value={mounted ? theme ?? "system" : "system"} disabled={!mounted} onChange={(event) => setTheme(event.target.value)}>
      <option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option>
    </select>
  </label>;
}
