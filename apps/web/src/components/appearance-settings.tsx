"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useId, useState } from "react";
import { Panel } from "./dashboard-ui";

const choices = [
  { value: "light", label: "Light", description: "A bright, clear workspace.", Icon: Sun },
  { value: "dark", label: "Dark", description: "A softer view in low light.", Icon: Moon },
  { value: "system", label: "System", description: "Follow your device's appearance.", Icon: Monitor },
] as const;

export default function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const group = useId();
  useEffect(() => setMounted(true), []);
  return <Panel id="appearance" aria-labelledby="appearance-title" className="appearance-settings scroll-mt-24">
    <div className="panel-header"><div><h2 id="appearance-title">Appearance</h2>
      <p id="appearance-description">Choose your color theme. This preference is saved in this browser.</p></div></div>
    <fieldset className="appearance-options" aria-labelledby="appearance-title" aria-describedby="appearance-description" disabled={!mounted}>
      {choices.map(({ value, label, description, Icon }) => <label key={value} className="appearance-option">
        <span className="appearance-option-top"><Icon size={24} aria-hidden="true" />
          <input type="radio" name={group} value={value} aria-label={label} aria-describedby={`${group}-${value}`} checked={mounted && theme === value} onChange={() => setTheme(value)} />
        </span>
        <strong>{label}</strong><span id={`${group}-${value}`} className="appearance-description">{description}</span>
      </label>)}
    </fieldset>
  </Panel>;
}
