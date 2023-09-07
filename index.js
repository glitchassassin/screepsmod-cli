const http = require('http')
const express = require('express')
const bodyParser = require('body-parser')
const vm = require('vm')
const util = require('util')
const fs = require('fs')
const YAML = require('yaml')

/**
 * Loads config from config.yml (or .yaml)
 * @returns {{
 *   host?: string,
 *   port?: number,
 *   username?: string,
 *   password?: string,
 * }}
 */
function loadConfig() {
    for (const filename of ['/screeps/config.yml', '/screeps/config.yaml']) {
        try {
            cli = YAML.parse(fs.readFileSync(filename, 'utf8')).cli;
            if (cli) console.log('Loaded CLI config from ' + filename);
            return cli;
        } catch (e) {
            // skip this file
            console.log(filename, e)
        }
    }
    return {};
}

module.exports = config => {
    const package = require("./package.json");
    config.backend.features = config.backend.features || [];
    config.backend.features.push({
      name: package.name,
      version: package.version,
    });

	if (config.cli) {
        const cliServerConfig = loadConfig();
		const app = express()
		const server = http.createServer(app)

        // Endpoints
		app.get('/greeting', (req, res) => {
			let build = ' '
			try {
				build = 'v'+require('screeps').version
			}catch(err){}
			let text = config.cli.greeting.replace('{build}', build)
			res.write(text)
			res.end()
		})
		app.post('/cli', bodyParser.text({ type: req => true }), async (req, res) => {
			const cb = (data, isResult) => {
				res.write(data + "\n")
				if (isResult) {
					res.end()
				}
			}
			const command = req.body
			const ctx = vm.createContext(config.cli.createSandbox(cb))
			try {
				const result = await vm.runInContext(command, ctx)
				if (typeof result != 'string') {
					cb(''+util.inspect(result), true)
				} else {
					cb(''+result, true)
				}
			} catch(err) {
				cb('Error: '+(err.stack || err), true)
			}
		})

        // Basic auth, if configured
        app.use((req, res, next) => {
            if (!cliServerConfig.username || !cliServerConfig.password) {
                return next()
            }
            
            const b64auth = (req.headers.authorization || '').split(' ')[1] || ''
            const [username, password] = Buffer.from(b64auth, 'base64').toString().split(':')

            if (cliServerConfig.username === username && cliServerConfig.password === password) {
                return next()
            }

            res.set('WWW-Authenticate', 'Basic realm="cli"')
            res.status(401).send('Authentication required.')
        })

        // Start the server
		server.listen(cliServerConfig.port || 21028, cliServerConfig.host || 'localhost');

        console.log('Started REST CLI server on ' + (cliServerConfig.host || 'localhost') + ':' + (cliServerConfig.port || 21028));
	}
}