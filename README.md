# screepsmod-cli

This is heavily inspired by [screeps-launcher's](https://github.com/screepers/screeps-launcher/) climod.

## Testing

Spin up the Docker container:

```bash
docker compose up -d
```

Then try using curl to post a command:

```bash
docker compose run curl -X POST http://localhost:21028/cli -d 'help()'
```

## Usage

If you want to be able to access the CLI endpoint from outside the container, set the host to `0.0.0.0` in your config (and make sure the port is exposed in your docker-compose):

```yml
cli:
  host: 0.0.0.0
  port: 21028
```

Then you can call it directly:

```bash
curl -X POST http://localhost:21028/cli -d 'help()'
```

To pass in a script (note the response will only include the return value of the last command):

```bash
curl -X POST http://localhost:21028/cli -d '@testScript.js'
```