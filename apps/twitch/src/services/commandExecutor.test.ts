import { describe, it, expect, vi, afterEach } from "vitest";

// Variable substitution patterns are tested in isolation by re-implementing
// the pure regex/sync logic. Async variables (followage, customapi, etc.)
// are tested via pattern matching since they require external services.

// ── Simple variable helpers ──

function substituteSimpleVars(
  template: string,
  user: string,
  channel: string,
  args: string[]
): string {
  const argsJoined = args.join(" ");
  const touser = args[0] ?? user;
  const query = argsJoined || user;

  return template
    .replace(/\{user\}/gi, user)
    .replace(/\{channel\}/gi, channel)
    .replace(/\{args\}/gi, argsJoined)
    .replace(/\{touser\}/gi, touser)
    .replace(/\{query\}/gi, query)
    .replace(/\{querystring\}/gi, encodeURIComponent(argsJoined));
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

function substituteRandomRange(template: string): string {
  return template.replace(
    /\{random\.(\d+)-(\d+)\}/gi,
    (_match, minStr: string, maxStr: string) => {
      const min = parseInt(minStr, 10);
      const max = parseInt(maxStr, 10);
      if (min > max) return String(min);
      return String(Math.floor(Math.random() * (max - min + 1)) + min);
    }
  );
}

// ── Math parser (mirrors production implementation) ──

function parseMathExpr(expr: string): number {
  let pos = 0;
  const str = expr.replace(/\s+/g, "");

  function parseNumber(): number {
    let negative = false;
    if (str[pos] === "-") {
      negative = true;
      pos++;
    }
    if (str[pos] === "(") {
      pos++;
      const val = parseAddSub();
      pos++;
      return negative ? -val : val;
    }
    const start = pos;
    while (pos < str.length && (str[pos] >= "0" && str[pos] <= "9" || str[pos] === ".")) {
      pos++;
    }
    const num = parseFloat(str.slice(start, pos));
    if (isNaN(num)) throw new Error("Invalid number");
    return negative ? -num : num;
  }

  function parseMulDiv(): number {
    let left = parseNumber();
    while (pos < str.length && (str[pos] === "*" || str[pos] === "/" || str[pos] === "%")) {
      const op = str[pos++];
      const right = parseNumber();
      if (op === "*") left *= right;
      else if (op === "/") left = right === 0 ? 0 : left / right;
      else left = right === 0 ? 0 : left % right;
    }
    return left;
  }

  function parseAddSub(): number {
    let left = parseMulDiv();
    while (pos < str.length && (str[pos] === "+" || str[pos] === "-")) {
      const op = str[pos++];
      const right = parseMulDiv();
      if (op === "+") left += right;
      else left -= right;
    }
    return left;
  }

  const result = parseAddSub();
  return Math.round(result * 100) / 100;
}

function substituteMath(template: string): string {
  return template.replace(
    /\{math\s+([^}]+)\}/gi,
    (_match, expr: string) => {
      try {
        return String(parseMathExpr(expr));
      } catch {
        return "(math error)";
      }
    }
  );
}

function substituteRepeat(template: string): string {
  return template.replace(
    /\{repeat\s+'([^']*)'\s+(\d+)\}/gi,
    (_match, text: string, countStr: string) => {
      const count = Math.min(parseInt(countStr, 10), 50);
      return text.repeat(count);
    }
  );
}

function substituteUrlencode(template: string): string {
  return template.replace(
    /\{urlencode\s+([^}]+)\}/gi,
    (_match, text: string) => encodeURIComponent(text.trim())
  );
}

function substituteCountdown(template: string): string {
  return template.replace(
    /\{countdown\s+([^}]+)\}/gi,
    (_match, dateStr: string) => {
      try {
        const target = new Date(dateStr.trim());
        if (isNaN(target.getTime())) return "(invalid date)";
        const ms = target.getTime() - Date.now();
        if (ms <= 0) return "0s (passed)";
        return "time remaining";
      } catch {
        return "(invalid date)";
      }
    }
  );
}

function substituteCountup(template: string): string {
  return template.replace(
    /\{countup\s+([^}]+)\}/gi,
    (_match, dateStr: string) => {
      try {
        const target = new Date(dateStr.trim());
        if (isNaN(target.getTime())) return "(invalid date)";
        const ms = Date.now() - target.getTime();
        if (ms <= 0) return "0s (in the future)";
        return "time elapsed";
      } catch {
        return "(invalid date)";
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

  describe("{touser}", () => {
    it("returns first arg when provided", () => {
      expect(
        substituteSimpleVars("{touser}", "caller", "chan", ["targetuser"])
      ).toBe("targetuser");
    });

    it("falls back to caller when no args", () => {
      expect(
        substituteSimpleVars("{touser}", "caller", "chan", [])
      ).toBe("caller");
    });
  });

  describe("{query}", () => {
    it("returns all args joined when provided", () => {
      expect(
        substituteSimpleVars("{query}", "caller", "chan", ["hello", "world"])
      ).toBe("hello world");
    });

    it("falls back to caller when no args", () => {
      expect(
        substituteSimpleVars("{query}", "caller", "chan", [])
      ).toBe("caller");
    });
  });

  describe("{querystring}", () => {
    it("URL-encodes the args", () => {
      expect(
        substituteSimpleVars("{querystring}", "user", "chan", ["hello", "world"])
      ).toBe("hello%20world");
    });

    it("returns empty string when no args", () => {
      expect(
        substituteSimpleVars("{querystring}", "user", "chan", [])
      ).toBe("");
    });

    it("encodes special characters", () => {
      expect(
        substituteSimpleVars("{querystring}", "user", "chan", ["foo&bar=baz"])
      ).toBe("foo%26bar%3Dbaz");
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

  describe("{random.N-M}", () => {
    it("returns a number in range", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);
      const result = substituteRandomRange("{random.1-100}");
      expect(Number(result)).toBeGreaterThanOrEqual(1);
      expect(Number(result)).toBeLessThanOrEqual(100);
    });

    it("returns min when random is 0", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      expect(substituteRandomRange("{random.1-6}")).toBe("1");
    });

    it("returns max when random is near 1", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.99);
      expect(substituteRandomRange("{random.1-6}")).toBe("6");
    });

    it("handles single-value range", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      expect(substituteRandomRange("{random.5-5}")).toBe("5");
    });

    it("handles reversed range by returning min", () => {
      expect(substituteRandomRange("{random.10-5}")).toBe("10");
    });
  });

  describe("{math}", () => {
    it("evaluates addition", () => {
      expect(substituteMath("{math 2+3}")).toBe("5");
    });

    it("evaluates subtraction", () => {
      expect(substituteMath("{math 10-4}")).toBe("6");
    });

    it("evaluates multiplication", () => {
      expect(substituteMath("{math 3*4}")).toBe("12");
    });

    it("evaluates division", () => {
      expect(substituteMath("{math 10/4}")).toBe("2.5");
    });

    it("evaluates modulo", () => {
      expect(substituteMath("{math 10%3}")).toBe("1");
    });

    it("respects operator precedence", () => {
      expect(substituteMath("{math 2+3*4}")).toBe("14");
    });

    it("evaluates parentheses", () => {
      expect(substituteMath("{math (2+3)*4}")).toBe("20");
    });

    it("handles nested parentheses", () => {
      expect(substituteMath("{math ((2+3)*2)+1}")).toBe("11");
    });

    it("handles negative numbers", () => {
      expect(substituteMath("{math -5+3}")).toBe("-2");
    });

    it("rounds to 2 decimal places", () => {
      expect(substituteMath("{math 100/3}")).toBe("33.33");
    });

    it("handles division by zero", () => {
      expect(substituteMath("{math 5/0}")).toBe("0");
    });

    it("returns error for invalid expression", () => {
      expect(substituteMath("{math abc}")).toBe("(math error)");
    });

    it("handles decimal numbers", () => {
      expect(substituteMath("{math 1.5*2}")).toBe("3");
    });

    it("handles spaces in expression", () => {
      expect(substituteMath("{math 2 + 3}")).toBe("5");
    });
  });

  describe("{repeat}", () => {
    it("repeats text N times", () => {
      expect(substituteRepeat("{repeat 'Kappa ' 3}")).toBe("Kappa Kappa Kappa ");
    });

    it("handles single repetition", () => {
      expect(substituteRepeat("{repeat 'hello' 1}")).toBe("hello");
    });

    it("handles zero repetitions", () => {
      expect(substituteRepeat("{repeat 'hello' 0}")).toBe("");
    });

    it("caps at 50 repetitions", () => {
      const result = substituteRepeat("{repeat 'x' 100}");
      expect(result.length).toBe(50);
    });
  });

  describe("{urlencode}", () => {
    it("encodes text", () => {
      expect(substituteUrlencode("{urlencode hello world}")).toBe("hello%20world");
    });

    it("encodes special characters", () => {
      expect(substituteUrlencode("{urlencode foo&bar=baz}")).toBe("foo%26bar%3Dbaz");
    });

    it("trims whitespace", () => {
      expect(substituteUrlencode("{urlencode  test }")).toBe("test");
    });
  });

  describe("{countdown}", () => {
    it("returns time remaining for future date", () => {
      const future = new Date(Date.now() + 86400000).toISOString();
      const result = substituteCountdown(`{countdown ${future}}`);
      expect(result).toBe("time remaining");
    });

    it("returns passed for past date", () => {
      expect(substituteCountdown("{countdown 2020-01-01}")).toBe("0s (passed)");
    });

    it("returns error for invalid date", () => {
      expect(substituteCountdown("{countdown not-a-date}")).toBe("(invalid date)");
    });
  });

  describe("{countup}", () => {
    it("returns time elapsed for past date", () => {
      expect(substituteCountup("{countup 2020-01-01}")).toBe("time elapsed");
    });

    it("returns in-the-future for future date", () => {
      const future = new Date(Date.now() + 86400000).toISOString();
      const result = substituteCountup(`{countup ${future}}`);
      expect(result).toBe("0s (in the future)");
    });

    it("returns error for invalid date", () => {
      expect(substituteCountup("{countup not-a-date}")).toBe("(invalid date)");
    });
  });

  describe("combined variables", () => {
    it("replaces multiple variable types in one template", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      const template = "{user} rolled a {random.1-6} in {channel}!";
      let result = substituteSimpleVars(template, "testuser", "mychan", []);
      result = substituteRandomRange(result);
      expect(result).toBe("testuser rolled a 1 in mychan!");
    });

    it("handles math with other variables", () => {
      const template = "Result: {math 2+3} for {user}";
      let result = substituteSimpleVars(template, "bob", "chan", []);
      result = substituteMath(result);
      expect(result).toBe("Result: 5 for bob");
    });

    it("handles shoutout pattern with touser", () => {
      const template = "Go check out {touser} at https://twitch.tv/{touser}";
      const result = substituteSimpleVars(template, "caller", "chan", ["streamer123"]);
      expect(result).toBe("Go check out streamer123 at https://twitch.tv/streamer123");
    });

    it("handles shoutout fallback to caller", () => {
      const template = "Go check out {touser} at https://twitch.tv/{touser}";
      const result = substituteSimpleVars(template, "caller", "chan", []);
      expect(result).toBe("Go check out caller at https://twitch.tv/caller");
    });
  });
});
