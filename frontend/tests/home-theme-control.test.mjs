import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

// Exercise both components against one context without installing a DOM runner.
function controls() {
  const context = { ready: false, theme: "light", toggleTheme() { this.theme = this.theme === "light" ? "dark" : "light"; } };
  context.toggleTheme = context.toggleTheme.bind(context);
  function load(path, name) {
    const slots = [];
    let cursor = 0;
    let effects = [];
    const hooks = {
      useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
      useState(initial) { const i = cursor++; slots[i] ??= initial; return [slots[i], (fn) => { slots[i] = fn(slots[i]); }]; },
      useEffect(fn) { effects.push(fn); },
    };
    const module = { exports: {} };
    const code = ts.transpileModule(read(path), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
    vm.runInNewContext(code, { module, exports: module.exports, require(id) {
      if (id === "react") return hooks;
      if (id === "./theme-provider") return { useTheme: () => context };
      return require(id);
    } });
    return () => {
      cursor = 0; effects = [];
      const tree = module.exports[name]();
      effects.forEach((fn) => fn());
      return tree;
    };
  }
  return { context, left: load("../components/v2/home-theme-control.tsx", "HomeThemeControl"), right: load("../components/v2/theme-toggle.tsx", "ThemeToggle") };
}

test("both controls toggle the same theme and every change rotates clockwise", () => {
  const { context, left, right } = controls();
  context.ready = true;
  left();
  right().props.onClick();
  left();
  assert.equal(left().props.children.props.style.transform, "rotate(360deg)");
  assert.equal(left().props["aria-label"], "Switch to light theme");
  left().props.onClick();
  left();
  assert.equal(left().props.children.props.style.transform, "rotate(720deg)");
  assert.equal(right().props["aria-label"], "Switch to dark theme");
});

test("initial markup is deterministic and restoring saved dark mode does not spin", () => {
  const { context, left } = controls();
  const initial = left();
  assert.equal(initial.props["aria-label"], "Change color theme");
  assert.equal(initial.props.children.props.style.transform, "rotate(0deg)");
  context.ready = true; context.theme = "dark";
  left();
  assert.equal(left().props.children.props.style.transform, "rotate(0deg)");
  const source = read("../components/v2/home-theme-control.tsx");
  assert.doesNotMatch(source, /localStorage|matchMedia|setTheme/);
});

test("both icons crossfade with the root theme and reduced motion disables transitions", () => {
  const css = read("../app/home-theme-control.css");
  assert.match(css, /transform 600ms/);
  assert.match(css, /opacity 600ms/);
  assert.match(css, /:root\[data-theme="dark"\] \.home-theme-sun \{ opacity: 0/);
  assert.match(css, /:root\[data-theme="dark"\] \.home-theme-moon \{ opacity: 1/);
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*transition: none/);
  const home = read("../components/v2/public-home.tsx");
  assert.match(home, /<HomeThemeControl \/>/);
  assert.match(home, /<ThemeToggle \/>/);
});
