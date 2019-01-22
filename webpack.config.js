const path = require('path');
const os = require('os');
const fs = require('fs');
const cpy = require('cpy');
const WebPackOnBuild = require('on-build-webpack');
const pkg = require('./package.json');

const name = pkg.name;
const qname = name;
const qnamejs = `${qname}.js`;
const srcDir = path.resolve(__dirname, 'src');
const entry = path.resolve(srcDir, qnamejs);
const output = path.resolve(__dirname, 'dist');

const qdirpath = [os.homedir(), 'Qlik', 'Sense', 'Extensions', qname];
if (os.platform() === 'win32') {
  qdirpath.splice(1, 0, 'Documents');
}
const qdir = path.resolve(...qdirpath);

if (!fs.existsSync(output)) {
  fs.mkdirSync(output);
}
fs.writeFileSync(path.resolve(output, `${qname}.qext`), JSON.stringify({
  name: 'Mekaarogram',
  description: pkg.description,
  author: pkg.author,
  type: 'visualization',
  version: pkg.version,
  preview: 'assets/mekaarogram.png',
  homepage: pkg.homepage,
}, null, 2));

function onBuild() {
  cpy([
    `${qname}.qext`,
    '*.wbl',
    'assets/*.PNG',
    'css/*.ttf',
  ], output, {
    cwd: srcDir,
    parents: true,
  }).then(() => {
    cpy(['./**/*.*'], qdir, {
      cwd: output,
      parents: true,
    });
  });
}

const config = {
  entry,
  output: {
    path: output,
    filename: qnamejs,
    libraryTarget: 'amd',
  },
  module: {
    rules: [
      {
        test: /\.scss$|\.css$/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              url: false,
            },
          },
          'sass-loader',
        ],
      },
      {
        test: /\.html$/,
        loader: 'svg-inline-loader',
      },
      {
        test: /\.js$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', {
                modules: false,
                targets: {
                  browsers: ['ie 11', 'chrome 47'], // chrome 47 is used in QS Desktop
                },
              }],
            ],
          },
        },
      },
    ],
  },
  externals: [{
    translator: 'translator',
    components: 'client.property-panel/components/components',
    require: 'require',
    qvangular: 'qvangular',
    jquery: 'jquery',
    color: 'general.utils/color',
    state: 'client.utils/state',
    touche: 'touche',
  }],
  plugins: [
    new WebPackOnBuild(onBuild),
  ],
};

module.exports = config;
