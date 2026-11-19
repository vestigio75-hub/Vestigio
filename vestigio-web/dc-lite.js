/* dc-lite: motor mínimo para mostrar las páginas de Vestigio fuera del lienzo de diseño.
   Lee la plantilla (<template id="dc-template">), rellena los {{valores}} con renderVals(),
   conecta ref / onClick y vuelve a pintar solo lo que cambia cuando la página llama setState. */
(function () {
  class DCLogic {
    constructor() { this.props = {}; this.state = {}; }
    setState(patch) {
      const p = typeof patch === 'function' ? patch(this.state, this.props) : patch;
      this.state = Object.assign({}, this.state, p);
      if (this.__render) this.__render();
    }
    forceUpdate() { if (this.__render) this.__render(); }
  }
  window.DCLogic = DCLogic;

  const RE = /\{\{\s*([^}]+?)\s*\}\}/g;
  const ONLY = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;
  const get = (scope, expr) => expr.split('.').reduce((o, k) => (o == null ? undefined : o[k]), scope);
  const evalTpl = (tpl, scope) => {
    const m = tpl.match(ONLY);
    if (m) return get(scope, m[1]);
    return tpl.replace(RE, (_, e) => { const v = get(scope, e); return v == null ? '' : String(v); });
  };

  window.DCBoot = function (Component, props) {
    const tpl = document.getElementById('dc-template');
    const frag = tpl.content;
    // <helmet>: estilos y fuentes van al <head>
    frag.querySelectorAll('helmet').forEach((h) => {
      Array.from(h.childNodes).forEach((n) => document.head.appendChild(document.importNode(n, true)));
      h.remove();
    });
    const comp = new Component();
    comp.props = Object.assign({}, props || {}, comp.props || {});
    comp.state = comp.state || {};
    let vals = comp.renderVals ? comp.renderVals() : {};
    const bindings = [], refs = [];

    const build = (src, parent, scopeFn) => {
      src.childNodes.forEach((n) => {
        if (n.nodeType === 3) {
          const t = document.createTextNode('');
          if (n.data.indexOf('{{') >= 0) { bindings.push({ node: t, tpl: n.data, scopeFn, last: null }); t.data = String(evalTpl(n.data, scopeFn(vals)) ?? ''); }
          else t.data = n.data;
          parent.appendChild(t);
          return;
        }
        if (n.nodeType !== 1) { parent.appendChild(document.importNode(n, false)); return; }
        if (n.localName === 'sc-for') {
          const expr = (n.getAttribute('list') || '').replace(/[{}]/g, '').trim();
          const as = n.getAttribute('as') || 'item';
          const list = get(scopeFn(vals), expr) || [];
          for (let i = 0; i < list.length; i++) {
            const sf = (v) => { const base = scopeFn(v); const l = get(base, expr) || []; const o = Object.assign({}, base); o[as] = l[i]; return o; };
            build(n, parent, sf);
          }
          return;
        }
        const el = document.importNode(n, false);
        Array.from(n.attributes).forEach((a) => {
          if (a.value.indexOf('{{') < 0) return;
          const name = a.name;
          if (name === 'ref') { el.removeAttribute(name); refs.push({ el, expr: a.value.replace(/[{}]/g, '').trim(), scopeFn }); return; }
          if (/^on[a-z]/i.test(name)) {
            el.removeAttribute(name);
            const expr = a.value.replace(/[{}]/g, '').trim();
            el.addEventListener(name.slice(2).toLowerCase(), (e) => { const f = get(scopeFn(vals), expr); if (typeof f === 'function') f(e); });
            return;
          }
          const b = { el, attr: name, tpl: a.value, scopeFn, last: null };
          bindings.push(b);
          apply(b);
        });
        build(n, el, scopeFn);
        parent.appendChild(el);
      });
    };
    const apply = (b) => {
      let v = evalTpl(b.tpl, b.scopeFn(vals));
      if (b.node) { v = v == null ? '' : String(v); if (v !== b.last) { b.node.data = v; b.last = v; } return; }
      if (v === b.last) return;
      b.last = v;
      if (v == null || v === false) b.el.removeAttribute(b.attr);
      else b.el.setAttribute(b.attr, v === true ? '' : String(v));
    };

    const root = document.createDocumentFragment();
    const xdc = frag.querySelector('x-dc') || frag;
    build(xdc, root, (v) => v);
    document.body.appendChild(root);
    refs.forEach((r) => { const f = get(r.scopeFn(vals), r.expr); if (typeof f === 'function') f(r.el); });

    let rendering = false;
    comp.__render = () => {
      if (rendering) return;
      rendering = true;
      try { vals = comp.renderVals ? comp.renderVals() : {}; bindings.forEach(apply); }
      finally { rendering = false; }
    };
    if (comp.componentDidMount) comp.componentDidMount();
    window.addEventListener('pagehide', () => { if (comp.componentWillUnmount) comp.componentWillUnmount(); });
    window.__dc = comp;
  };
})();
