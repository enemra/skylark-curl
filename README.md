# skylark-curl

Utilities to sign requests to the Swift Navigation Skylark API.  We offer two
modes of operation:

1) A CLI passthrough to `curl` that will HMAC-sign requests for you.

2) An HTTP proxy that will sign your requests in flight.

3) A JavaScript library that will sign requests for you, on your own terms.

## Installation

If you prefer, you can install this package globally so the `skylark-curl`
package is available on your PATH by running:

```bash
    npm install -g git+ssh://git@github.com:swift-nav/skylark-curl.git
```

## Usage

Fetch an auth token/secret pair:

```bash
    skylark-curl --uri http://localhost:3030/auth/token -- -X POST
```

Use your token and secret to make requests:

```bash
    skylark-curl --uri http://localhost:3030/auth/verify --token asdf --secret sdfg
```

You can start it in proxy mode like so:

```bash
    skylark-curl --mode proxy --uri http://localhost:3030 --port 3031
```

Any requests you make to localhost:3031 will be forwarded to localhost:3030
with the following modifications:

1) The `X-SwiftNav-Date` header will be added to the request.

2) The `X-SwiftNav-Proxy-Token` and `X-SwiftNav-Proxy-Secret` headers will be
   used to sign the request in the `Authorization` header.
   
3) All `X-SwiftNav-Proxy-*` headers will be scrubbed from the request.

To use the API, you would

1) Start the proxy

2) Make a request through it without Token and Secret headers to the /auth/token
   endpoint to get those values.
   
3) Send subsequent requests with those headers included.

## License

This code is MIT-licensed except for certain portions redistributed under the
BSD license (as noted).
