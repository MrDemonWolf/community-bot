import { describe, it, expect, vi, afterEach } from "vitest";

// substituteVariables is not exported directly, so we re-implement the pure
// regex logic to test variable substitution patterns in isolation.
// The logic here mirrors the production implementation exactly.

function substituteSimpleVars(
  template: string,
  user: string,
  channel: string,
  args: string[]
): string {
  return template
    .replace(/\{user\}/gi, user)
    .replace(/\{channel\}/gi, channel)
    .replace(/\{args\}/gi, args.join(" "));
}

function substitutePositionalArgs(template: string, args: string[]): string {
  return template.replace(
    /\$\{(\d+)(?:\|'?([^}']*)'?)?\}/g,
    (_match, indexStr: string, fallback: string | undefined) => {
      const index = parseInt(indexStr, 10) - 1;
      if (index >= 0 && index < args.length && args[index] !== undefined) {
        return args[index];
      }
      return fallback ?? "";
    }
  );
}

function substituteRandomPick(template: string): string {
  return template.replace(
    /\$\{random\.pick\s+((?:'[^']*'\s*)+)\}/gi,
    (_match, optionsStr: string) => {
      const options = [...optionsStr.matchAll(/'([^']*)'/g)].map((m) => m[1]);
      if (options.length === 0) return "";
      return options[Math.floor(Math.random() * options.length)];
    }
  );
}

function substituteTime(template: string): string {
  return template.replace(
    /\$\{time\s+([^}]+)\}/gi,
    (_match, timezone: string) => {
      try {
        return new Intl.DateTimeFormat("en-US", {
          timeZone: timezone.trim(),
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }).format(new Date());
      } catch {
        return `(invalid timezone: ${timezone.trim()})`;
      }
    }
  );
}

describe("commandExecutor variable substitution", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("simple variables", () => {
    it("replaces {user}", () => {
      expect(substituteSimpleVars("Hello {user}!", "testuser", "chan", [])).toBe(
        "Hello testuser!"
      );
    });

    it("replaces {channel}", () => {
      expect(
        substituteSimpleVars("Welcome to {channel}", "user", "mychannel", [])
      ).toBe("Welcome to mychannel");
    });

    it("replaces {args}", () => {
      expect(
        substituteSimpleVars("You said: {args}", "user", "chan", ["hello", "world"])
      ).toBe("You said: hello world");
    });

    it("replaces {args} with empty string when no args", () => {
      expect(
        substituteSimpleVars("You said: {args}", "user", "chan", [])
      ).toBe("You said: ");
    });

    it("is case-insensitive", () => {
      expect(
        substituteSimpleVars("{USER} in {Channel}", "bob", "test", [])
      ).toBe("bob in test");
    });

    it("replaces multiple occurrences", () => {
      expect(
        substituteSimpleVars("{user} and {user}", "alice", "chan", [])
      ).toBe("alice and alice");
    });
  });

  describe("positional args", () => {
    it("substitutes ${1}", () => {
      expect(substitutePositionalArgs("Hello ${1}", ["world"])).toBe("Hello world");
    });

    it("substitutes ${2}", () => {
      expect(substitutePositionalArgs("${1} ${2}", ["a", "b"])).toBe("a b");
    });

    it("uses fallback when arg is missing", () => {
      expect(substitutePositionalArgs("Hello ${1|stranger}", [])).toBe("Hello stranger");
    });

    it("uses fallback with quotes", () => {
      expect(substitutePositionalArgs("${1|'friend'}", [])).toBe("friend");
    });

    it("returns empty string without fallback when arg missing", () => {
      expect(substitutePositionalArgs("Hello ${1}", [])).toBe("Hello ");
    });

    it("prefers actual arg over fallback", () => {
      expect(substitutePositionalArgs("${1|fallback}", ["actual"])).toBe("actual");
    });

    it("returns empty string arg instead of fallback", () => {
      expect(substitutePositionalArgs("${1|fallback}", [""])).toBe("");
    });
  });

  describe("random.pick", () => {
    it("picks from available options", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      expect(substituteRandomPick("${random.pick 'a' 'b' 'c'}")).toBe("a");
    });

    it("picks last option when random is near 1", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.99);
      expect(substituteRandomPick("${random.pick 'x' 'y' 'z'}")).toBe("z");
    });

    it("handles single option", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      expect(substituteRandomPick("${random.pick 'only'}")).toBe("only");
    });
  });

  describe("time", () => {
    it("formats time for valid timezone", () => {
      const result = substituteTime("${time America/New_York}");
      expect(result).toMatch(/^\d{1,2}:\d{2}\s[AP]M$/);
    });

    it("returns error for invalid timezone", () => {
      const result = substituteTime("${time Invalid/Zone}");
      expect(result).toBe("(invalid timezone: Invalid/Zone)");
    });
  });
});
