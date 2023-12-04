/* eslint-disable import/extensions */

// jsdoc 4.x imports are added to the environment dynamically by the
// jsdoc.js file using 'requizzle'.  Lint rules can not see this causing
// the following require statements to produce an error.  This changes in
// version 5 with the move to es modules.

const fs = require('jsdoc/fs');
const helper = require('jsdoc/util/templateHelper');
const path = require('jsdoc/path');

const handlebars = require("handlebars");

// alphabetical sort ignoring case, correctly sort diacritics, special symbols
const localeAlphaSort = function (a, b) {
    if (a.longname && b.longname) {
        return a.longname.localeCompare(b.longname);
    }

    if (a.name && b.name) {
        return a.name.localeCompare(b.name);
    }

    return 0;
};

const alphaSort = localeAlphaSort;


/** @module publish */

/**
 * Generate documentation output.
 *
 * @param {object} data - A TaffyDB collection representing all the symbols documented in your code.
 * @param {object} opts - An object with options information.
 */

// Build an object for a class by collecting, class, methods, events, base class, inherited methods and events
function getClassInfo(data, cls) {
    var members = [];
    var methods = [];
    var staticMethods = [];
    var events = [];
    var typedefs = [];

    // get all data used by classes
    var all = data({
        kind: ["constant", "member", "function", "event", "typedef"],
        access: {
            "isUndefined": true
        },
        inherited: {
            "isUndefined": true
        },
        undocumented: {
            "isUndefined": true
        },
        memberof: cls.longname
    }).get();

    // sort into different kinds
    all.forEach((i) => {
        if (i.kind === "member" || i.kind  === "constant") {
            // Workaround for the following JSDoc issue:
            //   https://github.com/jsdoc/jsdoc/issues/1427
            // We know that any PlayCanvas class property that is uppercase should
            // be static regardless of what scope is set to.
            if (i.scope === 'instance' && i.name === i.name.toUpperCase()) {
                i.scope = 'static';
            }

            if (i.scope === 'instance') {
                if (!cls.properties) {
                    cls.properties = [];
                } else {
                    // make sure we don't add duplicate properties
                    for (let p = 0; p < cls.properties.length; p++) {
                        if (cls.properties[p].name === i.name) {
                            return;
                        }
                    }
                }

                cls.properties.push(i);
            } else if (i.scope === 'static') {
                // make sure we don't add duplicate static members
                for (let p = 0; p < members.length; p++) {
                    if (members[p].name === i.name) {
                        return;
                    }
                }

                members.push(i);
            }
        } else if (i.kind === "function") {
            if (i.scope === 'instance') {
                methods.push(i);
            } else if (i.scope === 'static') {
                staticMethods.push(i);
            }
        } else if (i.kind === "event") {
            events.push(i);
        } else if (i.kind === "typedef") {
            typedefs.push(i);
        }
    });

    // sort members alphabetically
    if (cls.properties) cls.properties.sort(alphaSort);
    members.sort(alphaSort);
    methods.sort(alphaSort);
    staticMethods.sort(alphaSort);
    events.sort(alphaSort);
    typedefs.sort(alphaSort);

    var inherited = null;
    if (cls.augments && cls.augments.length) {
        inherited = {
            cls: [],
            members: [],
            methods: [],
            staticMethods: [],
            events: []
        };

        for (var i = 0; i < cls.augments.length; i++) {
            var base = cls.augments[i];

            const queryItems = data({ kind: ["class", "interface"], access: { "isUndefined": true }, undocumented: { "isUndefined": true }, "longname": base }).get();
            inherited.cls.push(queryItems[0]);

            all = data({
                kind: ["member", "function", "event"],
                access: {
                    "isUndefined": true
                },
                inherited: true,
                undocumented: {
                    "isUndefined": true
                },
                memberof: cls.longname
            }).get();

            // sort into different kinds
            // eslint-disable-next-line no-loop-func
            all.forEach((doclet) => {
                let kind;

                if (doclet.kind === "member") {
                    if (doclet.scope === 'instance') {
                        if (!inherited.cls[i].properties) {
                            inherited.cls[i].properties = [];
                        }

                        // Making sure there is no existing property with that name.
                        if (!inherited.cls[i].properties.find(d => doclet.name === d.name)) {
                            inherited.cls[i].properties.push(doclet);
                        }
                    } else if (doclet.scope === 'static') {
                        kind = 'members';
                    }
                } else if (doclet.kind === "function") {
                    if (doclet.scope === 'instance') {
                        kind = 'methods';
                    } else if (doclet.scope === 'static') {
                        kind = 'staticMethods';
                    }
                } else if (doclet.kind === "event") {
                    kind = 'events';
                }

                // Making sure there is no doclet of that name within the same kind.
                if (kind && inherited[kind] && !inherited[kind].find(d => doclet.name === d.name)) {
                    inherited[kind].push(doclet);
                }
            });

            // sort members alphabetically
            inherited.members.sort(alphaSort);
            inherited.methods.sort(alphaSort);
            inherited.staticMethods.sort(alphaSort);
            inherited.events.sort(alphaSort);

            if (inherited.cls[i].properties) {
                inherited.cls[i].properties.sort(alphaSort);
            }
        }
    }

    return {
        cls: cls,
        inherited: inherited ? inherited : null,
        methods: methods.length ? methods : null,
        staticMethods: staticMethods.length ? staticMethods : null,
        members: members.length ? members : null,
        events: events.length ? events : null,
        typedefs: typedefs.length ? typedefs : null
    };
}

// return the relative URL from a class or class longname
var clsUrl = function (cls) {
    var name = cls.longname || cls;

    // This should catch any string literals that do no need to be hyperlinked
    if (name.includes('"')) {
        return null;
    }

    if (name !== 'pc') {
        name = 'pc.' + name;
    }

    // class name
    return name + ".html";
};

// Recursively unwrap type (if array or class reference)
var unwrapType = function (name, display) {
    var match;
    var type;

    // Check for arrays of types
    match = /^Array.<(.*)>$/i.exec(name);
    if (match) {
        name = match[1];

        type = unwrapType(name, display);
        display = type.display + "[]";
        name = type.name;
    }

    // Check for key-value (aka dictionary or index signature) types
    match = /^Object.<string,\s*(.*)>$/i.exec(name);
    if (match) {
        name = match[1];

        type = unwrapType(name, display);
        display = "{ [string]: " + type.display + " }";
        name = type.name;
    }

    // Check for class reference types (as opposed to class instances)
    match = /^Class.<(.*)>$/i.exec(name);
    if (match) {
        name = match[1];

        type = unwrapType(name, display);
        display = "typeof(" + type.display + ")";
        name = type.name;
    }

    return {
        name: name,
        display: display || name
    };
};

// External type links
const builtins = {
    "undefined": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Undefined",
    "null": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Null",
    "array": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array",
    "arraybuffer": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer",
    "boolean": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean",
    "element": "https://developer.mozilla.org/en-US/docs/Web/API/Element",
    "error": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error",
    "function": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function",
    "htmlimageelement": "https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement",
    "htmlvideoelement": "https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement",
    "htmlaudioelement": "https://developer.mozilla.org/en-US/docs/Web/API/HTMLAudioElement",
    "htmlcanvaselement": "https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement",
    "globalthis.keyboardevent": "https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent",
    "globalthis.mouseevent": "https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent",
    "number": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number",
    "object": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object",
    "string": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String",
    "globalthis.touch": "https://developer.mozilla.org/en-US/docs/Web/API/Touch",
    "globalthis.touchevent": "https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent",
    "audio": "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/audio",
    "audionode": "https://developer.mozilla.org/en-US/docs/Web/API/AudioNode",
    "audiobuffer": "https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer",
    "audiocontext": "https://developer.mozilla.org/en-US/docs/Web/API/AudioContext",
    "audiobuffersourcenode": "https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode",
    "window": "https://developer.mozilla.org/en-US/docs/Web/API/Window",
    "int8array": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Int8Array",
    "uint8array": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array",
    "uint8clampedarray": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8ClampedArray",
    "int16array": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Int16Array",
    "uint16array": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint16Array",
    "int32array": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Int32Array",
    "uint32array": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint32Array",
    "float32array": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Float32Array",
    "gamepad": "https://developer.mozilla.org/en-US/docs/Web/API/Gamepad",
    "document": "https://developer.mozilla.org/en-US/docs/Web/API/Document",
    "xmlhttprequest": "https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest",
    "svgimageelement": "https://developer.mozilla.org/en-US/docs/Web/API/SVGImageElement",
    "blob": "https://developer.mozilla.org/en-US/docs/Web/API/Blob",
    "imagedata": "https://developer.mozilla.org/en-US/docs/Web/API/ImageData",
    "imagebitmap": "https://developer.mozilla.org/en-US/docs/Web/API/ImageBitmap",
    "this": "https://www.typescriptlang.org/docs/handbook/advanced-types.html#polymorphic-this-types",
    "*": "#" // blerg
};

// Return an anchor link string from a type
const typeLink = (type) => {
    // Get the name from string or type object
    let typeName = type;
    if (type.longname) {
        typeName = type.longname;
    }

    const unwrapped = unwrapType(typeName);
    const name = unwrapped.name;
    const display = unwrapped.display;

    // Check for builtin type
    let url;
    const builtin = builtins[name.toLowerCase()];
    if (builtin) {
        url = builtin;
    } else if (name.endsWith('Callback') || realTypedefs[type]) {
        url = `pc.html#${name}`;
    } else {
        url = clsUrl(name);
    }

    return url ? `<a href="${url}">${display}</a>` : display;
};

const setupTemplates = (dir) => {
    const partials = ['analytics', 'class', 'event', 'example', 'header', 'method', 'navigation', 'property', 'typedef'];
    partials.forEach((partialName) => {
        const partialPath = path.join(dir, 'tmpl', `${partialName}.hbs`);
        const partial = fs.readFileSync(partialPath, { encoding: 'utf8' });
        handlebars.registerPartial(partialName, partial);
    });

    handlebars.registerHelper('excerpt', function (text) {
        // return the first characters of the string up to and including the first period (.) not inside curly braces
        if (text) {
            const n = text.search(/\.(?![^{]*})/);
            if (n > 0) {
                return text.slice(0, n + 1);
            }
            return text;

        }

        return text;
    });

    // parse a section of text and convert @link tags into links
    handlebars.registerHelper('parse', function (text) {
        let result = helper.resolveLinks(text);

        // add pc. prefix to API links
        const regex = /href="(\w+)\.html/g;
        let match;
        while ((match = regex.exec(result))) {
            if (match[1] === 'pc') continue;
            result = result.substring(0, match.index) +
                     `href="pc.${match[1]}.html` +
                     result.substring(match.index + 11 + match[1].length);
        }

        return result;
    });

    // return a class URL from a class object or class longname
    handlebars.registerHelper('clsurl', function (cls) {
        return clsUrl(cls);
    });

    handlebars.registerHelper('readonly', function (prop) {
        return prop.readonly ? '<span class="readonly">[read only]</span>' : '';
    });

    // return a string with the method signature. e.g. (parama, paramb)
    handlebars.registerHelper('methodsig', function (method) {
        let sig = '(';

        if (method.params) {
            for (let i = 0; i < method.params.length; i++) {
                if (method.params[i].name.indexOf('.') < 0) { // skip object param documentation
                    if (i !== 0) sig += ', ';
                    let name = method.params[i].name;
                    if (method.params[i].optional) {
                        name = `[${name}]`;
                    }
                    sig += name;
                }
            }
        }

        return sig + ')';
    });

    // return a link "<a>" for the set of types from a method/property/param
    handlebars.registerHelper('type-link', function (types) {
        try {
            var result = '';
            for (var i = 0; i < types.names.length; i++) {
                if (i !== 0) result += ', ';
                result += typeLink(types.names[i]);
            }

            return result;
        } catch (e) {
            console.error("Can't generate type link. Search output for {{TYPE-ERROR}}");
            return '{{TYPE-ERROR}}';
        }
    });
};

const loadTemplate = (path) => {
    const templateSrc = fs.readFileSync(path, { encoding: "utf-8" });
    return handlebars.compile(templateSrc, { preventIndent: true });
};

var copyStaticFiles = function (dir, outdir, callback) {
    fs.mkPath(outdir);

    // copy the template's static files to outdir
    const fromDir = path.join(dir, 'static');
    const staticFiles = fs.ls(fromDir, 3);

    staticFiles.forEach((fileName) => {
        const toDir = fs.toDir(fileName.replace(fromDir, outdir));

        fs.mkPath(toDir);
        fs.copyFileSync(fileName, toDir);
    });

    callback();
};

var setup = function (opts, callback) {
    setupTemplates(opts.tmpldir);
    copyStaticFiles(opts.tmpldir, opts.outdir, function (err) {
        if (!err) {
            callback();
        } else {
            console.error(err);
        }
    });
};

/**
 * These are real @typedef's, neither callbacks nor import('abc').xyz
 * This means they all have at least one property in `properties`.
 *
 * @type {Record<string, import('jsdoc').Doclet}
 */
const realTypedefs = {};

/**
 * @param {TAFFY} taffyData - See <http://taffydb.com/>.
 * @param {object} opts - Options object.
 * @param {Tutorial} tutorials - Tutorials data.
 */
exports.publish = (taffyData, opts, tutorials) => {
    var outdir = path.join(env.pwd, opts.destination); /* eslint-disable-line no-undef */
    var tmpldir = opts.template;

    let data = taffyData;

    setup({
        tmpldir: tmpldir,
        outdir: outdir
    }, function () {

        // register all links
        var registeredLinks = {};

        var invalidCharsInLink = /#\./g;

        data = helper.prune(data);

        // Strip all typedefs that are not callbacks
        data(function () {
            if (this.kind === 'typedef' && !this.name.endsWith('Callback')) {
                if (this.properties?.length) {
                    realTypedefs[this.name] = this;
                    return false;
                }
            }
            return this.kind === 'typedef' && !this.name.endsWith('Callback');
        }).remove();

        data().each((doclet) => {
            if (registeredLinks[doclet.longname])
                return;

            // move global scope doclets into the 'pc' namespace
            if (!doclet.memberof) {
                doclet.scope = 'static';
                doclet.memberof = 'pc';
            }

            let link = helper.createLink(doclet);
            // FIX: replace #. with # in links
            link = link.replace(invalidCharsInLink, '#');

            helper.registerLink(doclet.longname, link);
            registeredLinks[doclet.longname] = true;
        });

        // Query for list of all classes
        let classes = data({ kind: ["class", "interface"], access: { "isUndefined": true }, undocumented: { "isUndefined": true } }).get();
        const modules = data({ kind: "namespace", access: { "isUndefined": true }, undocumented: { "isUndefined": true } }).get();

        // Locale aware sort like taffydata.order
        classes.sort(localeAlphaSort);
        modules.sort(localeAlphaSort);

        classes = modules.concat(classes);
        classes.forEach((cls) => {
            cls._class = (cls.kind === "class" || cls.kind === "interface");
            cls._namespace = (cls.kind === "namespace");
        });

        // Compile the standard page template
        let templatePath = path.join(tmpldir, 'tmpl', 'page.hbs');
        let template = loadTemplate(templatePath);

        // Create a page for each class
        classes.forEach((cls) => {
            // register all the class names as links
            helper.registerLink(cls.longname, clsUrl(cls));

            const info = getClassInfo(data, cls);

            const html = template({
                env: opts.env,
                classes: classes,
                cls: info,
                title: cls.longname
            });

            let name = cls.longname;
            if (name !== 'pc') {
                name = 'pc.' + name;
            }

            const outpath = path.join(outdir, name + '.html');
            fs.writeFileSync(outpath, html, 'utf8');
        });

        templatePath = path.join(tmpldir, 'tmpl', 'frontpage.hbs');
        template = loadTemplate(templatePath);
        const html = template({
            env: opts.env,
            classes: classes
        });
        const outpath = path.join(outdir, 'index.html');
        fs.writeFileSync(outpath, html, 'utf8');
    });
};
