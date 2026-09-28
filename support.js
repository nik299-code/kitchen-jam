/*
 * Support page behaviour. No dependencies; the page works without it.
 *
 * - Search filters the questions as you type and marks the match.
 * - The topic list marks the topic on screen.
 * - A link to #some-topic opens that topic's first answer.
 * - The contact drawing inks itself in, like the home page's drawings.
 */
(() => {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------------- search */
  const input = document.querySelector("[data-search]");
  const empty = document.querySelector("[data-empty]");
  const items = [...document.querySelectorAll(".qa")].map((qa) => ({
    qa,
    summary: qa.querySelector("summary"),
    plain: qa.querySelector("summary").textContent,
    text: qa.textContent.toLowerCase(),
    wasOpen: qa.open,
  }));
  const groups = [...document.querySelectorAll(".sp-group")];
  const escape = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  input?.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    let shown = 0;
    items.forEach((it) => {
      const hit = !q || it.text.includes(q);
      it.qa.classList.toggle("is-hidden", !hit);
      if (hit) shown++;
      // Open matches so the answer is visible; restore the rest on clear.
      it.qa.open = q ? hit : it.wasOpen;
      const i = q ? it.plain.toLowerCase().indexOf(q) : -1;
      it.summary.innerHTML = i < 0 ? escape(it.plain)
        : escape(it.plain.slice(0, i)) + "<mark>" + escape(it.plain.slice(i, i + q.length)) + "</mark>" + escape(it.plain.slice(i + q.length));
    });
    groups.forEach((g) => g.classList.toggle("is-hidden", !g.querySelector(".qa:not(.is-hidden)")));
    empty.hidden = shown > 0;
  });

  /* ------------------------------------------------------ topic list */
  const links = [...document.querySelectorAll(".sp-toc a")];
  const sections = links.map((a) => document.querySelector(a.getAttribute("href")));
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((a, i) => a.classList.toggle("is-here", sections[i] === e.target));
      });
    }, { rootMargin: "-30% 0px -60% 0px" });
    sections.forEach((s) => s && io.observe(s));
  }
  const openFromHash = () => {
    const target = location.hash && document.querySelector(location.hash);
    const first = target?.querySelector?.(".qa");
    if (first) first.open = true;
  };
  addEventListener("hashchange", openFromHash);
  openFromHash();

  /* ------------------------------------------------ the contact drawing */
  const art = document.querySelector(".sp-contact__art");
  if (!art) return;
  fetch(`art/${art.dataset.art}.svg`).then((r) => (r.ok ? r.text() : "")).then((svgText) => {
    if (!svgText) return;
    art.innerHTML = svgText;
    const svg = art.querySelector("svg");
    if (!svg || reduced || !("IntersectionObserver" in window)) return;
    const shapes = [...svg.querySelectorAll("path,ellipse,circle,rect,line,polyline,polygon")];
    const parts = shapes.map((s) => {
      const cs = getComputedStyle(s);
      const stroked = cs.stroke !== "none" && parseFloat(cs.strokeWidth) > 0 && !s.hasAttribute("stroke-dasharray");
      const filled = cs.fill !== "none";
      if (stroked) { s.setAttribute("pathLength", "1"); s.style.strokeDasharray = "1 1"; s.style.strokeDashoffset = "1"; s.style.strokeOpacity = "0"; }
      if (filled) s.style.fillOpacity = "0";
      return { s, stroked, filled };
    });
    new IntersectionObserver(([e], io) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const ease = "cubic-bezier(0.16, 1, 0.3, 1)";
      parts.forEach(({ s, stroked, filled }, i) => {
        const delay = (i / parts.length) * 650;
        if (stroked) s.animate([{ strokeDashoffset: 1, strokeOpacity: 0 }, { strokeDashoffset: 0.97, strokeOpacity: 1, offset: 0.04 }, { strokeDashoffset: 0, strokeOpacity: 1 }], { duration: 800, delay, fill: "both", easing: ease });
        if (filled) s.animate([{ fillOpacity: 0 }, { fillOpacity: 1 }], { duration: 600, delay: delay + 400, fill: "both", easing: ease });
      });
    }, { threshold: 0.4 }).observe(art);
  });
})();
