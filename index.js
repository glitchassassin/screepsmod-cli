const http = require('http')
const express = require('express')
const bodyParser = require('body-parser')
const vm = require('vm')
const util = require('util')
const fs = require('fs')
const YAML = require('yaml')

/** @type {Config} */
const DEFAULTS = {
    host: "localhost",
    port: 21028,
};

/**
 * Loads config from config.yml (or .yaml)
 * @returns {Config}
 */
function loadConfig() {
    /** @type {Config | undefined} */
    let config;
    for (const filename of ['config.yml', 'config.yaml']) {
        try {
            config = YAML.parse(fs.readFileSync(filename, 'utf8')).cli || {};
            console.log('Loaded CLI config from ' + filename);
            break;
        } catch (e) {
            // skip this file
            console.log(filename, e)
        }
    }
    if (!config) {
        return DEFAULTS;
    }
    return Object.assign({}, DEFAULTS, config);
}

/**
 * @param {import('typed-screeps-server').ServerConfig} config
 */
module.exports = config => {
    if (config.backend) {
        const pkg = require("./package.json");
        config.backend.features ??= [];
        config.backend.features.push({
            name: pkg.name,
            // @ts-expect-error typed as number, but clearly accepts a string as well
            version: pkg.version,
        });
    }

	if (config.cli) {
        const { host, port, username, password } = loadConfig();
		const app = express()
		const server = http.createServer(app)
        const cli = config.cli

        // Endpoints
		app.get('/greeting', (req, res) => {
			let build = ' '
			try {
                // @ts-expect-error not in our typed modules list
				build = 'v'+require('screeps').version
			}catch(err){}
			let text = cli.greeting.replace('{build}', build)
			res.write(text)
			res.end()
		})
		app.post('/cli', bodyParser.text({ type: req => true }), async (req, res) => {
            /**
             * @param {string} data
             * @param {boolean} [isResult]
             */
			const cb = (data, isResult) => {
				res.write(data + "\n")
				if (isResult) {
					res.end()
				}
			}
			const command = req.body
			const ctx = vm.createContext(cli.createSandbox(cb))
			try {
				const result = await vm.runInContext(command, ctx)
				if (typeof result != 'string') {
					cb(''+util.inspect(result), true)
				} else {
					cb(''+result, true)
				}
			} catch (err) {
                cb('Error: ' + (err instanceof Error ? err.stack : err), true)
			}
		})

        // Basic auth, if configured
        app.use((req, res, next) => {
            if (!username || !password) {
                return next()
            }
            
            const b64auth = (req.headers.authorization || '').split(' ')[1] || ''
            const [authName, authPass] = Buffer.from(b64auth, 'base64').toString().split(':')

            if (username === authName && password === authPass) {
                return next()
            }

            res.set('WWW-Authenticate', 'Basic realm="cli"')
            res.status(401).send('Authentication required.')
        })

        // Start the server
		server.listen(port, host);

        console.log(`Started REST CLI server on ${host}:${port}`);
	}
}