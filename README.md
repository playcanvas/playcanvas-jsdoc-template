# PlayCanvas JSDoc Template
This is JSDoc 3 template for PlayCanvas API Reference that is generated automatically during engine publishing process and hosted on: https://developer.playcanvas.com/api/

## How to build

Ensure you have [Node.js](https://nodejs.org) installed. Then, install all of the required Node.js dependencies:

    npm install

Then you can build CSS styles:

    npm run build

To test static html files, you need to use PlayCanvas Engine repository. Clone https://github.com/playcanvas/engine besides this repository:

    ./playcanvas-jsdoc-template/
    ./engine/

Then edit `./engine/conf-api.json`, field `opts.template` to: `"../api-reference"` so it will use your local copy of templates for building docs, and then in `./engine/` run:

    npm run docs

Static files will be generated to:

    ./engine/docs/

And can be served by web server of your choice or viewed directly by openning `./engine/docs/index.html` in browser.
