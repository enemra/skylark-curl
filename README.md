# skylark-curl

Utilities to sign your requests to the Swift Navigation Skylark API.  We offer
two modes of operation:

1) A CLI passthrough to `curl` that will HMAC-sign requests for you.
2) An HTTP proxy that will sign your requests in flight.  (Coming soon.)

## Installation

It is possible to run `skylark-curl` directly with npm:

  npm run curl -- --uri http://localhost:3030 --token asdf --secret sdfg -- -H "X-MyHeader: MyValue"

Note the first `--` denotes passthrough of arguments to `skylark-curl` and the
second `--` denotes passthrough of arguments to `curl`.

If you prefer, you can install this package globally so the `skylark-curl`
package is available on your PATH (assuming that's setup correctly) by
running:

    npm install -g git+ssh://git@github.com:swift-nav/skylark-curl.git

## Usage

Fetch an auth token/secret pair:

    skylark-curl --uri http://localhost:3030/auth/token -- -X POST

Use your token and secret to make requests:

    skylark-curl --uri http://localhost:3030/accounts --token asdf --secret sdfg
