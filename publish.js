var template = require('jsdoc/template');
var fs = require('jsdoc/fs');
var path = require('jsdoc/path');
var handlebars = require("handlebars");
var helper = require("jsdoc/util/templateHelper");

// var logger = require('jsdoc/util/logger');

/** @module publish */

/**
 * Generate documentation output.
 *
 * @param {TAFFY} data - A TaffyDB collection representing
 *                       all the symbols documented in your code.
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
    all.map(function (i) {
        if (i.kind === "member" || i.kind  === "constant") {
            if (i.scope === 'instance') {
                if (!cls.properties) {
                    cls.properties = [];
                } else {
                    // make sure we don't add duplicate properties
                    for (var p = 0; p < cls.properties.length; p++) {
                        if (cls.properties[p].name === i.name)
                            return;
                    }
                }

                cls.properties.push(i);
            } else if (i.scope === 'static') {
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

    var alphaSort = function (a, b) {
        if (a.longname && b.longname) {
            if (a.longname < b.longname) return -1;
            if (a.longname > b.longname) return 1;
            return 0;
        }

        if (a.name && b.name) {
            if (a.name < b.name) return -1;
            if (a.name > b.name) return 1;
            return 0;
        }
    };

    // console.log(cls.properties)
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

            inherited.cls.push(data({ kind: ["class", "interface"], access: { "isUndefined": true }, undocumented: { "isUndefined": true }, "longname": base }).first());

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
            all.map(function (doclet) {
                if (doclet.kind === "member") {
                    if (doclet.scope === 'instance') {
                        if (!inherited.cls[i].properties) {
                            inherited.cls[i].properties = [];
                        }
                        inherited.cls[i].properties.push(doclet);
                    } else if (doclet.scope === 'static') {
                        inherited.members.push(doclet);
                    }
                } else if (doclet.kind === "function") {
                    if (doclet.scope === 'instance') {
                        inherited.methods.push(doclet);
                    } else if (doclet.scope === 'static') {
                        inherited.staticMethods.push(doclet);
                    }
                } else if (doclet.kind === "event") {
                    inherited.events.push(doclet);
                }
            });

            // sort members alphabetically
            inherited.members.sort(alphaSort);
            inherited.methods.sort(alphaSort);
            inherited.staticMethods.sort(alphaSort);
            inherited.events.sort(alphaSort);
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
    if (cls.longname) {
        // class object
        return cls.longname + ".html";
    }

    // class name
    return cls + ".html";

};

// Return an anchor link string from a type
var typeLink = function (type) {
    var builtins = {
        "Undefined": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Undefined",
        "Null": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Null",
        "Array": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array",
        "ArrayBuffer": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer",
        "Boolean": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean",
        "Element": "https://developer.mozilla.org/en-US/docs/Web/API/Element",
        "Error": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error",
        "Function": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function",
        "HTMLImageElement": "https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement",
        "HTMLVideoElement": "https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement",
        "HTMLAudioElement": "https://developer.mozilla.org/en-US/docs/Web/API/HTMLAudioElement",
        "HTMLCanvasElement": "https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement",
        "KeyboardEvent": "https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent",
        "MouseEvent": "https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent",
        "Number": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number",
        "Object": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object",
        "String": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String",
        "Touch": "https://developer.mozilla.org/en-US/docs/Web/API/Touch",
        "TouchEvent": "https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent",
        "Audio": "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/audio",
        "AudioNode": "https://developer.mozilla.org/en-US/docs/Web/API/AudioNode",
        "AudioBuffer": "https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer",
        "AudioContext": "https://developer.mozilla.org/en-US/docs/Web/API/AudioContext",
        "AudioBufferSourceNode": "https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode",
        "Window": "https://developer.mozilla.org/en-US/docs/Web/API/Window",
        "Uint8Array": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array",
        "Uint16Array": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint16Array",
        "Float32Array": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Float32Array",
        "*": "#" // blerg
    };

    var re = /Array.<(.*)>/; // regexp for arrays of types
    var url = null; // URL to link to type
    var name; // name of type
    var display = null; // display name of type

    // Get the name from string or type object
    name = type;
    if (type.longname) {
        name = type.longname;
    }

    // Check for array
    var result = re.exec(name);
    if (result) {
        name = result[1];
        display = name + "[]";
    } else {
        display = name;
    }

    // Check for builtin type
    if (builtins[name]) {
        url = builtins[name];
    } else if (name.startsWith("pc.callbacks")) {
        url = "pc.callbacks.html#" + name.substring("pc.callbacks.".length);
    } else {
        url = clsUrl(name);
    }

    return '<a href="' + url + '">' + display + '</a>';
};

var setupTemplates = function (dir) {
    handlebars.registerPartial("header", fs.readFileSync(path.join(dir, "tmpl/header.tmpl"), { encoding: "utf-8" }));
    handlebars.registerPartial("navigation", fs.readFileSync(path.join(dir, "tmpl/nav.tmpl"), { encoding: "utf-8" }));
    handlebars.registerPartial("class", fs.readFileSync(path.join(dir, "tmpl/class.tmpl"), { encoding: "utf-8" }));
    handlebars.registerPartial("method", fs.readFileSync(path.join(dir, "tmpl/method.tmpl"), { encoding: "utf-8" }));
    handlebars.registerPartial("property", fs.readFileSync(path.join(dir, "tmpl/property.tmpl"), { encoding: "utf-8" }));
    handlebars.registerPartial("event", fs.readFileSync(path.join(dir, "tmpl/event.tmpl"), { encoding: "utf-8" }));
    handlebars.registerPartial("typedef", fs.readFileSync(path.join(dir, "tmpl/typedef.tmpl"), {encoding: "utf-8"}));
    handlebars.registerPartial("example", fs.readFileSync(path.join(dir, "tmpl/example.tmpl"), { encoding: "utf-8" }));
    handlebars.registerPartial("analytics", fs.readFileSync(path.join(dir, "tmpl/analytics.tmpl"), { encoding: "utf-8" }));

    handlebars.registerHelper("excerpt", function (text) {
        // return the first characters of the string up to and including the first period (.) not inside curly braces
        if (text) {
            var n = text.search(/\.(?![^{]*})/);
            if (n > 0) {
                return text.slice(0, n + 1);
            }
            return text;

        }

        return text;
    });

    // parse a section of text and convert @link tags into links
    handlebars.registerHelper("parse", function (text) {
        return helper.resolveLinks(text);
    });

    // return a class URL from a class object or class longname
    handlebars.registerHelper("clsurl", function (cls) {
        return clsUrl(cls);
    });

    handlebars.registerHelper("readonly", function (prop) {
        if (prop.readonly) {
            return "<span class='readonly'>[read only]</span>";
        }

        return "";
    });

    // return a string with the method signature. e.g. (parama, paramb)
    handlebars.registerHelper("methodsig", function (method) {
        var sig = "(";

        if (method.params) {
            for (var i = 0; i < method.params.length; i++) {
                if (method.params[i].name.indexOf(".") < 0) { // skip object param documentation
                    if (i !== 0) sig += ", ";
                    var name = method.params[i].name;
                    if (method.params[i].optional) {
                        name = "[" + name + "]";
                    }
                    sig += name;
                }
            }
        }

        return sig + ")";
    });

    // return a link "<a>" for the set of types from a method/property/param
    handlebars.registerHelper("type-link", function (types) {
        try {
            var result = "";
            for (var i = 0; i < types.names.length; i++) {
                if (i !== 0) result += ", ";
                result += typeLink(types.names[i]);
            }

            return result;
        } catch (e) {
            console.error("Can't generate type link. Search output for {{TYPE-ERROR}}");
            return "{{TYPE-ERROR}}";
        }
    });
};

var copyStaticFiles = function (dir, outdir, callback) {
    let fromDir;
    let staticFiles;

    fs.mkPath(outdir);

    // copy the template's static files to outdir
    fromDir = path.join(dir, 'static');
    staticFiles = fs.ls(fromDir, 3);

    staticFiles.forEach(fileName => {
        const toDir = fs.toDir( fileName.replace(fromDir, outdir) );

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

exports.publish = function (data, opts) {
    var outdir = path.join(env.pwd, opts.destination);
    var tmpldir = opts.template;

    setup({
        tmpldir: tmpldir,
        outdir: outdir
    }, function () {

        // register all links
        var registeredLinks = {};

        var invalidCharsInLink = /#\./g;

        data().each(function (doclet) {
            if (registeredLinks[doclet.longname])
                return;

            var link = helper.createLink(doclet);
            // FIX: replace #. with # in links
            link = link.replace(invalidCharsInLink, '#');

            helper.registerLink(doclet.longname, link);
            registeredLinks[doclet.longname] = true;
        });

        // Query for list of all classes
        var classes = data({ kind: ["class", "interface"], access: { "isUndefined": true }, undocumented: { "isUndefined": true } }).order("longname").get();
        var modules = data({ kind: "namespace", access: { "isUndefined": true }, undocumented: { "isUndefined": true } }).order("longname").get();

        classes = modules.concat(classes);
        classes.forEach(function (cls) {
            cls._class = (cls.kind === "class" || cls.kind === "interface");
            cls._namespace = (cls.kind === "namespace");
        });

        // Compile the standard page template
        var tmpl = handlebars.compile(fs.readFileSync(path.join(tmpldir, "tmpl/page.tmpl"), { encoding: "utf8" }), { preventIndent: true });

        var count = 0;
        // Create a page for each class
        classes.forEach(function (cls) {
            // register all the class names as links
            helper.registerLink(cls.longname, clsUrl(cls));


            var info = getClassInfo(data, cls);
            var context = {
                env: opts.env,
                classes: classes,
                cls: info,
                title: cls.longname
            };

            var page = tmpl(context);

            var outpath = path.join(outdir, cls.longname + ".html");
            fs.mkPath(outdir);
            fs.writeFileSync(outpath, page, "utf8");
        });

        var tmpl = handlebars.compile(fs.readFileSync(path.join(tmpldir, "tmpl/frontpage.tmpl"), { encoding: "utf-8" }), { preventIndent: true });
        var frontpage = tmpl({ env: opts.env, classes: classes });
        var outpath = path.join(outdir, "index.html");
        fs.writeFileSync(outpath, frontpage, "utf8");
    });
};
