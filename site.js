/*
 * Kitchen Jam — the site's motion. No dependencies.
 *
 * One grammar, used everywhere: a dish drawing INKS ITSELF IN — the linework
 * draws along its own path, then the colour settles in behind it. The hero
 * phone plays the app's one mechanism (ask, one question, a card) and ends on
 * that same moment, so the page's signature and the product's promise are the
 * same thing.
 *
 * The page is complete without this file: every rule that hides something in
 * site.css is scoped under html.js, and reduced motion gets the finished state
 * with no spatial movement.
 */
(() => {
  const root = document.documentElement;
  root.classList.add("js");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* -------------------------------------------------------------- drawings */

  const cache = new Map();
  const fetchArt = (name) => {
    if (!cache.has(name)) {
      cache.set(
        name,
        fetch(`art/${name}.svg`).then((r) => (r.ok ? r.text() : "")),
      );
    }
    return cache.get(name);
  };

  const SHAPES = "path,ellipse,circle,rect,line,polyline,polygon";

  /**
   * Inline the drawing and set it to "not yet inked": every stroked shape gets
   * pathLength=1 so one dash covers any length, and fills start transparent.
   * A shape the artist already dashed keeps its dashes and only fades.
   */
  async function mount(el) {
    const svgText = await fetchArt(el.dataset.art);
    if (!svgText) return null;
    el.innerHTML = svgText;
    const svg = el.querySelector("svg");
    if (!svg) return null;
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    if (reduced) return svg;
    const shapes = [...svg.querySelectorAll(SHAPES)];
    svg._ink = shapes.map((s) => {
      const cs = getComputedStyle(s);
      const stroked = cs.stroke !== "none" && parseFloat(cs.strokeWidth) > 0;
      const dashed = s.hasAttribute("stroke-dasharray");
      const filled = cs.fill !== "none";
      if (stroked && !dashed) {
        s.setAttribute("pathLength", "1");
        s.style.strokeDasharray = "1 1";
        s.style.strokeDashoffset = "1";
        // Round caps paint a dot even on a zero-length dash, so a line stays
        // invisible until its draw begins.
        s.style.strokeOpacity = "0";
      }
      if (filled) s.style.fillOpacity = "0";
      if (dashed) s.style.opacity = "0";
      return { s, stroked: stroked && !dashed, filled, dashed };
    });
    return svg;
  }

  /** Ink a mounted drawing in: lines first, back to front, colour behind. */
  function ink(svg, { duration = 1300, delay = 0 } = {}) {
    if (!svg || !svg._ink || reduced) return Promise.resolve();
    const parts = svg._ink;
    const n = parts.length || 1;
    const runs = [];
    parts.forEach(({ s, stroked, filled, dashed }, i) => {
      // Later shapes (the food) start later than earlier ones (the vessel),
      // which is the drawing order the artists kept.
      const start = delay + (i / n) * duration * 0.5;
      const opts = { delay: start, fill: "both", easing: "cubic-bezier(0.16, 1, 0.3, 1)" };
      if (stroked) {
        runs.push(
          s.animate(
            [
              { strokeDashoffset: 1, strokeOpacity: 0 },
              { strokeDashoffset: 0.97, strokeOpacity: 1, offset: 0.04 },
              { strokeDashoffset: 0, strokeOpacity: 1 },
            ],
            { ...opts, duration: duration * 0.62 },
          ).finished,
        );
      }
      if (filled) {
        runs.push(
          s.animate([{ fillOpacity: 0 }, { fillOpacity: 1 }], {
            ...opts, delay: start + duration * 0.3, duration: duration * 0.45,
          }).finished,
        );
      }
      if (dashed) {
        runs.push(s.animate([{ opacity: 0 }, { opacity: 1 }], { ...opts, delay: start + duration * 0.3, duration: 400 }).finished);
      }
    });
    return Promise.all(runs).catch(() => {});
  }

  /** Put a drawing straight back to "not yet inked" (the demo loops). */
  function unink(svg) {
    if (!svg || !svg._ink) return;
    svg.getAnimations({ subtree: true }).forEach((a) => a.cancel());
  }

  /* -------------------------------------------------- inking on arrival */

  const arts = [...document.querySelectorAll("[data-art]")];
  const mounted = new Map(arts.map((el) => [el, mount(el)]));

  // The hero table inks in on load, after the headline, dish by dish.
  const tableDishes = arts.filter((el) => el.closest(".table"));
  tableDishes.forEach(async (el) => {
    const svg = await mounted.get(el);
    // One dish every 300ms at 1.2s each: about four drawing at once, never all
    // eight — stroke-dashoffset paints on the main thread.
    // Alternate sides, top to bottom, so the table fills in evenly.
    const i = tableDishes.indexOf(el);
    const order = (i % 4) * 2 + (i >= 4 ? 1 : 0);
    ink(svg, { duration: 1200, delay: 650 + order * 300 });
  });

  // Everything else inks in when it comes into view. A row of tiles arrives
  // as a row: capped stagger, so the last one is never kept waiting.
  const later = arts.filter((el) => !el.closest(".table") && !el.hasAttribute("data-manual"));
  if ("IntersectionObserver" in window && !reduced) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach(async (e) => {
          if (!e.isIntersecting) return;
          io.unobserve(e.target);
          const svg = await mounted.get(e.target);
          const group = e.target.closest(".tiles, .close__row");
          const index = group ? [...group.querySelectorAll("[data-art]")].indexOf(e.target) : 0;
          ink(svg, { duration: 1400, delay: Math.min(index % 4, 3) * 110 });
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.2 },
    );
    later.forEach((el) => io.observe(el));
  }

  /* ------------------------------------------------- the example requests */

  // Each request arrives as it scrolls into view, so scrolling reads like a
  // conversation filling in. Its own threshold, not a shared stagger: the
  // scroll is the timing.
  const prompts = [...document.querySelectorAll(".prompts li")];
  if (prompts.length && !reduced && "IntersectionObserver" in window) {
    const pio = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (!e.isIntersecting) return;
        pio.unobserve(e.target);
        e.target.classList.add("is-in");
      }),
      // Half, not all: each starts shifted right for its slide-in, and on a
      // phone that puts its edge off-screen, so "fully visible" never comes.
      { rootMargin: "0px 0px -22% 0px", threshold: 0.5 },
    );
    prompts.forEach((li) => pio.observe(li));
  } else {
    prompts.forEach((li) => li.classList.add("is-in"));
  }

  /* -------------------------------------------------------------- the demo */

  const demo = document.querySelector("[data-demo]");
  if (demo && !reduced) runDemo(demo);
  else if (demo) mounted.get(demo.querySelector("[data-art]"));

  async function runDemo(screen) {
    // Hide the steps before the first await, or they flash on load.
    screen.closest(".hero").classList.add("demo-live");
    const thread = screen.querySelector(".thread");
    const steps = Object.fromEntries(
      [...screen.querySelectorAll("[data-step]")].map((el) => [el.dataset.step, el]),
    );
    const composer = screen.querySelector("[data-composer]");
    const composerBox = composer.parentElement;
    const placeholder = composer.textContent;
    const typedText = screen.querySelector("[data-typed]").textContent;
    const pick = screen.querySelector("[data-pick]");
    const cardArt = await mounted.get(screen.querySelector("[data-art]"));

    // Play only while the phone is on screen and the tab is visible: a
    // looping demo nobody is watching is wasted battery.
    let visible = false;
    const gate = () =>
      new Promise((resolve) => {
        const check = () => (visible && !document.hidden ? resolve() : setTimeout(check, 250));
        check();
      });
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.15 }).observe(screen);

    const show = (el) => el.classList.add("is-in");

    await wait(1300);
    for (;;) {
      await gate();
      // Type the request into the composer.
      composerBox.classList.add("is-typing");
      for (let i = 1; i <= typedText.length; i++) {
        composer.textContent = typedText.slice(0, i);
        await wait(typedText[i - 1] === " " ? 70 : 34);
      }
      await wait(380);
      composer.textContent = placeholder;
      composerBox.classList.remove("is-typing");
      show(steps.ask);
      await wait(900); await gate();
      show(steps.question);
      await wait(450);
      show(steps.chips);
      await wait(1100); await gate();
      pick.classList.add("is-picked");
      pick.animate([{ transform: "scale(1)" }, { transform: "scale(0.92)" }, { transform: "scale(1)" }], { duration: 320, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
      await wait(420);
      show(steps.answer);
      await wait(800); await gate();
      show(steps.card);
      await wait(260);
      await ink(cardArt, { duration: 1700 });
      await wait(3600); await gate();
      // Clear and go again.
      thread.classList.add("is-clearing");
      await wait(420);
      Object.values(steps).forEach((el) => el.classList.remove("is-in"));
      pick.classList.remove("is-picked");
      unink(cardArt);
      rearm(cardArt);
      thread.classList.remove("is-clearing");
      await wait(700);
    }
  }

  /* ------------------------------------------------------------ features */

  // Eight features as tabs: hover (with a pointer), click, tap or arrow keys
  // swap the headline and the phone's screen. Hover waits a beat so sweeping
  // the pointer across the list does not flicker through every screen.
  const tablist = document.querySelector(".feats");
  if (tablist) {
    const tabs = [...tablist.querySelectorAll("[role=tab]")];
    const headline = document.querySelector("[data-feat-headline]");
    const screens = Object.fromEntries(tabs.map((t) => [t.dataset.feat, document.getElementById(t.getAttribute("aria-controls"))]));
    let current = tabs.find((t) => t.getAttribute("aria-selected") === "true");
    let run = 0; // bumps on every switch, so a screen's moment stops when you leave it

    const moments = {
      async save(screen, token) {
        const svg = await mounted.get(screen.querySelector("[data-art]"));
        if (token === run) { unink(svg); rearm(svg); ink(svg, { duration: 1300 }); }
      },
      async share(screen, token) {
        const svg = await mounted.get(screen.querySelector("[data-art]"));
        if (token === run) { unink(svg); rearm(svg); ink(svg, { duration: 1200 }); }
      },
      async talk(screen, token) {
        const words = screen.querySelector("[data-talk]");
        const text = words.dataset.full || (words.dataset.full = words.textContent);
        if (reduced) return;
        words.textContent = "";
        for (let i = 1; i <= text.length && token === run; i++) {
          words.textContent = text.slice(0, i);
          await wait(text[i - 1] === " " ? 80 : 45);
        }
      },
      async scale(screen, token) {
        const serves = screen.querySelector("[data-serves]");
        const amts = [...screen.querySelectorAll("[data-amt]")];
        const set = (k) => {
          serves.textContent = String(2 * k);
          amts.forEach((b) => {
            b.textContent = Number(b.dataset.amt) * k + (b.dataset.unit || "");
            b.classList.toggle("is-changed", k === 2);
          });
        };
        set(1);
        if (reduced) return;
        while (token === run) {
          await wait(1400); if (token !== run) break; set(2);
          await wait(2200); if (token !== run) break; set(1);
        }
        set(1);
      },
    };

    const show = (tab, { focus = false } = {}) => {
      if (tab === current) return;
      current.setAttribute("aria-selected", "false");
      current.tabIndex = -1;
      screens[current.dataset.feat].classList.remove("is-active");
      tab.setAttribute("aria-selected", "true");
      tab.tabIndex = 0;
      if (focus) tab.focus();
      const screen = screens[tab.dataset.feat];
      screen.classList.add("is-active");
      current = tab;
      const token = ++run;
      // Headline: out, swap, in.
      if (reduced) headline.textContent = tab.dataset.headline;
      else {
        headline.classList.add("is-out");
        setTimeout(() => { if (token === run) { headline.textContent = tab.dataset.headline; headline.classList.remove("is-out"); } }, 180);
      }
      moments[tab.dataset.feat]?.(screen, token);
      // On a phone, keep the chosen chip in view.
      if (tablist.scrollWidth > tablist.clientWidth) tab.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduced ? "auto" : "smooth" });
    };

    let hoverTimer = 0;
    const canHover = matchMedia("(hover: hover) and (pointer: fine)").matches;
    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => show(tab));
      if (canHover) {
        tab.addEventListener("pointerenter", () => { clearTimeout(hoverTimer); hoverTimer = setTimeout(() => show(tab), 90); });
        tab.addEventListener("pointerleave", () => clearTimeout(hoverTimer));
      }
      tab.addEventListener("keydown", (e) => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (step) { e.preventDefault(); show(tabs[(i + step + tabs.length) % tabs.length], { focus: true }); }
        if (e.key === "Home") { e.preventDefault(); show(tabs[0], { focus: true }); }
        if (e.key === "End") { e.preventDefault(); show(tabs[tabs.length - 1], { focus: true }); }
      });
    });
  }

  /** Put a mounted drawing back to "not yet inked", ready to ink again. */
  function rearm(svg) {
    if (!svg || !svg._ink) return;
    svg._ink.forEach(({ s, stroked, filled, dashed }) => {
      if (stroked) { s.style.strokeDashoffset = "1"; s.style.strokeOpacity = "0"; }
      if (filled) s.style.fillOpacity = "0";
      if (dashed) s.style.opacity = "0";
    });
  }

  /* ------------------------------------------------ reading the quote */

  // The "why it works" reason darkens word by word as it scrolls through the middle of
  // the screen: the sentence is read, not just shown.
  const quote = document.querySelector("[data-read]");
  if (quote && !reduced) {
    const words = quote.textContent.trim().split(/\s+/);
    quote.innerHTML = words.map((w) => `<span class="w">${w}</span>`).join(" ");
    const spans = [...quote.querySelectorAll(".w")];
    let ticking = false;
    const paint = () => {
      ticking = false;
      const r = quote.getBoundingClientRect();
      const vh = innerHeight;
      // 0 when the quote's top is at 85% of the viewport, 1 when its bottom reaches 45%.
      const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.4)));
      const lit = p * spans.length;
      spans.forEach((s, i) => { s.style.opacity = String(0.35 + 0.65 * Math.min(1, Math.max(0, lit - i))); });
    };
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(paint); } }, { passive: true });
    addEventListener("resize", paint);
    paint();
  }

  /* ------------------------------------------------ pointer depth */

  // The depth variables live on .table, not the stage: set on the stage they
  // would restyle the whole demo phone every frame.
  const stage = document.querySelector("[data-stage]");
  const table = stage && stage.querySelector(".table");
  if (table && !reduced && matchMedia("(pointer: fine)").matches) {
    let tx = 0, ty = 0, x = 0, y = 0, raf = 0, near = true;
    new IntersectionObserver(([e]) => { near = e.isIntersecting; }).observe(stage);
    addEventListener("pointermove", (e) => {
      if (!near) return;
      tx = e.clientX / innerWidth - 0.5;
      ty = e.clientY / innerHeight - 0.5;
      if (!raf) raf = requestAnimationFrame(step);
    }, { passive: true });
    function step() {
      x += (tx - x) * 0.08;
      y += (ty - y) * 0.08;
      table.style.setProperty("--px", x.toFixed(4));
      table.style.setProperty("--py", y.toFixed(4));
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.001 ? requestAnimationFrame(step) : 0;
    }
  }

  /* ------------------------------------------------ the bar */

  // The bar takes its paper the moment the page moves: waiting for the
  // headline to leave let the headline slide under a transparent bar.
  const bar = document.querySelector("[data-bar]");
  if (bar) {
    let on = null;
    const update = () => {
      const next = scrollY > 4;
      if (next !== on) { on = next; bar.classList.toggle("is-scrolled", next); }
    };
    addEventListener("scroll", update, { passive: true });
    update();
  }
})();
