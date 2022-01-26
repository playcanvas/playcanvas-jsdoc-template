# PlayCanvas JSDoc Template
This is a JSDoc 3 template for the PlayCanvas API Reference. It is generated automatically during engine publishing process and hosted on: https://developer.playcanvas.com/api/

## How to build

Ensure you have [Node.js](https://nodejs.org) installed. Then, install all of the required Node.js dependencies:

    npm install

Then you can build CSS styles:

    npm run build

To test static html files, you need to use PlayCanvas Engine repository. Clone https://github.com/playcanvas/engine besides this repository:

    ./playcanvas-jsdoc-template/
    ./engine/

Then edit `./engine/conf-api.json`, field `opts.template` to: `"../playcanvas-jsdoc-template"` so it will use your local copy of templates for building the docs, and then in `./engine/` run:

    npm run docs

Static files will be generated to:

    ./engine/docs/

These can be served by the web server of your choice or viewed directly by opening `./engine/docs/index.html` in a web browser.
