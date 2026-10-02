/* Exercices des scripts de progression, avec un DOM et un stockage minimaux. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
let scenarios = 0;

function portal(storage, unavailable = false) {
    const ids = ["resume-course", "portal-progress-text", "portal-progress-bar", "portal-progress-fill"];
    const html = fs.readFileSync(path.join(root, "espace-apprenant.html"), "utf8");
    const elements = Object.fromEntries(ids.map(id => {
        assert.ok(html.includes(`id="${id}"`), `Élément ${id} présent dans la page`);
        return [id, { style: {}, attributes: {}, setAttribute(key, value) { this.attributes[key] = value; } }];
    }));
    const listeners = [];
    const context = vm.createContext({
        document: { getElementById: id => elements[id], addEventListener: (_, callback) => listeners.push(callback) },
        localStorage: { getItem: key => { if (unavailable) throw new Error("Storage unavailable"); return storage[key] ?? null; } }
    });
    vm.runInContext(fs.readFileSync(path.join(root, "assets/portal.js"), "utf8"), context);
    listeners.forEach(callback => callback());
    scenarios++;
    return elements;
}

const completed = count => Object.fromEntries(Array.from({ length: count }, (_, i) => [`n1-module-${i + 1}-complete`, "true"]));
let elements = portal({});
assert.equal(elements["resume-course"].href, "modules/n1-module-1.html");
assert.equal(elements["portal-progress-bar"].attributes["aria-valuenow"], "0");
elements = portal(completed(2));
assert.equal(elements["resume-course"].href, "modules/n1-module-3.html");
assert.equal(elements["portal-progress-fill"].style.width, "40%");
elements = portal(completed(4));
assert.equal(elements["resume-course"].href, "modules/n1-module-5.html");
elements = portal(completed(5));
assert.equal(elements["resume-course"].href, "modules/quiz-n1.html");
elements = portal({ ...completed(5), "n1-quiz-passed": "true" });
assert.equal(elements["resume-course"].href, "formations/n1-terminee.html");
elements = portal({}, true);
assert.match(elements["portal-progress-text"].textContent, /stockage local/);

function course(url, storage) {
    const listeners = [];
    const location = { pathname: url, href: url };
    const context = vm.createContext({
        document: { querySelector: () => null, querySelectorAll: () => [], addEventListener: (_, callback) => listeners.push(callback) },
        localStorage: { getItem: key => storage[key] ?? null },
        window: { location },
        alert() {}
    });
    vm.runInContext(fs.readFileSync(path.join(root, "script.js"), "utf8"), context);
    listeners.forEach(callback => callback());
    scenarios++;
    return location.href;
}

assert.equal(course("/academie-ia/modules/n1-module-1.html", {}), "/academie-ia/modules/n1-module-1.html");
assert.equal(course("/academie-ia/modules/n1-module-3.html", {}), "n1-module-2.html");
assert.equal(course("/academie-ia/modules/n1-module-3.html", completed(2)), "/academie-ia/modules/n1-module-3.html");
assert.equal(course("/academie-ia/modules/quiz-n1.html", completed(4)), "n1-module-1.html");
assert.equal(course("/academie-ia/modules/quiz-n1.html", completed(5)), "/academie-ia/modules/quiz-n1.html");

for (const folder of [".", "assets", "apps-script", "modules", "formations"]) {
    for (const name of fs.readdirSync(path.join(root, folder))) {
        const file = path.join(root, folder, name);
        if (name.endsWith(".js")) new vm.Script(fs.readFileSync(file, "utf8"), { filename: file });
        if (name.endsWith(".html")) {
            const html = fs.readFileSync(file, "utf8");
            for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
                if (!/\bsrc\s*=/i.test(match[1])) new vm.Script(match[2], { filename: file });
            }
        }
    }
}
console.log(`OK : ${scenarios} scénarios de navigation et syntaxe de tous les scripts JavaScript.`);
