import {basename, join} from 'path';
import glob from 'glob';
import postcss from 'postcss';
import remark from 'remark';
import remarkHeadingGap from 'remark-heading-gap';
import remarkLicense from 'remark-license';
import remarkToc from 'remark-toc';
import stringifyObject from 'stringify-object';
import writeFile from 'write-file';
import u from 'unist-builder';
import contributorsSection from './contributorsSection';
import installSection from './installSection';

const homepage = `https://github.com/ben-eb/cssnano`;

function writeError (err) {
    if (err) {
        throw err;
    }
}

function semverMajor (dependencies) {
    Object.keys(dependencies).forEach(dependency => {
        let version = dependencies[dependency];
        if (version[0] === '^' && version[1] !== '0') {
            version = version.split('.')[0] + '.0.0';
        }
        dependencies[dependency] = version;
    });

    return dependencies;
}

function pluginName (plugin) {
    return postcss(plugin).plugins[0].postcssPlugin;
}

function sortPlugins (a, b) {
    const ba = pluginName(a[0]);
    const bb = pluginName(b[0]);
    if (ba < bb) {
        return -1;
    }
    if (ba > bb) {
        return 1;
    }
    return 0;
}

function updatePreset (pkg) {
    const pkgName = basename(pkg);
    const pkgJson = require(`${pkg}/package.json`);
    const plugins = [];

    const preset = require(pkg);
    const instance = preset();

    instance.plugins.sort(sortPlugins).forEach(([plugin, options]) => {
        const name = pluginName(plugin);
        let pluginDesc, pluginRepo;
        try {
            const pluginPkg = require(`${join(__dirname, '../packages', name, 'package.json')}`);
            pluginDesc = pluginPkg.description;
            pluginRepo = pluginPkg.repository;
        } catch (e) {
            // Make an exception for core processors that don't
            // have their own repository.
        }
        const documentation = [];
        if (pluginDesc) {
            documentation.push(
                u('heading', {depth: 3}, [
                    u('link', {url: pluginRepo}, [u('inlineCode', name)]),
                ]),
                u('blockquote', [
                    u('text', pluginDesc),
                ])
            );
        } else {
            documentation.push(
                u('heading', {depth: 3}, [
                    u('inlineCode', name),
                ])
            );
        }
        if (!options) {
            documentation.push(
                u('paragraph', [
                    u('text', 'This plugin is loaded with its default configuration.'),
                ])
            );
        } else {
            documentation.push(
                u('paragraph', [
                    u('text', 'This plugin is loaded with the following configuration:'),
                ]),
                u('code', {lang: 'js'}, stringifyObject(options))
            );
        }
        plugins.push.apply(plugins, documentation);
    });

    let transformedAST = remark()
        .use(contributorsSection)
        .use(installSection)
        .use(remarkLicense, {
            name: pkgJson.author.name,
            license: pkgJson.license,
            url: pkgJson.author.url,
        })
        .use(remarkToc)
        .runSync(u('root', [
            u('heading', {depth: 1}, [u('text', pkgName)]),
            u('blockquote', [
                u('text', pkgJson.description),
            ]),
            u('heading', {depth: 2}, [u('text', 'Table of Contents')]),
            u('heading', {depth: 2}, [u('text', 'Plugins')]),
            ...plugins,
            u('heading', {depth: 2}, [u('text', 'Install')]),
            u('heading', {depth: 2}, [u('text', 'Contributors')]),
            u('heading', {depth: 2}, [u('text', 'License')]),
        ]), {cwd: pkg});

    writeFile(
        `${pkg}/README.md`,
        remark().use(remarkHeadingGap).stringify(transformedAST) + '\n',
        writeError
    );
}

function updatePackage (pkg) {
    const pkgName = basename(pkg);
    const pkgJson = require(`${pkg}/package.json`);

    pkgJson.name = pkgName;
    pkgJson.repository = `${homepage}/tree/master/packages/${pkgName}`;
    pkgJson.homepage = homepage;

    pkgJson.bugs = pkgJson.bugs || {};
    pkgJson.bugs.url = `${homepage}/issues`;

    pkgJson.engines = pkgJson.engines || {};
    pkgJson.engines.node = ">=4";

    if (pkgJson.dependencies) {
        pkgJson.dependencies = semverMajor(pkgJson.dependencies);
    }

    if (pkgJson.devDependencies) {
        pkgJson.devDependencies = semverMajor(pkgJson.devDependencies);
    }

    writeFile(
        `${pkg}/package.json`,
        `${JSON.stringify(pkgJson, null, 2)}\n`,
        writeError
    );
}

glob(`${join(__dirname, '../packages')}/*`, (err, packages) => {
    if (err) {
        throw err;
    }
    packages.forEach(updatePackage);
    packages.filter(p => !basename(p).indexOf('cssnano-preset-')).forEach(updatePreset);
});
