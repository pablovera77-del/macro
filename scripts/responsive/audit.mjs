#!/usr/bin/env node
/**
 * Auditoría responsive con navegador real (Playwright + Chromium).
 *
 * Recorre todas las pantallas de cada rol (menú de NAV_BY_ROLE + ficha del paciente
 * con cada solapa + paneles laterales abiertos + login + restablecer + portal de
 * familias), a 390x844 (celular), 768x1024 (tablet) y 1280x800 (compu), saca una
 * captura por pantalla/rol/ancho y corre verificaciones automáticas.
 *
 * Requisitos: el stub (stub-supabase.mjs) y la app compilada con ese stub
 * funcionando. Ver scripts/responsive/README.md.
 *
 *   PW_PATH=$(npm root -g)/playwright node scripts/responsive/audit.mjs \
 *       --out capturas/antes [--base http://localhost:3100] [--roles direccion,transporte] \
 *       [--widths 390,768,1280] [--only agenda,pedidos] [--no-shots]
 *
 * Salida: PNG por pantalla + report.json + resumen.md en la carpeta --out.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { DEMO_USERS, makeJwt } from "./fixtures.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || "playwright");

// ---------- argumentos ----------
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith("--")) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : "true"]);
  return acc;
}, []));
const BASE = args.base || process.env.BASE_URL || "http://localhost:3100";
const STUB = args.stub || process.env.STUB_URL || "http://localhost:54321";
const OUT = path.resolve(args.out || "capturas-celular/audit");
const WIDTHS = (args.widths || "390,768,1280").split(",").map(Number);
const ONLY_ROLES = args.roles ? args.roles.split(",") : null;
const ONLY = args.only ? args.only.split(",") : null;
const SHOTS = args["no-shots"] !== "true";
const CHROME = process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const VIEWPORTS = { 390: { width: 390, height: 844, dsf: 2, touch: true, label: "390" }, 768: { width: 768, height: 1024, dsf: 1, touch: true, label: "768" }, 1280: { width: 1280, height: 800, dsf: 1, touch: false, label: "1280" } };
const MIN_TOUCH = 44;
const SHORT_NAV = Object.fromEntries(DEMO_USERS.map((u) => [u.role, u.key]));

fs.mkdirSync(OUT, { recursive: true });

// ---------- rutas por rol (leídas de NAV_BY_ROLE en src/lib/auth.ts) ----------
function navByRole() {
  const src = fs.readFileSync(path.join(root, "src/lib/auth.ts"), "utf8");
  const block = src.slice(src.indexOf("export const NAV_BY_ROLE"), src.indexOf("export const ROLE_ACCENT"));
  const out = {};
  const re = /^\s*(\w+): \[([\s\S]*?)^\s*\],/gm;
  let m;
  while ((m = re.exec(block))) out[m[1]] = [...m[2].matchAll(/href: "([^"]+)", label: "([^"]+)"/g)].map((x) => ({ href: x[1], label: x[2] }));
  return out;
}

function sessionCookie(user) {
  const session = {
    access_token: makeJwt(user.id, user.email), token_type: "bearer", expires_in: 31536000,
    expires_at: Math.floor(Date.now() / 1000) + 31536000, refresh_token: "stub-refresh-" + user.id,
    user: { id: user.id, aud: "authenticated", role: "authenticated", email: user.email, app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
  };
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  // Si pasara el límite de una cookie (3180 bytes) se parte en trozos .0, .1 …
  const name = `sb-${new URL(STUB).hostname.split(".")[0]}-auth-token`;
  if (value.length <= 3180) return [{ name, value, url: BASE }];
  const parts = value.match(/.{1,3180}/g);
  return parts.map((v, i) => ({ name: `${name}.${i}`, value: v, url: BASE }));
}

// ---------- verificaciones dentro de la página ----------
// Se inyecta como texto: devuelve un objeto serializable con todos los hallazgos de la pantalla.
const CHECKS = `(({ minTouch, scope }) => {
  const vw = window.innerWidth;
  const out = { vw, docScrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth, pageHeight: document.documentElement.scrollHeight };
  const css = (el) => getComputedStyle(el);
  const visible = (el) => {
    if (!el.checkVisibility) return true;
    if (!el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true })) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const sel = (el) => {
    const parts = [];
    let e = el;
    for (let i = 0; e && e.nodeType === 1 && i < 3 && e !== document.body; i++, e = e.parentElement) {
      let s = e.tagName.toLowerCase();
      if (e.id) { s += '#' + e.id; parts.unshift(s); break; }
      const cls = (typeof e.className === 'string' ? e.className : '').split(/\\s+/).filter((c) => c && !/^(hover|focus|transition|animate|stagger)/.test(c)).slice(0, 3);
      if (cls.length) s += '.' + cls.join('.');
      parts.unshift(s);
    }
    return parts.join(' > ');
  };
  const txt = (el) => (el.getAttribute('aria-label') || el.innerText || el.value || el.getAttribute('placeholder') || el.title || '').replace(/\\s+/g, ' ').trim().slice(0, 60);
  const inOffscreen = (el) => !!el.closest('[aria-hidden="true"]');
  const scrollerOf = (el) => { // ancestro con scroll horizontal propio
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const o = css(p).overflowX;
      if (o === 'auto' || o === 'scroll') return p;
    }
    return null;
  };

  out.pointerCoarse = matchMedia('(pointer: coarse)').matches;

  // 1) Scroll horizontal de la página y quiénes lo causan
  out.hscroll = out.docScrollWidth > vw + 1 || out.bodyScrollWidth > vw + 1;
  const culprits = [];
  if (out.hscroll || true) {
    for (const el of document.querySelectorAll('body *')) {
      if (!visible(el) || inOffscreen(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 && r.width > 0 && !scrollerOf(el) && !(css(el).position === 'fixed')) {
        const p = el.parentElement;
        const pr = p ? p.getBoundingClientRect() : null;
        // solo el "más externo" que se pasa (si el padre ya se pasa, el culpable es el padre)
        if (!pr || pr.right <= vw + 1) culprits.push({ sel: sel(el), text: txt(el), right: Math.round(r.right), width: Math.round(r.width) });
      }
    }
  }
  out.overflowCulprits = culprits.slice(0, 10);

  // 2) Elementos táctiles chicos
  const interactiveSel = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [onclick]';
  const small = [], inline = [];
  const items = [];
  for (const el of document.querySelectorAll(interactiveSel)) {
    if (!visible(el) || inOffscreen(el)) continue;
    if (scope && !el.closest(scope)) continue;
    let target = el;
    const t = el.type;
    if ((t === 'checkbox' || t === 'radio')) { const lab = el.closest('label'); if (lab) target = lab; }
    const r = target.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const isInlineLink = el.tagName === 'A' && css(el).display === 'inline';
    items.push({ el, r, target });
    if (r.height < minTouch - 0.5 || r.width < minTouch - 0.5) {
      const rec = { sel: sel(el), text: txt(el), w: Math.round(r.width), h: Math.round(r.height), tag: el.tagName.toLowerCase() + (t ? '[' + t + ']' : '') };
      (isInlineLink ? inline : small).push(rec);
    }
  }
  out.smallTargets = small; out.inlineLinksSmall = inline; out.interactiveCount = items.length;

  // 3) Campos con letra menor a 16px
  out.smallInputFont = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]), select, textarea')]
    .filter((el) => visible(el) && !inOffscreen(el) && parseFloat(css(el).fontSize) < 16)
    .map((el) => ({ sel: sel(el), text: txt(el), font: css(el).fontSize }));

  // 4) Texto cortado / que desborda su caja
  const clipped = [], overflowing = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el) || inOffscreen(el)) continue;
    const c = css(el);
    if (!el.childNodes || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const hClip = el.scrollWidth > el.clientWidth + 1;
    const vClip = el.scrollHeight > el.clientHeight + 1;
    const ox = c.overflowX, oy = c.overflowY;
    if (hClip && (c.textOverflow === 'ellipsis' || ox === 'hidden' || ox === 'clip')) clipped.push({ sel: sel(el), text: txt(el), why: c.textOverflow === 'ellipsis' ? 'puntos suspensivos (…)' : 'overflow oculto', box: Math.round(el.clientWidth), content: Math.round(el.scrollWidth) });
    else if (vClip && (oy === 'hidden' || oy === 'clip') && c.display !== 'inline') clipped.push({ sel: sel(el), text: txt(el), why: 'cortado en alto', box: Math.round(el.clientHeight), content: Math.round(el.scrollHeight) });
    else if (hClip && ox === 'visible' && c.display !== 'inline' && el.clientWidth > 0) overflowing.push({ sel: sel(el), text: txt(el), box: Math.round(el.clientWidth), content: Math.round(el.scrollWidth) });
  }
  out.clippedText = clipped.slice(0, 15); out.overflowingText = overflowing.slice(0, 15);

  // 5) Botones/links que se pisan entre sí (solapados)
  const overlaps = [];
  const list = items.filter((i) => i.el.tagName !== 'INPUT' || (i.el.type !== 'checkbox' && i.el.type !== 'radio'));
  for (let i = 0; i < list.length && overlaps.length < 8; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const x = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const y = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (x > 2 && y > 2) {
        const area = x * y, min = Math.min(a.r.width * a.r.height, b.r.width * b.r.height);
        if (area / min > 0.25) overlaps.push({ a: sel(a.el) + ' «' + txt(a.el) + '»', b: sel(b.el) + ' «' + txt(b.el) + '»' });
      }
    }
  }
  out.overlappingControls = overlaps;

  // 6) Tablas: ¿tienen su propio scroll?
  out.tables = [...document.querySelectorAll('table')].filter(visible).map((t) => {
    const sc = scrollerOf(t);
    const box = sc || t.parentElement;
    return { sel: sel(t), width: Math.round(t.getBoundingClientRect().width), container: Math.round(box.clientWidth), innerScroll: !!sc && sc.scrollWidth > sc.clientWidth + 1, hasScroller: !!sc, breaksPage: !sc && t.getBoundingClientRect().right > vw + 1 };
  });

  // 7) Elementos fijos o pegajosos (pueden tapar contenido)
  out.fixedEls = [...document.querySelectorAll('body *')].filter((el) => { const p = css(el).position; return (p === 'fixed' || p === 'sticky') && visible(el) && !inOffscreen(el); })
    .map((el) => { const r = el.getBoundingClientRect(); return { sel: sel(el), pos: css(el).position, w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(window.innerHeight - r.bottom) }; })
    .filter((f) => !(f.w >= vw - 1 && f.h >= window.innerHeight - 1));

  // 8) Texto muy chico (< 12px) con contenido
  const tiny = new Map();
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el) || inOffscreen(el)) continue;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
    if (own.length < 3) continue;
    const fs = parseFloat(css(el).fontSize);
    if (fs < 12) { const k = fs + 'px'; const v = tiny.get(k) || { font: k, count: 0, ejemplos: [] }; v.count++; if (v.ejemplos.length < 3) v.ejemplos.push(own.slice(0, 40)); tiny.set(k, v); }
  }
  out.tinyText = [...tiny.values()];

  // 9) Controles tapados por un elemento fijo (probado al final de la página)
  const covered = [];
  const prevY = window.scrollY;
  for (const it of items.slice(-60)) {
    const r0 = it.el.getBoundingClientRect();
    if (r0.height === 0) continue;
    it.el.scrollIntoView({ block: 'end' });
    const r = it.el.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= window.innerHeight) continue;
    const cx = Math.min(Math.max(r.left + r.width / 2, 1), vw - 1), cy = Math.min(Math.max(r.top + r.height / 2, 1), window.innerHeight - 1);
    const hit = document.elementFromPoint(cx, cy);
    if (hit && !(it.el === hit || it.el.contains(hit) || hit.contains(it.el) || (it.el.closest('label') && it.el.closest('label').contains(hit)))) {
      const fx = hit.closest('[class*="fixed"], [class*="sticky"]');
      if (fx) covered.push({ sel: sel(it.el), text: txt(it.el), tapadoPor: sel(fx) });
    }
  }
  window.scrollTo(0, prevY);
  out.coveredControls = covered.slice(0, 10);

  // 10) Qué hay arriba del pliegue: primer botón/enlace de acción y cuánto alto ocupa el encabezado
  const h1 = document.querySelector('main h1');
  out.h1 = h1 ? { text: txt(h1), top: Math.round(h1.getBoundingClientRect().top) } : null;
  const firstActions = items.filter((i) => i.el.closest('main') && i.r.top < window.innerHeight).length;
  out.actionsAboveFold = firstActions;
  const sh = document.querySelector('header.sticky');
  out.stickyHeaderH = sh ? Math.round(sh.getBoundingClientRect().height) : 0;
  return out;
})`;

// ---------- utilidades ----------
const results = [];
const slug = (s) => s.replace(/^\//, "").replace(/[?&=#/]+/g, "-").replace(/-+$/, "") || "inicio";

function severity(f, vw) {
  // Heurística para ordenar: alta = rompe el uso en celular; media = incomoda; baja = detalle.
  const sev = [];
  if (f.hscroll) sev.push(["alta", "La página se desplaza hacia los costados"]);
  if (f.tables.some((t) => t.breaksPage)) sev.push(["alta", "Una tabla ensancha la página (sin scroll propio)"]);
  if (f.coveredControls.length) sev.push(["alta", `${f.coveredControls.length} control(es) tapado(s) por un elemento fijo`]);
  if (f.overlappingControls.length) sev.push(["media", `${f.overlappingControls.length} botones/enlaces se pisan`]);
  if (vw <= 430) {
    if (f.smallInputFont.length) sev.push(["media", `${f.smallInputFont.length} campo(s) con letra < 16 px (iOS acerca la pantalla)`]);
    if (f.smallTargets.length) sev.push([f.smallTargets.length > 6 ? "media" : "baja", `${f.smallTargets.length} control(es) de menos de 44 px`]);
    if (f.clippedText.length) sev.push(["media", `${f.clippedText.length} texto(s) cortado(s)`]);
  }
  if (f.overflowingText.length) sev.push(["media", `${f.overflowingText.length} texto(s) se salen de su caja`]);
  return sev;
}

async function settle(page) {
  try { await page.waitForLoadState("networkidle", { timeout: 8000 }); } catch { /* sigue */ }
  await page.waitForTimeout(350);
}

async function capture(page, { name, role, screen, vwKey, route, note, scope = null, fullPage = true }) {
  await settle(page);
  const vp = VIEWPORTS[vwKey];
  const findings = await page.evaluate(`${CHECKS}(${JSON.stringify({ minTouch: MIN_TOUCH, scope })})`);
  const file = `${name}.png`;
  if (SHOTS) {
    await page.screenshot({ path: path.join(OUT, file), fullPage });
    if (vwKey === 390 && fullPage && args.fold !== "false") await page.screenshot({ path: path.join(OUT, `${name}--pliegue.png`), fullPage: false });
  }
  const sev = severity(findings, vp.width);
  results.push({ name, file, role, screen, width: vp.width, route, note: note || null, findings, severity: sev });
  const flag = sev.filter((s) => s[0] === "alta").length ? "ALTA" : sev.length ? "media/baja" : "ok";
  console.log(`${flag.padEnd(10)} ${String(vp.width).padEnd(5)} ${role.padEnd(24)} ${screen}${sev.length ? "  ← " + sev.map((s) => s[1]).join("; ") : ""}`);
  return findings;
}

async function newCtx(browser, vwKey, user) {
  const vp = VIEWPORTS[vwKey];
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dsf, isMobile: vp.touch && vp.width < 800, hasTouch: vp.touch, locale: "es-AR", timezoneId: "America/Argentina/San_Juan" });
  if (user) await ctx.addCookies(sessionCookie(user));
  await ctx.addInitScript(() => {
    // Animaciones apagadas: las capturas salen siempre en su estado final.
    const s = document.createElement("style");
    s.textContent = "*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(s));
  });
  return ctx;
}

async function go(page, route) {
  const resp = await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 45000 });
  await settle(page);
  return resp;
}

// ---------- recorrido ----------
async function main() {
  const nav = navByRole();
  const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const patientRes = await fetch(`${STUB}/rest/v1/patients?select=id&order=nombre_completo&limit=1`).then((r) => r.json());
  const patientId = args.patient || patientRes[0].id;
  const wantRoute = (r) => !ONLY || ONLY.some((o) => r.includes(o));

  for (const vwKey of WIDTHS) {
    // --- pantallas sin sesión ---
    {
      const ctx = await newCtx(browser, vwKey, null);
      const page = await ctx.newPage();
      if (wantRoute("login")) {
        await go(page, "/login");
        await capture(page, { name: `sin-sesion__login__${vwKey}`, role: "sin-sesion", screen: "login", vwKey, route: "/login" });
        // Modo "recuperar contraseña"
        const rec = page.getByRole("button", { name: /Olvidé mi contraseña/ });
        if (await rec.count()) { await rec.click(); await capture(page, { name: `sin-sesion__login-recuperar__${vwKey}`, role: "sin-sesion", screen: "login (recuperar contraseña)", vwKey, route: "/login" }); }
      }
      if (wantRoute("familia")) {
        const token = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
        await go(page, `/familia/${token}`);
        await capture(page, { name: `sin-sesion__familia-pin__${vwKey}`, role: "sin-sesion", screen: "portal de familias (PIN)", vwKey, route: `/familia/${token}` });
        const pin = page.locator('input[inputmode="numeric"]');
        if (await pin.count()) {
          await pin.fill("123456");
          await page.getByRole("button", { name: /Ver las visitas/ }).click();
          await page.waitForSelector("text=Próximas visitas", { timeout: 8000 }).catch(() => {});
          await capture(page, { name: `sin-sesion__familia-visitas__${vwKey}`, role: "sin-sesion", screen: "portal de familias (visitas)", vwKey, route: `/familia/${token}` });
        }
      }
      await ctx.close();
    }

    // --- pantallas con sesión, por rol ---
    for (const user of DEMO_USERS) {
      if (ONLY_ROLES && !ONLY_ROLES.includes(user.key)) continue;
      const ctx = await newCtx(browser, vwKey, user);
      const page = await ctx.newPage();
      const pageErrors = [];
      page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));
      const routes = [...(nav[user.role] || []).map((n) => ({ route: n.href, label: n.label }))];
      if (user.role === "profesional_asistencial" || user.role === "administracion" || user.role === "coordinador_internacion" || user.role === "direccion") {
        routes.push({ route: `/paciente/${patientId}`, label: "Ficha del paciente", patient: true });
      }
      if (user.role === "administracion") routes.push({ route: "/pacientes", label: "Autorizaciones de stock (directo)", skip: routes.some((r) => r.route === "/pacientes") });
      if (wantRoute("restablecer")) routes.push({ route: "/restablecer", label: "Restablecer contraseña" });

      for (const r of routes) {
        if (r.skip || !wantRoute(r.route)) continue;
        const resp = await go(page, r.route);
        const base = `${user.key}__${slug(r.route.replace(patientId, "paciente"))}__${vwKey}`;
        await capture(page, { name: base, role: user.key, screen: r.label + " " + r.route.replace(patientId, "<id>"), vwKey, route: r.route, note: resp && resp.status() >= 400 ? `HTTP ${resp.status()}` : null });

        // Menú y drawer (solo bajo 1024)
        if (r === routes[0] && vwKey < 1024) {
          const burger = page.getByRole("button", { name: "Abrir menú" });
          if (await burger.count()) {
            await burger.click();
            await page.waitForTimeout(250);
            await capture(page, { name: `${user.key}__menu-drawer__${vwKey}`, role: user.key, screen: "Menú lateral abierto (hamburguesa)", vwKey, route: r.route, fullPage: false, scope: "aside" });
            await page.keyboard.press("Escape");
            await go(page, r.route);
          }
        }

        // Solapas de la ficha del paciente
        if (r.patient) {
          const tabs = await page.$$eval('nav[aria-label="Secciones de la ficha"] a', (as) => as.map((a) => ({ href: a.getAttribute("href"), text: a.textContent.trim() })));
          for (const t of tabs) {
            if (t.href.endsWith("tab=resumen")) continue;
            await go(page, t.href);
            await capture(page, { name: `${user.key}__paciente-${t.href.split("tab=")[1]}__${vwKey}`, role: user.key, screen: `Ficha del paciente · solapa «${t.text}»`, vwKey, route: t.href });
          }
          continue;
        }

        // Paneles laterales de esa pantalla (SidePanel): se abren con #id
        await go(page, r.route);
        const panels = await page.$$eval('div[id][aria-hidden] > aside[role="dialog"]', (as) => as.map((a) => ({ id: a.parentElement.id, title: a.getAttribute("aria-label") })));
        for (const p of panels) {
          await page.evaluate((id) => { location.hash = id; }, p.id);
          await page.waitForTimeout(250);
          const f = await capture(page, { name: `${user.key}__${slug(r.route)}__panel-${p.id}__${vwKey}`, role: user.key, screen: `${r.label} · panel «${p.title}» (#${p.id})`, vwKey, route: `${r.route}#${p.id}`, fullPage: false, scope: `#${p.id} aside` });
          // ancho del panel respecto de la pantalla
          const w = await page.$eval(`#${p.id} aside`, (el) => Math.round(el.getBoundingClientRect().width));
          results[results.length - 1].panelWidth = w;
          await page.evaluate(() => { history.replaceState(null, "", location.pathname + location.search); window.dispatchEvent(new Event("hashchange")); });
          void f;
        }
      }

      // Buscador de pacientes (visible solo para algunos roles) y aviso de confirmación (toast)
      if (["administracion", "coordinador_internacion", "profesional_asistencial"].includes(user.role) && wantRoute("buscador")) {
        await go(page, "/inicio");
        const box = page.locator('main input[type="search"], main input[placeholder*="Buscar"]').first();
        if (await box.count()) {
          await box.click(); await box.fill("ro"); await page.waitForTimeout(900);
          await capture(page, { name: `${user.key}__buscador-pacientes__${vwKey}`, role: user.key, screen: "Buscador de pacientes con resultados", vwKey, route: "/inicio", fullPage: false });
        }
      }
      if (user.key === "profesional_asistencial" && wantRoute("toast")) {
        await ctx.addCookies([{ name: "flash", value: encodeURIComponent("Visita marcada como realizada. Siguiente paso: cargá la evolución de esa visita desde Historia clínica."), url: BASE }]);
        await go(page, "/agenda");
        await page.waitForTimeout(900);
        await capture(page, { name: `${user.key}__aviso-confirmacion__${vwKey}`, role: user.key, screen: "Aviso de confirmación (toast) sobre la agenda", vwKey, route: "/agenda", fullPage: false });
      }
      if (pageErrors.length) console.log("  errores de JS:", pageErrors.slice(0, 3));
      await ctx.close();
    }
  }
  await browser.close();

  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(OUT, "resumen.md"), summary(results));
  console.log(`\nListo: ${results.length} capturas en ${OUT}. Resumen: ${path.join(OUT, "resumen.md")}`);
}

function summary(rs) {
  const lines = ["# Resumen de la auditoría responsive", "", `Capturas: ${rs.length}. Anchos: ${WIDTHS.join(", ")}.`, ""];
  for (const w of WIDTHS) {
    lines.push(`## ${w} px`, "");
    lines.push("| Rol | Pantalla | Gravedad | Hallazgos |", "|---|---|---|---|");
    for (const r of rs.filter((x) => x.width === w)) {
      const g = r.severity.some((s) => s[0] === "alta") ? "alta" : r.severity.some((s) => s[0] === "media") ? "media" : r.severity.length ? "baja" : "ok";
      lines.push(`| ${r.role} | ${r.screen}${r.note ? " (" + r.note + ")" : ""} | ${g} | ${r.severity.map((s) => s[1]).join("; ") || "—"} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
